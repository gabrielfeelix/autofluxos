import { describe, expect, it } from 'vitest'
import {
  aindaAutorizada,
  comoConducao,
  devolverAFila,
  encerrar,
  retomarBot,
  tentarAssumir,
  transferir,
  type Controle,
} from './controle-da-conversa'

/**
 * A corrida por uma conversa, e a execução que ficou para trás.
 *
 * O defeito medido: `atribuirContato` era um `update` sem condição. Dois
 * atendentes clicando em "Assumir" ao mesmo tempo recebiam **os dois** sucesso,
 * e quem gravou por último ficava com a conversa. O outro via a tela dizer que
 * assumiu e começava a responder numa conversa que era de outra pessoa.
 */
const bot = (): Controle => ({ conducao: 'bot', responsavelId: null, revisao: 1 })
const daAna = (): Controle => ({ conducao: 'humano', responsavelId: 'ana', revisao: 2 })

describe('tentarAssumir', () => {
  it('a conversa do bot pode ser assumida', () => {
    const r = tentarAssumir(bot(), 'ana')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.controle.conducao).toBe('humano')
    expect(r.controle.responsavelId).toBe('ana')
  })

  /** RB-14: apenas um assume a versão atual. */
  it('o segundo atendente perde, e descobre de quem é', () => {
    const r = tentarAssumir(daAna(), 'bruno')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toBe('ja_assumida')
    // A tela precisa dizer "a Ana assumiu", e não um "não deu" mudo.
    expect(r.responsavelId).toBe('ana')
  })

  /**
   * Clicar duas vezes não é assumir duas vezes. Se fosse, a revisão subiria e
   * invalidaria a execução em andamento da própria pessoa, sem motivo.
   */
  it('assumir o que já é seu não é sucesso nem erro, e não mexe na revisão', () => {
    const r = tentarAssumir(daAna(), 'ana')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toBe('ja_e_sua')
  })

  it('a conversa aguardando equipe pode ser assumida', () => {
    const esperando: Controle = { conducao: 'aguardando', responsavelId: null, revisao: 3 }
    expect(tentarAssumir(esperando, 'bruno').ok).toBe(true)
  })

  /**
   * Quem tinha sido atribuído mas ainda não assumiu não bloqueia ninguém. É a
   * proposta: "Atribuir uma pessoa não significa que ela já respondeu... só
   * Assumir atendimento marca o início efetivo".
   */
  it('atribuída sem ter assumido ainda pode ser assumida por outra pessoa', () => {
    const atribuida: Controle = { conducao: 'aguardando', responsavelId: 'ana', revisao: 3 }
    const r = tentarAssumir(atribuida, 'bruno')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.controle.responsavelId).toBe('bruno')
  })

  it('toda tomada bem-sucedida sobe a revisão', () => {
    const antes = bot()
    const r = tentarAssumir(antes, 'ana')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.controle.revisao).toBe(antes.revisao + 1)
  })
})

describe('transferir', () => {
  /** A saída de quem perdeu a corrida: explícita, e vence o dono atual. */
  it('vence um responsável existente, ao contrário de assumir', () => {
    const depois = transferir(daAna(), 'bruno')
    expect(depois.responsavelId).toBe('bruno')
    expect(depois.conducao).toBe('humano')
    expect(depois.revisao).toBe(3)
  })
})

describe('devolverAFila', () => {
  /** RB-16: "Devolver à fila" nunca reinicia o bot. */
  it('tira o dono e NÃO devolve a conversa ao bot', () => {
    const depois = devolverAFila(daAna())
    expect(depois.responsavelId).toBeNull()
    expect(depois.conducao).toBe('aguardando')
    expect(depois.conducao).not.toBe('bot')
  })

  it('sobe a revisão, então a execução anterior perde a autorização', () => {
    const antes = daAna()
    expect(aindaAutorizada(devolverAFila(antes), antes.revisao)).toBe(false)
  })
})

describe('retomarBot', () => {
  it('é o único caminho de volta para o bot, e é explícito', () => {
    const depois = retomarBot(daAna())
    expect(depois.conducao).toBe('bot')
    expect(depois.responsavelId).toBeNull()
  })
})

describe('encerrar', () => {
  it('deixa a conversa sem condução ativa e sem dono', () => {
    const depois = encerrar(daAna())
    expect(depois.conducao).toBe('sem_conducao')
    expect(depois.responsavelId).toBeNull()
  })
})

/**
 * RB-15: a resposta de IA que termina depois da tomada não pode sair.
 *
 * O cenário real: o bot chama o modelo, leva quatro segundos, e no segundo dois
 * a Ana assume. A resposta que volta foi autorizada por um estado que não existe
 * mais, e enviá-la é o bot falando por cima de quem acabou de pegar a conversa.
 */
describe('aindaAutorizada', () => {
  it('a execução que começou antes da tomada não envia mais', () => {
    const antes = bot()
    const r = tentarAssumir(antes, 'ana')
    expect(r.ok).toBe(true)
    if (!r.ok) return

    // A execução anotou a revisão de antes; o controle já é outro.
    expect(aindaAutorizada(r.controle, antes.revisao)).toBe(false)
  })

  it('a execução da revisão atual envia', () => {
    const agora = daAna()
    expect(aindaAutorizada(agora, agora.revisao)).toBe(true)
  })

  /**
   * Falha fechado. Execução que não anotou revisão não tem como provar que foi
   * autorizada: uma resposta perdida alguém reenvia, uma resposta do bot por
   * cima de um atendente é a empresa falando duas coisas ao cliente.
   */
  it.each([null, undefined])('sem revisão anotada (%s), não envia', (revisao) => {
    expect(aindaAutorizada(daAna(), revisao)).toBe(false)
  })

  /**
   * Duas trocas seguidas não voltam a autorizar a primeira. É por isso que a
   * revisão é contador e não relógio: duas trocas no mesmo milissegundo dariam
   * o mesmo instante, e a comparação passaria batida.
   */
  it('trocas encadeadas não reabilitam uma execução antiga', () => {
    const inicial = bot()
    const assumida = tentarAssumir(inicial, 'ana')
    expect(assumida.ok).toBe(true)
    if (!assumida.ok) return

    const devolvida = devolverAFila(assumida.controle)
    const retomada = retomarBot(devolvida)

    // A condução voltou a ser 'bot', igual ao começo. A autorização, não.
    expect(retomada.conducao).toBe(inicial.conducao)
    expect(aindaAutorizada(retomada, inicial.revisao)).toBe(false)
  })
})

describe('comoConducao', () => {
  it.each([
    ['bot', 'Chatbot'],
    ['aguardando', 'Aguardando equipe'],
    ['humano', 'Em atendimento'],
    ['sem_conducao', 'Sem condução'],
  ] as const)('%s vira %s', (conducao, rotulo) => {
    expect(comoConducao({ conducao, responsavelId: null, revisao: 1 })).toBe(rotulo)
  })
})
