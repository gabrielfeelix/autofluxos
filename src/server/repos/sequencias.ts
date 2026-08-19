import 'server-only'
import {
  ehEventoDeSequencia,
  passosEmOrdem,
  type EventoDeSequencia,
  type Sequencia,
} from '@/core/sequencias'
import { db, ehIdInvalido } from '../db'

/**
 * As sequências de uma conta (0031).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide quando um passo roda é
 * `core/sequencias.ts`, e quem o executa é `server/sequencias.ts`.
 */

type LinhaDaSequencia = {
  id: string
  nome: string
  evento: string
  etiqueta_id: string | null
  etiqueta_de_saida_id: string | null
  coluna_id: string | null
  ativa: boolean
  sequencia_passos: { id: string; atraso_minutos: number; flow_id: string }[] | null
}

const COLUNAS =
  'id, nome, evento, etiqueta_id, etiqueta_de_saida_id, coluna_id, ativa, sequencia_passos (id, atraso_minutos, flow_id)'

function paraSequencia(linha: LinhaDaSequencia): Sequencia | null {
  // Evento que esta versão do código não conhece: a sequência some da lista em
  // vez de estourar. É o mesmo tratamento de `tarefas.tipo` — um deploy pela
  // metade não pode derrubar a tela de Automações inteira.
  if (!ehEventoDeSequencia(linha.evento)) return null

  return {
    id: linha.id,
    nome: linha.nome,
    evento: linha.evento,
    etiquetaId: linha.etiqueta_id,
    etiquetaDeSaidaId: linha.etiqueta_de_saida_id,
    colunaId: linha.coluna_id,
    ativa: linha.ativa,
    passos: passosEmOrdem(
      (linha.sequencia_passos ?? []).map((passo) => ({
        id: passo.id,
        atrasoMinutos: passo.atraso_minutos,
        fluxoId: passo.flow_id,
      })),
    ),
  }
}

export async function listarSequencias(clienteId: string): Promise<Sequencia[]> {
  const { data, error } = await db()
    .from('sequencias')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar as sequências: ${error.message}`)
  return (data as unknown as LinhaDaSequencia[])
    .map(paraSequencia)
    .filter((s): s is Sequencia => s !== null)
}

/**
 * As que podem inscrever alguém agora.
 *
 * Filtra por evento no banco e não na aplicação: quem chama é o caminho quente
 * — toda etiqueta aplicada e todo "Já atendi" passam por aqui —, e trazer a
 * lista inteira para descartar a maioria custaria a viagem toda vez.
 */
export async function sequenciasDoEvento(
  clienteId: string,
  evento: EventoDeSequencia,
  /** A etiqueta ou a etapa que disparou, conforme o evento. Nulo nos demais. */
  alvoId: string | null,
): Promise<Sequencia[]> {
  let consulta = db()
    .from('sequencias')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('evento', evento)
    .eq('ativa', true)

  // O alvo é lido na coluna que **este** evento usa. Filtrar sempre por
  // `etiqueta_id` faria o evento de etapa não achar nada, em silêncio.
  if (alvoId && evento === 'etiqueta_aplicada') consulta = consulta.eq('etiqueta_id', alvoId)
  if (alvoId && evento === 'etapa_alcancada') consulta = consulta.eq('coluna_id', alvoId)

  const { data, error } = await consulta

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as sequências: ${error.message}`)

  return (data as unknown as LinhaDaSequencia[])
    .map(paraSequencia)
    .filter((s): s is Sequencia => s !== null)
    // Sequência sem passo não inscreve ninguém: ela existe na tela como
    // rascunho de acompanhamento, e inscrever alguém nela produziria uma
    // inscrição que nasce concluída.
    .filter((sequencia) => sequencia.passos.length > 0)
}

export async function acharSequencia(
  clienteId: string,
  sequenciaId: string,
): Promise<Sequencia | null> {
  const { data, error } = await db()
    .from('sequencias')
    .select(COLUNAS)
    .eq('id', sequenciaId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar a sequência: ${error.message}`)
  return data ? paraSequencia(data as unknown as LinhaDaSequencia) : null
}

export async function criarSequencia(
  clienteId: string,
  dados: {
    nome: string
    evento: EventoDeSequencia
    etiquetaId: string | null
    etiquetaDeSaidaId: string | null
    colunaId: string | null
  },
): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const nome = dados.nome.trim()
  if (nome === '') return { ok: false, motivo: 'dê um nome à sequência' }

  if (dados.evento === 'etiqueta_aplicada' && !dados.etiquetaId) {
    return { ok: false, motivo: 'escolha a etiqueta que dispara a sequência' }
  }
  if (dados.evento === 'etapa_alcancada' && !dados.colunaId) {
    return { ok: false, motivo: 'escolha a etapa do quadro que dispara a sequência' }
  }
  if (dados.colunaId && !(await etapaEhDoCliente(clienteId, dados.colunaId))) {
    return { ok: false, motivo: 'esta etapa não é deste cliente' }
  }

  // As etiquetas são conferidas contra o **mesmo cliente**: os ids chegam de
  // formulário, e a chave estrangeira só sabe que existem, não de quem são.
  for (const id of [dados.etiquetaId, dados.etiquetaDeSaidaId]) {
    if (!id) continue
    if (!(await etiquetaEhDoCliente(clienteId, id))) {
      return { ok: false, motivo: 'esta etiqueta não é deste cliente' }
    }
  }

  const { data, error } = await db()
    .from('sequencias')
    .insert({
      client_id: clienteId,
      nome,
      evento: dados.evento,
      etiqueta_id: dados.evento === 'etiqueta_aplicada' ? dados.etiquetaId : null,
      etiqueta_de_saida_id: dados.etiquetaDeSaidaId,
      coluna_id: dados.evento === 'etapa_alcancada' ? dados.colunaId : null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`não deu para criar a sequência: ${error.message}`)
  return { ok: true, id: (data as { id: string }).id }
}

/** A etapa é de um quadro **deste** cliente? O id vem de formulário (0034). */
async function etapaEhDoCliente(clienteId: string, colunaId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('quadro_colunas')
    .select('id, quadros!inner (client_id)')
    .eq('id', colunaId)
    .eq('quadros.client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para conferir a etapa: ${error.message}`)
  return data !== null
}

async function etiquetaEhDoCliente(clienteId: string, etiquetaId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('etiquetas')
    .select('id')
    .eq('id', etiquetaId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para conferir a etiqueta: ${error.message}`)
  return data !== null
}

export async function alternarSequencia(
  clienteId: string,
  sequenciaId: string,
  ativa: boolean,
): Promise<boolean> {
  const { data, error } = await db()
    .from('sequencias')
    .update({ ativa })
    .eq('id', sequenciaId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para mudar a sequência: ${error.message}`)
  return data !== null
}

/**
 * Apaga a sequência inteira.
 *
 * Passos e inscrições vão junto por `cascade`, e aqui isso é o certo: uma
 * inscrição sem sequência não tem passo para executar, e o agendador já a
 * ignoraria. É diferente de pasta e fluxo, onde o que some é um desenho.
 */
export async function apagarSequencia(clienteId: string, sequenciaId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('sequencias')
    .delete()
    .eq('id', sequenciaId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar a sequência: ${error.message}`)
  return data !== null
}

export async function criarPasso(
  clienteId: string,
  sequenciaId: string,
  passo: { atrasoMinutos: number; fluxoId: string },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const sequencia = await acharSequencia(clienteId, sequenciaId)
  if (!sequencia) return { ok: false, motivo: 'esta sequência não existe mais' }

  const { data: fluxo, error: erroDoFluxo } = await db()
    .from('flows')
    .select('id')
    .eq('id', passo.fluxoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(erroDoFluxo)) return { ok: false, motivo: 'escolha um fluxo válido' }
  if (erroDoFluxo) throw new Error(`não deu para conferir o fluxo: ${erroDoFluxo.message}`)
  if (!fluxo) return { ok: false, motivo: 'este fluxo não é deste cliente' }

  const { error } = await db()
    .from('sequencia_passos')
    .insert({
      sequencia_id: sequenciaId,
      atraso_minutos: passo.atrasoMinutos,
      flow_id: passo.fluxoId,
    })

  if (error?.code === '23505') return { ok: false, motivo: 'já existe um passo neste mesmo tempo' }
  if (error) throw new Error(`não deu para criar o passo: ${error.message}`)
  return { ok: true }
}

/**
 * Apaga um passo.
 *
 * **As inscrições ativas não são reindexadas**, e isso é deliberado: elas
 * guardam o índice do próximo passo, e apagar um passo do meio desloca a lista.
 * Quem já estava no índice 2 pode acabar recebendo o que era o passo 3, ou
 * terminando cedo. A alternativa — reindexar todo mundo — significaria decidir,
 * por outra pessoa, se ela "já recebeu" um passo que nunca existiu para ela.
 *
 * O comportamento escolhido é o que erra para menos: no pior caso a inscrição
 * termina antes, e ninguém recebe nada duas vezes.
 */
export async function apagarPasso(
  clienteId: string,
  sequenciaId: string,
  passoId: string,
): Promise<boolean> {
  const sequencia = await acharSequencia(clienteId, sequenciaId)
  if (!sequencia) return false

  const { data, error } = await db()
    .from('sequencia_passos')
    .delete()
    .eq('id', passoId)
    .eq('sequencia_id', sequenciaId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar o passo: ${error.message}`)
  return data !== null
}

// ---------------------------------------------------------------------------
// Inscrições
// ---------------------------------------------------------------------------

export type Inscricao = {
  id: string
  sequenciaId: string
  contatoId: string
  clienteId: string
  estado: 'ativa' | 'concluida' | 'saiu' | 'bloqueada'
  passoAtual: number
  entrouEm: string
}

type LinhaDaInscricao = {
  id: string
  sequencia_id: string
  contact_id: string
  client_id: string
  estado: string
  passo_atual: number
  entrou_em: string
}

function paraInscricao(linha: LinhaDaInscricao): Inscricao {
  return {
    id: linha.id,
    sequenciaId: linha.sequencia_id,
    contatoId: linha.contact_id,
    clienteId: linha.client_id,
    estado: linha.estado as Inscricao['estado'],
    passoAtual: linha.passo_atual,
    entrouEm: linha.entrou_em,
  }
}

const COLUNAS_DA_INSCRICAO = 'id, sequencia_id, contact_id, client_id, estado, passo_atual, entrou_em'

/**
 * Inscreve, ou devolve `null` quando já havia uma ativa.
 *
 * O índice único parcial da 0031 é quem garante isso de verdade — duas
 * aplicações da mesma etiqueta chegando juntas passariam por qualquer
 * conferência feita antes. Aqui o conflito é lido como "já estava dentro", que
 * é o que ele significa, e não como falha.
 */
export async function inscrever(
  clienteId: string,
  sequenciaId: string,
  contatoId: string,
): Promise<Inscricao | null> {
  const { data, error } = await db()
    .from('sequencia_inscricoes')
    .insert({ client_id: clienteId, sequencia_id: sequenciaId, contact_id: contatoId })
    .select(COLUNAS_DA_INSCRICAO)
    .maybeSingle()

  if (error?.code === '23505') return null
  if (error) throw new Error(`não deu para inscrever na sequência: ${error.message}`)
  return data ? paraInscricao(data as LinhaDaInscricao) : null
}

export async function acharInscricao(inscricaoId: string): Promise<Inscricao | null> {
  const { data, error } = await db()
    .from('sequencia_inscricoes')
    .select(COLUNAS_DA_INSCRICAO)
    .eq('id', inscricaoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar a inscrição: ${error.message}`)
  return data ? paraInscricao(data as LinhaDaInscricao) : null
}

/** Avança o ponteiro depois de um passo sair. */
export async function avancarInscricao(inscricaoId: string, proximoIndice: number): Promise<void> {
  const { error } = await db()
    .from('sequencia_inscricoes')
    .update({ passo_atual: proximoIndice, atualizado_em: new Date().toISOString() })
    .eq('id', inscricaoId)

  if (error) throw new Error(`não deu para avançar a inscrição: ${error.message}`)
}

export async function encerrarInscricao(
  inscricaoId: string,
  estado: 'concluida' | 'saiu' | 'bloqueada',
  motivo: string | null,
): Promise<void> {
  const { error } = await db()
    .from('sequencia_inscricoes')
    .update({ estado, motivo, atualizado_em: new Date().toISOString() })
    .eq('id', inscricaoId)

  if (error) throw new Error(`não deu para encerrar a inscrição: ${error.message}`)
}

/**
 * Tira o contato de todas as sequências em que ele está, e devolve os ids.
 *
 * Os ids voltam para quem chama cancelar as tarefas agendadas — sem isso, cada
 * inscrição morta acordaria o agendador uma vez para ser ignorada.
 */
export async function sairDasSequencias(contatoId: string, motivo: string): Promise<string[]> {
  const { data, error } = await db().rpc('sair_das_sequencias', {
    p_contato_id: contatoId,
    p_motivo: motivo,
  })

  if (ehIdInvalido(error)) return []
  if (error) {
    // **Não pode derrubar quem chamou.** A saída acontece no caminho de uma
    // mensagem que já foi deduplicada e de ações de tela que já fizeram o que
    // importava; falhar aqui deixaria a pessoa sem resposta por causa de uma
    // limpeza. O custo do erro é uma mensagem de acompanhamento a mais.
    console.error('[sequencias] não deu para sair das sequências', error.message)
    return []
  }

  return (data as ({ sair_das_sequencias: string } | string)[]).map((linha) =>
    typeof linha === 'string' ? linha : linha.sair_das_sequencias,
  )
}

export type ContagemDaSequencia = {
  ativas: number
  concluidas: number
  sairam: number
  bloqueadas: number
}

/**
 * Quantos estão em cada estado, por sequência.
 *
 * Uma consulta para a lista inteira, e não uma por sequência: a tela de
 * Automações já carrega fluxos, gatilhos e campanhas, e N+1 aqui apareceria
 * como lentidão na tela que o cliente mais abre.
 */
export async function contarInscricoes(
  clienteId: string,
): Promise<Map<string, ContagemDaSequencia>> {
  const { data, error } = await db()
    .from('sequencia_inscricoes')
    .select('sequencia_id, estado')
    .eq('client_id', clienteId)

  if (ehIdInvalido(error)) return new Map()
  if (error) throw new Error(`não deu para contar as inscrições: ${error.message}`)

  const mapa = new Map<string, ContagemDaSequencia>()
  for (const linha of data as { sequencia_id: string; estado: string }[]) {
    const atual = mapa.get(linha.sequencia_id) ?? {
      ativas: 0,
      concluidas: 0,
      sairam: 0,
      bloqueadas: 0,
    }
    if (linha.estado === 'ativa') atual.ativas += 1
    else if (linha.estado === 'concluida') atual.concluidas += 1
    else if (linha.estado === 'saiu') atual.sairam += 1
    else if (linha.estado === 'bloqueada') atual.bloqueadas += 1
    mapa.set(linha.sequencia_id, atual)
  }
  return mapa
}

/**
 * Este fluxo é passo de alguma sequência?
 *
 * É a conferência que `apagarFluxo` passou a fazer, pelo mesmo motivo de ela
 * olhar os quatro papéis do número: um fluxo que é o passo 2 de um
 * acompanhamento está tão em uso quanto o principal, e apagá-lo pararia a
 * sequência em silêncio.
 */
export async function sequenciasQueUsamOFluxo(fluxoId: string): Promise<string[]> {
  const { data, error } = await db()
    .from('sequencia_passos')
    .select('sequencias!inner (nome)')
    .eq('flow_id', fluxoId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para conferir as sequências: ${error.message}`)

  return [
    ...new Set((data as unknown as { sequencias: { nome: string } }[]).map((l) => l.sequencias.nome)),
  ]
}

/** As sequências que usam esta etiqueta — para a tela de etiquetas recusar apagar. */
export async function sequenciasQueUsamAEtiqueta(
  clienteId: string,
  etiquetaId: string,
): Promise<string[]> {
  const { data, error } = await db()
    .from('sequencias')
    .select('nome')
    .eq('client_id', clienteId)
    .eq('etiqueta_id', etiquetaId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para conferir as sequências: ${error.message}`)
  return (data as { nome: string }[]).map((linha) => linha.nome)
}

/**
 * Tira do acompanhamento quem acabou de ganhar a etiqueta de saída.
 *
 * Precisa ser específica — e não a `sair_das_sequencias` genérica — porque a
 * etiqueta de saída é de **uma** sequência. Aplicar "virou aluno" não pode
 * tirar a pessoa de um acompanhamento de outra coisa que ela continua devendo.
 */
export async function sairPorEtiquetaDeSaida(
  clienteId: string,
  etiquetaId: string,
  contatos: string[],
): Promise<string[]> {
  if (contatos.length === 0) return []

  const { data: alvos, error: erroDasSequencias } = await db()
    .from('sequencias')
    .select('id')
    .eq('client_id', clienteId)
    .eq('etiqueta_de_saida_id', etiquetaId)

  if (ehIdInvalido(erroDasSequencias)) return []
  if (erroDasSequencias) {
    console.error('[sequencias] não deu para ler as de saída', erroDasSequencias.message)
    return []
  }

  const ids = (alvos as { id: string }[]).map((linha) => linha.id)
  if (ids.length === 0) return []

  const { data, error } = await db()
    .from('sequencia_inscricoes')
    .update({ estado: 'saiu', motivo: 'etiqueta_de_saida', atualizado_em: new Date().toISOString() })
    .in('sequencia_id', ids)
    .in('contact_id', contatos)
    .eq('estado', 'ativa')
    .select('id')

  if (error) {
    // Mesma razão de `sairDasSequencias`: quem chama já etiquetou, e falhar a
    // limpeza não pode desfazer isso.
    console.error('[sequencias] não deu para sair pela etiqueta', error.message)
    return []
  }

  return (data as { id: string }[]).map((linha) => linha.id)
}
