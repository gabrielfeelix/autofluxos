import type { ReactNode } from 'react'

/**
 * As peças de dentro de um menu suspenso. O painel é o `PopoverDoQuadro`
 * (`.quadro-popover`), e estas são o que vai nele: grupo com título, item,
 * item com marca, divisória.
 *
 * Cada menu escrevia as suas: o de Filtros tinha o respiro que o dono aprovou
 * e o de Colunas, grudado no topo e nas laterais, outro rótulo e outra caixa.
 * Agora os dois (e os próximos) são feitos destas.
 */
export function GrupoDoMenu({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={titulo} className="menu-grupo">
      {titulo && <p className="quadro-menu-label">{titulo}</p>}
      {children}
    </div>
  )
}

/**
 * Item que escolhe e fecha o menu. `ativo` desenha o ✓ à direita;
 * `contagem` é o número discreto antes dele.
 */
export function ItemDoMenu({
  ativo,
  contagem,
  aoEscolher,
  fecha = true,
  children,
}: {
  ativo?: boolean
  contagem?: number
  aoEscolher: () => void
  /** `false` para o menu ficar aberto depois do clique. */
  fecha?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      data-fechar-popover={fecha ? '' : undefined}
      aria-pressed={ativo}
      onClick={aoEscolher}
      className="quadro-menu-item"
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {contagem !== undefined && <span className="text-[11px] text-dim tabular-nums">{contagem}</span>}
      {ativo && <span className="text-primary">✓</span>}
    </button>
  )
}

/** Item com caixa de marcar, que não fecha o menu (ligar várias colunas seguidas). */
export function ItemMarcavel({
  marcado,
  aoAlternar,
  children,
}: {
  marcado: boolean
  aoAlternar: () => void
  children: ReactNode
}) {
  return (
    <label className="quadro-menu-item">
      <input type="checkbox" checked={marcado} onChange={aoAlternar} className="caixa-de-marcar" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </label>
  )
}

export function DivisoriaDoMenu() {
  return <hr className="my-1 border-line" />
}
