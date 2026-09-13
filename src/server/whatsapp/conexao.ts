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

/* -------------------------------------------------------------------------- */
/* O link do Embedded Signup hospedado                                         */
/* -------------------------------------------------------------------------- */

/** O app do WhatsApp está configurado neste ambiente? A tela pergunta isso. */
export function whatsappConfigurado(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_WHATSAPP_CONFIG_ID)
}

/**
 * A URL que o cliente abre para conectar o WhatsApp dele.
 *
 * **A Meta hospeda a tela inteira**, então isto é só a montagem do endereço —
 * não há SDK, `FB.login`, nem `extras` montado em JavaScript no navegador.
 *
 * O `extras` carrega o que faz esta conexão ser **coexistência** e não
 * onboarding comum:
 *
 * - `featureType: whatsapp_business_app_onboarding` — é o que troca a seleção
 *   de WABA por "conectar sua conta existente". Sem ele, a tela pede para o
 *   cliente escolher uma WABA e o número dele não entra em coexistência.
 * - `version: v4` — o v2 morre em 15/out/2026. Nascer em v4 é o que evita
 *   retrabalho contratado.
 * - `sessionInfoVersion: 3` — o session logging, que a Meta lista entre os
 *   requisitos.
 *
 * **O `state` não é burocracia.** É ele que diz de qual cliente é a conexão que
 * está voltando: sem ele, a rota de retorno rejeita
 * (`/painel?erro=whatsapp_estado`), e dois clientes conectando no mesmo dia
 * viram dúvida sobre qual número é de quem. Vem de `criarEstado`, o mesmo do
 * Instagram — ele assina um `clienteId` e não sabe de que canal se trata, então
 * serve aos dois e não há por que inventar um segundo mecanismo.
 */
export function urlDoOnboarding(opcoes: { origem: string; state: string }): string {
  const appId = process.env.META_APP_ID
  const configId = process.env.META_WHATSAPP_CONFIG_ID

  if (!appId || !configId) {
    throw new Error('faltam META_APP_ID e META_WHATSAPP_CONFIG_ID no ambiente')
  }

  const url = new URL('https://business.facebook.com/messaging/whatsapp/onboard/')
  url.searchParams.set('app_id', appId)
  url.searchParams.set('config_id', configId)
  url.searchParams.set(
    'extras',
    JSON.stringify({
      version: 'v4',
      sessionInfoVersion: '3',
      featureType: 'whatsapp_business_app_onboarding',
    }),
  )
  /*
   * A origem vem de quem chama (que a lê do cabeçalho), e não de uma variável.
   *
   * O `redirect_uri` precisa bater byte a byte com o cadastrado no painel da
   * Meta e com o que a rota de retorno atende. Ler da requisição faz preview e
   * produção funcionarem sem cada um ter a sua variável — o preço é cadastrar
   * cada origem no painel, que é obrigatório de qualquer forma.
   */
  url.searchParams.set('redirect_uri', `${opcoes.origem}/api/whatsapp/retorno`)
  url.searchParams.set('state', opcoes.state)

  return url.toString()
}

const numerosDaWabaSchema = z.object({
  data: z
    .array(z.object({ id: z.string(), display_phone_number: z.string().optional() }))
    .default([]),
})

/**
 * Os números de uma WABA.
 *
 * Existe porque **o `PARTNER_ADDED` não traz o `phone_number_id`** — ele traz
 * só `waba_info.waba_id`. E é justamente por esse webhook que descobrimos um
 * onboarding quando o navegador do cliente não volta para a nossa rota de
 * retorno, que é o caso comum quando o `redirect_uri` não está cadastrado no
 * painel da Meta.
 *
 * Uma WABA recém-criada por coexistência tem **um** número, que é o do celular
 * do cliente. Devolvemos a lista mesmo assim, e quem chama decide: com mais de
 * um, escolher por conta própria seria chutar de qual número é a conexão.
 */
export async function numerosDaWaba(
  wabaId: string,
  token: string,
): Promise<{ id: string; telefone: string | null }[]> {
  const url = `https://graph.facebook.com/${versaoGraph()}/${wabaId}/phone_numbers?fields=id,display_phone_number`
  const lido = numerosDaWabaSchema.parse(
    await pedir(url, { headers: { Authorization: `Bearer ${token}` } }),
  )
  return lido.data.map((n) => ({ id: n.id, telefone: n.display_phone_number ?? null }))
}
