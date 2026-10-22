import 'server-only'
import { paraCobrancaDaApi, type CobrancaDaApi } from '@/core/api/cobrancas'
import { criarCobranca } from '../cobrancas'
import { recusaDoPlano } from '../recursos-do-plano'
import { acharContatoPeloTelefone } from '../repos/contato-por-telefone'
import { listarCobrancas, type StatusDeCobranca } from '../repos/cobrancas'
import type { CodigoDeErro } from './autenticar'
import { gravarContatoDaApi } from './contatos'

/**
 * Cobranças pela API pública (frente 4 do handoff de 22/out): o sistema do
 * dono lista e cria. Criar devolve o Pix e o link **sem mandar na conversa**;
 * quem integra usa onde quiser (e-mail, tela própria, o modelo do WhatsApp).
 */

export const LIMITE_PADRAO_DE_COBRANCAS = 50
export const LIMITE_MAXIMO_DE_COBRANCAS = 100

export type FiltroDeCobrancasDaApi = {
  telefone?: string
  status?: StatusDeCobranca
  limite: number
}

/** Mais novas primeiro. `null` quando o telefone pedido não é contato da conta. */
export async function listarCobrancasDaApi(clienteId: string, filtro: FiltroDeCobrancasDaApi): Promise<CobrancaDaApi[] | null> {
  let contatoId: string | undefined
  if (filtro.telefone) {
    const achado = await acharContatoPeloTelefone(clienteId, filtro.telefone)
    if (!achado) return null
    contatoId = achado
  }
  const cobrancas = await listarCobrancas(clienteId, {
    limite: filtro.limite,
    ...(filtro.status ? { status: filtro.status } : {}),
    ...(contatoId ? { contatoId } : {}),
  })
  return cobrancas.map(paraCobrancaDaApi)
}

export type PedidoDeCobrancaDaApi = {
  telefone: string
  nome?: string
  valorCentavos: number
  descricao: string
  venceEm: Date
  documento?: string
}

type Recusa = { ok: false; status: number; codigo: CodigoDeErro; mensagem: string }
const recusa = (status: number, codigo: CodigoDeErro, mensagem: string): Recusa => ({ ok: false, status, codigo, mensagem })

/**
 * Cria a cobrança no gateway conectado da conta. Contato que não existe é
 * criado, com a mesma regra do `POST /contatos`.
 *
 * Cobrança é recurso do plano (`integracoes`, Operação para cima), além da
 * API: a chave pode existir num plano que não cobra.
 */
export async function criarCobrancaPelaApi(
  clienteId: string,
  pedido: PedidoDeCobrancaDaApi,
): Promise<{ ok: true; cobranca: CobrancaDaApi } | Recusa> {
  const doPlano = await recusaDoPlano(clienteId, 'integracoes')
  if (doPlano) return recusa(403, 'plano_sem_cobranca', doPlano)

  const contato = await gravarContatoDaApi(clienteId, { telefone: pedido.telefone, ...(pedido.nome ? { nome: pedido.nome } : {}) })
  if (!contato.ok) return recusa(422, 'telefone_invalido', 'Telefone sem DDD ou incompleto. Exemplo: 5511987654321.')

  const criada = await criarCobranca({
    clienteId,
    contatoId: contato.contato.id,
    valorCentavos: pedido.valorCentavos,
    descricao: pedido.descricao,
    venceEm: pedido.venceEm,
    origem: 'api',
    criadaPor: null,
    documento: pedido.documento ?? null,
  })
  if (criada.ok) return { ok: true, cobranca: paraCobrancaDaApi(criada.cobranca) }

  switch (criada.motivo) {
    case 'sem_conexao':
      return recusa(409, 'sem_conta_de_recebimento', criada.erro)
    case 'falta_documento':
      return recusa(422, 'documento_obrigatorio', `${criada.erro} Envie o campo documento.`)
    case 'documento_invalido':
      return recusa(422, 'documento_invalido', criada.erro)
    case 'contato':
      return recusa(404, 'contato_nao_encontrado', criada.erro)
    case 'gateway':
      return recusa(502, 'gateway_recusou', criada.erro)
  }
}
