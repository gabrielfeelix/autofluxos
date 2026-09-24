import { describe, expect, it } from 'vitest'
import { abaDaFicha, voltaDaFicha } from './volta-da-ficha'

const C = '11111111-1111-1111-1111-111111111111'

describe('voltaDaFicha', () => {
  it('aceita endereço desta conta e dá o nome da seção', () => {
    expect(voltaDaFicha(`/clientes/${C}/inbox?conversa=abc`, C)).toEqual({
      href: `/clientes/${C}/inbox?conversa=abc`,
      rotulo: 'Inbox',
    })
    expect(voltaDaFicha(`/clientes/${C}/atividades?recorte=hoje`, C).rotulo).toBe('Atividades')
    expect(voltaDaFicha(`/clientes/${C}`, C).rotulo).toBe('Início')
  })

  it('recusa site de fora, outra conta e truques de barra', () => {
    const padrao = { href: `/clientes/${C}/leads`, rotulo: 'Contatos' }
    expect(voltaDaFicha('https://outro.site', C)).toEqual(padrao)
    expect(voltaDaFicha('//outro.site', C)).toEqual(padrao)
    expect(voltaDaFicha('/clientes/outra-conta/inbox', C)).toEqual(padrao)
    expect(voltaDaFicha(`/clientes/${C}evil/inbox`, C)).toEqual(padrao)
    expect(voltaDaFicha(`/clientes/${C}/\\outro.site`, C)).toEqual(padrao)
    expect(voltaDaFicha(`/clientes/${C}//outro.site`, C)).toEqual(padrao)
    expect(voltaDaFicha(undefined, C)).toEqual(padrao)
    expect(voltaDaFicha(['a'], C)).toEqual(padrao)
  })
})

describe('abaDaFicha', () => {
  it('aceita as cinco e cai na visão geral no resto', () => {
    expect(abaDaFicha('historico')).toBe('historico')
    expect(abaDaFicha('conversa')).toBe('conversa')
    expect(abaDaFicha('qualquer')).toBe('visao')
    expect(abaDaFicha(undefined)).toBe('visao')
  })
})
