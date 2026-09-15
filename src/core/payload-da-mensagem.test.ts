import { describe, expect, it } from 'vitest'
import { cartoesDoPayload, localDoPayload } from './payload-da-mensagem'

describe('a localização no payload', () => {
  it('lê nome e endereço quando a pessoa escolhe um lugar do mapa', () => {
    expect(
      localDoPayload({
        type: 'location',
        location: {
          latitude: -23.5613,
          longitude: -46.6565,
          name: 'Estúdio Pilates Vila',
          address: 'Rua Augusta, 1200 - São Paulo',
        },
      }),
    ).toEqual({
      latitude: -23.5613,
      longitude: -46.6565,
      nome: 'Estúdio Pilates Vila',
      endereco: 'Rua Augusta, 1200 - São Paulo',
    })
  })

  /* Arrastando o pino, a Meta manda só as coordenadas — e a bolha precisa aguentar. */
  it('aceita o lugar mudo, só com as coordenadas', () => {
    expect(localDoPayload({ location: { latitude: -23.5, longitude: -46.6 } })).toEqual({
      latitude: -23.5,
      longitude: -46.6,
    })
  })

  it('aceita coordenada que veio como texto, porque a Meta manda assim às vezes', () => {
    expect(localDoPayload({ location: { latitude: '-23.5', longitude: '-46.6' } })).toEqual({
      latitude: -23.5,
      longitude: -46.6,
    })
  })

  /*
   * `Number('')` é 0, e (0, 0) é um ponto de verdade no Atlântico. Um pino no
   * meio do oceano é pior que nenhum: parece informação.
   */
  it('recusa coordenada vazia em vez de plantar um pino em (0, 0)', () => {
    expect(localDoPayload({ location: { latitude: '', longitude: '' } })).toBeNull()
    expect(localDoPayload({ location: { latitude: 'aqui perto' } })).toBeNull()
  })

  it('devolve nulo para mensagem que não é lugar', () => {
    expect(localDoPayload({ type: 'text', text: { body: 'oi' } })).toBeNull()
    expect(localDoPayload(null)).toBeNull()
    expect(localDoPayload('não é objeto')).toBeNull()
  })
})

describe('os cartões de contato no payload', () => {
  it('lê nome e telefones de cada cartão', () => {
    expect(
      cartoesDoPayload({
        type: 'contacts',
        contacts: [
          {
            name: { formatted_name: 'Dra. Helena Prado' },
            phones: [{ phone: '+55 11 98888-7777', wa_id: '5511988887777' }],
          },
        ],
      }),
    ).toEqual([{ nome: 'Dra. Helena Prado', telefones: ['+55 11 98888-7777'] }])
  })

  /* O `phone` é o que a pessoa vê no celular dela, e o que quem atende vai ditar. */
  it('cai no wa_id quando não há telefone escrito', () => {
    expect(
      cartoesDoPayload({ contacts: [{ name: { formatted_name: 'Ana' }, phones: [{ wa_id: '5511999' }] }] }),
    ).toEqual([{ nome: 'Ana', telefones: ['5511999'] }])
  })

  it('aguenta cartão sem nome e cartão sem telefone', () => {
    expect(cartoesDoPayload({ contacts: [{}] })).toEqual([{ nome: 'contato', telefones: [] }])
  })

  it('lê a mensagem com vários cartões, e não só o primeiro', () => {
    const cartoes = cartoesDoPayload({
      contacts: [
        { name: { formatted_name: 'Um' }, phones: [{ phone: '1' }] },
        { name: { formatted_name: 'Dois' }, phones: [{ phone: '2' }] },
      ],
    })
    expect(cartoes.map((c) => c.nome)).toEqual(['Um', 'Dois'])
  })

  it('devolve vazio para mensagem que não tem cartão', () => {
    expect(cartoesDoPayload({ type: 'text' })).toEqual([])
    expect(cartoesDoPayload(null)).toEqual([])
  })
})
