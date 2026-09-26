import { describe, expect, it } from 'vitest'
import { NICHOS, PACOTES } from './nichos'
import {
  LISTAS_DA_FICHA,
  escreverFicha,
  lerBlocos,
  lerFicha,
  listasDoRamo,
  marcadasDaLista,
  normalizar,
  placarDaFicha,
} from './ficha-do-assistente'

const perguntas = PACOTES.aulas.ficha.perguntas

// No formato dos textos da MGM e da PCYES: abertura, blocos com título do dono.
const TEXTO = `Estúdio Exemplo: pilates em São Paulo.

== ONDE FICA ==
Rua A, 10.

== HORÁRIOS DE FUNCIONAMENTO ==
Segunda a sexta, 7h às 21h.

== AULA EXPERIMENTAL: SÓ PILATES EM APARELHO ==
Gratuita.

== NOSSA EQUIPE ==
Três professoras.`

describe('ler o texto como ficha', () => {
  it('separa abertura e blocos', () => {
    const blocos = lerBlocos(TEXTO)
    expect(blocos[0]).toEqual({ titulo: null, corpo: 'Estúdio Exemplo: pilates em São Paulo.' })
    expect(blocos.map((b) => b.titulo)).toEqual([null, 'ONDE FICA', 'HORÁRIOS DE FUNCIONAMENTO', 'AULA EXPERIMENTAL: SÓ PILATES EM APARELHO', 'NOSSA EQUIPE'])
  })

  it('reconhece o bloco pelo começo do título, sem acento, e guarda o título do dono', () => {
    const ficha = lerFicha(TEXTO, perguntas)
    expect(ficha.respostas.horarios).toEqual({ titulo: 'HORÁRIOS DE FUNCIONAMENTO', texto: 'Segunda a sexta, 7h às 21h.' })
    expect(ficha.respostas.experimental?.titulo).toBe('AULA EXPERIMENTAL: SÓ PILATES EM APARELHO')
    expect(ficha.respostas.onde?.texto).toBe('Rua A, 10.')
  })

  it('bloco que a ficha não conhece vai inteiro, com título, para "mais"', () => {
    expect(lerFicha(TEXTO, perguntas).mais).toBe('== NOSSA EQUIPE ==\nTrês professoras.')
  })

  it('abrir e salvar sem mudar nada não perde nenhum bloco nem palavra', () => {
    const volta = escreverFicha(lerFicha(TEXTO, perguntas), perguntas)
    expect(lerBlocos(volta).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo)))).toEqual(
      lerBlocos(TEXTO).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo))),
    )
    // E ler de novo o que escreveu dá a mesma ficha.
    expect(lerFicha(volta, perguntas)).toEqual(lerFicha(TEXTO, perguntas))
  })

  it('pergunta sem resposta não vira bloco vazio', () => {
    const texto = escreverFicha(lerFicha(TEXTO, perguntas), perguntas)
    expect(texto).not.toMatch(/== REPOSIÇÃO ==/)
  })

  it('a lista escrita pela ficha volta como lista; a mesma em prosa vai para "mais"', () => {
    const ficha = { ...lerFicha('', perguntas), listas: { pode: ['Informar horário e endereço'], nunca: null, passar: null } }
    const texto = escreverFicha(ficha, perguntas)
    expect(texto).toContain('== O QUE O ASSISTENTE PODE FAZER ==\n- Informar horário e endereço')
    expect(lerFicha(texto, perguntas).listas.pode).toEqual(['Informar horário e endereço'])
    const prosa = lerFicha('== O QUE O ASSISTENTE PODE FAZER ==\nQuase tudo.', perguntas)
    expect(prosa.listas.pode).toBeNull()
    expect(prosa.mais).toContain('Quase tudo.')
  })
})

describe('as listas de marcar', () => {
  it('lista que ainda não existe nasce toda marcada', () => {
    const [pode] = listasDoRamo(PACOTES.aulas.ficha.pode)
    expect(marcadasDaLista(pode!, null)).toEqual(PACOTES.aulas.ficha.pode)
  })

  it('as de segurança entram sempre, mesmo desmarcadas', () => {
    const nunca = LISTAS_DA_FICHA.find((l) => l.id === 'nunca')!
    const travadas = nunca.opcoes.filter((o) => o.travada).map((o) => o.texto)
    expect(travadas.length).toBeGreaterThan(0)
    for (const texto of travadas) expect(marcadasDaLista(nunca, [])).toContain(texto)
  })
})

describe('o placar', () => {
  it('conta as perguntas do ramo respondidas e diz as que faltam', () => {
    const placar = placarDaFicha(lerFicha(TEXTO, perguntas), perguntas)
    expect(placar.total).toBe(perguntas.length)
    expect(placar.respondidas).toBe(3)
    expect(placar.faltam.map((p) => p.id)).toContain('reposicao')
  })
})

describe('as perguntas de cada ramo', () => {
  it('todo ramo tem ficha, com ids únicos e começos sem acento', () => {
    for (const nicho of NICHOS) {
      const { perguntas: lista, pode } = PACOTES[nicho].ficha
      expect(lista.length, nicho).toBeGreaterThanOrEqual(5)
      expect(pode.length, nicho).toBeGreaterThan(0)
      expect(new Set(lista.map((p) => p.id)).size, nicho).toBe(lista.length)
      for (const pergunta of lista) {
        for (const inicio of pergunta.comeca) expect(inicio, `${nicho}: ${pergunta.id}`).toBe(normalizar(inicio))
        expect(pergunta.doCliente.trim(), pergunta.id).not.toBe('')
      }
    }
  })

  it('nenhum título da ficha é confundido com o de uma lista', () => {
    for (const nicho of NICHOS)
      for (const pergunta of PACOTES[nicho].ficha.perguntas)
        for (const lista of LISTAS_DA_FICHA) expect(pergunta.comeca.some((c) => normalizar(lista.titulo).startsWith(c))).toBe(false)
  })
})
