import { beforeEach, describe, expect, it } from 'vitest'
import { conectorDeliveryDireto, esquecerTokensDoDeliveryDireto, statusDoDeliveryDireto, traduzirPedido } from './delivery-direto'

/** Um pedido nos campos do schema oficial (`openapi.yaml` da Admin API, 27/out/2026); valores nossos. */
const PEDIDO = {
  id: 98765,
  orderNumber: 1234,
  sequentialId: 12,
  status: 'IN_TRANSIT',
  type: 'DELIVERY',
  isCanceled: false,
  modified: new Date().toISOString(),
  customer: { id: 1, firstName: 'Ana', lastName: 'Souza', telephone: '44999998888' },
  address: { street: 'Rua das Flores', number: '100', complement: 'Ap 2', neighborhood: 'Centro', city: 'Maringá', state: 'PR', reference_point: 'Esquina' },
  total: { total: { value: 4590, currency: 'BRL' }, subtotal: { value: 3990, currency: 'BRL' } },
  items: [{ id: 1, name: 'X-Burguer', amount: 2, price: { value: 1995, currency: 'BRL' }, totalPrice: { value: 3990, currency: 'BRL' } }],
}

const CREDENCIAL = { loja: '777', usuario: 'api@loja', senha: 's', clientId: 'cid', clientSecret: 'cs' }

describe('Delivery Direto', () => {
  beforeEach(() => esquecerTokensDoDeliveryDireto())

  it('traduz o pedido, com valores já em centavos', () => {
    expect(traduzirPedido(PEDIDO)).toEqual({
      plataforma: 'delivery_direto',
      idExterno: '98765',
      numeroExibido: '1234',
      status: 'saiu',
      telefone: '44999998888',
      nome: 'Ana Souza',
      entrega: 'entrega',
      endereco: 'Rua das Flores, 100, Ap 2, Centro, Maringá/PR (Esquina)',
      totalCentavos: 4590,
      itens: [{ nome: 'X-Burguer', quantidade: 2, precoCentavos: 3990 }],
      rastreioUrl: null,
    })
  })

  it('mesa fica de fora; balcão é local; por telefone depende do endereço; cancelado vence o status', () => {
    expect(traduzirPedido({ ...PEDIDO, type: 'TABLE' })).toBeNull()
    expect(traduzirPedido({ ...PEDIDO, type: 'DESK' })?.entrega).toBe('local')
    expect(traduzirPedido({ ...PEDIDO, type: 'BY_PHONE' })?.entrega).toBe('entrega')
    expect(traduzirPedido({ ...PEDIDO, type: 'BY_PHONE', address: null })?.entrega).toBe('retirada')
    expect(traduzirPedido({ ...PEDIDO, isCanceled: true })?.status).toBe('cancelado')
  })

  it('o mapa de status', () => {
    expect(statusDoDeliveryDireto('WAITING')).toBe('novo')
    expect(statusDoDeliveryDireto('APPROVED')).toBe('em_preparo')
    expect(statusDoDeliveryDireto('DONE')).toBe('entregue')
    expect(statusDoDeliveryDireto('REJECTED')).toBe('cancelado')
    expect(statusDoDeliveryDireto('HIDDEN')).toBe('novo')
    expect(statusDoDeliveryDireto('WARNING')).toBe('novo')
  })

  it('pede o token por senha com os cabeçalhos da loja e do integrador, e filtra por modificação', async () => {
    const desde = new Date(Date.now() - 600_000)
    const urls: string[] = []
    const r = await conectorDeliveryDireto(CREDENCIAL, async (alvo, init) => {
      const u = String(alvo)
      urls.push(u)
      const h = new Headers(init?.headers)
      expect(h.get('X-DeliveryDireto-ID')).toBe('777')
      expect(h.get('X-DeliveryDireto-Client-Id')).toBe('cid')
      if (u.endsWith('/admin-api/token')) {
        expect(String(init?.body)).toContain('grant_type=password')
        return Response.json({ access_token: 'tk', token_type: 'bearer', expires_in: 21600, refresh_token: 'r' })
      }
      expect(h.get('Authorization')).toBe('Bearer tk')
      return Response.json({
        status: 'success',
        data: { orders: [PEDIDO, { ...PEDIDO, id: 1, modified: new Date(desde.getTime() - 60_000).toISOString() }] },
      })
    }).pedidosDesde(desde)
    expect(r.ok && r.valor.map((p) => p.idExterno)).toEqual(['98765'])
    expect(urls[1]).toContain('lastModifiedStart=')
    expect(urls[1]).toContain('includeCanceledOrders=true')
  })

  it('credencial recusada vira motivo', async () => {
    const r = await conectorDeliveryDireto(CREDENCIAL, async () => new Response('', { status: 401 })).lerPedido('1')
    expect(r).toEqual({ ok: false, motivo: 'O Delivery Direto recusou o ID da loja, o usuário ou a senha.' })
  })
})
