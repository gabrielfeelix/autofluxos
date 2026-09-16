import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * As transmissões e quem recebeu cada uma (0059).
 *
 * Uma transmissão é: um template, um público, um horário. O que ela **não** é:
 * uma fila de mensagens soltas. O público mora em `transmissao_destinatarios`
 * para que a tela diga "3 de 400 entregues" sem contar linha de log.
 *
 * ---------------------------------------------------------------------------
 * `retida` é estado de primeira classe, e essa é a razão desta tabela
 * ---------------------------------------------------------------------------
 *
 * A Meta responde 200 ao envio e manda `message_status` junto. Se ele disser
 * `held_for_quality_assessment`, ela **segurou** a mensagem para avaliar, e se
 * o veredito for ruim, o template é pausado e cada mensagem retida é
 * descartada, chegando depois como `failed` com código 132015.
 *
 * Quem grava "enviado" ao ver o 200 mostra "campanha enviada" e nada saiu.
 */

export const ESTADOS_DA_TRANSMISSAO = [
  'rascunho',
  'agendada',
  'enviando',
  'concluida',
  'cancelada',
  'falhou',
] as const
export type EstadoDaTransmissao = (typeof ESTADOS_DA_TRANSMISSAO)[number]

export const ESTADOS_DO_DESTINATARIO = [
  'na_fila',
  'aceita',
  'retida',
  'entregue',
  'lida',
  'falhou',
] as const
export type EstadoDoDestinatario = (typeof ESTADOS_DO_DESTINATARIO)[number]

export type Transmissao = {
  id: string
  clienteId: string
  nome: string
  templateId: string
  parametros: Record<string, string>
  quando: string | null
  estado: EstadoDaTransmissao
  criadaPor: string | null
  criadaPorNome: string | null
  criadaEm: string
  comecouEm: string | null
  terminouEm: string | null
  erro: string | null
}

type Linha = {
  id: string
  cliente_id: string
  nome: string
  template_id: string
  parametros: unknown
  quando: string | null
  estado: string
  criada_por: string | null
  criada_por_nome: string | null
  criada_em: string
  comecou_em: string | null
  terminou_em: string | null
  erro: string | null
}

const COLUNAS =
  'id, cliente_id, nome, template_id, parametros, quando, estado, criada_por, criada_por_nome, criada_em, comecou_em, terminou_em, erro'

function paraTransmissao(linha: Linha): Transmissao {
  return {
    id: linha.id,
    clienteId: linha.cliente_id,
    nome: linha.nome,
    templateId: linha.template_id,
    parametros:
      linha.parametros && typeof linha.parametros === 'object' && !Array.isArray(linha.parametros)
        ? (linha.parametros as Record<string, string>)
        : {},
    quando: linha.quando,
    estado: linha.estado as EstadoDaTransmissao,
    criadaPor: linha.criada_por,
    criadaPorNome: linha.criada_por_nome,
    criadaEm: linha.criada_em,
    comecouEm: linha.comecou_em,
    terminouEm: linha.terminou_em,
    erro: linha.erro,
  }
}

export async function listarTransmissoes(clienteId: string): Promise<Transmissao[]> {
  const { data, error } = await db()
    .from('transmissoes')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .order('criada_em', { ascending: false })

  if (error) {
    if (ehIdInvalido(error)) return []
    throw error
  }
  return (data as Linha[]).map(paraTransmissao)
}

export async function lerTransmissao(id: string): Promise<Transmissao | null> {
  const { data, error } = await db()
    .from('transmissoes')
    .select(COLUNAS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (ehIdInvalido(error)) return null
    throw error
  }
  return data ? paraTransmissao(data as Linha) : null
}

export type NovaTransmissao = {
  clienteId: string
  nome: string
  templateId: string
  parametros?: Record<string, string>
  quando?: string | null
  criadaPor?: string | null
  criadaPorNome?: string | null
}

export async function criarTransmissao(nova: NovaTransmissao): Promise<Transmissao> {
  const { data, error } = await db()
    .from('transmissoes')
    .insert({
      cliente_id: nova.clienteId,
      nome: nova.nome,
      template_id: nova.templateId,
      parametros: nova.parametros ?? {},
      quando: nova.quando ?? null,
      estado: 'rascunho',
      criada_por: nova.criadaPor ?? null,
      criada_por_nome: nova.criadaPorNome ?? null,
    })
    .select(COLUNAS)
    .single()

  if (error) throw error
  return paraTransmissao(data as Linha)
}

/**
 * Põe o público na fila.
 *
 * `upsert` com `ignoreDuplicates` por causa do `unique (transmissao_id,
 * contato_id)`: montar o público duas vezes, clicar duas vezes, ou um retry,
 * não pode fazer ninguém receber a mesma transmissão duplicada.
 *
 * Em lotes porque o público é grande: 5.000 contatos num único insert estoura o
 * tamanho de requisição do PostgREST, e o erro que volta não diz isso.
 */
export async function enfileirarDestinatarios(
  transmissaoId: string,
  contatoIds: string[],
  tamanhoDoLote = 500,
): Promise<number> {
  let gravados = 0

  for (let i = 0; i < contatoIds.length; i += tamanhoDoLote) {
    const lote = contatoIds.slice(i, i + tamanhoDoLote)
    const { data, error } = await db()
      .from('transmissao_destinatarios')
      .upsert(
        lote.map((contatoId) => ({
          transmissao_id: transmissaoId,
          contato_id: contatoId,
          estado: 'na_fila',
        })),
        { onConflict: 'transmissao_id,contato_id', ignoreDuplicates: true },
      )
      .select('id')

    if (error) throw error
    gravados += (data ?? []).length
  }

  return gravados
}

export type Destinatario = {
  id: string
  transmissaoId: string
  contatoId: string
  waId: string
  nome: string | null
  estado: EstadoDoDestinatario
  wamid: string | null
  codigoErro: number | null
  erro: string | null
}

type LinhaDoDestinatario = {
  id: string
  transmissao_id: string
  contato_id: string
  estado: string
  wamid: string | null
  codigo_erro: number | null
  erro: string | null
  contacts: { wa_id: string; nome: string | null } | null
}

/**
 * Os próximos da fila, com o telefone já junto.
 *
 * O join com `contacts` evita N+1: sem ele, uma transmissão de 5.000 faria
 * 5.000 leituras só para descobrir números que o mesmo `select` traz de uma vez.
 *
 * Contato apagado no meio da transmissão sai da lista em vez de virar envio
 * para `undefined`, `on delete cascade` costuma limpar a linha, mas a leitura
 * não pode depender de uma corrida com o delete.
 */
export async function proximosDaFila(
  transmissaoId: string,
  quantos: number,
): Promise<Destinatario[]> {
  const { data, error } = await db()
    .from('transmissao_destinatarios')
    .select('id, transmissao_id, contato_id, estado, wamid, codigo_erro, erro, contacts (wa_id, nome)')
    .eq('transmissao_id', transmissaoId)
    .eq('estado', 'na_fila')
    .limit(quantos)

  if (error) {
    if (ehIdInvalido(error)) return []
    throw error
  }

  return (data as unknown as LinhaDoDestinatario[]).flatMap((linha) => {
    const waId = linha.contacts?.wa_id
    if (!waId) return []
    return [
      {
        id: linha.id,
        transmissaoId: linha.transmissao_id,
        contatoId: linha.contato_id,
        waId,
        nome: linha.contacts?.nome ?? null,
        estado: linha.estado as EstadoDoDestinatario,
        wamid: linha.wamid,
        codigoErro: linha.codigo_erro,
        erro: linha.erro,
      },
    ]
  })
}

/**
 * Grava o que aconteceu com um destinatário.
 *
 * `enviada_em` só entra quando saiu de fato, `retida` conta como saída (o
 * pedido foi feito), `falhou` não.
 */
export async function marcarDestinatario(
  id: string,
  dados: {
    estado: EstadoDoDestinatario
    wamid?: string | null
    codigoErro?: number | null
    erro?: string | null
  },
): Promise<void> {
  const saiu = dados.estado === 'aceita' || dados.estado === 'retida'

  const { error } = await db()
    .from('transmissao_destinatarios')
    .update({
      estado: dados.estado,
      ...(dados.wamid !== undefined ? { wamid: dados.wamid } : {}),
      ...(dados.codigoErro !== undefined ? { codigo_erro: dados.codigoErro } : {}),
      ...(dados.erro !== undefined ? { erro: dados.erro } : {}),
      ...(saiu ? { enviada_em: new Date().toISOString() } : {}),
      atualizada_em: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
}

/**
 * A ordem em que os estados de entrega andam.
 *
 * Existe porque **os webhooks da Meta chegam fora de ordem**. `read` antes de
 * `delivered` é comum, e quem grava o último que chegou faz uma mensagem lida
 * voltar para "entregue" na tela, diante do usuário.
 *
 * `falhou` é maior que tudo de propósito: uma falha que chega depois de um
 * "entregue" é a Meta corrigindo a si mesma, tipicamente a mensagem retida que
 * foi descartada (132015), e essa correção tem que vencer.
 */
const AVANCO: Record<EstadoDoDestinatario, number> = {
  na_fila: 0,
  aceita: 1,
  retida: 1,
  entregue: 2,
  lida: 3,
  falhou: 4,
}

export function avanca(atual: EstadoDoDestinatario, novo: EstadoDoDestinatario): boolean {
  return AVANCO[novo] > AVANCO[atual]
}

/**
 * Aplica o webhook de status pelo `wamid`, que é tudo o que ele traz.
 *
 * Devolve `false` quando não achou, e **isso é o caso comum**: o webhook de
 * status chega para toda mensagem que o número manda, inclusive as respostas de
 * atendimento que não são transmissão nenhuma. Estourar aqui encheria o alerta
 * de ruído por um evento normal.
 */
export async function aplicarStatusPorWamid(
  wamid: string,
  dados: {
    estado: EstadoDoDestinatario
    codigoErro?: number | null
    erro?: string | null
  },
): Promise<boolean> {
  const { data, error } = await db()
    .from('transmissao_destinatarios')
    .select('id, estado')
    .eq('wamid', wamid)
    .maybeSingle()

  if (error) {
    if (ehIdInvalido(error)) return false
    throw error
  }
  if (!data) return false

  const atual = (data as { estado: string }).estado as EstadoDoDestinatario
  // Webhook fora de ordem não pode fazer "lida" voltar para "entregue".
  if (!avanca(atual, dados.estado)) return false

  await marcarDestinatario((data as { id: string }).id, dados)
  return true
}

export type Progresso = Record<EstadoDoDestinatario, number> & { total: number }

/**
 * Quantos estão em cada estado, o que a tela de progresso mostra.
 *
 * Conta no banco e não em memória: carregar 5.000 linhas para fazer `length`
 * seria trazer a tabela inteira para dizer um número.
 */
export async function progressoDa(transmissaoId: string): Promise<Progresso> {
  const zerado = {
    na_fila: 0,
    aceita: 0,
    retida: 0,
    entregue: 0,
    lida: 0,
    falhou: 0,
    total: 0,
  } as Progresso

  const { data, error } = await db()
    .from('transmissao_destinatarios')
    .select('estado')
    .eq('transmissao_id', transmissaoId)

  if (error) {
    if (ehIdInvalido(error)) return zerado
    throw error
  }

  for (const linha of (data ?? []) as { estado: string }[]) {
    const estado = linha.estado as EstadoDoDestinatario
    if (estado in zerado) zerado[estado] += 1
    zerado.total += 1
  }

  return zerado
}

export async function mudarEstadoDaTransmissao(
  id: string,
  estado: EstadoDaTransmissao,
  extras: { erro?: string | null } = {},
): Promise<void> {
  const agora = new Date().toISOString()

  const { error } = await db()
    .from('transmissoes')
    .update({
      estado,
      ...(estado === 'enviando' ? { comecou_em: agora } : {}),
      ...(estado === 'concluida' || estado === 'falhou' || estado === 'cancelada'
        ? { terminou_em: agora }
        : {}),
      ...(extras.erro !== undefined ? { erro: extras.erro } : {}),
    })
    .eq('id', id)

  if (error) throw error
}

/**
 * As transmissões que o motor deve pegar agora.
 *
 * **São duas coisas, e a segunda é a que não pode faltar:** as `agendada` cuja
 * hora chegou, e as que ficaram em `enviando`.
 *
 * Uma transmissão em `enviando` é uma que já começou e **não terminou**, o
 * motor devolve a cada `POR_PASSADA` de propósito, porque a função da Vercel
 * morre no `maxDuration`. Entre uma passada e a seguinte cabe um deploy, e
 * quem só olhasse `agendada` deixaria uma campanha de 5.000 parada na mensagem
 * 200 para sempre, com a tela dizendo "Enviando" e nada saindo.
 *
 * As `enviando` vêm primeiro: terminar o que já começou vale mais que começar
 * o próximo, porque o público da que está no meio já recebeu parte.
 */
export async function transmissoesVencidas(agora = new Date()): Promise<Transmissao[]> {
  const { data, error } = await db()
    .from('transmissoes')
    .select(COLUNAS)
    /*
     * **`quando` nulo quer dizer "manda agora"**, e é o caso mais comum: quem
     * cria a transmissão sem escolher horário não quer que ela espere. Como
     * `quando.lte.<agora>` é **falso** sobre nulo no Postgres, nulo não é
     * menor nem maior que nada, sem o `quando.is.null` ao lado essa
     * transmissão ficaria `agendada` para sempre, que é exatamente o sintoma
     * que este gancho existe para não ter.
     */
    .or(
      `estado.eq.enviando,and(estado.eq.agendada,or(quando.is.null,quando.lte.${agora.toISOString()}))`,
    )
    .order('estado', { ascending: false })
    .order('quando', { ascending: true })

  if (error) throw error
  return (data as Linha[]).map(paraTransmissao)
}
