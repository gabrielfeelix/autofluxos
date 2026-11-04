import { describe, expect, it } from 'vitest'
import {
  fotoDoProduto,
  horasAtras,
  lerLembrete,
  LEMBRETE_PADRAO,
  modeloDoLembrete,
  modelosDoLembrete,
  nomeCurto,
  primeiroNome,
  validarLembrete,
} from './lembrete-de-pagamento'
import { validarTemplate, temErro } from './templates'

describe('lembrete de pagamento', () => {
  it('corta o nome do produto na palavra', () => {
    expect(nomeCurto('Cadeira Ergonômica de Massagem Sublime Backrobo Branca com Aquecimento e App PCYes')).toBe(
      'Cadeira Ergonômica de Massagem Sublime Backrobo',
    )
    expect(nomeCurto('Monitor Gamer 27"')).toBe('Monitor Gamer 27"')
  })

  it('primeiro nome com inicial maiúscula', () => {
    expect(primeiroNome('weliton barboza')).toBe('Weliton')
    expect(primeiroNome('MOISES')).toBe('Moises')
    expect(primeiroNome('  ')).toBe('')
  })

  it('foto: URL do CDN como veio, caminho da Magento vira endereço da mídia', () => {
    expect(fotoDoProduto('https://loja.com.br/', 'https://cdn.x.com/a')).toBe('https://cdn.x.com/a')
    expect(fotoDoProduto('https://loja.com.br', '/m/o/monitor.jpg')).toBe('https://loja.com.br/media/catalog/product/m/o/monitor.jpg')
    expect(fotoDoProduto('https://loja.com.br', 'http://inseguro/a')).toBeNull()
  })

  it('instante no formato da Magento', () => {
    expect(horasAtras(new Date('2026-11-04T12:00:00Z'), 2)).toBe('2026-11-04 10:00:00')
  })

  it('config inválida vira o padrão desligado; cupom exige desconto', () => {
    expect(lerLembrete({ ativo: 'sim' })).toEqual(LEMBRETE_PADRAO)
    expect(validarLembrete({ ...LEMBRETE_PADRAO, esperaHoras: 3 }).ok).toBe(false)
    expect(validarLembrete({ ...LEMBRETE_PADRAO, cupom: 'CHAT10', desconto: null }).ok).toBe(false)
    expect(validarLembrete({ ...LEMBRETE_PADRAO, cupom: 'CHAT10', desconto: '10% de desconto' }).ok).toBe(true)
    expect(modeloDoLembrete({ cupom: 'CHAT10' })).toBe('pagamento_pendente_cupom')
    expect(modeloDoLembrete({ cupom: null })).toBe('pagamento_pendente')
  })

  it('os dois modelos passam na validação da Meta', () => {
    for (const m of modelosDoLembrete({ endereco: 'https://loja.com.br/', foto: 'https://x/a.jpg' })) {
      expect(temErro(validarTemplate(m.nome, m.componentes, m.categoria))).toBe(false)
    }
  })
})
