import 'server-only'
import { enriquecer, type Complemento } from '@/loja/enriquecer'
import { lojaCatalogo } from '@/loja/catalogo'
import { lojaMagento } from '@/loja/magento'
import { lojaAdmin } from '@/loja/magento-admin'
import { consultarPedido, type ConsultaDePedido } from '@/loja/magento-pedido'
import { listarCupons, vendasDoCupom, type CupomDaLoja } from '@/loja/magento-cupons'
import type { Periodo } from '@/core/relatorios'
import { cuponsMandados, type Responsaveis } from './repos/relatorios'
import { lojaNuvemshop } from '@/loja/nuvemshop'
import type { Loja } from '@/loja/types'
import { alertar } from './alertar'
import { chamarHttp } from './efeitos/http'
import { lerCredencial } from './repos/conexoes'
import { freteRapidoDaConta, lojaDaConta, lojaNuvemshopDaConta } from './repos/lojas'
import { lerDoCofre } from './cofre'
import { rastrearNaFreteRapido, type RastreioDaFreteRapido } from '@/loja/frete-rapido'
import { listarProdutos } from './repos/produtos'
import { estaAtivo } from '@/core/produtos'
import type { FonteDoCatalogo } from '@/core/flow/schema'
import { linkDoRastreio } from '@/core/pedido-na-conversa'

/** Quanto a foto e o estoque exato podem atrasar uma resposta, somados. */
export const PRAZO_DO_TOKEN_MS = 3_000

/**
 * O pedido da loja Magento desta conta, conferido contra quem pergunta.
 *
 * Usa o mesmo token do estoque exato, mesmo com o estoque exato desligado: o
 * token é da conta, e ler pedido é outra permissão dele, não outro token. Quem
 * confere se a pessoa pode ver o pedido é `consultarPedido`.
 */
export async function consultarPedidoDaConta(
  clienteId: string,
  entrada: { numero: string; telefone: string; documento?: string; daEquipe?: boolean },
): Promise<{ ok: true; valor: ConsultaDePedido } | { ok: false; motivo: string }> {
  const loja = await lojaDaConta(clienteId)
  if (!loja || !loja.ativa) return { ok: false, motivo: 'a loja desta conta não está ligada' }
  if (!loja.conexaoId) return { ok: false, motivo: 'a loja desta conta não tem token conectado' }

  let credencial = null
  try {
    credencial = await lerCredencial(loja.conexaoId, clienteId)
  } catch {
    return { ok: false, motivo: 'não deu para ler o token da loja' }
  }
  const r = await consultarPedido({ endereco: loja.endereco, credencial }, entrada, chamarHttp)
  if (!r.ok || !r.valor.encontrado) return r

  /*
   * Só depois de o Magento confirmar que o pedido é de quem pergunta: a Frete
   * Rápido responde para qualquer número, e perguntar a ela antes disso seria
   * dar rastreio de terceiro a quem chuta. Melhor-esforço: sem token, com a
   * API fora ou sem frete ainda, a resposta segue com o que o Magento sabe.
   */
  const entrega = await entregaDaFreteRapido(clienteId, r.valor.pedido.numero)
  // O link público da Frete Rápido, para o bot mandar junto (ver `linkDoRastreio`).
  const rastreio = linkDoRastreio(r.valor.pedido)
  const pedido = { ...r.valor.pedido, ...(entrega ? { entrega } : {}), ...(rastreio ? { linkDoRastreio: rastreio } : {}) }
  return { ok: true, valor: { ...r.valor, pedido } }
}

/**
 * Os cupons ativos da loja da conta (só Magento), para o seletor da Inbox.
 * `hoje` no fuso de Brasília: cupom que vence hoje ainda vale hoje.
 */
export async function cuponsDaConta(
  clienteId: string,
): Promise<{ ok: true; valor: CupomDaLoja[] } | { ok: false; motivo: string }> {
  const loja = await lojaDaConta(clienteId)
  if (!loja || !loja.ativa) return { ok: false, motivo: 'a loja desta conta não está ligada' }
  if (!loja.conexaoId) return { ok: false, motivo: 'a loja desta conta não tem token conectado' }
  let credencial = null
  try {
    credencial = await lerCredencial(loja.conexaoId, clienteId)
  } catch {
    return { ok: false, motivo: 'não deu para ler o token da loja' }
  }
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  return listarCupons({ endereco: loja.endereco, credencial }, hoje, chamarHttp)
}

/** Um cupom que o atendimento mandou, e o que ele vendeu no mesmo período. */
export type CupomDoChat = { codigo: string; contatos: number; pedidos: number; receita: number }

/** Mais que isso vira lista de parceiro, e cada um é uma chamada à loja. */
const CUPONS_NO_RELATORIO = 6

/**
 * Os cupons que o atendimento mandou no período e quantos pedidos cada um
 * trouxe na loja, para o relatório (pedido de 30/set/2026: medir o CHAT10).
 *
 * `null` quando a conta não tem Magento ligado, e o bloco nem aparece. O pedido
 * conta quem usou o cupom, tenha recebido pelo chat ou não: para um cupom só
 * do chat, como o CHAT10, é a venda que o chat trouxe.
 */
export async function cuponsDoChat(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<{ ok: true; valor: CupomDoChat[] } | { ok: false; motivo: string } | null> {
  const loja = await lojaDaConta(clienteId)
  if (!loja || !loja.ativa || !loja.conexaoId) return null
  const ativos = await cuponsDaConta(clienteId)
  if (!ativos.ok) return ativos

  const mandados = (
    await cuponsMandados(clienteId, periodo, responsaveis, ativos.valor.map((c) => c.codigo))
  ).slice(0, CUPONS_NO_RELATORIO)
  if (mandados.length === 0) return { ok: true, valor: [] }

  let credencial = null
  try {
    credencial = await lerCredencial(loja.conexaoId, clienteId)
  } catch {
    return { ok: false, motivo: 'não deu para ler o token da loja' }
  }
  const noMagento = { de: `${periodo.de} 03:00:00`, ate: `${diaSeguinte(periodo.ate)} 03:00:00` }

  const valor: CupomDoChat[] = []
  for (const m of mandados) {
    const r = await vendasDoCupom({ endereco: loja.endereco, credencial }, m.codigo, noMagento, chamarHttp)
    if (!r.ok) return r
    valor.push({ ...m, pedidos: r.valor.pedidos, receita: r.valor.receita })
  }
  return { ok: true, valor }
}

/**
 * `AAAA-MM-DD` mais um dia. Meia-noite de Brasília é 03:00 UTC o ano inteiro
 * desde que o horário de verão acabou (2019), e o Magento guarda `created_at`
 * em UTC: é daí o `03:00:00` de quem chama.
 */
function diaSeguinte(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

async function entregaDaFreteRapido(clienteId: string, numero: string): Promise<RastreioDaFreteRapido | null> {
  const ref = await freteRapidoDaConta(clienteId)
  if (!ref) return null
  const token = await lerDoCofre(ref).catch(() => null)
  if (!token) return null
  const r = await rastrearNaFreteRapido(numero, token)
  if (r.ok) return r.valor
  void alertar('Frete Rápido', r.motivo, { clienteId })
  return null
}

/**
 * Qual adaptador fala com a loja desta conta, no desenho de
 * `adaptador-do-canal.ts`: um lugar só escolhe, e quem usa recebe `Loja`.
 *
 * **Magento ligada ganha**, depois a Nuvemshop ligada. Sem nenhuma, a conta com catálogo próprio ativo
 * (`public.produtos`, cadastrado ou importado) usa o catálogo, pelo mesmo
 * caminho: o bot busca e manda o card igual. O catálogo nunca é cópia da
 * Magento, e com as duas a busca é a da loja, ao vivo.
 *
 * `null` quando a conta não tem nenhum dos dois. Quem chama trata isso como
 * "a loja desta conta não está ligada", e o bot passa para pessoa em vez de
 * inventar catálogo.
 *
 * **Por cima da busca pública, e só por cima** (ver `loja/enriquecer.ts`):
 *
 *  - foto real no card (`lerPorSku`), com ou sem token: a foto sai da REST
 *    sem credencial. Loja que fecha a REST para anônimo fica sem foto;
 *  - quantidade exata na busca e no card, só com token.
 *
 * Token que não lê do cofre, que a loja recusa, ou loja lenta: o bot responde
 * com a fase 1 intacta.
 *
 * **A fonte pedida pelo bloco de IA** (`fonteDoCatalogo`) passa por cima da
 * ordem: `catalogo` é só o catálogo próprio, mesmo com Magento ligada, que é a
 * conta que vende no site e atende um cardápio no WhatsApp; `loja` é só a loja
 * on-line, sem cair no catálogo. Ausente é a ordem acima, a de sempre.
 */
export async function lojaAtivaDaConta(clienteId: string, fonte?: FonteDoCatalogo): Promise<Loja | null> {
  if (fonte === 'catalogo') return catalogoDaConta(clienteId)
  const loja = await lojaDaConta(clienteId)
  if (!loja || !loja.ativa) {
    const nuvemshop = await nuvemshopDaConta(clienteId)
    if (nuvemshop || fonte === 'loja') return nuvemshop
    return catalogoDaConta(clienteId)
  }

  const publica = lojaMagento({ endereco: loja.endereco, codigoDaLoja: loja.codigoDaLoja, sufixo: loja.sufixo })

  let credencial = null
  if (loja.estoqueExato !== 'desligado' && loja.conexaoId) {
    try {
      credencial = await lerCredencial(loja.conexaoId, clienteId)
    } catch {
      credencial = null
    }
  }

  const admin = avisandoRecusa(lojaAdmin({ endereco: loja.endereco, credencial }), clienteId)
  const via = credencial && loja.estoqueExato !== 'desligado' ? loja.estoqueExato : null
  const naBusca = { via, estoqueId: loja.estoqueId, prazoMs: PRAZO_DO_TOKEN_MS, comFoto: false }
  const noCard = { ...naBusca, comFoto: true }

  return {
    ...publica,
    async buscar(termo, opcoes) {
      const r = await publica.buscar(termo, opcoes)
      const como = opcoes?.comFoto ? noCard : naBusca
      return r.ok ? { ok: true, valor: await enriquecer(r.valor, admin, como) } : r
    },
    async combinaCom(sku) {
      const r = await publica.combinaCom(sku)
      return r.ok ? { ok: true, valor: await enriquecer(r.valor, admin, naBusca) } : r
    },
    async lerPorSku(skus) {
      const r = await publica.lerPorSku(skus)
      return r.ok ? { ok: true, valor: await enriquecer(r.valor, admin, noCard) } : r
    },
  }
}

/**
 * A Nuvemshop ligada da conta, ou `null` (F4 do plano de navegação).
 *
 * Vem depois da Magento e antes do catálogo, pela mesma regra: loja ao vivo
 * ganha de cópia. Sem token no cofre (a Conexão foi apagada em Chaves de API)
 * a loja não responde nada, então vale como desligada.
 */
async function nuvemshopDaConta(clienteId: string): Promise<Loja | null> {
  const loja = await lojaNuvemshopDaConta(clienteId)
  if (!loja?.ativa || !loja.storeId || !loja.conexaoId) return null
  let credencial = null
  try {
    credencial = await lerCredencial(loja.conexaoId, clienteId)
  } catch {
    return null
  }
  if (!credencial) return null
  return lojaNuvemshop({ endereco: loja.endereco, storeId: loja.storeId, token: credencial.valor })
}

/**
 * O catálogo próprio como loja, ou `null` se ele não tem item ativo.
 *
 * Lido uma vez só: a mesma lista serve a busca e a releitura do card dentro
 * da mesma rodada, e item arquivado depois disso aparece até a próxima.
 */
async function catalogoDaConta(clienteId: string): Promise<Loja | null> {
  const ativos = (await listarProdutos(clienteId)).filter(estaAtivo)
  if (ativos.length === 0) return null
  return lojaCatalogo(async () => ativos)
}

export type EstadoDoToken = 'sem_token' | 'ok' | 'recusado' | 'sem_resposta'

/**
 * O token ainda vale? Para a tela, que antes mostrava "conectado" pelo estado
 * salvo mesmo depois de o lojista revogar.
 *
 * Com teto: a tela não pode ficar presa numa loja lenta, e sem resposta a tela
 * não afirma nada. Só `recusado` vira aviso.
 */
export async function estadoDoToken(clienteId: string): Promise<EstadoDoToken> {
  const loja = await lojaDaConta(clienteId)
  if (!loja?.conexaoId || loja.estoqueExato === 'desligado') return 'sem_token'

  let credencial = null
  try {
    credencial = await lerCredencial(loja.conexaoId, clienteId)
  } catch {
    return 'sem_resposta'
  }
  if (!credencial) return 'sem_resposta'

  const conferencia = lojaAdmin({ endereco: loja.endereco, credencial }).conferir(loja.estoqueExato)
  const teto = new Promise<'sem_resposta'>((resolve) => setTimeout(() => resolve('sem_resposta'), PRAZO_DO_TOKEN_MS))
  return Promise.race([conferencia.catch(() => 'sem_resposta' as const), teto])
}

/** Conta e dia do último aviso. Por instância: basta para não inundar o canal. */
const avisadoEm = new Map<string, string>()

/**
 * Token recusado no meio da conversa vira alerta, uma vez por conta por dia.
 *
 * O bot já segue com a fase 1 sem ninguém notar, e é por isso que alguém
 * precisa notar: o lojista revogou, ou o token expirou, e a foto sumiu dos
 * cards. O alerta leva a conta, nunca o token.
 */
function avisandoRecusa(admin: Complemento, clienteId: string): Complemento {
  function conferir<T>(r: { ok: true; valor: T } | { ok: false; motivo: string }) {
    if (!r.ok && r.motivo === 'o token foi recusado pela loja') {
      const hoje = new Date().toISOString().slice(0, 10)
      if (avisadoEm.get(clienteId) !== hoje) {
        avisadoEm.set(clienteId, hoje)
        void alertar('a loja recusou o token de administrador do Magento', r.motivo, { cliente: clienteId })
      }
    }
    return r
  }
  return {
    quantidade: async (sku, via, estoqueId) => conferir(await admin.quantidade(sku, via, estoqueId)),
    foto: async (sku) => conferir(await admin.foto(sku)),
  }
}
