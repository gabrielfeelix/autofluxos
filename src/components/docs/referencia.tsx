import type { ReactNode } from 'react'

/**
 * As peças de referência da API: selo do método, endereço, lista de campos e
 * respostas por status. Servidor, sem JavaScript: a sanfona é `<details>`.
 */

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const COR_DO_METODO: Record<Metodo, string> = {
  GET: 'bg-emerald-500/12 text-emerald-700 ring-emerald-600/20',
  POST: 'bg-blue-500/12 text-blue-700 ring-blue-600/20',
  PUT: 'bg-amber-500/14 text-amber-700 ring-amber-600/25',
  PATCH: 'bg-violet-500/12 text-violet-700 ring-violet-600/20',
  DELETE: 'bg-rose-500/12 text-rose-700 ring-rose-600/20',
}

/** O verbo HTTP em mono: é código, e quem lê a referência reconhece assim. */
export function SeloDeMetodo({ metodo, pequeno }: { metodo: Metodo; pequeno?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-mono font-semibold ring-1 ring-inset ${COR_DO_METODO[metodo]} ${
        pequeno ? 'h-[18px] min-w-[38px] px-1 text-[9.5px]' : 'h-6 px-2 text-[11.5px]'
      }`}
    >
      {metodo === 'DELETE' && pequeno ? 'DEL' : metodo}
    </span>
  )
}

/** O endereço do endpoint, com o método na frente. */
export function Endpoint({ metodo, caminho }: { metodo: Metodo; caminho: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
      <SeloDeMetodo metodo={metodo} />
      <code className="min-w-0 truncate font-mono text-[13px] text-soft">{caminho}</code>
    </div>
  )
}

export type Campo = {
  nome: string
  tipo: string
  obrigatorio?: boolean
  descricao: ReactNode
  filhos?: Campo[]
}

/** Os campos de um corpo ou de uma resposta, um por linha, com filhos recuados. */
export function ListaDeCampos({ titulo, campos }: { titulo?: string; campos: Campo[] }) {
  return (
    <div>
      {titulo && <h3 className="mb-3 text-[15px] font-semibold text-ink">{titulo}</h3>}
      <ul className="divide-y divide-line rounded-xl border border-line">
        {campos.map((campo) => (
          <LinhaDeCampo key={campo.nome} campo={campo} />
        ))}
      </ul>
    </div>
  )
}

function LinhaDeCampo({ campo }: { campo: Campo }) {
  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <code className="font-mono text-[13px] font-semibold text-ink">{campo.nome}</code>
        <span className="text-[12.5px] text-dim">{campo.tipo}</span>
        {campo.obrigatorio && <span className="text-[12px] font-medium text-rose-600">obrigatório</span>}
      </div>
      <div className="mt-1 text-[14px] leading-[1.6] text-muted">{campo.descricao}</div>
      {campo.filhos && campo.filhos.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {campo.filhos.map((filho) => (
            <LinhaDeCampo key={filho.nome} campo={filho} />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Uma resposta possível, fechada por padrão menos a de sucesso.
 *
 * `corpo` é o JSON que a rota devolve de verdade. Sem corpo e sem texto, a
 * linha não abre e não mostra a seta: uma sanfona que abre vazia parece
 * quebrada (foi o relato de 02/out na página Disparar um evento).
 */
export function Resposta({
  status,
  descricao,
  aberta,
  corpo,
  children,
}: {
  status: number
  descricao: string
  aberta?: boolean
  corpo?: string
  children?: ReactNode
}) {
  const ok = status < 300
  const ponto = <span aria-hidden className={`size-2 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : status < 500 ? 'bg-amber-500' : 'bg-rose-500'}`} />
  const rotulo = (
    <>
      {ponto}
      <span className="font-mono text-[13px] font-semibold text-ink">{status}</span>
      <span className="text-[14px] text-muted">{descricao}</span>
    </>
  )

  if (!children && !corpo) {
    return <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0">{rotulo}</div>
  }

  return (
    <details open={aberta} className="docs-resposta group border-b border-line last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        {rotulo}
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto shrink-0 text-dim transition-transform duration-200 group-open:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="space-y-3 px-4 pb-4 text-[14px] leading-[1.6] text-muted">
        {children}
        {corpo && (
          <pre className="overflow-x-auto rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-[12.5px] leading-5 text-soft">{corpo}</pre>
        )}
      </div>
    </details>
  )
}

export function Respostas({ children }: { children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[15px] font-semibold text-ink">Respostas</h3>
      <div className="rounded-xl border border-line">{children}</div>
    </div>
  )
}
