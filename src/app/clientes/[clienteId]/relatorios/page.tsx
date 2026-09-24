import { notFound } from 'next/navigation'
import { AjudaDaTela, type PassoDaAjuda } from '@/components/design/ajuda-da-tela'
import { ClienteShell } from '@/components/design/cliente-shell'
import { GraficoDiario } from '@/components/relatorios/grafico-diario'
import { BarraDoPeriodo, Cartao, Mudanca, MudancaDeTempo, MudancaEmPontos } from '@/components/relatorios/pecas'
import { comoDinheiro } from '@/core/crm'
import { taxaDeAutomacao, terminadas } from '@/core/desfecho-da-conversa'
import { pode } from '@/core/permissoes'
import { comoDuracao, completarDias, hojeEmSaoPaulo, lerPeriodo, periodoAnterior } from '@/core/relatorios'
import { capacidadeNaPagina, filtroDoAcesso } from '@/server/permissoes'
import { SemAcesso } from '@/components/design/sem-acesso'
import { acharCliente } from '@/server/repos/clientes'
import {
  atendimentosPorPessoa,
  responsaveisDoEscopo,
  serieDoPeriodo,
  totaisDoPeriodo,
} from '@/server/repos/relatorios'
import { membrosDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * Relatórios (plano de UX de 23/09, tarefa 11.1).
 *
 * A home responde "o que precisa de mim agora"; esta tela responde "como o
 * período andou". Por isso os números que moravam na home vieram para cá, com
 * período escolhível e comparação com o período anterior do mesmo tamanho.
 *
 * **O escopo vai para a consulta.** Quem atende só os próprios contatos vê os
 * números deles, e nunca o agregado da conta (H05). A tela diz isso no topo,
 * para ninguém comparar o próprio número com o da conta achando que é o mesmo.
 *
 * Sem exportação nesta rodada, de propósito (decisão do plano).
 */

const PASSOS_DA_AJUDA: PassoDaAjuda[] = [
  {
    titulo: 'Escolha o período',
    texto: '7, 30 ou 90 dias até hoje, ou um intervalo seu. Cada dia é o dia de Brasília.',
  },
  {
    titulo: 'Compare',
    texto: 'Cada número mostra quanto mudou em relação ao período anterior, do mesmo tamanho e logo antes.',
  },
  {
    titulo: 'Veja dia a dia',
    texto: 'O gráfico mostra todos os dias do período, inclusive os que não tiveram nada.',
  },
]

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'atender', 'proprios')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="relatorios">
        <SemAcesso clienteId={clienteId} oQue="Relatórios" />
      </ClienteShell>
    )
  }
  const escopo = filtroDoAcesso(acesso, 'atender')
  const podeVerValor = pode(acesso.regras, 'ler_valores', 'proprios')

  const hoje = hojeEmSaoPaulo()
  const periodo = lerPeriodo(await searchParams, hoje)
  const anterior = periodoAnterior(periodo)

  const responsaveis = await responsaveisDoEscopo(clienteId, escopo)
  const contaInteira = responsaveis === null
  // O pool fala uma conexão por vez: em sequência, e não em `Promise.all`.
  const atual = await totaisDoPeriodo(clienteId, periodo, responsaveis)
  const antes = await totaisDoPeriodo(clienteId, anterior, responsaveis)
  const serie = completarDias(await serieDoPeriodo(clienteId, periodo, responsaveis), periodo.de, periodo.ate, (dia) => ({
    dia,
    contatosNovos: 0,
    conversas: 0,
    foramParaPessoa: 0,
  }))
  const pessoas = contaInteira ? await atendimentosPorPessoa(clienteId, periodo, responsaveis) : []
  const equipe = pessoas.length >= 2 ? await membrosDaConta(clienteId) : []

  const base = `/clientes/${cliente.id}/relatorios`
  const cruzaAno = periodo.de.slice(0, 4) !== periodo.ate.slice(0, 4)
  const automacao = taxaDeAutomacao(atual.desfechos)
  const automacaoAntes = taxaDeAutomacao(antes.desfechos)

  return (
    <ClienteShell cliente={cliente} ativa="relatorios">
      <main className="mx-auto w-full max-w-[1280px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Relatórios</h1>
          <AjudaDaTela
            titulo="Como ler os relatórios"
            resumo="Números do atendimento no período escolhido, comparados com o período anterior."
            passos={PASSOS_DA_AJUDA}
          >
            <p>
              <strong className="text-ink">Os dias são os de Brasília.</strong> Uma conversa das 22h conta no dia em que
              aconteceu, mesmo que o servidor já esteja no dia seguinte.
            </p>
            <p>
              <strong className="text-ink">Cada número tem um ?</strong> com a definição exata do que ele conta.
            </p>
          </AjudaDaTela>
        </div>
        <p className="mt-1.5 text-[13px] leading-6 text-dim">
          {contaInteira
            ? 'Como o atendimento andou no período.'
            : escopo.tipo === 'proprios'
              ? 'Só os contatos que estão com você. Os números da organização inteira ficam com quem gerencia.'
              : 'Só os contatos das suas equipes.'}
        </p>

        <div className="mt-4">
          <BarraDoPeriodo base={base} periodo={periodo} anterior={anterior} hoje={hoje} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Cartao
            titulo="Conversas"
            valor={String(atual.conversas)}
            comparacao={<Mudanca atual={atual.conversas} antes={antes.conversas} />}
            definicao="Conversas que começaram no período, em qualquer canal ligado a uma automação da conta."
          />
          <Cartao
            titulo="Contatos novos"
            valor={String(atual.contatosNovos)}
            comparacao={<Mudanca atual={atual.contatosNovos} antes={antes.contatosNovos} />}
            definicao="Pessoas que falaram com a organização pela primeira vez no período (o dia em que o contato foi criado)."
          />
          <Cartao
            titulo="Resolvidas pela automação"
            valor={automacao === null ? 'sem dado' : `${automacao}%`}
            detalhe={
              automacao === null
                ? 'nenhuma conversa terminou ainda'
                : `${atual.desfechos.bot} de ${terminadas(atual.desfechos)} que terminaram`
            }
            comparacao={<MudancaEmPontos atual={automacao} antes={automacaoAntes} melhorQuando="sobe" />}
            definicao="Das conversas do período que já terminaram, quantas a automação resolveu sozinha, sem passar por ninguém da equipe. As que ainda estão acontecendo ficam fora da conta."
          />
          <Cartao
            titulo="Espera pela equipe"
            valor={atual.tempos.medianaAteResponder === null ? 'sem dado' : comoDuracao(atual.tempos.medianaAteResponder)}
            detalhe={
              atual.tempos.entraramNaFila === 0
                ? 'ninguém pediu uma pessoa'
                : `mediana · média ${comoDuracao(atual.tempos.mediaAteResponder)} · ${atual.tempos.responderam} de ${atual.tempos.entraramNaFila} respondidas`
            }
            comparacao={
              <MudancaDeTempo atual={atual.tempos.medianaAteResponder} antes={antes.tempos.medianaAteResponder} />
            }
            definicao="Do momento em que a conversa foi para a equipe até a primeira resposta enviada. A mediana é o atendimento típico; a média mostra se alguém esperou muito mais. Conversa sem resposta ainda não entra na conta."
          />
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_336px]">
          <div className="flex min-w-0 flex-col gap-5">
            <GraficoDiario serie={serie} cruzaAno={cruzaAno} />
            <ComoTerminaram totais={atual} />
          </div>

          <aside className="flex min-w-0 flex-col gap-3">
            <Cartao
              titulo="Satisfação (NPS)"
              valor={atual.satisfacao.nps === null ? 'sem dado' : String(atual.satisfacao.nps)}
              detalhe={
                atual.satisfacao.respostas === 0
                  ? 'ninguém respondeu a pesquisa no período'
                  : `média ${atual.satisfacao.media?.toLocaleString('pt-BR')} · ${atual.satisfacao.respostas} ${atual.satisfacao.respostas === 1 ? 'resposta' : 'respostas'} · ${atual.satisfacao.promotores} promotores, ${atual.satisfacao.detratores} detratores`
              }
              comparacao={
                <MudancaEmPontos atual={atual.satisfacao.nps} antes={antes.satisfacao.nps} melhorQuando="sobe" />
              }
              definicao="Notas de 0 a 10 da pesquisa de satisfação, dadas no período. NPS é o percentual de notas 9 e 10 menos o de notas até 6; vai de -100 a 100."
            />
            <Cartao
              titulo="Fechamentos"
              valor={`${atual.fechamentos.ganhos} ${atual.fechamentos.ganhos === 1 ? 'ganho' : 'ganhos'}`}
              detalhe={[
                podeVerValor && atual.fechamentos.valor !== null ? comoDinheiro(atual.fechamentos.valor) : null,
                podeVerValor && atual.fechamentos.valor === null && atual.fechamentos.ganhos > 0
                  ? 'nenhum ganho com valor anotado'
                  : null,
                `${atual.fechamentos.perdidos} ${atual.fechamentos.perdidos === 1 ? 'perdido' : 'perdidos'}`,
              ]
                .filter(Boolean)
                .join(' · ')}
              comparacao={<Mudanca atual={atual.fechamentos.ganhos} antes={antes.fechamentos.ganhos} />}
              definicao="Negócios do funil de vendas marcados como ganhos ou perdidos no período, pelo dia em que foram fechados."
            />
            {pessoas.length >= 2 && (
              <QuemAtendeu
                pessoas={pessoas.map((p) => ({
                  ...p,
                  nome: equipe.find((m) => m.id === p.usuarioId)?.nome || 'alguém que saiu da organização',
                }))}
              />
            )}
          </aside>
        </div>
      </main>
    </ClienteShell>
  )
}

// ---------------------------------------------------------------------------
// Desfechos e pessoas
// ---------------------------------------------------------------------------

/**
 * As quatro fatias, e elas somam o total de conversas de propósito: painel
 * cujas partes não fecham com o todo é painel que ninguém consegue conferir.
 */
function ComoTerminaram({ totais }: { totais: { conversas: number; desfechos: Record<'bot' | 'prevista' | 'falha' | 'aberta', number> } }) {
  const { conversas, desfechos } = totais
  const fatias = [
    { rotulo: 'Resolvidas pela automação', n: desfechos.bot, dica: 'Terminaram sem passar por ninguém da equipe.' },
    { rotulo: 'Atendidas pela equipe', n: desfechos.prevista, dica: 'O fluxo previa passar para uma pessoa, ou alguém assumiu pelo Inbox.' },
    { rotulo: 'Interrompidas por um erro', n: desfechos.falha, dica: 'Pararam por um problema técnico e foram para a equipe. O motivo está escrito na conversa, no Inbox.', atencao: true },
    { rotulo: 'Ainda acontecendo', n: desfechos.aberta, dica: 'Não terminaram, então ficam fora da taxa da automação.' },
  ]
  return (
    <section className="app-card px-5 py-4" aria-labelledby="titulo-desfechos">
      <h2 id="titulo-desfechos" className="text-[14px] font-bold">
        Como as conversas terminaram
      </h2>
      {conversas === 0 ? (
        <p className="mt-2 text-[13px] text-dim">Nenhuma conversa começou neste período.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {fatias.map((f) => {
            const pct = Math.round((f.n / conversas) * 100)
            const alerta = f.atencao && f.n > 0
            return (
              <li key={f.rotulo}>
                <div className="flex items-baseline gap-2 text-[12.5px]">
                  <strong className={`tabular-nums ${alerta ? 'text-aviso' : 'text-ink'}`}>{f.n}</strong>
                  <span className={alerta ? 'text-aviso' : 'text-soft'}>{f.rotulo}</span>
                  <span className="ml-auto text-[11.5px] tabular-nums text-dim">{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-strong" aria-hidden>
                  <div className={`h-full rounded-full ${alerta ? 'bg-aviso' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-0.5 text-[11px] text-dim">{f.dica}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * Volume por pessoa, e não tempo: a responsabilidade pode trocar de mãos no
 * meio, e dividir a espera cobraria de alguém o atraso de outro. Só aparece
 * para quem vê a conta inteira e com duas pessoas ou mais.
 */
function QuemAtendeu({ pessoas }: { pessoas: { usuarioId: string; nome: string; atendimentos: number; fechados: number }[] }) {
  return (
    <section className="app-card overflow-hidden" aria-labelledby="titulo-pessoas">
      <h2 id="titulo-pessoas" className="px-4 pt-3.5 pb-2 text-[12.5px] font-bold text-muted">
        Quem atendeu
      </h2>
      <ul>
        {pessoas.map((p) => (
          <li key={p.usuarioId} className="flex items-center gap-3 border-t border-line-soft px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.nome}</span>
            <span className="whitespace-nowrap text-[11.5px] text-dim">
              <strong className="font-semibold text-soft">{p.atendimentos}</strong> atend. ·{' '}
              <strong className="font-semibold text-soft">{p.fechados}</strong> fechados
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
