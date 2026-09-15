import type { Metadata } from 'next'
import { JetBrains_Mono, Outfit } from 'next/font/google'
import type { ReactNode } from 'react'
import { SCRIPT_DAS_PREFERENCIAS } from '@/components/design/tema'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
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
      className={`${outfit.variable} ${jetBrainsMono.variable}`}
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
