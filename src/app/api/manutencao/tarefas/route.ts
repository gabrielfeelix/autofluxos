import { alertar } from '@/server/alertar'
import { iguais } from '@/lib/segredo'
import { rodarTarefas } from '@/server/tarefas'

export const dynamic = 'force-dynamic'

/**
 * Cada tarefa fala com o banco e com a Cloud API. O padrão de 10s não cobre uma
 * passada com cinquenta delas.
 */
export const maxDuration = 60

/**
 * O agendador, chamado pela tarefa agendada da Vercel (B1).
 *
 * **Fica fora do `proxy`** e exige `CRON_SECRET`, como a retenção — quem chama
 * é a plataforma, não uma pessoa com cookie de painel. E **falha fechada sem
 * ele**: esta rota manda mensagem no WhatsApp de gente de verdade, e uma rota
 * dessas não pode ficar aberta porque uma variável não foi preenchida.
 *
 * **No plano Hobby a Vercel dispara cron uma vez por dia**, e é por isso que
 * esta rota não é o caminho principal: um prazo de trinta minutos conferido só
 * de madrugada chega depois de a janela de 24h ter fechado. Quem dá a resolução
 * é a carona no webhook (ver a rota do WhatsApp) — a conta com prazo vencendo é,
 * por construção, a conta que está recebendo mensagem.
 *
 * Esta rota é o **piso**: ela varre a conta que passou o dia sem mensagem
 * nenhuma, e continua sendo o caminho certo no dia em que o plano subir ou o
 * dono apontar um disparador externo para cá (ver PENDENCIAS-DO-DONO).
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    return Response.json(
      { erro: 'CRON_SECRET não configurado; o agendador não roda sem ele' },
      { status: 503 },
    )
  }

  const informado = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!iguais(informado, segredo)) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  try {
    return Response.json(await rodarTarefas())
  } catch (erro) {
    // Ninguém está olhando quando isto roda. Um agendador que para de acontecer
    // em silêncio é uma fila crescendo com conversas esperando algo que nunca
    // vem — e o sintoma, do lado do cliente, é "o bot parou de cobrar".
    await alertar('a passada do agendador falhou', erro)
    return Response.json({ erro: 'a passada falhou' }, { status: 500 })
  }
}
