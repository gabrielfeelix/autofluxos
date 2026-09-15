import 'server-only'

/**
 * O login do Facebook para ligar a conta de anúncios do cliente.
 *
 * ---------------------------------------------------------------------------
 * Por que o diálogo da Meta, e não "cole um token"
 * ---------------------------------------------------------------------------
 *
 * Duas razões, e as duas bastam sozinhas.
 *
 * **A primeira é o cliente.** Pedir que ele abra o Gerenciador de Negócios,
 * ache "Usuários do sistema", crie um, atribua ativos e gere um token é o
 * caminho de quem já sabe onde tudo fica. Na prática é onde a venda morre: são
 * cinco telas que ele nunca visitou, e errar qualquer uma não dá erro — dá
 * silêncio.
 *
 * **A segunda é o App Review.** A Meta exige ver, no vídeo, *"o usuário
 * concedendo ao seu app a permissão que você está demonstrando"*, com o diálogo
 * de autorização na tela. Um campo de colar token não mostra diálogo nenhum, e
 * a submissão é recusada por não conseguirem verificar a permissão.
 *
 * O campo de token continua existindo, como segunda via: quem quer um acesso
 * que nunca vence usa usuário do sistema, e cola ali.
 */

const VERSAO_PADRAO = 'v25.0'

/**
 * Os escopos pedidos no diálogo.
 *
 * É a mesma lista da submissão do App Review, e tem de continuar sendo: escopo
 * pedido aqui e não justificado lá é recusado; justificado lá e não pedido aqui
 * é permissão que nunca é exercida — e a Meta exige ao menos uma chamada real
 * com cada uma nos 30 dias antes de submeter.
 */
export const ESCOPOS_DE_ANUNCIOS = [
  'leads_retrieval',
  'ads_management',
  'ads_read',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_ads',
  'business_management',
] as const

export function urlDeAutorizacao(opcoes: { origem: string; state: string }): string {
  const appId = process.env.META_APP_ID
  if (!appId) throw new Error('falta META_APP_ID no ambiente')

  const url = new URL(`https://www.facebook.com/${VERSAO_PADRAO}/dialog/oauth`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', `${opcoes.origem}/api/anuncios/retorno`)
  url.searchParams.set('state', opcoes.state)
  url.searchParams.set('scope', ESCOPOS_DE_ANUNCIOS.join(','))
  /*
   * `rerequest` por causa de quem já recusou uma vez.
   *
   * Sem ele a Meta **não mostra o diálogo de novo** para quem negou antes: ela
   * devolve na hora, sem as permissões, e a tela dá erro sem que a pessoa tenha
   * tido a chance de dizer sim. Com ele, pergunta de novo — que é o que alguém
   * que acabou de clicar em "Conectar" espera.
   */
  url.searchParams.set('auth_type', 'rerequest')
  return url.toString()
}

export type TokenDeAnuncios = { token: string; expiraEm: Date | null }

/**
 * Troca o código do retorno por um token, e o curto por um longo.
 *
 * São duas chamadas porque o token que o diálogo devolve vale **uma hora**. O
 * de longa duração vale sessenta dias — ainda não é para sempre, e é por isso
 * que a tela mostra a data de vencimento e a reconciliação grita quando ele cai.
 */
export async function trocarCodigoPorToken(entrada: {
  codigo: string
  origem: string
}): Promise<TokenDeAnuncios> {
  const appId = process.env.META_APP_ID
  const segredo = process.env.META_APP_SECRET
  if (!appId || !segredo) throw new Error('faltam META_APP_ID e META_APP_SECRET no ambiente')

  const curto = new URL(`https://graph.facebook.com/${VERSAO_PADRAO}/oauth/access_token`)
  curto.searchParams.set('client_id', appId)
  curto.searchParams.set('client_secret', segredo)
  curto.searchParams.set('redirect_uri', `${entrada.origem}/api/anuncios/retorno`)
  curto.searchParams.set('code', entrada.codigo)

  const r1 = await fetch(curto, { cache: 'no-store' })
  const c1 = (await r1.json().catch(() => null)) as {
    access_token?: unknown
    error?: { message?: unknown }
  } | null

  if (!r1.ok || typeof c1?.access_token !== 'string') {
    const detalhe = typeof c1?.error?.message === 'string' ? c1.error.message : `HTTP ${r1.status}`
    throw new Error(`a Meta recusou o código: ${detalhe}`)
  }

  const longo = new URL(`https://graph.facebook.com/${VERSAO_PADRAO}/oauth/access_token`)
  longo.searchParams.set('grant_type', 'fb_exchange_token')
  longo.searchParams.set('client_id', appId)
  longo.searchParams.set('client_secret', segredo)
  longo.searchParams.set('fb_exchange_token', c1.access_token)

  const r2 = await fetch(longo, { cache: 'no-store' })
  const c2 = (await r2.json().catch(() => null)) as {
    access_token?: unknown
    expires_in?: unknown
  } | null

  /*
   * Falhar a troca não perde a conexão: o token de uma hora já está na mão e
   * funciona. Guardamos ele — melhor uma hora de integração do que nenhuma.
   */
  if (!r2.ok || typeof c2?.access_token !== 'string') {
    return { token: c1.access_token, expiraEm: new Date(Date.now() + 3_600_000) }
  }

  const segundos = typeof c2.expires_in === 'number' ? c2.expires_in : null
  return {
    token: c2.access_token,
    expiraEm: segundos ? new Date(Date.now() + segundos * 1000) : null,
  }
}

/**
 * As Páginas que esta pessoa administra.
 *
 * É o uso literal de `pages_show_list`, e o que a tela mostra para ela escolher
 * qual conectar: uma agência tem várias, e escolher a errada manda o lead de um
 * cliente para a base de outro.
 */
export async function listarPaginasDoUsuario(
  token: string,
): Promise<{ id: string; nome: string }[]> {
  const url = new URL(`https://graph.facebook.com/${VERSAO_PADRAO}/me/accounts`)
  url.searchParams.set('fields', 'id,name')
  url.searchParams.set('limit', '100')

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const corpo = (await r.json().catch(() => null)) as { data?: unknown } | null
  if (!r.ok || !Array.isArray(corpo?.data)) return []

  return corpo.data.flatMap((linha) => {
    const l = linha as { id?: unknown; name?: unknown }
    if (typeof l.id !== 'string') return []
    return [{ id: l.id, nome: typeof l.name === 'string' ? l.name : '' }]
  })
}

/**
 * Os formulários de lead de uma Página, com quantos leads cada um tem.
 *
 * É a lista que a tela de importação mostra. `leads_count` vem de graça na
 * mesma chamada e é o que transforma "importar" numa decisão — ninguém aperta
 * um botão que não diz quanta coisa vem.
 */
export async function listarFormulariosDaPagina(entrada: {
  pageId: string
  token: string
}): Promise<{ id: string; nome: string; leads: number }[]> {
  const url = new URL(`https://graph.facebook.com/${VERSAO_PADRAO}/${entrada.pageId}/leadgen_forms`)
  url.searchParams.set('fields', 'id,name,leads_count,status')
  url.searchParams.set('limit', '100')

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${entrada.token}` },
    cache: 'no-store',
  })

  const corpo = (await r.json().catch(() => null)) as { data?: unknown } | null
  if (!r.ok || !Array.isArray(corpo?.data)) return []

  return corpo.data.flatMap((linha) => {
    const l = linha as { id?: unknown; name?: unknown; leads_count?: unknown }
    if (typeof l.id !== 'string') return []
    return [
      {
        id: l.id,
        nome: typeof l.name === 'string' ? l.name : '',
        leads: typeof l.leads_count === 'number' ? l.leads_count : 0,
      },
    ]
  })
}
