import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FormularioDeConta } from '@/components/conta/formulario'
import { Portico } from '@/components/design/portico'
import { IlustracaoOutroAparelho } from '@/components/design/ilustracoes'
import { acaoEntrar } from '@/server/acoes-conta'
import { destinoAposEntrar } from '@/server/permissoes'
import { sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Entrar com a **sua** conta.
 *
 * **É a porta, e é a única.** A senha única do time (`/login`) saiu: enquanto as
 * duas conviviam existia um caminho que alcançava qualquer conta sem passar por
 * membro e, portanto, sem deixar rastro na auditoria.
 *
 * Quem já tem sessão é mandado adiante **aqui**, e não no `proxy.ts`. Lá a
 * conferência é só de presença do cookie, e um cookie vencido viraria laço ,
 * a raiz confere de verdade, não encontra sessão e devolve para cá.
 */
export default async function Entrar({ searchParams }: PageProps<'/entrar'>) {
  const sessao = await sessaoAtual()
  if (sessao) redirect(await destinoAposEntrar(sessao))

  const busca = await searchParams
  const outroAparelho = busca.motivo === 'outro-aparelho'

  return (
    <Portico
      /*
       * Derrubado pelo limite de aparelhos (`limite-de-sessoes.ts`). Sem este
       * aviso a pessoa caía aqui do nada, no meio do trabalho, e lia defeito.
       * O "se não foi você" é a parte que importa: é assim que se descobre
       * uma senha dividida ou vazada.
       */
      topo={
        outroAparelho ? (
          <div className="mb-5 rounded-[16px] bg-primary-weak px-3 py-4">
            <IlustracaoOutroAparelho />
          </div>
        ) : undefined
      }
      titulo={outroAparelho ? 'Sua conta entrou em outro aparelho' : 'Entrar'}
      descricao={
        outroAparelho
          ? 'Cada pessoa fica conectada em até 3 aparelhos ao mesmo tempo, e este era o mais antigo. Entre de novo para continuar. Se não foi você, troque a senha logo depois de entrar.'
          : busca.senha === 'nova'
          ? 'Senha nova salva. Entre com ela.'
          : busca.conta === 'criada'
            ? 'Conta criada. Entre com o e-mail e a senha que você acabou de cadastrar.'
            : 'Sua conta do AutoFluxos.'
      }
      rodape={
        <>
          <p>
            Não tem conta?{' '}
            <Link
              href="/cadastrar"
              className="text-muted underline underline-offset-2 transition hover:text-primary"
            >
              Cadastre-se
            </Link>
          </p>
          <p className="mt-2">
            <Link
              href="/esqueci-senha"
              className="text-muted underline underline-offset-2 transition hover:text-primary"
            >
              Esqueci a senha
            </Link>
          </p>
        </>
      }
    >
      <FormularioDeConta action={acaoEntrar} botao="Entrar" />
    </Portico>
  )
}
