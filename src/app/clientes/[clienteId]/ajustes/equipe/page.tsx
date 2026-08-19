import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Dropdown } from '@/components/design/dropdown'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
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
      <main className="w-full max-w-[1100px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
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

        <section className="app-card overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">
              {equipe.length} {equipe.length === 1 ? 'pessoa' : 'pessoas'}
            </h2>
            {podeMexer && (
              <ModalFormulario
                botao="+ Cadastrar pessoa"
                titulo="Adicionar alguém"
                descricao="A senha é definida aqui e combinada por fora — ainda não há convite por e-mail, porque o servidor é compartilhado com outro produto. E-mail que já existe apenas liga a pessoa a esta conta."
                rotuloEnviar="Adicionar"
                variante={equipe.length === 0 ? 'primario' : 'secundario'}
                action={acaoCadastrarPessoaNaConta.bind(null, clienteId, {})}
              >
                <label>
                  <RotuloCampo>Nome</RotuloCampo>
                  <input
                    name="nome"
                    autoFocus
                    placeholder="Nome de quem entra"
                    className="app-field px-[13px] py-[11px] text-[13.5px]"
                  />
                </label>
                <label>
                  <RotuloCampo>E-mail</RotuloCampo>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="pessoa@exemplo.com.br"
                    className="app-field px-[13px] py-[11px] text-[13.5px]"
                  />
                </label>
                <label>
                  <RotuloCampo>Senha (mín. 10 caracteres)</RotuloCampo>
                  <input
                    name="senha"
                    type="password"
                    minLength={10}
                    autoComplete="new-password"
                    className="app-field px-[13px] py-[11px] text-[13.5px]"
                  />
                </label>
                <label>
                  <RotuloCampo>Papel na conta</RotuloCampo>
                  <Dropdown
                    nome="papel"
                    rotuloAcessivel="Papel na conta"
                    valorInicial="member"
                    opcoes={PAPEIS}
                  />
                </label>
              </ModalFormulario>
            )}
          </header>

          {equipe.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs leading-5 text-dim">
              Ninguém ligado a esta conta ainda. Enquanto isso, só quem administra a
              plataforma consegue abrir o painel dela.
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

      </main>
    </ClienteShell>
  )
}
