import { describe, expect, it } from 'vitest'
import { conectorCardapioWeb, statusDoCardapioWeb, traduzirPedido } from './cardapio-web'

/** O pedido do exemplo da documentação oficial (`GET /orders/{id}`, 27/out/2026). */
const PEDIDO = {
  id: 7637461,
  display_id: 47,
  external_display_id: null,
  merchant_id: 1,
  status: 'released',
  order_type: 'delivery',
  order_timing: 'scheduled',
  sales_channel: 'portal',
  total: 181.3,
  customer: { id: 1574794, phone: '85994197929', name: 'Matheus Lessa' },
  delivery_address: {
    street: 'Av. Jovita Feitosa',
    number: '2992',
    neighborhood: 'Parquelândia',
    complement: '',
    reference: 'Teste',
    city: 'Fortaleza',
    state: 'CE',
  },
  items: [{ item_id: 208907, name: 'Hamburguer', quantity: 1, unit_price: 12.9, total_price: 28.9 }],
}

describe('Cardápio Web', () => {
  it('traduz o pedido da documentação', () => {
    expect(traduzirPedido(PEDIDO)).toEqual({
      plataforma: 'cardapio_web',
      idExterno: '7637461',
      numeroExibido: '47',
      status: 'saiu',
      telefone: '85994197929',
      nome: 'Matheus Lessa',
      entrega: 'entrega',
      endereco: 'Av. Jovita Feitosa, 2992, Parquelândia, Fortaleza/CE (Teste)',
      totalCentavos: 18130,
      itens: [{ nome: 'Hamburguer', quantidade: 1, precoCentavos: 2890 }],
      rastreioUrl: null,
    })
  })

  it('mesa e comanda ficam de fora; retirada e consumo no local entram', () => {
    expect(traduzirPedido({ ...PEDIDO, order_type: 'closed_table' })).toBeNull()
    expect(traduzirPedido({ ...PEDIDO, order_type: 'takeout' })?.entrega).toBe('retirada')
    expect(traduzirPedido({ ...PEDIDO, order_type: 'onsite' })?.entrega).toBe('local')
  })

  it('pedido de marketplace usa o número de lá e pedido sem cliente não quebra', () => {
    const r = traduzirPedido({ ...PEDIDO, external_display_id: '8A3F', customer: null, delivery_address: null })
    expect(r?.numeroExibido).toBe('8A3F')
    expect(r?.telefone).toBeNull()
    expect(r?.endereco).toBeNull()
  })

  it('o mapa de status', () => {
    expect(statusDoCardapioWeb('waiting_confirmation')).toBe('novo')
    expect(statusDoCardapioWeb('confirmed')).toBe('em_preparo')
    expect(statusDoCardapioWeb('ready')).toBe('em_preparo')
    expect(statusDoCardapioWeb('waiting_to_catch')).toBe('saiu')
    expect(statusDoCardapioWeb('closed')).toBe('entregue')
    expect(statusDoCardapioWeb('canceled')).toBe('cancelado')
    expect(statusDoCardapioWeb('algo_novo')).toBe('novo')
  })

  it('a passada lê os resumidos e busca cada pedido completo', async () => {
    const chamadas: string[] = []
    const falso = async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      chamadas.push(u)
      expect(new Headers(init?.headers).get('X-API-KEY')).toBe('chave')
      if (u.includes('/orders?')) return Response.json([{ id: 7637461 }, { id: 9 }])
      if (u.endsWith('/orders/7637461')) return Response.json(PEDIDO)
      return Response.json({ ...PEDIDO, id: 9, order_type: 'closed_table' })
    }
    const desde = new Date(Date.now() - 3_600_000)
    const r = await conectorCardapioWeb('chave', falso).pedidosDesde(desde)
    expect(r.ok && r.valor.map((p) => p.idExterno)).toEqual(['7637461'])
    expect(chamadas[0]).toContain(`updated_since=${encodeURIComponent(desde.toISOString())}`)
  })

  it('a passada nunca pede mais de 24 horas para trás', async () => {
    const chamadas: string[] = []
    await conectorCardapioWeb('chave', async (url) => {
      chamadas.push(String(url))
      return Response.json([])
    }).pedidosDesde(new Date('2020-01-01T00:00:00Z'))
    const pedido = new Date(decodeURIComponent(chamadas[0]!.split('updated_since=')[1]!))
    expect(Date.now() - pedido.getTime()).toBeLessThan(24 * 3_600_000)
  })

  it('chave recusada vira motivo, não exceção', async () => {
    const r = await conectorCardapioWeb('errada', async () => new Response('', { status: 401 })).lerPedido('1')
    expect(r).toEqual({ ok: false, motivo: 'O Cardápio Web recusou a chave de API.' })
  })
})
