import { notFound } from 'next/navigation'
import { AjudaDaTela, type PassoDaAjuda } from '@/components/design/ajuda-da-tela'
import { ClienteShell } from '@/components/design/cliente-shell'
import { SemAcesso } from '@/components/design/sem-acesso'
import { GraficoMensal } from '@/components/relatorios/grafico-mensal'
import { BarraDoPeriodo, Cartao, Mudanca, MudancaEmPontos } from '@/components/relatorios/pecas'
import { SeletorDeFunil } from '@/components/relatorios/seletor-de-funil'
import {
  AbasDeVendas,
  MotivosDePerda,
  PassagemPorEtapa,
  TabelaDaEquipe,
  VendasVazio,
  type LinhaDaEquipe,
} from '@/components/relatorios/vendas'
import {
  completarMeses,
  diasAteFechar,
  lerAbaDeVendas,
  mesesAte,
  ordenarMotivos,
  passagemPorEtapa,
  taxaDeVitoria,
  ticketMedio,
  type AbaDeVendas,
} from '@/core/analise-de-vendas'
import { comoDinheiro } from '@/core/crm'
import { pode } from '@/core/permissoes'
import { ATALHOS_DE_VENDAS, hojeEmSaoPaulo, lerPeriodo, periodoAnterior, type Periodo } from '@/core/relatorios'
import { capacidadeNaPagina, filtroDoAcesso } from '@/server/permissoes'
import {
  alcanceDosNegocios,
  existeNegocio,
  ganhosPorMes,
  motivosDePerda,
  totaisDeVendas,
  vendasPorPessoa,
} from '@/server/repos/analise-de-vendas'
import { acharCliente } from '@/server/repos/clientes'
import { listarQuadros } from '@/server/repos/quadros'
import { responsaveisDoEscopo, type Responsaveis } from '@/server/repos/relatorios'
import { membrosDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * Análise > Vendas (plano de navegação e CRM, 5.3): quanto entrou, onde perco
 * e quem vende, uma pergunta por aba.
 *
 * A porta é a de Negócios (`criar_oportunidade`), e o escopo dela vai para a
 * consulta: quem vê só os próprios negócios vê os números dos próprios. Valor
 * em dinheiro só para quem tem `ler_valores`; os outros veem quantidade, sem
 * R$ em lugar nenhum da tela.
 *
 * As definições moram em `repos/analise-de-vendas.ts` e são as mesmas do
 * cartão "Fechamentos" de Atendimento.
 */

const PADRAO = 90

const PASSOS_DA_AJUDA: PassoDaAjuda[] = [
  { titulo: 'Escolha o período', texto: 'Um mês, um trimestre, um ano, ou um intervalo seu. Cada dia é o dia de Brasília.' },
  { titulo: 'Receita', texto: 'Quanto foi ganho no período e como cada mês do último ano se compara.' },
  { titulo: 'Conversão', texto: 'Quantos negócios viram venda, em que etapa eles param e por que foram perdidos.' },
  { titulo: 'Equipe', texto: 'Quem fecha mais, com que taxa e em quanto tempo.' },
]

function um(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

/** Quantos meses o gráfico mostra: um ano, ou mais se o período for maior. */
function mesesDoGrafico(periodo: Periodo): string[] {
  const inicio = periodo.de.slice(0, 7)
  let quantos = 12
  while (mesesAte(periodo.ate, quantos)[0]! > inicio) quantos++
  return mesesAte(periodo.ate, quantos)
}

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

  const acesso = await capacidadeNaPagina(clienteId, 'criar_oportunidade', 'proprios')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="vendas">
        <SemAcesso clienteId={clienteId} oQue="Vendas" />
      </ClienteShell>
    )
  }
  const escopo = filtroDoAcesso(acesso, 'criar_oportunidade')
  const podeVerValor = pode(acesso.regras, 'ler_valores', 'proprios')

  const busca = await searchParams
  const hoje = hojeEmSaoPaulo()
  const periodo = lerPeriodo(busca, hoje, ATALHOS_DE_VENDAS, PADRAO)
  const anterior = periodoAnterior(periodo)
  const aba = lerAbaDeVendas(um(busca.aba))

  const quadros = await listarQuadros(clienteId)
  const pedido = um(busca.funil)
  const quadroId = quadros.some((q) => q.id === pedido) ? pedido! : null

  const responsaveis = await responsaveisDoEscopo(clienteId, escopo)
  const contaInteira = responsaveis === null
  // A conta toda, e não o funil escolhido: funil vazio mostra zeros com o
  // seletor à vista, senão a pessoa ficaria presa numa tela sem saída.
  const temNegocio = await existeNegocio(clienteId, responsaveis, null)

  // O endereço guarda período, aba e funil: cada vista pode ser salva.
  const base = `/clientes/${cliente.id}/relatorios/vendas`
  const doPeriodo: Record<string, string> =
    periodo.atalho === null
      ? { de: periodo.de, ate: periodo.ate }
      : periodo.atalho === PADRAO
        ? {}
        : { dias: String(periodo.atalho) }
  const doFunil: Record<string, string> = quadroId ? { funil: quadroId } : {}
  const daAba = (a: AbaDeVendas): Record<string, string> => (a === 'receita' ? {} : { aba: a })
  const enderecoDaAba = (a: AbaDeVendas) => {
    const texto = new URLSearchParams({ ...daAba(a), ...doPeriodo, ...doFunil }).toString()
    return texto ? `${base}?${texto}` : base
  }

  return (
    <ClienteShell cliente={cliente} ativa="vendas">
      <main className="mx-auto w-full max-w-[1280px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Vendas</h1>
          <AjudaDaTela
            titulo="Como ler as vendas"
            resumo="O resultado dos negócios no período escolhido, comparado com o período anterior do mesmo tamanho."
            passos={PASSOS_DA_AJUDA}
          >
            <p>
              <strong className="text-ink">Ganho e perdido contam no dia em que o negócio foi fechado.</strong> Um
              negócio criado em março e ganho em maio conta em maio.
            </p>
            <p>
              <strong className="text-ink">Cada número tem um ?</strong> com a definição exata do que ele conta.
            </p>
          </AjudaDaTela>
        </div>
        <p className="mt-1.5 text-[13px] leading-6 text-dim">
          {contaInteira
            ? 'Quanto entrou, onde os negócios param e quem vende.'
            : escopo.tipo === 'proprios'
              ? 'Só os negócios que estão com você. Os números da organização inteira ficam com quem gerencia.'
              : 'Só os negócios das suas equipes.'}
        </p>

        {!temNegocio ? (
          <div className="mt-5">
            <VendasVazio clienteId={cliente.id} />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <BarraDoPeriodo
                base={base}
                periodo={periodo}
                anterior={anterior}
                hoje={hoje}
                atalhos={ATALHOS_DE_VENDAS}
                padrao={PADRAO}
                manter={{ ...daAba(aba), ...doFunil }}
                rotuloDoAtalho={(dias) => (dias === 365 ? '12 meses' : `${dias} dias`)}
              />
              {quadros.length > 1 && (
                <SeletorDeFunil
                  funis={quadros.map((q) => ({ id: q.id, nome: q.nome }))}
                  escolhido={quadroId}
                  base={base}
                  manter={{ ...daAba(aba), ...doPeriodo }}
                />
              )}
            </div>

            <div className="mt-5">
              <AbasDeVendas ativa={aba} endereco={enderecoDaAba} />
            </div>

            <div className="mt-5">
              {aba === 'receita' ? (
                <Receita
                  clienteId={cliente.id}
                  periodo={periodo}
                  anterior={anterior}
                  responsaveis={responsaveis}
                  quadroId={quadroId}
                  podeVerValor={podeVerValor}
                />
              ) : aba === 'conversao' ? (
                <Conversao
                  clienteId={cliente.id}
                  periodo={periodo}
                  anterior={anterior}
                  responsaveis={responsaveis}
                  quadroId={quadroId}
                  quadros={quadros}
                />
              ) : (
                <Equipe
                  clienteId={cliente.id}
                  periodo={periodo}
                  responsaveis={responsaveis}
                  quadroId={quadroId}
                  podeVerValor={podeVerValor}
                />
              )}
            </div>
          </>
        )}
      </main>
    </ClienteShell>
  )
}

type Recorte = {
  clienteId: string
  periodo: Periodo
  responsaveis: Responsaveis
  quadroId: string | null
}

// O pool fala uma conexão por vez: consultas em sequência, e não em `Promise.all`.

async function Receita({
  clienteId,
  periodo,
  anterior,
  responsaveis,
  quadroId,
  podeVerValor,
}: Recorte & { anterior: Periodo; podeVerValor: boolean }) {
  const atual = await totaisDeVendas(clienteId, periodo, responsaveis, quadroId)
  const antes = await totaisDeVendas(clienteId, anterior, responsaveis, quadroId)
  const meses = mesesDoGrafico(periodo)
  const linhas = await ganhosPorMes(clienteId, { de: `${meses[0]}-01`, ate: periodo.ate }, responsaveis, quadroId)
  const ticket = ticketMedio(atual.valor, atual.ganhosComValor)
  const ticketAntes = ticketMedio(antes.valor, antes.ganhosComValor)
  const semValor = atual.ganhos - atual.ganhosComValor

  return (
    <div className="flex flex-col gap-5">
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${podeVerValor ? 'lg:grid-cols-3' : ''}`}>
        {podeVerValor && (
          <Cartao
            titulo="Ganho no período"
            valor={atual.valor === null ? 'R$ 0,00' : comoDinheiro(atual.valor)}
            detalhe={
              semValor > 0
                ? semValor === 1
                  ? '1 ganho está sem valor anotado e fica fora da soma'
                  : `${semValor} ganhos estão sem valor anotado e ficam fora da soma`
                : undefined
            }
            comparacao={<Mudanca atual={atual.valor ?? 0} antes={antes.valor ?? 0} formatar={comoDinheiro} />}
            definicao="Soma do valor dos negócios marcados como ganhos no período, pelo dia em que foram fechados."
          />
        )}
        <Cartao
          titulo="Negócios ganhos"
          valor={String(atual.ganhos)}
          detalhe={`${atual.perdidos} ${atual.perdidos === 1 ? 'perdido' : 'perdidos'} no mesmo período`}
          comparacao={<Mudanca atual={atual.ganhos} antes={antes.ganhos} />}
          definicao="Negócios marcados como ganhos no período, pelo dia em que foram fechados, com ou sem valor anotado."
        />
        {podeVerValor ? (
          <Cartao
            titulo="Ticket médio"
            valor={ticket === null ? 'sem dado' : comoDinheiro(ticket)}
            detalhe={ticket === null ? 'nenhum ganho com valor no período' : `média de ${atual.ganhosComValor} ${atual.ganhosComValor === 1 ? 'ganho' : 'ganhos'} com valor`}
            comparacao={<Mudanca atual={ticket} antes={ticketAntes} formatar={comoDinheiro} />}
            definicao="Valor ganho dividido pelos negócios ganhos que têm valor anotado. Ganho sem valor fica fora da média, para não puxá-la para baixo."
          />
        ) : (
          <Cartao
            titulo="Taxa de vitória"
            valor={taxaDeVitoria(atual.ganhos, atual.perdidos) === null ? 'sem dado' : `${taxaDeVitoria(atual.ganhos, atual.perdidos)}%`}
            comparacao={
              <MudancaEmPontos
                atual={taxaDeVitoria(atual.ganhos, atual.perdidos)}
                antes={taxaDeVitoria(antes.ganhos, antes.perdidos)}
                melhorQuando="sobe"
              />
            }
            definicao="Dos negócios fechados no período, quantos foram ganhos. Os abertos ficam fora da conta."
          />
        )}
      </div>

      <GraficoMensal meses={completarMeses(linhas, meses)} de={periodo.de} ate={periodo.ate} emValor={podeVerValor} />
    </div>
  )
}

async function Conversao({
  clienteId,
  periodo,
  anterior,
  responsaveis,
  quadroId,
  quadros,
}: Recorte & { anterior: Periodo; quadros: Awaited<ReturnType<typeof listarQuadros>> }) {
  const atual = await totaisDeVendas(clienteId, periodo, responsaveis, quadroId)
  const antes = await totaisDeVendas(clienteId, anterior, responsaveis, quadroId)
  const motivos = ordenarMotivos(await motivosDePerda(clienteId, periodo, responsaveis, quadroId))

  // Etapa é de um funil só: o escolhido, ou o padrão quando a vista é "todos".
  const funil = quadros.find((q) => q.id === quadroId) ?? quadros.find((q) => q.padrao) ?? quadros[0]
  const passagens = funil
    ? passagemPorEtapa(
        funil.etapas.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem, tipo: e.tipo ?? 'normal' })),
        await alcanceDosNegocios(clienteId, periodo, responsaveis, funil.id),
      )
    : []

  const taxa = taxaDeVitoria(atual.ganhos, atual.perdidos)
  const fechados = atual.ganhos + atual.perdidos

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Cartao
          titulo="Taxa de vitória"
          valor={taxa === null ? 'sem dado' : `${taxa}%`}
          detalhe={fechados === 0 ? 'nenhum negócio fechado no período' : `${atual.ganhos} de ${fechados} fechados`}
          comparacao={
            <MudancaEmPontos atual={taxa} antes={taxaDeVitoria(antes.ganhos, antes.perdidos)} melhorQuando="sobe" />
          }
          definicao="Dos negócios fechados no período, quantos foram ganhos. Os abertos ficam fora da conta: ainda podem virar qualquer coisa."
        />
        <Cartao
          titulo="Ganhos"
          valor={String(atual.ganhos)}
          comparacao={<Mudanca atual={atual.ganhos} antes={antes.ganhos} />}
          definicao="Negócios marcados como ganhos no período, pelo dia em que foram fechados."
        />
        <Cartao
          titulo="Perdidos"
          valor={String(atual.perdidos)}
          comparacao={<Mudanca atual={atual.perdidos} antes={antes.perdidos} />}
          definicao="Negócios marcados como perdidos no período, pelo dia em que foram fechados."
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {funil ? (
          <PassagemPorEtapa passagens={passagens} funil={funil.nome} />
        ) : (
          <section className="app-card px-5 py-4 text-[13px] text-dim">Nenhum funil criado ainda.</section>
        )}
        <MotivosDePerda motivos={motivos} />
      </div>
    </div>
  )
}

async function Equipe({ clienteId, periodo, responsaveis, quadroId, podeVerValor }: Recorte & { podeVerValor: boolean }) {
  const pessoas = await vendasPorPessoa(clienteId, periodo, responsaveis, quadroId)
  const membros = pessoas.length > 0 ? await membrosDaConta(clienteId) : []
  const linhas: LinhaDaEquipe[] = pessoas.map((p) => ({
    chave: p.usuarioId ?? 'sem',
    nome:
      p.usuarioId === null
        ? 'Sem responsável'
        : membros.find((m) => m.id === p.usuarioId)?.nome || 'alguém que saiu da organização',
    ganhos: p.ganhos,
    perdidos: p.perdidos,
    valor: p.valor,
    taxa: taxaDeVitoria(p.ganhos, p.perdidos),
    segundosAteGanhar: p.segundosAteGanhar,
  }))
  // Quem mais fecha primeiro; "sem responsável" sempre no fim, não é alguém.
  linhas.sort((a, b) => Number(a.chave === 'sem') - Number(b.chave === 'sem') || b.ganhos - a.ganhos)

  const lider = linhas.find((l) => l.chave !== 'sem' && l.ganhos > 0)
  const maisRapido = [...linhas]
    .filter((l) => l.chave !== 'sem' && l.segundosAteGanhar !== null)
    .sort((a, b) => a.segundosAteGanhar! - b.segundosAteGanhar!)[0]

  return (
    <div className="flex flex-col gap-5">
      {linhas.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cartao
            titulo="Pessoas que fecharam"
            valor={String(linhas.filter((l) => l.chave !== 'sem').length)}
            definicao="Responsáveis com ao menos um negócio ganho ou perdido no período."
          />
          <Cartao
            titulo="Quem mais ganhou"
            valor={lider ? lider.nome : 'ninguém'}
            detalhe={lider ? `${lider.ganhos} ${lider.ganhos === 1 ? 'ganho' : 'ganhos'}` : undefined}
            definicao="O responsável com mais negócios ganhos no período."
          />
          <Cartao
            titulo="Fecha mais rápido"
            valor={maisRapido ? maisRapido.nome : 'sem dado'}
            detalhe={
              maisRapido
                ? `em média ${diasAteFechar(maisRapido.segundosAteGanhar) === 0 ? 'no mesmo dia' : `${diasAteFechar(maisRapido.segundosAteGanhar)} dias`} da criação ao ganho`
                : undefined
            }
            definicao="Menor tempo médio entre a criação do negócio e o ganho, entre os ganhos do período."
          />
        </div>
      )}
      <TabelaDaEquipe linhas={linhas} podeVerValor={podeVerValor} />
    </div>
  )
}
