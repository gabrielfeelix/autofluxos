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
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Não achei isso.</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        O cliente, o fluxo ou o lead deste endereço não existe — ou não é deste painel.
      </p>
      <Link
        href="/"
        className="mx-auto rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Voltar para os clientes
      </Link>
    </main>
  )
}
