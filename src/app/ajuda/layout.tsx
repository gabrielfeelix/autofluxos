import type { ReactNode } from 'react'

/**
 * A central de ajuda e a documentação moram na casca, como o resto da conta:
 * fundo azul com os fios, cabeçalho em vidro (cada página escolhe a área
 * ativa) e o conteúdo num quadro branco por cima.
 *
 * Fica atrás do login, como o painel: ela fala de contas, credenciais e do
 * sistema do cliente pelo nome.
 */
export default function LayoutDaAjuda({ children }: { children: ReactNode }) {
  return <div className="app-casca min-h-screen pb-3 md:pb-6">{children}</div>
}
