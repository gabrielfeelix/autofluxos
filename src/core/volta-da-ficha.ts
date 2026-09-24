/**
 * O "voltar" da ficha, e a aba em que ela abre (8.5, X07).
 *
 * A ficha é aberta de muitos lugares (Inbox, agenda, funil, transmissão) e o
 * botão dizia sempre "← Contatos": quem vinha da conversa perdia o caminho de
 * volta. Quem chama passa `?volta=<endereço>`, e aqui ele é conferido antes de
 * virar link.
 *
 * **Só endereço interno desta conta.** `volta` chega pela URL, então é dado de
 * fora: `https://outro.site`, `//outro.site` ou `/clientes/<outra>/...` virariam
 * um redirecionamento aberto ou um link para a conta de outra pessoa. Qualquer
 * coisa que não comece com `/clientes/<esta conta>/` é descartada, e a ficha
 * volta para Contatos como antes.
 */

export const ABAS_DA_FICHA = ['visao', 'atividades', 'historico', 'dados', 'conversa'] as const
export type AbaDaFicha = (typeof ABAS_DA_FICHA)[number]

export function abaDaFicha(bruto: unknown): AbaDaFicha {
  return ABAS_DA_FICHA.includes(bruto as AbaDaFicha) ? (bruto as AbaDaFicha) : 'visao'
}

const ROTULO_DA_SECAO: Record<string, string> = {
  inbox: 'Inbox',
  atividades: 'Atividades',
  quadros: 'Funil',
  leads: 'Contatos',
  transmissoes: 'Transmissões',
  respostas: 'Respostas',
  favoritas: 'Favoritas',
  relatorios: 'Relatórios',
}

/**
 * `bruto` como endereço de volta, se for desta conta; senão `null`. A mesma
 * regra vale para a ficha e para o editor de automação.
 */
export function voltaInterna(bruto: unknown, clienteId: string): string | null {
  if (typeof bruto !== 'string' || bruto.length > 2000) return null
  const base = `/clientes/${clienteId}`
  // Barra invertida e caractere de controle: o navegador normaliza `\` para `/`,
  // e `/clientes/x/\outro.site` viraria `//outro.site`.
  if (bruto.includes('\\') || [...bruto].some((letra) => letra.charCodeAt(0) < 32)) return null
  if (bruto !== base && !bruto.startsWith(`${base}/`) && !bruto.startsWith(`${base}?`)) return null
  if (bruto.includes('//')) return null
  return bruto
}

export function voltaDaFicha(
  bruto: unknown,
  clienteId: string,
): { href: string; rotulo: string } {
  const padrao = { href: `/clientes/${clienteId}/leads`, rotulo: 'Contatos' }
  const href = voltaInterna(bruto, clienteId)
  if (href === null) return padrao
  const base = `/clientes/${clienteId}`

  const secao = href.slice(base.length).replace(/^\//, '').split(/[/?#]/)[0] ?? ''
  const rotulo = secao === '' ? 'Início' : (ROTULO_DA_SECAO[secao] ?? 'Voltar')
  return { href, rotulo }
}

/** O endereço da ficha com a aba e o caminho de volta, para quem abre ela. */
export function hrefDaFicha(
  clienteId: string,
  contatoId: string,
  { aba, volta }: { aba?: AbaDaFicha; volta?: string } = {},
): string {
  const p = new URLSearchParams()
  if (aba && aba !== 'visao') p.set('aba', aba)
  if (volta) p.set('volta', volta)
  const q = p.toString()
  return `/clientes/${clienteId}/leads/${contatoId}${q ? `?${q}` : ''}`
}
