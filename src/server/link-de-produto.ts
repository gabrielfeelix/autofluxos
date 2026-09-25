import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { ProdutoDaLoja } from '@/core/loja'

/**
 * O "Ver produto" passando por nós, para a conta saber o que a pessoa abriu.
 *
 * O botão do card é um link para a loja, e clique em link não volta para
 * ninguém: nem o WhatsApp nem o navegador avisam. Então o link aponta para
 * `/api/site/produto/<token>`, que anota o clique na linha do tempo do
 * contato e redireciona na hora. No chat nada muda: a pessoa não vê
 * mensagem nenhuma, e quem atende vê "abriu o produto X" no histórico.
 *
 * **Assinado, e é o ponto.** Sem a assinatura, qualquer um montaria um link
 * `autofluxos.4yu.com.br/...` que redireciona para onde quiser, e usaria o
 * nosso domínio para dar credibilidade a golpe. O token só vale com o destino
 * que nós mesmos escrevemos.
 */

const BASE = 'https://autofluxos.4yu.com.br/api/site/produto/'

type Conteudo = { k: string; c: string; u: string; n: string }

function segredo(): string | null {
  return process.env.BETTER_AUTH_SECRET ?? null
}

function assinar(corpo: string, chave: string): string {
  return createHmac('sha256', `link-de-produto:${chave}`).update(corpo).digest('base64url')
}

/** O produto com o link trocado pelo nosso. Sem segredo ou sem link, sai igual. */
export function comLinkRastreado(
  produto: ProdutoDaLoja,
  contato: { id: string; clienteId: string },
): ProdutoDaLoja {
  const chave = segredo()
  if (!chave || !/^https?:\/\//.test(produto.link)) return produto
  const conteudo: Conteudo = { k: contato.clienteId, c: contato.id, u: produto.link, n: produto.nome.slice(0, 120) }
  const corpo = Buffer.from(JSON.stringify(conteudo)).toString('base64url')
  return { ...produto, link: `${BASE}${corpo}.${assinar(corpo, chave)}` }
}

/** O que o token diz, ou `null` se a assinatura não bate. */
export function lerLinkRastreado(token: string): Conteudo | null {
  const chave = segredo()
  const [corpo, assinatura] = token.split('.')
  if (!chave || !corpo || !assinatura) return null
  const esperada = Buffer.from(assinar(corpo, chave))
  const recebida = Buffer.from(assinatura)
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null
  try {
    const c = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Conteudo
    return typeof c.u === 'string' && /^https?:\/\//.test(c.u) ? c : null
  } catch {
    return null
  }
}
