import 'server-only'
import { executar } from '@/core/engine/executar'
import type { Acao, Entrada, Resultado, Sessao } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import type { Modelo, Turno } from '../ia/types'
import { chamarHttp } from './http'

/**
 * O motor, com os efeitos externos resolvidos.
 *
 * O `executar()` é puro e continua puro: quando a conversa chega num bloco que
 * precisa do mundo lá fora — a IA ou uma API — ele **descreve** o que precisa
 * (`chamar_ia`, `chamar_http`) e para. Alguém de fora tem que executar e
 * reentrar com o resultado.
 *
 * Esse alguém é este arquivo, e é **um só**, usado pelo simulador e pelo
 * WhatsApp. É isso que impede duas implementações se comportando diferente e
 * mata a frase "no simulador funcionava".
 */

/** Mensagem padrão antes de passar para uma pessoa. */
const AVISO_DE_HANDOFF = 'Vou te passar para um atendente. Só um instante!'

/**
 * Trava contra fluxo que encadeia efeitos externos sem fim.
 *
 * Era 3, calibrado para IA, onde encadear é sinal de fluxo errado. Com API é
 * diferente: consultar o CEP, gravar no CRM e avisar no Slack na mesma passada
 * são três chamadas de um fluxo perfeitamente sensato. A trava continua
 * existindo para matar ciclo, não para limitar desenho — por isso sobe, e não
 * some.
 */
export const MAX_EFEITOS = 10

export type OpcoesDeEfeitos = {
  /** `null` = não há modelo disponível (sem plano, sem chave). */
  modelo: Modelo | null
  /** O que o cliente escreveu sobre o próprio negócio. Fecha o escopo. */
  contextoNegocio: string
  /** A conversa até aqui, para a IA não repetir o que já foi dito. */
  historico?: Turno[]
  /** A última mensagem da pessoa, quando não veio como texto na entrada. */
  perguntaDaPessoa?: string
  /**
   * De onde veio a conversa. O simulador marca os disparos de API com um
   * cabeçalho, para o sistema do cliente conseguir filtrar tráfego de teste.
   *
   * O padrão é `whatsapp` porque errar para o outro lado é pior: marcar
   * conversa real como teste faria o cliente descartar lead de verdade.
   */
  origem?: 'simulador' | 'whatsapp'
}

export async function executarComEfeitos(
  fluxo: Fluxo,
  sessao: Sessao,
  entrada: Entrada,
  opcoes: OpcoesDeEfeitos,
): Promise<Resultado> {
  let resultado = executar(fluxo, sessao, entrada)

  const pergunta =
    opcoes.perguntaDaPessoa ??
    (entrada.tipo === 'texto' ? entrada.texto : (ultimaDaPessoa(opcoes.historico) ?? ''))

  for (let volta = 0; volta < MAX_EFEITOS; volta++) {
    const chamadaHttp = resultado.acoes.find((a) => a.tipo === 'chamar_http')

    if (chamadaHttp?.tipo === 'chamar_http') {
      const resposta = await chamarHttp(chamadaHttp, {
        deTeste: opcoes.origem === 'simulador',
      })

      if (!resposta.ok && chamadaHttp.aoFalhar === 'humano') {
        return {
          acoes: [
            ...semEfeito(resultado.acoes, 'chamar_http'),
            { tipo: 'enviar_texto', texto: AVISO_DE_HANDOFF },
            { tipo: 'transferir_humano', motivo: `a integração falhou — ${resposta.motivo}` },
          ],
          sessao: { ...resultado.sessao, status: 'humano' },
        }
      }

      // `aoFalhar: 'seguir'` reentra sem valores: a conversa continua e as
      // variáveis mapeadas ficam vazias, que é como o produto já trata
      // variável ausente em qualquer texto.
      const seguinte = executar(fluxo, resultado.sessao, {
        tipo: 'http_respondeu',
        valores: resposta.ok ? resposta.valores : {},
      })

      resultado = {
        acoes: [...semEfeito(resultado.acoes, 'chamar_http'), ...seguinte.acoes],
        sessao: seguinte.sessao,
      }
      continue
    }

    const chamadaIa = resultado.acoes.find((a) => a.tipo === 'chamar_ia')
    if (chamadaIa?.tipo !== 'chamar_ia') return resultado

    // Sem modelo, `chamar_ia` continua na lista e quem chamou decide o que
    // fazer — hoje, mandar para uma pessoa. Nunca fingir que respondeu.
    if (!opcoes.modelo) return resultado

    const resposta = await opcoes.modelo.responder({
      contextoNegocio: opcoes.contextoNegocio,
      instrucao: chamadaIa.instrucao,
      pergunta,
      historico: opcoes.historico,
    })

    if (resposta.tipo === 'nao_sei') {
      // A saída de emergência do §6. Entre calar e inventar, uma pessoa assume.
      return {
        acoes: [
          ...semEfeito(resultado.acoes, 'chamar_ia'),
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
      acoes: [...semEfeito(resultado.acoes, 'chamar_ia'), ...seguinte.acoes],
      sessao: seguinte.sessao,
    }
  }

  return resultado
}

/**
 * Tira o pedido de efeito da lista depois de atendido.
 *
 * Se ficasse, quem aplica as ações veria um pedido já respondido e mandaria a
 * conversa para um humano em cima de algo que deu certo.
 */
function semEfeito(acoes: Acao[], tipo: 'chamar_ia' | 'chamar_http'): Acao[] {
  return acoes.filter((a) => a.tipo !== tipo)
}

function ultimaDaPessoa(historico: Turno[] | undefined): string | undefined {
  return [...(historico ?? [])].reverse().find((t) => t.de === 'pessoa')?.texto
}
