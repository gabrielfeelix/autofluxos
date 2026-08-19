import 'server-only'
import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { validar, type Problema } from '@/core/flow/validar'
import { db, ehIdInvalido, pareceUuid } from '../db'
import { listarConexoes } from './conexoes'
import { acharCliente } from './clientes'

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
  /**
   * De qual fluxo esta versão saiu.
   *
   * A sessão guarda a **versão**, não o fluxo, e até a A6 dava para deduzir o
   * fluxo pelo número que a conversa entrou (era um só). Com quatro papéis por
   * número e gatilhos que abrem qualquer fluxo, deduzir passou a errar — e
   * quem lê isso é o portão comercial da IA, que não pode olhar para o contrato
   * do fluxo errado.
   */
  fluxoId: string
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

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os fluxos: ${error.message}`)
  return (data as Linha[]).map(paraFluxo)
}

export async function acharFluxo(id: string): Promise<FluxoSalvo | null> {
  const { data, error } = await db().from('flows').select(COLUNAS).eq('id', id).maybeSingle()

  if (ehIdInvalido(error)) return null
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
export async function salvarRascunho(
  fluxoId: string,
  clienteId: string,
  rascunho: Fluxo,
): Promise<void> {
  const { data, error } = await db()
    .from('flows')
    .update({ rascunho: fluxoSchema.parse(rascunho) })
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(`não deu para salvar o rascunho: ${error.message}`)
  if (!data) throw new Error('esta automação não existe mais')
}

export async function acharVersao(id: string): Promise<VersaoPublicada | null> {
  const { data, error } = await db()
    .from('flow_versions')
    .select('id, flow_id, versao, publicado_em, grafo')
    .eq('id', id)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar a versão publicada: ${error.message}`)
  if (!data) return null

  return {
    id: data.id as string,
    fluxoId: data.flow_id as string,
    versao: data.versao as number,
    publicadoEm: data.publicado_em as string,
    grafo: fluxoSchema.parse(data.grafo),
  }
}

/**
 * Uma versão específica **desta** automação.
 *
 * O par (versão, fluxo) vem junto porque o id da versão chega da tela, e a tela
 * é adivinhável. Sem o `flow_id` no filtro, mandar o id de uma versão de outro
 * cliente publicaria o desenho dele aqui dentro — o mesmo buraco que a fase 1
 * fechou nas outras escritas.
 */
export async function acharVersaoDoFluxo(
  versaoId: string,
  fluxoId: string,
): Promise<VersaoPublicada | null> {
  const { data, error } = await db()
    .from('flow_versions')
    .select('id, flow_id, versao, publicado_em, grafo')
    .eq('id', versaoId)
    .eq('flow_id', fluxoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar a versão publicada: ${error.message}`)
  if (!data) return null

  return {
    id: data.id as string,
    fluxoId: data.flow_id as string,
    versao: data.versao as number,
    publicadoEm: data.publicado_em as string,
    grafo: fluxoSchema.parse(data.grafo),
  }
}

export async function listarVersoes(
  fluxoId: string,
): Promise<Omit<VersaoPublicada, 'grafo' | 'fluxoId'>[]> {
  const { data, error } = await db()
    .from('flow_versions')
    .select('id, versao, publicado_em')
    .eq('flow_id', fluxoId)
    .order('versao', { ascending: false })

  if (ehIdInvalido(error)) return []
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
  clienteId: string,
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
  if (!fluxo || fluxo.clienteId !== clienteId) {
    return {
      ok: false,
      erros: [{ codigo: 'FLUXO_SUMIU', mensagem: 'Este fluxo não existe mais.' }],
    }
  }

  // As conexões entram aqui, e não só no editor: uma aba aberta há uma hora
  // publicaria fluxo apontando para credencial já apagada. Recusa de tela é
  // conveniência; a que vale é esta.
  const conexoes = (await listarConexoes(fluxo.clienteId)).map((c) => c.id)
  const cliente = await acharCliente(fluxo.clienteId)
  const conferido = validar(analise.data, {
    iaHabilitada: fluxo.iaHabilitada,
    conexoes,
    temContextoDeNegocio: (cliente?.contextoNegocio ?? '').trim() !== '',
  })
  if (!conferido.ok) return { ok: false, erros: conferido.erros }

  await salvarRascunho(fluxoId, clienteId, analise.data)

  const { data, error } = await db().rpc('publicar_fluxo', {
    p_flow_id: fluxoId,
    p_grafo: analise.data,
  })

  if (error) throw new Error(`não deu para publicar: ${error.message}`)

  const linha = data as {
    id: string
    flow_id: string
    versao: number
    publicado_em: string
    grafo: unknown
  }
  return {
    ok: true,
    versao: {
      id: linha.id,
      fluxoId: linha.flow_id,
      versao: linha.versao,
      publicadoEm: linha.publicado_em,
      grafo: fluxoSchema.parse(linha.grafo),
    },
  }
}

/**
 * Apaga uma automação.
 *
 * Recusa quando ela está no ar em algum número: apagar um fluxo publicado que
 * um número executa deixa o bot mudo no WhatsApp de gente de verdade, e o
 * caminho honesto é desligar o número do fluxo primeiro — um ato deliberado, em
 * vez de um efeito colateral de "apagar aquele teste ali".
 *
 * O par (fluxo, cliente) vem junto porque a URL é adivinhável, como em toda
 * escrita por aqui.
 */
export async function apagarFluxo(
  clienteId: string,
  fluxoId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  // O filtro abaixo é uma string do PostgREST, e id que vira sintaxe é a mesma
  // classe de erro que injeção. Conferir a forma antes é mais barato do que
  // escapar, e um id que não parece uuid não existe mesmo.
  if (!pareceUuid(fluxoId)) return { ok: false, motivo: 'esta automação não existe mais' }

  // **Os quatro papéis, não só o principal** (0024). Um fluxo que só é o
  // "padrão para mídia" de um número não aparecia nesta conferência quando ela
  // olhava apenas `flow_id`, e apagá-lo devolveria a mídia ao handoff sem
  // ninguém ter pedido — em silêncio, que é o pior jeito de um produto mudar.
  const { data: canais, error: erroDosCanais } = await db()
    .from('channels')
    .select('phone_number_id')
    .or(
      [
        `flow_id.eq.${fluxoId}`,
        `flow_boas_vindas_id.eq.${fluxoId}`,
        `flow_midia_id.eq.${fluxoId}`,
        `flow_pos_atendimento_id.eq.${fluxoId}`,
      ].join(','),
    )

  if (ehIdInvalido(erroDosCanais)) return { ok: false, motivo: 'esta automação não existe mais' }
  if (erroDosCanais) throw new Error(`não deu para conferir os números: ${erroDosCanais.message}`)

  const ligados = (canais as { phone_number_id: string }[]) ?? []
  if (ligados.length > 0) {
    const numeros = [...new Set(ligados.map((c) => c.phone_number_id))]
    return {
      ok: false,
      motivo: `esta automação está ligada ao número ${numeros.join(', ')}. Desligue lá primeiro — apagar agora deixaria o bot mudo no WhatsApp.`,
    }
  }

  const { error } = await db().from('flows').delete().eq('id', fluxoId).eq('client_id', clienteId)
  if (error) throw new Error(`não deu para apagar a automação: ${error.message}`)
  return { ok: true }
}

/** Liga ou desliga a IA desta automação. É o que se vende, então é explícito. */
export async function definirIa(
  fluxoId: string,
  clienteId: string,
  habilitada: boolean,
): Promise<void> {
  const { data, error } = await db()
    .from('flows')
    .update({ ia_habilitada: habilitada })
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(`não deu para mudar a IA do fluxo: ${error.message}`)
  if (!data) throw new Error('esta automação não existe mais')
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
