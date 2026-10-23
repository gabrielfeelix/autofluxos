import 'server-only'
import type { EstadoDaFatura, FaturaLida } from '@/channels/asaas-da-4yu'
import type { CicloDeCobranca } from '@/core/planos'
import { db } from '../db'

/**
 * A mensalidade que a 4YU cobra da conta (0147): a assinatura em `clients` e
 * as faturas em `faturas_da_conta`.
 *
 * Repo próprio, e não `repos/assinaturas.ts`: aquele é a mensalidade que o
 * cliente cobra do aluno dele (0145). Os nomes parecem e as contas Asaas são
 * outras.
 */

export type AssinaturaDaConta = {
  clienteAsaas: string | null
  assinaturaRef: string | null
  estado: string | null
  plano: string | null
  ciclo: CicloDeCobranca | null
}

export async function assinaturaDaConta(clienteId: string): Promise<AssinaturaDaConta | null> {
  const { data, error } = await db()
    .from('clients')
    .select('assinatura_cliente_ref, assinatura_ref, assinatura_estado, assinatura_plano, assinatura_ciclo')
    .eq('id', clienteId)
    .maybeSingle()
  if (error) throw new Error(`não foi possível ler a assinatura: ${error.message}`)
  if (!data) return null
  const linha = data as Record<string, string | null>
  return {
    clienteAsaas: linha.assinatura_cliente_ref ?? null,
    assinaturaRef: linha.assinatura_ref ?? null,
    estado: linha.assinatura_estado ?? null,
    plano: linha.assinatura_plano ?? null,
    ciclo: (linha.assinatura_ciclo as CicloDeCobranca | null) ?? null,
  }
}

export async function gravarAssinatura(clienteId: string, campos: Partial<AssinaturaDaConta>): Promise<void> {
  const linha: Record<string, string | null> = {}
  if (campos.clienteAsaas !== undefined) linha.assinatura_cliente_ref = campos.clienteAsaas
  if (campos.assinaturaRef !== undefined) linha.assinatura_ref = campos.assinaturaRef
  if (campos.estado !== undefined) linha.assinatura_estado = campos.estado
  if (campos.plano !== undefined) linha.assinatura_plano = campos.plano
  if (campos.ciclo !== undefined) linha.assinatura_ciclo = campos.ciclo
  if (Object.keys(linha).length === 0) return
  const { error } = await db().from('clients').update(linha).eq('id', clienteId)
  if (error) throw new Error(`não foi possível gravar a assinatura: ${error.message}`)
}

/**
 * De quem é esta fatura. Pela assinatura primeiro, que é o caso de todo mês;
 * pelo cliente do Asaas depois, que cobre a cobrança avulsa do excedente.
 * Nunca pelo `externalReference` sozinho: ele é texto, e o painel do Asaas
 * deixa qualquer um editar.
 */
export async function contaDaFatura(fatura: Pick<FaturaLida, 'assinaturaRef' | 'clienteAsaas'>): Promise<string | null> {
  const coluna = fatura.assinaturaRef ? 'assinatura_ref' : 'assinatura_cliente_ref'
  const valor = fatura.assinaturaRef ?? fatura.clienteAsaas
  if (!valor) return null
  const { data, error } = await db().from('clients').select('id').eq(coluna, valor).limit(1).maybeSingle()
  if (error) throw new Error(`não foi possível achar a conta da fatura: ${error.message}`)
  return (data as { id: string } | null)?.id ?? null
}

/** Grava o que o Asaas diz da fatura. O aviso repete: é upsert pelo id de lá. */
export async function gravarFatura(clienteId: string, fatura: FaturaLida): Promise<void> {
  const { error } = await db()
    .from('faturas_da_conta')
    .upsert(
      {
        cliente_id: clienteId,
        asaas_id: fatura.asaasId,
        assinatura_ref: fatura.assinaturaRef,
        tipo: fatura.assinaturaRef ? 'mensalidade' : 'excedente',
        valor_centavos: fatura.valorCentavos,
        vencimento: fatura.vencimento,
        estado: fatura.estado,
        link: fatura.link,
        paga_em: fatura.pagaEm?.toISOString() ?? null,
      },
      { onConflict: 'asaas_id' },
    )
  if (error) throw new Error(`não foi possível gravar a fatura: ${error.message}`)
}

export type FaturaDaConta = {
  id: string
  tipo: 'mensalidade' | 'excedente'
  valorCentavos: number
  vencimento: string
  estado: EstadoDaFatura
  link: string | null
  notaFiscalUrl: string | null
  pagaEm: string | null
}

/** A fatura vencida mais antiga, ou `null`. Erro de leitura é "nenhuma": a faixa não pode derrubar o painel. */
export async function faturaVencida(clienteId: string): Promise<FaturaDaConta | null> {
  const { data, error } = await db()
    .from('faturas_da_conta')
    .select('id, tipo, valor_centavos, vencimento, estado, link, nota_fiscal_url, paga_em')
    .eq('cliente_id', clienteId)
    .eq('estado', 'vencida')
    .order('vencimento', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return paraFatura(data)
}

function paraFatura(linha: Record<string, unknown>): FaturaDaConta {
  return {
    id: linha.id as string,
    tipo: linha.tipo as FaturaDaConta['tipo'],
    valorCentavos: linha.valor_centavos as number,
    vencimento: linha.vencimento as string,
    estado: linha.estado as EstadoDaFatura,
    link: (linha.link as string | null) ?? null,
    notaFiscalUrl: (linha.nota_fiscal_url as string | null) ?? null,
    pagaEm: (linha.paga_em as string | null) ?? null,
  }
}

export async function faturasDaConta(clienteId: string, limite = 24): Promise<FaturaDaConta[]> {
  const { data, error } = await db()
    .from('faturas_da_conta')
    .select('id, tipo, valor_centavos, vencimento, estado, link, nota_fiscal_url, paga_em')
    .eq('cliente_id', clienteId)
    .order('vencimento', { ascending: false })
    .limit(limite)
  if (error) {
    // Antes da 0147, a tela abre sem faturas em vez de quebrar.
    if (error.code !== '42P01') console.error('[faturas] não foi possível listar', error.message)
    return []
  }
  return (data ?? []).map(paraFatura)
}
