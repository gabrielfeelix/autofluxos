import { describe, expect, it } from 'vitest'
import { conectorFoody, statusDaFoody, testarTokenDaFoody, traduzirPedido } from './foody'

/** O pedido do exemplo da documentação da Foody (`GET /rest/1.2/orders/{uid}`, 27/out/2026). */
const PEDIDO = {
  uid: '0afa5b6c-135f-4e9a-9d00-5ff64c97d30a',
  id: '301',
  status: 'onGoing',
  deliveryFee: 5,
  paymentMethod: 'money',
  notes: 'semcebola',
  orderTotal: 84,
  orderDetails: '1xpizzadecalabresa',
  orderTrackerUrl: 'https://app.foodydelivery.com/trk/58f37fe7-ddaf-46db-8918-e34d0b920062',
  deliveryPoint: {
    address: 'RuaJoséNeves,590',
    street: 'RuaJoséNeves',
    houseNumber: '590',
    postalCode: '04650-140',
    city: 'SãoPaulo',
    region: 'SP',
    country: 'BRA',
    complement: 'sala03',
  },
  customer: { customerPhone: '+5511987521144', customerName: 'JosédaSilva', customerEmail: 'nome@empresa.com' },
  courier: { courierPhone: '+5511999999993', courierName: 'MariaHelena', courierType: 'internal' },
  date: '2020-06-18T14:13:27-03:00',
  updateDate: '2020-06-18T14:13:53-03:00',
}

describe('Foody', () => {
  it('traduz o pedido da documentação, com o link de rastreio', () => {
    expect(traduzirPedido(PEDIDO)).toEqual({
      plataforma: 'foody',
      idExterno: PEDIDO.uid,
      numeroExibido: '301',
      status: 'saiu',
      telefone: '+5511987521144',
      nome: 'JosédaSilva',
      entrega: 'entrega',
      endereco: 'RuaJoséNeves, 590, sala03, SãoPaulo/SP',
      totalCentavos: 8400,
      itens: [{ nome: '1xpizzadecalabresa', quantidade: 1, precoCentavos: 0 }],
      rastreioUrl: 'https://app.foodydelivery.com/trk/58f37fe7-ddaf-46db-8918-e34d0b920062',
    })
  })

  it('o mapa de status: entregador designado ainda não saiu', () => {
    expect(statusDaFoody('open')).toBe('novo')
    expect(statusDaFoody('ready')).toBe('em_preparo')
    expect(statusDaFoody('dispatched')).toBe('em_preparo')
    expect(statusDaFoody('accepted')).toBe('em_preparo')
    expect(statusDaFoody('onGoing')).toBe('saiu')
    expect(statusDaFoody('closed')).toBe('entregue')
    expect(statusDaFoody('cancelled')).toBe('cancelado')
    expect(statusDaFoody('rejected')).toBe('novo')
  })

  it('a passada fica só com o que mudou depois de desde, e manda o token sem prefixo', async () => {
    const desde = new Date(Date.now() - 600_000)
    let url = ''
    const r = await conectorFoody('tok', async (alvo, init) => {
      url = String(alvo)
      expect(new Headers(init?.headers).get('Authorization')).toBe('tok')
      return Response.json([
        { ...PEDIDO, updateDate: new Date().toISOString() },
        { ...PEDIDO, uid: 'velho', updateDate: new Date(desde.getTime() - 60_000).toISOString() },
      ])
    }).pedidosDesde(desde)
    expect(r.ok && r.valor.map((p) => p.idExterno)).toEqual([PEDIDO.uid])
    expect(decodeURIComponent(url)).toMatch(/startDate=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d-03:00&endDate=/)
  })

  it('token recusado e plano gratuito viram motivo', async () => {
    expect(await testarTokenDaFoody('x', async () => new Response('', { status: 401 }))).toEqual({
      ok: false,
      motivo: 'A Foody recusou o token.',
    })
    const gratis = await testarTokenDaFoody('x', async () => new Response('', { status: 403 }))
    expect(gratis.ok).toBe(false)
  })
})
