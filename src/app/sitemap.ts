import type { MetadataRoute } from 'next'

/**
 * Duas páginas, e são as duas que existem para o público: a landing e a
 * política de privacidade. O resto do produto é painel autenticado e está
 * proibido no `robots.ts`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://autofluxos.4yu.com.br'

  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/privacidade`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
