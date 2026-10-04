import { describe, expect, it, vi } from 'vitest'
import { consultarPedido, listarPedidosDaPessoa, mesmoTelefone, pedidoEntregue } from './magento-pedido'

/**
 * A consulta de pedido só pode mostrar o pedido para quem comprou. O resto é
 * formatação; a trava é o que estes testes cobram.
 */

const pedido = {
  entity_id: 77,
  increment_id: '000000123',
  status: 'processing',
  created_at: '2026-09-20 14:03:11',
  grand_total: 349.9,
  order_currency_code: 'BRL',
  customer_taxvat: '123.456.789-09',
  billing_address: { telephone: '(44) 9 9877-5978' },
  items: [
    { name: 'Headset Gamer', qty_ordered: 1, parent_item_id: null },
    { name: 'Headset Gamer Preto', qty_ordered: 1, parent_item_id: 5 },
  ],
}

function lojaCom(pedidos: unknown[], envios: unknown[] = []) {
  return vi.fn(async (acao: { url: string }) =>
    acao.url.includes('/V1/orders')
      ? { ok: true as const, json: { items: pedidos } }
      : { ok: true as const, json: { items: envios } },
  )
}

const dados = { endereco: 'https://loja.test', credencial: { tipo: 'bearer', valor: 't' } as never }

describe('consultarPedido', () => {
  it('mostra o pedido quando o telefone da conversa é o da compra, sem o nono dígito', async () => {
    const chamar = lojaCom([pedido], [{ tracks: [{ title: 'Correios', track_number: 'BR123' }] }])
    const r = await consultarPedido(dados, { numero: '#000000123', telefone: '554498775978' }, chamar as never)
    expect(r).toEqual({
      ok: true,
      valor: {
        encontrado: true,
        pedido: {
          numero: '000000123',
          situacao: 'Pagamento aprovado, em separação',
          situacaoCodigo: 'processing',
          feitoEm: '2026-09-20',
          total: expect.stringContaining('349,90'),
          itens: [{ nome: 'Headset Gamer', quantidade: 1 }],
          rastreios: [{ transportadora: 'Correios', codigo: 'BR123' }],
        },
      },
    })
  })

  it('esconde o pedido de outro telefone, com a mesma resposta de "não achei"', async () => {
    const chamar = lojaCom([pedido])
    const r = await consultarPedido(dados, { numero: '000000123', telefone: '5511911001414' }, chamar as never)
    expect(r).toEqual({ ok: true, valor: { encontrado: false, motivo: 'nao_achei_ou_nao_confere' } })
    // Sem conferir, nem o envio é consultado.
    expect(chamar).toHaveBeenCalledTimes(1)
  })

  it('libera pelo CPF da compra quando o telefone é outro', async () => {
    const chamar = lojaCom([pedido])
    const r = await consultarPedido(
      dados,
      { numero: '000000123', telefone: '5511911001414', documento: '12345678909' },
      chamar as never,
    )
    expect(r.ok && r.valor.encontrado).toBe(true)
  })

  it('não aceita documento curto como CPF', async () => {
    const chamar = lojaCom([{ ...pedido, customer_taxvat: '09' }])
    const r = await consultarPedido(
      dados,
      { numero: '000000123', telefone: '5511911001414', documento: '09' },
      chamar as never,
    )
    expect(r.ok && r.valor.encontrado).toBe(false)
  })

  it('só consulta, nunca escreve na loja', async () => {
    const chamar = lojaCom([pedido])
    await consultarPedido(dados, { numero: '000000123', telefone: '554498775978' }, chamar as never)
    for (const [acao] of chamar.mock.calls as unknown as [{ metodo: string }][]) expect(acao.metodo).toBe('GET')
  })
})

describe('mesmoTelefone', () => {
  it('recusa número curto demais para identificar alguém', () => {
    expect(mesmoTelefone('5978', '554498775978')).toBe(false)
  })
})

describe('consultarPedido só com o CPF', () => {
  it('busca pelo documento, com e sem máscara, e mostra o pedido do mesmo telefone', async () => {
    const chamar = lojaCom([pedido])
    const r = await consultarPedido(dados, { numero: '', telefone: '554498775978', documento: '123.456.789-09' }, chamar as never)
    expect(r.ok && r.valor.encontrado).toBe(true)
    const url = decodeURIComponent((chamar.mock.calls[0] as unknown as [{ url: string }])[0].url)
    expect(url).toContain('[field]=customer_taxvat')
    expect(url).toContain('[value]=12345678909')
    expect(url).toContain('[value]=123.456.789-09')
  })

  it('CPF certo com telefone de outra pessoa não mostra nada', async () => {
    const chamar = lojaCom([pedido])
    const r = await consultarPedido(dados, { numero: '', telefone: '5511911001414', documento: '12345678909' }, chamar as never)
    expect(r).toEqual({ ok: true, valor: { encontrado: false, motivo: 'nao_achei_ou_nao_confere' } })
  })

  // PCYES, 02/out/2026: o CPF veio no campo do número e a busca parou ali.
  it('CPF passado como número: o número não acha, e a busca vai pelo documento', async () => {
    const chamar = vi.fn(async (acao: { url: string }) =>
      decodeURIComponent(acao.url).includes('[field]=increment_id')
        ? { ok: true as const, json: { items: [] } }
        : { ok: true as const, json: { items: [pedido] } },
    )
    const r = await consultarPedido(dados, { numero: '12345678909', telefone: '554498775978' }, chamar as never)
    expect(r.ok && r.valor.encontrado).toBe(true)
    const porDocumento = decodeURIComponent((chamar.mock.calls[1] as unknown as [{ url: string }])[0].url)
    expect(porDocumento).toContain('[field]=customer_taxvat')
  })

  it('CPF passado como número, com telefone de outra pessoa, não mostra nada', async () => {
    const chamar = vi.fn(async (acao: { url: string }) =>
      decodeURIComponent(acao.url).includes('[field]=increment_id')
        ? { ok: true as const, json: { items: [] } }
        : { ok: true as const, json: { items: [pedido] } },
    )
    const r = await consultarPedido(dados, { numero: '123.456.789-09', telefone: '5511911001414' }, chamar as never)
    expect(r).toEqual({ ok: true, valor: { encontrado: false, motivo: 'nao_achei_ou_nao_confere' } })
  })

  it('sem número e sem documento válido nem consulta a loja', async () => {
    const chamar = lojaCom([pedido])
    const r = await consultarPedido(dados, { numero: '', telefone: '554498775978', documento: '123' }, chamar as never)
    expect(r.ok && r.valor.encontrado).toBe(false)
    expect(chamar).not.toHaveBeenCalled()
  })
})

describe('listarPedidosDaPessoa', () => {
  it('busca por CPF (com e sem máscara) e e-mail num grupo só e marca o telefone que confere', async () => {
    const chamar = lojaCom([pedido, { ...pedido, increment_id: '000000124', billing_address: { telephone: '11 90000-0000' } }])
    const r = await listarPedidosDaPessoa(
      dados,
      { telefone: '554498775978', documento: '12345678909', email: 'Ana@Loja.com ' },
      chamar as never,
    )
    const url = decodeURIComponent((chamar.mock.calls.at(-1)![0] as { url: string }).url)
    expect(url).toContain('[0][field]=customer_taxvat&searchCriteria[filterGroups][0][filters][0][value]=12345678909')
    expect(url).toContain('[value]=123.456.789-09')
    expect(url).toContain('[2][field]=customer_email&searchCriteria[filterGroups][0][filters][2][value]=ana@loja.com')
    expect(r).toEqual({
      ok: true,
      valor: [
        { numero: '000000123', situacao: 'Pagamento aprovado, em separação', feitoEm: '2026-09-20', total: expect.any(String), confere: true, entregue: false },
        { numero: '000000124', situacao: 'Pagamento aprovado, em separação', feitoEm: '2026-09-20', total: expect.any(String), confere: false, entregue: false },
      ],
    })
  })

  // Dono, 02/out/2026: a ficha quase nunca tem CPF na primeira conversa.
  it('sem CPF nem e-mail na ficha, acha pelo telefone via cadastro da loja', async () => {
    const chamar = vi.fn(async (acao: { url: string }) =>
      acao.url.includes('/V1/customers/search')
        ? { ok: true as const, json: { items: [{ email: 'ana@loja.com', taxvat: '123.456.789-09' }] } }
        : { ok: true as const, json: { items: [{ ...pedido, status: 'delivered', status_label: 'Entregue' }] } },
    )
    const r = await listarPedidosDaPessoa(dados, { telefone: '5544998775978' }, chamar as never)

    const urls = chamar.mock.calls.map(([a]) => decodeURIComponent(a.url))
    const cliente = urls.find((u) => u.includes('/V1/customers/search'))!
    expect(cliente).toContain('[field]=billing_telephone')
    expect(cliente).toContain('[value]=%9877%5978&')
    expect(cliente).toContain('[conditionType]=like')
    const pedidos = urls.at(-1)!
    expect(pedidos).toContain('=ana@loja.com')
    expect(pedidos).toContain('=12345678909')
    expect(r.ok && r.valor[0]?.entregue).toBe(true)
  })

  // 02/out/2026: o #1975 do Ale não vinha pelo cadastro (convidado ou token
  // sem clientes). Os pedidos recentes com o telefone dele vêm.
  it('sem cadastro e sem ficha, acha nos pedidos recentes pelo telefone', async () => {
    const outro = { ...pedido, increment_id: '000000999', billing_address: { telephone: '11 90000-0000' } }
    const chamar = vi.fn(async (acao: { url: string }) =>
      acao.url.includes('/V1/customers/search')
        ? { ok: false as const, motivo: 'a loja respondeu 403' }
        : { ok: true as const, json: { items: [outro, pedido] } },
    )
    const r = await listarPedidosDaPessoa(dados, { telefone: '554498775978' }, chamar as never)

    expect(r.ok && r.valor.map((p) => p.numero)).toEqual(['000000123'])
    const varredura = decodeURIComponent(chamar.mock.calls.find(([a]) => a.url.includes('/V1/orders'))![0].url)
    expect(varredura).toContain('pageSize]=300')
    expect(varredura).toContain('fields=items[')
  })

  it('entregue à transportadora não conta como entregue', () => {
    expect(pedidoEntregue('delivered_carrier', 'Entregue à transportadora')).toBe(false)
    expect(pedidoEntregue('entregue', '')).toBe(true)
    expect(pedidoEntregue('complete', 'Pedido entregue')).toBe(true)
  })
})
