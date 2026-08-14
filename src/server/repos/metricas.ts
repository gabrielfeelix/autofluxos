import 'server-only'
import { db, ehIdInvalido } from '../db'

export type MedidasDoMes = {
  conversas: number
  resolvidasPeloBot: number
  esperandoPessoa: number
}

export type FunilMensal = {
  atual: MedidasDoMes
  anterior: MedidasDoMes
}

type Linha = {
  flow_id: string
  mes: string
  status: string
  total: number | string
}

type LinhaDeExecucoes = Pick<Linha, 'flow_id' | 'total'>

const FUSO_DAS_METRICAS = 'America/Sao_Paulo'
const formatadorDoMes = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_DAS_METRICAS,
  year: 'numeric',
  month: '2-digit',
})

const vazio = (): MedidasDoMes => ({
  conversas: 0,
  resolvidasPeloBot: 0,
  esperandoPessoa: 0,
})

export async function medirFunil(clienteId: string, agora = new Date()): Promise<FunilMensal> {
  const mesAtual = chaveDoMes(agora)
  const mesAnterior = chaveDoMesAnterior(mesAtual)
  const { data, error } = await db()
    .from('metricas_sessoes')
    .select('flow_id, mes, status, total')
    .eq('client_id', clienteId)
    .in('mes', [mesAtual, mesAnterior])

  if (ehIdInvalido(error)) return { atual: vazio(), anterior: vazio() }
  if (error) throw new Error(`não deu para medir o funil: ${error.message}`)

  const funil = { atual: vazio(), anterior: vazio() }
  for (const linha of data as Linha[]) {
    const medidas = linha.mes === mesAtual ? funil.atual : funil.anterior
    acumular(medidas, linha.status, Number(linha.total))
  }
  return funil
}

export async function contarExecucoesPorFluxo(clienteId: string): Promise<Map<string, number>> {
  const { data, error } = await db()
    .from('metricas_sessoes')
    .select('flow_id, total')
    .eq('client_id', clienteId)

  if (ehIdInvalido(error)) return new Map()
  if (error) throw new Error(`não deu para contar as execuções: ${error.message}`)

  const execucoes = new Map<string, number>()
  for (const linha of data as LinhaDeExecucoes[]) {
    execucoes.set(linha.flow_id, (execucoes.get(linha.flow_id) ?? 0) + Number(linha.total))
  }
  return execucoes
}

function chaveDoMes(data: Date): string {
  const partes = formatadorDoMes.formatToParts(data)
  const ano = partes.find((parte) => parte.type === 'year')?.value
  const mes = partes.find((parte) => parte.type === 'month')?.value
  if (!ano || !mes) throw new Error('não deu para descobrir o mês das métricas')
  return `${ano}-${mes}-01`
}

function chaveDoMesAnterior(chave: string): string {
  const correspondencia = /^(\d{4})-(\d{2})-01$/.exec(chave)
  if (!correspondencia) throw new Error('a chave do mês está inválida')

  const ano = Number(correspondencia[1])
  const mes = Number(correspondencia[2])
  return mes === 1 ? `${ano - 1}-12-01` : `${ano}-${String(mes - 1).padStart(2, '0')}-01`
}

function acumular(medidas: MedidasDoMes, status: string, total: number): void {
  medidas.conversas += total
  if (status === 'encerrada') medidas.resolvidasPeloBot += total
  if (status === 'humano') medidas.esperandoPessoa += total
}
