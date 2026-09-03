import type { MetadataRoute } from 'next'

/**
 * O painel é autenticado e não deve aparecer em mecanismos de busca — mas a
 * **landing pública em `/` deve**, e é a única.
 *
 * Por isso a regra não é mais um `disallow: '/'` seco: ele proibiria também a
 * página que existe para ser encontrada. O `allow` mais específico vence o
 * `disallow` genérico nos rastreadores que seguem a especificação, e as rotas
 * do painel entram explicitamente para quem não segue.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/$', '/privacidade', '/termos', '/exclusao-de-dados'],
      disallow: [
        '/painel',
        '/admin',
        '/clientes',
        '/contas',
        '/entrar',
        '/criar-conta',
        '/ajuda',
        '/f/',
        '/api/',
      ],
    },
    sitemap: 'https://autofluxos.4yu.com.br/sitemap.xml',
  }
}
