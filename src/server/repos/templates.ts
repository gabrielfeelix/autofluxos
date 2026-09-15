import 'server-only'
import {
  statusDaMeta,
  type Categoria,
  type Componentes,
  type StatusDoTemplate,
} from '@/core/templates'
import { db, ehIdInvalido } from '../db'

/**
 * Os modelos aprovados da Meta (0059).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide o que é válido é
 * `core/templates.ts`, e quem fala com a Meta é `channels/templates-api.ts`.
 *
 * **A chave natural é `(cliente_id, nome, idioma)`, não o id da Meta.** O mesmo
 * modelo lógico para 40 clientes são 40 templates com 40 ids diferentes — a
 * Meta não compartilha template entre contas. O `waba_template_id` é só o que
 * ela devolveu para aquele cliente, e é por ele que o webhook nos encontra.
 */

export type Template = {
  id: string
  clienteId: string
  nome: string
  idioma: string
  categoria: Categoria
  componentes: Componentes
  wabaTemplateId: string | null
  status: StatusDoTemplate
  qualidade: string | null
  motivoRecusa: string | null
  criadoEm: string
  atualizadoEm: string
}

type Linha = {
  id: string
  client_id?: string
  cliente_id: string
  nome: string
  idioma: string
  categoria: string
  componentes: unknown
  waba_template_id: string | null
  status: string
  qualidade: string | null
  motivo_recusa: string | null
  criado_em: string
  atualizado_em: string
}

const COLUNAS =
  'id, cliente_id, nome, idioma, categoria, componentes, waba_template_id, status, qualidade, motivo_recusa, criado_em, atualizado_em'

/**
 * O corpo é o único componente obrigatório — e o que o banco guarda é jsonb
 * livre, que pode vir de uma versão anterior do código.
 *
 * Um template com jsonb estranho vira um template de corpo vazio em vez de
 * derrubar a lista inteira: é o mesmo tratamento que `sequencias.ts` dá a um
 * evento que esta versão não conhece.
 */
function paraComponentes(bruto: unknown): Componentes {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return { corpo: '' }
  const objeto = bruto as Record<string, unknown>
  return {
    ...(objeto.cabecalho ? { cabecalho: objeto.cabecalho as Componentes['cabecalho'] } : {}),
    corpo: typeof objeto.corpo === 'string' ? objeto.corpo : '',
    ...(typeof objeto.rodape === 'string' ? { rodape: objeto.rodape } : {}),
    ...(Array.isArray(objeto.botoes) ? { botoes: objeto.botoes as Componentes['botoes'] } : {}),
  }
}

function paraTemplate(linha: Linha): Template {
  return {
    id: linha.id,
    clienteId: linha.cliente_id,
    nome: linha.nome,
    idioma: linha.idioma,
    categoria: linha.categoria as Categoria,
    componentes: paraComponentes(linha.componentes),
    wabaTemplateId: linha.waba_template_id,
    status: linha.status as StatusDoTemplate,
    qualidade: linha.qualidade,
    motivoRecusa: linha.motivo_recusa,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  }
}

export async function listarTemplates(clienteId: string): Promise<Template[]> {
  const { data, error } = await db()
    .from('templates')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: false })

  if (error) {
    if (ehIdInvalido(error)) return []
    throw error
  }
  return (data as Linha[]).map(paraTemplate)
}

export async function lerTemplate(id: string): Promise<Template | null> {
  const { data, error } = await db().from('templates').select(COLUNAS).eq('id', id).maybeSingle()

  if (error) {
    if (ehIdInvalido(error)) return null
    throw error
  }
  return data ? paraTemplate(data as Linha) : null
}

/**
 * Só os que podem enviar **agora**.
 *
 * O filtro é `aprovado` e nada mais. `pausado` engana por parecer temporário —
 * e é, a Meta despausa sozinha em 3h ou 6h — mas enquanto está pausado, envio
 * falha. Deixar pausado nesta lista faria a tela de nova transmissão oferecer
 * um modelo que erra em todos os 5.000 destinatários.
 */
export async function listarTemplatesAprovados(clienteId: string): Promise<Template[]> {
  const { data, error } = await db()
    .from('templates')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .eq('status', 'aprovado')
    .order('nome', { ascending: true })

  if (error) {
    if (ehIdInvalido(error)) return []
    throw error
  }
  return (data as Linha[]).map(paraTemplate)
}

export type NovoTemplate = {
  clienteId: string
  nome: string
  idioma: string
  categoria: Categoria
  componentes: Componentes
}

/**
 * Cria o rascunho, antes de a Meta saber que ele existe.
 *
 * Rascunho é estado **nosso**, e não da Meta: é o template que a pessoa está
 * escrevendo. Ele vira `pendente` quando `marcarSubmetido` grava o id dela.
 *
 * Os dois passos existem para que uma falha de rede no meio não perca o texto
 * que a pessoa escreveu. Criar direto na Meta e só então gravar significaria
 * que um timeout apaga o trabalho dela.
 */
export async function criarRascunho(novo: NovoTemplate): Promise<Template> {
  const { data, error } = await db()
    .from('templates')
    .insert({
      cliente_id: novo.clienteId,
      nome: novo.nome,
      idioma: novo.idioma,
      categoria: novo.categoria,
      componentes: novo.componentes,
      status: 'rascunho',
    })
    .select(COLUNAS)
    .single()

  if (error) throw error
  return paraTemplate(data as Linha)
}

/**
 * Grava o id que a Meta devolveu e o status inicial dela.
 *
 * `categoria` entra aqui porque **a Meta pode ter reclassificado**: ela muda
 * sozinha o que julga promocional, e a categoria determina o preço da mensagem.
 * Guardar o que pedimos em vez do que ela respondeu faria qualquer conta de
 * custo mentir.
 */
export async function marcarSubmetido(
  id: string,
  dados: { wabaTemplateId: string; status: StatusDoTemplate; categoria?: string | null },
): Promise<void> {
  const { error } = await db()
    .from('templates')
    .update({
      waba_template_id: dados.wabaTemplateId,
      status: dados.status,
      ...(dados.categoria ? { categoria: dados.categoria } : {}),
      // Submeter de novo depois de uma recusa: o motivo velho não pode ficar
      // na tela ao lado de "em análise".
      motivo_recusa: null,
    })
    .eq('id', id)

  if (error) throw error
}

/**
 * O que o webhook `message_template_status_update` sabe dizer.
 *
 * `motivoRecusa` é o campo mais valioso desta tabela: quando a Meta recusa por
 * `INVALID_FORMAT` ela manda explicação **e recomendação acionável** — a melhor
 * informação que ela dá em qualquer lugar da plataforma. É a diferença entre a
 * tela dizer "recusado" e dizer "recusado porque falta valor de exemplo na
 * variável 2".
 */
export type AtualizacaoDeStatus = {
  status: StatusDoTemplate
  motivoRecusa?: string | null
  qualidade?: string | null
  categoria?: string | null
}

/**
 * Atualiza pelo id da Meta — que é tudo o que o webhook traz.
 *
 * Devolve `false` quando não achou. Não é erro: o webhook chega para **todos**
 * os templates da WABA, inclusive os que o cliente criou direto no WhatsApp
 * Manager e que nunca passaram por aqui. Estourar nesse caso encheria o alerta
 * de ruído por um evento que é normal.
 */
export async function atualizarStatusPorWabaId(
  wabaTemplateId: string,
  dados: AtualizacaoDeStatus,
): Promise<boolean> {
  const { data, error } = await db()
    .from('templates')
    .update({
      status: dados.status,
      ...(dados.motivoRecusa !== undefined ? { motivo_recusa: dados.motivoRecusa } : {}),
      ...(dados.qualidade !== undefined ? { qualidade: dados.qualidade } : {}),
      ...(dados.categoria ? { categoria: dados.categoria } : {}),
    })
    .eq('waba_template_id', wabaTemplateId)
    .select('id')

  if (error) throw error
  return (data ?? []).length > 0
}

/**
 * Só a categoria, sem tocar no status.
 *
 * Existe porque `template_category_update` é um webhook **à parte**: ele avisa
 * que a Meta reclassificou o modelo — o que muda o **preço** da mensagem — e
 * não diz nada sobre a revisão. Reaproveitar `atualizarStatusPorWabaId` aqui
 * obrigaria a inventar um status, e um palpite faria um template aprovado
 * virar outra coisa por causa de uma mudança de preço.
 */
export async function atualizarCategoriaPorWabaId(
  wabaTemplateId: string,
  categoria: string,
): Promise<boolean> {
  const { data, error } = await db()
    .from('templates')
    .update({ categoria })
    .eq('waba_template_id', wabaTemplateId)
    .select('id')

  if (error) throw error
  return (data ?? []).length > 0
}

/**
 * Casa pelo par nome+idioma quando o id da Meta ainda não foi gravado.
 *
 * É o caminho da reconciliação: o template foi criado, o webhook que traria o
 * id se perdeu, e a listagem da Meta é a única fonte. Sem isto, um webhook
 * perdido deixaria o template `pendente` para sempre e a pessoa veria "em
 * análise" num modelo aprovado há dias.
 */
export async function casarPorNome(
  clienteId: string,
  nome: string,
  idioma: string,
  dados: AtualizacaoDeStatus & { wabaTemplateId?: string },
): Promise<boolean> {
  const { data, error } = await db()
    .from('templates')
    .update({
      status: dados.status,
      ...(dados.wabaTemplateId ? { waba_template_id: dados.wabaTemplateId } : {}),
      ...(dados.motivoRecusa !== undefined ? { motivo_recusa: dados.motivoRecusa } : {}),
      ...(dados.qualidade !== undefined ? { qualidade: dados.qualidade } : {}),
      ...(dados.categoria ? { categoria: dados.categoria } : {}),
    })
    .eq('cliente_id', clienteId)
    .eq('nome', nome)
    .eq('idioma', idioma)
    .select('id')

  if (error) {
    if (ehIdInvalido(error)) return false
    throw error
  }
  return (data ?? []).length > 0
}

/** Converte o status cru da Meta e grava. `desconhecido` não mexe em nada. */
export async function aplicarStatusCruDaMeta(
  wabaTemplateId: string,
  statusCru: string | undefined,
  resto: Omit<AtualizacaoDeStatus, 'status'> = {},
): Promise<boolean> {
  const status = statusDaMeta(statusCru)
  /*
   * Status que esta versão do código não conhece não pode virar um palpite:
   * gravar `aprovado` por engano seria transmissão saindo com modelo que não
   * passou. Não mexer deixa o valor anterior, que ao menos já foi verdade.
   */
  if (status === 'desconhecido') return false
  return atualizarStatusPorWabaId(wabaTemplateId, { status, ...resto })
}

export async function apagarTemplate(id: string): Promise<void> {
  const { error } = await db().from('templates').delete().eq('id', id)
  if (error) throw error
}
