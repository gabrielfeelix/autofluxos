/**
 * O endereço de quem escreve pelo chat do site.
 *
 * `contacts.wa_id` é "o endereço de quem escreve neste canal": telefone no
 * WhatsApp, IGSID no Instagram, BSUID quando o WhatsApp esconde o número. O
 * visitante do site não tem nenhum dos três, tem um segredo aleatório que o
 * navegador dele gerou e guardou. O endereço é `site:` mais o hash desse
 * segredo, nunca o segredo em si: quem lê o banco não consegue se passar pelo
 * visitante, e quem tem o segredo só alcança a própria conversa.
 *
 * O prefixo é o que impede o endereço de ser lido como telefone. Sem ele, um
 * hash que começasse com dígitos cairia em `telefone_br`, na consulta de pedido
 * por telefone e na lista de transmissão, três lugares onde um número falso é
 * pior que nenhum.
 */
export const PREFIXO_DO_SITE = 'site:'

export function ehVisitanteDoSite(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && valor.startsWith(PREFIXO_DO_SITE)
}
