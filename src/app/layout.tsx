import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Outfit } from 'next/font/google'
import type { ReactNode } from 'react'
import { SCRIPT_DAS_PREFERENCIAS } from '@/components/design/tema'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

/**
 * A fonte de **texto**, e só dentro da conversa.
 *
 * A Outfit é uma geométrica de display: desenhada para título, com traço de
 * espessura uniforme e aberturas fechadas. Em corpo pequeno e parágrafo corrido
 * ela força a vista, e a conversa é o único lugar do painel onde se lê texto de
 * verdade, escrito por outra pessoa, o dia inteiro.
 *
 * A Inter foi desenhada exatamente para isso: altura de x grande, aberturas
 * abertas, `1`/`l`/`I` distinguíveis. É o que metade dos produtos de chat já usa
 * pela pilha do sistema — carregá-la explicitamente só torna previsível o que
 * hoje depende do sistema operacional de quem olha.
 *
 * **A casca continua Outfit** — barra lateral, títulos, botões, pílulas. É ela
 * que dá cara ao produto, e trocar a fonte global faria o produto perder a cara
 * para resolver um problema que é só da bolha.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AutoFluxos — atendimento desenhado bloco a bloco',
  description: 'Automação visual de atendimento no WhatsApp.',
  // O padrão é não indexar: o painel inteiro é privado e não tem nada a fazer
  // num buscador. A landing em `/` sobrescreve isso — ela existe justamente
  // para ser encontrada.
  robots: { index: false, follow: false },
  metadataBase: new URL('https://autofluxos.4yu.com.br'),
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    /*
      `suppressHydrationWarning` porque o `data-theme` é posto pelo script
      abaixo, antes do React existir: o HTML que o servidor mandou e o que o
      navegador tem na hora da hidratação diferem nesse atributo, de propósito.
      Ele silencia só este elemento — nenhum filho herda a permissão.
    */
    <html
      lang="pt-BR"
      className={`${outfit.variable} ${inter.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Tema e barra lateral antes da primeira pintura. Ver
          `SCRIPT_DAS_PREFERENCIAS`: sem ele, quem escolheu escuro leva um
          quadro branco na cara a cada navegação, e a barra pisca de largura.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DAS_PREFERENCIAS }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
