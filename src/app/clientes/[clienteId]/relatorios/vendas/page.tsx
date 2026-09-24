import { notFound } from 'next/navigation'
import { AjudaDaTela, type PassoDaAjuda } from '@/components/design/ajuda-da-tela'
import { ClienteShell } from '@/components/design/cliente-shell'
import { SemAcesso } from '@/components/design/sem-acesso'
import { GraficoMensal } from '@/components/relatorios/grafico-mensal'
import { dinheiroCurto, emFatias } from '@/components/relatorios/formatos'
import { CaixaDoBloco, FunilInvertido, ListaEmBarras, Rosca, Vazio } from '@/components/relatorios/graficos'
import { PainelDeBlocos, type Bloco } from '@/components/relatorios/painel-de-blocos'
import { BarraDoPeriodo, Cartao, Mudanca, MudancaDeTempo, MudancaEmPontos } from '@/components/relatorios/pecas'
import { SeletorDeFunil } from '@/components/relatorios/seletor-de-funil'
import { TabelaDaEquipe, VendasVazio, type LinhaDaEquipe } from '@/components/relatorios/vendas'
import {
  completarMeses,
  diasAteFechar,
  maiorPerda,
  mesesAte,
  ordenarMotivos,
  passagemPorEtapa,
  taxaDeVitoria,
  ticketMedio,
} from '@/core/analise-de-vendas'
import { comoDinheiro } from '@/core/crm'
import { pode } from '@/core/permissoes'
import { ATALHOS_DE_VENDAS, hojeEmSaoPaulo, lerPeriodo, periodoAnterior, type Periodo } from '@/core/relatorios'
import { capacidadeNaPagina, filtroDoAcesso } from '@/server/permissoes'
import { arranjoDaAnalise } from '@/server/preferencias'
import {
  alcanceDosNegocios,
  existeNegocio,
  ganhosPorMes,
  ganhosPorOrigem,
  ganhosPorProduto,
  motivosDePerda,
  negociosEmAberto,
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
 * e quem vende, em blocos que a pessoa esconde, mostra e reordena.
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
  {
    titulo: 'Leia os blocos',
    texto: 'Funil, ranking de quem vende, receita por mês, motivos de perda, o que está aberto e o que mais vende.',
  },
  { titulo: 'Troque a medida', texto: 'Nos blocos com Quantidade e Valor, um toque reordena pelo que importa agora.' },
  { titulo: 'Personalize', texto: 'Em Personalizar, esconda o que não usa e mude a ordem. Fica guardado neste aparelho.' },
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

  const quadros = await listarQuadros(clienteId)
  const pedido = um(busca.funil)
  const quadroId = quadros.some((q) => q.id === pedido) ? pedido! : null

  const responsaveis = await responsaveisDoEscopo(clienteId, escopo)
  const contaInteira = responsaveis === null
  // A conta toda, e não o funil escolhido: funil vazio mostra zeros com o
  // seletor à vista, senão a pessoa ficaria presa numa tela sem saída.
  const temNegocio = await existeNegocio(clienteId, responsaveis, null)

  // O endereço guarda período e funil: cada vista pode ser salva.
  const base = `/clientes/${cliente.id}/relatorios/vendas`
  const doPeriodo: Record<string, string> =
    periodo.atalho === null
      ? { de: periodo.de, ate: periodo.ate }
      : periodo.atalho === PADRAO
        ? {}
        : { dias: String(periodo.atalho) }
  const doFunil: Record<string, string> = quadroId ? { funil: quadroId } : {}

  const blocos = temNegocio
    ? await blocosDeVendas({
        clienteId: cliente.id,
        periodo,
        anterior,
        responsaveis,
        quadroId,
        quadros,
        podeVerValor,
        contaInteira,
      })
    : []
  const arranjo = await arranjoDaAnalise('vendas')

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
              <strong className="text-ink">Ganho e perdido contam no dia em que o negócio foi fechado.</strong> Um negócio criado
              em março e ganho em maio conta em maio.
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
            <div className="mt-4">
              <PainelDeBlocos
                pagina="vendas"
                arranjoInicial={arranjo}
                blocos={blocos}
                barra={
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-4">
                    <BarraDoPeriodo
                      base={base}
                      periodo={periodo}
                      anterior={anterior}
                      hoje={hoje}
                      atalhos={ATALHOS_DE_VENDAS}
                      padrao={PADRAO}
                      manter={doFunil}
                      rotuloDoAtalho={(dias) => (dias === 365 ? '12 meses' : `${dias} dias`)}
                    />
                    {quadros.length > 1 && (
                      <SeletorDeFunil
                        funis={quadros.map((q) => ({ id: q.id, nome: q.nome }))}
                        escolhido={quadroId}
                        base={base}
                        manter={doPeriodo}
                      />
                    )}
                  </div>
                }
              />
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
  anterior: Periodo
  responsaveis: Responsaveis
  quadroId: string | null
  quadros: Awaited<ReturnType<typeof listarQuadros>>
  podeVerValor: boolean
  contaInteira: boolean
}

function comoDiasAteGanhar(segundos: number | null): string {
  const dias = diasAteFechar(segundos)
  if (dias === null) return 'sem dado'
  if (dias === 0) return 'mesmo dia'
  return dias === 1 ? '1 dia' : `${dias} dias`
}

/**
 * Todos os blocos de Vendas, com os dados de cada um. O pool fala uma conexão
 * por vez: consultas em sequência, e não em `Promise.all`.
 *
 * Quem não vê valor (`ler_valores`) não recebe R$ em bloco nenhum: os
 * cartões de dinheiro saem, e os alternadores ficam só em quantidade.
 */
async function blocosDeVendas({
  clienteId,
  periodo,
  anterior,
  responsaveis,
  quadroId,
  quadros,
  podeVerValor,
  contaInteira,
}: Recorte): Promise<Bloco[]> {
  const atual = await totaisDeVendas(clienteId, periodo, responsaveis, quadroId)
  const antes = await totaisDeVendas(clienteId, anterior, responsaveis, quadroId)
  const meses = mesesDoGrafico(periodo)
  const porMes = completarMeses(
    await ganhosPorMes(clienteId, { de: `${meses[0]}-01`, ate: periodo.ate }, responsaveis, quadroId),
    meses,
  )
  const motivos = ordenarMotivos(await motivosDePerda(clienteId, periodo, responsaveis, quadroId))

  // Etapa é de um funil só: o escolhido, ou o padrão quando a vista é "todos".
  const funil = quadros.find((q) => q.id === quadroId) ?? quadros.find((q) => q.padrao) ?? quadros[0]
  const passagens = funil
    ? passagemPorEtapa(
        funil.etapas.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem, tipo: e.tipo ?? 'normal' })),
        await alcanceDosNegocios(clienteId, periodo, responsaveis, funil.id),
      )
    : []
  const aberto = funil ? await negociosEmAberto(clienteId, responsaveis, funil.id) : []
  const produtos = await ganhosPorProduto(clienteId, periodo, responsaveis, quadroId)
  const origens = await ganhosPorOrigem(clienteId, periodo, responsaveis, quadroId)
  const pessoas = await vendasPorPessoa(clienteId, periodo, responsaveis, quadroId)
  const membros = pessoas.length > 0 ? await membrosDaConta(clienteId) : []

  const nomeDe = (id: string | null) =>
    id === null ? 'Sem responsável' : membros.find((m) => m.id === id)?.nome || 'alguém que saiu da organização'
  const linhasDaEquipe: LinhaDaEquipe[] = pessoas
    .map((p) => ({
      chave: p.usuarioId ?? 'sem',
      nome: nomeDe(p.usuarioId),
      ganhos: p.ganhos,
      perdidos: p.perdidos,
      valor: p.valor,
      taxa: taxaDeVitoria(p.ganhos, p.perdidos),
      segundosAteGanhar: p.segundosAteGanhar,
    }))
    // Quem mais fecha primeiro; "sem responsável" sempre no fim, não é alguém.
    .sort((a, b) => Number(a.chave === 'sem') - Number(b.chave === 'sem') || b.ganhos - a.ganhos)

  const taxa = taxaDeVitoria(atual.ganhos, atual.perdidos)
  const fechados = atual.ganhos + atual.perdidos
  const ticket = ticketMedio(atual.valor, atual.ganhosComValor)
  const ticketAntes = ticketMedio(antes.valor, antes.ganhosComValor)
  const semValor = atual.ganhos - atual.ganhosComValor
  const abertoN = aberto.reduce((s, e) => s + e.n, 0)
  const abertoValor = aberto.reduce((s, e) => s + (e.valor ?? 0), 0)
  const pior = maiorPerda(passagens)
  // A linha miúda dos cartões: os mesmos meses do gráfico de receita.
  const tendenciaDeGanhos = porMes.map((m) => m.ganhos)

  const cartoes = [
    podeVerValor && (
      <Cartao
        key="valor"
        vazio={atual.ganhos === 0 && 'Sem vendas no período'}
        titulo="Ganho no período"
        valor={atual.valor === null ? 'R$ 0,00' : dinheiroCurto(atual.valor)}
        detalhe={
          [
            atual.valor !== null && atual.valor >= 10_000 ? comoDinheiro(atual.valor) : null,
            semValor > 0
              ? `${semValor} ${semValor === 1 ? 'ganho sem valor fica' : 'ganhos sem valor ficam'} fora da soma`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        tendencia={porMes.map((m) => m.valor ?? 0)}
        comparacao={<Mudanca atual={atual.valor ?? 0} antes={antes.valor ?? 0} formatar={comoDinheiro} />}
        definicao="Soma do valor dos negócios marcados como ganhos no período, pelo dia em que foram fechados. A linha miúda é a receita mês a mês."
      />
    ),
    <Cartao
      key="ganhos"
      vazio={fechados === 0 && 'Sem negócios fechados'}
      titulo="Negócios ganhos"
      valor={String(atual.ganhos)}
      detalhe={`${atual.perdidos} ${atual.perdidos === 1 ? 'perdido' : 'perdidos'} no mesmo período`}
      tendencia={tendenciaDeGanhos}
      comparacao={<Mudanca atual={atual.ganhos} antes={antes.ganhos} />}
      definicao="Negócios marcados como ganhos no período, pelo dia em que foram fechados, com ou sem valor anotado. A linha miúda é mês a mês."
    />,
    <Cartao
      key="taxa"
      vazio={taxa === null && 'Sem negócios fechados'}
      titulo="Taxa de vitória"
      valor={taxa === null ? 'sem dado' : `${taxa}%`}
      medidor={taxa}
      detalhe={fechados === 0 ? 'nenhum negócio fechado no período' : `${atual.ganhos} de ${fechados} fechados`}
      comparacao={<MudancaEmPontos atual={taxa} antes={taxaDeVitoria(antes.ganhos, antes.perdidos)} melhorQuando="sobe" />}
      definicao="Dos negócios fechados no período, quantos foram ganhos. Os abertos ficam fora da conta: ainda podem virar qualquer coisa."
    />,
    podeVerValor && (
      <Cartao
        key="ticket"
        vazio={ticket === null && 'Sem vendas com valor'}
        titulo="Ticket médio"
        valor={ticket === null ? 'sem dado' : dinheiroCurto(ticket)}
        detalhe={
          ticket === null
            ? 'nenhum ganho com valor no período'
            : `média de ${atual.ganhosComValor} ${atual.ganhosComValor === 1 ? 'ganho' : 'ganhos'} com valor`
        }
        comparacao={<Mudanca atual={ticket} antes={ticketAntes} formatar={comoDinheiro} />}
        definicao="Valor ganho dividido pelos negócios ganhos que têm valor anotado. Ganho sem valor fica fora da média, para não puxá-la para baixo."
      />
    ),
    <Cartao
      key="ciclo"
      vazio={atual.segundosAteGanhar === null && 'Sem vendas no período'}
      titulo="Ciclo de venda"
      valor={comoDiasAteGanhar(atual.segundosAteGanhar)}
      detalhe="média, da criação do negócio ao ganho"
      comparacao={
        atual.segundosAteGanhar !== null && antes.segundosAteGanhar !== null ? (
          <MudancaDeTempo atual={atual.segundosAteGanhar} antes={antes.segundosAteGanhar} />
        ) : undefined
      }
      definicao="Tempo médio entre a criação do negócio e o ganho, entre os negócios ganhos no período."
    />,
    <Cartao
      key="aberto"
      vazio={abertoN === 0 && 'Nada em aberto agora'}
      titulo="Em aberto agora"
      valor={
        podeVerValor && abertoValor > 0 ? dinheiroCurto(abertoValor) : `${abertoN} ${abertoN === 1 ? 'negócio' : 'negócios'}`
      }
      detalhe={
        podeVerValor && abertoValor > 0
          ? `${abertoN} ${abertoN === 1 ? 'negócio' : 'negócios'} no funil ${funil?.nome ?? ''}`
          : `no funil ${funil?.nome ?? ''}`
      }
      definicao="Negócios que ainda não foram ganhos nem perdidos, hoje, no funil mostrado. Não depende do período: é o que está na mesa agora."
    />,
  ].filter(Boolean)

  const blocos: Bloco[] = [
    {
      id: 'numeros',
      titulo: 'Números do período',
      largura: 'inteira',
      conteudo: (
        <div
          className={`grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 ${cartoes.length === 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-4'}`}
        >
          {cartoes}
        </div>
      ),
    },
    {
      id: 'funil',
      titulo: 'Funil',
      largura: 'metade',
      conteudo: (
        <CaixaDoBloco
          titulo="Funil de vendas"
          subtitulo={
            <>
              Negócios criados no período no funil <strong className="font-semibold text-soft">{funil?.nome}</strong>, e até onde
              cada um chegou.
            </>
          }
        >
          {!funil || (passagens[0]?.chegaram ?? 0) === 0 ? (
            <Vazio desenho="funil">Nenhum negócio foi criado neste funil no período.</Vazio>
          ) : (
            <FunilInvertido
              degraus={passagens.map((p, i) => ({
                chave: p.etapa.id,
                rotulo: p.etapa.nome,
                n: p.chegaram,
                taxa: i === 0 ? null : (passagens[i - 1]?.taxa ?? null),
                perdeuMais: pior === i - 1,
              }))}
            />
          )}
        </CaixaDoBloco>
      ),
    },
  ]

  // Ranking só faz sentido com mais de uma pessoa à vista.
  const vendedores = linhasDaEquipe.filter((l) => l.chave !== 'sem' && l.ganhos > 0)
  if (contaInteira || vendedores.length >= 2) {
    blocos.push({
      id: 'ranking',
      titulo: 'Ranking de vendas',
      largura: 'metade',
      conteudo: (
        <ListaEmBarras
          titulo="Ranking de vendas"
          desenho="podio"
          subtitulo="Quem mais ganhou negócios no período. Troque a medida para ver quem trouxe mais dinheiro."
          ranking
          valorPermitido={podeVerValor}
          rotuloQuantidade="Quantidade"
          unidade={['negócio ganho', 'negócios ganhos']}
          vazio="Nenhum negócio ganho no período."
          linhas={vendedores.map((l) => ({
            chave: l.chave,
            rotulo: l.nome,
            n: l.ganhos,
            valor: l.valor,
            detalhe: `${l.taxa === null ? '-' : `${l.taxa}%`} de vitória · ${comoDiasAteGanhar(l.segundosAteGanhar)} até ganhar`,
          }))}
        />
      ),
    })
  }

  blocos.push(
    {
      id: 'receita',
      titulo: podeVerValor ? 'Receita por mês' : 'Ganhos por mês',
      largura: 'dois-tercos',
      conteudo: <GraficoMensal meses={porMes} de={periodo.de} ate={periodo.ate} emValor={podeVerValor} />,
    },
    {
      id: 'motivos',
      titulo: 'Por que perdemos',
      largura: 'terco',
      conteudo: (
        <CaixaDoBloco titulo="Por que perdemos" subtitulo="Motivo anotado em cada negócio perdido no período.">
          {motivos.length === 0 ? (
            <Vazio desenho="motivos">Nenhum negócio perdido no período.</Vazio>
          ) : (
            <Rosca
              totalRotulo={motivos.reduce((s, m) => s + m.n, 0) === 1 ? 'perdido' : 'perdidos'}
              fatias={emFatias(
                motivos.filter((m) => !m.semMotivo).map((m) => ({ chave: m.rotulo, rotulo: m.rotulo, n: m.n })),
              ).concat(
                motivos
                  .filter((m) => m.semMotivo)
                  .map((m) => ({ chave: '__sem', rotulo: m.rotulo, n: m.n, cor: 'var(--line-strong)' })),
              )}
            />
          )}
        </CaixaDoBloco>
      ),
    },
    {
      id: 'aberto',
      titulo: 'Em aberto por etapa',
      largura: 'terco',
      conteudo: (
        <ListaEmBarras
          titulo="Em aberto por etapa"
          desenho="etapas"
          subtitulo={`Onde estão hoje os negócios abertos do funil ${funil?.nome ?? ''}.`}
          manterOrdem
          valorPermitido={podeVerValor}
          unidade={['negócio', 'negócios']}
          vazio="Nenhum negócio aberto agora."
          linhas={abertoN === 0 ? [] : aberto.map((e) => ({ chave: e.id, rotulo: e.nome, n: e.n, valor: e.valor }))}
        />
      ),
    },
    {
      id: 'produtos',
      titulo: 'O que mais vende',
      largura: 'terco',
      conteudo: (
        <ListaEmBarras
          titulo="O que mais vende"
          desenho="maisVendidos"
          subtitulo="Negócios ganhos no período, pelo produto ou serviço do negócio."
          valorPermitido={podeVerValor}
          maximo={6}
          unidade={['ganho', 'ganhos']}
          vazio="Nenhum negócio ganho no período."
          linhas={produtos.map((p) => ({
            chave: p.rotulo ?? '__sem',
            rotulo: p.rotulo ?? 'Sem produto anotado',
            n: p.n,
            valor: p.valor,
            apagada: p.rotulo === null,
          }))}
        />
      ),
    },
    {
      id: 'origem',
      titulo: 'De onde vêm as vendas',
      largura: 'terco',
      conteudo: (
        <ListaEmBarras
          titulo="De onde vêm as vendas"
          desenho="origemDasVendas"
          subtitulo="Negócios ganhos, pela campanha do primeiro anúncio em que o cliente clicou."
          valorPermitido={podeVerValor}
          maximo={6}
          unidade={['ganho', 'ganhos']}
          vazio="Nenhum negócio ganho no período."
          linhas={origens.map((o) => ({
            chave: o.anuncio ? `a:${o.rotulo ?? ''}` : 'direto',
            rotulo: o.anuncio ? o.rotulo || 'Anúncio sem campanha' : 'Chegou sem anúncio',
            n: o.n,
            valor: o.valor,
            apagada: !o.anuncio,
          }))}
        />
      ),
    },
    {
      id: 'equipe',
      titulo: 'Quem vende (tabela)',
      largura: 'inteira',
      conteudo: <TabelaDaEquipe linhas={linhasDaEquipe} podeVerValor={podeVerValor} />,
    },
  )

  return blocos
}
