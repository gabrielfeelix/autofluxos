import { describe, expect, it } from 'vitest'
import { pendenciasDoInicio, type EntradaDasPendencias } from './pendencias-do-inicio'

const AGORA = Date.parse('2026-09-23T15:00:00Z')

const base: EntradaDasPendencias = {
  conversas: { pedindoPessoa: 0, esperando: 0 },
  agenda: { vencidas: 0, hoje: 0 },
  agendaDaEquipe: true,
  canais: [],
  agora: AGORA,
}

const whatsapp = {
  provider: 'cloud-api',
  displayPhoneNumber: '+55 44 99877-5978',
  igUsername: null,
  tokenExpiraEm: null,
  desembarcadoEm: null,
}

describe('pendenciasDoInicio', () => {
  it('tudo zero dá lista vazia (e só aí a tela diz "Ninguém esperando")', () => {
    expect(pendenciasDoInicio(base)).toEqual([])
  })

  it('atividades vencidas contam mesmo sem conversa esperando (N04)', () => {
    const lista = pendenciasDoInicio({ ...base, agenda: { vencidas: 67, hoje: 3 } })
    expect(lista.map((p) => p.texto)).toEqual(['67 atividades vencidas', '3 atividades para hoje'])
    expect(lista[0]?.href).toBe('/atividades?recorte=vencidas&alcance=equipe')
  })

  it('sem agenda da equipe, o link abre só as minhas', () => {
    const lista = pendenciasDoInicio({ ...base, agendaDaEquipe: false, agenda: { vencidas: 1, hoje: 0 } })
    expect(lista[0]).toMatchObject({ texto: '1 atividade vencida', href: '/atividades?recorte=vencidas' })
  })

  it('ordem: falha, pediu pessoa, esperando, vencidas, hoje', () => {
    const lista = pendenciasDoInicio({
      ...base,
      conversas: { pedindoPessoa: 1, esperando: 2 },
      agenda: { vencidas: 1, hoje: 1 },
      canais: [{ ...whatsapp, desembarcadoEm: '2026-09-22T10:00:00Z' }],
    })
    expect(lista.map((p) => p.chave)).toEqual([
      'whatsapp-+55 44 99877-5978',
      'pediram-pessoa',
      'esperando',
      'vencidas',
      'hoje',
    ])
    expect(lista[1]?.texto).toBe('1 conversa pediu uma pessoa')
    expect(lista[2]?.texto).toBe('2 conversas esperando resposta')
  })

  it('canal quieto não é falha; só desembarque e token vencido', () => {
    expect(pendenciasDoInicio({ ...base, canais: [whatsapp] })).toEqual([])

    const instagram = { ...whatsapp, provider: 'instagram', displayPhoneNumber: null, igUsername: 'studio' }
    expect(pendenciasDoInicio({ ...base, canais: [{ ...instagram, tokenExpiraEm: '2026-10-01T00:00:00Z' }] })).toEqual([])
    expect(pendenciasDoInicio({ ...base, canais: [{ ...instagram, tokenExpiraEm: null }] })).toEqual([])

    const [vencido] = pendenciasDoInicio({ ...base, canais: [{ ...instagram, tokenExpiraEm: '2026-09-20T00:00:00Z' }] })
    expect(vencido).toMatchObject({ tom: 'falha', href: '/ajustes/instagram' })
    expect(vencido?.texto).toContain('@studio')
  })

  it('quem não atende, não tem agenda ou não configura não recebe aquela parte', () => {
    const lista = pendenciasDoInicio({
      ...base,
      conversas: null,
      agenda: null,
      canais: null,
    })
    expect(lista).toEqual([])
  })
})
