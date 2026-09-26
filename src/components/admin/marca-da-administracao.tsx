import { Marca } from '@/components/design/marca'

/**
 * A marca com o selo "admin": quem está aqui sabe que não está numa organização.
 *
 * **O invólucro é `div`, não `span`.** Com a barra recolhida, `BarraLateral`
 * esconde todo `span` que é último filho, para sobrar só o símbolo. Um `span`
 * aqui era o último filho de lá e sumia inteiro, com a logo junto: a barra
 * recolhida da administração ficava sem marca nenhuma, nos dois temas.
 */
export function MarcaDaAdministracao() {
  return (
    <div className="flex items-center gap-2">
      <Marca />
      <span className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[9.5px] text-dim">admin</span>
    </div>
  )
}

/** A linha do topo, no lugar do seletor de organização do app. */
export function ContextoDaAdministracao() {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface/60 px-2.5 py-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-weak text-primary">
        <svg aria-hidden width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.5 1.4 12.6 3.4v3.8c0 3-2.2 5.2-5.1 6.4-2.9-1.2-5.1-3.4-5.1-6.4V3.4Z" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold">Administração</span>
        <span className="block truncate text-[11px] text-dim">Plataforma AutoFluxos</span>
      </span>
    </div>
  )
}
