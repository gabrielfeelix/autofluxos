import { redirect } from 'next/navigation'
import { FormularioDeConta } from '@/components/conta/formulario'
import { Portico } from '@/components/design/portico'
import { acaoEntrar } from '@/server/acoes-conta'
import { destinoAposEntrar, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Entrar com a **sua** conta.
 *
 * **É a porta, e é a única.** A senha única do time (`/login`) saiu: enquanto as
 * duas conviviam existia um caminho que alcançava qualquer conta sem passar por
 * membro e, portanto, sem deixar rastro na auditoria.
 *
 * Quem já tem sessão é mandado adiante **aqui**, e não no `proxy.ts`. Lá a
 * conferência é só de presença do cookie, e um cookie vencido viraria laço —
 * a raiz confere de verdade, não encontra sessão e devolve para cá.
 */
export default async function Entrar() {
  const sessao = await sessaoAtual()
  if (sessao) redirect(await destinoAposEntrar(sessao))

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
        </>
      }
    >
      <FormularioDeConta action={acaoEntrar} botao="Entrar" />
    </Portico>
  )
}
