import { meuAlcance } from '@/server/permissoes'
import Link from 'next/link'
import { hrefDaFicha } from '@/core/volta-da-ficha'
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
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { BarraDeContatos } from '@/components/contatos/barra-de-contatos'
import { enderecoDosContatos } from '@/core/contatos/filtro'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { acaoCriarContato } from '@/server/acoes'
import { listarEtiquetasComContagem, type Etiqueta } from '@/server/repos/etiquetas'
import { listarQuadros } from '@/server/repos/quadros'
import { faixasDaConta, relacionamentoDeMuitos } from '@/server/repos/relacionamento'
import { contatosDoNivel, contatosDoSegmento, emAmbos } from '@/server/consultas/nivel'
import { listarSegmentos } from '@/server/repos/segmentos'
import { FAIXAS_PADRAO, NIVEIS, type Nivel } from '@/core/relacionamento'
import { SeloDoCliente } from '@/components/lead-crm/selo-do-cliente'
import { Responsavel } from '@/components/atividades/linha-da-agenda'
import { membrosDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

type Busca = {
  etiqueta?: string | string[]
  /** A etiqueta manual (0025). Nome diferente porque as duas famílias somam. */
  marca?: string | string[]
  busca?: string | string[]
  pagina?: string | string[]
  /** O nível do cliente (0070): ouro, prata, bronze, sem_compra. */
  nivel?: string | string[]
  /** Um segmento salvo (CRM > Segmentos). */
  segmento?: string | string[]
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
  segmento: string | null,
): string {
  const parametros = new URLSearchParams()
  if (etiqueta) parametros.set('etiqueta', etiqueta)
  if (marca) parametros.set('marca', marca)
  if (busca) parametros.set('busca', busca)
  // Sem isto, o CSV não vê a faixa e exporta a base inteira: é metade do
  // defeito da RB-37, e é a metade que sai por e-mail. Vale igual para o segmento.
  if (nivel) parametros.set('nivel', nivel)
  if (segmento) parametros.set('segmento', segmento)

  const consulta = parametros.toString()
  return `/api/clientes/${clienteId}/leads/csv${consulta ? `?${consulta}` : ''}`
}

/**
 * A ficha aberta daqui volta para esta mesma lista: busca, filtros e página.
 * Sem isto, o "← Contatos" da ficha caía na lista inteira e a pessoa refazia a
 * pesquisa a cada contato que abria (Fase 12, jornada Contatos → ficha).
 */
function fichaComVolta(filtro: Filtro, contatoId: string): string {
  const parametros = new URLSearchParams()
  if (filtro.etiqueta) parametros.set('etiqueta', filtro.etiqueta)
  if (filtro.marca) parametros.set('marca', filtro.marca)
  if (filtro.termo) parametros.set('busca', filtro.termo)
  if (filtro.nivel) parametros.set('nivel', filtro.nivel)
  if (filtro.segmento) parametros.set('segmento', filtro.segmento)
  if (filtro.pagina > 1) parametros.set('pagina', String(filtro.pagina))
  const consulta = parametros.toString()
  return hrefDaFicha(filtro.clienteId, contatoId, {
    volta: consulta === '' ? undefined : `/clientes/${filtro.clienteId}/leads?${consulta}`,
  })
}

/** O filtro da tela, já validado. Tudo primitivo: é a chave do `cache` abaixo. */
type Filtro = {
  clienteId: string
  etiqueta: EtiquetaDeLead | null
  marca: string | null
  termo: string
  pagina: number
  nivel: Nivel | null
  segmento: string | null
}

/**
 * A página de contatos pedida, lida uma vez por requisição.
 *
 * O cabeçalho (contagem, "Baixar CSV"), o botão Colunas e a tabela moram em
 * `Suspense` separados, e os três precisam da mesma página. O `cache` do React
 * faz os três receberem a mesma leitura em vez de três idas ao banco.
 */
const lerPagina = cache(
  async (
    clienteId: string,
    etiqueta: EtiquetaDeLead | null,
    marca: string | null,
    termo: string,
    pagina: number,
    nivel: Nivel | null,
    segmento: string | null,
  ) => {
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
    // O segmento entra pelo mesmo caminho, antes de paginar, e soma com a faixa.
    const doSegmento = segmento ? await contatosDoSegmento(clienteId, segmento) : null
    const resultado = await paginarLeads(clienteId, {
      // Contatos é a base inteira. Sem isto valia o padrão do Inbox
      // (`aberta`) e quem teve a conversa resolvida sumia da lista e do total.
      estado: 'todas',
      etiqueta,
      etiquetaId: marca,
      busca: termo,
      pagina,
      contatos: emAmbos(daFaixa, doSegmento),
      // Atendente vê os contatos dele e os sem responsável; gestor, os da equipe.
      alcance: await meuAlcance(clienteId),
    })
    return { ...resultado, faixas }
  },
)

const ler = (f: Filtro) => lerPagina(f.clienteId, f.etiqueta, f.marca, f.termo, f.pagina, f.nivel, f.segmento)
const filtrando = (f: Filtro) =>
  f.etiqueta !== null || f.marca !== null || f.termo !== '' || f.nivel !== null || f.segmento !== null

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
    segmento: primeiro(busca.segmento) || null,
  }
  const chave = `${filtro.etiqueta}-${filtro.marca}-${filtro.termo}-${filtro.pagina}-${filtro.nivel}-${filtro.segmento}`

  // O total da conta decide entre a tela de primeira vez e a tabela; etiquetas
  // e segmentos alimentam o popover de filtros. As leituras são baratas.
  const [totalDaConta, etiquetasDaConta, segmentosDaConta] = await Promise.all([
    contarLeads(cliente.id),
    listarEtiquetasComContagem(cliente.id),
    listarSegmentos(cliente.id),
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
              filtro={{
                etiqueta: filtro.etiqueta,
                marca: filtro.marca,
                busca: filtro.termo,
                nivel: filtro.nivel,
                segmento: filtro.segmento,
              }}
              manuais={etiquetasDaConta.map(({ id, nome, contatos }) => ({ id, nome, contatos: contatos ?? null }))}
              segmentos={segmentosDaConta.map(({ id, nome }) => ({ id, nome }))}
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
              href={enderecoDoCsv(clienteId, filtro.etiqueta, filtro.marca, filtro.termo, filtro.nivel, filtro.segmento)}
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
  O que o botão "Colunas" oferece: as principais (ligadas de saída) e uma por
  variável coletada nesta página (desligadas de saída). "Contato" fica de fora de propósito, tabela de contatos sem
  a coluna de contato é uma tela que não responde mais nada.
*/
async function ColunasDoFiltro({ filtro }: { filtro: Filtro }) {
  const { leads } = await ler(filtro)
  const colunasDisponiveis = [
    { chave: 'responsavel', rotulo: 'Responsável', padrao: true },
    { chave: 'etiquetas', rotulo: 'Etiquetas', padrao: true },
    { chave: 'cliente', rotulo: 'Cliente', padrao: true },
    { chave: 'situacao', rotulo: 'Situação', padrao: true },
    { chave: 'ultima', rotulo: 'Última mensagem', padrao: true },
    ...colunasDosCampos(leads).map((coluna) => ({ chave: coluna, rotulo: rotuloDoCampo(coluna) || coluna, padrao: false })),
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
  const [{ leads, total, pagina, paginas, faixas }, quadrosDaConta, equipe] = await Promise.all([
    ler(filtro),
    listarQuadros(clienteId),
    membrosDaConta(clienteId),
  ])
  // Quem saiu da conta (ou foi bloqueado) não está em `equipe`, mas o contato
  // continua com o id dele até alguém reatribuir: a linha diz isso.
  const nomeDoMembro = new Map(equipe.map((membro) => [membro.id, membro.nome]))
  const responsavelDe = (id: string | null) => (id ? (nomeDoMembro.get(id) ?? 'Fora da equipe') : null)

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
            <RolagemDaTabela>
            <table id="tabela-de-contatos" className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={`${FIXA_SELECAO} z-[3] px-4 py-3`}>
                    <CaixaDeTodos ids={leads.map((lead) => lead.contatoId)} />
                  </th>
                  <th scope="col" className={`${FIXA_CONTATO} ${CLASSE_DO_CABECALHO} z-[3]`}>
                    Contato
                  </th>
                  <Cabecalho coluna="responsavel">Responsável</Cabecalho>
                  <Cabecalho coluna="etiquetas">Etiquetas</Cabecalho>
                  <Cabecalho coluna="cliente">Cliente</Cabecalho>
                  <Cabecalho coluna="situacao">Situação</Cabecalho>
                  <Cabecalho coluna="ultima">Última mensagem</Cabecalho>
                  {/* As variáveis coletadas saem escondidas (`hidden`) e quem
                      liga é o botão Colunas. O rótulo, não a chave:
                      `objetivo_aluno` em fonte de código não diz nada. */}
                  {colunas.map((coluna) => (
                    <Cabecalho key={coluna} coluna={coluna} opcional>
                      {rotuloDoCampo(coluna) || coluna}
                    </Cabecalho>
                  ))}
                  <th scope="col" className="w-12 px-2 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                <LinhaClicavel
                  key={lead.contatoId}
                  href={fichaComVolta(filtro, lead.contatoId)}
                  className={`group cursor-pointer border-b border-line last:border-0 ${FUNDO_DA_LINHA}`}
                >
                  <td className={`${FIXA_SELECAO} ${FUNDO_DA_FIXA} z-[2] px-4 py-3`}>
                    <CaixaDeSelecao id={lead.contatoId} rotulo={lead.nome ?? lead.waId} />
                  </td>
                  <td className={`${FIXA_CONTATO} ${FUNDO_DA_FIXA} z-[2] px-4 py-3`}>
                    <div className="flex items-center gap-3">
                      <Avatar nome={lead.nome} />
                      <div className="min-w-0">
                        <Link
                          href={fichaComVolta(filtro, lead.contatoId)}
                          className={`block truncate text-[13px] font-bold transition hover:text-primary ${lead.nome ? '' : 'text-dim'}`}
                        >
                          {lead.nome ?? 'sem nome'}
                        </Link>
                        <span className="block whitespace-nowrap font-mono text-[10.5px] text-dim">{telefoneLegivel(lead.waId)}</span>
                      </div>
                    </div>
                  </td>
                  <td data-coluna="responsavel" className="max-w-44 px-4 py-3">
                    <Responsavel nome={responsavelDe(lead.atribuidoA)} />
                  </td>
                  <td data-coluna="etiquetas" className="px-4 py-3">
                    <Etiquetas lista={lead.etiquetasManuais} />
                  </td>
                  <td data-coluna="cliente" className="px-4 py-3">
                    {relacionamentos.get(lead.contatoId) && (
                      <SeloDoCliente r={relacionamentos.get(lead.contatoId)!} />
                    )}
                  </td>
                  <td data-coluna="situacao" className="px-4 py-3">
                    {lead.aguardando ? (
                      <>
                        <span className="flex items-center gap-1.5 text-[12px] font-semibold whitespace-nowrap text-perigo">
                          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-rose-500" />
                          Esperando pessoa
                        </span>
                        <span className="mt-0.5 block max-w-52 truncate text-[10.5px] text-dim" title={horaExata(lead.aguardando.desde)}>
                          {quando(lead.aguardando.desde)} · {lead.aguardando.motivo}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold whitespace-nowrap text-muted">
                        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                        Com o bot
                      </span>
                    )}
                  </td>
                  <td data-coluna="ultima" className="px-4 py-3 text-[12px] whitespace-nowrap text-muted">
                    {lead.ultimaEm ? (
                      <>
                        <span title={horaExata(lead.ultimaEm)}>{quando(lead.ultimaEm)}</span>
                        {lead.ultimoTexto && (
                          <span className="block max-w-56 truncate text-[10.5px] text-dim">
                            {lead.ultimaDirecao === 'saida' && `${lead.ultimaEntregue ? 'bot: ' : 'envio não confirmado: '}`}{lead.ultimoTexto}
                          </span>
                        )}
                      </>
                    ) : <span className="text-dim">sem mensagem</span>}
                  </td>
                  {colunas.map((coluna) => (
                    <td key={coluna} data-coluna={coluna} className="hidden max-w-52 truncate px-4 py-3 text-[12px] text-muted">
                      {lead.campos[coluna] || <span className="text-dim" aria-label="sem dado">·</span>}
                    </td>
                  ))}
                  <td className="px-2 py-3">
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
            </RolagemDaTabela>
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
            href={`/clientes/${clienteId}/conversas/canais/whatsapp`}
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
  é a linha e qual caixa está marcando. A divisória só aparece com a tabela
  rolada (`data-rolada`, ver `RolagemDaTabela`): parada no começo, ela só pesava.

  A largura da primeira é fixa porque é ela que dá o `left` da segunda.
*/
const FIXA_SELECAO = 'sticky left-0 w-12 min-w-12 max-w-12 bg-panel'
// No celular a coluna Contato encolhe (o nome trunca): com 240px, as duas fixas
// tomavam quase a tela inteira e sobrava uma fresta para o resto da tabela.
const FIXA_CONTATO =
  'sticky left-12 w-[176px] min-w-[176px] max-w-[176px] md:w-auto md:max-w-[320px] md:min-w-[240px] bg-panel group-data-[rolada=sim]/rolagem:shadow-[inset_-1px_0_0_var(--line)]'

/*
  O fundo da linha e o das duas células fixas são **a mesma cor, trocada ao
  mesmo tempo e sem transição**. Com `transition` só na linha, o fundo dela
  entrava em 150 ms e o das fixas na hora: passar o mouse rápido deixava as
  duas metades da linha em tempos diferentes. As fixas precisam de cor opaca
  (senão o texto que rola por baixo aparece), por isso a mistura com o painel.
  (Escritas por extenso de propósito: o Tailwind lê o texto do arquivo, e uma
  classe montada com `${}` não existiria na folha de estilo.)
*/
const FUNDO_DA_LINHA =
  'hover:bg-[color-mix(in_oklab,var(--surface)_75%,var(--panel))] has-[:checked]:bg-[color-mix(in_oklab,var(--primary)_6%,var(--panel))]'
const FUNDO_DA_FIXA =
  'group-hover:bg-[color-mix(in_oklab,var(--surface)_75%,var(--panel))] group-has-[:checked]:bg-[color-mix(in_oklab,var(--primary)_6%,var(--panel))]'


const CLASSE_DO_CABECALHO =
  'px-4 py-3 text-[10.5px] font-bold tracking-[0.06em] whitespace-nowrap text-dim uppercase'

/**
 * Uma coluna da tabela.
 *
 * `data-coluna` é o que o botão "Colunas" usa para mostrar ou esconder a coluna
 * inteira com uma regra de CSS; `opcional` sai escondida do servidor.
 */
function Cabecalho({
  children,
  coluna,
  opcional = false,
}: {
  children: React.ReactNode
  coluna: string
  opcional?: boolean
}) {
  return (
    <th scope="col" data-coluna={coluna} className={`${CLASSE_DO_CABECALHO} ${opcional ? 'hidden' : ''}`}>
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
  if (lista.length === 0) return <span className="text-[12px] text-dim" aria-label="sem etiqueta">·</span>
  const vistas = lista.slice(0, 2)
  const resto = lista.slice(2)
  return (
    <span className="flex max-w-[260px] items-center gap-1">
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
