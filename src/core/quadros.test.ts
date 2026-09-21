import { describe, expect, it } from 'vitest'
import {
  DIAS_PARA_MARCAR_PARADO,
  ETAPAS_INICIAIS,
  LIMITE_DE_ETAPAS,
  cartoesPorEtapa,
  comoParado,
  conferirEtapa,
  diasParado,
  estaParado,
  etapasEmOrdem,
  proximaOrdem,
  trocaDeLugar,
  type Cartao,
  type Etapa,
  aoArrastarPara,
} from './quadros'

/**
 * A régua dos quadros.
 *
 * O que estes testes prendem é o desenho, não a aritmética: a ordem das etapas
 * é determinística mesmo com `ordem` repetida (o banco não tem índice único
 * ali, de propósito), e a coluna mostra em cima quem está parado há mais
 * tempo, que é a única informação do quadro que faz alguém agir.
 */

const etapa = (id: string, ordem: number, criadoEm = '2026-01-01T00:00:00Z'): Etapa => ({
  id,
  nome: id,
  ordem,
  criadoEm,
})

describe('a ordem das etapas', () => {
  it('sai de `ordem`', () => {
    const etapas = [etapa('c', 2), etapa('a', 0), etapa('b', 1)]
    expect(etapasEmOrdem(etapas).map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('empate é desempatado por criação, e não fica instável', () => {
    // `ordem` não é única no banco, trocar duas de lugar com índice único
    // exigiria valor temporário. O desempate precisa ser determinístico, senão
    // a coluna "pula" a cada recarga.
    const etapas = [
      etapa('nova', 0, '2026-02-01T00:00:00Z'),
      etapa('velha', 0, '2026-01-01T00:00:00Z'),
    ]
    expect(etapasEmOrdem(etapas).map((e) => e.id)).toEqual(['velha', 'nova'])
    expect(etapasEmOrdem([...etapas].reverse()).map((e) => e.id)).toEqual(['velha', 'nova'])
  })

  it('etapa nova entra no fim', () => {
    expect(proximaOrdem([etapa('a', 0), etapa('b', 5)])).toBe(6)
    expect(proximaOrdem([])).toBe(0)
  })
})

describe('mover etapa de lado troca só as duas', () => {
  const etapas = [etapa('a', 0), etapa('b', 1), etapa('c', 2)]

  it('devolve o par que troca', () => {
    const troca = trocaDeLugar(etapas, 'b', 'esquerda')!
    expect([troca.a.id, troca.b.id]).toEqual(['b', 'a'])
  })

  it('na ponta não há para onde ir', () => {
    expect(trocaDeLugar(etapas, 'a', 'esquerda')).toBeNull()
    expect(trocaDeLugar(etapas, 'c', 'direita')).toBeNull()
  })

  it('etapa que não existe não move nada', () => {
    expect(trocaDeLugar(etapas, 'nao-existe', 'direita')).toBeNull()
  })
})

describe('quanto tempo parado', () => {
  const agora = Date.parse('2026-08-19T12:00:00Z')

  it('conta em dias inteiros', () => {
    expect(diasParado('2026-08-19T09:00:00Z', agora)).toBe(0)
    expect(diasParado('2026-08-18T09:00:00Z', agora)).toBe(1)
    expect(diasParado('2026-08-13T09:00:00Z', agora)).toBe(6)
  })

  it('marca só a partir do limite, para o aviso continuar sendo lido', () => {
    const doisDias = new Date(agora - 2 * 86_400_000).toISOString()
    const tresDias = new Date(agora - DIAS_PARA_MARCAR_PARADO * 86_400_000).toISOString()
    expect(estaParado(doisDias, agora)).toBe(false)
    expect(estaParado(tresDias, agora)).toBe(true)
  })

  it('escreve em português, e no singular quando é um', () => {
    expect(comoParado('2026-08-19T09:00:00Z', agora)).toBe('hoje')
    expect(comoParado('2026-08-18T09:00:00Z', agora)).toBe('há 1 dia')
    expect(comoParado('2026-08-13T09:00:00Z', agora)).toBe('há 6 dias')
  })

  it('data ilegível vale zero em vez de estourar a tela', () => {
    expect(diasParado('ontem', agora)).toBe(0)
  })
})

describe('a régua de uma etapa nova', () => {
  it('recusa vazio e repetido, ignorando caixa e espaço', () => {
    expect(conferirEtapa('   ', [])).toEqual({ ok: false, motivo: 'escreva o nome da etapa' })

    const repetida = conferirEtapa('  novo ', ['Novo'])
    expect(repetida.ok).toBe(false)
    if (!repetida.ok) expect(repetida.motivo).toContain('já existe')
  })

  it('devolve o nome já limpo', () => {
    expect(conferirEtapa('  Aula agendada  ', [])).toEqual({ ok: true, nome: 'Aula agendada' })
  })

  it('recusa acima do teto, e o teto explica o porquê', () => {
    const cheias = Array.from({ length: LIMITE_DE_ETAPAS }, (_, i) => `e${i}`)
    const r = conferirEtapa('mais uma', cheias)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('lado a lado')
  })
})

describe('as etapas iniciais não descrevem um ramo', () => {
  it('são neutras, empty state ensina o negócio de quem está olhando', () => {
    // O erro do produto de referência foi um mockup de imobiliária ("Visita
    // agendada", "R$600 mil") numa conta de estúdio de pilates.
    expect(ETAPAS_INICIAIS).toEqual(['Novo', 'Em conversa', 'Fechado'])
    for (const nome of ETAPAS_INICIAIS) {
      expect(nome).not.toMatch(/visita|imóvel|aluguel|aula|consulta|corte/i)
    }
  })
})

describe('a coluna é uma fila de trabalho', () => {
  const cartao = (
    id: string,
    colunaId: string,
    entrouNaColunaEm: string,
    extras: Partial<Cartao> = {},
  ): Cartao => ({
    id,
    contatoId: id,
    colunaId,
    nome: id,
    telefone: '5511999999999',
    entrouNaColunaEm,
    ...extras,
  })

  it('cartão fechado desce, mesmo sendo o mais antigo da coluna', () => {
    // Ganho e perdido continuam no quadro de propósito, é como o time vê o
    // próprio resultado no fim do mês. Mas eles não são trabalho pendente, e
    // deixá-los no topo inverteria o sentido da coluna.
    const cartoes = [
      cartao('ganho-antigo', 'a', '2026-08-01T00:00:00Z', { situacao: 'ganha' }),
      cartao('aberto-novo', 'a', '2026-08-20T00:00:00Z'),
    ]
    expect(cartoesPorEtapa(cartoes).get('a')?.map((c) => c.id)).toEqual([
      'aberto-novo',
      'ganho-antigo',
    ])
  })

  it('quem está parado há mais tempo fica em cima', () => {
    // Ordenar por chegada esconderia o esquecido no fim da coluna, que é
    // exatamente a pessoa que o quadro precisa mostrar.
    const cartoes = [
      cartao('recente', 'a', '2026-08-19T00:00:00Z'),
      cartao('antigo', 'a', '2026-08-01T00:00:00Z'),
      cartao('meio', 'a', '2026-08-10T00:00:00Z'),
    ]
    expect(cartoesPorEtapa(cartoes).get('a')!.map((c) => c.id)).toEqual([
      'antigo',
      'meio',
      'recente',
    ])
  })

  it('separa por etapa, e etapa sem ninguém não aparece no mapa', () => {
    const mapa = cartoesPorEtapa([cartao('x', 'a', '2026-08-01T00:00:00Z')])
    expect(mapa.get('a')).toHaveLength(1)
    expect(mapa.get('b')).toBeUndefined()
  })
})

describe('a paciência é por etapa', () => {
  const agora = Date.parse('2026-09-15T12:00:00Z')
  const haCincoDias = '2026-09-10T12:00:00Z'

  it('usa o padrão do produto quando a etapa não tem limite', () => {
    expect(estaParado(haCincoDias, agora)).toBe(true)
    expect(estaParado(haCincoDias, agora, null)).toBe(true)
  })

  it('respeita o limite maior de uma etapa que espera mais', () => {
    // "Aguardando pagamento" com dez dias de prazo não pode acender no quinto.
    expect(estaParado(haCincoDias, agora, 10)).toBe(false)
  })

  it('respeita o limite menor de uma etapa impaciente', () => {
    expect(estaParado('2026-09-14T12:00:00Z', agora, 1)).toBe(true)
  })
})

describe('aoArrastarPara: arrastar para conclusão guarda a volta (RB-23)', () => {
  const comum = { id: 'etapa-comum', tipo: 'normal' as const }
  const ganho = { id: 'etapa-ganho', tipo: 'ganho' as const }
  const perdido = { id: 'etapa-perdido', tipo: 'perdido' as const }

  it('etapa comum é só mover', () => {
    expect(aoArrastarPara({ colunaId: 'antes' }, comum)).toEqual({ tipo: 'mover' })
  })

  it('etapa de ganho abre a conclusão e guarda de onde o cartão saiu', () => {
    // `voltarPara` é o ponto: sem ele, cancelar o modal não teria como
    // desfazer o movimento otimista, e o cartão ficaria parado na etapa de
    // ganho parecendo concluído.
    expect(aoArrastarPara({ colunaId: 'em-conversa' }, ganho)).toEqual({
      tipo: 'concluir',
      situacao: 'ganha',
      voltarPara: 'em-conversa',
    })
  })

  it('etapa de perda também, com a situação certa', () => {
    expect(aoArrastarPara({ colunaId: 'em-conversa' }, perdido)).toEqual({
      tipo: 'concluir',
      situacao: 'perdida',
      voltarPara: 'em-conversa',
    })
  })
})
