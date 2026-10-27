import 'server-only'
import type { PlataformaDePedido } from '@/core/pedidos-de-fora'
import { db, ehIdInvalido } from '../db'

/**
 * Os cardápios digitais e deliveries ligados à conta (0154,
 * `cardapios_conectados`). Uma linha por plataforma. A credencial mora em
 * `connections` (cofre); o segredo do webhook, quando a plataforma assina, no
 * Vault (`segredo_id`). Aqui é só a ida ao banco.
 */

export type PlataformaConectavel = Exclude<PlataformaDePedido, 'entregador'>

export type CardapioConectado = {
  id: string
  clienteId: string
  plataforma: PlataformaConectavel
  conexaoId: string | null
  idNaPlataforma: string | null
  segredoId: string | null
  avisarCliente: boolean
  importarCatalogo: boolean
  catalogoEm: string | null
  pedidosLidosAte: string | null
  ativo: boolean
  criadoEm: string
}

type Linha = {
  id: string
  client_id: string
  plataforma: PlataformaConectavel
  conexao_id: string | null
  id_na_plataforma: string | null
  segredo_id: string | null
  avisar_cliente: boolean
  importar_catalogo: boolean
  catalogo_em: string | null
  pedidos_lidos_ate: string | null
  ativo: boolean
  criado_em: string
}

const COLUNAS =
  'id, client_id, plataforma, conexao_id, id_na_plataforma, segredo_id, avisar_cliente, importar_catalogo, catalogo_em, pedidos_lidos_ate, ativo, criado_em'

const paraCardapio = (l: Linha): CardapioConectado => ({
  id: l.id,
  clienteId: l.client_id,
  plataforma: l.plataforma,
  conexaoId: l.conexao_id,
  idNaPlataforma: l.id_na_plataforma,
  segredoId: l.segredo_id,
  avisarCliente: l.avisar_cliente,
  importarCatalogo: l.importar_catalogo,
  catalogoEm: l.catalogo_em,
  pedidosLidosAte: l.pedidos_lidos_ate,
  ativo: l.ativo,
  criadoEm: l.criado_em,
})

/** Código no ar antes da 0154 lê "nenhum cardápio". */
const tabelaAusente = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205'

export async function cardapioDaConta(clienteId: string, plataforma: PlataformaConectavel): Promise<CardapioConectado | null> {
  const { data, error } = await db()
    .from('cardapios_conectados')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('plataforma', plataforma)
    .maybeSingle()
  if (ehIdInvalido(error) || tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível ler o cardápio conectado: ${error.message}`)
  return data ? paraCardapio(data as Linha) : null
}

export async function cardapiosDaConta(clienteId: string): Promise<CardapioConectado[]> {
  const { data, error } = await db().from('cardapios_conectados').select(COLUNAS).eq('client_id', clienteId)
  if (ehIdInvalido(error) || tabelaAusente(error)) return []
  if (error) throw new Error(`não foi possível ler os cardápios conectados: ${error.message}`)
  return (data as Linha[]).map(paraCardapio)
}

/** Liga ou atualiza a plataforma da conta (uma por plataforma). */
export async function salvarCardapio(entrada: {
  clienteId: string
  plataforma: PlataformaConectavel
  conexaoId: string | null
  idNaPlataforma: string | null
  segredoId?: string | null
  avisarCliente: boolean
  importarCatalogo: boolean
  ativo?: boolean
}): Promise<CardapioConectado> {
  const { data, error } = await db()
    .from('cardapios_conectados')
    .upsert(
      {
        client_id: entrada.clienteId,
        plataforma: entrada.plataforma,
        conexao_id: entrada.conexaoId,
        id_na_plataforma: entrada.idNaPlataforma,
        ...(entrada.segredoId !== undefined ? { segredo_id: entrada.segredoId } : {}),
        avisar_cliente: entrada.avisarCliente,
        importar_catalogo: entrada.importarCatalogo,
        ativo: entrada.ativo ?? true,
      },
      { onConflict: 'client_id,plataforma' },
    )
    .select(COLUNAS)
    .single()
  if (error) throw new Error(`não foi possível salvar o cardápio: ${error.message}`)
  return paraCardapio(data as Linha)
}

/** Os cardápios ligados de todas as contas: é a lista da passada de 10 minutos. */
export async function cardapiosAtivos(): Promise<CardapioConectado[]> {
  const { data, error } = await db().from('cardapios_conectados').select(COLUNAS).eq('ativo', true).limit(2000)
  if (tabelaAusente(error)) return []
  if (error) throw new Error(`não foi possível ler os cardápios ativos: ${error.message}`)
  return (data as Linha[]).map(paraCardapio)
}

export async function marcarPedidosLidos(id: string, ate: Date): Promise<void> {
  await db().from('cardapios_conectados').update({ pedidos_lidos_ate: ate.toISOString() }).eq('id', id)
}

export async function marcarCatalogo(id: string, em: Date): Promise<void> {
  await db().from('cardapios_conectados').update({ catalogo_em: em.toISOString() }).eq('id', id)
}
