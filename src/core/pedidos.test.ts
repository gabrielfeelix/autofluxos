import { describe, expect, it } from 'vitest'
import { avisoDoStatus, etapasDoRamo, podeMover, proximoStatus, rotuloDoStatus, temPedidos } from './pedidos'

describe('pedidos por ramo', () => {
  it('aulas não tem pedidos; sem ramo tem', () => {
    expect(temPedidos('aulas')).toBe(false)
    expect(temPedidos('restaurante')).toBe(true)
    expect(temPedidos(null)).toBe(true)
  })

  it('cada ramo chama a etapa do seu jeito', () => {
    expect(rotuloDoStatus('saiu', 'ecommerce')).toBe('Enviado')
    expect(rotuloDoStatus('em_preparo', 'restaurante')).toBe('Em preparo')
    expect(etapasDoRamo('comercio').map((e) => e.rotulo)).toEqual(['Novo', 'Pago', 'Retirado'])
  })

  it('o próximo passo segue as etapas do ramo', () => {
    expect(proximoStatus('pago', 'restaurante')).toBe('em_preparo')
    expect(proximoStatus('pago', 'comercio')).toBe('entregue')
    expect(proximoStatus('entregue', 'restaurante')).toBeNull()
    expect(proximoStatus('cancelado', 'restaurante')).toBeNull()
  })

  it('não move a partir do fim, nem para etapa que o ramo não usa', () => {
    expect(podeMover('novo', 'cancelado', 'restaurante')).toBe(true)
    expect(podeMover('entregue', 'novo', 'restaurante')).toBe(false)
    expect(podeMover('pago', 'saiu', 'comercio')).toBe(false)
  })

  it('o aviso fala de entrega ou retirada', () => {
    expect(avisoDoStatus('saiu', 7, 'restaurante', 'entrega')).toBe('Seu pedido está a caminho! O pedido #7 saiu para entrega e chega em breve.')
    expect(avisoDoStatus('saiu', 7, 'restaurante', 'retirada')).toBe('Tudo pronto! Seu pedido #7 já pode ser retirado. Estamos esperando por você.')
    expect(avisoDoStatus('pago', 7, 'restaurante', 'entrega')).toBeNull()
  })
})
