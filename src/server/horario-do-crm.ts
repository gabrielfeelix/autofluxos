import 'server-only'
import { z } from 'zod'
import { chamarHttp } from './efeitos/http'
import { lerCredencial } from './repos/conexoes'
import { atualizarHorario } from './repos/clientes'
import type { HorarioDeAtendimento } from '@/core/horario'

/**
 * O expediente que já está no CRM do cliente, copiado para cá.
 *
 * **O cliente não deve configurar o horário duas vezes.** Quem usa a Verandi já
 * disse lá que abre das 7h às 20h e que fecha no feriado; pedir a mesma coisa
 * de novo no AutoFluxos não é só trabalho repetido, é uma segunda verdade que
 * diverge da primeira no dia em que alguém cadastra o feriado de um lado só. E
 * quem descobre a divergência é quem mandou mensagem no feriado e ouviu "te
 * respondemos ainda hoje".
 *
 * **É cópia, e não consulta ao vivo, de propósito.** O motor decide o que dizer
 * em *toda* mensagem; buscar o expediente lá fora a cada uma poria o WhatsApp
 * de um cliente pago na dependência de um servidor de terceiro estar de pé e
 * rápido. A cópia envelhece no máximo seis horas, e feriado é dado que muda com
 * semanas de antecedência.
 */

/** Quanto tempo a cópia vale antes de buscar de novo. */
export const VALIDADE_DA_COPIA_MS = 6 * 60 * 60 * 1000

/**
 * O prazo desta chamada é curto de propósito.
 *
 * Ela acontece no meio do atendimento de uma mensagem. Se o CRM estiver lento,
 * a resposta certa é usar a cópia velha e seguir: um expediente de seis horas
 * atrás erra quase nunca, e uma resposta que demora dez segundos erra sempre.
 */
const PRAZO_MS = 2_500

const respostaSchema = z.object({
  fuso: z.string().min(1),
  dias: z.array(z.array(z.object({ de: z.string(), ate: z.string() }))).length(7),
  excecoes: z
    .array(
      z.object({
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        motivo: z.string().optional(),
        faixas: z.array(z.object({ de: z.string(), ate: z.string() })).optional(),
      }),
    )
    .optional(),
})

/** A cópia está velha (ou nunca foi feita)? */
export function precisaSincronizar(
  horario: HorarioDeAtendimento | null,
  agora: Date = new Date(),
): boolean {
  if (horario?.origem?.tipo !== 'crm') return false
  if (!horario.origem.url) return false

  const quando = horario.origem.sincronizadoEm
  if (!quando) return true

  const lido = Date.parse(quando)
  // Data ilegível conta como velha: melhor uma busca a mais do que uma cópia
  // que nunca mais se atualiza porque alguém gravou lixo no campo.
  if (Number.isNaN(lido)) return true

  return agora.getTime() - lido >= VALIDADE_DA_COPIA_MS
}

/**
 * Mantém a cópia em dia, e **nunca** derruba a conversa por causa disso.
 *
 * Devolve sempre um horário utilizável: o novo quando a busca deu certo, o que
 * já estava guardado quando não deu. Falha aqui não é motivo para o bot deixar
 * de responder, e também não é motivo para ele passar a atender 24h: a cópia
 * velha continua sendo a melhor informação que existe.
 */
export async function manterCopiaDoCrm(
  clienteId: string,
  horario: HorarioDeAtendimento | null,
  agora: Date = new Date(),
): Promise<HorarioDeAtendimento | null> {
  if (!horario || !precisaSincronizar(horario, agora)) return horario

  try {
    const novo = await buscarNoCrm(clienteId, horario)
    if (!novo) return horario

    await atualizarHorario(clienteId, novo)
    return novo
  } catch (erro) {
    console.error('[horario-do-crm] não deu para sincronizar', (erro as Error).message)
    return horario
  }
}

async function buscarNoCrm(
  clienteId: string,
  horario: HorarioDeAtendimento,
): Promise<HorarioDeAtendimento | null> {
  const origem = horario.origem
  if (origem?.tipo !== 'crm' || !origem.url) return null

  const credencial = origem.conexaoId ? await lerCredencial(origem.conexaoId, clienteId) : null

  const resposta = await Promise.race([
    chamarHttp(
      {
        tipo: 'chamar_http',
        metodo: 'GET',
        url: origem.url,
        cabecalhos: [],
        corpo: '',
        mapear: [],
        // Quem trata a falha é o `catch` daqui: a conversa segue com a cópia
        // velha, e ninguém é transferido para um humano por causa disto.
        aoFalhar: 'seguir',
      },
      { deTeste: false, credencial, comJson: true },
    ),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), PRAZO_MS)),
  ])

  if (!resposta || !resposta.ok) return null

  const lido = respostaSchema.safeParse(resposta.json)
  if (!lido.success) {
    console.error('[horario-do-crm] o CRM respondeu num formato que não reconheço')
    return null
  }

  /*
   * O que vem do CRM é o expediente; o que fica daqui é **de onde ele veio**.
   *
   * Guardar a origem junto é o que faz a próxima mensagem saber que não
   * precisa perguntar de novo, e é também o que a tela lê para dizer "puxado
   * da Verandi às 14h" em vez de deixar a pessoa achando que alguém digitou
   * aquilo à mão.
   */
  return {
    fuso: lido.data.fuso,
    dias: lido.data.dias,
    excecoes: lido.data.excecoes ?? [],
    origem: { ...origem, sincronizadoEm: new Date().toISOString() },
  }
}
