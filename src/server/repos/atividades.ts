import 'server-only'
import {
  conferirTitulo,
  fronteirasDoDia,
  padraoSemAcento,
  POR_PAGINA_DA_AGENDA,
  RECORTES_DA_AGENDA,
  type Atividade,
  type DestinoAoFechar,
  type FiltroDaAgenda,
  type RecorteDaAgenda,
  type SituacaoDaAtividade,
  type TipoDeAtividade,
} from '@/core/atividades'
import { digitos, telefoneLegivel } from '@/core/contatos/telefone'
import type { FiltroDeEscopo } from '@/core/permissoes'
import { db, ehIdInvalido } from '../db'

/**
 * A agenda humana no banco (0081).
 *
 * Como todo `repos/`: só ida ao banco, sem regra. Quem decide o que é vencida
 * e o que é a próxima ação é `core/atividades.ts`.
 *
 * **Nada aqui envia nada** (RB-33). Não há função que produza mensagem, nem
 * escrita em `mensagens_agendadas`, nem em `contacts.adiada_ate`. Uma
 * atividade não vira envio porque não existe caminho que a envie.
 */

type LinhaDaAtividade = {
  id: string
  contact_id: string
  cartao_id: string | null
  tipo: string
  titulo: string
  nota: string | null
  onde: string | null
  hora_marcada: boolean | null
  prazo: string | null
  responsavel: string | null
  situacao: string
  concluida_em: string | null
  motivo_do_cancelamento: string | null
  criado_em: string
  af_usuarios: { nome: string | null } | null
}

const COLUNAS =
  'id, contact_id, cartao_id, tipo, titulo, nota, onde, hora_marcada, prazo, responsavel, situacao, ' +
  'concluida_em, motivo_do_cancelamento, criado_em, af_usuarios (nome:name)'

function paraAtividade(linha: LinhaDaAtividade): Atividade {
  return {
    id: linha.id,
    contatoId: linha.contact_id,
    cartaoId: linha.cartao_id,
    tipo: (linha.tipo as TipoDeAtividade) ?? 'tarefa',
    titulo: linha.titulo,
    nota: linha.nota,
    onde: linha.onde ?? null,
    horaMarcada: Boolean(linha.hora_marcada),
    prazo: linha.prazo,
    responsavelId: linha.responsavel,
    responsavelNome: linha.af_usuarios?.nome ?? null,
    situacao: (linha.situacao as SituacaoDaAtividade) ?? 'aberta',
    concluidaEm: linha.concluida_em,
    motivoDoCancelamento: linha.motivo_do_cancelamento,
    criadoEm: linha.criado_em,
  }
}

export type ResultadoDaAtividade =
  | { ok: true; atividade: Atividade }
  | { ok: false; motivo: string }

export type PedidoDeAtividade = {
  clienteId: string
  contatoId: string
  cartaoId?: string | null
  tipo: TipoDeAtividade
  titulo: string
  nota?: string | null
  onde?: string | null
  horaMarcada?: boolean
  prazo?: string | null
  responsavelId?: string | null
  criadaPor?: string | null
}

/**
 * Cria a atividade.
 *
 * **Não agenda mensagem nenhuma.** Vale repetir aqui porque é onde alguém
 * seria tentado a acrescentar um `if (avisarCliente)`: o aviso ao cliente é
 * outra ação, com outra permissão e outra tabela.
 */
export async function criarAtividade(pedido: PedidoDeAtividade): Promise<ResultadoDaAtividade> {
  const conferido = conferirTitulo(pedido.titulo)
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  const { data, error } = await db()
    .from('atividades')
    .insert({
      client_id: pedido.clienteId,
      contact_id: pedido.contatoId,
      cartao_id: pedido.cartaoId ?? null,
      tipo: pedido.tipo,
      titulo: conferido.titulo,
      nota: pedido.nota?.trim() || null,
      onde: pedido.onde?.trim() || null,
      hora_marcada: pedido.horaMarcada ?? false,
      prazo: pedido.prazo ?? null,
      responsavel: pedido.responsavelId ?? null,
      criada_por: pedido.criadaPor ?? null,
    })
    .select(COLUNAS)
    .single()

  if (error) return { ok: false, motivo: `não deu para criar a atividade: ${error.message}` }
  return { ok: true, atividade: paraAtividade(data as unknown as LinhaDaAtividade) }
}

/** As atividades de um contato, abertas primeiro. */
export async function atividadesDoContato(
  clienteId: string,
  contatoId: string,
): Promise<Atividade[]> {
  const { data, error } = await db()
    .from('atividades')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)
    .order('situacao', { ascending: true })
    .order('prazo', { ascending: true, nullsFirst: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as atividades: ${error.message}`)
  return (data as unknown as LinhaDaAtividade[]).map(paraAtividade)
}

/** As atividades **abertas** de uma oportunidade. É o que a RB-28 mostra ao fechar. */
export async function abertasDoCartao(clienteId: string, cartaoId: string): Promise<Atividade[]> {
  const { data, error } = await db()
    .from('atividades')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)
    .eq('situacao', 'aberta')
    .order('prazo', { ascending: true, nullsFirst: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as atividades: ${error.message}`)
  return (data as unknown as LinhaDaAtividade[]).map(paraAtividade)
}

// ---------------------------------------------------------------------------
// A agenda paginada: a tela de Atividades
// ---------------------------------------------------------------------------

export type ItemDaAgenda = Atividade & {
  contato: { id: string; nome: string; telefone: string }
  negocio: { id: string; titulo: string | null; funil: string; etapa: string } | null
}

export type PaginaDaAgenda = {
  itens: ItemDaAgenda[]
  /** Quantas o filtro inteiro tem, não quantas vieram nesta página. */
  total: number
  /** Das abertas, com os mesmos filtros exceto recorte e situação. */
  contagens: Record<RecorteDaAgenda, number>
}

type LinhaDaAgenda = LinhaDaAtividade & {
  contacts: { id: string; nome: string | null; nome_real: string | null; wa_id: string } | null
  quadro_cartoes: {
    id: string
    titulo: string | null
    quadros: { nome: string } | null
    quadro_colunas: { nome: string } | null
  } | null
}

const COLUNAS_DA_AGENDA =
  COLUNAS +
  ', contacts (id, nome, nome_real, wa_id)' +
  ', quadro_cartoes (id, titulo, quadros (nome), quadro_colunas (nome))'

/** Quantos contatos a busca por nome considera. Acima disso, refine a busca. */
const LIMITE_DE_CONTATOS_DA_BUSCA = 500

const ZERADAS: Record<RecorteDaAgenda, number> = { vencidas: 0, hoje: 0, proximas: 0, 'sem-prazo': 0 }

/**
 * Uma página da agenda, com o total e as contagens dos atalhos.
 *
 * **O escopo entra na consulta**, e não depois. E com escopo `proprios`
 * o `alcance` e o `responsavel` pedidos na URL são ignorados: quem só vê o
 * próprio trabalho não vê o do colega digitando o id dele.
 *
 * **A busca não tem `unaccent`** (extensão é global e o banco é dividido com a
 * Verandi). O termo vira regex com classes de acento (`padraoSemAcento`) e
 * casa título, nome e nome real. Os dígitos do termo casam o `wa_id`, que é só
 * dígito: quem copia `+55 (44) 99877-5978` da tela acha o contato.
 */
export async function paginaDaAgenda(
  clienteId: string,
  escopo: FiltroDeEscopo,
  usuarioId: string,
  filtro: FiltroDaAgenda,
  agora: number,
): Promise<PaginaDaAgenda> {
  const vazia: PaginaDaAgenda = { itens: [], total: 0, contagens: { ...ZERADAS } }
  const preparo = await prepararAgenda(clienteId, escopo, usuarioId, filtro, agora)
  if (!preparo) return vazia
  const { comuns, doRecorte } = preparo

  const pagina = Math.max(1, filtro.pagina)
  const inicio = (pagina - 1) * POR_PAGINA_DA_AGENDA

  let lista = doRecorte(
    comuns(db().from('atividades').select(COLUNAS_DA_AGENDA, { count: 'exact' })),
    filtro.recorte,
  ).eq('situacao', filtro.situacao)
  lista =
    filtro.situacao === 'aberta'
      ? lista
          .order('prazo', { ascending: true, nullsFirst: false })
          .order('criado_em', { ascending: true })
      : lista.order('concluida_em', { ascending: false }).order('criado_em', { ascending: false })

  const [resposta, contagens] = await Promise.all([
    lista.order('id', { ascending: true }).range(inicio, inicio + POR_PAGINA_DA_AGENDA - 1),
    contar(preparo),
  ])

  if (ehIdInvalido(resposta.error)) return vazia
  if (resposta.error) throw new Error(`não deu para ler a agenda: ${resposta.error.message}`)

  return {
    itens: (resposta.data as unknown as LinhaDaAgenda[]).map(paraItemDaAgenda),
    total: resposta.count ?? 0,
    contagens,
  }
}

/** Teto de atividades num calendário: um mês cheio de uma equipe grande. */
export const TETO_DO_CALENDARIO = 600

/** Quantas "sem prazo" a faixa do calendário mostra. */
const TETO_SEM_PRAZO = 30

export type AgendaDoIntervalo = {
  /** Com prazo dentro do intervalo, em ordem de prazo. */
  itens: ItemDaAgenda[]
  /** `true` quando o intervalo tinha mais que `TETO_DO_CALENDARIO`. */
  cortado: boolean
  semPrazo: ItemDaAgenda[]
  totalSemPrazo: number
  contagens: Record<RecorteDaAgenda, number>
}

/**
 * A agenda de um intervalo de datas, para a vista de calendário (tarefa 1.6).
 *
 * **Mesma regra da lista**: escopo, busca, tipo, responsável, recorte e
 * situação saem de `prepararAgenda`. O calendário só troca a paginação por um
 * intervalo `[de, ate)` de prazo, e lê à parte as sem prazo, que não cabem em
 * dia nenhum.
 */
export async function agendaDoIntervalo(
  clienteId: string,
  escopo: FiltroDeEscopo,
  usuarioId: string,
  filtro: FiltroDaAgenda,
  agora: number,
  intervalo: { de: string; ate: string },
): Promise<AgendaDoIntervalo> {
  const vazia: AgendaDoIntervalo = { itens: [], cortado: false, semPrazo: [], totalSemPrazo: 0, contagens: { ...ZERADAS } }
  const preparo = await prepararAgenda(clienteId, escopo, usuarioId, filtro, agora)
  if (!preparo) return vazia
  const { comuns, doRecorte } = preparo

  const base = (colunas: string, opcoes?: { count: 'exact' }) =>
    doRecorte(comuns(db().from('atividades').select(colunas, opcoes)), filtro.recorte).eq('situacao', filtro.situacao)

  const [comPrazo, semPrazo, contagens] = await Promise.all([
    base(COLUNAS_DA_AGENDA)
      .gte('prazo', intervalo.de)
      .lt('prazo', intervalo.ate)
      .order('prazo', { ascending: true })
      .order('id', { ascending: true })
      .limit(TETO_DO_CALENDARIO + 1),
    base(COLUNAS_DA_AGENDA, { count: 'exact' })
      .is('prazo', null)
      .order('criado_em', { ascending: true })
      .limit(TETO_SEM_PRAZO),
    contar(preparo),
  ])

  for (const r of [comPrazo, semPrazo]) {
    if (ehIdInvalido(r.error)) return vazia
    if (r.error) throw new Error(`não deu para ler a agenda: ${r.error.message}`)
  }

  const linhas = comPrazo.data as unknown as LinhaDaAgenda[]
  return {
    itens: linhas.slice(0, TETO_DO_CALENDARIO).map(paraItemDaAgenda),
    cortado: linhas.length > TETO_DO_CALENDARIO,
    semPrazo: (semPrazo.data as unknown as LinhaDaAgenda[]).map(paraItemDaAgenda),
    totalSemPrazo: semPrazo.count ?? 0,
    contagens,
  }
}

/**
 * Só as contagens dos atalhos, para o número da barra lateral.
 *
 * Mesma regra da tela, então o número do menu e os atalhos da agenda nunca
 * discordam. Contagem exata: a versão antiga lia até 200 linhas e contava na
 * memória.
 */
export async function contagensDaAgenda(
  clienteId: string,
  escopo: FiltroDeEscopo,
  usuarioId: string,
  filtro: FiltroDaAgenda,
  agora: number,
): Promise<Record<RecorteDaAgenda, number>> {
  const preparo = await prepararAgenda(clienteId, escopo, usuarioId, filtro, agora)
  return preparo ? contar(preparo) : { ...ZERADAS }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Consulta = any

type Preparo = {
  comuns: (q: Consulta) => Consulta
  doRecorte: (q: Consulta, recorte: RecorteDaAgenda | null) => Consulta
}

async function contar({ comuns, doRecorte }: Preparo): Promise<Record<RecorteDaAgenda, number>> {
  const respostas = await Promise.all(
    RECORTES_DA_AGENDA.map((recorte) =>
      doRecorte(comuns(db().from('atividades').select('id', { count: 'exact', head: true })), recorte).eq(
        'situacao',
        'aberta',
      ),
    ),
  )
  const contado = { ...ZERADAS }
  RECORTES_DA_AGENDA.forEach((recorte, i) => {
    const c = respostas[i] as { count: number | null; error: { message: string } | null }
    if (c.error) throw new Error(`não deu para contar a agenda: ${c.error.message}`)
    contado[recorte] = c.count ?? 0
  })
  return contado
}

/** Monta os filtros comuns; `null` quando o resultado é vazio sem consultar. */
async function prepararAgenda(
  clienteId: string,
  escopo: FiltroDeEscopo,
  usuarioId: string,
  filtro: FiltroDaAgenda,
  agora: number,
): Promise<Preparo | null> {
  const vazia = null
  if (escopo.tipo === 'impossivel') return vazia

  // Quem pode ter atividade aqui: `null` = qualquer um.
  let responsaveis: string[] | null = null
  let soSemResponsavel = false
  if (escopo.tipo === 'proprios' || filtro.alcance === 'minhas') {
    responsaveis = [escopo.tipo === 'proprios' ? escopo.usuarioId : usuarioId]
  } else if (escopo.tipo === 'equipes') {
    const { data: membros, error } = await db()
      .from('equipe_membros')
      .select('usuario_id')
      .eq('client_id', clienteId)
      .in('equipe_id', [...escopo.equipes])
    if (error) throw new Error(`não deu para ler as equipes: ${error.message}`)
    responsaveis = [...new Set((membros as { usuario_id: string }[]).map((m) => m.usuario_id))]
  }

  // O responsável pedido só estreita, nunca amplia.
  if (escopo.tipo !== 'proprios' && filtro.responsavel === 'ninguem') {
    if (responsaveis !== null) return vazia
    soSemResponsavel = true
  } else if (escopo.tipo !== 'proprios' && filtro.responsavel) {
    const pedido = filtro.responsavel
    responsaveis = responsaveis === null ? [pedido] : responsaveis.filter((id) => id === pedido)
  }
  if (responsaveis !== null && responsaveis.length === 0) return vazia

  // A busca vira uma condição `or` só, montada uma vez.
  let busca: string | null = null
  if (filtro.busca !== '') {
    const padrao = padraoSemAcento(filtro.busca)
    const numeros = digitos(filtro.busca)
    const partesDoContato: string[] = []
    if (padrao.trim() !== '') partesDoContato.push(`nome.imatch.${padrao}`, `nome_real.imatch.${padrao}`)
    if (numeros.length >= 4) partesDoContato.push(`wa_id.like.*${numeros}*`)

    const ids: string[] = []
    if (partesDoContato.length > 0) {
      const { data, error } = await db()
        .from('contacts')
        .select('id')
        .eq('client_id', clienteId)
        .or(partesDoContato.join(','))
        .limit(LIMITE_DE_CONTATOS_DA_BUSCA)
      if (ehIdInvalido(error)) return vazia
      if (error) throw new Error(`não deu para buscar contatos: ${error.message}`)
      ids.push(...(data as { id: string }[]).map((c) => c.id))
    }

    const partes: string[] = []
    if (padrao.trim() !== '') partes.push(`titulo.imatch.${padrao}`)
    if (ids.length > 0) partes.push(`contact_id.in.(${ids.join(',')})`)
    if (partes.length === 0) return vazia
    busca = partes.join(',')
  }

  const { inicioDeHoje, inicioDeAmanha } = fronteirasDoDia(agora)

  // O que vale para a lista e para as contagens: tudo menos recorte e situação.
  const comuns = (q: Consulta): Consulta => {
    let r = q.eq('client_id', clienteId)
    if (responsaveis !== null) r = r.in('responsavel', responsaveis)
    if (soSemResponsavel) r = r.is('responsavel', null)
    if (filtro.tipo) r = r.eq('tipo', filtro.tipo)
    if (busca) r = r.or(busca)
    return r
  }
  const doRecorte = (q: Consulta, recorte: RecorteDaAgenda | null): Consulta => {
    if (recorte === 'vencidas') return q.lt('prazo', inicioDeHoje)
    if (recorte === 'hoje') return q.gte('prazo', inicioDeHoje).lt('prazo', inicioDeAmanha)
    if (recorte === 'proximas') return q.gte('prazo', inicioDeAmanha)
    if (recorte === 'sem-prazo') return q.is('prazo', null)
    return q
  }
  return { comuns, doRecorte }
}

function paraItemDaAgenda(linha: LinhaDaAgenda): ItemDaAgenda {
  const c = linha.contacts
  const cartao = linha.quadro_cartoes
  return {
    ...paraAtividade(linha),
    contato: {
      id: linha.contact_id,
      nome: c?.nome_real || c?.nome || telefoneLegivel(c?.wa_id ?? ''),
      telefone: telefoneLegivel(c?.wa_id ?? ''),
    },
    negocio: cartao
      ? {
          id: cartao.id,
          titulo: cartao.titulo,
          funil: cartao.quadros?.nome ?? '',
          etapa: cartao.quadro_colunas?.nome ?? '',
        }
      : null,
  }
}

/**
 * Conclui ou cancela.
 *
 * Cancelar **exige motivo** (RB-28): uma agenda cheia de canceladas sem
 * explicação não responde a pergunta que alguém faz depois, que é sempre "por
 * que isto não foi feito".
 */
export async function resolverAtividade(
  clienteId: string,
  atividadeId: string,
  situacao: 'concluida' | 'cancelada',
  motivo?: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const limpo = (motivo ?? '').trim()
  if (situacao === 'cancelada' && limpo === '') {
    return { ok: false, motivo: 'diga por que a atividade está sendo cancelada' }
  }

  const agora = new Date().toISOString()
  const { data, error } = await db()
    .from('atividades')
    .update({
      situacao,
      concluida_em: agora,
      motivo_do_cancelamento: situacao === 'cancelada' ? limpo : null,
      atualizado_em: agora,
    })
    .eq('client_id', clienteId)
    .eq('id', atividadeId)
    // Só resolve o que está aberto: o duplo clique não reescreve a data de
    // conclusão de ontem.
    .eq('situacao', 'aberta')
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'essa atividade não existe' }
  if (error) throw new Error(`não deu para resolver a atividade: ${error.message}`)
  return data ? { ok: true } : { ok: false, motivo: 'essa atividade já foi resolvida' }
}

/** De quem é a atividade e de qual contato, para a ação conferir o escopo. */
export async function donoDaAtividade(
  clienteId: string,
  atividadeId: string,
): Promise<{ contatoId: string; responsavelId: string | null } | null> {
  const { data, error } = await db()
    .from('atividades')
    .select('contact_id, responsavel')
    .eq('client_id', clienteId)
    .eq('id', atividadeId)
    .maybeSingle()
  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler a atividade: ${error.message}`)
  if (!data) return null
  const linha = data as { contact_id: string; responsavel: string | null }
  return { contatoId: linha.contact_id, responsavelId: linha.responsavel }
}

const SO_ABERTA = 'só dá para mudar atividade aberta'

/** Muda o prazo de uma atividade **aberta**. Tipo, contato e responsável ficam. */
export async function reagendarAtividade(
  clienteId: string,
  atividadeId: string,
  novo: { prazo: string | null; horaMarcada: boolean },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  return mudarAberta(clienteId, atividadeId, {
    prazo: novo.prazo,
    hora_marcada: novo.prazo !== null && novo.horaMarcada,
  })
}

/**
 * Passa a atividade para outra pessoa, ou para ninguém (`null`).
 *
 * O responsável precisa ser da conta (`ehMembroDaConta`).
 */
export async function atribuirAtividade(
  clienteId: string,
  atividadeId: string,
  responsavelId: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (responsavelId !== null && !(await ehMembroDaConta(clienteId, responsavelId))) {
    return { ok: false, motivo: 'essa pessoa não é da equipe desta conta' }
  }
  return mudarAberta(clienteId, atividadeId, { responsavel: responsavelId })
}

/**
 * A pessoa é da equipe desta conta?
 *
 * `af_usuarios` é global: sem esta conferência, um id de outra empresa viraria
 * dono de atividade daqui. Vale para atribuir e para criar.
 */
export async function ehMembroDaConta(clienteId: string, usuarioId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('af_membros')
    .select('userId')
    .eq('organizationId', clienteId)
    .eq('userId', usuarioId)
    .maybeSingle()
  if (error && !ehIdInvalido(error)) throw new Error(`não deu para ler a equipe: ${error.message}`)
  return Boolean(data)
}

async function mudarAberta(
  clienteId: string,
  atividadeId: string,
  campos: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data, error } = await db()
    .from('atividades')
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('id', atividadeId)
    .eq('situacao', 'aberta')
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'essa atividade não existe' }
  if (error) throw new Error(`não deu para mudar a atividade: ${error.message}`)
  if (data) return { ok: true }

  // Nada mudou: ou não existe nesta conta, ou não está aberta.
  const existe = await donoDaAtividade(clienteId, atividadeId)
  return { ok: false, motivo: existe ? SO_ABERTA : 'essa atividade não existe' }
}

/** Reabre uma atividade resolvida por engano. */
export async function reabrirAtividade(
  clienteId: string,
  atividadeId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data, error } = await db()
    .from('atividades')
    .update({
      situacao: 'aberta',
      concluida_em: null,
      motivo_do_cancelamento: null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('client_id', clienteId)
    .eq('id', atividadeId)
    .neq('situacao', 'aberta')
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'essa atividade não existe' }
  if (error) throw new Error(`não deu para reabrir: ${error.message}`)
  return data ? { ok: true } : { ok: false, motivo: 'essa atividade já está aberta' }
}

/**
 * O que fazer com as atividades abertas ao fechar a oportunidade (RB-28).
 *
 * `manter` não escreve nada, e é o ponto: elas continuam na agenda. A visita
 * marcada para a semana que vem continua marcada depois da venda fechada, e
 * concluí-la sozinha inventaria trabalho que ninguém fez.
 */
export async function resolverAoFechar(
  clienteId: string,
  cartaoId: string,
  destino: DestinoAoFechar,
  motivo?: string | null,
): Promise<{ resolvidas: number }> {
  if (destino === 'manter') return { resolvidas: 0 }

  const agora = new Date().toISOString()
  const { data, error } = await db()
    .from('atividades')
    .update({
      situacao: destino === 'concluir' ? 'concluida' : 'cancelada',
      concluida_em: agora,
      motivo_do_cancelamento:
        destino === 'cancelar' ? (motivo ?? '').trim() || 'oportunidade fechada' : null,
      atualizado_em: agora,
    })
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)
    .eq('situacao', 'aberta')
    .select('id')

  if (error) throw new Error(`não deu para resolver as atividades: ${error.message}`)
  return { resolvidas: (data as { id: string }[]).length }
}
