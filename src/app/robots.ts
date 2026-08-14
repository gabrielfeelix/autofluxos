import type { MetadataRoute } from 'next'

/** O painel é autenticado e não deve aparecer em mecanismos de busca. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } }
}
