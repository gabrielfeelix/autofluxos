import type { MetadataRoute } from 'next'

/**
 * Quatro páginas, e são as que existem para o público: a landing e os três
 * documentos que a Meta exige em Configurações Básicas — política de
 * privacidade, termos de serviço e instruções de exclusão de dados. O resto do
 * produto é painel autenticado e está proibido no `robots.ts`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://autofluxos.4yu.com.br'

  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/privacidade`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/termos`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/exclusao-de-dados`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
