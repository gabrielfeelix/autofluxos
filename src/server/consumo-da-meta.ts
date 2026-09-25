import 'server-only'
import { lerPontosDaMeta, type PontoDaMeta } from '@/core/franquia-da-meta'
import { db } from './db'
import { chaveDoMes } from './repos/plano'
import { lerTokenDoCanal, type CanalSalvo } from './repos/conversas'

/**
 * Copia o `pricing_analytics` de cada WABA para `consumo_da_meta` (0104).
 *
 * Roda na manutenção diária, sobre o mês corrente inteiro (e o anterior nos
 * dois primeiros dias, para fechar o último dia dele). Sobrescreve pela chave,
 * então rodar duas vezes dá o mesmo resultado.
 *
 * **Um WABA não derruba o outro.** Token vencido de um cliente vira linha no
 * log e no retorno, e os outros seguem.
 */

type Conta = { clienteId: string; wabaId: string; tokenRef: string | null }

export type ResultadoDaCopia = { contas: number; pontos: number; falhas: string[] }

const VERSAO = process.env.META_GRAPH_VERSION ?? 'v25.0'

async function contasComWaba(): Promise<Conta[]> {
  const { data, error } = await db()
    .from('channels')
    .select('client_id, waba_id, token_ref')
    .eq('provider', 'cloud-api')
    .not('waba_id', 'is', null)
  if (error) throw new Error(`não deu para listar as contas do WhatsApp: ${error.message}`)

  // Uma WABA pode ter mais de um número; a consulta é por WABA.
  const porWaba = new Map<string, Conta>()
  for (const linha of (data ?? []) as { client_id: string; waba_id: string; token_ref: string | null }[]) {
    const atual = porWaba.get(linha.waba_id)
    if (!atual || (!atual.tokenRef && linha.token_ref)) {
      porWaba.set(linha.waba_id, { clienteId: linha.client_id, wabaId: linha.waba_id, tokenRef: linha.token_ref })
    }
  }
  return [...porWaba.values()]
}

/** Os tokens a tentar, na ordem: o do cliente (onboarding), depois o da 4YU. */
async function tokensDa(conta: Conta): Promise<string[]> {
  const tokens: string[] = []
  if (conta.tokenRef) {
    const token = await lerTokenDoCanal({ tokenRef: conta.tokenRef } as CanalSalvo).catch(() => null)
    if (token) tokens.push(token)
  }
  if (process.env.WHATSAPP_TOKEN) tokens.push(process.env.WHATSAPP_TOKEN)
  return tokens
}

async function lerDaMeta(wabaId: string, token: string, inicio: number, fim: number): Promise<PontoDaMeta[]> {
  const campo =
    `pricing_analytics.start(${inicio}).end(${fim}).granularity(DAILY)` +
    `.dimensions(["PRICING_CATEGORY","PRICING_TYPE","PHONE"])`
  const url = `https://graph.facebook.com/${VERSAO}/${wabaId}?fields=${encodeURIComponent(campo)}`
  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  const corpo = (await resposta.json().catch(() => null)) as { error?: { message?: string } } | null
  if (!resposta.ok || corpo?.error) {
    throw new Error(corpo?.error?.message ?? `HTTP ${resposta.status}`)
  }
  return lerPontosDaMeta(corpo)
}

/** Meia-noite de São Paulo do primeiro dia do mês de `chave` (`YYYY-MM-01`), em segundos. */
function inicioDoMes(chave: string): number {
  return Math.floor(Date.parse(`${chave}T03:00:00Z`) / 1000)
}

export async function copiarConsumoDaMeta(agora = new Date()): Promise<ResultadoDaCopia> {
  // O mês de dois dias atrás: é o corrente, menos nos dois primeiros dias, em
  // que puxa desde o anterior para fechar o último dia dele.
  const desde = chaveDoMes(new Date(agora.getTime() - 2 * 86_400_000))
  const inicio = inicioDoMes(desde)
  const fim = Math.floor(agora.getTime() / 1000)

  const contas = await contasComWaba()
  const resultado: ResultadoDaCopia = { contas: contas.length, pontos: 0, falhas: [] }

  for (const conta of contas) {
    let pontos: PontoDaMeta[] | null = null
    let ultimoErro = 'sem token'
    for (const token of await tokensDa(conta)) {
      try {
        pontos = await lerDaMeta(conta.wabaId, token, inicio, fim)
        break
      } catch (erro) {
        ultimoErro = erro instanceof Error ? erro.message : String(erro)
      }
    }

    if (!pontos) {
      console.error(`[consumo-da-meta] WABA ${conta.wabaId}: ${ultimoErro}`)
      resultado.falhas.push(`${conta.wabaId}: ${ultimoErro}`)
      continue
    }
    if (pontos.length === 0) continue

    const { error } = await db()
      .from('consumo_da_meta')
      .upsert(
        pontos.map((p) => ({
          client_id: conta.clienteId,
          waba_id: conta.wabaId,
          telefone: p.telefone,
          dia: p.dia,
          categoria: p.categoria,
          tipo: p.tipo,
          volume: p.volume,
          custo: p.custo,
          atualizado_em: new Date().toISOString(),
        })),
        { onConflict: 'telefone,dia,categoria,tipo' },
      )
    if (error) {
      resultado.falhas.push(`${conta.wabaId}: ${error.message}`)
      continue
    }
    resultado.pontos += pontos.length
  }

  return resultado
}

type PontoDaConta = PontoDaMeta & { clienteId: string }

async function pontosDoMes(agora: Date, clienteId?: string): Promise<PontoDaConta[]> {
  const mes = chaveDoMes(agora)
  const proximo = new Date(`${mes}T12:00:00Z`)
  proximo.setUTCMonth(proximo.getUTCMonth() + 1)

  let consulta = db()
    .from('consumo_da_meta')
    .select('client_id, telefone, dia, categoria, tipo, volume, custo')
    .gte('dia', mes)
    .lt('dia', proximo.toISOString().slice(0, 10))
  if (clienteId) consulta = consulta.eq('client_id', clienteId)

  const { data, error } = await consulta
  if (error) {
    console.error('[consumo-da-meta] não deu para ler o consumo', error.message)
    return []
  }
  return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    clienteId: l.client_id as string,
    telefone: l.telefone as string,
    dia: l.dia as string,
    categoria: l.categoria as string,
    tipo: l.tipo as string,
    volume: Number(l.volume),
    custo: l.custo === null ? null : Number(l.custo),
  }))
}

/** Os pontos do mês de uma conta, para a tela. Degrada para vazio. */
export function consumoDaMetaDoMes(clienteId: string, agora = new Date()): Promise<PontoDaMeta[]> {
  return pontosDoMes(agora, clienteId)
}

/** Os pontos do mês de todas as contas, agrupados, para a administração. */
export async function consumoDaMetaDeTodas(agora = new Date()): Promise<Map<string, PontoDaMeta[]>> {
  const porConta = new Map<string, PontoDaMeta[]>()
  for (const ponto of await pontosDoMes(agora)) {
    const lista = porConta.get(ponto.clienteId) ?? []
    lista.push(ponto)
    porConta.set(ponto.clienteId, lista)
  }
  return porConta
}
