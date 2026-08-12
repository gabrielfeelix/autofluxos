import type { NextConfig } from 'next'

/**
 * Cabeçalhos de segurança do painel.
 *
 * O que eles cobrem, e por que valem a pena numa base pequena:
 *
 * - **`frame-ancestors 'none'`** (com o `X-Frame-Options` para navegador
 *   antigo) fecha clickjacking. A tela de login e o botão de apagar credencial
 *   são exatamente o tipo de alvo que essa técnica procura: uma página de fora
 *   embute a nossa num iframe transparente e a pessoa clica sem ver onde.
 * - **`nosniff`** impede o navegador de adivinhar o tipo de um arquivo. Sem
 *   ele, conteúdo que chega como texto pode acabar executado como script.
 * - **`Referrer-Policy`** evita mandar a URL inteira para fora — e as nossas
 *   carregam id de cliente e de contato no caminho.
 * - **`Permissions-Policy`** desliga câmera, microfone e localização, que este
 *   painel nunca usa. É gratuito e fecha a porta antes de alguém abri-la.
 *
 * Não há CSP completa de propósito: o Next injeta script inline e uma política
 * escrita no chute quebraria a hidratação da página inteira. `frame-ancestors`
 * é a parte que dá para afirmar sem risco; a CSP inteira é tarefa própria, com
 * nonce, quando alguém puder testá-la de verdade.
 */
const cabecalhos = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const config: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: cabecalhos }]
  },
}

export default config
