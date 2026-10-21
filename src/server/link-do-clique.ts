import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { ValoresDoTemplate } from '@/channels/types'
import { ENDERECO_DO_CLIQUE, indiceDoBotaoContado, type Botao } from '@/core/templates'

/**
 * O clique no link de uma transmissão, contado (0139).
 *
 * O botão do modelo aponta para `ENDERECO_DO_CLIQUE` com um código no fim.
 * O código diz **qual modelo** (para achar o destino guardado no botão) e,
 * quando veio de uma transmissão, **qual destinatário** (para anotar quem
 * clicou). Fora de transmissão, numa sequência ou numa retomada, o código vai
 * sem destinatário: o clique só redireciona.
 *
 * **Assinado**, pelo mesmo motivo do link de produto: sem assinatura, o nosso
 * domínio redirecionaria para onde qualquer um quisesse, e serviria de
 * fachada para golpe. Aqui o destino nem viaja no código, mora no modelo, e a
 * assinatura impede que alguém anote clique em destinatário dos outros.
 */

type Conteudo = { t: string; d?: string }

function segredo(): string | null {
  return process.env.BETTER_AUTH_SECRET ?? null
}

function assinar(corpo: string, chave: string): string {
  return createHmac('sha256', `clique:${chave}`).update(corpo).digest('base64url').slice(0, 22)
}

/**
 * O código que vai no fim do link.
 *
 * Sem segredo no ambiente, sai sem assinatura: o clique ainda redireciona
 * para o destino do modelo, só não é contado.
 */
export function codigoDoClique(templateId: string, destinatarioId?: string | null): string {
  const conteudo: Conteudo = destinatarioId ? { t: templateId, d: destinatarioId } : { t: templateId }
  const corpo = Buffer.from(JSON.stringify(conteudo)).toString('base64url')
  const chave = segredo()
  return chave ? `${corpo}.${assinar(corpo, chave)}` : corpo
}

/**
 * O que o código diz, e se a assinatura bate.
 *
 * O modelo vale mesmo sem assinatura: o destino mora nele, escrito pela conta,
 * então quem forjar um código só chega a uma página que a própria conta
 * escolheu. Só a anotação do clique exige a assinatura.
 */
export function lerCodigoDoClique(codigo: string): { conteudo: Conteudo; assinado: boolean } | null {
  const [corpo, assinatura] = codigo.split('.')
  if (!corpo) return null
  let conteudo: Conteudo
  try {
    conteudo = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Conteudo
  } catch {
    return null
  }
  if (typeof conteudo?.t !== 'string') return null

  const chave = segredo()
  if (!chave || !assinatura) return { conteudo, assinado: false }
  const esperada = Buffer.from(assinar(corpo, chave))
  const recebida = Buffer.from(assinatura)
  return { conteudo, assinado: esperada.length === recebida.length && timingSafeEqual(esperada, recebida) }
}

/** O link completo de um clique contado, para a mensagem comum na janela. */
export function linkDoClique(templateId: string, destinatarioId?: string | null): string {
  return `${ENDERECO_DO_CLIQUE}${codigoDoClique(templateId, destinatarioId)}`
}

/**
 * Os valores do modelo com o código do botão que conta cliques.
 *
 * Todo envio de modelo passa por aqui: o botão contado tem uma lacuna que a
 * Meta exige preencher, e quem esquecer leva 132000. Modelo sem esse botão
 * volta como entrou.
 */
export function comCodigoDoClique(
  valores: ValoresDoTemplate | undefined,
  template: { id: string; componentes: { botoes?: Botao[] } | null },
  destinatarioId?: string | null,
): ValoresDoTemplate | undefined {
  const indice = indiceDoBotaoContado(template.componentes)
  if (indice === null) return valores
  return { ...(valores ?? {}), botoes: [{ indice, texto: codigoDoClique(template.id, destinatarioId) }] }
}

/** O pedido de envio inteiro com o código do clique, para quem monta `{ nome, idioma, valores }`. */
export function modeloComClique<T extends { valores?: ValoresDoTemplate }>(
  envio: T,
  template: { id: string; componentes: { botoes?: Botao[] } | null },
  destinatarioId?: string | null,
): T {
  const valores = comCodigoDoClique(envio.valores, template, destinatarioId)
  return valores === envio.valores ? envio : { ...envio, valores }
}
