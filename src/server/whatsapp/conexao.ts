import 'server-only'
import { z } from 'zod'

/**
 * A ponta servidor-a-servidor do Embedded Signup **hospedado pela Meta**.
 *
 * ---------------------------------------------------------------------------
 * Por que não há SDK aqui
 * ---------------------------------------------------------------------------
 *
 * Decidido em 13/09: o onboarding é o **Hosted Embedded Signup**. A Meta
 * hospeda a tela inteira e devolve o cliente na nossa rota de retorno com um
 * `code`. Não existe `FB.login`, nem SDK de JavaScript, nem lista de domínios
 * permitidos, nem `extras` montado por nós — o link do painel já vem com
 * Coexistence ligado (`featureType: whatsapp_business_app_onboarding`) e com
 * `version: v4`, que é o que evita o v2 que morre em 15/out/2026.
 *
 * O nosso lado é este arquivo: trocar o `code` por token **no servidor**, e
 * perguntar à Graph API se o número que chegou é mesmo coexistente.
 *
 * ---------------------------------------------------------------------------
 * O `code` nunca vira token no navegador
 * ---------------------------------------------------------------------------
 *
 * A troca exige o `client_secret` do app. Fazê-la no navegador significaria
 * mandar o segredo do app para a máquina do cliente — e o segredo do app é o
 * que assina o webhook de **todos** os clientes. Um vazamento aqui não é "um
 * cliente comprometido": é qualquer pessoa conseguindo forjar mensagem em nome
 * de qualquer um deles.
 */

const VERSAO_PADRAO = 'v21.0'
const TIMEOUT_MS = 10_000

function credenciais(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error(
      'faltam META_APP_ID e META_APP_SECRET no ambiente; o onboarding do WhatsApp não roda sem eles',
    )
  }
  return { appId, appSecret }
}

function versaoGraph(): string {
  return process.env.META_GRAPH_VERSION ?? VERSAO_PADRAO
}

/**
 * Fala com a Graph API e devolve JSON, ou estoura com o texto da Meta junto.
 *
 * O texto é o que separa "código já usado" de "app sem permissão". Engoli-lo
 * transforma uma conexão que falharia em cinco minutos de conversa numa tarde
 * de investigação — a lição está no equivalente do Instagram.
 */
async function pedir(url: string, init?: RequestInit): Promise<unknown> {
  let resposta: Response
  try {
    resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (erro) {
    const nome = erro instanceof Error ? erro.name : ''
    if (nome === 'TimeoutError' || nome === 'AbortError') {
      throw new Error('a Meta não respondeu a tempo; tente conectar de novo')
    }
    throw new Error(
      `não deu para falar com a Meta: ${erro instanceof Error ? erro.message : String(erro)}`,
    )
  }

  const texto = await resposta.text()
  if (!resposta.ok) {
    throw new Error(`a Meta respondeu ${resposta.status}: ${texto.slice(0, 400)}`)
  }

  try {
    return JSON.parse(texto)
  } catch {
    throw new Error(`a Meta devolveu algo que não é JSON: ${texto.slice(0, 200)}`)
  }
}

const tokenSchema = z.object({
  access_token: z.string(),
  /**
   * Ausente no token de sistema do WhatsApp Business, e isso é normal: ele não
   * expira. `token_expira_em` fica nulo, que é o que a coluna já significa.
   */
  expires_in: z.number().optional(),
})

/**
 * O `code` do retorno vira o token do negócio.
 *
 * **Um passo só**, diferente do Instagram: não há troca de curto por longo. O
 * token que sai daqui é o do negócio do cliente e não tem prazo — por isso a
 * rota de retorno não agenda renovação nenhuma.
 */
export async function trocarCodigoPorToken(codigo: string): Promise<{
  token: string
  expiraEm: Date | null
}> {
  const { appId, appSecret } = credenciais()

  const url = new URL(`https://graph.facebook.com/${versaoGraph()}/oauth/access_token`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('code', codigo)

  const lido = tokenSchema.parse(await pedir(url.toString()))

  return {
    token: lido.access_token,
    expiraEm: lido.expires_in ? new Date(Date.now() + lido.expires_in * 1_000) : null,
  }
}

const numeroSchema = z.object({
  id: z.string().optional(),
  display_phone_number: z.string().optional(),
  verified_name: z.string().optional(),
  /** `true` = o número também está no WhatsApp Business App do cliente. */
  is_on_biz_app: z.boolean().optional(),
  /** Coexistente de verdade exige `CLOUD_API` aqui. */
  platform_type: z.string().optional(),
})

export type NumeroDaMeta = z.infer<typeof numeroSchema>

/**
 * O número embarcou em **coexistência**, ou é Cloud API pura?
 *
 * A resposta é o par `is_on_biz_app: true` **e** `platform_type: 'CLOUD_API'`.
 * Os dois, sempre: `is_on_biz_app` sozinho não distingue um número que está no
 * app do cliente e ainda não terminou de migrar, e é justamente nesse estado
 * que disparar os syncs queima a janela de 24h sem trazer nada.
 *
 * É a checagem que o handoff manda fazer com `curl`, feita no código para que
 * `channels.is_on_biz_app` guarde um fato verificado em vez de uma suposição do
 * fluxo de onboarding.
 */
export async function lerNumero(
  phoneNumberId: string,
  token: string,
): Promise<NumeroDaMeta> {
  const url = new URL(`https://graph.facebook.com/${versaoGraph()}/${phoneNumberId}`)
  url.searchParams.set('fields', 'id,display_phone_number,verified_name,is_on_biz_app,platform_type')

  return numeroSchema.parse(
    await pedir(url.toString(), { headers: { authorization: `Bearer ${token}` } }),
  )
}

/** Coexistente = os dois sinais juntos. Ver `lerNumero`. */
export function ehCoexistente(numero: NumeroDaMeta): boolean {
  return numero.is_on_biz_app === true && numero.platform_type === 'CLOUD_API'
}

/**
 * Inscreve o nosso app na WABA **do cliente**.
 *
 * **Antes de disparar qualquer sync, sempre.** Sem a inscrição, os webhooks que
 * respondem ao disparo se perdem — e como cada sync só pode ser disparado uma
 * vez, a janela de 24h queima sem volta e o cliente precisa refazer o Embedded
 * Signup inteiro.
 */
export async function inscreverNaWaba(wabaId: string, token: string): Promise<void> {
  await pedir(`https://graph.facebook.com/${versaoGraph()}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
}

const syncSchema = z.object({
  messaging_product: z.string().optional(),
  request_id: z.string().optional(),
})

/**
 * Dispara um dos dois syncs da janela de 24h.
 *
 * **Cada um só pode ser disparado uma vez**, e não há como perguntar à Meta se
 * já gastamos a nossa. Por isso quem chama tem que ter reservado antes, com
 * `reservarSync` — esta função só fala com a Meta, e chamá-la sem a reserva é o
 * jeito de desperdiçar a única chance que existia.
 *
 * Devolve o `request_id`, que é **o que o suporte da Meta pede** quando um sync
 * não chega.
 */
export async function dispararSync(
  phoneNumberId: string,
  tipo: 'contatos' | 'historico',
  token: string,
): Promise<string | null> {
  const lido = syncSchema.parse(
    await pedir(`https://graph.facebook.com/${versaoGraph()}/${phoneNumberId}/smb_app_data`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        sync_type: tipo === 'contatos' ? 'smb_app_state_sync' : 'history',
      }),
    }),
  )

  return lido.request_id ?? null
}
