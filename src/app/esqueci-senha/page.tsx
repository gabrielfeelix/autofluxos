import Link from 'next/link'
import { FormularioDePedido } from '@/components/conta/formulario-de-senha-esquecida'
import { Portico } from '@/components/design/portico'

export const dynamic = 'force-dynamic'

/** Primeiro passo de "esqueci a senha": o e-mail. O link chega pelo Brevo. */
export default function EsqueciASenha() {
  return (
    <Portico
      titulo="Esqueci a senha"
      descricao="Digite o e-mail da sua conta. Mandamos um link para criar uma senha nova."
      rodape={
        <p>
          Lembrou?{' '}
          <Link href="/entrar" className="text-muted underline underline-offset-2 transition hover:text-primary">
            Voltar para entrar
          </Link>
        </p>
      }
    >
      <FormularioDePedido />
    </Portico>
  )
}
