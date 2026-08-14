import { alertar } from '@/server/alertar'
import { iguais } from '@/lib/painel-auth'
import { apagarContatosVencidos, MESES_DE_RETENCAO_PADRAO } from '@/server/repos/retencao'

export const dynamic = 'force-dynamic'

/** Apagar em lote conversa com o banco várias vezes; o padrão de 10s é curto. */
export const maxDuration = 60

/**
 * A limpeza de retenção, chamada pela tarefa agendada da Vercel.
 *
 * **Esta rota fica fora do `proxy`** — quem chama é a plataforma, não uma
 * pessoa com cookie de painel. Em troca, ela exige `CRON_SECRET` e **falha
 * fechada sem ele**: uma rota que apaga contato não pode ficar aberta porque
 * uma variável não foi preenchida. Enquanto o segredo não existir, a resposta é
 * 503 e nada é apagado — retenção que não roda é um problema de conformidade;
 * retenção que roda para qualquer um é um problema muito maior.
 *
 * A Vercel manda o segredo no `Authorization` sozinha quando `CRON_SECRET` está
 * no ambiente do projeto.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    return Response.json(
      { erro: 'CRON_SECRET não configurado; a retenção não roda sem ele' },
      { status: 503 },
    )
  }

  const informado = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!iguais(informado, segredo)) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  try {
    const resultado = await apagarContatosVencidos({ agora: new Date() })
    return Response.json({
      ...resultado,
      meses: MESES_DE_RETENCAO_PADRAO,
    })
  } catch (erro) {
    // Ninguém está olhando quando isto roda às quatro da manhã. Uma limpeza que
    // para de acontecer em silêncio é a definição de dado guardado além do
    // prazo sem ninguém saber.
    await alertar('a limpeza de retenção falhou', erro)
    return Response.json({ erro: 'a limpeza falhou' }, { status: 500 })
  }
}
