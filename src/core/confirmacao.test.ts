import { describe, expect, it } from 'vitest'
import { lerConfirmacao, perguntaDeConfirmacao } from './confirmacao'
import { rotulosDeId } from './ferramentas'

/**
 * A leitura de "pode?".
 *
 * O que precisa ser provado é o lado do erro: um falso sim marca aula que
 * ninguém pediu. Falso não custa uma repetição da pergunta. Os testes abaixo
 * são quase todos tentativas de arrancar um sim que não foi dado.
 */

describe('lerConfirmacao', () => {
  it('lê os sins que aparecem de verdade no WhatsApp', () => {
    for (const dito of ['sim', 'Sim', 'SIM', 'pode', 'pode sim', 'confirmo', 'isso', 'ok', 'blz', 'aham', '👍']) {
      expect(lerConfirmacao(dito)).toBe('sim')
    }
  })

  it('lê os nãos', () => {
    for (const dito of ['não', 'nao', 'Não', 'n', 'cancela', 'deixa pra lá', 'melhor não', 'esquece']) {
      expect(lerConfirmacao(dito)).toBe('nao')
    }
  })

  it('ignora acento e pontuação, que é como se digita no celular', () => {
    expect(lerConfirmacao('Sim!')).toBe('sim')
    expect(lerConfirmacao('  nao.  ')).toBe('nao')
    expect(lerConfirmacao('Não?')).toBe('nao')
  })

  it('NÃO acha a palavra dentro da frase — é o erro que marcaria a aula errada', () => {
    // "não, pode deixar" contém "pode". Buscar dentro transformaria uma recusa
    // clara numa gravação.
    expect(lerConfirmacao('não, pode deixar')).toBe('nao_entendi')
    expect(lerConfirmacao('sim, mas depois eu vejo')).toBe('nao_entendi')
    expect(lerConfirmacao('pode me dizer o preço?')).toBe('nao_entendi')
  })

  it('pergunta no meio da confirmação não é recusa', () => {
    // Tratar isso como "não" encerraria um assunto que a pessoa nem abordou.
    expect(lerConfirmacao('quanto custa?')).toBe('nao_entendi')
    expect(lerConfirmacao('e tem outro horário?')).toBe('nao_entendi')
  })

  it('vazio não é sim', () => {
    expect(lerConfirmacao('')).toBe('nao_entendi')
    expect(lerConfirmacao('   ')).toBe('nao_entendi')
  })
})

describe('perguntaDeConfirmacao', () => {
  it('diz o que vai acontecer, e não só "posso?"', () => {
    const p = perguntaDeConfirmacao('marcar você em', '10/09/2026 07:00 Pilates solo')

    expect(p).toContain('marcar você em')
    expect(p).toContain('Pilates solo')
    expect(p).toMatch(/Posso\?$/)
  })

  it('fica genérica quando não há como saber, em vez de mentir', () => {
    expect(perguntaDeConfirmacao('marcar você em', '')).toBe('Só confirmando antes: marcar você em. Posso?')
  })
})

describe('rotulosDeId dá nome ao id', () => {
  it('junta dia, hora e o que é, na ordem em que se fala', () => {
    const r = rotulosDeId({
      livres: [
        { sessaoId: 's7', data: '10/09/2026', hora: '07:00', servico: 'Pilates solo' },
        { sessaoId: 's8', data: '10/09/2026', hora: '10:00', servico: 'Yoga' },
      ],
    })

    expect(r.get('s7')).toBe('10/09/2026 07:00 Pilates solo')
    expect(r.get('s8')).toBe('10/09/2026 10:00 Yoga')
  })

  it('deixa de fora o campo que não veio, sem buraco na frase', () => {
    const r = rotulosDeId({ proximas: [{ participacaoId: 'p1', data: '18/08', servico: 'Fisio' }] })

    expect(r.get('p1')).toBe('18/08 Fisio')
  })

  it('não inventa rótulo para id sem nenhum campo legível', () => {
    // Melhor pergunta genérica do que uma frase montada com o próprio id.
    expect(rotulosDeId({ x: [{ sessaoId: 's9' }] }).has('s9')).toBe(false)
  })

  it('acumula entre consultas da mesma resposta', () => {
    const r = rotulosDeId({ livres: [{ sessaoId: 's1', hora: '07:00' }] })
    rotulosDeId({ proximas: [{ participacaoId: 'p1', hora: '10:00' }] }, r)

    expect([...r.keys()].sort()).toEqual(['p1', 's1'])
  })
})
