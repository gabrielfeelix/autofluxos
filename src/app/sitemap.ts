import type { MetadataRoute } from 'next'
import { CANAIS } from './(site)/canais-do-site'
import { SITE_URL } from './(site)/metadados'
import { NICHOS_DO_SITE } from './(site)/nichos-do-site'
import { RECURSOS } from './(site)/recursos-do-site'

/**
 * As páginas que existem para o público: a landing e as páginas de produto,
 * canal, segmento, preço e integração. Privacidade, termos e exclusão de dados
 * ficam de fora de propósito: são `noindex`, e listar no sitemap uma URL que
 * pede para não ser indexada é contradição. A Meta só precisa que elas estejam
 * acessíveis. O resto do produto é painel autenticado e está proibido no
 * `robots.ts`.
 *
 * Sem `priority` nem `changeFrequency`: o Google ignora os dois. O
 * `lastModified` é a data do build, que é quando o conteúdo estático muda.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const caminhos = [
    '/',
    '/produto',
    '/precos',
    '/integracoes',
    ...RECURSOS.map((r) => `/produto/${r.slug}`),
    ...CANAIS.map((c) => `/canais/${c.slug}`),
    ...NICHOS_DO_SITE.map((n) => `/segmentos/${n.slug}`),
  ]

  return caminhos.map((caminho) => ({ url: `${SITE_URL}${caminho}`, lastModified }))
}
