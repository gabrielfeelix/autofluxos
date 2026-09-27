import { describe, expect, it } from 'vitest'
import { montarCobranca, type RegrasDaCobranca } from './cobranca'

const catalogo = [
  { nome: 'Pizza Calabresa', preco: 52.9 },
  { nome: 'Pizza Mussarela', preco: 49.9 },
  { nome: 'Pizza Portuguesa', preco: 58.9 },
  { nome: 'Refrigerante 2 L', preco: 14 },
  { nome: 'Refrigerante lata', preco: 6 },
  { nome: 'Sem preço', preco: null },
]
const regras: RegrasDaCobranca = {
  taxaEntrega: 6,
  ajustes: [
    { nome: 'Broto', valor: -18 },
    { nome: 'Média', valor: -8 },
    { nome: 'Borda recheada', valor: 8 },
  ],
}
const montar = (itens: string, entrega = 'entrega', pagamento = 'pix') =>
  montarCobranca({ itens, entrega, pagamento, catalogo, regras })

describe('cobrança conferida', () => {
  it('soma pelo catálogo, com ajuste e taxa, em centavos', () => {
    const r = montar('2 x Pizza Calabresa (Média); 1 x Refrigerante 2 L')
    expect(r.ok && r.cobranca.total).toBe('109,80')
    expect(r.ok && r.cobranca.resumo).toContain('• 2x Pizza Calabresa (Média): R$ 89,80')
    expect(r.ok && r.cobranca.resumo).toContain('Entrega: R$ 6,00')
    expect(r.ok && r.cobranca.resumo).toContain('*Total: R$ 109,80*')
  })

  it('meio a meio cobra o sabor mais caro; borda soma', () => {
    const r = montar('1x Calabresa / Portuguesa (Borda recheada de catupiry)', 'retirada')
    expect(r.ok && r.cobranca.total).toBe('66,90')
    expect(r.ok && r.cobranca.resumo).toContain('Retirada: sem taxa')
  })

  it('variação que não é ajuste do dono vira observação, sem mudar preço', () => {
    const r = montar('1 x Pizza Mussarela (sem cebola)', 'retirada')
    expect(r.ok && r.cobranca.total).toBe('49,90')
  })

  it('recusa item fora do catálogo, ambíguo ou sem preço, com o motivo', () => {
    expect(montar('1 x Pizza de Sushi')).toEqual({ ok: false, erro: expect.stringContaining('não está no catálogo') })
    expect(montar('1 x Refrigerante')).toEqual({ ok: false, erro: expect.stringContaining('mais de um item') })
    expect(montar('1 x Sem preço')).toEqual({ ok: false, erro: expect.stringContaining('sem preço') })
  })

  it('recusa quantidade absurda, formato torto, pagamento e entrega que não existem', () => {
    expect(montar('999 x Pizza Calabresa').ok).toBe(false)
    expect(montar('Pizza Calabresa').ok).toBe(false)
    expect(montar('1 x Pizza Calabresa', 'entrega', 'boleto').ok).toBe(false)
    expect(montar('1 x Pizza Calabresa', 'drone').ok).toBe(false)
  })

  it('aceita as formas de pagamento escritas de outro jeito', () => {
    const r = montar('1 x Pizza Calabresa', 'Retirada', 'na hora')
    expect(r.ok && r.cobranca.pagamento).toBe('na_hora')
    expect(r.ok && r.cobranca.entrega).toBe('retirada')
  })
  it('serviço no local: sem linha de entrega, título curto', () => {
    const r = montar('1 x Pizza Mussarela', 'local', 'cartao')
    expect(r.ok && r.cobranca.total).toBe('49,90')
    expect(r.ok && r.cobranca.resumo.startsWith('*Resumo*\n')).toBe(true)
    expect(r.ok && r.cobranca.resumo).not.toContain('Retirada')
    expect(r.ok && r.cobranca.entrega).toBe('local')
  })
})
