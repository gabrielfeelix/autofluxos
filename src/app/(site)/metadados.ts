import type { Metadata } from 'next'

/** O endereço do site, num lugar só: metadataBase, canonical, OG, sitemap, robots e JSON-LD saem daqui. */
export const SITE_URL = 'https://dialogon.com.br'

/**
 * Os metadados das páginas do site. O painel inteiro é `noindex` pelo layout
 * raiz; estas são a exceção, existem para ser encontradas.
 */
export function metadadosDoSite(caminho: string, titulo: string, descricao: string): Metadata {
  return {
    title: titulo,
    description: descricao,
    robots: { index: true, follow: true },
    alternates: { canonical: `${SITE_URL}${caminho}` },
    openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Dialogon', url: `${SITE_URL}${caminho}`, title: titulo, description: descricao },
  }
}
