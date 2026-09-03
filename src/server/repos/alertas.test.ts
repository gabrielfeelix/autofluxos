import { afterAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import {
  contarAlertasAbertos,
  gravarAlerta,
  limiteDoAlerta,
  listarAlertas,
  marcarAlertaVisto,
} from './alertas'

/**
 * Como os outros testes de repositório: só rodam com credencial, e limpam o
 * que criaram. A marca no título é o que permite achar as linhas deste teste
 * sem depender de contar quantas existem — a tabela é global e a suíte roda em
 * paralelo com o produto vivo.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-teste-${Math.random().toString(36).slice(2, 8)}`
const criados: string[] = []

afterAll(async () => {
  if (!temCredencial) return
  for (const id of criados) await db().from('alertas').delete().eq('id', id)
})

async function gravarComMarca(titulo: string, contexto = {}) {
  await gravarAlerta({ titulo: `${marca} ${titulo}`, detalhe: 'stack de mentira', contexto })
  const [linha] = await listarAlertas({ limite: 200 }).then((tudo) =>
    tudo.filter((a) => a.titulo.startsWith(marca)),
  )
  if (linha) criados.push(linha.id)
  return linha
}

describe.runIf(temCredencial)('alertas', () => {
  it('grava o alerta e o devolve para a tela', async () => {
    const alerta = await gravarComMarca('a Cloud API recusou a entrega', {
      contato: 'abc-123',
      tentativa: 2,
    })

    expect(alerta?.titulo).toContain('a Cloud API recusou a entrega')
    expect(alerta?.detalhe).toBe('stack de mentira')
    expect(alerta?.contexto).toEqual({ contato: 'abc-123', tentativa: 2 })
    expect(alerta?.vistoEm).toBeNull()
  })

  /**
   * O contexto vem de seis pontos de chamada diferentes, e vários passam campo
   * que às vezes existe e às vezes não. Sem a limpeza, a tela mostraria
   * `cliente: null` — pior que não mostrar nada, porque parece informação.
   */
  it('não grava campo vazio, nulo nem ausente no contexto', async () => {
    const alerta = await gravarComMarca('falha com contexto pela metade', {
      cliente: 'existe',
      vazio: '',
      nulo: null,
      ausente: undefined,
    })

    expect(alerta?.contexto).toEqual({ cliente: 'existe' })
  })

  it('marcar como visto tira do contador de abertos', async () => {
    const alerta = await gravarComMarca('para marcar')
    expect(alerta).toBeDefined()

    const antes = await contarAlertasAbertos()
    await marcarAlertaVisto(alerta!.id)
    const depois = await contarAlertasAbertos()

    expect(depois).toBe(antes - 1)

    const [relido] = await listarAlertas({ limite: 200 }).then((t) =>
      t.filter((a) => a.id === alerta!.id),
    )
    expect(relido?.vistoEm).not.toBeNull()
  })

  it('o filtro de abertos não traz o que já foi visto', async () => {
    const alerta = await gravarComMarca('some da lista de abertos')
    await marcarAlertaVisto(alerta!.id)

    const abertos = await listarAlertas({ apenasAbertos: true, limite: 200 })
    expect(abertos.some((a) => a.id === alerta!.id)).toBe(false)
  })

})

/**
 * A fronteira do prazo, testada sem banco — e isso é uma decisão, não um
 * atalho.
 *
 * A versão óbvia deste teste seria gravar um alerta, chamar
 * `limparAlertasVencidos` com o relógio 91 dias à frente e conferir que sumiu.
 * Ela apagaria **todos os alertas da tabela**, que é global e compartilhada com
 * o produto rodando: o teste passaria e levaria junto o alerta que alguém
 * precisava ler. `delete` por data não tem como se limitar às linhas do teste.
 *
 * Então o que se testa é o cálculo do corte, que é onde o erro mora de
 * verdade. É a mesma escolha de `limiteDaRetencao`.
 */
describe('o corte dos 90 dias', () => {
  const agora = new Date('2026-09-03T12:00:00.000Z')

  it('corta exatamente 90 dias atrás', () => {
    expect(limiteDoAlerta(agora).toISOString()).toBe('2026-06-05T12:00:00.000Z')
  })

  it('atravessa a virada do ano sem inventar data', () => {
    expect(limiteDoAlerta(new Date('2026-02-15T00:00:00.000Z')).toISOString()).toBe(
      '2025-11-17T00:00:00.000Z',
    )
  })

  it('não mexe no Date que recebeu', () => {
    const original = new Date(agora)
    limiteDoAlerta(agora)
    expect(agora.getTime()).toBe(original.getTime())
  })
})
