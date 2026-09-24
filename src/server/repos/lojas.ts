import 'server-only'
import { ehPlataformaDeLoja, type PlataformaDeLoja } from '@/core/plataformas-de-loja'
import type { ViaDeEstoque } from '@/loja/types'
import { db, ehIdInvalido } from '../db'

/**
 * A loja on-line da conta (0092), para o bot consultar catálogo ao vivo.
 *
 * **Nada neste arquivo apaga linha.** "Desconectar a loja" é `ativa = false`,
 * e o endereço fica para religar. A única coisa que se apaga nesta integração
 * é a Conexão do token, e quem apaga é a ação da tela, depois de
 * `desligarEstoqueExato` ter zerado o estado (senão o check
 * `lojas_estoque_exige_token` recusa o `on delete set null`).
 *
 * Toda leitura e escrita filtra por `client_id`, e o id vem da sessão ou do
 * servidor, nunca do modelo nem do navegador sem conferência.
 */

export type { ViaDeEstoque } from '@/loja/types'

export type LojaIntegrada = {
  id: string
  clienteId: string
  plataforma: 'magento'
  endereco: string
  codigoDaLoja: string | null
  sufixo: string
  ativa: boolean
  conexaoId: string | null
  estoqueExato: 'desligado' | ViaDeEstoque
  estoqueId: number | null
  verificadaEm: string | null
}

type Linha = {
  id: string
  client_id: string
  plataforma: 'magento'
  endereco: string
  codigo_da_loja: string | null
  sufixo_da_url: string
  ativa: boolean
  conexao_id: string | null
  estoque_exato: 'desligado' | ViaDeEstoque
  estoque_id: number | null
  verificada_em: string | null
}

const COLUNAS =
  'id, client_id, plataforma, endereco, codigo_da_loja, sufixo_da_url, ativa, conexao_id, estoque_exato, estoque_id, verificada_em'

function paraLoja(l: Linha): LojaIntegrada {
  return {
    id: l.id,
    clienteId: l.client_id,
    plataforma: l.plataforma,
    endereco: l.endereco,
    codigoDaLoja: l.codigo_da_loja,
    sufixo: l.sufixo_da_url,
    ativa: l.ativa,
    conexaoId: l.conexao_id,
    estoqueExato: l.estoque_exato,
    estoqueId: l.estoque_id,
    verificadaEm: l.verificada_em,
  }
}

/** A loja Magento da conta, ligada ou não. `null` = nunca configurada. */
export async function lojaDaConta(clienteId: string): Promise<LojaIntegrada | null> {
  const { data, error } = await db()
    .from('lojas_integradas')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('plataforma', 'magento')
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler a loja da conta: ${error.message}`)
  return data ? paraLoja(data as Linha) : null
}

/**
 * Grava o que o teste da tela descobriu, e marca como verificada agora.
 *
 * Só quem acabou de testar chama isto (`acoes-loja.ts`), e é por isso que
 * `verificada_em` é carimbado aqui e não recebido: a data é do teste que o
 * servidor fez, não de algo que alguém afirmou.
 */
export async function salvarLoja(
  clienteId: string,
  dados: { endereco: string; codigoDaLoja: string | null; sufixo: string },
): Promise<LojaIntegrada> {
  const agora = new Date().toISOString()
  const { data, error } = await db()
    .from('lojas_integradas')
    .upsert(
      {
        client_id: clienteId,
        plataforma: 'magento',
        endereco: dados.endereco,
        codigo_da_loja: dados.codigoDaLoja,
        sufixo_da_url: dados.sufixo,
        verificada_em: agora,
        atualizado_em: agora,
      },
      { onConflict: 'client_id,plataforma' },
    )
    .select(COLUNAS)
    .single()

  if (error) throw new Error(`não deu para salvar a loja: ${error.message}`)
  return paraLoja(data as Linha)
}

/** Liga ou desliga o bot na loja. Ligar exige loja já testada. */
export async function ligarLoja(
  clienteId: string,
  ativa: boolean,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const loja = await lojaDaConta(clienteId)
  if (!loja) return { ok: false, motivo: 'configure e teste a loja antes de ligar' }
  if (ativa && !loja.verificadaEm) return { ok: false, motivo: 'teste a loja antes de ligar' }

  const { error } = await db()
    .from('lojas_integradas')
    .update({ ativa, atualizado_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('plataforma', 'magento')

  if (error) throw new Error(`não deu para ${ativa ? 'ligar' : 'desligar'} a loja: ${error.message}`)
  return { ok: true }
}

export async function ligarEstoqueExato(
  clienteId: string,
  dados: { conexaoId: string; via: ViaDeEstoque; estoqueId: number | null },
): Promise<void> {
  const { error } = await db()
    .from('lojas_integradas')
    .update({
      conexao_id: dados.conexaoId,
      estoque_exato: dados.via,
      estoque_id: dados.estoqueId,
      atualizado_em: new Date().toISOString(),
    })
    .eq('client_id', clienteId)
    .eq('plataforma', 'magento')

  if (error) throw new Error(`não deu para ligar o estoque exato: ${error.message}`)
}

/**
 * Zera o estoque exato e devolve a Conexão que ficou solta, para quem for
 * apagá-la. Não apaga nada: a ordem (zerar, depois apagar a Conexão) é o que
 * o check da 0092 exige, e fica visível em quem chama.
 */
export async function desligarEstoqueExato(clienteId: string): Promise<{ conexaoId: string | null }> {
  const loja = await lojaDaConta(clienteId)
  if (!loja) return { conexaoId: null }

  const { error } = await db()
    .from('lojas_integradas')
    .update({ conexao_id: null, estoque_exato: 'desligado', estoque_id: null, atualizado_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('plataforma', 'magento')

  if (error) throw new Error(`não deu para desligar o estoque exato: ${error.message}`)
  return { conexaoId: loja.conexaoId }
}

/**
 * Os "Quero esta" da conta (0103): as plataformas "Em breve" que ela pediu.
 *
 * Erro de leitura devolve lista vazia: o pior caso é o botão aparecer de novo,
 * e clicar outra vez não duplica (o `primary key` é conta e plataforma).
 */
export async function pedidosDeLoja(clienteId: string): Promise<PlataformaDeLoja[]> {
  const { data, error } = await db().from('pedidos_de_loja').select('plataforma').eq('client_id', clienteId)
  if (error || !data) return []
  return (data as { plataforma: string }[]).map((l) => l.plataforma).filter(ehPlataformaDeLoja)
}

/**
 * Grava o "Quero esta". Uma vez por conta: o segundo clique é aceito e não
 * vira segundo voto (`ignoreDuplicates` sobre a chave conta e plataforma).
 */
export async function registrarPedidoDeLoja(
  clienteId: string,
  plataforma: PlataformaDeLoja,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error } = await db()
    .from('pedidos_de_loja')
    .upsert({ client_id: clienteId, plataforma }, { onConflict: 'client_id,plataforma', ignoreDuplicates: true })

  if (error) return { ok: false, motivo: `não deu para gravar o pedido: ${error.message}` }
  return { ok: true }
}
