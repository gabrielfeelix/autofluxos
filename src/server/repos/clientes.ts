import 'server-only'
import { lerHorario, type HorarioDeAtendimento } from '@/core/horario'
import { MINUTOS_DE_RETOMADA_PADRAO, type ConfigDaConta } from '@/core/retomada'
import { db, ehIdInvalido } from '../db'
import { apagarAcervoDoCliente } from './acervo'

export type Cliente = {
  id: string
  nome: string
  contextoNegocio: string
  /** Quem responde por este cliente. Ex.: "Daniel, dono do estúdio". */
  responsavel: string
  /** Telefone de quem responde, **não** é o número que o bot atende. */
  telefone: string
  email: string
  /** Só para emissão de nota. Guardado como foi digitado. */
  cnpj: string
  /** O que foi combinado e não cabe em campo. */
  observacoes: string
  /** Endereço público da logo. Vazio = a tela mostra as iniciais. */
  logoUrl: string
  /**
   * O expediente do atendimento humano.
   *
   * `null` = **atende sempre**, que é o que a coluna vazia quer dizer para toda
   * conta criada antes da 0022. Confundir isso com "nunca atende" faria o bot
   * anunciar que está fechado para clientes que nunca configuraram nada.
   */
  horarioAtendimento: HorarioDeAtendimento | null
  /**
   * A conversa parada em atendimento humano volta ao bot sozinha?
   *
   * Nasce desligada em toda conta, inclusive nas novas: o que ela muda
   * acontece em conversa viva, e ninguém deve descobrir esse comportamento
   * pelo cliente reclamando. Ver `core/retomada.ts`.
   */
  retomada: ConfigDaConta
}

/**
 * O cadastro que dá para editar de uma vez na tela do cliente.
 *
 * `contextoNegocio` fica de fora de propósito: ele tem tela própria porque é
 * o bloco de IA, não um campo de ficha.
 */
export type Cadastro = Pick<
  Cliente,
  'nome' | 'responsavel' | 'telefone' | 'email' | 'cnpj' | 'observacoes'
>

type Linha = {
  id: string
  nome: string
  contexto_negocio: string
  responsavel: string
  telefone: string
  email: string
  cnpj: string
  observacoes: string
  logo_url: string
  horario_atendimento: unknown
  retomar_bot_ativo: boolean | null
  retomar_bot_minutos: number | null
  retomar_bot_mensagem: string | null
}

/**
 * `ia_habilitada` saiu daqui.
 *
 * A migration 0005 moveu o plano de IA para o fluxo e deixou a coluna do
 * cliente para trás de propósito, dizendo que ela sumiria "quando alguém
 * confirmar que ninguém mais depende dela". Ninguém depende: nada no código
 * lia `cliente.iaHabilitada`. Parar de selecionar é essa confirmação; o `drop`
 * no banco é o passo seguinte, e separado, código que parou de usar volta
 * fácil, coluna apagada não.
 */
const COLUNAS =
  'id, nome, contexto_negocio, responsavel, telefone, email, cnpj, observacoes, logo_url, horario_atendimento, retomar_bot_ativo, retomar_bot_minutos, retomar_bot_mensagem'

function paraCliente(linha: Linha): Cliente {
  return {
    id: linha.id,
    nome: linha.nome,
    contextoNegocio: linha.contexto_negocio,
    responsavel: linha.responsavel,
    telefone: linha.telefone,
    email: linha.email,
    cnpj: linha.cnpj,
    observacoes: linha.observacoes,
    logoUrl: linha.logo_url,
    horarioAtendimento: lerHorario(linha.horario_atendimento),
    retomada: lerRetomada(linha),
  }
}

/**
 * As três colunas viram a configuração que `core/retomada.ts` entende.
 *
 * Tolera `null` nas três porque a linha pode ter sido lida por uma versão do
 * código anterior à 0090 e porque `select` de coluna que acabou de nascer é
 * exatamente onde um deploy pela metade aparece. Faltando qualquer uma, o
 * resultado é "desligada", que é o estado seguro: ninguém perde conversa por
 * causa de uma coluna que não veio.
 */
function lerRetomada(linha: {
  retomar_bot_ativo: boolean | null
  retomar_bot_minutos: number | null
  retomar_bot_mensagem: string | null
}): ConfigDaConta {
  return {
    ativo: linha.retomar_bot_ativo === true,
    minutos: linha.retomar_bot_minutos ?? MINUTOS_DE_RETOMADA_PADRAO,
    mensagem: linha.retomar_bot_mensagem,
  }
}

export async function listarClientes(): Promise<Cliente[]> {
  const { data, error } = await db()
    .from('clients')
    .select(COLUNAS)
    .order('criado_em', { ascending: true })

  if (error) throw new Error(`não deu para listar clientes: ${error.message}`)
  return (data as Linha[]).map(paraCliente)
}

export type ResumoDeAtendimento = {
  contatos: number
  esperandoPessoa: number
  /** `null` quando ninguém nunca escreveu, cliente novo, não cliente parado. */
  ultimaAtividade: Date | null
}

type LinhaDeResumo = {
  client_id: string
  contatos: number | string
  esperando_pessoa: number | string
  ultima_atividade: string | null
}

/**
 * Quem está esperando resposta, quantos contatos e o último movimento, de
 * todos os clientes, numa consulta.
 *
 * Uma consulta por cliente seria N+1 na primeira tela que abre, e a agregação
 * fica no Postgres pelo mesmo motivo da view `metricas_sessoes`: reduzir aqui
 * significaria trazer o histórico de todo mundo para contar linha. A view
 * `resumo_clientes` (migration 0016) faz o `group by` lá.
 *
 * Devolve mapa porque a tela itera clientes, não resumos, e não deve procurar.
 */
export async function resumirAtendimento(): Promise<Map<string, ResumoDeAtendimento>> {
  const { data, error } = await db()
    .from('resumo_clientes')
    .select('client_id, contatos, esperando_pessoa, ultima_atividade')

  if (error) throw new Error(`não deu para resumir o atendimento: ${error.message}`)

  const mapa = new Map<string, ResumoDeAtendimento>()
  for (const linha of data as LinhaDeResumo[]) {
    mapa.set(linha.client_id, {
      contatos: Number(linha.contatos),
      esperandoPessoa: Number(linha.esperando_pessoa),
      ultimaAtividade: linha.ultima_atividade ? new Date(linha.ultima_atividade) : null,
    })
  }
  return mapa
}

/**
 * O resumo de atendimento só destas contas: quem espera, quantos contatos e o
 * último movimento.
 *
 * É o que o seletor de conta e a tela `/contas` mostram: quem atende três
 * empresas precisa saber em qual tem gente esperando sem entrar em cada uma.
 * Mesma view do painel da 4YU, **sempre** filtrada, porque a view é de todos os
 * clientes.
 *
 * Falha vira mapa vazio. É informação de apoio, e derrubar a barra lateral por
 * causa dela seria trocar um número por uma tela quebrada.
 */
export async function resumoDasContas(
  ids: readonly string[],
): Promise<Map<string, ResumoDeAtendimento>> {
  const mapa = new Map<string, ResumoDeAtendimento>()
  if (ids.length === 0) return mapa

  const { data, error } = await db()
    .from('resumo_clientes')
    .select('client_id, contatos, esperando_pessoa, ultima_atividade')
    .in('client_id', ids)

  if (error) {
    console.error('[clientes] não deu para resumir as contas:', error.message)
    return mapa
  }
  for (const linha of data as LinhaDeResumo[]) {
    mapa.set(linha.client_id, {
      contatos: Number(linha.contatos),
      esperandoPessoa: Number(linha.esperando_pessoa),
      ultimaAtividade: linha.ultima_atividade ? new Date(linha.ultima_atividade) : null,
    })
  }
  return mapa
}

export async function acharCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await db().from('clients').select(COLUNAS).eq('id', id).maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar o cliente: ${error.message}`)
  return data ? paraCliente(data as Linha) : null
}

export async function criarCliente(nome: string): Promise<Cliente> {
  const { data, error } = await db()
    .from('clients')
    .insert({ nome: nome.trim() })
    .select(COLUNAS)
    .single()

  if (error) throw new Error(`não deu para criar o cliente: ${error.message}`)
  return paraCliente(data as Linha)
}

/**
 * O que a IA pode dizer sobre este negócio.
 *
 * É a única fonte de verdade do nó de IA: o prompt manda responder `não sei`
 * para tudo que não estiver aqui (ver `ia/prompt.ts`). Sem isto preenchido, o
 * bloco de IA existe, chama o modelo, e responde `não sei` sempre, passando a
 * conversa para uma pessoa toda vez. Falha fechado, e por isso ninguém percebe
 * que está quebrado.
 */
/**
 * Grava a ficha do cliente.
 *
 * O nome é o único obrigatório, cliente cadastrado no meio de uma reunião tem
 * só isso, e exigir telefone para salvar o nome faria a pessoa inventar um.
 */
export async function atualizarCadastro(id: string, cadastro: Cadastro): Promise<void> {
  const { error } = await db()
    .from('clients')
    .update({
      nome: cadastro.nome.trim(),
      responsavel: cadastro.responsavel.trim(),
      telefone: cadastro.telefone.trim(),
      email: cadastro.email.trim(),
      cnpj: cadastro.cnpj.trim(),
      observacoes: cadastro.observacoes.trim(),
    })
    .eq('id', id)

  if (error) throw new Error(`não deu para salvar o cadastro: ${error.message}`)
}

export async function atualizarContexto(id: string, contexto: string): Promise<void> {
  const { error } = await db()
    .from('clients')
    .update({ contexto_negocio: contexto })
    .eq('id', id)

  if (error) throw new Error(`não deu para salvar o contexto: ${error.message}`)
}

/** Aponta o cliente para a logo recém-guardada. Vazio volta para as iniciais. */
export async function atualizarLogo(id: string, url: string): Promise<void> {
  const { error } = await db().from('clients').update({ logo_url: url }).eq('id', id)
  if (error) throw new Error(`não deu para guardar a logo: ${error.message}`)
}

/** O tamanho do estrago, para a tela conseguir dizer o que vai sumir. */
export type EstragoDaExclusao = {
  leads: number
  fluxos: number
  conexoes: number
  numeros: number
  /** Canais ainda conectados (WhatsApp, Instagram): bloqueiam a exclusão (A10). */
  conectados: number
}

/**
 * Quantas coisas a exclusão levaria junto.
 *
 * A confirmação precisa mostrar número, não categoria: "apaga os leads" é
 * abstrato, e "apaga 428 leads" é a frase que faz alguém parar e reler.
 */
export async function contarOQueSomeCom(id: string): Promise<EstragoDaExclusao> {
  const contar = async (tabela: string) => {
    const { count, error } = await db()
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('client_id', id)

    if (ehIdInvalido(error)) return 0
    if (error) throw new Error(`não deu para contar ${tabela}: ${error.message}`)
    return count ?? 0
  }

  const conectados = async () => {
    const { count, error } = await db().from('channels').select('id', { count: 'exact', head: true }).eq('client_id', id).eq('status', 'ativo')
    if (ehIdInvalido(error)) return 0
    if (error) throw new Error(`não deu para contar os canais conectados: ${error.message}`)
    return count ?? 0
  }

  const [leads, fluxos, conexoes, numeros, ativos] = await Promise.all([
    contar('contacts'),
    contar('flows'),
    contar('connections'),
    contar('channels'),
    conectados(),
  ])

  return { leads, fluxos, conexoes, numeros, conectados: ativos }
}

/**
 * Apaga o cliente e tudo que é dele.
 *
 * **Não existe recusa aqui, e é de propósito.** `apagarFluxo` recusa apagar
 * automação no ar porque a pessoa provavelmente não percebeu o efeito; aqui o
 * efeito é o pedido. Quem digita o nome do cliente para confirmar está
 * dizendo exatamente isto: some com o cliente, com os leads, com as conversas e
 * com as credenciais.
 *
 * A logo e o acervo saem do bucket junto. O `on delete cascade` não alcança o
 * Storage, ele está fora dos schemas de domínio (ver BANCO-COMPARTILHADO), e
 * arquivo de cliente que não existe mais é dado pessoal órfão num bucket
 * público.
 */
export async function apagarCliente(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from('clients')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar o cliente: ${error.message}`)
  if (!data) return false

  // Depois do banco, e sem derrubar a exclusão se falhar: a linha já foi. Ficar
  // com um arquivo órfão é ruim; recusar a exclusão porque o bucket piscou
  // deixaria o cliente meio apagado, que é pior.
  await db()
    .storage.from('logos')
    .remove(['png', 'jpg', 'webp'].map((extensao) => `${id}.${extensao}`))
  await apagarAcervoDoCliente(id)

  return true
}

/**
 * Só o expediente, sem carregar o cadastro inteiro.
 *
 * O webhook chama isto **em toda mensagem** que pode virar handoff, e não
 * precisa de contexto de negócio, CNPJ nem logo para decidir o que dizer às 3h
 * da manhã. A consulta vai junto das outras num `Promise.all`, então não custa
 * viagem a mais no relógio.
 */
export async function horarioDoCliente(
  clienteId: string,
): Promise<HorarioDeAtendimento | null> {
  const { data, error } = await db()
    .from('clients')
    .select('horario_atendimento')
    .eq('id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) {
    // Falhar aqui não pode derrubar a mensagem de alguém. Sem horário, o
    // atendimento é tratado como aberto, que é como o produto sempre agiu.
    console.error('[clientes] não deu para ler o horário de atendimento', error.message)
    return null
  }
  return lerHorario((data as { horario_atendimento: unknown } | null)?.horario_atendimento)
}

/**
 * Só a configuração de retomada, sem carregar o cadastro inteiro.
 *
 * O varredor chama isto por conta a cada passada, e não precisa de contexto de
 * negócio nem de logo para saber se o recurso está ligado. Mesma postura de
 * `horarioDoCliente`, logo acima.
 */
export async function retomadaDoCliente(clienteId: string): Promise<ConfigDaConta | null> {
  const { data, error } = await db()
    .from('clients')
    .select('retomar_bot_ativo, retomar_bot_minutos, retomar_bot_mensagem')
    .eq('id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) {
    // Falhar a leitura não pode encerrar atendimento de ninguém. Sem resposta,
    // o varredor trata como desligada e a conversa fica como está.
    console.error('[clientes] não deu para ler a retomada do bot', error.message)
    return null
  }
  if (!data) return null
  return lerRetomada(data as Parameters<typeof lerRetomada>[0])
}

/** Grava o interruptor, o prazo e o texto. */
export async function atualizarRetomada(id: string, config: ConfigDaConta): Promise<void> {
  const { error } = await db()
    .from('clients')
    .update({
      retomar_bot_ativo: config.ativo,
      retomar_bot_minutos: config.minutos,
      // Texto vazio vira `null` para a leitura cair no padrão em vez de mandar
      // uma mensagem em branco para o WhatsApp de alguém.
      retomar_bot_mensagem: (config.mensagem ?? '').trim() || null,
    })
    .eq('id', id)

  if (error) throw new Error(`não deu para salvar a retomada do bot: ${error.message}`)
}

/** Grava o expediente. `null` volta a "atende sempre". */
export async function atualizarHorario(
  id: string,
  horario: HorarioDeAtendimento | null,
): Promise<void> {
  const { error } = await db()
    .from('clients')
    .update({ horario_atendimento: horario })
    .eq('id', id)

  if (error) throw new Error(`não deu para salvar o horário: ${error.message}`)
}
