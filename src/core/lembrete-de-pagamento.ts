import { z } from 'zod'
import type { Componentes } from './templates'

/**
 * Lembrete de pagamento pendente (0162).
 *
 * O pedido que nasce na Magento e fica "pending" é quase sempre gente que foi
 * ao Mercado Pago (ou gerou o Pix, o boleto) e não pagou. A passada dos
 * pedidos, a cada 10 minutos, procura os que **continuam** pendentes depois da
 * espera e manda um modelo com a foto do produto, um botão para a página dele
 * e, se a loja quiser, um cupom com "Copiar código".
 *
 * Nasceu do envio feito à mão para três pedidos da PCYES em 04/nov/2026. O
 * texto é o que o Gabriel aprovou naquele dia, com "O pedido de {{2}}" no
 * lugar de "Seu {{2}}", que errava o gênero ("Seu Cadeira").
 *
 * O cupom e o desconto são variáveis, e o código do "Copiar código" vai no
 * envio: trocar de cupom não pede outra aprovação da Meta.
 */

export const MODELO_COM_CUPOM = 'pagamento_pendente_cupom'
export const MODELO_SEM_CUPOM = 'pagamento_pendente'

/** O status que trava "uma vez por pedido" em `status_de_pedido_avisados`. */
export const STATUS_DO_LEMBRETE = 'lembrete_pagamento'

/** Quanto esperar antes de lembrar. Menos de 1h pega quem ainda está pagando. */
export const ESPERAS_EM_HORAS = [1, 2, 6, 12, 24] as const

/** Pedido pendente mais velho que isto não recebe lembrete: o link de pagamento já venceu. */
export const IDADE_MAXIMA_EM_HORAS = 48

export type LembreteDePagamento = {
  ativo: boolean
  esperaHoras: number
  /** O código do cupom, ou `null` para lembrar sem cupom. */
  cupom: string | null
  /** O desconto do cupom, como a loja o descreve ("10% de desconto"). Vai no texto. */
  desconto: string | null
  /** Só manda para quem marcou o aceite (`aceita_whatsapp` no cadastro da loja). */
  exigirAceite: boolean
}

export const LEMBRETE_PADRAO: LembreteDePagamento = {
  ativo: false,
  esperaHoras: 2,
  cupom: null,
  desconto: null,
  exigirAceite: true,
}

const esquema = z.object({
  ativo: z.boolean(),
  esperaHoras: z.number().int().refine((h) => (ESPERAS_EM_HORAS as readonly number[]).includes(h)),
  cupom: z
    .string()
    .trim()
    .regex(/^[\w-]{1,40}$/)
    .nullable(),
  desconto: z.string().trim().max(60).nullable(),
  exigirAceite: z.boolean(),
})

/** O que veio do banco; o que não confere vira o padrão (desligado). */
export function lerLembrete(bruto: unknown): LembreteDePagamento {
  const r = esquema.safeParse(bruto)
  return r.success ? r.data : LEMBRETE_PADRAO
}

export function validarLembrete(bruto: unknown): { ok: true; valor: LembreteDePagamento } | { ok: false; motivo: string } {
  const r = esquema.safeParse(bruto)
  if (!r.success) return { ok: false, motivo: 'Confira a espera e o cupom escolhidos.' }
  if (r.data.cupom && !r.data.desconto) return { ok: false, motivo: 'O cupom escolhido não tem desconto descrito.' }
  return { ok: true, valor: r.data }
}

/** O modelo que este lembrete usa. */
export function modeloDoLembrete(config: Pick<LembreteDePagamento, 'cupom'>): string {
  return config.cupom ? MODELO_COM_CUPOM : MODELO_SEM_CUPOM
}

const SAIR = 'Para não receber promoções, responda SAIR.'
const ABERTURA = 'Fala, {{1}}! 🎮\n\nO pedido de *{{2}}* ficou esperando o pagamento. Ainda dá tempo de completar o setup! 🕹️'
const DUVIDA = 'Ficou alguma dúvida? Chama aqui que a gente responde. 💬'

/** O botão da página do produto: o fim (`url_key` + sufixo) vem no envio. */
function botaoDoProduto(endereco: string) {
  return { tipo: 'URL' as const, texto: 'Ver produto', valor: `${endereco.trim().replace(/\/+$/, '')}/{{1}}` }
}

export type ModeloDoLembrete = {
  nome: string
  categoria: 'MARKETING' | 'UTILITY'
  componentes: Componentes
  exemplos: string[]
}

/**
 * Os dois modelos. O com cupom é marketing (oferta); o sem cupom é lembrete do
 * próprio pedido, utilidade, que custa menos e não oferece nada.
 */
export function modelosDoLembrete(loja: { endereco: string; foto: string }): ModeloDoLembrete[] {
  return [
    {
      nome: MODELO_COM_CUPOM,
      categoria: 'MARKETING',
      componentes: {
        cabecalho: { tipo: 'imagem', url: loja.foto },
        corpo: `${ABERTURA}\n\nLiberamos *{{3}}* pra você: refaça o pedido no site e aplique o cupom *{{4}}* no carrinho.\n\n${DUVIDA}`,
        rodape: SAIR,
        botoes: [{ tipo: 'COPY_CODE', texto: 'Copiar código', valor: 'CUPOM10' }, botaoDoProduto(loja.endereco)],
      },
      exemplos: ['Maria', 'Monitor Gamer 27"', '10% de desconto', 'CUPOM10'],
    },
    {
      nome: MODELO_SEM_CUPOM,
      categoria: 'UTILITY',
      componentes: {
        cabecalho: { tipo: 'imagem', url: loja.foto },
        corpo: 'Oi, {{1}}! O pagamento do seu pedido de *{{2}}* ainda não foi confirmado.\n\nSe quiser concluir, é só finalizar pelo site. Ficou alguma dúvida? Responda esta mensagem.',
        botoes: [botaoDoProduto(loja.endereco)],
      },
      exemplos: ['Maria', 'Monitor Gamer 27"'],
    },
  ]
}

/**
 * O nome do produto que cabe numa frase. A Magento guarda o título do anúncio
 * ("Cadeira Ergonômica de Massagem Sublime Backrobo Branca com Aquecimento e
 * App PCYes"); corta na palavra, até `limite` caracteres.
 */
export function nomeCurto(nome: string, limite = 48): string {
  const limpo = nome.replace(/\s+/g, ' ').trim()
  if (limpo.length <= limite) return limpo
  const corte = limpo.slice(0, limite + 1).replace(/\s+\S*$/, '')
  return (corte || limpo.slice(0, limite)).replace(/[\s,;:.\-–]+$/, '')
}

/** O primeiro nome, com a inicial maiúscula ("weliton" vira "Weliton"). */
export function primeiroNome(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? ''
  return primeiro ? primeiro.charAt(0).toLocaleUpperCase('pt-BR') + primeiro.slice(1).toLocaleLowerCase('pt-BR') : ''
}

/**
 * A foto do produto em endereço completo. Na PCYES a galeria já guarda a URL
 * do CDN; na Magento padrão é um caminho em `/media/catalog/product`.
 */
export function fotoDoProduto(endereco: string, arquivo: string): string | null {
  const a = arquivo.trim()
  if (!a) return null
  if (/^https:\/\//.test(a)) return a
  if (/^https?:\/\//.test(a)) return null
  return `${endereco.trim().replace(/\/+$/, '')}/media/catalog/product/${a.replace(/^\/+/, '')}`
}

/** Instante limite da Magento (`AAAA-MM-DD hh:mm:ss`, UTC) a `horas` de `agora`. */
export function horasAtras(agora: Date, horas: number): string {
  return new Date(agora.getTime() - horas * 3600_000).toISOString().slice(0, 19).replace('T', ' ')
}
