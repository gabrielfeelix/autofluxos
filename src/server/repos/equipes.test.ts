import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POLITICAS } from '@/core/permissoes'
import { db } from '../db'
import { criarCliente } from './clientes'
import {
  arquivarEquipe,
  capacidadesPorMembro,
  criarEquipe,
  definirCapacidades,
  definirEquipesDoMembro,
  equipesPorMembro,
  listarEquipes,
  pendenciasDoMembro,
} from './equipes'

/**
 * Equipes e capacidades no banco (0073, T2.2).
 *
 * O que só o banco prova: o nome único entre as ativas, o arquivamento que
 * tira do escopo sem apagar, e — o mais importante — que **escopo igual ao do
 * papel não vira linha**. Gravar o que já é regra congelaria a pessoa na
 * política de hoje, e trocar o papel dela depois não teria efeito nenhum.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-t22-${Math.random().toString(36).slice(2, 8)}`

let empresaA = ''
let empresaB = ''
let pessoa = ''

beforeAll(async () => {
  if (!temCredencial) return
  empresaA = (await criarCliente(`${marca} empresa A`)).id
  empresaB = (await criarCliente(`${marca} empresa B`)).id

  const { data, error } = await db()
    .from('af_usuarios')
    .insert({
      id: crypto.randomUUID(),
      name: `${marca} pessoa`,
      email: `${marca}@exemplo.test`,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  pessoa = (data as { id: string }).id
})

afterAll(async () => {
  if (!temCredencial || empresaA === '') return
  await db().from('clients').delete().in('id', [empresaA, empresaB])
  await db().from('af_usuarios').delete().eq('id', pessoa)
})

describe.skipIf(!temCredencial)('as equipes', () => {
  it('cria, lista e conta gente', async () => {
    const norte = await criarEquipe(empresaA, 'Norte')
    expect(norte.ok).toBe(true)
    if (!norte.ok) return

    const lista = await listarEquipes(empresaA)
    expect(lista).toHaveLength(1)
    expect(lista[0]?.nome).toBe('Norte')
    expect(lista[0]?.pessoas).toBe(0)

    expect((await definirEquipesDoMembro(empresaA, pessoa, [norte.id])).ok).toBe(true)
    expect((await listarEquipes(empresaA))[0]?.pessoas).toBe(1)
  })

  it('recusa nome repetido entre as ativas', async () => {
    const repetida = await criarEquipe(empresaA, 'norte')
    expect(repetida.ok).toBe(false)
    if (repetida.ok) return
    expect(repetida.motivo).toContain('já existe')
  })

  it('arquivar tira do escopo e libera o nome', async () => {
    const lista = await listarEquipes(empresaA)
    const norte = lista.find((e) => e.nome === 'Norte')!

    expect((await arquivarEquipe(empresaA, norte.id)).ok).toBe(true)
    expect(await listarEquipes(empresaA)).toHaveLength(0)

    // O vínculo continua na tabela, mas sai do escopo: é o que separa
    // "arquivada" de "apagada".
    expect(await equipesPorMembro(empresaA)).toEqual(new Map())

    // E o nome volta a ser usável.
    expect((await criarEquipe(empresaA, 'Norte')).ok).toBe(true)
  })

  /**
   * **Equipe de outra conta não entra** (RB-42, A19).
   *
   * Os ids chegam de formulário, e a chave estrangeira só sabe que eles
   * existem — não de quem são. A chave secreta ignora RLS, então quem confere
   * é este código.
   */
  it('recusa equipe que não é da conta', async () => {
    const daOutra = await criarEquipe(empresaB, 'Sul')
    expect(daOutra.ok).toBe(true)
    if (!daOutra.ok) return

    const r = await definirEquipesDoMembro(empresaA, pessoa, [daOutra.id])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toContain('não é desta conta')
  })

  it('mandar lista vazia tira de todas', async () => {
    const lista = await listarEquipes(empresaA)
    expect((await definirEquipesDoMembro(empresaA, pessoa, [lista[0]!.id])).ok).toBe(true)
    expect((await equipesPorMembro(empresaA)).get(pessoa)).toHaveLength(1)

    expect((await definirEquipesDoMembro(empresaA, pessoa, [])).ok).toBe(true)
    expect((await equipesPorMembro(empresaA)).get(pessoa)).toBeUndefined()
  })
})

describe.skipIf(!temCredencial)('as capacidades', () => {
  const doPapel = POLITICAS.member

  it('grava só o que é diferente do papel', async () => {
    const r = await definirCapacidades(
      empresaA,
      pessoa,
      {
        // Diferente: `member` lê valores, esta pessoa não.
        ler_valores: 'nenhum',
        // Igual ao papel: não deve virar linha.
        atender: doPapel.atender,
      },
      doPapel,
      null,
    )
    expect(r.ok).toBe(true)

    const gravadas = (await capacidadesPorMembro(empresaA)).get(pessoa) ?? {}
    expect(gravadas.ler_valores).toBe('nenhum')
    expect(gravadas.atender).toBeUndefined()
  })

  /**
   * **Voltar ao padrão apaga a linha, e não grava o valor do papel.**
   *
   * É a diferença entre "igual ao papel" e "igual ao papel de hoje": gravar o
   * valor deixaria a pessoa congelada, e promover o papel dela depois não teria
   * efeito nenhum.
   */
  it('voltar ao padrão do papel apaga a sobrescrita', async () => {
    expect(
      (await definirCapacidades(empresaA, pessoa, { ler_valores: doPapel.ler_valores }, doPapel, null))
        .ok,
    ).toBe(true)

    const gravadas = (await capacidadesPorMembro(empresaA)).get(pessoa) ?? {}
    expect(gravadas.ler_valores).toBeUndefined()
  })

  it('salvar de novo substitui em vez de duplicar', async () => {
    await definirCapacidades(empresaA, pessoa, { exportar: 'nenhum' }, doPapel, null)
    await definirCapacidades(empresaA, pessoa, { exportar: 'proprios' }, doPapel, null)

    const { count } = await db()
      .from('membro_capacidades')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', empresaA)
      .eq('usuario_id', pessoa)
      .eq('capacidade', 'exportar')

    expect(count).toBe(1)
    expect((await capacidadesPorMembro(empresaA)).get(pessoa)?.exportar).toBe('proprios')
  })

  it('não vaza para a outra empresa', async () => {
    expect((await capacidadesPorMembro(empresaB)).get(pessoa)).toBeUndefined()
  })
})

describe.skipIf(!temCredencial)('o que fica pendurado', () => {
  /**
   * A RB-40 manda decidir o destino das atribuições abertas e **nunca deixar
   * referências sem tratamento**. Contar é o mínimo: sem o número, quem remove
   * confirma sem saber que oito conversas vão ficar sem dono.
   */
  it('conta conversas e cartões da pessoa', async () => {
    const vazio = await pendenciasDoMembro(empresaA, pessoa)
    expect(vazio).toEqual({ conversas: 0, cartoes: 0 })
  })
})
