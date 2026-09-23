/**
 * A linha acima do título de cada tela admin, dizendo o alcance dela (S10, E16).
 *
 * "Usuários" e "Auditoria" soltos não diziam se eram da plataforma ou de uma
 * conta, e para quem opera a 4YU a diferença é a pergunta inteira: mudar o
 * papel de alguém aqui não é mudar o papel dessa pessoa numa conta.
 */
export function EscopoDoAdmin({ children }: { children: string }) {
  return <p className="mb-1 text-[11px] font-bold tracking-[0.08em] text-dim uppercase">{children}</p>
}
