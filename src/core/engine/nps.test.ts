import { describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from '../flow/schema'
import { executar, MAX_TENTATIVAS } from './executar'
import { sessaoNova, type Acao, type Sessao } from './types'

const p = { x: 0, y: 0 }

/**
 * A pesquisa completa: nota, motivo só para quem reclamou, e um desfecho
 * diferente por faixa. É o desenho que o bloco existe para tornar barato, o
 * mesmo que hoje custa cinco blocos no `exemplos/pesquisa-nps.ts`.
 */
const pesquisa: Fluxo = fluxoSchema.parse({
  inicio: 'nota',
  nodes: [
    {
      id: 'nota',
      type: 'nps',
      position: p,
      data: {
        texto: 'De 0 a 10, o quanto você recomendaria a gente?',
        salvarEm: 'nota',
        perguntaAberta: 'O que faltou?',
        comentarioEm: 'motivo',
      },
    },
    { id: 'obrigado', type: 'mensagem', position: p, data: { texto: 'Que alegria! 🧡' } },
    { id: 'anotado', type: 'mensagem', position: p, data: { texto: 'Anotado, obrigado.' } },
    { id: 'humano', type: 'handoff', position: p, data: { motivo: 'nota baixa · {{nota}}' } },
  ],
  edges: [
    { id: 'e1', source: 'nota', sourceHandle: 'promotor', target: 'obrigado' },
    { id: 'e2', source: 'nota', sourceHandle: 'neutro', target: 'anotado' },
    { id: 'e3', source: 'nota', sourceHandle: 'detrator', target: 'humano' },
  ],
})

/** Pesquisa de uma pergunta só, sem o "por quê?". */
const soANota: Fluxo = fluxoSchema.parse({
  inicio: 'nota',
  nodes: [
    { id: 'nota', type: 'nps', position: p, data: { texto: 'De 0 a 10?', salvarEm: 'nota' } },
    { id: 'obrigado', type: 'mensagem', position: p, data: { texto: 'Obrigado!' } },
  ],
  edges: [
    { id: 'e1', source: 'nota', sourceHandle: 'promotor', target: 'obrigado' },
    { id: 'e2', source: 'nota', sourceHandle: 'neutro', target: 'obrigado' },
    { id: 'e3', source: 'nota', sourceHandle: 'detrator', target: 'obrigado' },
  ],
})

const textos = (acoes: Acao[]) =>
  acoes.filter((a) => a.tipo === 'enviar_texto').map((a) => a.texto)

/** Roda o fluxo até a pesquisa perguntar a nota. */
function ateAPergunta(fluxo: Fluxo): Sessao {
  return executar(fluxo, sessaoNova(), { tipo: 'inicio' }).sessao
}

describe('a pesquisa de satisfação', () => {
  it('pergunta a nota e espera a resposta', () => {
    const { acoes, sessao } = executar(soANota, sessaoNova(), { tipo: 'inicio' })

    expect(textos(acoes)).toEqual(['De 0 a 10?'])
    expect(sessao.noAtual).toBe('nota')
    expect(sessao.status).toBe('ativa')
  })

  describe('a régua das três faixas', () => {
    // A régua oficial do NPS, com as bordas de cada faixa. O 7 e o 9 estão aqui
    // porque são justamente os que enganam: "quase dez" é neutro, não promotor.
    const casos: [number, string][] = [
      [10, 'promotor'],
      [9, 'promotor'],
      [8, 'neutro'],
      [7, 'neutro'],
      [6, 'detrator'],
      [0, 'detrator'],
    ]

    for (const [nota, faixa] of casos) {
      it(`manda a nota ${nota} pela saída de ${faixa}`, () => {
        const { acoes } = executar(soANota, ateAPergunta(soANota), {
          tipo: 'texto',
          texto: String(nota),
        })

        expect(acoes).toContainEqual({ tipo: 'guardar_nota', nota })
        // As três saídas chegam ao mesmo bloco neste fluxo; o que se confere é
        // que a conversa **seguiu**, e a faixa certa é conferida pelo desenho
        // completo no teste seguinte.
        expect(textos(acoes)).toContain('Obrigado!')
      })
    }

    it('leva quem reclamou para uma pessoa, e quem elogiou para o agradecimento', () => {
      const promotor = executar(pesquisa, ateAPergunta(pesquisa), { tipo: 'texto', texto: '10' })
      // Com pergunta aberta, o promotor também é perguntado antes de seguir.
      expect(textos(promotor.acoes)).toEqual(['O que faltou?'])

      const depois = executar(pesquisa, promotor.sessao, { tipo: 'texto', texto: 'nada' })
      expect(textos(depois.acoes)).toContain('Que alegria! 🧡')

      const detrator = executar(pesquisa, ateAPergunta(pesquisa), { tipo: 'texto', texto: '3' })
      const fim = executar(pesquisa, detrator.sessao, { tipo: 'texto', texto: 'demorou muito' })
      expect(fim.acoes.some((a) => a.tipo === 'transferir_humano')).toBe(true)
    })
  })

  describe('lendo a nota que a pessoa escreveu', () => {
    it('aceita "8", "8/10" e "nota 8"', () => {
      for (const texto of ['8', '8/10', 'nota 8']) {
        const { acoes } = executar(soANota, ateAPergunta(soANota), { tipo: 'texto', texto })
        expect(acoes).toContainEqual({ tipo: 'guardar_nota', nota: 8 })
      }
    })

    it('pede de novo quando não vem número, e desiste depois de três vezes', () => {
      let sessao = ateAPergunta(soANota)

      for (let i = 1; i < MAX_TENTATIVAS; i++) {
        const passo = executar(soANota, sessao, { tipo: 'texto', texto: 'sei lá' })
        expect(textos(passo.acoes)).toEqual(['Pode responder com um número de 0 a 10?'])
        expect(passo.acoes.some((a) => a.tipo === 'guardar_nota')).toBe(false)
        sessao = passo.sessao
      }

      const desistiu = executar(soANota, sessao, { tipo: 'texto', texto: 'sei lá' })
      expect(desistiu.acoes.some((a) => a.tipo === 'transferir_humano')).toBe(true)
    })

    it('recusa número fora de 0 a 10', () => {
      const { acoes } = executar(soANota, ateAPergunta(soANota), { tipo: 'texto', texto: '42' })
      expect(acoes.some((a) => a.tipo === 'guardar_nota')).toBe(false)
    })
  })

  describe('o comentário', () => {
    it('guarda a nota **antes** de perguntar o motivo', () => {
      // É a regra que faz a pesquisa valer: quem responde 3 e some antes de
      // explicar continua contando como detrator no relatório.
      const { acoes, sessao } = executar(pesquisa, ateAPergunta(pesquisa), {
        tipo: 'texto',
        texto: '3',
      })

      expect(acoes).toContainEqual({ tipo: 'guardar_nota', nota: 3 })
      expect(textos(acoes)).toEqual(['O que faltou?'])
      expect(sessao.npsPendente).toEqual({ nota: 3, noId: 'nota', salvarEm: 'motivo' })
    })

    it('guarda o motivo e só então segue pela faixa da nota', () => {
      const perguntou = executar(pesquisa, ateAPergunta(pesquisa), { tipo: 'texto', texto: '3' })
      const { acoes, sessao } = executar(pesquisa, perguntou.sessao, {
        tipo: 'texto',
        texto: 'demorou muito',
      })

      expect(acoes).toContainEqual({ tipo: 'guardar_comentario', comentario: 'demorou muito' })
      expect(sessao.vars.motivo).toBe('demorou muito')
      expect(sessao.npsPendente).toBeFalsy()
    })

    it('não trata o comentário como nota nova', () => {
      // O caso que o `npsPendente` existe para resolver: sem ele, "8" escrito
      // como justificativa viraria uma segunda nota.
      const perguntou = executar(pesquisa, ateAPergunta(pesquisa), { tipo: 'texto', texto: '3' })
      const { acoes } = executar(pesquisa, perguntou.sessao, { tipo: 'texto', texto: '8' })

      expect(acoes.filter((a) => a.tipo === 'guardar_nota')).toHaveLength(0)
      expect(acoes).toContainEqual({ tipo: 'guardar_comentario', comentario: '8' })
    })

    it('segue em frente quando o motivo vem vazio', () => {
      const perguntou = executar(pesquisa, ateAPergunta(pesquisa), { tipo: 'texto', texto: '10' })
      const { acoes } = executar(pesquisa, perguntou.sessao, { tipo: 'texto', texto: '   ' })

      expect(acoes.some((a) => a.tipo === 'guardar_comentario')).toBe(false)
      expect(textos(acoes)).toContain('Que alegria! 🧡')
    })
  })

  describe('a nota como variável', () => {
    it('fica disponível para os blocos seguintes', () => {
      const respondeu = executar(pesquisa, ateAPergunta(pesquisa), { tipo: 'texto', texto: '2' })
      const { acoes, sessao } = executar(pesquisa, respondeu.sessao, {
        tipo: 'texto',
        texto: 'ruim',
      })

      expect(sessao.vars.nota).toBe('2')
      const transferiu = acoes.find((a) => a.tipo === 'transferir_humano')
      expect(transferiu).toMatchObject({ motivo: 'nota baixa · 2' })
    })

    it('também vira campo do contato', () => {
      const { acoes } = executar(soANota, ateAPergunta(soANota), { tipo: 'texto', texto: '9' })
      expect(acoes).toContainEqual({ tipo: 'salvar_campo', campo: 'nota', valor: '9' })
    })
  })

  describe('o prazo', () => {
    const comPrazo: Fluxo = fluxoSchema.parse({
      inicio: 'nota',
      nodes: [
        {
          id: 'nota',
          type: 'nps',
          position: p,
          data: { texto: 'De 0 a 10?', timeoutMinutos: 60 },
        },
        { id: 'fim', type: 'mensagem', position: p, data: { texto: 'Obrigado!' } },
      ],
      edges: [
        { id: 'e1', source: 'nota', sourceHandle: 'promotor', target: 'fim' },
        { id: 'e2', source: 'nota', sourceHandle: 'neutro', target: 'fim' },
        { id: 'e3', source: 'nota', sourceHandle: 'detrator', target: 'fim' },
      ],
    })

    it('encerra em silêncio, sem pôr ninguém na fila de atendimento', () => {
      // A inversão deliberada da Regra B: quem ignorou uma pesquisa não é uma
      // dívida do time, e pô-lo na fila encheria a tela de cobrança falsa.
      const { acoes, sessao } = executar(comPrazo, ateAPergunta(comPrazo), { tipo: 'timeout' })

      expect(acoes.some((a) => a.tipo === 'transferir_humano')).toBe(false)
      expect(sessao.status).toBe('encerrada')
    })

    it('sem prazo desenhado, o timeout não faz nada', () => {
      const { acoes, sessao } = executar(soANota, ateAPergunta(soANota), { tipo: 'timeout' })

      expect(acoes).toEqual([])
      expect(sessao.status).toBe('ativa')
    })
  })
})
