import { alertar } from '@/server/alertar'
import { iguais } from '@/lib/segredo'
import { DIAS_DE_RETENCAO_DO_ALERTA, limparAlertasVencidos } from '@/server/repos/alertas'
import { DIAS_DE_FOLGA, renovarTokensDoInstagram } from '@/server/instagram/renovacao'
import { apagarContatosVencidos, MESES_DE_RETENCAO_PADRAO } from '@/server/repos/retencao'

export const dynamic = 'force-dynamic'

/** Apagar em lote conversa com o banco várias vezes; o padrão de 10s é curto. */
export const maxDuration = 60

/**
 * A manutenção diária, chamada pela tarefa agendada da Vercel: apagar o que
 * venceu (contatos e alertas) e renovar o token do Instagram antes que ele
 * vença. O nome da rota é `retencao` por história, e mudá-lo agora quebraria o
 * `vercel.json` em troca de nada.
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
    const agora = new Date()
    const resultado = await apagarContatosVencidos({ agora })

    /*
     * Os alertas entram na mesma passada, e não numa tarefa própria.
     *
     * É a mesma natureza de trabalho — apagar o que passou do prazo — e o
     * `contexto` de um alerta pode carregar id de contato, então guardá-lo para
     * sempre seria guardar dado pessoal exatamente onde este arquivo existe
     * para impedir. Uma segunda tarefa agendada custaria outra entrada no
     * `vercel.json` e outro lugar de onde parar de rodar em silêncio.
     */
    const alertasApagados = await limparAlertasVencidos(agora)

    /*
     * A renovação do token do Instagram pega carona aqui, e a razão é o plano.
     *
     * No Hobby a Vercel dá **duas** tarefas agendadas por projeto, e as duas já
     * estão em uso: esta e a do agendador. Uma terceira entrada no `vercel.json`
     * simplesmente não roda — e a renovação não pode ser a coisa que ninguém
     * percebe que parou, porque o sintoma dela é uma conta que fica muda no dia
     * 61 sem ninguém ter mexido em nada.
     *
     * A natureza do trabalho também é a mesma das duas linhas acima: cuidar de
     * prazo que corre sozinho. Ela nunca lança — falha de uma conta vira alerta
     * lá dentro —, então não tem como derrubar a limpeza que veio antes.
     */
    const instagram = await renovarTokensDoInstagram({ agora })

    return Response.json({
      ...resultado,
      meses: MESES_DE_RETENCAO_PADRAO,
      alertasApagados,
      diasDeAlerta: DIAS_DE_RETENCAO_DO_ALERTA,
      instagram: { ...instagram, diasDeFolga: DIAS_DE_FOLGA },
    })
  } catch (erro) {
    // Ninguém está olhando quando isto roda às quatro da manhã. Uma limpeza que
    // para de acontecer em silêncio é a definição de dado guardado além do
    // prazo sem ninguém saber.
    await alertar('a limpeza de retenção falhou', erro)
    return Response.json({ erro: 'a limpeza falhou' }, { status: 500 })
  }
}
