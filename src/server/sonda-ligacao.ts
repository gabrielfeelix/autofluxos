import 'server-only'
import { db } from './db'
import { ambienteAtual } from './repos/alertas'

/**
 * Fase 0 da ligação pelo WhatsApp: guarda o que chega no campo `calls`.
 *
 * Existe para provar uma coisa só, antes de qualquer tela: que a Meta aceita
 * um SDP de resposta gerado direto no navegador do atendente, sem servidor de
 * mídia no meio. Ver `docs/HANDOFF-01-OUT-LIGACAO-WHATSAPP.md`.
 *
 * Grava em `alertas` porque a tabela já existe e a fase 0 não justifica
 * migration. Entra com `visto_em` preenchido para não aparecer como alerta
 * aberto em `/admin/alertas`: não é falha, é registro de teste. Quem lê é
 * `scripts/sonda-ligacao/servidor.mjs`.
 *
 * Sai quando a fase 1 trouxer as colunas de WhatsApp para `chamadas`.
 */
export const TITULO_DA_SONDA = 'sonda: ligação do WhatsApp'

type Ligacao = {
  id?: string
  event?: string
  direction?: string
  from?: string
  to?: string
  status?: string
  duration?: number
  session?: { sdp_type?: string; sdp?: string }
}

export async function guardarEventoDeLigacao(payload: unknown): Promise<void> {
  const linhas: Record<string, unknown>[] = []

  for (const entrada of (payload as { entry?: unknown[] })?.entry ?? []) {
    for (const mudanca of (entrada as { changes?: unknown[] })?.changes ?? []) {
      const { field, value } = (mudanca ?? {}) as {
        field?: string
        value?: {
          metadata?: { phone_number_id?: string }
          calls?: Ligacao[]
          statuses?: { id?: string; type?: string; status?: string }[]
        }
      }
      if (field !== 'calls' || !value) continue
      const numero = value.metadata?.phone_number_id ?? null

      for (const ligacao of value.calls ?? []) {
        linhas.push({
          titulo: TITULO_DA_SONDA,
          detalhe: ligacao.event ?? 'desconhecido',
          contexto: {
            phone_number_id: numero,
            call_id: ligacao.id ?? null,
            event: ligacao.event ?? null,
            direction: ligacao.direction ?? null,
            from: ligacao.from ?? null,
            status: ligacao.status ?? null,
            duration: ligacao.duration ?? null,
            sdp_type: ligacao.session?.sdp_type ?? null,
            sdp: ligacao.session?.sdp ?? null,
          },
        })
      }

      for (const status of value.statuses ?? []) {
        if (status.type !== 'call') continue
        linhas.push({
          titulo: TITULO_DA_SONDA,
          detalhe: `status ${status.status ?? ''}`.trim(),
          contexto: { phone_number_id: numero, call_id: status.id ?? null, status: status.status ?? null },
        })
      }
    }
  }

  if (linhas.length === 0) return

  const agora = new Date().toISOString()
  const { error } = await db()
    .from('alertas')
    .insert(linhas.map((linha) => ({ ...linha, ambiente: ambienteAtual(), visto_em: agora })))
  if (error) console.error('[sonda-ligacao] não deu para gravar', error.message)
}
