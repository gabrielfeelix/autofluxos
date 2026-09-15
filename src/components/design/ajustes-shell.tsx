import type { ReactNode } from 'react'
import { ClienteShell } from './cliente-shell'
import { MenuDeAjustes, type TelaDeAjustes } from './menu-de-ajustes'
import type { Cliente } from '@/server/repos/clientes'

/**
 * A moldura de todas as telas de Configurações.
 *
 * Duas barras: a global recolhida em ícones, e a da seção com os quatro grupos.
 * O porquê está em `menu-de-ajustes.tsx` e em `docs/PLANO-UI-CONFIGURACOES.md`.
 *
 * **Não desenha `<main>`.** Cada tela já traz o seu, com a largura que ela
 * precisa — a do índice é larga, a de um formulário é estreita —, e dois
 * `<main>` na mesma página é erro de marcação que leitor de tela cobra.
 */
export function AjustesShell({
  cliente,
  ativa,
  children,
}: {
  cliente: Cliente
  ativa: TelaDeAjustes
  children: ReactNode
}) {
  return (
    <ClienteShell cliente={cliente} ativa="ajustes" forcarRecolhida>
      <div className="flex min-h-full flex-col md:flex-row">
        <MenuDeAjustes clienteId={cliente.id} ativa={ativa} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ClienteShell>
  )
}
