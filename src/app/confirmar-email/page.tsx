import Link from 'next/link'
import { Portico } from '@/components/design/portico'
import { autenticacao } from '@/server/auth'

export const dynamic = 'force-dynamic'

/**
 * O link de confirmação de e-mail cai aqui.
 *
 * Aqui a visita **confirma**, e isso é aceitável ao contrário da senha: se um
 * leitor de e-mail abrir o link antes da pessoa, o efeito é o mesmo que ela
 * queria. O `/api/auth` está fechado (`99333a4`), então a confirmação passa
 * pela API do servidor, não pela rota da biblioteca.
 */
export default async function ConfirmarEmail({ searchParams }: PageProps<'/confirmar-email'>) {
  const { token } = await searchParams
  let confirmado = false
  if (typeof token === 'string' && token.length > 0 && token.length < 2000) {
    try {
      await autenticacao().api.verifyEmail({ query: { token } })
      confirmado = true
    } catch {
      confirmado = false
    }
  }

  return (
    <Portico
      titulo={confirmado ? 'E-mail confirmado' : 'Link vencido'}
      descricao={
        confirmado
          ? 'Pronto. É por este e-mail que você recupera a senha, se precisar.'
          : 'Este link venceu ou já foi usado. Entre com a sua senha: se ainda faltar confirmar, mandamos outro.'
      }
    >
      <Link href="/entrar" className="botao-primario botao-md flex text-center">
        Entrar
      </Link>
    </Portico>
  )
}
