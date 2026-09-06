import 'server-only'
import { chavesDoTelefone } from '@/core/contatos/telefone'
import { alertar } from './alertar'
import { db, ehIdInvalido } from './db'
import { abrirFluxoParaContato, type FabricaDeCanal } from './receber-mensagem'
import { acrescentarNota } from './repos/leads'
import { acharGatilhoDeEvento, contarDisparoDeEvento } from './repos/webhooks-de-entrada'

/**
 * Um evento vindo de fora, do webhook de entrada até a conversa (0044).
 *
 * **A promessa que isto cumpre está em produção desde antes desta rota
 * existir.** O preset `verandi-espera` diz "te aviso se abrir"; a agenda
 * dispara e não havia quem recebesse. Quem entrou na fila nunca foi avisado.
 *
 * Separado da rota de propósito: a rota cuida de quem pode chamar (assinatura,
 * teto de corpo, limite); daqui para baixo é o que o evento faz, e isso é
 * testável sem HTTP.
 */

export type ResultadoDoEvento =
  /** O fluxo do gatilho começou e a pessoa foi avisada. */
  | 'aberto'
  /** Nenhum gatilho ativo para este evento. Não é erro: é conta sem a regra. */
  | 'sem_gatilho'
  /** O telefone não é de nenhum contato desta conta. */
  | 'sem_contato'
  /**
   * Passou de 24h desde a última mensagem da pessoa. **Registrado, não
   * enviado** — ver o comentário em `tratarEvento`.
   */
  | 'janela_fechada'
  /** O contato pausou o bot, ou o fluxo do gatilho não está publicado/ativo. */
  | 'nao_abriu'

/**
 * O evento, do telefone até o fluxo.
 *
 * **Nada aqui estoura.** Quem chama já respondeu 200 para o outro lado (a rota
 * responde antes do `after()`), então uma exceção daqui seria um erro sem dono
 * e um evento perdido em silêncio. Tudo que falha vira alerta.
 */
export async function tratarEvento(
  entrada: {
    clienteId: string
    evento: string
    telefone: string
    dados?: Record<string, unknown>
  },
  /** Injetável só para o teste, como em `receberMensagem`. Em produção é o real. */
  fabricaDeCanal?: FabricaDeCanal,
): Promise<ResultadoDoEvento> {
  const gatilho = await acharGatilhoDeEvento(entrada.clienteId, entrada.evento)
  // Conta sem gatilho para este evento não é erro — é conta que não pediu esta
  // automação. Alertar aqui encheria a tela de aviso a cada evento que o outro
  // lado manda e que ninguém assinou.
  if (!gatilho) return 'sem_gatilho'

  const contatoId = await acharContatoPeloTelefone(entrada.clienteId, entrada.telefone)
  /**
   * **Telefone desconhecido não cria contato.**
   *
   * Seria a coisa fácil de fazer e a errada: um sistema externo com um número
   * digitado errado encheria a base de contatos-fantasma que nunca falaram com
   * ninguém — e que contam como lead na tela. Quem nunca escreveu para o
   * cliente não tem conversa, e sem conversa não há janela de 24h nem canal por
   * onde falar. Vira alerta, que é o que faz alguém olhar.
   */
  if (!contatoId) {
    await alertar('evento para um telefone que não é contato desta conta', entrada.telefone, {
      cliente: entrada.clienteId,
      evento: entrada.evento,
    })
    return 'sem_contato'
  }

  await contarDisparoDeEvento(gatilho.id)

  const aberto = await abrirFluxoParaContato(
    entrada.clienteId,
    contatoId,
    gatilho.fluxoId,
    fabricaDeCanal,
  )
  if (aberto === 'aberto') return 'aberto'

  /**
   * **Fora da janela de 24h: registra e não promete.**
   *
   * A Meta recusa texto livre depois de 24h sem mensagem da pessoa, e modelo
   * aprovado só existe depois do app review. Então há três saídas, e duas são
   * piores que não fazer nada:
   *
   * - *mandar mesmo assim* — a Cloud API recusa, e a conversa fica com um
   *   registro de entrega falhada que ninguém pediu;
   * - *fingir que avisou* — é exatamente o defeito que esta rodada existe para
   *   consertar, trocado de lugar;
   * - *gravar na ficha e deixar visível* — quem abrir o Inbox vê que a vaga
   *   abriu e decide se liga, manda modelo, ou deixa passar.
   *
   * A terceira é a única honesta enquanto o modelo aprovado não existir.
   */
  if (aberto === 'janela_fechada') {
    try {
      await acrescentarNota(
        entrada.clienteId,
        contatoId,
        `evento “${entrada.evento}” chegou, mas a janela de 24h estava fechada — nada foi enviado.${resumo(entrada.dados)}`,
      )
    } catch (erro) {
      await alertar('não deu para registrar o evento fora da janela', erro, {
        cliente: entrada.clienteId,
        contato: contatoId,
      })
    }
    return 'janela_fechada'
  }

  // Bot pausado, fluxo despublicado ou desligado, conversa ocupada. Nenhum é
  // exceção — mas todos significam um aviso que não saiu, e isso precisa
  // aparecer para alguém.
  await alertar('o evento não abriu a conversa', aberto, {
    cliente: entrada.clienteId,
    contato: contatoId,
    evento: entrada.evento,
  })
  return 'nao_abriu'
}

/**
 * O contato pelo telefone, aceitando as grafias que significam o mesmo aparelho.
 *
 * `chavesDoTelefone` resolve o nono dígito: o sistema do outro lado pode ter
 * cadastrado `11 8765-4321` e o WhatsApp guardou `5511987654321`. Casar só pela
 * forma exata faria o aviso não sair para metade da base por um dígito que o
 * Brasil acrescentou em 2012.
 */
async function acharContatoPeloTelefone(
  clienteId: string,
  telefone: string,
): Promise<string | null> {
  const chaves = chavesDoTelefone(telefone)
  // Lista vazia = número que não dá para casar com segurança (sem DDD, por
  // exemplo). Chutar aqui casaria o evento de uma pessoa com o cadastro de
  // outra, que é pior que não avisar.
  if (chaves.length === 0) return null

  const { data, error } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .in('wa_id', chaves)
    .limit(1)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para achar o contato: ${error.message}`)
  return data ? (data as { id: string }).id : null
}

/**
 * Os dados do evento, resumidos para caber numa anotação.
 *
 * **Só as chaves e valores simples**, e com teto: o corpo vem de outro sistema
 * e pode trazer um objeto aninhado inteiro. Despejar isso na ficha de alguém
 * transformaria a anotação — que é o que uma pessoa lê antes de atender — num
 * dump de JSON.
 */
function resumo(dados: Record<string, unknown> | undefined): string {
  if (!dados) return ''

  const partes = Object.entries(dados)
    .filter(([, valor]) => typeof valor === 'string' || typeof valor === 'number')
    .slice(0, 5)
    .map(([chave, valor]) => `${chave}: ${String(valor).slice(0, 80)}`)

  return partes.length === 0 ? '' : ` (${partes.join(', ')})`
}
