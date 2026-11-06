import type { MetadataRoute } from 'next'
import { SITE_URL } from './(site)/metadados'

/**
 * O painel é autenticado e não deve aparecer em mecanismos de busca, mas a
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
      // Os rastreadores de IA entram pelo nome, no mesmo grupo do `*`: a regra é a
      // mesma, e o nome explícito diz que a porta está aberta para eles de
      // propósito, não por esquecimento.
      userAgent: [
        '*',
        'GPTBot',
        'OAI-SearchBot',
        'ChatGPT-User',
        'ClaudeBot',
        'Claude-SearchBot',
        'Claude-User',
        'PerplexityBot',
        'Perplexity-User',
        'Google-Extended',
        'Applebot-Extended',
        'Bingbot',
        'meta-externalagent',
        'Amazonbot',
        'DuckAssistBot',
        'MistralAI-User',
      ],
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
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
