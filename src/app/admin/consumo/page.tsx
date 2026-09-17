import { acharPlano, comoTamanho, fracaoUsada, O_QUE_E_CONVERSA } from '@/core/planos'
import { consumoDeTodasAsContas, type ConsumoDeUmaConta } from '@/server/repos/plano'

export const dynamic = 'force-dynamic'

/**
 * Quanto cada conta consumiu no mês.
 *
 * **Esta tela mede e não cobra, e a distinção é o desenho inteiro.** Medir vem
 * antes de cobrar, e medir sem travar vem antes de travar: um mês de número real
 * dirá se as faixas de `core/planos.ts` fazem sentido, e ninguém descobre isso
 * por dedução. Se a trava nascesse junto da primeira medição, o primeiro erro de
 * contagem viraria cliente sem atender.
 *
 * Por isso nada aqui bloqueia coisa nenhuma, e o passar da faixa aparece como
 * aviso para quem opera a 4YU, não como porta fechada para o cliente.
 *
 * Nasce protegida sem fazer nada: `admin/layout.tsx` chama
 * `exigirAdminDaPlataforma()` uma vez e toda rota abaixo herda.
 */
export default async function Consumo() {
  const contas = await consumoDeTodasAsContas()

  const totalDeConversas = contas.reduce((soma, c) => soma + c.conversas, 0)
  const totalDeBytes = contas.reduce((soma, c) => soma + c.bytes, 0)
  const ativas = contas.filter((c) => c.conversas > 0).length

  return (
    <main className="w-full px-4 pt-[38px] pb-[46px] md:px-[46px]">
      <header className="mb-7">
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Consumo</h1>
        <p className="mt-1 max-w-[680px] text-[13px] leading-6 text-muted">
          O que cada conta usou neste mês, contra o que o plano dela comporta.{' '}
          {O_QUE_E_CONVERSA} Nada aqui bloqueia nada: a medição existe para as faixas
          serem conferidas antes de virarem cobrança.
        </p>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <Numero rotulo="Conversas no mês" valor={totalDeConversas.toLocaleString('pt-BR')} />
        <Numero rotulo="Contas com conversa" valor={`${ativas} de ${contas.length}`} />
        <Numero rotulo="Arquivos recebidos" valor={comoTamanho(totalDeBytes)} />
      </section>

      {contas.length === 0 ? (
        <section className="app-card border-dashed px-8 py-12 text-center">
          <p className="text-[14px] font-semibold text-soft">Nenhuma conta ainda</p>
        </section>
      ) : (
        <ul className="app-card divide-y divide-line overflow-hidden">
          {contas.map((conta) => (
            <li key={conta.clienteId}>
              <LinhaDaConta conta={conta} />
            </li>
          ))}
        </ul>
      )}

      {/*
        Escrito na tela, e não só no código, porque quem abrir isto daqui a três
        meses vai somar este número com o do acervo e achar que o disco encolheu.
      */}
      <p className="mt-4 max-w-[680px] text-[12px] leading-6 text-dim">
        O tamanho conta só os arquivos que chegaram pelas conversas. O acervo de mídia mora
        no Storage e não tem tabela espelho, então ele não entra nesta soma.
      </p>
    </main>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="app-card px-4 py-3.5">
      <p className="text-[11.5px] text-dim">{rotulo}</p>
      <p className="mt-1 text-[21px] font-bold tracking-[-0.02em]">{valor}</p>
    </div>
  )
}

function LinhaDaConta({ conta }: { conta: ConsumoDeUmaConta }) {
  const plano = acharPlano(conta.plano)
  const fracao = fracaoUsada(conta.conversas, plano)
  const estourou = fracao > 1
  const perto = !estourou && fracao >= 0.8

  const tom = estourou ? 'text-perigo' : perto ? 'text-aviso' : 'text-muted'

  return (
    <article className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-soft">{conta.nome}</p>
        <p className="mt-0.5 text-[11.5px] text-dim">
          {plano.nome} · R$ {plano.preco} por mês
        </p>
      </div>

      <div className="w-full sm:w-[220px]">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[12.5px] font-semibold ${tom}`}>
            {conta.conversas.toLocaleString('pt-BR')} de{' '}
            {plano.conversas.toLocaleString('pt-BR')}
          </span>
          <span className="text-[11px] text-dim">conversas</span>
        </div>

        {/*
          A barra para de crescer em 100% e a cor é que denuncia o estouro, senão
          uma conta com o dobro da faixa empurraria a linha inteira para fora.
        */}
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full ${
              estourou ? 'bg-perigo' : perto ? 'bg-aviso' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(100, Math.round(fracao * 100))}%` }}
          />
        </div>
      </div>

      <div className="w-[96px] shrink-0 text-right">
        <p className="text-[12.5px] text-muted">{comoTamanho(conta.bytes)}</p>
        <p className="text-[11px] text-dim">
          {conta.arquivos.toLocaleString('pt-BR')} arquivo
          {conta.arquivos === 1 ? '' : 's'}
        </p>
      </div>
    </article>
  )
}
