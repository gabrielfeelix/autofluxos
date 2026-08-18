import Link from 'next/link'
import { Portico } from '@/components/design/portico'
import { LoginFormulario } from '@/components/design/login-formulario'

/**
 * A senha única do time — a porta que está no ar desde o MVP.
 *
 * Ela não foi aposentada junto com a chegada do login por usuário, e isso é
 * decisão: enquanto as duas convivem, nada que já roda pode quebrar por causa
 * do sistema novo. A troca acontece quando toda tela souber de qual conta a
 * pessoa é (ver docs/HANDOFF.md §4, passo 5).
 */
export default function Login() {
  return (
    <Portico
      titulo="Entrar"
      descricao="Acesso do operador 4YU."
      rodape={
        <>
          <p>
            Sessões expiram após 12 h. O e-mail aqui é só identificação visual; a senha única é o
            que libera o painel.
          </p>
          <p className="mt-2">
            Tem uma conta sua?{' '}
            <Link
              href="/entrar"
              className="text-muted underline underline-offset-2 transition hover:text-accent"
            >
              Entrar com e-mail e senha
            </Link>
            .
          </p>
        </>
      }
    >
      <LoginFormulario />
    </Portico>
  )
}
