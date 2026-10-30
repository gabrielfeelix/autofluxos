import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  assinaturaDaOlaClick,
  conectorOlaClick,
  lojaDaOlaClick,
  registrarWebhookDaOlaClick,
  statusDaOlaClick,
  traduzirPedido,
} from './olaclick'

/**
 * Um pedido nos campos do schema oficial (`GET /v1/orders/:id`, 27/out/2026).
 * A documentação não traz exemplo com valores: estes são nossos.
 */
const PEDIDO = {
  id: '0b9c5f8e-2a41-4d7e-9a1b-3c6d8e2f5a90',
  public_id: 'BR-1234567890',
  daily_id: 42,
  status: 'READY',
  delivery_status: 'DELIVERING',
  service_type: 'DELIVERY',
  source: 'INBOUND',
  client: { id: 'c1', name: 'Ana Souza', phone_number: '44999998888', country_calling_code: '55', email: null },
  address: {
    address: 'Av. Brasil, 1200',
    complement: 'Ap 31',
    reference: 'Portão azul',
    area_name: 'Centro',
    latitude: -23.4,
    longitude: -51.9,
  },
  total: 64.5,
  combos: [
    { id: 'x1', product_name: 'Pizza', variant_name: 'Grande', quantity: 1, combo_price: 54.5, canceled_at: null },
    { id: 'x2', product_name: 'Refrigerante', variant_name: 'Refrigerante', quantity: 2, combo_price: 10 },
    { id: 'x3', product_name: 'Borda', variant_name: '', quantity: 1, combo_price: 8, canceled_at: '2026-10-27T12:00:00Z' },
  ],
}

describe('OlaClick', () => {
  it('traduz o pedido', () => {
    expect(traduzirPedido(PEDIDO)).toEqual({
      plataforma: 'olaclick',
      idExterno: PEDIDO.id,
      numeroExibido: '42',
      status: 'saiu',
      telefone: '5544999998888',
      nome: 'Ana Souza',
      entrega: 'entrega',
      endereco: 'Av. Brasil, 1200, Ap 31, Centro (Portão azul)',
      totalCentavos: 6450,
      itens: [
        { nome: 'Pizza (Grande)', quantidade: 1, precoCentavos: 5450 },
        { nome: 'Refrigerante', quantidade: 2, precoCentavos: 1000 },
      ],
      rastreioUrl: null,
    })
  })

  it('mesa fica de fora; retirada e consumo no local entram sem endereço', () => {
    expect(traduzirPedido({ ...PEDIDO, service_type: 'TABLE' })).toBeNull()
    expect(traduzirPedido({ ...PEDIDO, service_type: 'TAKEAWAY' })).toMatchObject({ entrega: 'retirada', endereco: null })
    expect(traduzirPedido({ ...PEDIDO, service_type: 'ONSITE' })?.entrega).toBe('local')
  })

  it('telefone que já vem com DDI não ganha outro, e pedido sem cliente não quebra', () => {
    const comDdi = { ...PEDIDO, client: { ...PEDIDO.client, phone_number: '+55 44 99999-8888' } }
    expect(traduzirPedido(comDdi)?.telefone).toBe('5544999998888')
    const r = traduzirPedido({ ...PEDIDO, client: null, address: null, daily_id: null })
    expect(r?.telefone).toBeNull()
    expect(r?.endereco).toBeNull()
    expect(r?.numeroExibido).toBe('BR-1234567890')
  })

  it('o mapa de status', () => {
    expect(statusDaOlaClick('PENDING', 'entrega')).toBe('novo')
    expect(statusDaOlaClick('PREPARING', 'entrega')).toBe('em_preparo')
    expect(statusDaOlaClick('READY', 'entrega', 'REQUESTING_RIDER')).toBe('em_preparo')
    expect(statusDaOlaClick('READY', 'entrega', 'DELIVERING')).toBe('saiu')
    expect(statusDaOlaClick('READY', 'retirada')).toBe('saiu')
    expect(statusDaOlaClick('DRIVER_ON_THE_WAY_TO_DESTINATION', 'entrega')).toBe('saiu')
    expect(statusDaOlaClick('FINALIZED', 'entrega')).toBe('entregue')
    expect(statusDaOlaClick('CANCELLED', 'entrega')).toBe('cancelado')
    expect(statusDaOlaClick('ALGO_NOVO', 'entrega')).toBe('novo')
  })

  it('confere a assinatura do webhook', () => {
    const corpo = '{"event_type":"ORDER_CREATED","data":{"id":"1"}}'
    const valida = `sha256=${createHmac('sha256', 'whsec_x').update(corpo).digest('hex')}`
    expect(assinaturaDaOlaClick(corpo, 'whsec_x', valida)).toBe(true)
    expect(assinaturaDaOlaClick(`${corpo} `, 'whsec_x', valida)).toBe(false)
    expect(assinaturaDaOlaClick(corpo, 'outro', valida)).toBe(false)
    expect(assinaturaDaOlaClick(corpo, null, valida)).toBe(false)
    expect(assinaturaDaOlaClick(corpo, 'whsec_x', null)).toBe(false)
  })

  it('a passada lê só o que mudou depois de desde e busca cada pedido completo', async () => {
    const desde = new Date(Date.now() - 600_000)
    const chamadas: string[] = []
    const falso = async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      chamadas.push(u)
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer chave')
      if (u.includes('/orders?')) {
        return Response.json({
          data: [
            { id: PEDIDO.id, updated_at: new Date().toISOString() },
            { id: 'antigo', updated_at: new Date(desde.getTime() - 60_000).toISOString() },
          ],
          pagination: { current_page: 1, per_page: 50, total: 2, has_more: false },
        })
      }
      if (u.endsWith(`/orders/${PEDIDO.id}`)) return Response.json({ data: PEDIDO })
      throw new Error(`não devia buscar ${u}`)
    }
    const r = await conectorOlaClick('chave', falso).pedidosDesde(desde)
    expect(r.ok && r.valor.map((p) => p.idExterno)).toEqual([PEDIDO.id])
    expect(chamadas[0]).toContain('filter[time_type]=updated_at')
    expect(chamadas[0]).toContain('filter[service_types]=DELIVERY,TAKEAWAY,ONSITE')
  })

  it('a passada segue as páginas enquanto houver mais', async () => {
    let paginas = 0
    await conectorOlaClick('chave', async (url) => {
      if (String(url).includes('/orders?')) {
        paginas++
        return Response.json({ data: [], pagination: { has_more: paginas < 3 } })
      }
      return Response.json({ data: null })
    }).pedidosDesde(new Date())
    expect(paginas).toBe(3)
  })

  it('chave recusada e sem permissão viram motivo, não exceção', async () => {
    const r = await conectorOlaClick('errada', async () => new Response('', { status: 401 })).lerPedido('abc')
    expect(r).toEqual({ ok: false, motivo: 'A OlaClick recusou a chave de API.' })
    const semEscopo = await lojaDaOlaClick('chave', async () => new Response('', { status: 403 }))
    expect(semEscopo).toEqual({ ok: false, motivo: 'A chave da OlaClick precisa da permissão de ler pedidos (orders:read).' })
  })

  it('a loja conecta sem companies:read, só sem nome', async () => {
    const r = await lojaDaOlaClick('chave', async (url) =>
      String(url).includes('/company') ? new Response('', { status: 403 }) : Response.json({ data: [] }),
    )
    expect(r).toEqual({ ok: true, valor: { nome: '' } })
  })

  it('registrar o webhook apaga o anterior da mesma URL e devolve o segredo', async () => {
    const url = 'https://dialogon.com.br/api/webhook/olaclick/conta'
    const feitas: string[] = []
    const r = await registrarWebhookDaOlaClick('chave', url, 'conta', async (alvo, init) => {
      feitas.push(`${init?.method ?? 'GET'} ${String(alvo).replace(/^.*\/v1/, '')}`)
      if (init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({ webhook_url: url, merchant_id: 'conta' })
        return Response.json({ data: { webhook_id: 'novo', signing_secret: 'whsec_1' } }, { status: 201 })
      }
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      return Response.json({
        data: [
          { webhook_id: 'velho', webhook_url: url },
          { webhook_id: 'de-outro', webhook_url: 'https://pdv.exemplo.com/hook' },
        ],
      })
    })
    expect(r).toEqual({ ok: true, valor: { id: 'novo', segredo: 'whsec_1' } })
    expect(feitas).toEqual(['GET /webhooks', 'DELETE /webhooks/velho', 'POST /webhooks'])
  })
})
