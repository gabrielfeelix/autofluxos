import 'server-only'
import { executar } from '@/core/engine/executar'
import type { Acao, Entrada, Resultado, Sessao } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import type { Modelo, Turno } from './types'

/**
 * O motor, com a IA resolvida.
 *
 * O `executar()` é puro e continua puro: quando a conversa chega num bloco de
 * IA ele **descreve** o que precisa (`chamar_ia`) e para em `aguardando_ia`.
 * Alguém de fora tem que chamar o modelo e reentrar com a resposta. Esse
 * alguém é este arquivo — e é um só, usado pelo simulador e pelo WhatsApp, para
 * não existirem duas IAs se comportando diferente.
 */

/** Mensagem padrão quando a IA não sabe. Sai antes de passar para uma pessoa. */
const AVISO_DE_HANDOFF = 'Vou te passar para um atendente. Só um instante!'

/** Trava contra fluxo que encadeia blocos de IA. Nenhum real chega perto. */
const MAX_CHAMADAS = 3

export type OpcoesDeIa = {
  /** `null` = não há modelo disponível (sem plano, sem chave). */
  modelo: Modelo | null
  /** O que o cliente escreveu sobre o próprio negócio. Fecha o escopo. */
  contextoNegocio: string
  /** A conversa até aqui, para a IA não repetir o que já foi dito. */
  historico?: Turno[]
  /** A última mensagem da pessoa, quando não veio como texto na entrada. */
  perguntaDaPessoa?: string
}

export async function executarComIa(
  fluxo: Fluxo,
  sessao: Sessao,
  entrada: Entrada,
  opcoes: OpcoesDeIa,
): Promise<Resultado> {
  let resultado = executar(fluxo, sessao, entrada)

  const pergunta =
    opcoes.perguntaDaPessoa ??
    (entrada.tipo === 'texto' ? entrada.texto : (ultimaDaPessoa(opcoes.historico) ?? ''))

  for (let volta = 0; volta < MAX_CHAMADAS; volta++) {
    const chamada = resultado.acoes.find((a) => a.tipo === 'chamar_ia')
    if (!chamada || chamada.tipo !== 'chamar_ia') return resultado

    // Sem modelo, `chamar_ia` continua na lista e quem chamou decide o que
    // fazer — hoje, mandar para uma pessoa. Nunca fingir que respondeu.
    if (!opcoes.modelo) return resultado

    const resposta = await opcoes.modelo.responder({
      contextoNegocio: opcoes.contextoNegocio,
      instrucao: chamada.instrucao,
      pergunta,
      historico: opcoes.historico,
    })

    if (resposta.tipo === 'nao_sei') {
      // A saída de emergência do §6. Entre calar e inventar, uma pessoa assume.
      return {
        acoes: [
          ...semChamada(resultado.acoes),
          { tipo: 'enviar_texto', texto: AVISO_DE_HANDOFF },
          { tipo: 'transferir_humano', motivo: `a IA não soube responder — ${resposta.motivo}` },
        ],
        sessao: { ...resultado.sessao, status: 'humano' },
      }
    }

    const seguinte = executar(fluxo, resultado.sessao, {
      tipo: 'ia_respondeu',
      texto: resposta.texto,
    })

    resultado = {
      acoes: [...semChamada(resultado.acoes), ...seguinte.acoes],
      sessao: seguinte.sessao,
    }
  }

  return resultado
}

/**
 * Tira o `chamar_ia` da lista depois de atendido.
 *
 * Se ficasse, quem aplica as ações veria um pedido de IA já respondido e
 * mandaria a conversa para um humano em cima de uma resposta que deu certo.
 */
function semChamada(acoes: Acao[]): Acao[] {
  return acoes.filter((a) => a.tipo !== 'chamar_ia')
}

function ultimaDaPessoa(historico: Turno[] | undefined): string | undefined {
  return [...(historico ?? [])].reverse().find((t) => t.de === 'pessoa')?.texto
}
