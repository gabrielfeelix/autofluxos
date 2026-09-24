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

export function voltaDaFicha(
  bruto: unknown,
  clienteId: string,
): { href: string; rotulo: string } {
  const padrao = { href: `/clientes/${clienteId}/leads`, rotulo: 'Contatos' }
  if (typeof bruto !== 'string' || bruto.length > 2000) return padrao

  const base = `/clientes/${clienteId}`
  // Barra invertida e caractere de controle: o navegador normaliza `\` para `/`,
  // e `/clientes/x/\outro.site` viraria `//outro.site`.
  if (bruto.includes('\\') || [...bruto].some((letra) => letra.charCodeAt(0) < 32)) return padrao
  if (bruto !== base && !bruto.startsWith(`${base}/`) && !bruto.startsWith(`${base}?`)) return padrao
  if (bruto.includes('//')) return padrao

  const secao = bruto.slice(base.length).replace(/^\//, '').split(/[/?#]/)[0] ?? ''
  const rotulo = secao === '' ? 'Início' : (ROTULO_DA_SECAO[secao] ?? 'Voltar')
  return { href: bruto, rotulo }
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
