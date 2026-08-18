import Link from 'next/link'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { acaoVincularMembro } from '@/server/acoes-conta'
import { listarContasComMembros, listarUsuarios } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

const PAPEIS: { valor: string; rotulo: string }[] = [
  { valor: 'owner', rotulo: 'dono da conta' },
  { valor: 'admin', rotulo: 'administrador' },
  { valor: 'member', rotulo: 'equipe' },
]

/**
 * As contas e quem entra em cada uma.
 *
 * **A conta sem membro nenhum aparece primeiro**, e não é ordenação por acaso:
 * são os clientes criados antes de o login existir, e são exatamente os que
 * precisam de ação. Uma lista que só mostra o que já está resolvido esconde o
 * trabalho que falta.
 */
export default async function Contas() {
  const [contas, usuarios] = await Promise.all([listarContasComMembros(), listarUsuarios()])
  const fila = [...contas].sort((a, b) => a.membros.length - b.membros.length)
  const semNinguem = contas.filter((conta) => conta.membros.length === 0).length

  return (
    <main className="max-w-[880px] px-4 pt-[38px] pb-[46px] md:px-[46px]">
      <header className="mb-7">
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Contas</h1>
        <p className="mt-1 text-[13px] text-muted">
          {semNinguem > 0 ? (
            <>
              <strong className="font-semibold text-amber-300">
                {semNinguem} {semNinguem === 1 ? 'conta ainda não tem' : 'contas ainda não têm'}{' '}
                dono
              </strong>{' '}
              — ninguém consegue entrar {semNinguem === 1 ? 'nela' : 'nelas'} com login próprio.
            </>
          ) : (
            <>Todas as contas têm pelo menos uma pessoa com acesso.</>
          )}
        </p>
      </header>

      {usuarios.length === 0 && (
        <p className="app-card mb-5 px-5 py-4 text-[12.5px] leading-6 text-muted">
          Não existe nenhum usuário ainda.{' '}
          <Link
            href="/criar-conta"
            className="text-soft underline underline-offset-2 transition hover:text-accent"
          >
            Cadastre alguém
          </Link>{' '}
          antes de ligar contas a pessoas.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {fila.map((conta) => (
          <li key={conta.id} className="app-card p-4">
            <div className="flex flex-wrap items-center gap-3.5">
              <LogoDoCliente cliente={{ nome: conta.nome, logoUrl: conta.logoUrl }} tamanho={38} />

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold tracking-[-0.01em]">{conta.nome}</h2>
                {/*
                  O slug, e não o id. Id de banco na tela é o erro nº 6 da lista
                  que este projeto copiou dos outros — e o slug é o que a pessoa
                  vai ver no endereço um dia.
                */}
                <p className="mt-0.5 truncate font-mono text-[11px] text-dim">{conta.slug}</p>
              </div>

              <Link
                href={`/clientes/${conta.id}`}
                className="app-secondary-button px-3 py-1.5 text-[11.5px]"
              >
                Abrir painel
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
              {conta.membros.length === 0 ? (
                <span className="text-[12px] text-amber-300">sem ninguém</span>
              ) : (
                conta.membros.map((membro) => (
                  <span
                    key={membro.id}
                    className="rounded-full border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-soft"
                    title={membro.email}
                  >
                    {membro.nome}{' '}
                    <span className="text-dim">
                      · {PAPEIS.find((p) => p.valor === membro.papel)?.rotulo ?? membro.papel}
                    </span>
                  </span>
                ))
              )}

              {usuarios.length > 0 && (
                <details className="ml-auto">
                  <summary className="app-secondary-button inline-block px-3 py-1.5 text-[11.5px] list-none">
                    + Ligar pessoa
                  </summary>
                  <form
                    action={acaoVincularMembro}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="contaId" value={conta.id} />
                    <select
                      name="usuarioId"
                      required
                      aria-label={`Pessoa para ligar a ${conta.nome}`}
                      className="app-field max-w-[240px] px-2.5 py-2 text-[12.5px]"
                    >
                      {usuarios.map((usuario) => (
                        <option key={usuario.id} value={usuario.id}>
                          {usuario.nome} — {usuario.email}
                        </option>
                      ))}
                    </select>
                    <select
                      name="papel"
                      defaultValue="owner"
                      aria-label="Papel na conta"
                      className="app-field max-w-[160px] px-2.5 py-2 text-[12.5px]"
                    >
                      {PAPEIS.map((papel) => (
                        <option key={papel.valor} value={papel.valor}>
                          {papel.rotulo}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="app-primary-button px-3 py-2 text-[12px]">
                      Ligar
                    </button>
                  </form>
                </details>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
