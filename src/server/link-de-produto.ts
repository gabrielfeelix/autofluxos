import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { CanalId } from '@/core/canais'
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

/** Quem mandou o link: o robô ou uma pessoa pelo Inbox. */
export type MeioDoLink = 'chatbot' | 'atendimento'

/**
 * O destino com as UTMs, para a ferramenta de análise da loja (GA4 e afins)
 * separar a venda que veio do atendimento automático.
 *
 * `utm_source` é o canal, `utm_medium` é `chatbot` (o robô) ou
 * `atendimento` (uma pessoa mandou pelo Inbox) e `utm_campaign` é
 * `autofluxos`: são os três que o GA4 lê sozinho para montar "origem/mídia".
 * UTM que a loja ou a campanha já tiver no link fica como está; sobrescrever
 * apagaria a atribuição de quem escreveu primeiro.
 */
/**
 * Quem mandou, legível no relatório e único no banco: `ana-souza-3f9a1c2e`.
 * Só o nome trocaria de dono quando duas Anas atendem; só o id seria um
 * código que ninguém lê na tela do GA4.
 */
export function quemNaUtm(usuario: { id: string; nome: string }): string {
  const nome = usuario.nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
  return `${nome || 'atendente'}-${usuario.id.replace(/-/g, '').slice(0, 8)}`
}

export function comUtm(
  link: string,
  origem: CanalId,
  meio: MeioDoLink = 'chatbot',
  quem?: { id: string; nome: string },
): string {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return link
  }
  const utms: [string, string][] = [
    ['utm_source', origem],
    ['utm_medium', meio],
    ['utm_campaign', 'autofluxos'],
    // Quem mandou: o robô, ou a pessoa que atendeu. É o que responde "quanto
    // vendeu cada atendente" na análise da loja.
    ['utm_content', quem ? quemNaUtm(quem) : 'robo'],
  ]
  for (const [nome, valor] of utms) if (!url.searchParams.has(nome)) url.searchParams.set(nome, valor)
  return url.toString()
}

/** O produto com o link trocado pelo nosso. Sem segredo, só ganha as UTMs. */
export function comLinkRastreado(
  produto: ProdutoDaLoja,
  contato: { id: string; clienteId: string },
  origem: CanalId = 'whatsapp',
  meio: MeioDoLink = 'chatbot',
  quem?: { id: string; nome: string },
): ProdutoDaLoja {
  if (!/^https?:\/\//.test(produto.link)) return produto
  const destino = comUtm(produto.link, origem, meio, quem)
  const chave = segredo()
  if (!chave) return { ...produto, link: destino }
  const conteudo: Conteudo = { k: contato.clienteId, c: contato.id, u: destino, n: produto.nome.slice(0, 120) }
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
