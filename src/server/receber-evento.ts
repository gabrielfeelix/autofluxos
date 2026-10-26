import 'server-only'
import { alertar } from './alertar'
import { mandarAvisoPorModelo } from './aviso-por-modelo'
import { EVENTO_DE_PEDIDO, iniciarPesquisaPosCompra } from './pesquisa-pos-compra'
import { abrirFluxoParaContato, type FabricaDeCanal } from './receber-mensagem'
import { acharContatoPeloTelefone } from './repos/contato-por-telefone'
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
  /** Fora das 24h, e saiu pelo modelo aprovado do evento (`aviso-por-modelo.ts`). */
  | 'por_modelo'
  /**
   * Passou de 24h desde a última mensagem da pessoa e não há modelo aprovado.
   * **Registrado, não enviado**, ver o comentário em `tratarEvento`.
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
    /** Variáveis para o fluxo, quando quem manda sabe montá-las (a ponte da Verandi). */
    variaveis?: Record<string, string>
  },
  /** Injetável só para o teste, como em `receberMensagem`. Em produção é o real. */
  fabricaDeCanal?: FabricaDeCanal,
): Promise<ResultadoDoEvento> {
  // O pedido da loja cria o contato e abre a pesquisa pelo modelo: caminho próprio.
  if (entrada.evento === EVENTO_DE_PEDIDO) {
    const pesquisa = await iniciarPesquisaPosCompra(entrada, fabricaDeCanal)
    return pesquisa === 'enviada' ? 'por_modelo' : pesquisa === 'sem_gatilho' ? 'sem_gatilho' : 'nao_abriu'
  }

  const gatilho = await acharGatilhoDeEvento(entrada.clienteId, entrada.evento)
  // Conta sem gatilho para este evento não é erro, é conta que não pediu esta
  // automação. Alertar aqui encheria a tela de aviso a cada evento que o outro
  // lado manda e que ninguém assinou.
  if (!gatilho) return 'sem_gatilho'

  const contatoId = await acharContatoPeloTelefone(entrada.clienteId, entrada.telefone)
  /**
   * **Telefone desconhecido não cria contato.**
   *
   * Seria a coisa fácil de fazer e a errada: um sistema externo com um número
   * digitado errado encheria a base de contatos-fantasma que nunca falaram com
   * ninguém, e que contam como lead na tela. Quem nunca escreveu para o
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
    entrada.variaveis,
  )
  if (aberto === 'aberto') return 'aberto'

  /**
   * **Fora da janela de 24h: modelo aprovado, ou registra e não promete.**
   *
   * A Meta recusa texto livre depois de 24h sem mensagem da pessoa. Se a conta
   * criou o modelo do evento e a Meta aprovou, ele sai (cobrado como
   * utilidade). Sem modelo, há três saídas, e duas são piores que não fazer
   * nada:
   *
   * - *mandar mesmo assim*, a Cloud API recusa, e a conversa fica com um
   *   registro de entrega falhada que ninguém pediu;
   * - *fingir que avisou*, é exatamente o defeito que esta rodada existe para
   *   consertar, trocado de lugar;
   * - *gravar na ficha e deixar visível*, quem abrir o Inbox vê que a vaga
   *   abriu e decide se liga, manda modelo, ou deixa passar.
   */
  if (aberto === 'janela_fechada') {
    const porModelo = await mandarAvisoPorModelo(
      entrada.clienteId,
      contatoId,
      entrada.evento,
      entrada.variaveis ?? {},
      fabricaDeCanal,
    ).catch(() => 'erro' as const)
    if (porModelo === 'ok') return 'por_modelo'
    try {
      await acrescentarNota(
        entrada.clienteId,
        contatoId,
        porModelo === 'erro'
          ? `evento “${entrada.evento}” chegou fora da janela de 24h e o modelo aprovado não saiu.${resumo(entrada.dados)}`
          : `evento “${entrada.evento}” chegou, mas a janela de 24h estava fechada, nada foi enviado.${resumo(entrada.dados)}`,
      )
    } catch (erro) {
      await alertar('não foi possível registrar o evento fora da janela', erro, {
        cliente: entrada.clienteId,
        contato: contatoId,
      })
    }
    return 'janela_fechada'
  }

  /*
   * Alguém da equipe está atendendo agora (RB-48). **Não é alerta**, e a
   * distinção importa: o evento não saiu porque uma pessoa está no comando da
   * conversa, que é o desfecho certo, não uma falha. Alertar aqui encheria a
   * caixa de avisos exatamente nas conversas mais bem atendidas, e é assim que
   * se aprende a ignorar alertas.
   *
   * A nota fica na ficha, pelo mesmo motivo da janela fechada: quem está
   * atendendo precisa saber que o evento chegou, para decidir se fala dele.
   */
  if (aberto === 'atendimento_humano') {
    try {
      await acrescentarNota(
        entrada.clienteId,
        contatoId,
        `evento “${entrada.evento}” chegou durante o atendimento e não foi enviado pelo bot.${resumo(entrada.dados)}`,
      )
    } catch (erro) {
      await alertar('não foi possível registrar o evento durante o atendimento', erro, {
        cliente: entrada.clienteId,
        contato: contatoId,
      })
    }
    return 'nao_abriu'
  }

  // Bot pausado, fluxo despublicado ou desligado, conversa ocupada. Nenhum é
  // exceção, mas todos significam um aviso que não saiu, e isso precisa
  // aparecer para alguém.
  await alertar('o evento não abriu a conversa', aberto, {
    cliente: entrada.clienteId,
    contato: contatoId,
    evento: entrada.evento,
  })
  return 'nao_abriu'
}

/**
 * Os dados do evento, resumidos para caber numa anotação.
 *
 * **Só as chaves e valores simples**, e com teto: o corpo vem de outro sistema
 * e pode trazer um objeto aninhado inteiro. Despejar isso na ficha de alguém
 * transformaria a anotação, que é o que uma pessoa lê antes de atender, num
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
