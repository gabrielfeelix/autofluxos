import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Dropdown } from '@/components/design/dropdown'
import { LinhaClicavel } from '@/components/lead/linha-clicavel'
import { rotuloDoCampo } from '@/core/contatos/rotulo-do-campo'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { horaExata, quando } from '@/lib/quando'
import { acharCliente } from '@/server/repos/clientes'
import {
  RESPOSTAS_POR_PAGINA,
  paginarRespostas,
  type DesfechoDaResposta,
} from '@/server/repos/respostas'

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
}

const DESFECHOS: { chave: DesfechoDaResposta | null; rotulo: string; dica: string }[] = [
  { chave: null, rotulo: 'Todas', dica: 'Todas as passagens pela automação' },
  { chave: 'bot', rotulo: 'Terminou com o bot', dica: 'A conversa acabou sem precisar de gente' },
  { chave: 'pessoa', rotulo: 'Foi para uma pessoa', dica: 'Alguém do time assumiu a conversa' },
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
    pagina?: number
  },
): string {
  const parametros = new URLSearchParams()
  if (filtro.fluxo) parametros.set('fluxo', filtro.fluxo)
  if (filtro.busca) parametros.set('busca', filtro.busca)
  if (filtro.desfecho) parametros.set('desfecho', filtro.desfecho)
  if (filtro.pagina && filtro.pagina > 1) parametros.set('pagina', String(filtro.pagina))

  const consulta = parametros.toString()
  return `/clientes/${clienteId}/respostas${consulta ? `?${consulta}` : ''}`
}

/** O CSV sai com o mesmo filtro da tela, pelo motivo escrito na rota. */
function enderecoDoCsv(
  clienteId: string,
  filtro: { fluxo?: string | null; busca?: string; desfecho?: DesfechoDaResposta | null },
): string {
  const parametros = new URLSearchParams()
  if (filtro.fluxo) parametros.set('fluxo', filtro.fluxo)
  if (filtro.busca) parametros.set('busca', filtro.busca)
  if (filtro.desfecho) parametros.set('desfecho', filtro.desfecho)

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
        <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Respostas</h1>
            <p className="mt-1 max-w-[640px] text-[12px] text-muted">
              Uma linha por conversa, com o que a pessoa respondeu naquela passagem. A tela de
              Contatos guarda o valor mais recente de cada pessoa; aqui fica o histórico, resposta
              por resposta.
            </p>
          </div>
        </div>

        <Suspense
          key={`${fluxo}-${termo}-${desfecho}-${pagina}`}
          fallback={<Esqueleto />}
        >
          <Tabela
            clienteId={cliente.id}
            fluxo={fluxo}
            termo={termo}
            desfecho={desfecho}
            pagina={pagina}
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
}: {
  clienteId: string
  fluxo: string | null
  termo: string
  desfecho: DesfechoDaResposta | null
  pagina: number
}) {
  const { respostas, colunas, total, pagina, paginas, automacoes } = await paginarRespostas(
    clienteId,
    { fluxoId: fluxo, busca: termo, desfecho, pagina: pedida },
  )

  const filtrando = Boolean(fluxo) || termo !== '' || desfecho !== null
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
          className="app-primary-button mt-4 inline-block px-4 py-2 text-[12px]"
        >
          Ir para Automações
        </Link>
      </div>
    )
  }

  return (
    <>
      {/*
        Uma linha só: filtro à esquerda, contagem e CSV à direita.

        A contagem sai da mesma consulta que desenha a tabela, e é por isso que
        ela mora aqui dentro e não no cabeçalho da página: subi-la obrigaria a
        repetir `paginarRespostas` só para escrever um número.

        **O seletor é o `Dropdown` do produto, não o `<select>` do sistema.** O
        nativo abre com o desenho do sistema operacional, ignora o tema escuro
        e não combina com o resto do painel, que é a razão registrada no próprio
        componente e a mesma que a tela de Funil já seguia. Ele mantém a
        semântica de formulário por um `input` oculto, então o `form` continua
        sendo um GET comum.
      */}
      <form
        action={`/clientes/${clienteId}/respostas`}
        className="mb-3 flex flex-wrap items-center gap-2"
      >
        {desfecho && <input type="hidden" name="desfecho" value={desfecho} />}
        <span className="w-[260px] shrink-0">
          <Dropdown
            nome="fluxo"
            valorInicial={fluxo ?? ''}
            rotuloAcessivel="Automação"
            className="w-full text-[12.5px]"
            opcoes={[
              { valor: '', rotulo: 'Todas as automações' },
              ...automacoes.map((automacao) => ({
                valor: automacao.id,
                rotulo: automacao.nome,
              })),
            ]}
          />
        </span>
        <label className="min-w-[200px] flex-1">
          <span className="sr-only">Buscar por nome ou telefone</span>
          <input
            type="search"
            name="busca"
            defaultValue={termo}
            placeholder="Buscar por nome ou telefone"
            className="app-field px-3 py-2 text-[12.5px]"
          />
        </label>
        <button type="submit" className="app-secondary-button px-4 py-2 text-[12px]">
          Filtrar
        </button>
        {filtrando && (
          <Link
            href={`/clientes/${clienteId}/respostas`}
            className="text-[11.5px] font-semibold text-primary hover:underline"
            scroll={false}
          >
            Limpar
          </Link>
        )}

        <span className="ml-auto flex items-center gap-2">
          <span className="whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-muted">
            {total} {total === 1 ? 'resposta' : 'respostas'}
            {filtrando && ' no filtro'}
          </span>
          <a
            href={enderecoDoCsv(clienteId, { fluxo, busca: termo, desfecho })}
            className="app-secondary-button whitespace-nowrap px-3 py-1.5 text-[11.5px]"
            title="Baixar como planilha exatamente o que este filtro mostra"
          >
            Baixar CSV
          </a>
        </span>
      </form>

      <nav aria-label="Desfecho" className="mb-[18px] flex flex-wrap gap-1.5">
        {DESFECHOS.map((opcao) => (
          <Link
            key={opcao.rotulo}
            href={endereco(clienteId, { fluxo, busca: termo, desfecho: opcao.chave })}
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
      </nav>

      {respostas.length === 0 ? (
        <div className="app-card py-14 text-center">
          <p className="text-[13px] font-bold">
            {termo !== ''
              ? `Ninguém com "${termo}" respondeu`
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
                    <Cabecalho>Pessoa</Cabecalho>
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
                      className="cursor-pointer border-b border-line transition last:border-0 hover:bg-surface"
                    >
                      <td className="px-3.5 py-3">
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
                          {resposta.vars[coluna] || <span className="text-dim">,</span>}
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

function Cabecalho({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="whitespace-nowrap px-3.5 py-2.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-dim uppercase"
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
    <Link href={href} scroll={false} className="app-secondary-button px-3 py-1.5 text-[11.5px]">
      {children}
    </Link>
  )
}
