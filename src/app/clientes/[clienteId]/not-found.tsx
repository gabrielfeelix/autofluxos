import Link from 'next/link'

/**
 * "Não encontrado" dentro de um cliente.
 *
 * Cobre o cliente, o fluxo e o lead: os três chamam `notFound()` quando o id do
 * endereço não existe. A mensagem é mais específica do que a da raiz porque
 * aqui a causa provável é conhecida — id de outro ambiente, ou algo apagado.
 *
 * Quando existir login, este é também o lugar de "não é seu": o cliente que
 * tenta alcançar dado de outro cliente tem que ver exatamente isto, e nunca a
 * confirmação de que o id existe.
 */
export default function NaoEncontrado() {
  return (
    <main className="flex min-h-screen items-center justify-center p-10 text-center">
      <div className="app-page-enter max-w-[380px]">
      <p className="mb-3.5 font-mono text-[11px] tracking-[0.22em] text-dim">404 · NÃO ENCONTRADO</p>
      <h1 className="text-[19px] font-bold">Não achei isso.</h1>
      <p className="mt-2 mb-[22px] text-[12.5px] leading-[1.65] text-muted">
        O cliente, o fluxo ou o lead deste endereço não existe — ou não é deste painel.
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
