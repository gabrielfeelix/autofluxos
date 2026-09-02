import Link from 'next/link'

/**
 * Endereço que não existe.
 *
 * Vale mais do que parece: os endereços do painel carregam id de cliente e de
 * fluxo, então "não encontrado" quase nunca é erro de digitação — é link velho
 * de algo que foi apagado. Dizer isso poupa a pessoa de procurar o que não
 * existe mais.
 */
export default function NaoEncontrado() {
  return (
    <main className="flex min-h-screen items-center justify-center p-10 text-center">
      <div className="app-page-enter max-w-[380px]">
      <p className="mb-3.5 font-mono text-[11px] tracking-[0.22em] text-dim">404 · NÃO ENCONTRADO</p>
      <h1 className="text-[19px] font-bold">Não achei esta página.</h1>
      <p className="mt-2 mb-[22px] text-[12.5px] leading-[1.65] text-muted">
        O endereço pode estar errado, ou apontar para algo que foi apagado.
      </p>
      <Link
        href="/painel"
        className="app-secondary-button inline-block px-5 py-2.5 text-[13px]"
      >
        Voltar para os clientes
      </Link>
      </div>
    </main>
  )
}
