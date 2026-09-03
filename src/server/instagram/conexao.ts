import 'server-only'
import { z } from 'zod'

/**
 * Ligar uma conta do Instagram ao AutoFluxos — o Business Login da Meta.
 *
 * ---------------------------------------------------------------------------
 * Três hosts diferentes, e trocar um pelo outro dá erro que não explica nada
 * ---------------------------------------------------------------------------
 *
 * - `www.instagram.com/oauth/authorize` — a tela que o dono do perfil vê.
 * - `api.instagram.com/oauth/access_token` — troca o código pelo token curto.
 *   **POST, com corpo de formulário.** É o único ponto de todo o produto que
 *   não fala JSON com a Meta, e mandar JSON aqui devolve um erro de parâmetro
 *   ausente que parece problema de permissão.
 * - `graph.instagram.com` — o resto: token longo, renovação, e as mensagens.
 *
 * ---------------------------------------------------------------------------
 * A escada de tokens, e por que ela não pode ser pulada
 * ---------------------------------------------------------------------------
 *
 * O código do redirect vale uma vez e por poucos minutos. Ele vira um token
 * **curto** (1 hora), que só serve para virar um token **longo** (60 dias).
 * Guardar o curto e seguir a vida é o erro que só aparece uma hora depois, com
 * a conta parando de responder sem ninguém ter mexido em nada.
 *
 * O longo se renova enquanto está vivo; vencido, só refazendo o OAuth — o que
 * exige o dono do perfil na frente da tela. Por isso `channels.token_expira_em`
 * existe: para o aviso chegar antes, e não pelo cliente reclamando.
 */

/** Sobrescreva pelo `.env` quando a Meta aposentar a versão. */
const VERSAO_PADRAO = 'v25.0'

/**
 * O que pedimos ao dono do perfil.
 *
 * `instagram_business_basic` é obrigatório junto do resto — a Meta recusa o
 * pedido sem ele. `..._manage_messages` é o que permite ler e responder
 * direct, e é o que depende do app review.
 *
 * Não pedimos `..._manage_comments` nem `..._content_publish`: permissão que
 * não é usada é permissão a mais para justificar no app review, e cada uma é
 * revisada separadamente.
 */
export const ESCOPOS = ['instagram_business_basic', 'instagram_business_manage_messages'] as const

/** Quanto vale o token longo, para gravar a validade sem consultar a Meta. */
export const DIAS_DO_TOKEN_LONGO = 60

const TIMEOUT_MS = 15_000

export type ContaConectada = {
  igUserId: string
  username: string | null
  token: string
  expiraEm: Date
}

function credenciais(): { appId: string; appSecret: string } {
  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error(
      'faltam INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET no ambiente; a conexão do Instagram não roda sem eles',
    )
  }
  return { appId, appSecret }
}

/** O app do Instagram está configurado neste ambiente? A tela pergunta isso. */
export function instagramConfigurado(): boolean {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET)
}

/**
 * O endereço para onde a Meta devolve o dono do perfil depois de ele
 * autorizar.
 *
 * **Tem que bater byte a byte com o que está cadastrado no painel da Meta e com
 * o que foi mandado no `authorize`** — as três cópias, ou a troca do código
 * falha com "redirect_uri mismatch". Por isso ele é montado num lugar só.
 */
export function enderecoDeRetorno(origem: string): string {
  return new URL('/api/instagram/retorno', origem).toString()
}

/**
 * A URL da tela de autorização.
 *
 * O `state` **não é opcional na prática**: ele é o que amarra o retorno da Meta
 * ao cliente que começou a conexão. Sem ele, qualquer pessoa poderia induzir um
 * administrador a abrir o retorno e ligar uma conta de Instagram a um cliente
 * que não é o dela.
 */
export function urlDeAutorizacao(opcoes: { origem: string; state: string }): string {
  const { appId } = credenciais()
  const url = new URL('https://www.instagram.com/oauth/authorize')

  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', enderecoDeRetorno(opcoes.origem))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', ESCOPOS.join(','))
  url.searchParams.set('state', opcoes.state)

  return url.toString()
}

const tokenCurtoSchema = z.object({
  access_token: z.string(),
  // Vem como número em algumas respostas e como texto em outras. A Meta
  // documenta "App-scoped User ID" sem prometer o tipo, e um `z.string()`
  // sozinho derruba a conexão inteira num detalhe de serialização.
  user_id: z.union([z.string(), z.number()]).transform(String),
})

const tokenLongoSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
})

const perfilSchema = z.object({
  user_id: z.union([z.string(), z.number()]).transform(String).optional(),
  username: z.string().optional(),
})

async function pedir(url: string, init?: RequestInit): Promise<unknown> {
  let resposta: Response
  try {
    resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (erro) {
    const nome = erro instanceof Error ? erro.name : ''
    if (nome === 'TimeoutError' || nome === 'AbortError') {
      throw new Error('o Instagram não respondeu a tempo; tente conectar de novo')
    }
    throw new Error(`não deu para falar com o Instagram: ${erro instanceof Error ? erro.message : erro}`)
  }

  const texto = await resposta.text()
  if (!resposta.ok) {
    // O texto da Meta é o que separa "código já usado" de "app sem permissão".
    // Engolir isso transforma uma conexão que falha em cinco minutos de
    // conversa numa tarde de investigação.
    throw new Error(`o Instagram respondeu ${resposta.status}: ${texto.slice(0, 400)}`)
  }

  try {
    return JSON.parse(texto)
  } catch {
    throw new Error(`o Instagram devolveu algo que não é JSON: ${texto.slice(0, 200)}`)
  }
}

/**
 * O caminho inteiro: código → token curto → token longo → quem é a conta.
 *
 * Uma função só porque os quatro passos não fazem sentido separados — parar no
 * meio deixa a conta ligada pela metade, e o código do redirect já foi gasto.
 */
export async function trocarCodigoPorConta(opcoes: {
  codigo: string
  origem: string
  versaoGraph?: string
}): Promise<ContaConectada> {
  const { appId, appSecret } = credenciais()
  const versao = opcoes.versaoGraph ?? process.env.META_GRAPH_VERSION ?? VERSAO_PADRAO

  // Passo 1: o código vira um token de uma hora. Formulário, não JSON.
  const corpo = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: enderecoDeRetorno(opcoes.origem),
    code: opcoes.codigo,
  })

  const curto = tokenCurtoSchema.parse(
    await pedir('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: corpo,
    }),
  )

  // Passo 2: uma hora vira 60 dias. Pular isto é o erro que só aparece daqui a
  // uma hora, com a conta muda e ninguém tendo mexido em nada.
  const trocaLonga = new URL('https://graph.instagram.com/access_token')
  trocaLonga.searchParams.set('grant_type', 'ig_exchange_token')
  trocaLonga.searchParams.set('client_secret', appSecret)
  trocaLonga.searchParams.set('access_token', curto.access_token)

  const longo = tokenLongoSchema.parse(await pedir(trocaLonga.toString()))

  // Passo 3: o @ do perfil, só para a tela ter o que mostrar. Se falhar, a
  // conexão continua: o identificador é o `user_id`, e o @ é enfeite.
  let username: string | null = null
  try {
    const perfil = new URL(`https://graph.instagram.com/${versao}/me`)
    perfil.searchParams.set('fields', 'user_id,username')
    perfil.searchParams.set('access_token', longo.access_token)
    username = perfilSchema.parse(await pedir(perfil.toString())).username ?? null
  } catch (erro) {
    console.warn('[instagram] conectou mas não leu o @ do perfil', erro)
  }

  const segundos = longo.expires_in ?? DIAS_DO_TOKEN_LONGO * 24 * 60 * 60
  return {
    igUserId: curto.user_id,
    username,
    token: longo.access_token,
    expiraEm: new Date(Date.now() + segundos * 1_000),
  }
}

/**
 * Renova o token longo antes de ele vencer.
 *
 * Só funciona com token **vivo** e com pelo menos 24h de idade. Vencido, não há
 * renovação: é refazer o OAuth, com o dono do perfil na frente da tela — que é
 * o motivo de a validade ser guardada e vigiada.
 */
export async function renovarToken(token: string): Promise<{ token: string; expiraEm: Date }> {
  const url = new URL('https://graph.instagram.com/refresh_access_token')
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', token)

  const novo = tokenLongoSchema.parse(await pedir(url.toString()))
  const segundos = novo.expires_in ?? DIAS_DO_TOKEN_LONGO * 24 * 60 * 60

  return { token: novo.access_token, expiraEm: new Date(Date.now() + segundos * 1_000) }
}
