import { telefoneLegivel } from './telefone'
import { ehVisitanteDoSite } from './visitante-do-site'

/**
 * O nome que a tela mostra para um contato.
 *
 * `nome_real` (o que a equipe corrigiu) ganha de `nome` (o do perfil, que a
 * própria pessoa muda). Sem nenhum dos dois, o endereço, **legível**: o
 * telefone formatado, ou "Visitante do site" no lugar do `site:4ec7f…` de 69
 * caracteres que enchia o cartão do funil e virava "Negócio de site:4ec7…".
 */
export function nomeParaMostrar(contato: {
  nomeReal?: string | null
  nome?: string | null
  waId?: string | null
}): string {
  const dado = (contato.nomeReal ?? '').trim() || (contato.nome ?? '').trim()
  if (dado) return dado
  const waId = contato.waId ?? ''
  if (ehVisitanteDoSite(waId)) return 'Visitante do site'
  return waId ? telefoneLegivel(waId) : ''
}
