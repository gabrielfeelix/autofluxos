import { alertar } from '@/server/alertar'
import { iguais } from '@/lib/segredo'
import { enviarAgendadas } from '@/server/enviar-agendadas'

export const dynamic = 'force-dynamic'

/** Cada mensagem fala com o banco e com a Cloud API. 10s não cobrem uma passada. */
export const maxDuration = 60

/**
 * O piso do agendamento de mensagens, chamado pelo cron da Vercel.
 *
 * **Fica fora do `proxy` e exige `CRON_SECRET`**, como a retenção e o
 * agendador: quem chama é a plataforma, não uma pessoa com cookie de painel. E
 * **falha fechada sem ele** — esta rota manda mensagem no WhatsApp de gente de
 * verdade, e uma rota dessas não pode ficar aberta porque uma variável não foi
 * preenchida.
 *
 * Ela é o piso e não o caminho principal, pelo mesmo motivo da rota de tarefas:
 * no plano Hobby a Vercel dispara cron uma vez por dia, e quem dá resolução de
 * minuto é a carona no webhook e a carona no pulso do Inbox. Ver
 * `server/enviar-agendadas.ts`.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    return Response.json(
      { erro: 'CRON_SECRET não configurado; o envio das agendadas não roda sem ele' },
      { status: 503 },
    )
  }

  const informado = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!iguais(informado, segredo)) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  try {
    return Response.json(await enviarAgendadas())
  } catch (erro) {
    // Ninguém está olhando quando isto roda. Uma passada que para de acontecer
    // em silêncio é uma fila de mensagens marcadas que nunca saem — e o
    // sintoma, do lado de quem marcou, é "o sistema não mandou".
    await alertar('a passada das mensagens agendadas falhou', erro)
    return Response.json({ erro: 'a passada falhou' }, { status: 500 })
  }
}
