import 'server-only'
import { z } from 'zod'
import { condutaPara, statusDaMeta } from '@/core/templates'
import { aplicarStatusPorWamid, type EstadoDoDestinatario } from './repos/transmissoes'
import { atualizarCategoriaPorWabaId, atualizarStatusPorWabaId } from './repos/templates'

/**
 * Os dois webhooks que contam a verdade sobre um template.
 *
 * ---------------------------------------------------------------------------
 * Por que são dois, e não um
 * ---------------------------------------------------------------------------
 *
 * `message_template_status_update` fala do **modelo**: foi aprovado, recusado,
 * pausado. `messages` com `statuses` fala de cada **mensagem**: entregue, lida,
 * falhou. Os dois chegam no mesmo envelope `entry[].changes[]` e precisam um do
 * outro para a tela não mentir — um template aprovado cujas mensagens todas
 * falham com 132015 está pausado na prática, e quem olha só o primeiro webhook
 * mostra "aprovado" enquanto nada sai.
 *
 * ---------------------------------------------------------------------------
 * `rejection_info` é a melhor informação que a Meta dá em qualquer lugar
 * ---------------------------------------------------------------------------
 *
 * Quando a recusa é `INVALID_FORMAT`, ela manda explicação detalhada **e
 * recomendação acionável**. É a diferença entre a tela dizer "recusado" e dizer
 * "recusado porque falta valor de exemplo na variável 2". Por isso o texto é
 * guardado inteiro e mostrado literalmente — resumir aqui jogaria fora
 * exatamente o que faz a pessoa conseguir consertar sem abrir a doc da Meta.
 */

/*
 * Tudo opcional e `passthrough`: é payload de fora. Campo que a Meta renomear
 * vira `undefined` em vez de derrubar o webhook inteiro — e derrubar aqui
 * significaria a Meta reenviando o lote e, pior, um status de entrega perdido.
 */
const statusDoTemplateSchema = z
  .object({
    message_template_id: z.union([z.string(), z.number()]).optional(),
    message_template_name: z.string().optional(),
    message_template_language: z.string().optional(),
    event: z.string().optional(),
    reason: z.string().optional(),
    /** O ouro: vem só em INVALID_FORMAT, com recomendação do que consertar. */
    rejection_info: z
      .object({ description: z.string().optional(), recommendation: z.string().optional() })
      .passthrough()
      .optional(),
    /** Chega em `template_category_update`, não no de status. */
    new_category: z.string().optional(),
    previous_category: z.string().optional(),
  })
  .passthrough()

const statusDaMensagemSchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
    errors: z
      .array(
        z
          .object({
            code: z.number().optional(),
            title: z.string().optional(),
            message: z.string().optional(),
            error_data: z.object({ details: z.string().optional() }).passthrough().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough()

const envelopeSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string().optional(),
          value: z
            .object({
              statuses: z.array(statusDaMensagemSchema).optional(),
            })
            .passthrough(),
        }),
      ),
    }),
  ),
})

/**
 * O que a Meta chama de `event` no webhook do template.
 *
 * Ela manda `APPROVED`/`REJECTED`/... aqui, os mesmos valores do campo
 * `status` da Graph — e é por isso que `statusDaMeta()` serve para os dois.
 */
export type ResultadoDoTemplate = {
  /** Quantos templates nossos foram atualizados. */
  atualizados: number
}

/**
 * Junta o motivo da recusa num texto só, sem perder a recomendação.
 *
 * A ordem importa: a descrição diz **o que** está errado, a recomendação diz
 * **o que fazer**. Quem lê a tela precisa das duas, e a segunda sozinha não faz
 * sentido.
 */
function motivoLegivel(valor: z.infer<typeof statusDoTemplateSchema>): string | null {
  const partes = [
    valor.rejection_info?.description,
    valor.rejection_info?.recommendation,
    // `reason` costuma ser um código seco (`INVALID_FORMAT`). Só vale quando é
    // a única coisa que veio — sozinho ainda é melhor que nada na tela.
    !valor.rejection_info ? valor.reason : undefined,
  ].filter((p): p is string => Boolean(p && p.trim() && p !== 'NONE'))

  return partes.length > 0 ? partes.join(' — ') : null
}

/**
 * Trata `message_template_status_update` e `template_category_update`.
 *
 * Não estoura nunca: roda dentro do `after()` do webhook, que já respondeu 200
 * à Meta. Uma exceção aqui viraria unhandled rejection sem ninguém para ver.
 */
export async function receberStatusDeTemplate(payload: unknown): Promise<ResultadoDoTemplate> {
  const analise = envelopeSchema.safeParse(payload)
  if (!analise.success) return { atualizados: 0 }

  let atualizados = 0

  for (const entrada of analise.data.entry) {
    for (const mudanca of entrada.changes) {
      const campo = mudanca.field
      if (campo !== 'message_template_status_update' && campo !== 'template_category_update') {
        continue
      }

      const valor = statusDoTemplateSchema.safeParse(mudanca.value)
      if (!valor.success) continue

      const wabaTemplateId = valor.data.message_template_id
      if (wabaTemplateId === undefined) continue

      /*
       * `template_category_update` não traz `event` — ele só diz que a
       * categoria mudou. Nesse caso não se toca no status: sobrescrevê-lo com
       * um palpite faria um template aprovado virar "desconhecido" por causa
       * de uma mudança de preço.
       */
      if (campo === 'template_category_update') {
        const categoria = valor.data.new_category
        if (!categoria) continue
        const achou = await atualizarCategoriaPorWabaId(String(wabaTemplateId), categoria)
        if (achou) atualizados += 1
        continue
      }

      const status = statusDaMeta(valor.data.event)
      // Status novo da Meta não pode virar `aprovado` por engano — seria
      // transmissão saindo com modelo que não passou.
      if (status === 'desconhecido') continue

      const achou = await atualizarStatusPorWabaId(String(wabaTemplateId), {
        status,
        // Só limpa o motivo quando o template saiu da recusa: manter o texto
        // velho ao lado de "aprovado" confundiria mais do que ajuda.
        motivoRecusa: status === 'recusado' ? motivoLegivel(valor.data) : null,
      })
      if (achou) atualizados += 1
    }
  }

  return { atualizados }
}

/**
 * O estado de entrega que a Meta reporta, no nosso.
 *
 * `sent` conta como `aceita` e não como entregue: ela saiu do nosso lado e
 * ainda não chegou no aparelho de ninguém.
 */
function estadoDaEntrega(status: string | undefined): EstadoDoDestinatario | null {
  switch ((status ?? '').toLowerCase()) {
    case 'sent':
      return 'aceita'
    case 'delivered':
      return 'entregue'
    case 'read':
      return 'lida'
    case 'failed':
      return 'falhou'
    default:
      // `deleted` e o que a Meta inventar: não mexe. Ver `avanca()`.
      return null
  }
}

export type ResultadoDaEntrega = {
  /** Quantas linhas de transmissão foram atualizadas. */
  atualizados: number
  /**
   * Os templates que morreram, pelo código de erro das mensagens.
   *
   * 132015 e 132007 significam que **o template morreu** — não adianta tentar
   * outro destinatário. Quem chama usa isto para parar a transmissão inteira em
   * vez de queimar 5.000 tentativas contra um modelo pausado.
   */
  templatesMortos: number[]
}

/**
 * Trata o `statuses` do campo `messages` — entrega, leitura e falha.
 *
 * **A maioria destes eventos não é transmissão nenhuma**: o webhook de status
 * chega para toda mensagem que o número manda, inclusive as respostas de
 * atendimento. `aplicarStatusPorWamid` devolver `false` é o caso comum, não
 * erro — e é por isso que nada aqui alerta.
 */
export async function receberStatusDeEntrega(payload: unknown): Promise<ResultadoDaEntrega> {
  const analise = envelopeSchema.safeParse(payload)
  if (!analise.success) return { atualizados: 0, templatesMortos: [] }

  let atualizados = 0
  const mortos = new Set<number>()

  for (const entrada of analise.data.entry) {
    for (const mudanca of entrada.changes) {
      // Ausente conta como `messages`, como no `receber-mensagem.ts`.
      if (mudanca.field !== undefined && mudanca.field !== 'messages') continue

      for (const bruto of mudanca.value.statuses ?? []) {
        const status = statusDaMensagemSchema.safeParse(bruto)
        if (!status.success) continue

        const wamid = status.data.id
        const estado = estadoDaEntrega(status.data.status)
        if (!wamid || !estado) continue

        const erro = status.data.errors?.[0]
        const codigo = erro?.code ?? null

        if (codigo !== null && condutaPara(codigo) === 'template_pausado') {
          mortos.add(codigo)
        }

        const achou = await aplicarStatusPorWamid(wamid, {
          estado,
          codigoErro: codigo,
          erro: erro?.error_data?.details ?? erro?.message ?? erro?.title ?? null,
        })
        if (achou) atualizados += 1
      }
    }
  }

  return { atualizados, templatesMortos: [...mortos] }
}
