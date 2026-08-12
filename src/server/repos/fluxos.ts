import 'server-only'
import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { validar, type Problema } from '@/core/flow/validar'
import { db } from '../db'

/**
 * Um fluxo salvo no banco. `rascunho` é o grafo mutável — o que o editor
 * escreve. O publicado vira linha imutável em `flow_versions` no passo 5.
 */
export type FluxoSalvo = {
  id: string
  clienteId: string
  nome: string
  rascunho: Fluxo
  atualizadoEm: string
  /** `null` = nunca publicado. */
  versaoPublicadaId: string | null
  /**
   * Etapa 2 contratada **para esta automação** (0005).
   *
   * Fica no fluxo e não no cliente porque é a automação que se vende: o mesmo
   * negócio pode ter uma triagem simples e uma automação com IA.
   */
  iaHabilitada: boolean
}

/** Uma foto imutável do fluxo. É isto que as conversas executam. */
export type VersaoPublicada = {
  id: string
  versao: number
  publicadoEm: string
  grafo: Fluxo
}

type Linha = {
  id: string
  client_id: string
  nome: string
  rascunho: unknown
  atualizado_em: string
  versao_publicada_id: string | null
  ia_habilitada: boolean
}

const COLUNAS =
  'id, client_id, nome, rascunho, atualizado_em, versao_publicada_id, ia_habilitada'

/**
 * `rascunho` é `jsonb`: o banco aceita qualquer coisa ali. Uma migração
 * malfeita, um `update` na mão pelo painel, uma versão antiga do schema — e o
 * motor receberia lixo. Validar na leitura é a mesma disciplina da fronteira
 * de rede, e o erro aponta o fluxo culpado em vez de estourar lá dentro.
 */
function paraFluxo(linha: Linha): FluxoSalvo {
  const analise = fluxoSchema.safeParse(linha.rascunho)
  if (!analise.success) {
    throw new Error(
      `o fluxo "${linha.nome}" (${linha.id}) está com o grafo inválido no banco: ` +
        analise.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; '),
    )
  }

  return {
    id: linha.id,
    clienteId: linha.client_id,
    nome: linha.nome,
    rascunho: analise.data,
    atualizadoEm: linha.atualizado_em,
    versaoPublicadaId: linha.versao_publicada_id,
    iaHabilitada: linha.ia_habilitada,
  }
}

export async function listarFluxos(clienteId: string): Promise<FluxoSalvo[]> {
  const { data, error } = await db()
    .from('flows')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (error) throw new Error(`não deu para listar os fluxos: ${error.message}`)
  return (data as Linha[]).map(paraFluxo)
}

export async function acharFluxo(id: string): Promise<FluxoSalvo | null> {
  const { data, error } = await db().from('flows').select(COLUNAS).eq('id', id).maybeSingle()

  if (error) throw new Error(`não deu para buscar o fluxo: ${error.message}`)
  return data ? paraFluxo(data as Linha) : null
}

export async function criarFluxo(
  clienteId: string,
  nome: string,
  rascunho: Fluxo,
  iaHabilitada = false,
): Promise<FluxoSalvo> {
  const { data, error } = await db()
    .from('flows')
    .insert({
      client_id: clienteId,
      nome: nome.trim(),
      rascunho: fluxoSchema.parse(rascunho),
      ia_habilitada: iaHabilitada,
    })
    .select(COLUNAS)
    .single()

  if (error) throw new Error(`não deu para criar o fluxo: ${error.message}`)
  return paraFluxo(data as Linha)
}

/** Salva o desenho. Valida antes de gravar — o banco nunca recebe grafo torto. */
export async function salvarRascunho(id: string, rascunho: Fluxo): Promise<void> {
  const { error } = await db()
    .from('flows')
    .update({ rascunho: fluxoSchema.parse(rascunho) })
    .eq('id', id)

  if (error) throw new Error(`não deu para salvar o rascunho: ${error.message}`)
}

export async function acharVersao(id: string): Promise<VersaoPublicada | null> {
  const { data, error } = await db()
    .from('flow_versions')
    .select('id, versao, publicado_em, grafo')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`não deu para buscar a versão publicada: ${error.message}`)
  if (!data) return null

  return {
    id: data.id as string,
    versao: data.versao as number,
    publicadoEm: data.publicado_em as string,
    grafo: fluxoSchema.parse(data.grafo),
  }
}

export async function listarVersoes(fluxoId: string): Promise<Omit<VersaoPublicada, 'grafo'>[]> {
  const { data, error } = await db()
    .from('flow_versions')
    .select('id, versao, publicado_em')
    .eq('flow_id', fluxoId)
    .order('versao', { ascending: false })

  if (error) throw new Error(`não deu para listar as versões: ${error.message}`)
  return (data as { id: string; versao: number; publicado_em: string }[]).map((v) => ({
    id: v.id,
    versao: v.versao,
    publicadoEm: v.publicado_em,
  }))
}

/**
 * Publica o desenho: guarda o rascunho como versão imutável e aponta o fluxo
 * para ela.
 *
 * **O portão de qualidade é aqui, não no botão.** O botão desabilitado é
 * conveniência; um fluxo sem saída para humano tem que ser recusado mesmo que
 * a chamada venha de outro lugar.
 *
 * Salva o rascunho junto, de propósito: publicar tem que publicar exatamente o
 * que está na tela de quem clicou, e não uma versão anterior que por acaso
 * estava no banco.
 *
 * O contrato de IA é lido **aqui**, do banco, e não recebido por parâmetro. Um
 * booleano que chega de fora é um booleano que a chamada errada manda `true` —
 * e este é o portão que separa quem paga pela Etapa 2 de quem não paga.
 */
export async function publicar(
  fluxoId: string,
  grafo: unknown,
): Promise<{ ok: true; versao: VersaoPublicada } | { ok: false; erros: Problema[] }> {
  const analise = fluxoSchema.safeParse(grafo)
  if (!analise.success) {
    return {
      ok: false,
      erros: [{ codigo: 'ESTRUTURA_INVALIDA', mensagem: 'O desenho chegou com formato inválido.' }],
    }
  }

  const fluxo = await acharFluxo(fluxoId)
  if (!fluxo) {
    return {
      ok: false,
      erros: [{ codigo: 'FLUXO_SUMIU', mensagem: 'Este fluxo não existe mais.' }],
    }
  }

  const conferido = validar(analise.data, { iaHabilitada: fluxo.iaHabilitada })
  if (!conferido.ok) return { ok: false, erros: conferido.erros }

  await salvarRascunho(fluxoId, analise.data)

  const { data, error } = await db().rpc('publicar_fluxo', {
    p_flow_id: fluxoId,
    p_grafo: analise.data,
  })

  if (error) throw new Error(`não deu para publicar: ${error.message}`)

  const linha = data as { id: string; versao: number; publicado_em: string; grafo: unknown }
  return {
    ok: true,
    versao: {
      id: linha.id,
      versao: linha.versao,
      publicadoEm: linha.publicado_em,
      grafo: fluxoSchema.parse(linha.grafo),
    },
  }
}

/** Liga ou desliga a IA desta automação. É o que se vende, então é explícito. */
export async function definirIa(fluxoId: string, habilitada: boolean): Promise<void> {
  const { error } = await db()
    .from('flows')
    .update({ ia_habilitada: habilitada })
    .eq('id', fluxoId)

  if (error) throw new Error(`não deu para mudar a IA do fluxo: ${error.message}`)
}

export type ResumoDeAutomacoes = { total: number; comIa: number }

/**
 * Quantas automações cada cliente tem, e quantas usam IA.
 *
 * Uma consulta só para a lista inteira, e não uma por cliente: a tela de
 * clientes é a primeira coisa que abre, e N+1 ali aparece como lentidão logo no
 * login. Devolve mapa para a tela não precisar procurar.
 */
export async function resumirAutomacoes(): Promise<Map<string, ResumoDeAutomacoes>> {
  const { data, error } = await db().from('flows').select('client_id, ia_habilitada')

  if (error) throw new Error(`não deu para contar as automações: ${error.message}`)

  const mapa = new Map<string, ResumoDeAutomacoes>()
  for (const linha of data as { client_id: string; ia_habilitada: boolean }[]) {
    const atual = mapa.get(linha.client_id) ?? { total: 0, comIa: 0 }
    atual.total += 1
    if (linha.ia_habilitada) atual.comIa += 1
    mapa.set(linha.client_id, atual)
  }
  return mapa
}
