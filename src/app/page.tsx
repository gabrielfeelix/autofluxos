import Link from 'next/link'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { PainelShell } from '@/components/design/shell'
import { acaoCriarCliente, acaoCriarExemplo } from '@/server/acoes'
import { listarClientes } from '@/server/repos/clientes'
import { resumirAutomacoes } from '@/server/repos/fluxos'

export const dynamic = 'force-dynamic'

export default async function Pagina() {
  const [clientes, automacoes] = await Promise.all([listarClientes(), resumirAutomacoes()])

  return (
    <PainelShell>
      <main className="app-page-enter max-w-[1120px] px-4 md:px-[46px] pt-[38px] pb-[46px]">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-0.02em]">Clientes</h1>
            <p className="mt-1 text-[13px] text-muted">
              Empresas atendidas pela 4YU — cada uma com seus fluxos e números.
            </p>
          </div>

          <ModalFormulario
            botao={
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-lg leading-none">+</span>
                Novo cliente
              </span>
            }
            titulo="Novo cliente"
            descricao="A empresa nasce vazia — o primeiro fluxo e o número de WhatsApp vêm depois, na tela dela."
            action={acaoCriarCliente}
          >
            <label>
              <RotuloCampo>Nome da empresa</RotuloCampo>
              <input
                name="nome"
                required
                autoFocus
                placeholder="ex.: Vega Filmes"
                className="app-field px-[13px] py-[11px] text-[13.5px]"
              />
            </label>
          </ModalFormulario>
        </header>

        {clientes.length === 0 ? (
          <section className="app-card border-dashed px-10 py-14 text-center">
            <p className="text-[14px] font-semibold text-soft">Nenhum cliente ainda</p>
            <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-6 text-dim">
              Crie uma empresa vazia ou comece com o exemplo pronto para conhecer o fluxo completo.
            </p>
            <form action={acaoCriarExemplo} className="mt-5">
              <button type="submit" className="app-primary-button px-5 py-2.5 text-[13px]">
                Criar cliente de exemplo
              </button>
            </form>
          </section>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(310px,100%),1fr))] gap-4">
            {clientes.map((cliente) => {
              const resumo = automacoes.get(cliente.id)
              const total = resumo?.total ?? 0
              const comIa = resumo?.comIa ?? 0

              return (
                <li key={cliente.id}>
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="app-card app-card-interactive block min-h-[172px] p-5"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <LogoDoCliente cliente={cliente} />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[15.5px] font-bold tracking-[-0.01em]">
                          {cliente.nome}
                        </h2>
                        <p className="mt-0.5 text-[11.5px] text-dim">cliente AutoFluxos</p>
                      </div>
                      {comIa > 0 && (
                        <span className="font-mono text-[10px] text-violet-300">
                          {comIa} com IA
                        </span>
                      )}
                    </div>

                    <div className="mb-4 flex gap-[18px] text-[12.5px] text-muted">
                      <span>
                        <strong className="font-mono text-[13px] text-ink">{total}</strong>{' '}
                        {total === 1 ? 'automação' : 'automações'}
                      </span>
                      <span>
                        <strong className="font-mono text-[13px] text-ink">{comIa}</strong> com IA
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className={`size-2 rounded-full ${total > 0 ? 'bg-emerald-400' : 'bg-dim'}`} />
                      <span className={total > 0 ? 'text-emerald-300' : 'text-muted'}>
                        {total > 0 ? 'estrutura configurada' : 'aguardando primeiro fluxo'}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </PainelShell>
  )
}
