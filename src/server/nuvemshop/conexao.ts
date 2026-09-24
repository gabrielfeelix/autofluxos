import 'server-only'
import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { iguais } from '@/lib/segredo'
import { USER_AGENT, chamarNuvemshop } from '@/loja/nuvemshop'

/**
 * O app de parceiro da Nuvemshop: OAuth, troca do código e assinatura dos
 * webhooks. Fontes em `docs/INTEGRACAO-MAGENTO-23-SET.md`, seção Nuvemshop.
 *
 * `NUVEMSHOP_APP_ID` e `NUVEMSHOP_CLIENT_SECRET` vêm do app criado no portal
 * de parceiros (<https://partners.nuvemshop.com.br>). Sem os dois a conexão
 * não é oferecida: `nuvemshopConfigurado()` é o que a tela pergunta.
 *
 * Escopos pedidos no portal, não aqui (a Nuvemshop fixa no app): só leitura,
 * `read_products` e `read_orders`.
 */

const AUTORIZAR = 'https://www.nuvemshop.com.br/apps'
const TOKEN = 'https://www.nuvemshop.com.br/apps/authorize/token'

function credenciais(): { appId: string; segredo: string } {
  const appId = process.env.NUVEMSHOP_APP_ID?.trim()
  const segredo = process.env.NUVEMSHOP_CLIENT_SECRET?.trim()
  if (!appId || !segredo) throw new Error('falta NUVEMSHOP_APP_ID ou NUVEMSHOP_CLIENT_SECRET')
  return { appId, segredo }
}

export function nuvemshopConfigurado(): boolean {
  return Boolean(process.env.NUVEMSHOP_APP_ID?.trim() && process.env.NUVEMSHOP_CLIENT_SECRET?.trim())
}

/**
 * Para onde o lojista vai autorizar. O retorno é o cadastrado no app do
 * portal (`/api/loja/nuvemshop/retorno`); o `state` assinado volta junto e diz
 * qual conta começou.
 */
export function urlDeAutorizacao(state: string): string {
  const url = new URL(`${AUTORIZAR}/${encodeURIComponent(credenciais().appId)}/authorize`)
  url.searchParams.set('state', state)
  return url.toString()
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  // O id da loja. Número em umas respostas, texto em outras: aceita os dois.
  user_id: z.union([z.string(), z.number()]).transform(String),
  scope: z.string().optional(),
})

/** Troca o `code` (vale 5 minutos) pelo token, que não expira. */
export async function trocarCodigo(codigo: string): Promise<{ token: string; storeId: string; escopos: string[] }> {
  const { appId, segredo } = credenciais()
  const resposta = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ client_id: appId, client_secret: segredo, grant_type: 'authorization_code', code: codigo }),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  })
  // O corpo de erro não vai para a mensagem: pode ecoar o que foi enviado.
  if (!resposta.ok) throw new Error(`a Nuvemshop recusou o código (${resposta.status})`)
  const lido = tokenSchema.safeParse(await resposta.json().catch(() => null))
  if (!lido.success) throw new Error('a Nuvemshop respondeu sem token')
  if (!/^[0-9]{1,20}$/.test(lido.data.user_id)) throw new Error('a Nuvemshop respondeu um id de loja estranho')
  return {
    token: lido.data.access_token,
    storeId: lido.data.user_id,
    escopos: (lido.data.scope ?? '').split(',').map((e) => e.trim()).filter(Boolean),
  }
}

/**
 * O webhook veio da Nuvemshop? HMAC-SHA256 do corpo **cru** com o segredo do
 * app, no cabeçalho `x-linkedstore-hmac-sha256`. Compara em tempo constante.
 */
export function assinaturaValida(corpoCru: string, assinatura: string | null): boolean {
  if (!assinatura || !nuvemshopConfigurado()) return false
  const esperada = createHmac('sha256', credenciais().segredo).update(corpoCru).digest('hex')
  return iguais(assinatura.trim().toLowerCase(), esperada)
}

/**
 * Pede à loja o aviso de desinstalação. Sem ele, o lojista remove o app lá e a
 * conta continua marcada como conectada aqui, com o bot recebendo recusa.
 * Os de pedido e carrinho são da F5.
 */
export async function assinarDesinstalacao(dados: { storeId: string; token: string }, origem: string): Promise<void> {
  const r = await chamarNuvemshop(dados, '/webhooks', fetch, {
    metodo: 'POST',
    corpo: { event: 'app/uninstalled', url: `${origem}/api/webhook/nuvemshop` },
  })
  if (!r.ok) throw new Error(r.motivo)
}
