import 'server-only'
import { PLANO_DE_ENTRADA, type IdDoPlano } from '@/core/planos'
import type { UsoDaOrganizacao } from '@/core/troca-de-plano'
import { db, ehIdInvalido } from '../db'

/**
 * Em que plano a conta está, e quanto ela consumiu (a 0066).
 *
 * Repo próprio, e não colunas novas em `repos/clientes.ts`, pelo mesmo motivo
 * que `repos/distribuicao.ts` existe: `Cliente` é a ficha que a tela de cadastro
 * edita, e plano não se edita ali. O precedente está aberto desde a 0064.
 *
 * **Nada aqui nega nada.** Medir vem antes de cobrar, e medir sem travar vem
 * antes de travar: estas funções respondem "quanto foi usado", e nenhuma delas
 * responde "pode continuar?". Quem for escrever a trava, um mês depois de haver
 * número real, escreve noutro lugar e com o dono junto.
 */

export type ConsumoDoMes = {
  /** A chave do mês, `YYYY-MM-01`, no fuso de São Paulo. */
  mes: string
  /**
   * Contato único que trocou mensagem nos dois sentidos no mês.
   *
   * É a unidade da cobrança, e a definição mora na view `consumo_de_conversas`
   * (0066): disparo enviado e não respondido não conta.
   */
  conversas: number
  /** Arquivos recebidos no mês, e o que eles ocupam. */
  arquivos: number
  bytes: number
}

export const CONSUMO_VAZIO: Omit<ConsumoDoMes, 'mes'> = {
  conversas: 0,
  arquivos: 0,
  bytes: 0,
}

/*
 * O mesmo fuso e o mesmo formato de `repos/metricas.ts`, e de propósito: duas
 * réguas de mês para a mesma conta é como o painel passa a discordar da fatura.
 */
const FUSO = 'America/Sao_Paulo'

const formatadorDoMes = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
})

/** A chave do mês como a view a grava: `YYYY-MM-01`. */
export function chaveDoMes(data: Date): string {
  const partes = formatadorDoMes.formatToParts(data)
  const ano = partes.find((p) => p.type === 'year')?.value ?? '1970'
  const mes = partes.find((p) => p.type === 'month')?.value ?? '01'
  return `${ano}-${mes}-01`
}

/**
 * Em que plano esta conta está.
 *
 * Degrada para o plano de entrada em vez de estourar, no molde de
 * `ajustesDaConta`: uma falha de leitura aqui não pode impedir a tela de abrir,
 * e errar para o plano mais barato é o lado seguro de errar.
 */
export async function planoDaConta(clienteId: string): Promise<IdDoPlano> {
  const { data, error } = await db()
    .from('clients')
    .select('plano')
    .eq('id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return PLANO_DE_ENTRADA
  if (error) {
    console.error('[plano] não deu para ler o plano da conta', error.message)
    return PLANO_DE_ENTRADA
  }

  const plano = (data as { plano?: string } | null)?.plano
  if (plano === 'essencial' || plano === 'operacao' || plano === 'escala') return plano
  return PLANO_DE_ENTRADA
}

/**
 * Troca o plano da conta.
 *
 * Existe agora, e o gateway não. Enquanto ele não vem, quem chama isto é a 4YU
 * combinando com o cliente, nunca um clique do próprio cliente: a tela registra
 * a intenção e alguém daqui muda. Quando o gateway chegar, a mudança passa a ser
 * efeito do webhook dele, e este continua sendo o lugar onde ela acontece.
 */
export async function definirPlano(
  clienteId: string,
  plano: IdDoPlano,
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await db()
    .from('clients')
    .update({ plano, atualizado_em: new Date().toISOString() })
    .eq('id', clienteId)

  if (error) return { ok: false, erro: `não deu para trocar o plano: ${error.message}` }
  return { ok: true }
}

/**
 * Quanto esta conta consumiu no mês.
 *
 * Duas leituras e não um join: as views são de agregação e cada uma responde uma
 * pergunta. Mês sem linha nenhuma é mês sem consumo, não erro, e por isso o
 * ausente vira zero em vez de nulo.
 */
export async function consumoDaConta(
  clienteId: string,
  agora = new Date(),
): Promise<ConsumoDoMes> {
  const mes = chaveDoMes(agora)
  const vazio: ConsumoDoMes = { mes, ...CONSUMO_VAZIO }

  const [conversas, arquivos] = await Promise.all([
    db()
      .from('consumo_de_conversas')
      .select('conversas')
      .eq('client_id', clienteId)
      .eq('mes', mes)
      .maybeSingle(),
    db()
      .from('consumo_de_arquivos')
      .select('arquivos, bytes')
      .eq('client_id', clienteId)
      .eq('mes', mes)
      .maybeSingle(),
  ])

  if (ehIdInvalido(conversas.error) || ehIdInvalido(arquivos.error)) return vazio

  /*
   * Degrada para zero e avisa no log, em vez de estourar: esta leitura serve uma
   * tela de configuração, e uma tela que não abre é pior que um número ausente.
   */
  if (conversas.error) {
    console.error('[plano] não deu para ler as conversas do mês', conversas.error.message)
  }
  if (arquivos.error) {
    console.error('[plano] não deu para ler os arquivos do mês', arquivos.error.message)
  }

  const linhaDeConversas = conversas.data as { conversas?: number | string } | null
  const linhaDeArquivos = arquivos.data as {
    arquivos?: number | string
    bytes?: number | string
  } | null

  /*
   * `Number(...)` porque o PostgREST devolve `bigint` como string, e somar
   * string em JavaScript concatena em silêncio. É a mesma conversão que
   * `repos/metricas.ts` faz em toda leitura de view.
   */
  return {
    mes,
    conversas: Number(linhaDeConversas?.conversas ?? 0),
    arquivos: Number(linhaDeArquivos?.arquivos ?? 0),
    bytes: Number(linhaDeArquivos?.bytes ?? 0),
  }
}

/** O consumo de todas as contas no mês, para a tela de quem opera a 4YU. */
export type ConsumoDeUmaConta = ConsumoDoMes & {
  clienteId: string
  nome: string
  plano: IdDoPlano
}

export async function consumoDeTodasAsContas(
  agora = new Date(),
): Promise<ConsumoDeUmaConta[]> {
  const mes = chaveDoMes(agora)

  const [contas, conversas, arquivos] = await Promise.all([
    db().from('clients').select('id, nome, plano').order('nome', { ascending: true }),
    db().from('consumo_de_conversas').select('client_id, conversas').eq('mes', mes),
    db().from('consumo_de_arquivos').select('client_id, arquivos, bytes').eq('mes', mes),
  ])

  if (contas.error) {
    throw new Error(`não deu para listar as contas: ${contas.error.message}`)
  }

  const porConta = new Map<string, { conversas: number; arquivos: number; bytes: number }>()
  const garantir = (id: string) => {
    const atual = porConta.get(id) ?? { conversas: 0, arquivos: 0, bytes: 0 }
    porConta.set(id, atual)
    return atual
  }

  for (const linha of (conversas.data ?? []) as { client_id: string; conversas: number | string }[]) {
    garantir(linha.client_id).conversas = Number(linha.conversas ?? 0)
  }
  for (const linha of (arquivos.data ?? []) as {
    client_id: string
    arquivos: number | string
    bytes: number | string
  }[]) {
    const alvo = garantir(linha.client_id)
    alvo.arquivos = Number(linha.arquivos ?? 0)
    alvo.bytes = Number(linha.bytes ?? 0)
  }

  return ((contas.data ?? []) as { id: string; nome: string; plano: string | null }[]).map(
    (conta) => {
      const medido = porConta.get(conta.id) ?? CONSUMO_VAZIO
      const plano = conta.plano
      return {
        clienteId: conta.id,
        nome: conta.nome,
        plano:
          plano === 'essencial' || plano === 'operacao' || plano === 'escala'
            ? plano
            : PLANO_DE_ENTRADA,
        mes,
        conversas: medido.conversas,
        arquivos: medido.arquivos,
        bytes: medido.bytes,
      }
    },
  )
}

/**
 * O que a organização usa hoje de cada coisa que o plano limita, para o modal
 * de troca dizer o que sai antes de sair (`core/troca-de-plano.ts`).
 *
 * Contagem sem linha (`head`), uma consulta por sinal e todas juntas. Leitura
 * que falha vira zero: o modal perde um detalhe, e a troca continua passando
 * pela confirmação de quem pediu.
 */
export async function usoDaOrganizacao(clienteId: string, agora = new Date()): Promise<UsoDaOrganizacao> {
  const inicioDoMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString()
  const contar = async (consulta: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await consulta
    if (error) console.error('[plano] não deu para medir o uso:', error)
    return count ?? 0
  }
  const [consumo, numeros, fluxosComIa, transcricoes, transmissoes, conexoes, webhooks, cliente] = await Promise.all([
    consumoDaConta(clienteId, agora),
    contar(db().from('channels').select('id', { count: 'exact', head: true }).eq('client_id', clienteId).eq('status', 'ativo').neq('provider', 'instagram')),
    contar(db().from('flows').select('id', { count: 'exact', head: true }).eq('client_id', clienteId).eq('ativo', true).eq('ia_habilitada', true)),
    contar(
      db()
        .from('messages')
        .select('id, contacts!inner(client_id)', { count: 'exact', head: true })
        .eq('contacts.client_id', clienteId)
        .not('transcricao', 'is', null)
        .gte('ts', inicioDoMes),
    ),
    contar(db().from('transmissoes').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).in('estado', ['agendada', 'enviando'])),
    contar(db().from('connections').select('id', { count: 'exact', head: true }).eq('client_id', clienteId)),
    contar(db().from('webhooks_de_entrada').select('id', { count: 'exact', head: true }).eq('client_id', clienteId).eq('ativo', true)),
    db().from('clients').select('ia_chave_ref').eq('id', clienteId).maybeSingle(),
  ])
  return {
    conversas: consumo.conversas,
    numeros,
    fluxosComIa,
    transcricoes,
    transmissoes,
    conexoes,
    webhooks,
    chavePropria: Boolean((cliente.data as { ia_chave_ref: string | null } | null)?.ia_chave_ref),
  }
}
