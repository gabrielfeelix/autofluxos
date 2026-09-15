import { iguais } from '@/lib/segredo'
import { listarLeadsDoFormulario } from '@/channels/marketing-api'
import { alertar } from '@/server/alertar'
import { receberLeadsDoFormulario } from '@/server/receber-lead-do-formulario'
import { formulariosAtivos } from '@/server/repos/paginas-de-lead'
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
    const formularios = await formulariosAtivos()

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
         */
        await alertar(
          'a reconciliação não conseguiu ler um formulário',
          `${busca.erro.mensagem} (formulário ${formulario.formId})`,
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
