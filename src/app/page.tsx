import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { PainelShell } from '@/components/design/shell'
import { horaExata, quando } from '@/lib/quando'
import { acaoCriarCliente, acaoCriarExemplo } from '@/server/acoes'
import { listarClientes, resumirAtendimento } from '@/server/repos/clientes'
import { resumirAutomacoes } from '@/server/repos/fluxos'
import { ehAdminDaPlataforma, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * A porta de entrada do painel.
 *
 * **Ela era uma grade de cartões e virou lista, e isso não é gosto.** O cartão
 * respondia "quanta coisa a gente montou aqui" — nome, `N automações`, `N com
 * IA` (duas vezes, uma como selo e outra na linha de números) e um ponto verde
 * dizendo "estrutura configurada". Nada disso muda ao longo do dia, e nada
 * disso é motivo para abrir a tela.
 *
 * A pergunta que faz alguém abrir isto de manhã é **quem está esperando
 * resposta**. Ela cabe numa linha, e uma linha por cliente ocupa a largura da
 * tela em vez de deixar um deserto à direita de três caixas de 310px.
 */
export default async function Pagina() {
  /**
   * Esta tela é a visão de quem opera a 4YU: ela lista **todos** os clientes.
   *
   * Quem entrou como pessoa e não administra a plataforma não tem nada a fazer
   * aqui — vai para as companhias dele. Sem esta linha, bastaria alguém
   * cadastrado alcançar a raiz para ver a carteira inteira, que é exatamente o
   * furo que o login existe para fechar.
   */
  const sessao = await sessaoAtual()
  if (sessao && !ehAdminDaPlataforma(sessao)) redirect('/contas')

  const [clientes, automacoes, atendimento] = await Promise.all([
    listarClientes(),
    resumirAutomacoes(),
    resumirAtendimento(),
  ])

  /**
   * Quem espera vem primeiro, depois quem se mexeu por último.
   *
   * A ordem de criação era estável e não dizia nada. Esta muda de dia para dia
   * de propósito: a lista é uma fila de trabalho, e o primeiro item tem que ser
   * o que precisa de alguém agora. O desempate por nome mantém a ordem previsível
   * quando ninguém espera e ninguém se mexeu.
   */
  const fila = [...clientes].sort((a, b) => {
    const ra = atendimento.get(a.id)
    const rb = atendimento.get(b.id)
    const esperando = (rb?.esperandoPessoa ?? 0) - (ra?.esperandoPessoa ?? 0)
    if (esperando !== 0) return esperando

    const movimento = (rb?.ultimaAtividade?.getTime() ?? 0) - (ra?.ultimaAtividade?.getTime() ?? 0)
    if (movimento !== 0) return movimento

    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  const esperandoNoTotal = fila.reduce(
    (soma, cliente) => soma + (atendimento.get(cliente.id)?.esperandoPessoa ?? 0),
    0,
  )

  return (
    <PainelShell>
      <main className="app-page-enter px-4 md:px-[46px] pt-[38px] pb-[46px]">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-0.02em]">Clientes</h1>
            <p className="mt-1 text-[13px] text-muted">
              {esperandoNoTotal > 0 ? (
                <>
                  <strong className="font-semibold text-amber-300">
                    {esperandoNoTotal}{' '}
                    {esperandoNoTotal === 1 ? 'pessoa espera' : 'pessoas esperam'} atendimento
                  </strong>{' '}
                  em {clientes.length} {clientes.length === 1 ? 'empresa' : 'empresas'}.
                </>
              ) : (
                <>
                  Empresas atendidas pela 4YU — nenhuma conversa esperando uma pessoa agora.
                </>
              )}
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
          <ul className="flex flex-col gap-2">
            {fila.map((cliente) => (
              <li key={cliente.id}>
                <LinhaDoCliente
                  cliente={cliente}
                  resumo={atendimento.get(cliente.id)}
                  automacoes={automacoes.get(cliente.id)?.total ?? 0}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </PainelShell>
  )
}

type Resumo = ReturnType<Awaited<ReturnType<typeof resumirAtendimento>>['get']>

function LinhaDoCliente({
  cliente,
  resumo,
  automacoes,
}: {
  cliente: { id: string; nome: string; responsavel: string; logoUrl: string }
  resumo: Resumo
  automacoes: number
}) {
  const esperando = resumo?.esperandoPessoa ?? 0
  const contatos = resumo?.contatos ?? 0
  const ultima = resumo?.ultimaAtividade ?? null

  return (
    <Link
      href={`/clientes/${cliente.id}`}
      className="app-card app-card-interactive grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 p-3.5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-5 md:p-4"
    >
      <LogoDoCliente cliente={cliente} />

      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-bold tracking-[-0.01em]">{cliente.nome}</h2>
        <p className="mt-0.5 truncate text-[11.5px] text-dim">
          {cliente.responsavel.trim() !== '' ? cliente.responsavel : 'sem responsável no cadastro'}
        </p>
      </div>

      {/*
        `col-span-2` no celular põe os números embaixo do nome em vez de espremer
        cinco colunas em 390px; a partir de `md` eles voltam para a direita da
        mesma linha e é aí que a largura da tela vira informação, não vazio.
      */}
      <div className="col-span-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] md:col-span-1 md:flex-nowrap md:justify-end md:gap-x-7">
        {/*
          O estado importante não pode depender de cor: quem não distingue
          âmbar de cinza lê "3 esperando" do mesmo jeito. A cor só reforça.
        */}
        {esperando > 0 ? (
          <span className="font-semibold text-amber-300">
            <strong className="font-mono text-[13px] font-bold">{esperando}</strong> esperando
          </span>
        ) : (
          <span className="text-dim">ninguém esperando</span>
        )}

        <span className="text-muted">
          <strong className="font-mono text-[13px] text-ink">{contatos}</strong>{' '}
          {contatos === 1 ? 'contato' : 'contatos'}
        </span>

        <span className="text-muted">
          <strong className="font-mono text-[13px] text-ink">{automacoes}</strong>{' '}
          {automacoes === 1 ? 'automação' : 'automações'}
        </span>

        <span
          className="text-dim md:w-[104px] md:text-right"
          title={ultima ? horaExata(ultima.toISOString()) : undefined}
        >
          {ultima ? quando(ultima.toISOString()) : 'sem conversa'}
        </span>
      </div>
    </Link>
  )
}
