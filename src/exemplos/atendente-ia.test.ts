import { describe, expect, it } from 'vitest'
import { executar } from '@/core/engine/executar'
import { sessaoNova, type Sessao } from '@/core/engine/types'
import { validar } from '@/core/flow/validar'
import { atendenteIa } from './atendente-ia'

/**
 * O modelo do atendente de IA, provado pelo motor.
 *
 * O que estes testes guardam não é o texto das mensagens — é o **laço**, que é
 * a única coisa deste grafo que não se vê olhando para ele. Um desenho em que
 * a IA responde e o fluxo acaba passa no `validar()` igualzinho a este; a
 * diferença só aparece na segunda pergunta.
 */
describe('atendente de IA', () => {
  it('publica sem erro nem aviso', () => {
    const r = validar(atendenteIa, { iaHabilitada: true, temContextoDeNegocio: true })
    expect(r.erros).toEqual([])
    expect(r.avisos).toEqual([])
  })

  it('volta para a IA a cada nova pergunta, sem teto de voltas', () => {
    let s: Sessao = sessaoNova()
    const passo = (entrada: Parameters<typeof executar>[2]) => {
      const r = executar(atendenteIa, s, entrada)
      s = r.sessao
      return r.acoes
    }

    passo({ tipo: 'inicio' })
    passo({ tipo: 'opcao', opcaoId: 'perguntar' })

    // Primeira dúvida: o motor pede o modelo e para, esperando a resposta.
    expect(passo({ tipo: 'texto', texto: 'tem aula sábado?' }).map((a) => a.tipo)).toContain(
      'chamar_ia',
    )
    expect(s.status).toBe('aguardando_ia')

    passo({ tipo: 'ia_respondeu', texto: 'Não, só de segunda a sexta.' })

    // A segunda dúvida cai no mesmo bloco de IA — é isto que o laço garante.
    expect(passo({ tipo: 'texto', texto: 'quem dá aula quarta?' }).map((a) => a.tipo)).toContain(
      'chamar_ia',
    )
    expect(s.noAtual).toBe('responder')
    expect(s.status).toBe('aguardando_ia')

    // E a conversa continua viva depois da segunda resposta.
    passo({ tipo: 'ia_respondeu', texto: 'Nathália e Márcia.' })
    expect(s.status).toBe('ativa')
  })

  it('quem pede atendente não passa pela IA', () => {
    let s: Sessao = sessaoNova()
    let r = executar(atendenteIa, s, { tipo: 'inicio' })
    r = executar(atendenteIa, r.sessao, { tipo: 'opcao', opcaoId: 'atendente' })
    s = r.sessao

    expect(r.acoes.map((a) => a.tipo)).toContain('transferir_humano')
    expect(r.acoes.map((a) => a.tipo)).not.toContain('chamar_ia')
    expect(s.status).toBe('humano')
  })
})
