import type { Metadata } from 'next'
import { JetBrains_Mono, Outfit } from 'next/font/google'
import type { ReactNode } from 'react'
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
    <html lang="pt-BR" className={`${outfit.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
