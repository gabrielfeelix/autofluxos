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

  /**
   * O teto do corpo de uma Server Action.
   *
   * **O padrão do Next é 1 MB, e ele não avisa: devolve 413 antes de qualquer
   * código nosso rodar.** O que a pessoa vê é a página de erro genérica, sem
   * motivo nenhum — foi assim que a importação de planilha e o envio de arquivo
   * falhavam calados em tudo acima de um mega.
   *
   * 4 MB porque é o que a plataforma permite: a Vercel corta o corpo de uma
   * função em ~4,5 MB, e pedir mais aqui só trocaria o erro do framework pelo
   * erro dela. Uma planilha de 4 MB é da ordem de dezenas de milhares de
   * contatos — cobre a importação real com folga.
   *
   * **Arquivo de mídia não depende disto e não deve voltar a depender.** Ele
   * sobe direto do navegador para o Storage por URL assinada
   * (`repos/acervo.ts`), onde o teto é o do bucket: 16 MB, o da própria Cloud
   * API. A logo continua passando por aqui porque o limite dela é 512 KB, bem
   * abaixo de qualquer um destes números.
   */
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
}

export default config
