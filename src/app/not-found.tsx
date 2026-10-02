import Link from 'next/link'

/**
 * Endereço que não existe.
 *
 * Vale mais do que parece: os endereços do painel carregam id de cliente e de
 * fluxo, então "não encontrado" quase nunca é erro de digitação, é link velho
 * de algo que foi apagado. Dizer isso poupa a pessoa de procurar o que não
 * existe mais.
 */
export default function NaoEncontrado() {
  return (
    <main className="app-casca flex min-h-screen items-center justify-center p-4 text-center">
      <div className="app-page-enter w-full max-w-[420px] rounded-[24px] bg-panel px-7 py-10 text-ink shadow-[var(--sombra-ilha)] md:px-10">
      <p className="text-[56px] leading-none font-bold tracking-[-0.04em] text-primary">404</p>
      <h1 className="mt-4 text-[21px] font-bold tracking-[-0.02em]">Não achei esta página.</h1>
      <p className="mt-2 mb-6 text-[14px] leading-[1.6] text-muted">
        O endereço pode estar errado, ou apontar para algo que foi apagado.
      </p>
      <Link href="/voltar" className="botao-secundario botao-md">
        Voltar para o início
      </Link>
      </div>
    </main>
  )
}
