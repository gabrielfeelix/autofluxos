import 'server-only'
import {
  MESMA_OCORRENCIA,
  SO_DA_OCORRENCIA,
  acharCampo,
  type Condicao,
  type Segmento,
} from '@/core/segmentos'
import type { FiltroDeEscopo } from '@/core/permissoes'
import { db, ehIdInvalido } from '../db'

/**
 * A consulta de contatos que **todas** as superfícies usam (T6.1, RB-37).
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo substitui
 * ---------------------------------------------------------------------------
 *
 * Duas definições viviam em dois lugares:
 *
 *   - `leads/page.tsx` filtrava por nível com `leads.filter(...)` **sobre a
 *     página já carregada**. A contagem dizia "3 de 50", que é 3 daquela
 *     página, e a paginação ignorava o filtro;
 *   - `api/.../leads/csv/route.ts` nem conhecia o filtro de nível: quem
 *     filtrava por Ouro e exportava recebia todo mundo.
 *
 * Agora a lista, a contagem, a paginação e o CSV chamam `consultarContatos`, e
 * o filtro é aplicado **antes** do `range`. Isso não é organização de código:
 * filtrar depois de paginar dá número errado, e filtrar depois de ler entrega
 * dado a quem não devia tê-lo.
 *
 * ---------------------------------------------------------------------------
 * O contrato de segurança
 * ---------------------------------------------------------------------------
 *
 * **Nada vindo do cliente vira identificador.** O segmento já chegou validado
 * por `core/segmentos.ts`: campo só pode ser um dos `CAMPOS`, operador só pode
 * ser um dos permitidos para o tipo. Aqui cada campo é traduzido por um
 * `switch` fechado, e o valor sempre viaja como **parâmetro** do supabase-js,
 * nunca interpolado numa string de filtro.
 *
 * `service_role` ignora RLS: quem isola é o `client_id` em **cada** consulta,
 * e ele é a primeira coisa que entra em toda uma delas.
 */

export type ContatoDaConsulta = {
  contatoId: string
  nome: string | null
  telefone: string
  estagio: string
  responsavelId: string | null
  ultimaMensagemEm: string | null
  criadoEm: string
  campos: Record<string, string>
  compras: number
  /** `null` = não informado. Nunca zero por conveniência (RB-06). */
  valorConhecido: number | null
  vendasSemValor: number
  /** `null` = sem compra com data conhecida. Não é "faz muito tempo" (RB-35). */
  ultimaCompraEm: string | null
}

export type Ordem = 'recentes' | 'valor' | 'ultima_compra' | 'nome'

export type PedidoDeConsulta = {
  clienteId: string
  segmento: Segmento
  escopo: FiltroDeEscopo
  /** Busca livre por nome e telefone. Já limpa por quem chama. */
  busca?: string
  ordem?: Ordem
  pagina?: number
  porPagina?: number
}

export type ResultadoDaConsulta = {
  contatos: ContatoDaConsulta[]
  /** O total **do filtro inteiro**, não o da página. É o que a RB-37 exige. */
  total: number
  pagina: number
  paginas: number
  /** O instante da consulta, que a exportação registra (RB-37). */
  em: string
}

export const POR_PAGINA = 50

type Linha = {
  contact_id: string
  nome: string | null
  telefone: string
  estagio: string
  responsavel: string | null
  ultima_mensagem_em: string | null
  criado_em: string
  campos: Record<string, string> | null
  compras: number
  valor_conhecido: string | number | null
  vendas_sem_valor: number
  ultima_compra_em: string | null
}

const COLUNAS =
  'contact_id, nome, telefone, estagio, responsavel, ultima_mensagem_em, criado_em, ' +
  'campos, compras, valor_conhecido, vendas_sem_valor, ultima_compra_em'

function paraContato(linha: Linha): ContatoDaConsulta {
  return {
    contatoId: linha.contact_id,
    nome: linha.nome,
    telefone: linha.telefone,
    estagio: linha.estagio,
    responsavelId: linha.responsavel,
    ultimaMensagemEm: linha.ultima_mensagem_em,
    criadoEm: linha.criado_em,
    campos: linha.campos ?? {},
    compras: Number(linha.compras ?? 0),
    // `numeric` chega como string no supabase-js. E `null` continua `null`:
    // somar tratando ausente como zero produziria um total menor que a verdade
    // e com cara de exato.
    valorConhecido: linha.valor_conhecido === null ? null : Number(linha.valor_conhecido),
    vendasSemValor: Number(linha.vendas_sem_valor ?? 0),
    ultimaCompraEm: linha.ultima_compra_em,
  }
}

/**
 * Os contatos que casam com o segmento.
 *
 * A ordem das operações é a regra, e não uma preferência: escopo, condições,
 * contagem, **e só então** a página.
 */
export async function consultarContatos(
  pedido: PedidoDeConsulta,
): Promise<ResultadoDaConsulta> {
  const porPagina = pedido.porPagina ?? POR_PAGINA
  const pagina = Math.max(1, pedido.pagina ?? 1)
  const em = new Date().toISOString()

  // Escopo impossível não consulta: devolver vazio aqui é diferente de
  // devolver tudo, e um `if` esquecido no chamador seria a conta do vizinho.
  if (pedido.escopo.tipo === 'impossivel') {
    return { contatos: [], total: 0, pagina: 1, paginas: 1, em }
  }

  const porOcorrencia = await idsPorOcorrencia(pedido.clienteId, pedido.segmento)
  if (porOcorrencia !== null && porOcorrencia.length === 0) {
    // Lista vazia é "ninguém passa", e é diferente de `null` ("sem restrição").
    // Tratá-las igual mostraria a base inteira justo quando o filtro não achou
    // ninguém, que é o pior momento para mostrar tudo.
    return { contatos: [], total: 0, pagina: 1, paginas: 1, em }
  }

  let consulta = db()
    .from('contatos_comerciais')
    .select(COLUNAS, { count: 'exact' })
    .eq('client_id', pedido.clienteId)

  consulta = aplicarEscopo(consulta, pedido.escopo, await usuariosDoEscopo(pedido))
  if (porOcorrencia !== null) consulta = consulta.in('contact_id', porOcorrencia)

  for (const condicao of pedido.segmento.condicoes) {
    // já resolvida em `idsPorOcorrencia`
    if (ehDeOcorrencia(condicao, pedido.segmento)) continue
    consulta = aplicarCondicao(consulta, condicao)
  }

  const termo = (pedido.busca ?? '').trim()
  if (termo !== '') {
    // O termo já vem limpo por `limparBusca`. Mesmo assim ele entra só em
    // `ilike` com curinga nas pontas, e nunca monta um `or()` com identificador.
    consulta = consulta.or(`nome.ilike.*${termo}*,telefone.ilike.*${termo}*`)
  }

  consulta = ordenar(consulta, pedido.ordem ?? 'recentes')

  const de = (pagina - 1) * porPagina
  const { data, error, count } = await consulta.range(de, de + porPagina - 1)

  if (ehIdInvalido(error)) return { contatos: [], total: 0, pagina: 1, paginas: 1, em }
  if (error) throw new Error(`não deu para consultar os contatos: ${error.message}`)

  const total = count ?? 0
  return {
    contatos: (data as unknown as Linha[]).map(paraContato),
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    em,
  }
}

/** A contagem, sem trazer ninguém. Mesma definição da lista, por construção. */
export async function contarContatos(pedido: PedidoDeConsulta): Promise<number> {
  const r = await consultarContatos({ ...pedido, pagina: 1, porPagina: 1 })
  return r.total
}

// ---------------------------------------------------------------------------
// O escopo, aplicado antes de tudo
// ---------------------------------------------------------------------------

async function usuariosDoEscopo(pedido: PedidoDeConsulta): Promise<string[]> {
  if (pedido.escopo.tipo !== 'equipes') return []

  const { data, error } = await db()
    .from('equipe_membros')
    .select('usuario_id')
    .eq('client_id', pedido.clienteId)
    .in('equipe_id', [...pedido.escopo.equipes])

  if (error) throw new Error(`não deu para ler as equipes: ${error.message}`)
  return [...new Set((data as { usuario_id: string }[]).map((m) => m.usuario_id))]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarEscopo(consulta: any, escopo: FiltroDeEscopo, usuarios: string[]): any {
  if (escopo.tipo === 'proprios') return consulta.eq('responsavel', escopo.usuarioId)
  if (escopo.tipo === 'equipes') {
    // Sem membro nenhum, o escopo alcança zero contatos. `in ()` seria filtro
    // inválido, então a lista impossível vira um id que não existe.
    if (usuarios.length === 0) return consulta.eq('responsavel', ZERO)
    return consulta.in('responsavel', usuarios)
  }
  return consulta
}

const ZERO = '00000000-0000-0000-0000-000000000000'

// ---------------------------------------------------------------------------
// As condições da mesma ocorrência (RB-36)
// ---------------------------------------------------------------------------

/**
 * Esta condição é resolvida pelo `exists` da ocorrência?
 *
 * **`ultima_compra_em` pertence aos dois mundos, e a distinção importa.** Ela
 * é campo da view (o contato tem uma última compra) **e** campo da venda (a
 * venda tem uma data). Quando ela aparece junto de `produto_comprado`, a
 * RB-36 manda olhar a **mesma** venda, e aí ela vai para a subconsulta.
 * Sozinha, ela é uma pergunta sobre o contato.
 *
 * Isto não é sutileza de implementação: `ultima_compra_em nao_informado` quer
 * dizer "nunca comprou", e procurar isso dentro de `vendas` devolveria zero
 * para sempre, porque quem nunca comprou não tem linha lá. Foi o que o teste
 * pegou.
 */
function ehDeOcorrencia(condicao: Condicao, segmento: Segmento): boolean {
  // Campo que só existe dentro da ocorrência vai para lá sempre, sozinho ou
  // acompanhado: não há coluna dele na view para onde cair.
  if ((SO_DA_OCORRENCIA as readonly string[]).includes(condicao.campo)) return true

  for (const campos of Object.values(MESMA_OCORRENCIA)) {
    const lista = campos as readonly string[]
    if (!lista.includes(condicao.campo)) continue

    // Campo que existe nos dois mundos (hoje só `ultima_compra_em`) só vai
    // para a subconsulta quando acompanhado: aí a RB-36 manda casar a mesma
    // venda. Sozinho, ele é pergunta sobre o contato, e a view responde.
    const quantasDoGrupo = segmento.condicoes.filter((c) => lista.includes(c.campo)).length
    if (quantasDoGrupo > 1) return true
  }
  return false
}

/**
 * Os contatos que têm **uma mesma** oportunidade (ou venda) satisfazendo todas
 * as condições daquele grupo.
 *
 * É a RB-36, e é a parte que não dá para fazer com condições soltas: filtrar
 * `temperatura = 'frio'` e `situacao = 'aberta'` na view agregada devolveria
 * quem tem uma negociação fria **e outra** aberta, que não é o que ninguém
 * pediu. E o erro é invisível: a lista vem preenchida, só que errada.
 *
 * Devolve `null` quando não há condição de ocorrência (sem restrição), e lista
 * vazia quando há e ninguém passa.
 */
async function idsPorOcorrencia(
  clienteId: string,
  segmento: Segmento,
): Promise<string[] | null> {
  let permitidos: string[] | null = null

  for (const [grupo, campos] of Object.entries(MESMA_OCORRENCIA)) {
    const doGrupo = segmento.condicoes.filter((c) =>
      (campos as readonly string[]).includes(c.campo),
    )
    // O grupo roda quando há duas condições dele, OU quando há uma que só
    // existe na ocorrência. Ver `ehDeOcorrencia`.
    const precisa =
      doGrupo.length > 1 ||
      doGrupo.some((c) => (SO_DA_OCORRENCIA as readonly string[]).includes(c.campo))
    if (!precisa) continue

    const ids =
      grupo === 'oportunidade'
        ? await idsPorOportunidade(clienteId, doGrupo)
        : await idsPorVenda(clienteId, doGrupo)

    // Grupos diferentes **restringem** entre si: "oportunidade fria" e
    // "comprou o produto X" são duas exigências, e quem passa nas duas é a
    // interseção.
    permitidos = permitidos === null ? ids : permitidos.filter((id) => ids.includes(id))
    if (permitidos.length === 0) return []
  }

  return permitidos
}

async function idsPorOportunidade(clienteId: string, condicoes: Condicao[]): Promise<string[]> {
  let consulta = db().from('quadro_cartoes').select('contact_id').eq('client_id', clienteId)

  for (const condicao of condicoes) {
    switch (condicao.campo) {
      case 'oportunidade_temperatura':
        consulta = igualdade(consulta, 'temperatura', condicao)
        break
      case 'oportunidade_situacao':
        consulta = igualdade(consulta, 'situacao', condicao)
        break
      case 'oportunidade_quadro':
        // O processo vem por id, e o id é conferido pelo `eq` como parâmetro.
        consulta = igualdade(consulta, 'quadro_id', condicao)
        break
    }
  }

  const { data, error } = await consulta
  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para filtrar por oportunidade: ${error.message}`)
  return [...new Set((data as { contact_id: string }[]).map((l) => l.contact_id))]
}

async function idsPorVenda(clienteId: string, condicoes: Condicao[]): Promise<string[]> {
  // A mesma venda: o join com `venda_itens` acontece dentro da consulta, então
  // "comprou o produto X nos últimos 90 dias" olha um item **daquela** venda.
  let consulta = db()
    .from('vendas')
    .select('contact_id, venda_itens!inner (descricao, produto_id)')
    .eq('client_id', clienteId)
    .eq('situacao', 'valida')

  for (const condicao of condicoes) {
    switch (condicao.campo) {
      case 'produto_comprado':
        consulta = consulta.ilike('venda_itens.descricao', `%${condicao.valor ?? ''}%`)
        break
      case 'ultima_compra_em':
        consulta = aplicarData(consulta, 'data_da_venda', condicao)
        break
    }
  }

  const { data, error } = await consulta
  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para filtrar por venda: ${error.message}`)
  return [...new Set((data as { contact_id: string }[]).map((l) => l.contact_id))]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function igualdade(consulta: any, coluna: string, condicao: Condicao): any {
  if (condicao.operador === 'diferente') return consulta.neq(coluna, condicao.valor)
  return consulta.eq(coluna, condicao.valor)
}

// ---------------------------------------------------------------------------
// As condições da própria view
// ---------------------------------------------------------------------------

/**
 * Traduz uma condição em `where`.
 *
 * O `switch` é fechado de propósito: a coluna nunca vem do cliente, ela é
 * escolhida aqui a partir de uma chave já validada. É o que garante que não há
 * caminho de identificador arbitrário até o SQL.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarCondicao(consulta: any, condicao: Condicao): any {
  const campo = acharCampo(condicao.campo)
  if (!campo) return consulta

  switch (condicao.campo) {
    case 'nome':
      return aplicarTexto(consulta, 'nome', condicao)
    case 'telefone':
      return aplicarTexto(consulta, 'telefone', condicao)
    case 'estagio':
      return aplicarTexto(consulta, 'estagio', condicao)
    case 'responsavel':
      return aplicarTexto(consulta, 'responsavel', condicao)
    case 'ultima_mensagem_em':
      return aplicarData(consulta, 'ultima_mensagem_em', condicao)
    case 'criado_em':
      return aplicarData(consulta, 'criado_em', condicao)
    case 'valor_conhecido':
      return aplicarNumero(consulta, 'valor_conhecido', condicao)
    case 'compras':
      return aplicarNumero(consulta, 'compras', condicao)
    case 'ultima_compra_em':
      return aplicarData(consulta, 'ultima_compra_em', condicao)
    default:
      return consulta
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarTexto(consulta: any, coluna: string, condicao: Condicao): any {
  switch (condicao.operador) {
    case 'igual':
      return consulta.eq(coluna, condicao.valor)
    case 'diferente':
      return consulta.neq(coluna, condicao.valor)
    case 'contem':
      return consulta.ilike(coluna, `%${condicao.valor ?? ''}%`)
    case 'preenchido':
      return consulta.not(coluna, 'is', null)
    case 'nao_informado':
      return consulta.is(coluna, null)
    default:
      return consulta
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarNumero(consulta: any, coluna: string, condicao: Condicao): any {
  switch (condicao.operador) {
    case 'igual':
      return consulta.eq(coluna, Number(condicao.valor))
    case 'diferente':
      return consulta.neq(coluna, Number(condicao.valor))
    case 'maior':
      return consulta.gt(coluna, Number(condicao.valor))
    case 'menor':
      return consulta.lt(coluna, Number(condicao.valor))
    case 'entre':
      return consulta
        .gte(coluna, Number(condicao.valor))
        .lte(coluna, Number(condicao.ate))
    case 'preenchido':
      return consulta.not(coluna, 'is', null)
    case 'nao_informado':
      return consulta.is(coluna, null)
    default:
      return consulta
  }
}

/**
 * As condições de data, incluindo a que mais engana.
 *
 * `ha_mais_de_dias` exige `not is null` **explicitamente** (RB-35): sem isso,
 * "sem comprar há 90 dias" arrastaria junto todo importado que nunca teve
 * compra registrada, fundindo dois grupos que a proposta manda manter
 * separados. Quem quiser o segundo grupo pede `nao_informado`, que tem frase
 * própria na prévia.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarData(consulta: any, coluna: string, condicao: Condicao): any {
  switch (condicao.operador) {
    case 'maior':
      return consulta.gt(coluna, condicao.valor)
    case 'menor':
      return consulta.lt(coluna, condicao.valor)
    case 'entre':
      return consulta.gte(coluna, condicao.valor).lte(coluna, condicao.ate)
    case 'preenchido':
      return consulta.not(coluna, 'is', null)
    case 'nao_informado':
      return consulta.is(coluna, null)
    case 'ha_mais_de_dias':
      return consulta.not(coluna, 'is', null).lt(coluna, diasAtras(Number(condicao.valor)))
    case 'ha_menos_de_dias':
      return consulta.not(coluna, 'is', null).gte(coluna, diasAtras(Number(condicao.valor)))
    default:
      return consulta
  }
}

function diasAtras(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ordenar(consulta: any, ordem: Ordem): any {
  switch (ordem) {
    case 'valor':
      // `nullsFirst: false` importa: quem não tem valor conhecido vai para o
      // fim, e não para o topo de uma lista ordenada por quanto gastou.
      return consulta
        .order('valor_conhecido', { ascending: false, nullsFirst: false })
        .order('contact_id', { ascending: true })
    case 'ultima_compra':
      return consulta
        .order('ultima_compra_em', { ascending: false, nullsFirst: false })
        .order('contact_id', { ascending: true })
    case 'nome':
      return consulta.order('nome', { ascending: true }).order('contact_id', { ascending: true })
    default:
      // Desempate estável: sem ele, dois contatos com o mesmo instante podem
      // trocar de lugar entre páginas e um deles nunca aparece.
      return consulta
        .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
        .order('contact_id', { ascending: true })
  }
}
