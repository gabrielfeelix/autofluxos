import type { NomesDoAnuncio } from '@/core/anuncios'

/**
 * O nó `Ad` da Marketing API, só para descobrir nomes.
 *
 * ---------------------------------------------------------------------------
 * O que esta chamada é, e o que ela não é
 * ---------------------------------------------------------------------------
 *
 * É **leitura**, de três campos de texto. Não cria campanha, não altera
 * orçamento, não pausa anúncio, não lê métrica. O produto continua sendo uma
 * caixa de entrada: saber de qual campanha a pessoa veio é contexto do
 * atendimento, do mesmo tipo que o telefone e a data de chegada, não é
 * gerenciar mídia, que é outro produto (o Otimiza Gestor).
 *
 * Vale dizer por escrito porque a fronteira é fácil de cruzar sem perceber: o
 * mesmo token que lê o nome também leria gasto e resultado, e a tentação de
 * "já que temos o token" é exatamente como um inbox vira um painel de anúncios
 * pela metade.
 *
 * ---------------------------------------------------------------------------
 * Uma chamada, três nomes
 * ---------------------------------------------------------------------------
 *
 * A field expansion da Graph (`campaign{name}`) traz o conjunto e a campanha
 * junto do anúncio, então não há encadeamento de três requisições. Importa
 * porque o limite de chamadas da Meta é por Página e proporcional ao volume de
 * leads, gastar três onde uma serve encurta o teto de quem está começando.
 */

const VERSAO_PADRAO = 'v25.0'

/**
 * Dez segundos.
 *
 * Menos que os quinze do envio de mensagem, e de propósito: mandar uma resposta
 * ao cliente é o trabalho; descobrir o nome de uma campanha é enfeite de tela.
 * Se a Meta estiver lenta, o enfeite espera, a linha mostra o `headline`, que
 * já está no contato.
 */
const TIMEOUT_MS = 10_000

export type ErroDaMarketingApi = {
  /** O código da Meta, quando veio. 190 = token inválido; 80004 = limite. */
  codigo: number | null
  mensagem: string
}

export type RespostaDeNomes =
  | { ok: true; nomes: NomesDoAnuncio }
  | { ok: false; erro: ErroDaMarketingApi }

type CorpoDaMeta = {
  name?: unknown
  adset?: { name?: unknown } | null
  campaign?: { name?: unknown } | null
  error?: { message?: unknown; code?: unknown } | null
}

/** A Meta manda string; qualquer outra coisa vira vazio em vez de derrubar. */
function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/**
 * Lê nome do anúncio, do conjunto e da campanha de um `ad_id`.
 *
 * **Nunca lança.** Quem chama está desenhando uma tela de atendimento: uma
 * Graph fora do ar não pode derrubar o Inbox nem fazer um webhook responder
 * erro para a Meta. Todo caminho de falha vira `{ ok: false }` com o código,
 * que é o que permite distinguir "token venceu" de "estourou o limite", os
 * dois erram parecido e pedem respostas opostas (reconectar vs. esperar).
 */
export async function lerNomesDoAnuncio(entrada: {
  adId: string
  token: string
  versaoGraph?: string
}): Promise<RespostaDeNomes> {
  const versao = entrada.versaoGraph ?? process.env.META_GRAPH_VERSAO ?? VERSAO_PADRAO
  const url = new URL(`https://graph.facebook.com/${versao}/${entrada.adId}`)
  /*
   * `fields` explícito, sempre. Sem ele a Graph devolve o conjunto default ,
   * que é menor do que o disponível, e some com `campaign`/`adset` sem dizer
   * por quê. É o erro que faz alguém concluir "a Meta não manda o nome".
   */
  url.searchParams.set('fields', 'name,adset{name},campaign{name}')

  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${entrada.token}` },
      signal: controle.signal,
    })

    const corpo = (await resposta.json().catch(() => null)) as CorpoDaMeta | null

    if (!resposta.ok || corpo?.error) {
      const codigo = corpo?.error?.code
      return {
        ok: false,
        erro: {
          codigo: typeof codigo === 'number' ? codigo : null,
          mensagem: texto(corpo?.error?.message) || `a Meta respondeu ${resposta.status}`,
        },
      }
    }

    return {
      ok: true,
      nomes: {
        anuncio: texto(corpo?.name),
        conjunto: texto(corpo?.adset?.name),
        campanha: texto(corpo?.campaign?.name),
      },
    }
  } catch (erro) {
    /*
     * `AbortError` é o timeout acima; o resto é rede. Os dois dizem a mesma
     * coisa a quem chama, não deu para saber agora, e nenhum é motivo para
     * apagar o nome que já está guardado.
     */
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return { ok: false, erro: { codigo: null, mensagem: detalhe } }
  } finally {
    clearTimeout(prazo)
  }
}

/* -------------------------------------------------------------------------- */
/* Lead Ads: o formulário nativo                                               */
/* -------------------------------------------------------------------------- */

export type RespostaDeLead =
  | { ok: true; fieldData: unknown; adId: string; criadoEm: string }
  | { ok: false; erro: ErroDaMarketingApi }

/**
 * Busca um lead pelo `leadgen_id`.
 *
 * **O webhook só manda IDs.** Nunca vem `field_data` no aviso, é preciso vir
 * aqui buscar, e é por isso que o handler do webhook responde `200` antes e
 * processa depois: buscar dentro dele transformaria lentidão da Graph em falha
 * de entrega, e a Meta reentregaria o lote inteiro.
 *
 * `fields` explícito, sempre. Sem ele a Graph devolve o conjunto default, que é
 * menor que o disponível, e some com `ad_id` sem dizer por quê, o erro que faz
 * alguém concluir que a Meta não manda atribuição.
 */
export async function lerLeadDoFormularioNaMeta(entrada: {
  leadgenId: string
  token: string
  versaoGraph?: string
}): Promise<RespostaDeLead> {
  const versao = entrada.versaoGraph ?? process.env.META_GRAPH_VERSAO ?? VERSAO_PADRAO
  const url = new URL(`https://graph.facebook.com/${versao}/${entrada.leadgenId}`)
  url.searchParams.set('fields', 'id,created_time,ad_id,form_id,field_data')

  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${entrada.token}` },
      signal: controle.signal,
    })

    const corpo = (await resposta.json().catch(() => null)) as {
      field_data?: unknown
      ad_id?: unknown
      created_time?: unknown
      error?: { message?: unknown; code?: unknown } | null
    } | null

    if (!resposta.ok || corpo?.error) {
      const codigo = corpo?.error?.code
      return {
        ok: false,
        erro: {
          codigo: typeof codigo === 'number' ? codigo : null,
          mensagem: texto(corpo?.error?.message) || `a Meta respondeu ${resposta.status}`,
        },
      }
    }

    return {
      ok: true,
      fieldData: corpo?.field_data ?? [],
      adId: texto(corpo?.ad_id),
      criadoEm: texto(corpo?.created_time),
    }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return { ok: false, erro: { codigo: null, mensagem: detalhe } }
  } finally {
    clearTimeout(prazo)
  }
}

/**
 * Os leads de um formulário, para a reconciliação diária.
 *
 * **Não é luxo, é o que fecha o buraco do webhook.** A Meta não reentrega
 * depois de um `200`, e o mercado documenta o que isso custa: a RD Station
 * perdeu 18 dias de leads em jul/2024, e a SleekFlow recupera só os 30 minutos
 * anteriores a uma reconexão. Como a retenção da Meta é de 90 dias, o que não
 * for buscado a tempo **não existe mais em lugar nenhum**.
 *
 * Varrer o formulário de tempos em tempos é barato e transforma "lead perdido
 * para sempre" em "lead que chegou algumas horas depois".
 */
export async function listarLeadsDoFormulario(entrada: {
  formId: string
  token: string
  desde?: Date
  versaoGraph?: string
}): Promise<{ ok: true; leads: { id: string; fieldData: unknown; adId: string }[] } | { ok: false; erro: ErroDaMarketingApi }> {
  const versao = entrada.versaoGraph ?? process.env.META_GRAPH_VERSAO ?? VERSAO_PADRAO
  const url = new URL(`https://graph.facebook.com/${versao}/${entrada.formId}/leads`)
  url.searchParams.set('fields', 'id,created_time,ad_id,field_data')
  url.searchParams.set('limit', '100')
  if (entrada.desde) {
    url.searchParams.set('filtering', JSON.stringify([
      { field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(entrada.desde.getTime() / 1000) },
    ]))
  }

  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${entrada.token}` },
      signal: controle.signal,
    })

    const corpo = (await resposta.json().catch(() => null)) as {
      data?: unknown
      error?: { message?: unknown; code?: unknown } | null
    } | null

    if (!resposta.ok || corpo?.error) {
      const codigo = corpo?.error?.code
      return {
        ok: false,
        erro: {
          codigo: typeof codigo === 'number' ? codigo : null,
          mensagem: texto(corpo?.error?.message) || `a Meta respondeu ${resposta.status}`,
        },
      }
    }

    const linhas = Array.isArray(corpo?.data) ? corpo.data : []
    return {
      ok: true,
      leads: linhas.map((linha) => {
        const l = linha as { id?: unknown; field_data?: unknown; ad_id?: unknown }
        return { id: texto(l.id), fieldData: l.field_data ?? [], adId: texto(l.ad_id) }
      }),
    }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return { ok: false, erro: { codigo: null, mensagem: detalhe } }
  } finally {
    clearTimeout(prazo)
  }
}

/* -------------------------------------------------------------------------- */
/* Páginas do token, e a assinatura de leads                                   */
/* -------------------------------------------------------------------------- */

export type PaginaDoToken = { id: string; nome: string }

async function chamarGraph(
  caminho: string,
  token: string,
  metodo: 'GET' | 'POST' = 'GET',
): Promise<{ ok: true; corpo: Record<string, unknown> } | { ok: false; erro: ErroDaMarketingApi }> {
  const versao = process.env.META_GRAPH_VERSAO ?? VERSAO_PADRAO
  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_MS)
  try {
    const resposta = await fetch(`https://graph.facebook.com/${versao}/${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}` },
      signal: controle.signal,
    })
    const corpo = (await resposta.json().catch(() => null)) as
      | (Record<string, unknown> & { error?: { code?: unknown; message?: unknown } })
      | null
    if (!resposta.ok || corpo?.error) {
      const codigo = corpo?.error?.code
      return {
        ok: false,
        erro: {
          codigo: typeof codigo === 'number' ? codigo : null,
          mensagem: texto(corpo?.error?.message) || `a Meta respondeu ${resposta.status}`,
        },
      }
    }
    return { ok: true, corpo: corpo ?? {} }
  } catch (erro) {
    return { ok: false, erro: { codigo: null, mensagem: erro instanceof Error ? erro.message : String(erro) } }
  } finally {
    clearTimeout(prazo)
  }
}

/**
 * As Páginas que o token de anúncios enxerga, para a tela oferecer uma lista em
 * vez de pedir o id (relato de 01/out/2026: "como vou ligar uma página se não
 * sei o id?"). Só as que têm a tarefa de leads: as outras chegariam sem dado.
 */
export async function listarPaginasDoToken(token: string): Promise<PaginaDoToken[] | null> {
  const r = await chamarGraph('me/accounts?fields=id,name,tasks&limit=100', token)
  if (!r.ok) return null
  const itens = (r.corpo.data ?? []) as { id?: unknown; name?: unknown; tasks?: unknown }[]
  return itens
    .filter((p) => !Array.isArray(p.tasks) || p.tasks.includes('MANAGE_LEADS') || p.tasks.includes('MANAGE'))
    .map((p) => ({ id: texto(p.id), nome: texto(p.name) }))
    .filter((p) => p.id !== '')
}

/**
 * Faz a Página mandar os leads para o nosso app.
 *
 * **É o passo que todo mundo esquece, e ele falha em silêncio**: sem a Página
 * instalar o app (`subscribed_apps` com `leadgen`), a Meta não manda nada e o
 * painel do app continua dizendo que o webhook está certo. A chamada exige o
 * token **da Página**, que sai do token de anúncios.
 */
export async function assinarLeadsDaPagina(
  pageId: string,
  token: string,
): Promise<{ ok: true } | { ok: false; erro: ErroDaMarketingApi }> {
  const daPagina = await chamarGraph(`${pageId}?fields=access_token`, token)
  if (!daPagina.ok) return daPagina
  const tokenDaPagina = texto(daPagina.corpo.access_token)
  if (!tokenDaPagina) {
    return { ok: false, erro: { codigo: null, mensagem: 'o token não tem acesso de gerenciar esta Página' } }
  }
  const assinou = await chamarGraph(`${pageId}/subscribed_apps?subscribed_fields=leadgen`, tokenDaPagina, 'POST')
  return assinou.ok ? { ok: true } : assinou
}
