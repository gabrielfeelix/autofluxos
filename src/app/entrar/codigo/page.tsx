import Link from 'next/link'
import { FormularioDeCodigo } from '@/components/conta/formulario-de-codigo'
import { Portico } from '@/components/design/portico'

export const dynamic = 'force-dynamic'

/**
 * O segundo passo do login, para quem ligou a verificação em duas etapas.
 *
 * Só serve depois da senha certa: é o cookie que `acaoEntrar` deixou que
 * autoriza conferir o código. Chegar aqui direto dá "código não confere".
 */
export default function CodigoDoLogin() {
  return (
    <Portico
      titulo="Código de verificação"
      descricao="Abra o aplicativo de autenticação no celular e digite o código do AutoFluxos."
      rodape={
        <p>
          Perdeu o celular? Use um dos códigos de recuperação que você guardou.{' '}
          <Link href="/entrar" className="text-muted underline underline-offset-2 transition hover:text-primary">
            Voltar para a senha
          </Link>
        </p>
      }
    >
      <FormularioDeCodigo />
    </Portico>
  )
}
