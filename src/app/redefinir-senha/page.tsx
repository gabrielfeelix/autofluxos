import Link from 'next/link'
import { FormularioDeRedefinicao } from '@/components/conta/formulario-de-senha-esquecida'
import { Portico } from '@/components/design/portico'

export const dynamic = 'force-dynamic'

/**
 * O link do e-mail cai aqui, com o token na URL.
 *
 * **Abrir a página não gasta o token.** Leitor de e-mail e antivírus abrem link
 * sozinhos para conferir; se a visita consumisse o token, o link chegaria
 * morto. Ele só é usado quando a pessoa envia a senha nova.
 */
export default async function RedefinirSenha({ searchParams }: PageProps<'/redefinir-senha'>) {
  const { token } = await searchParams
  const valido = typeof token === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(token)

  return (
    <Portico
      titulo="Senha nova"
      descricao={valido ? 'Crie a senha nova da sua conta. As outras sessões abertas serão encerradas.' : 'Este link está incompleto.'}
      rodape={
        <p>
          <Link href="/esqueci-senha" className="text-muted underline underline-offset-2 transition hover:text-primary">
            Pedir outro link
          </Link>
        </p>
      }
    >
      {valido ? (
        <FormularioDeRedefinicao token={token} />
      ) : (
        <p className="text-[13.5px] leading-6 text-ink">Abra o link inteiro do e-mail, ou peça outro.</p>
      )}
    </Portico>
  )
}
