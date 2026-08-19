import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Dropdown } from '@/components/design/dropdown'
import { FormularioSalvar } from '@/components/design/formulario-salvar'
import { LinhaDaEquipe } from '@/components/conta/linha-da-equipe'
import { acaoCadastrarPessoaNaConta } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'
import { conferirAcessoAoCliente, podeAdministrarConta } from '@/server/sessao'

export const dynamic = 'force-dynamic'

const PAPEIS = [
  { valor: 'member', rotulo: 'Atende', detalhe: 'responde no Inbox' },
  { valor: 'admin', rotulo: 'Administra', detalhe: 'mexe na equipe e nos ajustes' },
  { valor: 'owner', rotulo: 'Dona da conta', detalhe: 'manda em tudo' },
]

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await conferirAcessoAoCliente(clienteId)
  const podeMexer = acesso !== null && podeAdministrarConta(acesso)

  /**
   * A lista fala Postgres direto (as tabelas do login ficam fora da Data API),
   * então ela pode estourar num ambiente sem `DATABASE_URL`. Cair para vazio é
   * o certo: a tela diz "ninguém ainda", que é a verdade enquanto não existe
   * usuário nenhum em produção.
   */
  let equipe: MembroDaConta[] = []
  try {
    equipe = await membrosDaConta(clienteId)
  } catch (erro) {
    console.error('[equipe] não deu para ler a equipe', erro instanceof Error ? erro.message : erro)
  }

  return (
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="max-w-[820px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Link
          href={`/clientes/${clienteId}/ajustes`}
          className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-accent"
        >
          ← Ajustes
        </Link>
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Equipe</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          Quem entra nesta conta e o que cada um pode fazer. É desta lista que sai
          o rail <strong className="text-muted">Atribuído</strong> do Inbox — quem
          não está aqui não aparece para assumir conversa.
        </p>

        <section className="app-card mb-[18px] overflow-hidden">
          <header className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">
              {equipe.length} {equipe.length === 1 ? 'pessoa' : 'pessoas'}
            </h2>
          </header>

          {equipe.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs leading-5 text-dim">
              Ninguém ligado a esta conta ainda. Enquanto isso, quem opera entra
              pela senha única do time.
            </p>
          ) : (
            <ul>
              {equipe.map((membro) => (
                <LinhaDaEquipe
                  key={membro.id}
                  clienteId={clienteId}
                  membro={membro}
                  papeis={PAPEIS}
                  podeMexer={podeMexer}
                />
              ))}
            </ul>
          )}
        </section>

        {podeMexer && (
          <section className="app-card overflow-hidden">
            <header className="border-b border-white/[0.06] px-5 py-4">
              <h2 className="text-[14.5px] font-bold">Adicionar alguém</h2>
              <p className="mt-0.5 text-[12px] leading-5 text-dim">
                A senha é definida aqui e combinada por fora — ainda não há convite
                por e-mail, porque o servidor de e-mail é compartilhado com outro
                produto e ligá-lo é decisão dos dois.
                <br />
                Se o e-mail já existir no sistema, a pessoa é apenas ligada a esta
                conta: quem administra duas companhias usa o mesmo login nas duas.
              </p>
            </header>
            <div className="p-5">
              <FormularioSalvar
                action={acaoCadastrarPessoaNaConta.bind(null, clienteId)}
                rotulo="Adicionar"
              >
                <div className="grid gap-2.5 md:grid-cols-2">
                  <input
                    name="nome"
                    placeholder="Nome"
                    aria-label="Nome"
                    className="app-field px-3 py-2.5 text-[12.5px]"
                  />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="e-mail"
                    aria-label="E-mail"
                    className="app-field px-3 py-2.5 text-[12.5px]"
                  />
                  <input
                    name="senha"
                    type="password"
                    minLength={10}
                    placeholder="Senha (mín. 10 caracteres)"
                    aria-label="Senha"
                    autoComplete="new-password"
                    className="app-field px-3 py-2.5 text-[12.5px]"
                  />
                  <Dropdown
                    nome="papel"
                    rotuloAcessivel="Papel na conta"
                    valorInicial="member"
                    opcoes={PAPEIS}
                  />
                </div>
              </FormularioSalvar>
            </div>
          </section>
        )}
      </main>
    </ClienteShell>
  )
}
