import { describe, expect, it } from 'vitest'
import {
  alcanca,
  ehDoContato,
  EVENTOS_DE_SAIDA,
  FRASE_DA_SAIDA,
  inscricoesAlcancadas,
  podeEnviarAutomatico,
  podeRetomar,
  porQueNaoRetoma,
  quandoRetomar,
} from './politica-de-acompanhamento'

const DO_CONTATO = { id: 'i-contato', cartaoId: null }
const DO_CARTAO_X = { id: 'i-x', cartaoId: 'cartao-x' }
const DO_CARTAO_Y = { id: 'i-y', cartaoId: 'cartao-y' }

/**
 * O cenário que falhava antes da 0085, e é a RB-47 inteira.
 *
 * `sair_das_sequencias` tirava o contato de **todas** as sequências ativas,
 * sempre. Então fechar a mensalidade (cartão X) encerrava, no mesmo instante, o
 * acompanhamento de pós-venda da avaliação física (cartão Y). O primeiro teste
 * daqui é essa célula da tabela.
 */
describe('venda numa negociação não encerra o acompanhamento de outra', () => {
  it('a inscrição da OUTRA negociação fica de pé', () => {
    expect(alcanca('vendeu', DO_CARTAO_Y, 'cartao-x')).toBe(false)
  })

  it('a inscrição daquela negociação sai', () => {
    expect(alcanca('vendeu', DO_CARTAO_X, 'cartao-x')).toBe(true)
  })

  it('a inscrição do contato também sai: régua de recompra não fala com quem acabou de comprar', () => {
    expect(alcanca('vendeu', DO_CONTATO, 'cartao-x')).toBe(true)
  })

  it('em lote, sobra exatamente a da outra negociação', () => {
    const saem = inscricoesAlcancadas('vendeu', [DO_CONTATO, DO_CARTAO_X, DO_CARTAO_Y], 'cartao-x')
    expect(saem.map((i) => i.id)).toEqual(['i-contato', 'i-x'])
  })

  it('perder e mudar de etapa seguem a mesma regra', () => {
    for (const evento of ['perdeu', 'mudou_de_etapa'] as const) {
      expect(alcanca(evento, DO_CARTAO_Y, 'cartao-x')).toBe(false)
      expect(alcanca(evento, DO_CARTAO_X, 'cartao-x')).toBe(true)
    }
  })
})

describe('evento do contato alcança tudo', () => {
  it('responder tira a pessoa de todos os acompanhamentos', () => {
    // Quem voltou a falar não precisa ser lembrado de falar, qualquer que seja o
    // acompanhamento. É o comportamento antigo, e ele está certo.
    for (const inscricao of [DO_CONTATO, DO_CARTAO_X, DO_CARTAO_Y]) {
      expect(alcanca('respondeu', inscricao, null)).toBe(true)
    }
  })

  it('atendimento humano e automação pausada também', () => {
    for (const evento of ['atendimento_humano', 'automacao_pausada'] as const) {
      expect(ehDoContato(evento)).toBe(true)
      expect(alcanca(evento, DO_CARTAO_Y, null)).toBe(true)
    }
  })

  it('evento de negociação SEM negociação identificada alcança tudo', () => {
    /*
     * O lado conservador, e é decisão: acontece na venda avulsa. Tratar como
     * "não alcança nada" deixaria quem acabou de comprar recebendo régua de
     * recompra, que é o erro mais visível dos dois.
     */
    expect(alcanca('vendeu', DO_CARTAO_Y, null)).toBe(true)
  })

  it('vendeu, perdeu e mudou de etapa NÃO são eventos do contato', () => {
    for (const evento of ['vendeu', 'perdeu', 'mudou_de_etapa'] as const) {
      expect(ehDoContato(evento)).toBe(false)
    }
  })
})

describe('a retomada', () => {
  it('o prazo conta de agora, e não de quando a pessoa entrou', () => {
    /*
     * A RB-48. Numa inscrição que ficou pausada três semanas, `entrouEm +
     * atraso` já passou para todos os passos: retomar disparara quatro mensagens
     * no mesmo minuto, no WhatsApp de quem acabou de ser atendido.
     */
    const agora = new Date('2026-09-20T12:00:00Z')
    expect(quandoRetomar(60, agora).toISOString()).toBe('2026-09-20T13:00:00.000Z')
    expect(quandoRetomar(1440, agora).toISOString()).toBe('2026-09-21T12:00:00.000Z')
  })

  it('atraso zero é agora, e não ontem', () => {
    const agora = new Date('2026-09-20T12:00:00Z')
    expect(quandoRetomar(0, agora).getTime()).toBe(agora.getTime())
  })

  it('atraso negativo ou inválido não volta no tempo', () => {
    const agora = new Date('2026-09-20T12:00:00Z')
    expect(quandoRetomar(-500, agora).getTime()).toBe(agora.getTime())
    expect(quandoRetomar(Number.NaN, agora).getTime()).toBe(agora.getTime())
  })

  it('só bloqueada retoma', () => {
    /*
     * A distinção que importa: `bloqueada` é o único estado que quer dizer "a
     * sequência NÃO entregou" (a janela de 24h fechou), e é o que a retomada
     * serve para consertar. `saiu` quer dizer que uma regra encerrou, e retomar
     * ali é reinscrever: a RB-47 exige ação explícita, "nunca por mera reentrega
     * do evento".
     */
    expect(podeRetomar('bloqueada')).toBe(true)
    expect(podeRetomar('saiu')).toBe(false)
    expect(podeRetomar('concluida')).toBe(false)
    expect(podeRetomar('ativa')).toBe(false)
  })

  it('cada recusa diz o que fazer', () => {
    expect(porQueNaoRetoma('bloqueada')).toBeNull()
    expect(porQueNaoRetoma('saiu')).toContain('inscreva-a outra vez')
    expect(porQueNaoRetoma('concluida')).toContain('chegou ao fim')
    expect(porQueNaoRetoma('ativa')).toContain('já está correndo')
  })
})

describe('a prioridade humana no envio', () => {
  const livre = { atendimentoHumano: false, automacaoPausada: false, inscricaoAtiva: true }

  it('sem nada no caminho, envia', () => {
    expect(podeEnviarAutomatico(livre)).toEqual({ pode: true })
  })

  it('atendimento humano suspende', () => {
    const r = podeEnviarAutomatico({ ...livre, atendimentoHumano: true })
    expect(r.pode).toBe(false)
    if (r.pode) return
    expect(r.motivo).toContain('equipe')
  })

  it('automação pausada suspende', () => {
    expect(podeEnviarAutomatico({ ...livre, automacaoPausada: true }).pode).toBe(false)
  })

  it('inscrição que já não está ativa suspende, e é a primeira conferência', () => {
    /*
     * A ordem importa: uma tarefa já enfileirada acorda depois de a inscrição ter
     * sido encerrada, e a RB-48 manda conferir "inclusive em jobs já
     * enfileirados". Perguntar primeiro se a inscrição vale evita gastar as
     * outras duas leituras.
     */
    const r = podeEnviarAutomatico({
      atendimentoHumano: true,
      automacaoPausada: true,
      inscricaoAtiva: false,
    })
    expect(r.pode).toBe(false)
    if (r.pode) return
    expect(r.motivo).toContain('inscrição')
  })
})

describe('o vocabulário', () => {
  it('todo evento tem frase, e nenhuma usa travessão', () => {
    for (const evento of EVENTOS_DE_SAIDA) {
      expect(FRASE_DA_SAIDA[evento].length).toBeGreaterThan(0)
      expect(FRASE_DA_SAIDA[evento]).not.toContain('—')
    }
  })
})
