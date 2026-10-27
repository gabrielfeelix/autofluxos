import 'server-only'
import { conectorOpenDelivery, lojaDoOpenDelivery, type CredencialOpenDelivery } from '@/cardapios/opendelivery'
import { conferirEndereco } from '../efeitos/rede'
import { cardapioDaConta, marcarPedidosLidos, salvarCardapio, type CardapioConectado } from '../repos/cardapios'
import { apagarConexao, criarConexao, lerCredencial, trocarValor } from '../repos/conexoes'
import { passadaDaFila } from './fila-open-delivery'

/**
 * Open Delivery de qualquer cardápio que fale o padrão (a Goomer tem tela
 * própria). O lojista copia do sistema de origem a URL da API, o Client Id e
 * o Client Secret. Os três moram juntos no cofre, como JSON numa conexão; o
 * host fica em `id_na_plataforma`, só para a tela mostrar de onde vem.
 *
 * A URL é digitada pelo lojista e o nosso servidor a chama: é conferida pelo
 * endereço resolvido (`conferirEndereco`) ao conectar e a cada passada.
 */

const NOME_DA_CONEXAO = 'Open Delivery (cardápio)'

export type OpenDeliveryConectado = { ok: true; loja: string } | { ok: false; erro: string }

/** A URL da API sem barra no fim, ou o motivo da recusa. */
async function baseConferida(url: string): Promise<{ ok: true; base: string } | { ok: false; erro: string }> {
  let alvo: URL
  try {
    alvo = new URL(url.trim())
  } catch {
    return { ok: false, erro: 'A URL da API não é válida. Copie de novo do seu sistema.' }
  }
  if (alvo.protocol !== 'https:') return { ok: false, erro: 'A URL da API precisa começar com https://.' }
  if (alvo.search || alvo.hash) return { ok: false, erro: 'Cole a URL da API sem parâmetros (sem ? nem #).' }
  const veredito = await conferirEndereco(alvo.toString())
  if (!veredito.ok) return { ok: false, erro: veredito.motivo }
  return { ok: true, base: alvo.toString().replace(/\/+$/, '') }
}

export async function conectarOpenDelivery(
  clienteId: string,
  dados: { base: string; clientId: string; clientSecret: string },
  avisarCliente: boolean,
): Promise<OpenDeliveryConectado> {
  const base = await baseConferida(dados.base)
  if (!base.ok) return base
  const credencial: CredencialOpenDelivery = { base: base.base, clientId: dados.clientId.trim(), clientSecret: dados.clientSecret.trim() }
  if (!credencial.clientId || !credencial.clientSecret) return { ok: false, erro: 'Cole o Client Id e o Client Secret.' }
  const loja = await lojaDoOpenDelivery(credencial)
  if (!loja.ok) return { ok: false, erro: loja.motivo }

  const valor = JSON.stringify(credencial)
  const anterior = await cardapioDaConta(clienteId, 'opendelivery')
  let conexaoId = anterior?.conexaoId ?? null
  if (conexaoId) {
    await trocarValor(conexaoId, clienteId, valor)
  } else {
    const conexao = await criarConexao({ clienteId, nome: NOME_DA_CONEXAO, tipo: 'bearer', valor })
    conexaoId = conexao.id
  }
  await salvarCardapio({
    clienteId,
    plataforma: 'opendelivery',
    conexaoId,
    idNaPlataforma: new URL(base.base).host,
    avisarCliente,
    importarCatalogo: false,
    ativo: true,
  })
  // Ligar agora: o histórico de ontem não vira aviso hoje.
  const ligado = await cardapioDaConta(clienteId, 'opendelivery')
  if (ligado && !anterior?.ativo) await marcarPedidosLidos(ligado.id, new Date())
  return { ok: true, loja: loja.valor.nome || new URL(base.base).host }
}

/** Desliga e apaga a credencial do cofre. Os pedidos que já entraram ficam no quadro. */
export async function desligarOpenDelivery(clienteId: string): Promise<void> {
  const atual = await cardapioDaConta(clienteId, 'opendelivery')
  if (!atual) return
  await salvarCardapio({
    clienteId,
    plataforma: 'opendelivery',
    conexaoId: null,
    idNaPlataforma: atual.idNaPlataforma,
    avisarCliente: atual.avisarCliente,
    importarCatalogo: false,
    ativo: false,
  })
  if (atual.conexaoId) await apagarConexao(atual.conexaoId, clienteId)
}

function credencialDe(valor: string): CredencialOpenDelivery | null {
  try {
    const c = JSON.parse(valor) as Partial<CredencialOpenDelivery>
    return typeof c.base === 'string' && typeof c.clientId === 'string' && typeof c.clientSecret === 'string'
      ? { base: c.base, clientId: c.clientId, clientSecret: c.clientSecret }
      : null
  } catch {
    return null
  }
}

/** A passada de 10 minutos pela fila de eventos, com a URL conferida de novo: o DNS dela pode ter mudado. */
export async function passadaDoOpenDelivery(cardapio: CardapioConectado, agora = new Date()): Promise<number> {
  if (!cardapio.conexaoId) return 0
  const lida = await lerCredencial(cardapio.conexaoId, cardapio.clienteId)
  const credencial = lida ? credencialDe(lida.valor) : null
  if (!credencial) return 0
  const base = await baseConferida(credencial.base)
  if (!base.ok) return 0
  return passadaDaFila(cardapio, conectorOpenDelivery(credencial, 'opendelivery'), 'Open Delivery', agora)
}
