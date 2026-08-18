import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FormularioDeConta } from '@/components/conta/formulario'
import { Portico } from '@/components/design/portico'
import { acaoEntrar } from '@/server/acoes-conta'
import { destinoAposEntrar, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Entrar com a **sua** conta.
 *
 * Convive com `/login`, que é a senha única do time e continua sendo a porta
 * principal enquanto ela existir. As duas telas apontam uma para a outra: quem
 * chega na errada não fica preso.
 *
 * Quem já tem sessão é mandado adiante **aqui**, e não no `proxy.ts`. Lá a
 * conferência é só de presença do cookie, e um cookie vencido viraria laço —
 * a raiz confere de verdade, não encontra sessão e devolve para cá.
 */
export default async function Entrar() {
  const sessao = await sessaoAtual()
  if (sessao) redirect(await destinoAposEntrar(sessao))

  const temSenhaUnica = Boolean(process.env.PAINEL_SENHA)

  return (
    <Portico
      titulo="Entrar"
      descricao="Sua conta do AutoFluxos."
      rodape={
        <>
          <p>
            Não existe recuperação por e-mail ainda — ela depende de SMTP, que é
            compartilhado com outro produto. Peça uma senha nova a quem administra o painel.
          </p>
          {temSenhaUnica && (
            <p className="mt-2">
              É operador da 4YU e usa a senha do time?{' '}
              <Link href="/login" className="text-muted underline underline-offset-2 transition hover:text-accent">
                Entrar com a senha única
              </Link>
              .
            </p>
          )}
        </>
      }
    >
      <FormularioDeConta action={acaoEntrar} botao="Entrar" />
    </Portico>
  )
}
