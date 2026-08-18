import Link from 'next/link'
import {
  acaoDefinirPapelDePlataforma,
  acaoEntrarComo,
  acaoRevogarSessoes,
  acaoSuspenderAcesso,
} from '@/server/acoes-conta'
import { listarUsuarios } from '@/server/repos/usuarios'
import { exigirAdminDaPlataforma } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Quem existe, o que pode, e o "entrar como".
 *
 * **O "entrar como" é o recurso mais perigoso deste painel**, e o desenho da
 * tela reflete isso: ele não é o botão primário, ele diz na frente que fica
 * registrado, e a sessão que ele abre dura uma hora e carrega uma faixa âmbar
 * em toda tela. Nada disso pede a senha de ninguém — é sessão marcada, com
 * prazo e rastro, que é a boa prática do recurso.
 */
export default async function Usuarios() {
  const [sessao, usuarios] = await Promise.all([exigirAdminDaPlataforma(), listarUsuarios()])

  return (
    <main className="max-w-[980px] px-4 pt-[38px] pb-[46px] md:px-[46px]">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-bold tracking-[-0.02em]">Usuários</h1>
          <p className="mt-1 text-[13px] text-muted">
            {usuarios.length} {usuarios.length === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'}.
            Convite por e-mail depende de SMTP, que é compartilhado com outro produto — até lá, a
            senha é combinada fora daqui.
          </p>
        </div>

        <Link href="/criar-conta" className="app-primary-button px-[18px] py-2.5 text-[13px]">
          + Cadastrar pessoa
        </Link>
      </header>

      <ul className="flex flex-col gap-2">
        {usuarios.map((usuario) => {
          const souEu = usuario.id === sessao.usuario.id
          const ehAdmin = usuario.papelDePlataforma.split(',').includes('admin')

          return (
            <li key={usuario.id} className="app-card p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-bold tracking-[-0.01em]">
                    {usuario.nome}
                    {souEu && <Selo tom="neutro">você</Selo>}
                    {ehAdmin && <Selo tom="destaque">administrador da 4YU</Selo>}
                    {usuario.banido && <Selo tom="alerta">suspenso</Selo>}
                  </h2>
                  <p className="mt-0.5 truncate text-[11.5px] text-dim">{usuario.email}</p>
                </div>

                <p className="text-[11.5px] text-dim">
                  {usuario.sessoesAtivas === 0
                    ? 'nenhuma sessão aberta'
                    : `${usuario.sessoesAtivas} ${usuario.sessoesAtivas === 1 ? 'sessão aberta' : 'sessões abertas'}`}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {usuario.contas.length === 0 ? (
                  <span className="text-[12px] text-amber-300">
                    sem conta nenhuma — entra e não vê nada
                  </span>
                ) : (
                  usuario.contas.map((conta) => (
                    <span
                      key={conta.id}
                      className="rounded-full border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-soft"
                    >
                      {conta.nome} <span className="text-dim">· {conta.papel}</span>
                    </span>
                  ))
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
                {/*
                  Fora quando não faz sentido, e não desabilitado: entrar como
                  si mesmo não é nada, e entrar como quem não tem conta nenhuma
                  leva a uma tela vazia. Botão que existe e não funciona ensina
                  a desconfiar dos que funcionam.
                */}
                {!souEu && !usuario.banido && usuario.contas.length > 0 && (
                  <form action={acaoEntrarComo.bind(null, usuario.id)}>
                    <button type="submit" className="app-secondary-button px-3 py-1.5 text-[11.5px]">
                      Entrar como
                    </button>
                  </form>
                )}

                {!souEu && (
                  <form action={acaoDefinirPapelDePlataforma}>
                    <input type="hidden" name="usuarioId" value={usuario.id} />
                    <input type="hidden" name="papel" value={ehAdmin ? 'user' : 'admin'} />
                    <button type="submit" className="app-secondary-button px-3 py-1.5 text-[11.5px]">
                      {ehAdmin ? 'Tirar administração' : 'Tornar administrador'}
                    </button>
                  </form>
                )}

                {usuario.sessoesAtivas > 0 && (
                  <form action={acaoRevogarSessoes}>
                    <input type="hidden" name="usuarioId" value={usuario.id} />
                    <button type="submit" className="app-secondary-button px-3 py-1.5 text-[11.5px]">
                      Derrubar sessões
                    </button>
                  </form>
                )}

                {!souEu && (
                  <form action={acaoSuspenderAcesso} className="ml-auto flex items-center gap-2">
                    <input type="hidden" name="usuarioId" value={usuario.id} />
                    <input type="hidden" name="suspender" value={usuario.banido ? '0' : '1'} />
                    <button
                      type="submit"
                      className={`rounded-[10px] border px-3 py-1.5 text-[11.5px] font-semibold transition ${
                        usuario.banido
                          ? 'border-white/[0.12] bg-white/[0.05] text-soft hover:text-accent'
                          : 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300 hover:bg-rose-400/[0.13]'
                      }`}
                    >
                      {usuario.banido ? 'Devolver acesso' : 'Suspender acesso'}
                    </button>
                  </form>
                )}
              </div>

              <p className="mt-2.5 text-[11px] leading-5 text-dim">
                Entrar como {usuario.nome.split(' ')[0]} abre uma sessão de <strong>1 hora</strong>{' '}
                marcada no banco e registrada na auditoria. Não usa nem revela a senha dele.
              </p>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

function Selo({ children, tom }: { children: string; tom: 'neutro' | 'destaque' | 'alerta' }) {
  const cores = {
    neutro: 'border-white/[0.12] bg-white/[0.05] text-dim',
    destaque: 'border-accent/30 bg-accent/[0.12] text-accent',
    alerta: 'border-rose-400/30 bg-rose-400/[0.1] text-rose-300',
  }[tom]

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${cores}`}>
      {children}
    </span>
  )
}
