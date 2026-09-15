import { iguais } from '@/lib/segredo'
import { listarLeadsDoFormulario } from '@/channels/marketing-api'
import { alertar } from '@/server/alertar'
import { receberLeadsDoFormulario } from '@/server/receber-lead-do-formulario'
import { formulariosAtivos, marcarVarredura } from '@/server/repos/paginas-de-lead'
import { tokenDeAnuncios } from '@/server/token-de-anuncios'

export const dynamic = 'force-dynamic'

/** Varrer N formulários e buscar leads leva tempo; o padrão de 10s é curto. */
export const maxDuration = 60

/**
 * A rede de segurança do webhook `leadgen`.
 *
 * ---------------------------------------------------------------------------
 * Por que ela não é opcional
 * ---------------------------------------------------------------------------
 *
 * **A Meta não reentrega depois de um `200`.** Se a nossa função caiu no meio
 * do `after()`, se o deploy pegou o lote no ar, se a Graph estava fora quando
 * fomos buscar — o lead não volta sozinho. E a retenção da Meta é de **90
 * dias**: passado isso ele não existe mais em lugar nenhum, nem na API dela.
 *
 * O mercado mostra o tamanho disso. A RD Station registrou no status page
 * oficial 18 dias de leads sumindo em jul/2024, e ofereceu importação manual
 * avisando que geraria duplicados. A SleekFlow documenta que, ao reconectar,
 * recupera só os 30 minutos anteriores. Nos dois casos o que faltava era isto:
 * alguém varrendo o formulário de tempos em tempos.
 *
 * Varrer é barato — uma chamada por formulário, com filtro de data — e
 * transforma "lead perdido para sempre" em "lead que chegou algumas horas
 * depois". A dedupe já existe: `criarContato` recusa telefone repetido, e
 * `passagens` tem índice por minuto.
 *
 * ---------------------------------------------------------------------------
 * A janela é de 48 horas, e não de 24
 * ---------------------------------------------------------------------------
 *
 * Porque uma falha de sexta à noite precisa ser pega no sábado **e** no
 * domingo. Com 24h, uma única execução que não rodasse — deploy, incidente da
 * Vercel, limite da Meta — deixaria o buraco aberto para sempre. Sobrepor as
 * janelas custa algumas chamadas repetidas que a dedupe descarta.
 */
const JANELA_EM_HORAS = 48

/**
 * Quantos formulários varrer por execução.
 *
 * **O limite da Meta é proporcional ao volume, e isso é ao contrário do que a
 * intuição diz.** A conta é `200 × 24 × leads dos últimos 90 dias`, **por
 * Página** — então uma Página que acabou de começar a anunciar, com pouquíssimo
 * lead, tem um teto baixíssimo, e uma Página com zero leads tem teto zero. É
 * exatamente no onboarding, quando mais se testa e se varre, que o limite mais
 * aperta.
 *
 * Trinta por execução mantém a varredura previsível e deixa o resto para a
 * execução seguinte: a janela de 48h dá duas passadas antes de qualquer lead
 * sair da janela, e o webhook continua sendo o caminho principal — isto aqui é
 * rede de segurança, não a entrega.
 */
const FORMULARIOS_POR_EXECUCAO = 30

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    return Response.json(
      { erro: 'CRON_SECRET não configurado; a reconciliação não roda sem ele' },
      { status: 503 },
    )
  }

  const informado = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!iguais(informado, segredo)) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  const desde = new Date(Date.now() - JANELA_EM_HORAS * 3_600_000)
  const total = { formularios: 0, criados: 0, repetidos: 0, recusados: 0 }

  try {
    const todos = await formulariosAtivos()

    /*
     * Rodízio pela data da última varredura: quem esperou mais vai primeiro.
     * Sem isso, os trinta primeiros da lista seriam varridos todo dia e os
     * demais nunca — e a rede de segurança deixaria de cobrir justamente as
     * contas do fim da fila.
     */
    const formularios = todos.slice(0, FORMULARIOS_POR_EXECUCAO)

    for (const formulario of formularios) {
      const token = await tokenDeAnuncios(formulario.clienteId)
      if (!token) continue

      const busca = await listarLeadsDoFormulario({
        formId: formulario.formId,
        token,
        desde,
      })

      if (!busca.ok) {
        /*
         * Um formulário que falha não pode interromper os outros: a conta do
         * cliente B não perde lead porque o token do cliente A venceu.
         *
         * **Token quebrado é perda de dados em curso, não aviso de rotina.** A
         * Meta guarda o lead por 90 dias e depois o apaga — do Gerenciador, do
         * Business Suite e da API. Enquanto o token de um cliente estiver
         * inválido, cada dia que passa é um dia de leads que ninguém vai
         * recuperar depois, por nenhum meio. Por isso o 190 é dito com outras
         * palavras: quem lê "não conseguiu ler um formulário" espera até
         * segunda; quem lê "leads estão sendo perdidos" reconecta hoje.
         */
        const venceu = busca.erro.codigo === 190
        await alertar(
          venceu
            ? 'URGENTE: o acesso aos leads venceu e leads estão sendo perdidos'
            : 'a reconciliação não conseguiu ler um formulário',
          venceu
            ? `${busca.erro.mensagem} — a Meta apaga o lead depois de 90 dias; reconecte a conta ${formulario.clienteId} para parar a perda`
            : `${busca.erro.mensagem} (formulário ${formulario.formId})`,
          {},
        )
        continue
      }

      total.formularios += 1
      if (busca.leads.length === 0) continue

      /*
       * Reusa o mesmo caminho do webhook — inclusive a busca individual de cada
       * lead. É uma chamada a mais por lead do que o necessário, e vale: um
       * caminho só significa que a regra de "o que é um lead válido" não pode
       * divergir entre o tempo real e a reconciliação. Divergência aí seria
       * lead entrando de um jeito hoje e de outro amanhã, sem ninguém notar.
       */
      const resultado = await receberLeadsDoFormulario({
        clienteId: formulario.clienteId,
        avisos: busca.leads.map((lead) => ({
          leadgenId: lead.id,
          formId: formulario.formId,
          adId: lead.adId,
          pageId: formulario.pageId,
        })),
        token,
      })

      total.criados += resultado.criados
      total.repetidos += resultado.repetidos
      total.recusados += resultado.recusados
    }

    /*
     * Só alerta quando a rede de segurança **pegou** alguma coisa. Lead criado
     * aqui quer dizer que o webhook falhou e ninguém soube — é o sinal que
     * importa, e some no meio do ruído se toda execução avisar.
     */
    /*
     * Marca a varredura mesmo quando o formulário falhou: o que interessa é que
     * ele teve a vez. Sem isto, um formulário com token quebrado ficaria no topo
     * da fila para sempre e empurraria todos os outros para trás.
     */
    await marcarVarredura(formularios.map((f) => f.formId))

    if (total.criados > 0) {
      await alertar(
        'a reconciliação recuperou lead que o webhook não trouxe',
        `${total.criados} lead(s) em ${total.formularios} formulário(s)`,
        {},
      )
    }

    return Response.json({ ok: true, ...total })
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('a reconciliação de leads do formulário falhou', detalhe, {})
    return Response.json({ erro: detalhe }, { status: 500 })
  }
}
