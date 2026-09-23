import Link from 'next/link'
import { LinhaClicavel } from '@/components/lead/linha-clicavel'
import { rotuloDoCampo } from '@/core/contatos/rotulo-do-campo'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { IlustracaoContatos } from '@/components/design/ilustracoes'
import { cache, Suspense } from 'react'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import {
  ETIQUETAS_DE_LEAD,
  LEADS_POR_PAGINA,
  limparBusca,
  paginarLeads,
  contarLeads,
  type EtiquetaDeLead,
  type Lead,
} from '@/server/repos/leads'
import { horaExata, quando } from '@/lib/quando'
import { FichaDeEtiqueta } from '@/components/etiquetas/ficha'
import { CaixaDeSelecao, CaixaDeTodos, SelecaoDeContatos } from '@/components/lead/selecao'
import { MenuDoContato } from '@/components/lead/menu-do-contato'
import { ColunasDaTabela } from '@/components/lead/colunas-da-tabela'
import { BarraDeContatos } from '@/components/contatos/barra-de-contatos'
import { enderecoDosContatos } from '@/core/contatos/filtro'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { acaoCriarContato } from '@/server/acoes'
import { listarEtiquetasComContagem, type Etiqueta } from '@/server/repos/etiquetas'
import { listarQuadros } from '@/server/repos/quadros'
import { faixasDaConta, relacionamentoDeMuitos } from '@/server/repos/relacionamento'
import { contatosDoNivel } from '@/server/consultas/nivel'
import { FAIXAS_PADRAO, NIVEIS, type Nivel } from '@/core/relacionamento'
import { SeloDoCliente } from '@/components/lead-crm/selo-do-cliente'

export const dynamic = 'force-dynamic'

type Busca = {
  etiqueta?: string | string[]
  /** A etiqueta manual (0025). Nome diferente porque as duas famílias somam. */
  marca?: string | string[]
  busca?: string | string[]
  pagina?: string | string[]
  /** O nível do cliente (0070): ouro, prata, bronze, sem_compra. */
  nivel?: string | string[]
}

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ''
}

/** O nível pedido pela URL, se ele existir. Lixo na querystring vira "sem filtro". */
function nivelValido(valor: Busca['nivel']): Nivel | null {
  const unico = primeiro(valor)
  return (NIVEIS as readonly string[]).includes(unico) ? (unico as Nivel) : null
}

function etiquetaValida(valor: Busca['etiqueta']): EtiquetaDeLead | null {
  const unica = primeiro(valor)
  return ETIQUETAS_DE_LEAD.find((etiqueta) => etiqueta === unica) ?? null
}

/** A exportação leva o mesmo filtro da tela, ver o porquê na própria rota. */
function enderecoDoCsv(
  clienteId: string,
  etiqueta: EtiquetaDeLead | null,
  marca: string | null,
  busca: string,
  nivel: Nivel | null,
): string {
  const parametros = new URLSearchParams()
  if (etiqueta) parametros.set('etiqueta', etiqueta)
  if (marca) parametros.set('marca', marca)
  if (busca) parametros.set('busca', busca)
  // Sem isto, o CSV não vê a faixa e exporta a base inteira: é metade do
  // defeito da RB-37, e é a metade que sai por e-mail.
  if (nivel) parametros.set('nivel', nivel)

  const consulta = parametros.toString()
  return `/api/clientes/${clienteId}/leads/csv${consulta ? `?${consulta}` : ''}`
}

/** O filtro da tela, já validado. Tudo primitivo: é a chave do `cache` abaixo. */
type Filtro = {
  clienteId: string
  etiqueta: EtiquetaDeLead | null
  marca: string | null
  termo: string
  pagina: number
  nivel: Nivel | null
}

/**
 * A página de contatos pedida, lida uma vez por requisição.
 *
 * O cabeçalho (contagem, "Baixar CSV"), o botão Colunas e a tabela moram em
 * `Suspense` separados, e os três precisam da mesma página. O `cache` do React
 * faz os três receberem a mesma leitura em vez de três idas ao banco.
 */
const lerPagina = cache(
  async (clienteId: string, etiqueta: EtiquetaDeLead | null, marca: string | null, termo: string, pagina: number, nivel: Nivel | null) => {
    const faixas = (await faixasDaConta(clienteId)) ?? FAIXAS_PADRAO

    /*
      O filtro de nível é resolvido **no servidor**, antes de paginar (RB-37).

      Até a T6.1 ele era um `leads.filter(...)` sobre a página já carregada: a
      contagem dizia "3 de 50" (3 daquela página, não da base), a paginação
      ignorava o filtro, e o CSV nem o conhecia, quem filtrava por Ouro e
      exportava recebia todo mundo. Duas superfícies, duas definições.

      Agora `consultarContatos` responde quem está na faixa, olhando a conta
      inteira, e a lista de leads é restringida a esses contatos antes do
      `range`. A faixa vira condição por `condicoesDoNivel`, que é o mesmo
      caminho que a exportação usa.
    */
    const daFaixa = nivel ? await contatosDoNivel(clienteId, nivel, faixas) : null
    const resultado = await paginarLeads(clienteId, {
      // Contatos é a base inteira. Sem isto valia o padrão do Inbox
      // (`aberta`) e quem teve a conversa resolvida sumia da lista e do total.
      estado: 'todas',
      etiqueta,
      etiquetaId: marca,
      busca: termo,
      pagina,
      contatos: daFaixa,
    })
    return { ...resultado, faixas }
  },
)

const ler = (f: Filtro) => lerPagina(f.clienteId, f.etiqueta, f.marca, f.termo, f.pagina, f.nivel)
const filtrando = (f: Filtro) => f.etiqueta !== null || f.marca !== null || f.termo !== '' || f.nivel !== null

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

  const filtro: Filtro = {
    clienteId: cliente.id,
    etiqueta: etiquetaValida(busca.etiqueta),
    marca: primeiro(busca.marca) || null,
    termo: limparBusca(primeiro(busca.busca)),
    pagina: Math.max(1, Number(primeiro(busca.pagina)) || 1),
    nivel: nivelValido(busca.nivel),
  }
  const chave = `${filtro.etiqueta}-${filtro.marca}-${filtro.termo}-${filtro.pagina}-${filtro.nivel}`

  // O total da conta decide entre a tela de primeira vez e a tabela; as
  // etiquetas alimentam o popover de filtros. As duas leituras são baratas.
  const [totalDaConta, etiquetasDaConta] = await Promise.all([
    contarLeads(cliente.id),
    listarEtiquetasComContagem(cliente.id),
  ])

  return (
    <ClienteShell cliente={cliente} ativa="leads">
      <main className="flex min-h-full flex-col px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <CabecalhoDaTela filtro={filtro} chave={chave} totalDaConta={totalDaConta} />

        {totalDaConta === 0 ? (
          <PrimeiraVezDaConta clienteId={cliente.id} />
        ) : (
          <>
            <BarraDeContatos
              base={`/clientes/${cliente.id}/leads`}
              filtro={{ etiqueta: filtro.etiqueta, marca: filtro.marca, busca: filtro.termo, nivel: filtro.nivel }}
              manuais={etiquetasDaConta.map(({ id, nome, contatos }) => ({ id, nome, contatos: contatos ?? null }))}
              colunas={
                <Suspense key={chave} fallback={<ColunasEsperando />}>
                  <ColunasDoFiltro filtro={filtro} />
                </Suspense>
              }
            />
            {/*
              `min-h-0` e `flex-1` descem daqui até o cartão da tabela, que é quem
              precisa esticar. Sem o `min-h-0`, um filho de flex se recusa a encolher
              abaixo do próprio conteúdo e a rolagem escapa para a página inteira.
            */}
            <Suspense key={chave} fallback={<Esqueleto />}>
              <Tabela filtro={filtro} etiquetasDaConta={etiquetasDaConta} />
            </Suspense>
          </>
        )}
      </main>
    </ClienteShell>
  )
}

/**
 * Título, quantos são e as ações da tela.
 *
 * "+ Novo contato" fica aqui, fora da tabela, e por isso aparece também na conta
 * que ainda não tem ninguém: antes ele só existia com a tabela montada, e conta
 * nova sem número conectado não tinha como cadastrar o primeiro contato.
 */
function CabecalhoDaTela({ filtro, chave, totalDaConta }: { filtro: Filtro; chave: string; totalDaConta: number }) {
  const { clienteId } = filtro
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
      <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Contatos</h1>
      {totalDaConta > 0 && (
        <Suspense key={chave} fallback={null}>
          <Contagem filtro={filtro} totalDaConta={totalDaConta} />
        </Suspense>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Link
          href={`/clientes/${clienteId}/leads/importar`}
          className="quadro-tool"
          title="Casar a planilha do cliente com quem já conversou, e corrigir os nomes"
        >
          Importar
        </Link>
        <PopoverDoQuadro
          rotulo="Mais ações de contatos"
          largura={260}
          className="quadro-icon-button"
          gatilho={<IconeDoQuadro tipo="menu" />}
        >
          <Link href={`/clientes/${clienteId}/leads/segmentos`} data-fechar-popover className="quadro-menu-item">
            <span className="flex-1">
              Segmentos
              <span className="block text-[11px] font-normal text-dim">Grupos salvos por regra, com prévia de quem entra</span>
            </span>
          </Link>
          {totalDaConta > 0 && (
            <a
              href={enderecoDoCsv(clienteId, filtro.etiqueta, filtro.marca, filtro.termo, filtro.nivel)}
              data-fechar-popover
              className="quadro-menu-item"
            >
              <span className="flex-1">
                Baixar CSV
                <span className="block text-[11px] font-normal text-dim">
                  <Suspense fallback="Baixa os contatos do filtro atual">
                    <AlcanceDoCsv filtro={filtro} />
                  </Suspense>
                </span>
              </span>
            </a>
          )}
        </PopoverDoQuadro>
        <ModalFormulario
          botao="+ Novo contato"
          titulo="Novo contato"
          descricao="Para quem você já tem o telefone e ainda não escreveu por aqui. O bot só fala depois que a pessoa mandar a primeira mensagem, o WhatsApp não deixa começar conversa com texto livre."
          action={acaoCriarContato.bind(null, clienteId)}
        >
          <label>
            <RotuloCampo>Nome</RotuloCampo>
            <input
              name="nome"
              placeholder="ex.: Ana Souza"
              className="app-field px-[13px] py-[11px] text-[13.5px]"
            />
          </label>
          <label>
            <RotuloCampo>Telefone com DDD</RotuloCampo>
            <input
              name="telefone"
              required
              autoFocus
              placeholder="ex.: (11) 98765-4321"
              className="app-field px-[13px] py-[11px] text-[13.5px]"
            />
          </label>
        </ModalFormulario>
      </div>
    </div>
  )
}

async function Contagem({ filtro, totalDaConta }: { filtro: Filtro; totalDaConta: number }) {
  const { leads, total } = await ler(filtro)
  const esperando = leads.filter((lead) => lead.aguardando).length
  return (
    <>
      <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-muted tabular-nums">
        {filtrando(filtro)
          ? `${total} de ${totalDaConta} ${totalDaConta === 1 ? 'contato' : 'contatos'}`
          : `${total} ${total === 1 ? 'contato' : 'contatos'}`}
      </span>
      {esperando > 0 && (
        <span className="rounded-full border border-rose-400/25 bg-rose-400/[0.09] px-3 py-1 text-[11px] font-bold text-perigo">
          {esperando} esperando humano nesta página
        </span>
      )}
    </>
  )
}

/** O que o CSV leva, dito antes do clique: o filtro inteiro, não só a página. */
async function AlcanceDoCsv({ filtro }: { filtro: Filtro }) {
  const { total } = await ler(filtro)
  if (!filtrando(filtro)) return <>Baixa todos os {total} contatos</>
  return <>Baixa os {total} do filtro atual</>
}

/*
  O que o botão "Colunas" oferece: uma por variável coletada nesta página,
  depois as fixas. "Contato" fica de fora de propósito, tabela de contatos sem
  a coluna de contato é uma tela que não responde mais nada.
*/
async function ColunasDoFiltro({ filtro }: { filtro: Filtro }) {
  const { leads } = await ler(filtro)
  const colunasDisponiveis = [
    ...colunasDosCampos(leads).map((coluna) => ({ chave: coluna, rotulo: rotuloDoCampo(coluna) || coluna })),
    { chave: 'cliente', rotulo: 'Cliente' },
    { chave: 'situacao', rotulo: 'Situação' },
    { chave: 'ultima', rotulo: 'Última mensagem' },
  ]
  return <ColunasDaTabela clienteId={filtro.clienteId} colunas={colunasDisponiveis} />
}

function ColunasEsperando() {
  return (
    <button type="button" disabled className="quadro-tool opacity-60">
      Colunas
    </button>
  )
}

function Esqueleto() {
  return (
    <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="h-11 border-b border-line bg-panel" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-14 animate-pulse items-center gap-3 border-b border-line px-3.5">
          <span className="size-8 rounded-full bg-surface-strong" />
          <span className="h-3 w-36 rounded bg-surface-strong" />
        </div>
      ))}
      <span className="sr-only">Carregando os contatos…</span>
    </div>
  )
}

function colunasDosCampos(leads: Lead[]): string[] {
  const vistas: string[] = []
  for (const lead of leads) {
    for (const chave of Object.keys(lead.campos)) {
      if (!vistas.includes(chave)) vistas.push(chave)
    }
  }
  return vistas
}

async function Tabela({ filtro, etiquetasDaConta }: { filtro: Filtro; etiquetasDaConta: Etiqueta[] }) {
  const { clienteId, etiqueta, marca, termo, nivel } = filtro
  const [{ leads, total, pagina, paginas, faixas }, quadrosDaConta] = await Promise.all([
    ler(filtro),
    listarQuadros(clienteId),
  ])

  /*
    O relacionamento ainda é lido da página, e agora isso é só para **desenhar
    o selo** de cada linha. Quem decide quem entra na lista é o servidor, acima.
  */
  const relacionamentos = await relacionamentoDeMuitos(
    clienteId,
    leads.map((lead) => lead.contatoId),
    faixas,
  )

  const colunas = colunasDosCampos(leads)
  const primeiroDaPagina = (pagina - 1) * LEADS_POR_PAGINA + 1
  const ultimoDaPagina = primeiroDaPagina + leads.length - 1
  const base = `/clientes/${clienteId}/leads`
  const daPagina = (n: number) => {
    const endereco = enderecoDosContatos(base, { etiqueta, marca, busca: termo, nivel })
    return n > 1 ? `${endereco}${endereco.includes('?') ? '&' : '?'}pagina=${n}` : endereco
  }

  return (
    <>
      {leads.length === 0 ? (
        <div className="app-card py-14 text-center">
          <p className="text-[13px] font-bold">
            {termo !== '' && etiqueta === null && marca === null && nivel === null
              ? `Ninguém com "${termo}"`
              : 'Nenhum contato com estes filtros'}
          </p>
          <Link
            href={base}
            className="mt-2 inline-block text-[11.5px] font-semibold text-primary hover:underline"
            scroll={false}
          >
            Limpar filtros
          </Link>
        </div>
      ) : (
        <SelecaoDeContatos
          clienteId={clienteId}
          etiquetas={etiquetasDaConta.map(({ id, nome, cor }) => ({ id, nome, cor }))}
          quadros={quadrosDaConta.map(({ id, nome }) => ({ id, nome }))}
        >
          {/*
            O cartão cresce até o fim da página, e a rolagem é de dentro dele.

            Antes a altura era a soma das linhas: com quatro contatos a tabela
            terminava no meio da tela e o resto era fundo vazio, e com cinco ela
            terminava noutro lugar. Cada filtro mudava o tamanho do cartão, que
            é o que fazia a tela parecer outra a cada clique. Agora o cartão
            ocupa o que sobra (`flex-1`), a tabela começa no topo dele, e o que
            passar do fim rola aqui dentro em vez de rolar a página.
          */}
          <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
            {/*
              `relative` é o que prende o `sr-only` do cabeçalho de Ações (que é
              `absolute`) dentro da rolagem. Sem ele, o texto invisível ficava
              na ponta direita da tabela e esticava a página inteira no celular.
            */}
            <div className="relative min-h-0 flex-1 overflow-auto">
            <table id="tabela-de-contatos" className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={`${FIXA_SELECAO} z-[3] px-3.5 py-2.5`}>
                    <CaixaDeTodos ids={leads.map((lead) => lead.contatoId)} />
                  </th>
                  <th
                    scope="col"
                    className={`${FIXA_CONTATO} z-[3] px-3.5 py-3.5 text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase`}
                  >
                    Contato
                  </th>
                  {/* O rótulo, não a chave: `objetivo_aluno` em fonte de código
                      era o mesmo problema do painel do Inbox, numa tabela. */}
                  {colunas.map((coluna) => (
                    <Cabecalho key={coluna} coluna={coluna}>
                      {rotuloDoCampo(coluna) || coluna}
                    </Cabecalho>
                  ))}
                  <Cabecalho coluna="cliente">Cliente</Cabecalho>
                  <Cabecalho coluna="situacao">Situação</Cabecalho>
                  <Cabecalho coluna="ultima">Última mensagem</Cabecalho>
                  <th scope="col" className="w-10 px-2 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                <LinhaClicavel
                  key={lead.contatoId}
                  href={`/clientes/${clienteId}/leads/${lead.contatoId}`}
                  className="group cursor-pointer border-b border-line transition last:border-0 hover:bg-surface has-[:checked]:bg-primary/[0.06]"
                >
                  {/*
                    `align-middle` e não `align-top`: a caixa estava colada no
                    topo de uma linha de três alturas (nome, telefone,
                    etiquetas), desalinhada de tudo que ela seleciona.
                  */}
                  <td className={`${FIXA_SELECAO} ${FUNDO_DA_FIXA} z-[2] px-3.5 py-3 align-middle`}>
                    <CaixaDeSelecao id={lead.contatoId} rotulo={lead.nome ?? lead.waId} />
                  </td>
                  <td className={`${FIXA_CONTATO} ${FUNDO_DA_FIXA} z-[2] px-3.5 py-3`}>
                    <div className="flex items-center gap-2.5">
                      <Avatar nome={lead.nome} />
                      <div className="min-w-0">
                        <Link
                          href={`/clientes/${clienteId}/leads/${lead.contatoId}`}
                          className="block truncate text-[13px] font-bold transition hover:text-primary"
                        >
                          {lead.nome ?? 'sem nome'}
                        </Link>
                        <span className="block whitespace-nowrap font-mono text-[10px] text-dim">{telefoneLegivel(lead.waId)}</span>
                        <Etiquetas lista={lead.etiquetasManuais} />
                      </div>
                    </div>
                  </td>
                  {colunas.map((coluna) => (
                    <td key={coluna} data-coluna={coluna} className="max-w-48 truncate px-3.5 py-3 text-[11.5px] text-muted">
                      {lead.campos[coluna] || <span className="text-dim" aria-label="sem dado">·</span>}
                    </td>
                  ))}
                  <td data-coluna="cliente" className="px-3.5 py-3">
                    {relacionamentos.get(lead.contatoId) && (
                      <SeloDoCliente r={relacionamentos.get(lead.contatoId)!} />
                    )}
                  </td>
                  <td data-coluna="situacao" className="px-3.5 py-3">
                    {lead.aguardando ? (
                      <>
                        <span className="inline-flex rounded-full border border-rose-400/25 bg-rose-400/[0.09] px-2.5 py-1 text-[10.5px] font-bold text-perigo">
                          AGUARDANDO HUMANO
                        </span>
                        <span className="mt-1 block max-w-52 truncate text-[10.5px] text-dim" title={horaExata(lead.aguardando.desde)}>
                          {quando(lead.aguardando.desde)} · {lead.aguardando.motivo}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10.5px] font-bold text-ok">
                        COM O BOT
                      </span>
                    )}
                  </td>
                  <td data-coluna="ultima" className="px-3.5 py-3 text-[11.5px] whitespace-nowrap text-muted">
                    {lead.ultimaEm ? (
                      <>
                        <span title={horaExata(lead.ultimaEm)}>{quando(lead.ultimaEm)}</span>
                        {lead.ultimoTexto && (
                          <span className="block max-w-52 truncate text-[10.5px] text-dim">
                            {lead.ultimaDirecao === 'saida' && `${lead.ultimaEntregue ? 'bot: ' : 'envio não confirmado: '}`}{lead.ultimoTexto}
                          </span>
                        )}
                      </>
                    ) : 'sem mensagem'}
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <MenuDoContato
                      clienteId={clienteId}
                      contatoId={lead.contatoId}
                      nome={lead.nome ?? telefoneLegivel(lead.waId)}
                      automacaoAtiva={lead.automacaoAtiva}
                      aguardandoPessoa={lead.aguardando !== null}
                    />
                  </td>
                </LinhaClicavel>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {paginas > 1 && (
            <nav
              aria-label="Páginas de leads"
              className="mt-3 flex flex-wrap items-center justify-between gap-2"
            >
              <p className="text-[11.5px] text-muted">
                {primeiroDaPagina}–{ultimoDaPagina} de {total}
              </p>
              <div className="flex items-center gap-2">
                <Passo
                  href={daPagina(pagina - 1)}
                  ativo={pagina > 1}
                >
                  ‹ Anterior
                </Passo>
                <span className="text-[11.5px] font-semibold text-muted">
                  Página {pagina} de {paginas}
                </span>
                <Passo
                  href={daPagina(pagina + 1)}
                  ativo={pagina < paginas}
                >
                  Próxima ›
                </Passo>
              </div>
            </nav>
          )}
        </SelecaoDeContatos>
      )}
    </>
  )
}

/** Conta sem nenhum contato: dizer o que falta ligar, e não uma tabela vazia. */
async function PrimeiraVezDaConta({ clienteId }: { clienteId: string }) {
  const canais = await listarCanais(clienteId)
  return <PrimeiraVez clienteId={clienteId} temCanal={canais.length > 0} />
}

function PrimeiraVez({ clienteId, temCanal }: { clienteId: string; temCanal: boolean }) {
  return (
    <div className="mx-auto mt-16 max-w-[420px] text-center">
      {!temCanal ? (
        <>
          <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-dim">SEM CANAL</p>
          <h2 className="text-[15.5px] font-bold">Nenhum número conectado</h2>
          <p className="mt-1.5 text-[12.5px] leading-6 text-muted">
            Sem um número de WhatsApp ligado a um fluxo publicado, ninguém conversa com o bot. Quem você já conhece dá para cadastrar em “+ Novo contato”.
          </p>
          {/* Vai para a tela do número, e não para o painel. Botão de estado
              vazio que leva ao lugar errado é pior que estado vazio sem botão:
              ele ensina que o produto não sabe para onde mandar a pessoa. */}
          <Link
            href={`/clientes/${clienteId}/ajustes/whatsapp`}
            className="app-secondary-button mt-5 inline-block px-5 py-2.5 text-[13px]"
          >
            Conectar um número
          </Link>
        </>
      ) : (
        <>
          <span className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-bold text-ok">
            <span className="size-1.5 rounded-full bg-emerald-400" /> Número no ar
          </span>
          <IlustracaoContatos />
          <h2 className="mt-6 text-[15.5px] font-bold">Nenhum contato ainda</h2>
          <p className="mt-1.5 text-[12.5px] leading-6 text-muted">
            Quando alguém conversar com o bot, a pessoa aparece aqui com tudo o que o fluxo coletar.
          </p>
        </>
      )}
    </div>
  )
}

function Passo({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  const classe = 'rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition'
  if (!ativo) {
    return (
      <span aria-disabled="true" className={`${classe} border-line text-dim`}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} scroll={false} className={`${classe} border-line text-muted hover:border-strong hover:text-ink`}>
      {children}
    </Link>
  )
}

/*
  As duas primeiras colunas ficam presas na esquerda quando a tabela rola para
  o lado: sem elas, quem vai conferir um campo lá no fim perde de vista de quem
  é a linha e qual caixa está marcando.

  A largura da primeira é fixa porque é ela que dá o `left` da segunda. Ocultar
  coluna pelo botão "Colunas" não mexe aqui: as duas nunca são ocultáveis.
*/
const FIXA_SELECAO = 'sticky left-0 w-12 min-w-12 max-w-12 bg-panel'
// No celular a coluna Contato encolhe (o nome trunca): com 260px, as duas fixas
// tomavam quase a tela inteira e sobrava uma fresta para o resto da tabela.
const FIXA_CONTATO =
  'sticky left-12 w-[176px] min-w-[176px] max-w-[176px] md:w-auto md:max-w-none md:min-w-[260px] bg-panel shadow-[inset_-1px_0_0_var(--line)]'
/**
 * Célula fixa precisa de fundo opaco nos três estados, senão o texto das
 * colunas que passam por baixo aparece através dela. O da linha marcada é a
 * mesma tinta da linha (`primary` a 6%), só que já misturada com o painel.
 */
const FUNDO_DA_FIXA =
  'group-hover:bg-surface group-has-[:checked]:bg-[color-mix(in_oklab,var(--primary)_6%,var(--panel))]'

/**
 * Uma coluna da tabela.
 *
 * `data-coluna` é o que o botão "Colunas" usa para esconder a coluna inteira
 * com uma regra de CSS. Sem ele, a escolha não teria como alcançar uma tabela
 * montada no servidor.
 */
function Cabecalho({ children, coluna }: { children: React.ReactNode; coluna?: string }) {
  return (
    <th
      data-coluna={coluna}
      className="px-3.5 py-3.5 text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase"
    >
      {children}
    </th>
  )
}

function Avatar({ nome }: { nome: string | null }) {
  const iniciais = (nome ?? '?').split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-strong bg-surface text-[10px] font-bold text-muted">
      {iniciais}
    </span>
  )
}

/**
 * As etiquetas manuais na linha do contato. Nada quando não há nenhuma.
 *
 * No máximo duas, e o resto vira "+N" com os nomes no `title`: com quatro
 * etiquetas a linha ganhava quatro alturas e a tabela virava uma lista de
 * fichas, com o nome da pessoa perdido no meio.
 */
function Etiquetas({ lista }: { lista: Etiqueta[] }) {
  if (lista.length === 0) return null
  const vistas = lista.slice(0, 2)
  const resto = lista.slice(2)
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {vistas.map((etiqueta) => (
        <FichaDeEtiqueta key={etiqueta.id} nome={etiqueta.nome} cor={etiqueta.cor} />
      ))}
      {resto.length > 0 && (
        <span
          title={resto.map((etiqueta) => etiqueta.nome).join(', ')}
          aria-label={`e mais ${resto.length}: ${resto.map((etiqueta) => etiqueta.nome).join(', ')}`}
          className="inline-flex items-center rounded-full border border-line px-1.5 py-0.5 text-[10.5px] font-semibold text-muted"
        >
          +{resto.length}
        </span>
      )}
    </span>
  )
}
