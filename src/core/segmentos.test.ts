import { describe, expect, it } from 'vitest'
import {
  LIMITE_DE_CONDICOES,
  acharCampo,
  condicoesDoNivel,
  explicarSegmento,
  validarSegmento,
} from './segmentos'

const PODE = { podeLerValores: true }
const NAO_PODE = { podeLerValores: false }

function seg(condicoes: unknown[], juncao = 'todas') {
  return { juncao, condicoes }
}

describe('o que entra é dado, nunca código', () => {
  it('recusa campo que não está na lista', () => {
    // O ponto: não existe caminho para um identificador arbitrário chegar ao
    // SQL. `service_role` ignora RLS, e o `or()` do PostgREST é uma string em
    // que vírgula e parêntese têm significado.
    const r = validarSegmento(seg([{ campo: 'senha', operador: 'igual', valor: 'x' }]), PODE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toContain('campo desconhecido')
  })

  it('recusa campo que tenta virar consulta', () => {
    const r = validarSegmento(
      seg([{ campo: 'nome.ilike.*,wa_id.ilike.*', operador: 'igual', valor: 'x' }]),
      PODE,
    )
    expect(r.ok).toBe(false)
  })

  it('recusa operador desconhecido', () => {
    const r = validarSegmento(seg([{ campo: 'nome', operador: 'regex', valor: '.*' }]), PODE)
    expect(r.ok).toBe(false)
  })

  it('recusa operador que não cabe no tipo do campo', () => {
    // "contém" numa data não é uma consulta mais frouxa, é uma pergunta sem
    // resposta.
    const r = validarSegmento(
      seg([{ campo: 'ultima_mensagem_em', operador: 'contem', valor: '2026' }]),
      PODE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toContain('não aceita esse operador')
  })

  it('recusa valor fora da lista de um campo de opção', () => {
    expect(
      validarSegmento(
        seg([{ campo: 'oportunidade_temperatura', operador: 'igual', valor: 'fervendo' }]),
        PODE,
      ).ok,
    ).toBe(false)

    expect(
      validarSegmento(
        seg([{ campo: 'oportunidade_temperatura', operador: 'igual', valor: 'quente' }]),
        PODE,
      ).ok,
    ).toBe(true)
  })

  it('recusa número que não é número', () => {
    expect(
      validarSegmento(seg([{ campo: 'compras', operador: 'maior', valor: 'muitas' }]), PODE).ok,
    ).toBe(false)
  })

  it('tem teto de condições', () => {
    const muitas = Array.from({ length: LIMITE_DE_CONDICOES + 1 }, () => ({
      campo: 'nome',
      operador: 'contem',
      valor: 'a',
    }))
    expect(validarSegmento(seg(muitas), PODE).ok).toBe(false)
  })

  it('entrada que não é objeto não derruba nada', () => {
    expect(validarSegmento(null, PODE).ok).toBe(false)
    expect(validarSegmento('todos', PODE).ok).toBe(false)
    expect(validarSegmento({ juncao: 'todas', condicoes: 'tudo' }, PODE).ok).toBe(false)
  })
})

describe('campo sensível exige permissão, e a checagem é do servidor', () => {
  it('quem não lê valores não filtra por valor', () => {
    // Esconder o campo no editor não impede ninguém de mandar a condição
    // direto. É literalmente o A19.
    const r = validarSegmento(
      seg([{ campo: 'valor_conhecido', operador: 'maior', valor: '1000' }]),
      NAO_PODE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toContain('permissão')
  })

  it('quem lê valores filtra', () => {
    expect(
      validarSegmento(seg([{ campo: 'valor_conhecido', operador: 'maior', valor: '1000' }]), PODE)
        .ok,
    ).toBe(true)
  })

  it('contagem de compras não é sensível, mas o valor é', () => {
    // A contagem não revela quanto alguém gastou; o total revela.
    expect(acharCampo('compras')?.sensivel).toBeUndefined()
    expect(acharCampo('valor_conhecido')?.sensivel).toBe(true)
  })
})

describe('operadores sem valor', () => {
  it('preenchido e não informado dispensam valor', () => {
    const r = validarSegmento(seg([{ campo: 'ultima_compra_em', operador: 'nao_informado' }]), PODE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.segmento.condicoes[0]).toEqual({
      campo: 'ultima_compra_em',
      operador: 'nao_informado',
    })
  })

  it('o resto exige valor', () => {
    expect(validarSegmento(seg([{ campo: 'nome', operador: 'contem' }]), PODE).ok).toBe(false)
    expect(
      validarSegmento(seg([{ campo: 'nome', operador: 'contem', valor: '   ' }]), PODE).ok,
    ).toBe(false)
  })

  it('entre exige os dois lados', () => {
    expect(
      validarSegmento(seg([{ campo: 'compras', operador: 'entre', valor: '1' }]), PODE).ok,
    ).toBe(false)
    expect(
      validarSegmento(seg([{ campo: 'compras', operador: 'entre', valor: '1', ate: '5' }]), PODE)
        .ok,
    ).toBe(true)
  })
})

describe('explicar: a prévia precisa dizer por que a pessoa entrou', () => {
  it('escreve a regra em português', () => {
    const r = validarSegmento(
      seg([
        { campo: 'oportunidade_temperatura', operador: 'igual', valor: 'frio' },
        { campo: 'oportunidade_situacao', operador: 'igual', valor: 'aberta' },
      ]),
      PODE,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(explicarSegmento(r.segmento)).toBe(
      'temperatura da oportunidade é frio e situação da oportunidade é aberta',
    )
  })

  it('"não informado" tem frase própria, e não vira "há muito tempo"', () => {
    // RB-35: importado sem histórico fica em grupo próprio, e não se funde num
    // "inativo" universal.
    const r = validarSegmento(seg([{ campo: 'ultima_compra_em', operador: 'nao_informado' }]), PODE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(explicarSegmento(r.segmento)).toBe('última compra não foi informado')
  })

  it('segmento vazio é todo mundo, e diz isso', () => {
    expect(explicarSegmento({ juncao: 'todas', condicoes: [] })).toBe('todos os contatos')
  })
})

describe('condicoesDoNivel: a faixa vira condição de servidor', () => {
  const faixas = { ouro: 5000, prata: 1000 }

  it('sem_compra é "não informado", e nunca "igual a zero"', () => {
    // Quem nunca comprou não tem linha em `vendas`, então o total é nulo.
    // Tratar nulo como zero misturaria o desconhecido com quem gastou R$ 0,00.
    expect(condicoesDoNivel('sem_compra', faixas)).toEqual([
      { campo: 'valor_conhecido', operador: 'nao_informado' },
    ])
  })

  it('ouro, prata e bronze não se sobrepõem', () => {
    expect(condicoesDoNivel('ouro', faixas)).toEqual([
      { campo: 'valor_conhecido', operador: 'maior', valor: '4999.99' },
    ])
    expect(condicoesDoNivel('prata', faixas)).toEqual([
      { campo: 'valor_conhecido', operador: 'entre', valor: '1000', ate: '4999.99' },
    ])
    expect(condicoesDoNivel('bronze', faixas)).toEqual([
      { campo: 'valor_conhecido', operador: 'maior', valor: '0' },
      { campo: 'valor_conhecido', operador: 'menor', valor: '1000' },
    ])
  })

  it('as condições geradas passam pela validação de quem lê valores', () => {
    for (const nivel of ['ouro', 'prata', 'bronze', 'sem_compra'] as const) {
      const r = validarSegmento(
        { juncao: 'todas', condicoes: condicoesDoNivel(nivel, faixas) },
        { podeLerValores: true },
      )
      expect(r.ok).toBe(true)
    }
  })

  it('e são recusadas para quem não lê valores', () => {
    const r = validarSegmento(
      { juncao: 'todas', condicoes: condicoesDoNivel('ouro', faixas) },
      { podeLerValores: false },
    )
    expect(r.ok).toBe(false)
  })
})

describe('data do calendário em "depois de", "antes de" e "entre"', () => {
  const opcoes = { podeLerValores: true }
  it('recusa o número que sobrou de "há mais de N dias"', () => {
    const r = validarSegmento({ juncao: 'todas', condicoes: [{ campo: 'criado_em', operador: 'maior', valor: '2' }] }, opcoes)
    expect(r.ok).toBe(false)
  })
  it('aceita uma data de verdade', () => {
    const r = validarSegmento({ juncao: 'todas', condicoes: [{ campo: 'criado_em', operador: 'maior', valor: '2026-09-01' }] }, opcoes)
    expect(r.ok).toBe(true)
  })
  it('recusa 31 de fevereiro e "entre" sem o fim', () => {
    expect(validarSegmento({ juncao: 'todas', condicoes: [{ campo: 'criado_em', operador: 'menor', valor: '2026-02-31' }] }, opcoes).ok).toBe(false)
    expect(validarSegmento({ juncao: 'todas', condicoes: [{ campo: 'criado_em', operador: 'entre', valor: '2026-01-01' }] }, opcoes).ok).toBe(false)
  })
})
