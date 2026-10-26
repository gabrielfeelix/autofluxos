import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ClienteShell } from '@/components/design/cliente-shell'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Pilula } from '@/components/design/pilula'
import { BarraDeRespostas } from '@/components/respostas/barra-de-respostas'
import { LinhaClicavel } from '@/components/lead/linha-clicavel'
import { rotuloDoCampo } from '@/core/contatos/rotulo-do-campo'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { horaExata, quando } from '@/lib/quando'
import { acharCliente } from '@/server/repos/clientes'
import { acharFluxo } from '@/server/repos/fluxos'
import {
  perguntasDeEscolha,
  variavelDoFiltro,
  type ResumoDaPergunta,
} from '@/core/respostas-por-escolha'
import {
  RESPOSTAS_POR_PAGINA,
  automacoesDaConta,
  grafoDasRespostas,
  paginarRespostas,
  resumirRespostas,
  type DesfechoDaResposta,
} from '@/server/repos/respostas'
import { IlustracaoRespostas } from '@/components/design/ilustracoes'

export const dynamic = 'force-dynamic'

/**
 * O histórico de respostas da conta.
 *
 * ---------------------------------------------------------------------------
 * Por que uma tela só, com filtro, e não uma tela por automação
 * ---------------------------------------------------------------------------
 *
 * As duas portas de entrada pedem coisas diferentes: o botão no topo do editor
 * quer **tudo** (quem desenha acabou de publicar e quer ver o que está
 * chegando), e o número no cartão da automação quer **só aquela** (a pergunta
 * ali é "o que esta colheu"). Fossem duas rotas, a busca, a paginação, o CSV e
 * o cabeçalho dinâmico existiriam duas vezes e passariam a divergir na primeira
 * correção feita só de um lado.
 *
 * Então é uma rota, e o cartão entra por `?fluxo=<id>`. O seletor no topo troca
 * de automação sem sair da tela, que é o que faltava para comparar duas.
 *
 * **A aba acesa é "Automações"** (`ativa="fluxos"`): esta tela é sobre o que as
 * automações colheram, e acender item nenhum deixaria a barra lateral parecendo
 * quebrada, como a chave antiga `leads` já acende "Contatos".
 */

type Busca = {
  fluxo?: string | string[]
  busca?: string | string[]
  pagina?: string | string[]
  desfecho?: string | string[]
  resposta?: string | string[]
  valor?: string | string[]
}

/** O filtro por resposta de uma pergunta: Frete = "Achei caro". */
type FiltroDeResposta = { variavel: string; valor: string } | null

const DESFECHOS: { chave: DesfechoDaResposta | null; rotulo: string; dica: string }[] = [
  { chave: null, rotulo: 'Todas', dica: 'Todas as passagens pela automação' },
  { chave: 'bot', rotulo: 'Terminou com o bot', dica: 'A conversa terminou sem precisar de atendente' },
  { chave: 'pessoa', rotulo: 'Transferida para uma pessoa', dica: 'Alguém do time assumiu a conversa' },
  { chave: 'aberta', rotulo: 'Não terminou', dica: 'Parou no meio, sem desfecho' },
]

function primeiro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? (valor[0] ?? '') : (valor ?? '')
}

function desfechoValido(valor: string | string[] | undefined): DesfechoDaResposta | null {
  const bruto = primeiro(valor)
  return DESFECHOS.find((d) => d.chave === bruto)?.chave ?? null
}

/** O endereço desta mesma tela com outro filtro, sem perder os demais. */
function endereco(
  clienteId: string,
  filtro: {
    fluxo?: string | null
    busca?: string
    desfecho?: DesfechoDaResposta | null
    resposta?: FiltroDeResposta
    pagina?: number
  },
): string {
  const parametros = new URLSearchParams()
  if (filtro.fluxo) parametros.set('fluxo', filtro.fluxo)
  if (filtro.busca) parametros.set('busca', filtro.busca)
  if (filtro.desfecho) parametros.set('desfecho', filtro.desfecho)
  if (filtro.fluxo && filtro.resposta) {
    parametros.set('resposta', filtro.resposta.variavel)
    parametros.set('valor', filtro.resposta.valor)
  }
  if (filtro.pagina && filtro.pagina > 1) parametros.set('pagina', String(filtro.pagina))

  const consulta = parametros.toString()
  return `/clientes/${clienteId}/respostas${consulta ? `?${consulta}` : ''}`
}

/** O CSV sai com o mesmo filtro da tela, pelo motivo escrito na rota. */
function enderecoDoCsv(
  clienteId: string,
  filtro: {
    fluxo?: string | null
    busca?: string
    desfecho?: DesfechoDaResposta | null
    resposta?: FiltroDeResposta
  },
): string {
  const parametros = new URLSearchParams()
  if (filtro.fluxo) parametros.set('fluxo', filtro.fluxo)
  if (filtro.busca) parametros.set('busca', filtro.busca)
  if (filtro.desfecho) parametros.set('desfecho', filtro.desfecho)
  if (filtro.fluxo && filtro.resposta) {
    parametros.set('resposta', filtro.resposta.variavel)
    parametros.set('valor', filtro.resposta.valor)
  }

  const consulta = parametros.toString()
  return `/api/clientes/${clienteId}/respostas/csv${consulta ? `?${consulta}` : ''}`
}

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<Busca>
}) {
  const [{ clienteId }, busca] = await Promise.all([params, searchParams])
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const fluxo = primeiro(busca.fluxo) || null
  const termo = primeiro(busca.busca).trim()
  const desfecho = desfechoValido(busca.desfecho)
  const pagina = Math.max(1, Number(primeiro(busca.pagina)) || 1)
  // Cru: a variável só é conferida contra o desenho dentro da `<Tabela>`, que
  // já carrega o grafo para o resumo. Sem automação, o filtro não existe.
  const respostaPedida = fluxo ? primeiro(busca.resposta) : ''
  const valorPedido = fluxo ? primeiro(busca.valor) : ''

  /*
   * O nome da automação filtrada, só para a trilha.
   *
   * Fica aqui fora, e não dentro da `<Tabela>` (que já o descobre pela lista de
   * automações), porque a trilha precisa aparecer **antes** do carregamento: é
   * ela que diz de onde a pessoa veio, e uma trilha que só chega junto com a
   * tabela não serve para voltar enquanto a tabela carrega. O custo é uma
   * consulta por id, e só quando há filtro.
   */
  const [automacao, automacoes] = await Promise.all([
    fluxo ? acharFluxo(fluxo) : null,
    automacoesDaConta(cliente.id),
  ])
  const daConta = automacao?.clienteId === cliente.id ? automacao : null

  return (
    <ClienteShell cliente={cliente} ativa="fluxos">
      <main className="flex min-h-full flex-col px-4 md:px-[42px] pt-[26px] pb-[42px]">
        {/*
          O título e os botões dividem a **mesma linha**, em vez de os botões
          subirem por `-mt`.

          A margem negativa é o truque que a tela de Contatos usa para encaixar
          a barra de ações ao lado de um título sem descrição. Aqui há
          descrição, e o truque escondeu a segunda linha dela atrás do seletor:
          texto coberto por controle, exatamente o defeito que o print mostrou.
          Com `flex` de verdade, a descrição ocupa o que precisa e as ações
          ficam à direita, descendo para baixo dela no celular.
        */}
        {/*
          A trilha só aparece filtrada por uma automação: é quando esta tela tem
          de onde voltar além do caminho do cabeçalho ("Automações › Respostas
          coletadas"), que sem filtro ela só repetiria.
        */}
        <CabecalhoDaTela
          trilha={
            daConta
              ? [
                  { rotulo: 'Automações', href: `/clientes/${cliente.id}/fluxos` },
                  { rotulo: daConta.nome, href: `/clientes/${cliente.id}/fluxos/${daConta.id}` },
                  { rotulo: 'Respostas coletadas' },
                ]
              : undefined
          }
          titulo="Respostas coletadas"
          descricao="Uma linha por conversa, com o que a pessoa respondeu naquela passagem. A tela de Contatos guarda o valor mais recente de cada pessoa; aqui fica o histórico, resposta por resposta."
        />

        {automacoes.length > 0 && (
          <BarraDeRespostas
            base={`/clientes/${cliente.id}/respostas`}
            automacoes={automacoes}
            filtro={{ fluxo, busca: termo, desfecho, resposta: respostaPedida, valor: valorPedido }}
          />
        )}

        <Suspense
          key={`${fluxo}-${termo}-${desfecho}-${pagina}-${respostaPedida}-${valorPedido}`}
          fallback={<Esqueleto />}
        >
          <Tabela
            clienteId={cliente.id}
            fluxo={fluxo}
            termo={termo}
            desfecho={desfecho}
            pagina={pagina}
            respostaPedida={respostaPedida}
            valorPedido={valorPedido}
          />
        </Suspense>
      </main>
    </ClienteShell>
  )
}

function Esqueleto() {
  return (
    <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="h-11 border-b border-line bg-panel" />
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex h-14 animate-pulse items-center gap-3 border-b border-line px-3.5"
        >
          <span className="size-8 rounded-full bg-surface-strong" />
          <span className="h-3 w-40 rounded bg-surface-strong" />
        </div>
      ))}
      <span className="sr-only">Carregando as respostas…</span>
    </div>
  )
}

async function Tabela({
  clienteId,
  fluxo,
  termo,
  desfecho,
  pagina: pedida,
  respostaPedida,
  valorPedido,
}: {
  clienteId: string
  fluxo: string | null
  termo: string
  desfecho: DesfechoDaResposta | null
  pagina: number
  respostaPedida: string
  valorPedido: string
}) {
  /*
   * O desenho da automação escolhida decide duas coisas: quais perguntas têm
   * resumo (as de escolha) e se a variável do endereço é dela. Variável que não
   * é do fluxo cai como filtro nenhum, em vez de virar caminho JSON na consulta.
   */
  const grafo = fluxo ? await grafoDasRespostas(clienteId, fluxo) : null
  const variavel = valorPedido ? variavelDoFiltro(respostaPedida, grafo) : null
  const resposta: FiltroDeResposta = variavel ? { variavel, valor: valorPedido } : null
  const perguntas = grafo ? perguntasDeEscolha(grafo) : []

  const [{ respostas, colunas, total, pagina, paginas, automacoes }, resumo] = await Promise.all([
    paginarRespostas(clienteId, { fluxoId: fluxo, busca: termo, desfecho, resposta, pagina: pedida }),
    fluxo && perguntas.length > 0
      ? resumirRespostas(clienteId, fluxo, perguntas, { busca: termo, desfecho })
      : null,
  ])

  const filtrando = Boolean(fluxo) || termo !== '' || desfecho !== null || resposta !== null
  const primeiroDaPagina = (pagina - 1) * RESPOSTAS_POR_PAGINA + 1
  const ultimoDaPagina = primeiroDaPagina + respostas.length - 1
  const nomeDoFluxo = automacoes.find((a) => a.id === fluxo)?.nome ?? null

  if (automacoes.length === 0) {
    return (
      <div className="mx-auto mt-16 max-w-[420px] text-center">
        <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-dim">SEM AUTOMAÇÃO</p>
        <p className="text-[13px] text-muted">
          Resposta é o que uma automação colhe. Desenhe a primeira e as conversas começam a aparecer
          aqui sozinhas.
        </p>
        <Link
          href={`/clientes/${clienteId}/fluxos`}
          className="botao-primario botao-md mt-4"
        >
          Ir para Automações
        </Link>
      </div>
    )
  }

  return (
    <>
      {/*
        Desfechos à esquerda, contagem e CSV à direita.

        A contagem sai da mesma consulta que desenha a tabela, e é por isso que
        ela mora aqui dentro, e não na barra de automação e busca: aquela fica
        fora do `Suspense` para o campo não perder o foco a cada letra.
      */}
      <div className="mb-[18px] flex flex-wrap items-center gap-x-2 gap-y-2.5">
        <nav aria-label="Desfecho" className="flex flex-wrap gap-1.5">
          {DESFECHOS.map((opcao) => (
            <Link
              key={opcao.rotulo}
              href={endereco(clienteId, { fluxo, busca: termo, desfecho: opcao.chave, resposta })}
              title={opcao.dica}
              scroll={false}
              className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${
                desfecho === opcao.chave
                  ? 'border-primary/50 bg-primary/[0.1] text-primary'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              {opcao.rotulo}
            </Link>
          ))}
          {/* O filtro por resposta vira pílula ao lado dos desfechos, com o × que
              o tira sem mexer nos outros. Sem ela, a única pista de que a lista
              está recortada seria a opção acesa no resumo, que pode estar fora
              da tela no celular. */}
          {resposta && (
            <Link
              href={endereco(clienteId, { fluxo, busca: termo, desfecho })}
              scroll={false}
              title="Remover este filtro"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/50 bg-primary/[0.1] py-1 pr-2 pl-3 text-[11.5px] font-semibold text-primary transition hover:bg-primary/[0.16]"
            >
              <span className="truncate">
                {rotuloDoCampo(resposta.variavel) || resposta.variavel}: {resposta.valor}
              </span>
              <span aria-hidden className="text-[13px] leading-none">×</span>
              <span className="sr-only">remover filtro</span>
            </Link>
          )}
        </nav>
        <span className="ml-auto flex items-center gap-2">
          <Pilula>
            {total} {total === 1 ? 'resposta' : 'respostas'}
            {filtrando && ' no filtro'}
          </Pilula>
          <a
            href={enderecoDoCsv(clienteId, { fluxo, busca: termo, desfecho, resposta })}
            className="botao-secundario botao-md"
            title="Baixar como planilha exatamente o que este filtro mostra"
          >
            Baixar CSV
          </a>
        </span>
      </div>

      {resumo && resumo.lidas > 0 && (
        <ResumoDasEscolhas
          perguntas={resumo.perguntas}
          lidas={resumo.lidas}
          noTeto={resumo.noTeto}
          ativa={resposta}
          hrefDe={(alvo) => endereco(clienteId, { fluxo, busca: termo, desfecho, resposta: alvo })}
        />
      )}

      {respostas.length === 0 ? (
        <div className="app-card py-14 text-center">
          {termo === '' && (
            <div className="mb-6">
              <IlustracaoRespostas />
            </div>
          )}
          <p className="text-[13px] font-bold">
            {termo !== ''
              ? `Ninguém com "${termo}" respondeu`
              : resposta
                ? `Ninguém respondeu “${resposta.valor}” em ${rotuloDoCampo(resposta.variavel) || resposta.variavel}`
                : nomeDoFluxo
                ? `“${nomeDoFluxo}” ainda não tem resposta aqui`
                : 'Nenhuma resposta ainda'}
          </p>
          <p className="mx-auto mt-2 max-w-[380px] text-[11.5px] text-muted">
            A linha nasce quando alguém entra na automação. Publicada e sem linha nenhuma, ninguém
            chegou a conversar com ela ainda.
          </p>
          {filtrando && (
            <Link
              href={`/clientes/${clienteId}/respostas`}
              className="mt-3 inline-block text-[11.5px] font-semibold text-primary hover:underline"
              scroll={false}
            >
              Limpar filtro
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <Cabecalho fixa>Pessoa</Cabecalho>
                    {/* A automação some quando a tela já está filtrada por uma:
                        repetir o mesmo nome em vinte linhas gasta a largura que
                        as respostas precisam. */}
                    {!fluxo && <Cabecalho>Automação</Cabecalho>}
                    <Cabecalho>Quando</Cabecalho>
                    <Cabecalho>Desfecho</Cabecalho>
                    {/* O rótulo, não a chave: `faturamento_label` em fonte de
                        código é o mesmo defeito que `rotuloDoCampo` já corrigiu
                        na lista de contatos. */}
                    {colunas.map((coluna) => (
                      <Cabecalho key={coluna}>{rotuloDoCampo(coluna) || coluna}</Cabecalho>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {respostas.map((resposta) => (
                    <LinhaClicavel
                      key={resposta.sessaoId}
                      href={`/clientes/${clienteId}/leads/${resposta.contatoId}`}
                      className="group cursor-pointer border-b border-line transition last:border-0 hover:bg-surface"
                    >
                      <td
                        className={`${COLUNA_FIXA} z-10 bg-panel px-3.5 py-3 transition group-hover:bg-surface`}
                      >
                        <Link
                          href={`/clientes/${clienteId}/leads/${resposta.contatoId}`}
                          className="block max-w-56 truncate text-[13px] font-bold transition hover:text-primary"
                        >
                          {resposta.nome ?? 'sem nome'}
                        </Link>
                        <span className="block whitespace-nowrap font-mono text-[10px] text-dim">
                          {resposta.waId ? telefoneLegivel(resposta.waId) : 'sem telefone'}
                        </span>
                      </td>
                      {!fluxo && (
                        <td className="max-w-44 truncate px-3.5 py-3 text-[11.5px] text-muted">
                          {resposta.fluxoNome}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3.5 py-3 text-[11.5px] text-muted">
                        <span title={horaExata(resposta.iniciadaEm)}>
                          {quando(resposta.iniciadaEm)}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <Desfecho valor={resposta.desfecho} />
                      </td>
                      {colunas.map((coluna) => (
                        <td
                          key={coluna}
                          className="max-w-48 truncate px-3.5 py-3 text-[11.5px] text-muted"
                          title={resposta.vars[coluna] ?? ''}
                        >
                          {resposta.vars[coluna] || <span className="text-dim" aria-label="sem dado">·</span>}
                        </td>
                      ))}
                    </LinhaClicavel>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {paginas > 1 && (
            <nav
              aria-label="Páginas de respostas"
              className="mt-3 flex flex-wrap items-center justify-between gap-2"
            >
              <p className="text-[11.5px] text-muted">
                {primeiroDaPagina}–{ultimoDaPagina} de {total}
              </p>
              <div className="flex items-center gap-2">
                <Passo
                  href={endereco(clienteId, {
                    fluxo,
                    busca: termo,
                    desfecho,
                    resposta,
                    pagina: pagina - 1,
                  })}
                  ativo={pagina > 1}
                >
                  ‹ Anterior
                </Passo>
                <span className="text-[11.5px] font-semibold text-muted">
                  Página {pagina} de {paginas}
                </span>
                <Passo
                  href={endereco(clienteId, {
                    fluxo,
                    busca: termo,
                    desfecho,
                    resposta,
                    pagina: pagina + 1,
                  })}
                  ativo={pagina < paginas}
                >
                  Próxima ›
                </Passo>
              </div>
            </nav>
          )}
        </>
      )}
    </>
  )
}

/**
 * O resumo das perguntas de escolha: um cartão por pergunta, uma linha por
 * opção, com percentual e contagem.
 *
 * **Cada opção é o filtro.** Ler "22% Achei caro" e querer ver quem são é o
 * mesmo gesto, então a linha é um link que filtra a tabela abaixo; clicar na
 * opção acesa desfaz. "Outras" não filtra: é a soma do que não é opção, e não
 * existe um valor só para comparar.
 *
 * A barra é a fração do total da pergunta, e não da maior opção: comparar
 * perguntas lado a lado só funciona se 50% tiver o mesmo comprimento nas duas.
 */
function ResumoDasEscolhas({
  perguntas,
  lidas,
  noTeto,
  ativa,
  hrefDe,
}: {
  perguntas: ResumoDaPergunta[]
  lidas: number
  noTeto: boolean
  ativa: FiltroDeResposta
  hrefDe: (alvo: FiltroDeResposta) => string
}) {
  return (
    <section aria-label="Resumo das respostas" className="mb-[18px]">
      {/* No celular, os cartões deslizam de lado em vez de empilhar: três
          perguntas empilhadas empurravam a tabela para a terceira tela. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
        {perguntas.map((pergunta) => (
          <div
            key={pergunta.variavel}
            className="app-card w-[85%] shrink-0 snap-start scroll-ml-4 p-4 md:w-auto"
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="truncate text-[13px] font-bold" title={pergunta.texto}>
                {rotuloDoCampo(pergunta.variavel) || pergunta.variavel}
              </h2>
              <span className="shrink-0 text-[11px] text-dim tabular-nums">
                {pergunta.respondidas} {pergunta.respondidas === 1 ? 'resposta' : 'respostas'}
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {pergunta.contagens.map((opcao) => {
                const acesa =
                  ativa?.variavel === pergunta.variavel && ativa.valor === opcao.rotulo
                return (
                  <li key={opcao.rotulo}>
                    <Link
                      href={hrefDe(acesa ? null : { variavel: pergunta.variavel, valor: opcao.rotulo })}
                      scroll={false}
                      aria-current={acesa ? 'true' : undefined}
                      title={acesa ? 'Remover este filtro' : `Ver só quem respondeu “${opcao.rotulo}”`}
                      className={`-mx-2 block rounded-lg px-2 py-1.5 transition ${
                        acesa ? 'bg-primary/[0.1]' : 'hover:bg-surface'
                      }`}
                    >
                      <OpcaoDoResumo opcao={opcao} acesa={acesa} />
                    </Link>
                  </li>
                )
              })}
              {pergunta.outras.total > 0 && (
                <li
                  className="-mx-2 px-2 py-1.5"
                  title="Respostas que não são uma das opções: texto digitado no lugar do botão ou opção que saiu da automação"
                >
                  <OpcaoDoResumo opcao={pergunta.outras} acesa={false} apagada />
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-dim">
        {noTeto
          ? `Calculado sobre as ${lidas.toLocaleString('pt-BR')} conversas mais recentes do filtro.`
          : `Calculado sobre ${lidas.toLocaleString('pt-BR')} ${lidas === 1 ? 'conversa' : 'conversas'} do filtro.`}{' '}
        Clique numa opção para ver quem respondeu.
      </p>
    </section>
  )
}

function OpcaoDoResumo({
  opcao,
  acesa,
  apagada = false,
}: {
  opcao: { rotulo: string; total: number; percentual: number }
  acesa: boolean
  apagada?: boolean
}) {
  return (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span
          className={`truncate text-[12.5px] ${
            acesa ? 'font-semibold text-primary' : apagada ? 'text-dim' : 'font-medium text-soft'
          }`}
        >
          {opcao.rotulo}
        </span>
        <span className="shrink-0 tabular-nums">
          <span className={`text-[13px] font-bold ${acesa ? 'text-primary' : ''}`}>
            {opcao.percentual}%
          </span>
          <span className="ml-1.5 text-[11px] text-dim">{opcao.total}</span>
        </span>
      </span>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface">
        <span
          className={`block h-full rounded-full ${
            acesa ? 'bg-primary' : apagada ? 'bg-surface-strong' : 'bg-primary/60'
          }`}
          style={{ width: `${opcao.percentual}%` }}
        />
      </span>
    </>
  )
}

/**
 * A coluna de quem respondeu não sai da tela ao rolar para o lado.
 *
 * São dez e tantas colunas de variável, então rolar horizontalmente é o uso
 * normal da tela, não a exceção. Sem isto, na terceira coluna já não se sabe de
 * quem é a linha: o "Agora não" da direita fica órfão, e conferir contra quem
 * respondeu vira rolar de ida e de volta contando linha com o dedo.
 *
 * **O fundo opaco é obrigatório**, e é o que quase sempre falta: célula grudada
 * sem fundo próprio deixa o conteúdo que passa por baixo aparecer através dela,
 * e o nome sai escrito por cima de um telefone de outra coluna. Ele acompanha o
 * `hover` da linha pelo `group`, senão a primeira coluna seria a única a não
 * acender quando o mouse passa, denunciando o truque.
 *
 * A sombra de 1px faz as vezes de borda: `border-collapse` já resolveu as
 * bordas da tabela, e uma borda a mais aqui brigaria com ela. Sombra não ocupa
 * espaço no fluxo e marca onde a tela foi cortada.
 */
const COLUNA_FIXA = 'sticky left-0 shadow-[1px_0_0_0_var(--line)]'

function Cabecalho({ children, fixa = false }: { children: React.ReactNode; fixa?: boolean }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3.5 py-2.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-dim uppercase ${
        fixa ? COLUNA_FIXA + ' z-20 bg-panel' : ''
      }`}
    >
      {children}
    </th>
  )
}

/**
 * O desfecho em palavra, e não em `true`/`false`.
 *
 * "Finalizado: false" (o que a ferramenta do print mostra) não distingue a
 * conversa que virou atendimento humano da que a pessoa abandonou no segundo
 * bloco, e essas duas pedem providências opostas.
 */
function Desfecho({ valor }: { valor: DesfechoDaResposta }) {
  if (valor === 'bot') {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10.5px] font-bold text-ok">
        TERMINOU COM O BOT
      </span>
    )
  }
  if (valor === 'pessoa') {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-2.5 py-1 text-[10.5px] font-bold text-aviso">
        FOI PARA UMA PESSOA
      </span>
    )
  }
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] font-bold text-muted">
      NÃO TERMINOU
    </span>
  )
}

function Passo({
  href,
  ativo,
  children,
}: {
  href: string
  ativo: boolean
  children: React.ReactNode
}) {
  if (!ativo) {
    return (
      <span className="rounded-lg border border-line px-3 py-1.5 text-[11.5px] text-dim">
        {children}
      </span>
    )
  }
  return (
    <Link href={href} scroll={false} className="botao-secundario botao-sm">
      {children}
    </Link>
  )
}
