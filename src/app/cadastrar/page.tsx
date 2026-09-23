import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FormularioDeConta } from '@/components/conta/formulario'
import { Portico } from '@/components/design/portico'
import { acaoCadastrarSe } from '@/server/acoes-conta'
import { destinoAposEntrar, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * O cadastro aberto, a porta de quem chega sozinho.
 *
 * **Não é a mesma tela que `/criar-conta`**, e a separação é o ponto. Aquela
 * nasceu para duas coisas internas: a primeira execução do sistema (quem entra
 * vira administrador da plataforma) e o administrador cadastrando gente. Esta é
 * o produto: quem chega pelo site cria a conta dele, cria a empresa dele no
 * passo seguinte e conecta o WhatsApp dele.
 *
 * Juntar as duas numa tela só significaria uma única função decidindo, por
 * contexto, se quem sai dali é dono de um estúdio de pilates ou administrador da
 * 4YU. Essa é a decisão que não pode depender de um `if` bem escrito: aqui
 * `role` não é tocado em caminho nenhum, e é por construção que ninguém nasce
 * administrador por esta porta.
 */
export default async function Cadastrar() {
  // Quem já está logado não se cadastra de novo, vai para onde já pertence.
  const sessao = await sessaoAtual()
  if (sessao) redirect(await destinoAposEntrar(sessao))

  return (
    <Portico
      titulo="Criar seu acesso"
      descricao="Seu login no AutoFluxos. A empresa você cria no passo seguinte."
      rodape={
        <p>
          Já tem conta?{' '}
          <Link
            href="/entrar"
            className="text-muted underline underline-offset-2 transition hover:text-primary"
          >
            Entrar
          </Link>
        </p>
      }
    >
      <FormularioDeConta
        action={acaoCadastrarSe}
        botao="Criar acesso"
        pedirNome
        pedirTelefone
        ajuda="Depois daqui você entra e cria a sua empresa. Leva menos de um minuto."
      />
    </Portico>
  )
}
