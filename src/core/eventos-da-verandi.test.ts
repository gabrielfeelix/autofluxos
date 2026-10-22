import { describe, expect, it } from 'vitest'
import { destinatariosDoEvento, EVENTOS_DA_VERANDI, MODELOS_DA_VERANDI, modeloDoEvento, valoresDoModelo } from './eventos-da-verandi'

const aula = { sessaoId: 's1', data: '2026-10-23', hora: '07:00', servico: 'Pilates aparelho', profissional: 'Marina' }

describe('avisos da Verandi', () => {
  it('aula cancelada vira uma conversa por aluno, com a aula nas variáveis', () => {
    const r = destinatariosDoEvento('sessao.cancelada', {
      ...aula,
      alunos: [
        { pessoa: 'Ana Souza', telefone: '5544999990000', reposicao: true },
        { pessoa: 'Sem telefone', telefone: null },
      ],
    })
    expect(r).toEqual([
      {
        telefone: '5544999990000',
        variaveis: {
          aula_data: '23/10',
          aula_dia: 'sexta',
          aula_hora: '07:00',
          aula_servico: 'Pilates aparelho',
          aula_professor: 'Marina',
          aluno_nome: 'Ana Souza',
          tem_reposicao: 'sim',
        },
      },
    ])
  })

  it('o resto fala com a pessoa do evento; sem telefone, ninguém', () => {
    expect(destinatariosDoEvento('presenca.falta', { ...aula, pessoa: 'Bia', telefone: '5544988887777' })[0]).toMatchObject({
      telefone: '5544988887777',
      variaveis: { aluno_nome: 'Bia', aula_dia: 'sexta' },
    })
    expect(destinatariosDoEvento('vaga.aberta', aula)).toEqual([])
  })

  it('o modelo de fora das 24h leva nome, dia, hora e aula, e não sai pela metade', () => {
    const vars = { aluno_nome: 'Ana Souza', aula_dia: 'sexta', aula_data: '23/10', aula_hora: '07:00', aula_servico: 'Pilates solo' }
    expect(valoresDoModelo(vars)).toEqual(['Ana', 'sexta, 23/10', '07:00', 'Pilates solo'])
    expect(valoresDoModelo({ ...vars, aluno_nome: '' })?.[0]).toBe('tudo bem')
    expect(valoresDoModelo({ ...vars, aula_hora: '' })).toBeNull()
    expect(modeloDoEvento('sessao.cancelada')?.nome).toBe('verandi_aula_cancelada')
    expect(modeloDoEvento('outro.evento')).toBeNull()
    // Um modelo por evento, e todo corpo com as quatro variáveis em ordem.
    expect(MODELOS_DA_VERANDI.map((m) => m.evento)).toEqual(EVENTOS_DA_VERANDI.map((e) => e.evento))
    for (const m of MODELOS_DA_VERANDI) expect(m.corpo.match(/\{\{\d\}\}/g)).toEqual(['{{1}}', '{{2}}', '{{3}}', '{{4}}'])
  })
})
