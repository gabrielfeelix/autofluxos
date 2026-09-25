import { describe, expect, it, vi } from 'vitest'
import { consultarPedido, mesmoTelefone } from './magento-pedido'

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
