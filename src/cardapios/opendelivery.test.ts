import { beforeEach, describe, expect, it } from 'vitest'
import { conectorOpenDelivery, esquecerTokens, lojaDoOpenDelivery, statusDoOpenDelivery, traduzirPedido } from './opendelivery'

/** O pedido do exemplo da documentação da Goomer (`GET /opendelivery/v1/orders/{id}`, 27/out/2026), resumido. */
const PEDIDO = {
  id: '00cf66ff-429d-4c61-9872-0fa5f2a3b66a',
  type: 'TAKEOUT',
  items: [
    {
      id: '19277',
      name: 'Água',
      quantity: 1,
      unitPrice: { value: 1.5, currency: 'BRL' },
      totalPrice: { value: 1.5, currency: 'BRL' },
    },
  ],
  total: {
    discount: { value: 0, currency: 'BRL' },
    itemsPrice: { value: 1.5, currency: 'BRL' },
    orderAmount: { value: 1.5, currency: 'BRL' },
  },
  takeout: { mode: 'DEFAULT', takeoutDateTime: '2025-06-24T16:53:54.416Z' },
  customer: { id: '443401', name: 'gvyvyuhv buvivbivbi', email: '', phone: { number: '+5515998555464', extension: '' } },
  merchant: { id: '2241', name: 'Kaffe Cafeteria Aoba' },
  createdAt: '2025-06-24T16:53:52.922Z',
  displayId: '443401',
  lastEvent: 'DELIVERED',
  orderTiming: 'SCHEDULED',
}

const ENTREGA = {
  ...PEDIDO,
  type: 'DELIVERY',
  lastEvent: 'DISPATCHED',
  delivery: {
    deliveredBy: 'MERCHANT',
    deliveryAddress: {
      country: 'BR',
      state: 'SP',
      city: 'Sorocaba',
      district: 'Centro',
      street: 'Rua XV',
      number: '10',
      complement: 'Casa 2',
      reference: 'Esquina',
      formattedAddress: 'Rua XV, 10',
    },
  },
}

const CREDENCIAL = { base: 'https://od.exemplo.com/opendelivery', clientId: '123', clientSecret: 'segredo' }

describe('Open Delivery', () => {
  beforeEach(() => esquecerTokens())

  it('traduz o pedido da documentação', () => {
    expect(traduzirPedido(PEDIDO, 'goomer')).toEqual({
      plataforma: 'goomer',
      idExterno: PEDIDO.id,
      numeroExibido: '443401',
      status: 'entregue',
      telefone: '+5515998555464',
      nome: 'gvyvyuhv buvivbivbi',
      entrega: 'retirada',
      endereco: null,
      totalCentavos: 150,
      itens: [{ nome: 'Água', quantidade: 1, precoCentavos: 150 }],
      rastreioUrl: null,
    })
  })

  it('entrega traz endereço; mesa fica de fora e consumo no local entra', () => {
    expect(traduzirPedido(ENTREGA, 'goomer')).toMatchObject({
      entrega: 'entrega',
      status: 'saiu',
      endereco: 'Rua XV, 10, Casa 2, Centro, Sorocaba/SP (Esquina)',
    })
    expect(traduzirPedido({ ...PEDIDO, type: 'INDOOR', indoor: { mode: 'TABLE', table: '4' } }, 'goomer')).toBeNull()
    expect(traduzirPedido({ ...PEDIDO, type: 'INDOOR', indoor: { mode: 'DEFAULT' } }, 'goomer')?.entrega).toBe('local')
  })

  it('o mapa de status', () => {
    expect(statusDoOpenDelivery('CREATED', 'entrega')).toBe('novo')
    expect(statusDoOpenDelivery('CONFIRMED', 'entrega')).toBe('em_preparo')
    expect(statusDoOpenDelivery('READY_FOR_PICKUP', 'entrega')).toBe('em_preparo')
    expect(statusDoOpenDelivery('READY_FOR_PICKUP', 'retirada')).toBe('saiu')
    expect(statusDoOpenDelivery('PICKED_UP', 'entrega')).toBe('saiu')
    expect(statusDoOpenDelivery('CONCLUDED', 'entrega')).toBe('entregue')
    expect(statusDoOpenDelivery('CANCELLED', 'entrega')).toBe('cancelado')
    expect(statusDoOpenDelivery('CANCELLATION_REQUESTED', 'entrega')).toBe('novo')
  })

  it('pede o token uma vez e usa nas chamadas seguintes', async () => {
    let tokens = 0
    const falso = async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.endsWith('/oauth/token')) {
        tokens++
        expect(String(init?.body)).toContain('grant_type=client_credentials')
        return Response.json({ access_token: 'jwt', token_type: 'bearer', expires_in: 604800 })
      }
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
      if (u.endsWith('/v1/merchant')) return Response.json({ basicInfo: { name: 'Kaffe' } })
      return Response.json(PEDIDO)
    }
    expect(await lojaDoOpenDelivery(CREDENCIAL, falso)).toEqual({ ok: true, valor: { nome: 'Kaffe' } })
    await conectorOpenDelivery(CREDENCIAL, 'goomer', falso).lerPedido(PEDIDO.id)
    expect(tokens).toBe(1)
  })

  it('credencial recusada vira motivo', async () => {
    const r = await lojaDoOpenDelivery(CREDENCIAL, async () => new Response('', { status: 401 }))
    expect(r).toEqual({ ok: false, motivo: 'O Client Id ou o Client Secret foi recusado.' })
  })

  it('lê a fila, ignora evento anterior a desde e confirma em lotes', async () => {
    const confirmados: unknown[] = []
    const falso = async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.endsWith('/oauth/token')) return Response.json({ access_token: 'jwt', expires_in: 604800 })
      if (u.endsWith('/v1/events:polling')) {
        return Response.json([
          { eventId: 'e1', eventType: 'CREATED', orderId: PEDIDO.id, createdAt: new Date().toISOString() },
          { eventId: 'e2', eventType: 'DELIVERED', orderId: PEDIDO.id, createdAt: new Date().toISOString() },
          { eventId: 'e3', eventType: 'CREATED', orderId: 'antigo', createdAt: '2020-01-01T00:00:00Z' },
        ])
      }
      if (u.endsWith('/v1/events/acknowledgment')) {
        confirmados.push(...(JSON.parse(String(init?.body)) as unknown[]))
        return new Response(null, { status: 202 })
      }
      if (u.endsWith(`/v1/orders/${PEDIDO.id}`)) return Response.json(PEDIDO)
      throw new Error(`não devia buscar ${u}`)
    }
    const conector = conectorOpenDelivery(CREDENCIAL, 'goomer', falso)
    const r = await conector.pedidosDesde(new Date(Date.now() - 600_000))
    expect(r.ok && r.valor.map((p) => p.idExterno)).toEqual([PEDIDO.id])

    const eventos = await conector.lerEventos()
    expect(eventos.ok && (await conector.confirmar(eventos.valor))).toEqual({ ok: true, valor: null })
    expect(confirmados).toEqual([
      { id: 'e1', orderId: PEDIDO.id, eventType: 'CREATED' },
      { id: 'e2', orderId: PEDIDO.id, eventType: 'DELIVERED' },
      { id: 'e3', orderId: 'antigo', eventType: 'CREATED' },
    ])
  })
})
