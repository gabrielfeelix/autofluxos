import type { ReactNode } from 'react'
import { ClienteShell } from './cliente-shell'
import { MenuDeAjustes, type TelaDeAjustes } from './menu-de-ajustes'
import type { Cliente } from '@/server/repos/clientes'

/**
 * A moldura de todas as telas de Configurações.
 *
 * Duas barras: a global e a da seção, com os quatro grupos. O porquê da
 * segunda está em `menu-de-ajustes.tsx` e em `docs/PLANO-UI-CONFIGURACOES.md`.
 *
 * **A global não encolhe mais ao entrar aqui.** Ela encolhia por decisão de
 * tela, para que duas colunas de texto não competissem — e o efeito era a barra
 * inteira saltar de 226px para 68px no clique de Configurações, desfazendo na
 * cara da pessoa a largura que ela mesma tinha escolhido. Largura de barra é
 * preferência de quem trabalha, guardada em `data-barra`; nenhuma tela a
 * sobrescreve. Quem quiser as duas estreitas recolhe a global uma vez, e ela
 * fica recolhida em toda parte.
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
    <ClienteShell cliente={cliente} ativa="ajustes">
      <div className="flex min-h-full flex-col md:flex-row">
        <MenuDeAjustes clienteId={cliente.id} ativa={ativa} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ClienteShell>
  )
}
