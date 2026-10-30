import type { Metadata } from 'next'

const SITE = 'https://autofluxos.4yu.com.br'

/**
 * Os metadados das páginas do site. O painel inteiro é `noindex` pelo layout
 * raiz; estas são a exceção, existem para ser encontradas.
 */
export function metadadosDoSite(caminho: string, titulo: string, descricao: string): Metadata {
  return {
    title: titulo,
    description: descricao,
    robots: { index: true, follow: true },
    alternates: { canonical: `${SITE}${caminho}` },
    openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Dialogon', url: `${SITE}${caminho}`, title: titulo, description: descricao },
  }
}
