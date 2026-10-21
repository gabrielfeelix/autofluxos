import 'server-only'
import { permissaoDeEnvio } from '@/channels/janela'
import { FRASE_DO_MOTIVO as FRASES, type MotivoDaExclusao as Motivo } from '@/core/segmentos'
import { db, ehIdInvalido } from '../db'
import { marketingDosContatos } from '../repos/consentimentos'

/**
 * Quem pode receber, e por que os outros não (T6.2, RB-39).
 *
 * ---------------------------------------------------------------------------
 * A regra: estar no segmento NÃO autoriza mensagem
 * ---------------------------------------------------------------------------
 *
 * É a frase inteira da RB-39, e ela é a diferença entre uma transmissão e um
 * incidente. Um segmento responde "quem se parece com isto"; a elegibilidade
 * responde "para quem a Meta deixa mandar isto agora, e a que custo". As duas
 * perguntas têm respostas diferentes para a mesma pessoa.
 *
 * Por isso a prévia devolve **três números**: correspondentes, elegíveis e
 * excluídos **por motivo**. Um total só, ou dois, esconderia a pergunta que
 * quem dispara precisa fazer antes de confirmar: por que 40 dos 52 vão
 * receber?
 *
 * ---------------------------------------------------------------------------
 * Por que isto roda duas vezes
 * ---------------------------------------------------------------------------
 *
 * Na prévia, para a pessoa decidir. E de novo **no instante do envio**, no
 * worker, porque entre confirmar e enviar cabe horas: a janela de 24h fecha
 * sozinha, e alguém que era elegível às 9h não é mais às 15h. Revalidar na
 * hora é o que impede a mensagem que a Meta recusaria (ou cobraria sem
 * ninguém esperar).
 *
 * O que a revalidação **não** faz é acrescentar gente: a lista já foi
 * congelada. Ela só recusa (RB-38).
 */

// Os motivos moram em `core/segmentos.ts`: a prévia que os escreve é
// componente de cliente, e não pode importar de um módulo `server-only`.
export { FRASE_DO_MOTIVO, type MotivoDaExclusao } from '@/core/segmentos'

export type Elegibilidade = {
  contatoId: string
  elegivel: boolean
  motivo: Motivo | null
  /** `gratuita`, `paga` ou `desconhecido`. Ver `channels/janela.ts`. */
  cobranca: 'gratuita' | 'paga' | 'desconhecido'
  /** A janela de 24h está aberta: pode receber mensagem comum (0139). */
  textoLivre: boolean
}

export type Previa = {
  /** Quantos o segmento devolveu. */
  correspondentes: number
  /** Quantos podem receber agora. */
  elegiveis: number
  /** Quantos não podem, **por motivo**. */
  excluidos: Record<Motivo, number>
  /** Quantos sairiam de graça, dos elegíveis. */
  gratuitas: number
  /** Quantos elegíveis estão com a janela de 24h aberta (0139). */
  naJanela: number
  /** Quantos têm custo não confirmado. Ver a nota de `cobranca`. */
  custoNaoConfirmado: number
  detalhes: Elegibilidade[]
}

/**
 * Avalia a elegibilidade de uma lista de contatos.
 *
 * `comModelo` muda a resposta inteira, e é o parâmetro que mais se esquece:
 * com modelo aprovado, a janela fechada **não** exclui ninguém (é para isso que
 * o modelo existe); sem ele, o envio é texto livre e a janela é a lei.
 *
 * `marketing` (padrão `true`) exclui quem pediu para sair das promoções. Só a
 * transmissão com modelo de utilidade passa `false`: "sua aula mudou de
 * horário" é serviço, e quem saiu das promoções continua precisando receber.
 */
export async function avaliarElegibilidade(
  clienteId: string,
  contatoIds: readonly string[],
  opcoes: { comModelo: boolean; agora?: number; marketing?: boolean },
): Promise<Previa> {
  const agora = opcoes.agora ?? Date.now()

  const vazia: Previa = {
    correspondentes: contatoIds.length,
    elegiveis: 0,
    excluidos: { sem_telefone: 0, janela_fechada_sem_modelo: 0, nunca_escreveu: 0, pediu_para_sair: 0 },
    gratuitas: 0,
    naJanela: 0,
    custoNaoConfirmado: 0,
    detalhes: [],
  }
  if (contatoIds.length === 0) return vazia

  // A janela sai da view `leads`, que já resolve `porta_de_entrada_em` com o
  // filtro de tipo da 0074. Reimplementar a consulta aqui seria criar a
  // consulta gêmea que a F3 acabou de unificar.
  const [{ data, error }, consentimentos] = await Promise.all([
    db()
      .from('leads')
      .select('contact_id, wa_id, ultima_entrada_em, porta_de_entrada_em')
      .eq('client_id', clienteId)
      .in('contact_id', [...contatoIds]),
    opcoes.marketing === false ? null : marketingDosContatos(clienteId, contatoIds),
  ])

  if (ehIdInvalido(error)) return vazia
  if (error) throw new Error(`não foi possível avaliar a elegibilidade: ${error.message}`)

  const linhas = data as {
    contact_id: string
    wa_id: string | null
    ultima_entrada_em: string | null
    porta_de_entrada_em: string | null
  }[]

  const previa: Previa = { ...vazia, excluidos: { ...vazia.excluidos }, detalhes: [] }

  for (const linha of linhas) {
    const permissao = permissaoDeEnvio(
      {
        ultimaEntradaEm: linha.ultima_entrada_em,
        portaDeEntradaEm: linha.porta_de_entrada_em,
      },
      agora,
    )

    const saiu = consentimentos?.get(linha.contact_id)?.aceito === false
    const resultado = decidir(linha.wa_id, permissao, opcoes.comModelo, saiu)

    previa.detalhes.push({
      contatoId: linha.contact_id,
      elegivel: resultado.elegivel,
      motivo: resultado.motivo,
      cobranca: permissao.cobranca,
      textoLivre: permissao.textoLivre,
    })

    if (resultado.elegivel) {
      previa.elegiveis += 1
      if (permissao.cobranca === 'gratuita') previa.gratuitas += 1
      if (permissao.textoLivre) previa.naJanela += 1
      // `desconhecido` não é `paga`: dizer "paga" seria prometer um custo que
      // ninguém calculou, e a tela precisa poder dizer "não confirmado".
      if (permissao.cobranca === 'desconhecido') previa.custoNaoConfirmado += 1
    } else if (resultado.motivo) {
      previa.excluidos[resultado.motivo] += 1
    }
  }

  // Contato que o segmento trouxe e a view não conhece (apagado entre as duas
  // consultas) conta como sem telefone: some da lista, e o motivo fica escrito
  // em vez de o número simplesmente não fechar.
  const faltando = contatoIds.length - linhas.length
  if (faltando > 0) previa.excluidos.sem_telefone += faltando

  return previa
}

function decidir(
  waId: string | null,
  permissao: ReturnType<typeof permissaoDeEnvio>,
  comModelo: boolean,
  saiuDoMarketing: boolean,
): { elegivel: boolean; motivo: Motivo | null } {
  if (!waId) return { elegivel: false, motivo: 'sem_telefone' }

  // Antes do modelo de propósito: o modelo aprovado vence a janela de 24h,
  // nunca o pedido de sair.
  if (saiuDoMarketing) return { elegivel: false, motivo: 'pediu_para_sair' }

  // Com modelo aprovado, a janela fechada não impede: é exatamente para isso
  // que o modelo existe.
  if (comModelo) return { elegivel: true, motivo: null }

  if (permissao.textoLivre) return { elegivel: true, motivo: null }

  return {
    elegivel: false,
    motivo: permissao.causa === 'nunca_escreveu' ? 'nunca_escreveu' : 'janela_fechada_sem_modelo',
  }
}

/**
 * A revalidação do instante do envio (RB-39).
 *
 * Devolve `null` quando pode enviar, ou a frase do motivo quando não pode. A
 * frase é gravada em `transmissao_destinatarios.motivo_da_exclusao` (0083):
 * sem ela, a transmissão termina com 40 enviados e 12 sumidos, e ninguém sabe
 * se foi janela, bloqueio ou defeito.
 */
export async function revalidarNoEnvio(
  clienteId: string,
  contatoId: string,
  opcoes: { comModelo: boolean; agora?: number },
): Promise<string | null> {
  const previa = await avaliarElegibilidade(clienteId, [contatoId], opcoes)
  const detalhe = previa.detalhes[0]

  if (!detalhe) return FRASES.sem_telefone
  if (detalhe.elegivel) return null
  return detalhe.motivo ? FRASES[detalhe.motivo] : 'não elegível'
}

/**
 * A mesma revalidação, dizendo também se a janela de 24h está aberta agora.
 *
 * É o que a transmissão usa para decidir entre modelo e mensagem comum
 * (0139): a janela é lida no instante do envio, porque quem escreveu há 23h
 * na hora de confirmar pode estar com ela fechada quando chegar a vez.
 */
export async function revalidarComJanela(
  clienteId: string,
  contatoId: string,
  opcoes: { comModelo: boolean; agora?: number; marketing?: boolean },
): Promise<{ recusa: string | null; textoLivre: boolean }> {
  const previa = await avaliarElegibilidade(clienteId, [contatoId], opcoes)
  const detalhe = previa.detalhes[0]

  if (!detalhe) return { recusa: FRASES.sem_telefone, textoLivre: false }
  if (!detalhe.elegivel) return { recusa: detalhe.motivo ? FRASES[detalhe.motivo] : 'não elegível', textoLivre: false }
  return { recusa: null, textoLivre: detalhe.textoLivre }
}
