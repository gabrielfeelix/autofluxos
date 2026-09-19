import { alertar } from '@/server/alertar'
import { iguais } from '@/lib/segredo'
import { enviarAgendadas } from '@/server/enviar-agendadas'
import { passadaDeRetomada } from '@/server/passada-de-retomada'
import { passadaDeTransmissoes } from '@/server/passada-de-transmissoes'
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
 * **Fica fora do `proxy`** e exige `CRON_SECRET`, como a retenção, quem chama
 * é a plataforma, não uma pessoa com cookie de painel. E **falha fechada sem
 * ele**: esta rota manda mensagem no WhatsApp de gente de verdade, e uma rota
 * dessas não pode ficar aberta porque uma variável não foi preenchida.
 *
 * **No plano Hobby a Vercel dispara cron uma vez por dia**, e é por isso que
 * esta rota não é o caminho principal: um prazo de trinta minutos conferido só
 * de madrugada chega depois de a janela de 24h ter fechado. Quem dá a resolução
 * é a carona no webhook (ver a rota do WhatsApp), a conta com prazo vencendo é,
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
    /*
     * As mensagens agendadas pegam carona neste cron, e não ganharam um
     * `crons` próprio no `vercel.json`.
     *
     * **O plano Hobby limita o número de tarefas agendadas**, e o repositório
     * já declara três. Uma quarta que a plataforma recuse não falha sozinha:
     * ela reprova o deploy inteiro, e um deploy reprovado por causa do piso de
     * um recurso derruba junto tudo o que ia com ele.
     *
     * Rodar as duas coisas na mesma passada não custa nada, o piso existe para
     * a conta que passou o dia inteiro sem movimento, e nessa conta as duas
     * filas estão vazias. A rota `/api/manutencao/agendadas` continua existindo
     * para o dia em que houver um disparador externo ou o plano subir.
     *
     * Uma fila não pode derrubar a outra: a de agendadas manda mensagem para
     * gente de verdade, e um erro nela não pode impedir a cobrança de pergunta
     * de acontecer.
     */
    const agendadas = await enviarAgendadas().catch((erro) => {
      console.error('[tarefas] a passada das agendadas falhou', erro)
      return null
    })

    /*
     * O piso das transmissões. Aqui vale o orçamento cheio do motor
     * (`POR_PASSADA`), ao contrário das caronas: esta rota não está atrás de um
     * 200 para a Meta nem dentro do pulso de ninguém.
     *
     * E pelo mesmo motivo das agendadas: uma fila não derruba a outra.
     */
    const transmissoes = await passadaDeTransmissoes().catch((erro) => {
      console.error('[tarefas] a passada das transmissões falhou', erro)
      return null
    })

    /*
     * A régua de retomada (0070).
     *
     * Só aqui, e não nas caronas: a unidade dela é o dia, e "sumido há 60 dias"
     * não vira urgente às 14h32. Rodar atrás do webhook gastaria a resposta que
     * a Meta espera em 200 para descobrir, todas as vezes, que ninguém
     * completou mais um dia de silêncio.
     *
     * E pelo mesmo motivo das outras: uma fila não derruba a outra.
     */
    const retomada = await passadaDeRetomada().catch((erro) => {
      console.error('[tarefas] a passada de retomada falhou', erro)
      return null
    })

    return Response.json({ ...(await rodarTarefas()), agendadas, transmissoes, retomada })
  } catch (erro) {
    // Ninguém está olhando quando isto roda. Um agendador que para de acontecer
    // em silêncio é uma fila crescendo com conversas esperando algo que nunca
    // vem, e o sintoma, do lado do cliente, é "o bot parou de cobrar".
    await alertar('a passada do agendador falhou', erro)
    return Response.json({ erro: 'a passada falhou' }, { status: 500 })
  }
}
