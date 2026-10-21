import 'server-only'
import { apagarDoCofre, guardarNoCofre, lerDoCofre } from '../cofre'
import { db, ehIdInvalido } from '../db'

/**
 * A conta do dono no gateway de pagamento (0141, `conexoes_de_pagamento`).
 *
 * O token mora no cofre e **nunca sai deste arquivo para a tela**: quem lê
 * `ConexaoDePagamento` vê de quem é a conta e quando vence, e só o servidor,
 * na hora de cobrar, pede o token com `tokenDaConexao`.
 */

export type Gateway = 'mercado_pago'

export type ConexaoDePagamento = {
  id: string
  gateway: Gateway
  contaNoGateway: string
  apelido: string | null
  expiraEm: string | null
  criadoEm: string
}

type Linha = {
  id: string
  cliente_id: string
  gateway: Gateway
  conta_no_gateway: string
  apelido: string | null
  token_ref: string
  renovacao_ref: string | null
  expira_em: string | null
  criado_em: string
}

/**
 * A tabela ainda não existe (código no ar antes da 0141): lida como "nenhuma
 * conexão". A tela mostra "não conectado" e a manutenção não alerta à toa.
 */
function tabelaAusente(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

const COLUNAS = 'id, cliente_id, gateway, conta_no_gateway, apelido, token_ref, renovacao_ref, expira_em, criado_em'

function paraConexao(linha: Linha): ConexaoDePagamento {
  return {
    id: linha.id,
    gateway: linha.gateway,
    contaNoGateway: linha.conta_no_gateway,
    apelido: linha.apelido,
    expiraEm: linha.expira_em,
    criadoEm: linha.criado_em,
  }
}

async function linhaDaConta(clienteId: string, gateway: Gateway): Promise<Linha | null> {
  const { data, error } = await db()
    .from('conexoes_de_pagamento')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .eq('gateway', gateway)
    .maybeSingle()
  if (ehIdInvalido(error) || tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível ler a conexão de pagamento: ${error.message}`)
  return (data as Linha | null) ?? null
}

export async function conexaoDePagamento(clienteId: string, gateway: Gateway): Promise<ConexaoDePagamento | null> {
  const linha = await linhaDaConta(clienteId, gateway)
  return linha ? paraConexao(linha) : null
}

/**
 * Liga (ou religa) a conta do dono.
 *
 * A ordem é a que não deixa sobra: os segredos novos entram no cofre, a linha
 * passa a apontar para eles, e só então os antigos saem. Se a linha falhar, os
 * novos são apagados; segredo de pagamento órfão é o pior tipo de órfão.
 */
export async function salvarConexaoDePagamento(entrada: {
  clienteId: string
  gateway: Gateway
  contaNoGateway: string
  apelido: string | null
  token: string
  renovacao: string | null
  expiraEm: Date | null
}): Promise<void> {
  const anterior = await linhaDaConta(entrada.clienteId, entrada.gateway)
  const tokenRef = await guardarNoCofre(entrada.token, `pagamento:${entrada.gateway}:${entrada.clienteId}`)
  const renovacaoRef = entrada.renovacao
    ? await guardarNoCofre(entrada.renovacao, `pagamento-renovacao:${entrada.gateway}:${entrada.clienteId}`)
    : null

  const valores = {
    conta_no_gateway: entrada.contaNoGateway,
    apelido: entrada.apelido,
    token_ref: tokenRef,
    renovacao_ref: renovacaoRef,
    expira_em: entrada.expiraEm?.toISOString() ?? null,
  }
  const { error } = anterior
    ? await db().from('conexoes_de_pagamento').update(valores).eq('id', anterior.id)
    : await db().from('conexoes_de_pagamento').insert({ cliente_id: entrada.clienteId, gateway: entrada.gateway, ...valores })

  if (error) {
    await apagarDoCofre(tokenRef).catch(() => undefined)
    if (renovacaoRef) await apagarDoCofre(renovacaoRef).catch(() => undefined)
    // 23505: a mesma conta do gateway já está ligada a outra conta daqui.
    if (error.code === '23505') throw new Error('esta conta do Mercado Pago já está ligada a outra conta')
    throw new Error(`não foi possível salvar a conexão de pagamento: ${error.message}`)
  }

  if (anterior) {
    await apagarDoCofre(anterior.token_ref).catch(() => undefined)
    if (anterior.renovacao_ref) await apagarDoCofre(anterior.renovacao_ref).catch(() => undefined)
  }
}

/** Desliga. O gatilho da 0141 apaga os segredos junto da linha. */
export async function apagarConexaoDePagamento(clienteId: string, gateway: Gateway): Promise<void> {
  const { error } = await db().from('conexoes_de_pagamento').delete().eq('cliente_id', clienteId).eq('gateway', gateway)
  if (error) throw new Error(`não foi possível desconectar: ${error.message}`)
}

/** O token, só para o servidor, na hora de falar com o gateway. */
export async function tokenDaConexao(clienteId: string, gateway: Gateway): Promise<string | null> {
  const linha = await linhaDaConta(clienteId, gateway)
  return linha ? lerDoCofre(linha.token_ref) : null
}

/**
 * As conexões que vencem antes de `limite`, com o token de renovação, para a
 * manutenção diária renovar com folga.
 */
export async function conexoesParaRenovar(limite: Date): Promise<{ clienteId: string; gateway: Gateway; renovacao: string }[]> {
  const { data, error } = await db()
    .from('conexoes_de_pagamento')
    .select(COLUNAS)
    .not('renovacao_ref', 'is', null)
    .lt('expira_em', limite.toISOString())
  if (tabelaAusente(error)) return []
  if (error) throw new Error(`não foi possível listar as conexões a renovar: ${error.message}`)

  const saida: { clienteId: string; gateway: Gateway; renovacao: string }[] = []
  for (const linha of data as Linha[]) {
    const renovacao = await lerDoCofre(linha.renovacao_ref!)
    if (renovacao) saida.push({ clienteId: linha.cliente_id, gateway: linha.gateway, renovacao })
  }
  return saida
}
