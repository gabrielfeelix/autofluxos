import { describe, expect, it } from 'vitest'
import {
  conferirTitulo,
  ehDestinoAoFechar,
  ehTipoDeAtividade,
  proximaAcao,
  urgenciaDe,
  type Atividade,
} from './atividades'

function atividade(parcial: Partial<Atividade> = {}): Atividade {
  return {
    id: 'a1',
    contatoId: 'c1',
    cartaoId: null,
    tipo: 'tarefa',
    titulo: 'Ligar para a Ana',
    nota: null,
    prazo: null,
    responsavelId: null,
    responsavelNome: null,
    situacao: 'aberta',
    concluidaEm: null,
    motivoDoCancelamento: null,
    criadoEm: '2026-09-01T10:00:00Z',
    ...parcial,
  }
}

const HOJE = Date.parse('2026-09-20T15:00:00Z')

describe('urgenciaDe', () => {
  it('sem prazo NÃO é vencida', () => {
    // O erro fácil: tratar null como "vencida desde sempre" encheria a agenda
    // de vermelho no primeiro dia e ensinaria todo mundo a ignorá-lo.
    expect(urgenciaDe(atividade({ prazo: null }), HOJE)).toBe('sem-prazo')
  })

  it('ontem é vencida, hoje é hoje, amanhã é futura', () => {
    expect(urgenciaDe(atividade({ prazo: '2026-09-19T23:00:00Z' }), HOJE)).toBe('vencida')
    expect(urgenciaDe(atividade({ prazo: '2026-09-20T09:00:00Z' }), HOJE)).toBe('hoje')
    expect(urgenciaDe(atividade({ prazo: '2026-09-21T01:00:00Z' }), HOJE)).toBe('futura')
  })

  it('hoje de manhã não fica vencida à tarde', () => {
    // A comparação é por dia. Quem marcou para hoje quis dizer hoje, e não
    // "até as 9h de hoje".
    expect(urgenciaDe(atividade({ prazo: '2026-09-20T09:00:00Z' }), HOJE)).toBe('hoje')
  })

  it('concluída e cancelada saem da urgência mesmo com prazo velho', () => {
    const velho = '2026-01-01T00:00:00Z'
    expect(urgenciaDe(atividade({ prazo: velho, situacao: 'concluida' }), HOJE)).not.toBe('vencida')
    expect(urgenciaDe(atividade({ prazo: velho, situacao: 'cancelada' }), HOJE)).not.toBe('vencida')
  })

  it('prazo ilegível não vira vencida', () => {
    expect(urgenciaDe(atividade({ prazo: 'ontem' }), HOJE)).toBe('sem-prazo')
  })
})

describe('proximaAcao', () => {
  it('a mais cedo com prazo ganha', () => {
    const lista = [
      atividade({ id: 'depois', prazo: '2026-09-25T10:00:00Z' }),
      atividade({ id: 'antes', prazo: '2026-09-21T10:00:00Z' }),
    ]
    expect(proximaAcao(lista)?.id).toBe('antes')
  })

  it('sem prazo perde para com prazo', () => {
    // "Algum dia" aparecendo como próxima ação esconderia a reunião de amanhã.
    const lista = [
      atividade({ id: 'algum-dia', prazo: null }),
      atividade({ id: 'amanha', prazo: '2026-09-21T10:00:00Z' }),
    ]
    expect(proximaAcao(lista)?.id).toBe('amanha')
  })

  it('concluída não é próxima ação', () => {
    const lista = [
      atividade({ id: 'feita', prazo: '2026-09-21T10:00:00Z', situacao: 'concluida' }),
      atividade({ id: 'aberta', prazo: '2026-09-25T10:00:00Z' }),
    ]
    expect(proximaAcao(lista)?.id).toBe('aberta')
  })

  it('só concluídas devolve nada', () => {
    expect(proximaAcao([atividade({ situacao: 'concluida' })])).toBeNull()
    expect(proximaAcao([])).toBeNull()
  })
})

describe('conferirTitulo', () => {
  it('apara as pontas e recusa o vazio', () => {
    expect(conferirTitulo('  Ligar  ')).toEqual({ ok: true, titulo: 'Ligar' })
    expect(conferirTitulo('   ').ok).toBe(false)
  })

  it('recusa título maior que o limite', () => {
    expect(conferirTitulo('a'.repeat(120)).ok).toBe(true)
    expect(conferirTitulo('a'.repeat(121)).ok).toBe(false)
  })
})

describe('as portas de entrada recusam valor de fora', () => {
  it('tipo e destino desconhecidos não passam', () => {
    expect(ehTipoDeAtividade('ligacao')).toBe(true)
    expect(ehTipoDeAtividade('whatsapp')).toBe(false)
    expect(ehDestinoAoFechar('manter')).toBe(true)
    expect(ehDestinoAoFechar('enviar')).toBe(false)
  })
})
