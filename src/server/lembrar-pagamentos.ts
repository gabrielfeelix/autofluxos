import 'server-only'
import type { AutorDaSaida } from '@/core/autor-da-mensagem'
import { telefoneCanonico } from '@/core/contatos/telefone'
import { comAtributosDoCliente, telefoneDoPedido } from '@/core/eventos-da-loja'
import {
  fotoDoProduto,
  horasAtras,
  IDADE_MAXIMA_EM_HORAS,
  modeloDoLembrete,
  nomeCurto,
  primeiroNome,
  STATUS_DO_LEMBRETE,
  type LembreteDePagamento,
} from '@/core/lembrete-de-pagamento'
import { alertar } from './alertar'
import { enviarModeloPelaApi } from './api/templates'
import { chamarHttp } from './efeitos/http'
import { lerCredencial } from './repos/conexoes'
import { lojasComLembrete, marcarStatusAvisado, type LojaIntegrada } from './repos/lojas'

/**
 * A passada do lembrete de pagamento pendente (0162), ver
 * `core/lembrete-de-pagamento.ts`. Roda junto da passada dos pedidos, a cada
 * 10 minutos (`/api/manutencao/pedidos`).
 *
 * Pergunta à loja pelos pedidos **ainda** pendentes criados entre 48h atrás e
 * a espera configurada. Quem pagou nesse meio-tempo já não vem na consulta:
 * a conferência de "continua pendente?" é a própria pergunta. Cada pedido
 * recebe um lembrete só (`status_de_pedido_avisados`), marcado antes do envio,
 * para uma falha nunca virar duas mensagens.
 */

const POR_PASSADA = 30

const CAMPOS =
  'items[increment_id,customer_id,customer_firstname,billing_address[telephone,firstname],items[sku,name,parent_item_id]]'

const AUTOR: AutorDaSaida = { tipo: 'pessoa', id: null, nome: 'Lembrete de pagamento' }

type PedidoPendente = {
  increment_id?: unknown
  customer_id?: unknown
  customer_firstname?: unknown
  billing_address?: { telephone?: unknown; firstname?: unknown }
  items?: { sku?: unknown; name?: unknown; parent_item_id?: unknown }[]
}

export async function lembrarPagamentos(agora = new Date()): Promise<{ lojas: number; enviados: number }> {
  const lojas = await lojasComLembrete()
  let enviados = 0
  for (const loja of lojas) {
    enviados += await passadaDaLoja(loja, agora).catch(async (erro) => {
      await alertar('o lembrete de pagamento da loja falhou', erro, { cliente: loja.clienteId })
      return 0
    })
  }
  return { lojas: lojas.length, enviados }
}

async function passadaDaLoja(loja: LojaIntegrada & { lembrete: LembreteDePagamento }, agora: Date): Promise<number> {
  const credencial = loja.conexaoId ? await lerCredencial(loja.conexaoId, loja.clienteId) : null
  if (!credencial) return 0
  const raiz = `${loja.endereco.replace(/\/+$/, '')}/rest/V1`
  const ler = async (caminho: string) => {
    const r = await chamarHttp(
      { tipo: 'chamar_http', metodo: 'GET', url: `${raiz}${caminho}`, cabecalhos: [], corpo: '', mapear: [], aoFalhar: 'humano' },
      { deTeste: false, credencial, comJson: true },
    )
    return r.ok ? r.json : null
  }

  const filtro = (grupo: number, campo: string, valor: string, condicao: string) => {
    const f = `searchCriteria[filterGroups][${grupo}][filters][0]`
    return `${f}[field]=${campo}&${f}[value]=${encodeURIComponent(valor)}&${f}[conditionType]=${condicao}`
  }
  const consulta = [
    filtro(0, 'status', 'pending', 'eq'),
    filtro(1, 'created_at', horasAtras(agora, IDADE_MAXIMA_EM_HORAS), 'gteq'),
    filtro(2, 'created_at', horasAtras(agora, loja.lembrete.esperaHoras), 'lteq'),
    `searchCriteria[pageSize]=${POR_PASSADA}`,
    `fields=${encodeURIComponent(CAMPOS)}`,
  ].join('&')
  const lista = await ler(`/orders?${consulta}`)
  if (lista === null) throw new Error('a loja não respondeu à consulta de pedidos pendentes')
  const pedidos = ((lista as { items?: PedidoPendente[] } | null)?.items ?? [])

  let enviados = 0
  for (const pedido of pedidos) {
    const numero = typeof pedido.increment_id === 'string' || typeof pedido.increment_id === 'number' ? String(pedido.increment_id) : ''
    if (!numero) continue
    // Marca antes de tudo: o pedido sem aceite ou sem telefone não volta a ser lido a cada 10 minutos.
    if (!(await marcarStatusAvisado(loja.clienteId, numero, STATUS_DO_LEMBRETE))) continue

    const waId = telefoneCanonico(telefoneDoPedido(pedido))
    if (!waId) continue

    if (loja.lembrete.exigirAceite) {
      const clienteId = typeof pedido.customer_id === 'number' || typeof pedido.customer_id === 'string' ? String(pedido.customer_id) : ''
      const cadastro = /^\d{1,12}$/.test(clienteId) ? await ler(`/customers/${clienteId}`) : null
      const dados = comAtributosDoCliente({}, cadastro as Parameters<typeof comAtributosDoCliente>[1])
      if (dados.aceita_whatsapp !== true) continue
    }

    const item = (pedido.items ?? []).find((i) => !i.parent_item_id && typeof i.sku === 'string')
    if (!item || typeof item.sku !== 'string') continue
    const produto = (await ler(`/products/${encodeURIComponent(item.sku)}`)) as {
      name?: unknown
      custom_attributes?: { attribute_code?: unknown; value?: unknown }[]
      media_gallery_entries?: { file?: unknown; disabled?: unknown }[]
    } | null
    const urlKey = produto?.custom_attributes?.find((a) => a.attribute_code === 'url_key')?.value
    const arquivo = produto?.media_gallery_entries?.find((m) => !m.disabled && typeof m.file === 'string')?.file
    const foto = typeof arquivo === 'string' ? fotoDoProduto(loja.endereco, arquivo) : null
    const nomeDoProduto = typeof item.name === 'string' ? item.name : typeof produto?.name === 'string' ? produto.name : ''
    if (typeof urlKey !== 'string' || !foto || !nomeDoProduto) {
      await alertar('lembrete de pagamento sem produto completo', `pedido ${numero}, sku ${item.sku}`, { cliente: loja.clienteId })
      continue
    }

    const nome = primeiroNome(String(pedido.customer_firstname ?? pedido.billing_address?.firstname ?? '')) || 'tudo bem'
    const cupom = loja.lembrete.cupom
    const r = await enviarModeloPelaApi(
      loja.clienteId,
      {
        telefone: waId,
        template: modeloDoLembrete(loja.lembrete),
        valores: { corpo: cupom ? [nome, nomeCurto(nomeDoProduto), loja.lembrete.desconto ?? '', cupom] : [nome, nomeCurto(nomeDoProduto)] },
        link: `${urlKey}${loja.sufixo ?? ''}`,
        imagem: foto,
        ...(cupom ? { cupom } : {}),
      },
      { autor: AUTOR },
    )
    if (r.ok) enviados++
    else if (r.codigo !== 'sem_aceite_de_marketing') {
      await alertar('o lembrete de pagamento não saiu', `pedido ${numero}: ${r.codigo} ${r.mensagem}`, { cliente: loja.clienteId })
    }
  }
  return enviados
}
