import 'server-only'
import { randomBytes } from 'node:crypto'
import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { estadoDoLink, type EstadoDoLink } from '@/core/compartilhar'
import { db, ehIdInvalido } from '../db'

/**
 * Os links públicos de um fluxo (0030).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide o que sai do grafo é
 * `core/compartilhar.ts`, e quem decide se a pessoa pode gerar link é
 * `acoes.ts`.
 */

export type LinkDoFluxo = {
  id: string
  fluxoId: string
  token: string
  nome: string
  expiraEm: string | null
  revogadoEm: string | null
  aberturas: number
  importacoes: number
  criadoEm: string
  estado: EstadoDoLink
}

type Linha = {
  id: string
  flow_id: string
  token: string
  nome: string
  expira_em: string | null
  revogado_em: string | null
  aberturas: number
  importacoes: number
  criado_em: string
}

const COLUNAS =
  'id, flow_id, token, nome, expira_em, revogado_em, aberturas, importacoes, criado_em'

function paraLink(linha: Linha): LinkDoFluxo {
  const parcial = { expiraEm: linha.expira_em, revogadoEm: linha.revogado_em }
  return {
    id: linha.id,
    fluxoId: linha.flow_id,
    token: linha.token,
    nome: linha.nome,
    expiraEm: linha.expira_em,
    revogadoEm: linha.revogado_em,
    aberturas: linha.aberturas,
    importacoes: linha.importacoes,
    criadoEm: linha.criado_em,
    estado: estadoDoLink(parcial),
  }
}

/**
 * 24 bytes de aleatoriedade criptográfica, em `base64url`.
 *
 * Não é `uuid`: uuid v4 tem 122 bits e aparece em log, em URL de outra coisa e
 * na cabeça de quem já viu um id nosso — parece adivinhável mesmo não sendo, e
 * a diferença entre parecer e ser custa uma conversa a cada auditoria. 192 bits
 * fecham o assunto, e `base64url` cabe numa URL sem escapar nada.
 */
function novoToken(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Cria o link de uma **versão publicada**.
 *
 * Recusa fluxo sem publicação, e a recusa é de produto, não de implementação:
 * rascunho muda a cada tecla, e um link para ele significaria uma coisa hoje e
 * outra amanhã sem ninguém ter reenviado nada. Publicar é o ato que congela o
 * desenho — é dele que o link nasce.
 */
export async function criarLink(
  clienteId: string,
  fluxoId: string,
  opcoes: { dias: number | null; criadoPor: string | null },
): Promise<{ ok: true; link: LinkDoFluxo } | { ok: false; motivo: string }> {
  const { data: fluxo, error: erroDoFluxo } = await db()
    .from('flows')
    .select('id, nome, versao_publicada_id')
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(erroDoFluxo)) return { ok: false, motivo: 'esta automação não existe mais' }
  if (erroDoFluxo) throw new Error(`não deu para conferir o fluxo: ${erroDoFluxo.message}`)
  if (!fluxo) return { ok: false, motivo: 'esta automação não é deste cliente' }

  const versaoId = (fluxo as { versao_publicada_id: string | null }).versao_publicada_id
  if (!versaoId) {
    return {
      ok: false,
      motivo: 'publique o fluxo antes de compartilhar — o link aponta para uma versão publicada, não para o rascunho',
    }
  }

  const expiraEm =
    opcoes.dias === null ? null : new Date(Date.now() + opcoes.dias * 86_400_000).toISOString()

  const { data, error } = await db()
    .from('fluxo_links')
    .insert({
      client_id: clienteId,
      flow_id: fluxoId,
      flow_version_id: versaoId,
      token: novoToken(),
      nome: (fluxo as { nome: string }).nome,
      expira_em: expiraEm,
      criado_por: opcoes.criadoPor,
    })
    .select(COLUNAS)
    .single()

  if (error) throw new Error(`não deu para criar o link: ${error.message}`)
  return { ok: true, link: paraLink(data as Linha) }
}

/** Os links deste fluxo, do mais novo para o mais velho. Inclui os mortos. */
export async function listarLinks(clienteId: string, fluxoId: string): Promise<LinkDoFluxo[]> {
  const { data, error } = await db()
    .from('fluxo_links')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('flow_id', fluxoId)
    .order('criado_em', { ascending: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os links: ${error.message}`)
  return (data as Linha[]).map(paraLink)
}

/**
 * Revoga: marca a data, não apaga a linha.
 *
 * A contagem de aberturas e importações é o histórico do que aquele link fez, e
 * apagar para "fechar o acesso" jogaria fora exatamente o número que responde
 * se valeu a pena ter compartilhado.
 */
export async function revogarLink(clienteId: string, linkId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('fluxo_links')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', linkId)
    .eq('client_id', clienteId)
    .is('revogado_em', null)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para revogar o link: ${error.message}`)
  return data !== null
}

export type LinkAberto = {
  id: string
  nome: string
  estado: EstadoDoLink
  /** Só vem quando o estado é `valido` — ver abaixo. */
  grafo: Fluxo | null
  /** Nome da conta que compartilhou. É a procedência de quem recebe. */
  origem: string
  versao: number
  publicadoEm: string
}

/**
 * O que a página pública lê.
 *
 * **O grafo só é carregado quando o link vale.** Ler primeiro e esconder na
 * tela seria mandar o desenho de um cliente pelo fio de um link já revogado,
 * onde o único obstáculo passaria a ser o navegador não desenhá-lo.
 *
 * A busca é por token e nada mais: não há `clienteId` aqui porque não há sessão
 * aqui. É a única leitura do sistema que funciona sem ninguém autenticado, e é
 * por isso que ela devolve exatamente três coisas — nome, procedência e
 * desenho — e nenhum id interno da conta de origem.
 */
export async function acharPorToken(token: string): Promise<LinkAberto | null> {
  if (token.trim() === '') return null

  const { data, error } = await db()
    .from('fluxo_links')
    .select(
      'id, nome, expira_em, revogado_em, flow_version_id, clients!inner (nome), flow_versions!inner (versao, publicado_em, grafo)',
    )
    .eq('token', token)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para abrir o link: ${error.message}`)
  if (!data) return null

  const linha = data as unknown as {
    id: string
    nome: string
    expira_em: string | null
    revogado_em: string | null
    clients: { nome: string }
    flow_versions: { versao: number; publicado_em: string; grafo: unknown }
  }

  const estado = estadoDoLink({ expiraEm: linha.expira_em, revogadoEm: linha.revogado_em })

  return {
    id: linha.id,
    nome: linha.nome,
    estado,
    grafo: estado === 'valido' ? fluxoSchema.parse(linha.flow_versions.grafo) : null,
    origem: linha.clients.nome,
    versao: linha.flow_versions.versao,
    publicadoEm: linha.flow_versions.publicado_em,
  }
}

/**
 * Conta a abertura. Falha aqui **não** pode derrubar a página.
 *
 * Quem chama é uma rota pública, e um contador que estoura tiraria do ar a
 * única coisa que o link existe para fazer. O mesmo raciocínio de `agendar()`.
 */
export async function contarAbertura(linkId: string): Promise<void> {
  const { error } = await db().rpc('contar_abertura_do_link', { p_link_id: linkId })
  if (error) console.error('[compartilhar] não deu para contar a abertura', error.message)
}

export async function contarImportacao(linkId: string): Promise<void> {
  const { error } = await db().rpc('contar_importacao_do_link', { p_link_id: linkId })
  if (error) console.error('[compartilhar] não deu para contar a importação', error.message)
}
