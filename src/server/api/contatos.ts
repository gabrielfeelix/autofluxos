import 'server-only'
import { chavesDoTelefone } from '@/core/contatos/telefone'
import type { ValorDeCampo } from '@/core/campos'
import { db, ehIdInvalido } from '../db'
import { porNoQuadroPadrao } from '../quadro-de-entrada'
import { gravarCampos } from '../repos/campos'
import { acharContatoPeloTelefone } from '../repos/contato-por-telefone'
import { listarEtiquetas, marcarContatos } from '../repos/etiquetas'
import { anotar } from '../repos/eventos'
import { inscreverNoEvento, sairPelaEtiqueta } from '../sequencias'

/**
 * Contatos pela API pública (fase 1). A rota cuida de quem pode chamar; daqui
 * para baixo é o que a chamada faz, com as mesmas peças que a tela usa.
 */

/** O contato como a API devolve. Nomes em português, como o resto do produto. */
export type ContatoDaApi = {
  id: string
  nome: string | null
  telefone: string
  campos: Record<string, string>
  etiquetas: string[]
  estagio: string
  criado_em: string
}

type Linha = {
  id: string
  wa_id: string
  nome: string | null
  nome_real: string | null
  campos: Record<string, string> | null
  estagio: string | null
  criado_em: string
  contato_etiquetas?: { etiquetas: { nome: string } | null }[] | null
}

const COLUNAS = 'id, wa_id, nome, nome_real, campos, estagio, criado_em, contato_etiquetas(etiquetas(nome))'

function paraContato(linha: Linha): ContatoDaApi {
  return {
    id: linha.id,
    // O nome corrigido por gente vence o do perfil, como em toda leitura.
    nome: linha.nome_real ?? linha.nome,
    telefone: linha.wa_id,
    campos: linha.campos ?? {},
    etiquetas: (linha.contato_etiquetas ?? [])
      .map((vinculo) => vinculo.etiquetas?.nome)
      .filter((nome): nome is string => typeof nome === 'string')
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    estagio: linha.estagio ?? 'novo',
    criado_em: linha.criado_em,
  }
}

export async function lerContatoDaApi(clienteId: string, contatoId: string): Promise<ContatoDaApi | null> {
  const { data, error } = await db()
    .from('contacts')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('id', contatoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler o contato: ${error.message}`)
  return data ? paraContato(data as unknown as Linha) : null
}

export async function lerContatoPeloTelefone(clienteId: string, telefone: string): Promise<ContatoDaApi | null> {
  const id = await acharContatoPeloTelefone(clienteId, telefone)
  return id ? lerContatoDaApi(clienteId, id) : null
}

export type EntradaDeContato = {
  telefone: string
  nome?: string
  campos?: Record<string, string>
  etiquetas?: string[]
}

export type ResultadoDaGravacao =
  | { ok: true; criado: boolean; contato: ContatoDaApi; avisos: string[] }
  | { ok: false; motivo: 'telefone_invalido' }

/** O que a API grava é dado de outro sistema: perde para gente e para o bot. */
function valorDaApi(valor: string, em: string): ValorDeCampo {
  return { valor, origem: 'importacao', autorId: null, em }
}

/**
 * Cria ou atualiza pelo telefone.
 *
 * - **Novo**: `campos.origem = 'API'` (primeiro toque, congelado), entra no
 *   quadro padrão e ganha `chegou` na linha do tempo, como qualquer lead.
 * - **Existente**: nome e campos atualizados; `origem` não muda, porque ela é
 *   o primeiro toque e um segundo sistema não reescreve de onde a pessoa veio.
 * - **Etiqueta** que não existe na conta não é criada: volta em `avisos`. Criar
 *   sozinho encheria a conta de variações ("VIP", "vip ", "Vip") a cada erro de
 *   digitação do outro sistema.
 */
export async function gravarContatoDaApi(clienteId: string, entrada: EntradaDeContato): Promise<ResultadoDaGravacao> {
  const chaves = chavesDoTelefone(entrada.telefone)
  if (chaves.length === 0) return { ok: false, motivo: 'telefone_invalido' }

  const avisos: string[] = []
  const nome = entrada.nome?.trim() || null
  let contatoId = await acharContatoPeloTelefone(clienteId, entrada.telefone)
  let criado = false

  if (!contatoId) {
    // A primeira chave é a forma completa com DDI, a mesma que o WhatsApp usa.
    const { data, error } = await db()
      .from('contacts')
      .insert({ client_id: clienteId, wa_id: chaves[0], ...(nome ? { nome_real: nome } : {}) })
      .select('id')
      .single()

    if (error?.code === '23505') {
      // Outra chamada criou o mesmo telefone neste instante: segue como update.
      contatoId = await acharContatoPeloTelefone(clienteId, entrada.telefone)
    } else if (error) {
      throw new Error(`não deu para criar o contato: ${error.message}`)
    } else {
      contatoId = (data as { id: string }).id
      criado = true
    }
  } else if (nome) {
    const { error } = await db().from('contacts').update({ nome_real: nome }).eq('id', contatoId).eq('client_id', clienteId)
    if (error) throw new Error(`não deu para atualizar o nome: ${error.message}`)
  }

  if (!contatoId) throw new Error('o contato sumiu entre a criação e a leitura')

  const agora = new Date().toISOString()
  const campos: Record<string, ValorDeCampo> = {}
  for (const [chave, valor] of Object.entries(entrada.campos ?? {})) {
    if (chave === 'origem' && !criado) {
      avisos.push('campos.origem não muda depois que o contato existe: é de onde ele veio primeiro')
      continue
    }
    campos[chave] = valorDaApi(valor, agora)
  }
  if (criado && !campos.origem) campos.origem = valorDaApi('API', agora)

  if (Object.keys(campos).length > 0) {
    const gravacao = await gravarCampos(clienteId, contatoId, campos)
    if (gravacao.ok) {
      for (const recusa of gravacao.recusados) {
        avisos.push(`campos.${recusa.chave} não foi trocado: o valor atual foi escrito por alguém da equipe ou pelo próprio contato`)
      }
    }
  }

  if (entrada.etiquetas && entrada.etiquetas.length > 0) {
    avisos.push(...(await aplicarEtiquetas(clienteId, contatoId, entrada.etiquetas)))
  }

  if (criado) {
    await anotar(clienteId, contatoId, 'chegou', { origem: 'API' }, 'API')
    await porNoQuadroPadrao({ id: contatoId, clienteId })
  }

  const contato = await lerContatoDaApi(clienteId, contatoId)
  if (!contato) throw new Error('o contato sumiu depois de gravado')
  return { ok: true, criado, contato, avisos }
}

/** Aplica pelo nome, sem diferenciar maiúscula. Devolve os avisos. */
async function aplicarEtiquetas(clienteId: string, contatoId: string, nomes: string[]): Promise<string[]> {
  const existentes = await listarEtiquetas(clienteId)
  const porNome = new Map(existentes.map((etiqueta) => [etiqueta.nome.trim().toLocaleLowerCase('pt-BR'), etiqueta.id]))
  const avisos: string[] = []

  for (const nome of new Set(nomes.map((n) => n.trim()).filter(Boolean))) {
    const etiquetaId = porNome.get(nome.toLocaleLowerCase('pt-BR'))
    if (!etiquetaId) {
      avisos.push(`etiqueta "${nome}" não existe nesta conta e não foi aplicada`)
      continue
    }
    const marcou = await marcarContatos(clienteId, etiquetaId, [contatoId], true)
    // A mesma regra da tela: etiqueta aplicada mexe em sequência (0031).
    if (marcou.ok && marcou.mudaram > 0) {
      await sairPelaEtiqueta(clienteId, etiquetaId, marcou.validos)
      await inscreverNoEvento(clienteId, marcou.validos, 'etiqueta_aplicada', etiquetaId)
    }
  }
  return avisos
}

/* ------------------------------------------------------------- listagem (fase 4) */

export const LIMITE_PADRAO_DA_LISTA = 50
export const LIMITE_MAXIMO_DA_LISTA = 100

export type FiltroDaLista = {
  limite: number
  cursor?: string
  etiqueta?: string
  criadoDesde?: string
  criadoAte?: string
}

export type ResultadoDaLista =
  | { ok: true; contatos: ContatoDaApi[]; proximo_cursor: string | null }
  | { ok: false; motivo: 'cursor_invalido' | 'etiqueta_nao_encontrada' }

/**
 * O cursor é opaco para quem chama: o `criado_em` e o `id` do último contato
 * da página, em base64url. Ordem do mais antigo para o mais novo, que é o que
 * uma sincronização quer: contato novo entra no fim e não desloca as páginas
 * já lidas, como faria um `offset`.
 */
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

export function codificarCursor(criadoEm: string, id: string): string {
  return Buffer.from(JSON.stringify([criadoEm, id])).toString('base64url')
}

export function lerCursor(cursor: string): { criadoEm: string; id: string } | null {
  try {
    const valor = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown
    if (!Array.isArray(valor) || valor.length !== 2) return null
    const [criadoEm, id] = valor as unknown[]
    // O instante como o banco devolveu, com microssegundos: passar por `Date`
    // cortaria para milissegundos, e o último contato da página voltaria na
    // seguinte. A forma é conferida aqui porque o valor entra no filtro.
    if (typeof criadoEm !== 'string' || !INSTANTE.test(criadoEm)) return null
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null
    return { criadoEm, id: id.toLowerCase() }
  } catch {
    return null
  }
}

export async function listarContatosDaApi(clienteId: string, filtro: FiltroDaLista): Promise<ResultadoDaLista> {
  const depois = filtro.cursor ? lerCursor(filtro.cursor) : null
  if (filtro.cursor && !depois) return { ok: false, motivo: 'cursor_invalido' }

  let etiquetaId: string | null = null
  if (filtro.etiqueta) {
    const procurada = filtro.etiqueta.trim().toLocaleLowerCase('pt-BR')
    const achada = (await listarEtiquetas(clienteId)).find((e) => e.nome.trim().toLocaleLowerCase('pt-BR') === procurada)
    if (!achada) return { ok: false, motivo: 'etiqueta_nao_encontrada' }
    etiquetaId = achada.id
  }

  // Com filtro de etiqueta, a junção vira `inner` só para filtrar; as
  // etiquetas mostradas continuam vindo da junção completa.
  const colunas = etiquetaId ? `${COLUNAS}, filtro:contato_etiquetas!inner(etiqueta_id)` : COLUNAS
  let consulta = db()
    .from('contacts')
    .select(colunas)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })
    .order('id', { ascending: true })
    .limit(filtro.limite + 1)

  if (etiquetaId) consulta = consulta.eq('filtro.etiqueta_id', etiquetaId)
  if (filtro.criadoDesde) consulta = consulta.gte('criado_em', filtro.criadoDesde)
  if (filtro.criadoAte) consulta = consulta.lt('criado_em', filtro.criadoAte)
  if (depois) consulta = consulta.or(`criado_em.gt.${depois.criadoEm},and(criado_em.eq.${depois.criadoEm},id.gt.${depois.id})`)

  const { data, error } = await consulta
  if (error) throw new Error(`não deu para listar os contatos: ${error.message}`)

  const linhas = (data ?? []) as unknown as Linha[]
  const pagina = linhas.slice(0, filtro.limite)
  const ultima = pagina[pagina.length - 1]
  return {
    ok: true,
    contatos: pagina.map(paraContato),
    proximo_cursor: linhas.length > filtro.limite && ultima ? codificarCursor(ultima.criado_em, ultima.id) : null,
  }
}

export type EtiquetaDaApi = { id: string; nome: string; cor: string }

export async function listarEtiquetasDaApi(clienteId: string): Promise<EtiquetaDaApi[]> {
  return (await listarEtiquetas(clienteId)).map((e) => ({ id: e.id, nome: e.nome, cor: e.cor }))
}
