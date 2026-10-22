import { describe, expect, it } from 'vitest'
import {
  FLOW_JSON_DE_AGENDAMENTO,
  janelaDeDias,
  lerMarcacao,
  opcoesDeDias,
  opcoesDeHorarios,
  resumoDaMarcacao,
  rotuloDoDia,
  type HorarioLivre,
} from './formulario-de-agendamento'

const h = (sessaoId: string, data: string, hora: string, extra: Partial<HorarioLivre> = {}): HorarioLivre => ({
  sessaoId,
  data,
  hora,
  servico: 'Pilates solo',
  profissional: 'Carol',
  livres: 2,
  ...extra,
})

describe('formulário de agendamento', () => {
  it('rótulo do dia pela data civil', () => {
    expect(rotuloDoDia('2026-10-23')).toBe('Sexta, 23/10')
    expect(rotuloDoDia('2026-11-01')).toBe('Domingo, 01/11')
  })

  it('janela de 14 dias contando hoje, em Brasília', () => {
    // 02:00 UTC do dia 23 ainda é dia 22 em Brasília.
    expect(janelaDeDias(new Date('2026-10-23T02:00:00Z'))).toEqual({ de: '2026-10-22', ate: '2026-11-04' })
  })

  it('um dia por opção, em ordem, com a contagem', () => {
    const dias = opcoesDeDias([h('b', '2026-10-24', '08:00'), h('a', '2026-10-23', '07:00'), h('c', '2026-10-23', '09:00')])
    expect(dias).toEqual([
      { id: '2026-10-23', title: 'Sexta, 23/10', description: '2 horários livres' },
      { id: '2026-10-24', title: 'Sábado, 24/10', description: '1 horário livre' },
    ])
  })

  it('horários do dia: id é a sessão, título cabe em 30 caracteres', () => {
    const opcoes = opcoesDeHorarios(
      [h('s2', '2026-10-23', '09:00', { servico: 'Pilates com aparelhos e alongamento', livres: 1 }), h('s1', '2026-10-23', '07:00'), h('x', '2026-10-24', '07:00')],
      '2026-10-23',
    )
    expect(opcoes.map((o) => o.id)).toEqual(['s1', 's2'])
    expect(opcoes[0]).toEqual({ id: 's1', title: '07:00 · Pilates solo', description: 'com Carol · 2 vagas' })
    expect(opcoes[1]?.title.length).toBeLessThanOrEqual(30)
    expect(opcoes[1]?.description).toBe('com Carol · 1 vaga')
  })

  it('no máximo 20 opções', () => {
    const muitos = Array.from({ length: 25 }, (_, i) => h(`s${i}`, '2026-10-23', `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`))
    expect(opcoesDeHorarios(muitos, '2026-10-23')).toHaveLength(20)
  })

  it('resumo da marcação', () => {
    expect(resumoDaMarcacao(h('s1', '2026-10-23', '07:00'))).toBe('Sexta, 23/10 às 07:00, Pilates solo com Carol.')
    expect(resumoDaMarcacao(h('s1', '2026-10-23', '07:00', { servico: null, profissional: null }))).toBe('Sexta, 23/10 às 07:00.')
  })

  it('lê a marcação devolvida pelo Concluir', () => {
    expect(lerMarcacao({ flow_token: 't', participacao_id: 'p1', sessao_id: 's1', resumo: 'r' })).toEqual({
      participacao_id: 'p1',
      sessao_id: 's1',
      resumo: 'r',
    })
    expect(lerMarcacao({ flow_token: 't' })).toBeNull()
  })

  it('o Flow JSON liga as três telas e só a última é terminal', () => {
    const telas = FLOW_JSON_DE_AGENDAMENTO.screens
    expect(telas.map((t) => t.id)).toEqual(['DIA', 'HORARIO', 'CONFIRMADO'])
    expect(telas.filter((t) => 'terminal' in t && t.terminal).map((t) => t.id)).toEqual(['CONFIRMADO'])
    expect(JSON.stringify(FLOW_JSON_DE_AGENDAMENTO)).not.toMatch(/—/)
  })
})
