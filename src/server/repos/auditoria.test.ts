import { afterAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { listarAtos, listarImpersonacoes, registrar } from './auditoria'
import { apagarCliente, criarCliente } from './clientes'

const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-audit-${Math.random().toString(36).slice(2, 8)}`

const contas: string[] = []

afterAll(async () => {
  if (!temCredencial) return
  for (const id of contas) await apagarCliente(id)
})

describe.skipIf(!temCredencial)('auditoria', () => {
  it('registra o ato e o devolve na conta certa', async () => {
    const conta = await criarCliente(`${marca} conta`)
    contas.push(conta.id)

    await registrar({
      acao: 'publicou_fluxo',
      contaId: conta.id,
      contaNome: conta.nome,
      autorEmail: 'gente@exemplo.test',
      alvoTipo: 'flow',
      alvoId: 'abc',
      alvoNome: 'PRINCIPAL',
      detalhes: { versao: 3 },
    })

    const atos = await listarAtos({ contaId: conta.id })
    expect(atos).toHaveLength(1)
    expect(atos[0]).toMatchObject({
      acao: 'publicou_fluxo',
      alvoNome: 'PRINCIPAL',
      detalhes: { versao: 3 },
    })
  })

  it('separa o que foi feito de dentro de um "entrar como"', async () => {
    // É a coluna que distingue "o cliente fez" de "a 4YU fez em nome dele".
    // Sem ela a auditoria mente por omissão.
    const conta = await criarCliente(`${marca} imperso`)
    contas.push(conta.id)

    await registrar({ acao: 'apagou_contato', contaId: conta.id })
    await registrar({ acao: 'publicou_fluxo', contaId: conta.id, impersonadoPor: null })

    const todos = await listarAtos({ contaId: conta.id })
    expect(todos).toHaveLength(2)
    expect(todos.every((a) => a.impersonadoPor === null)).toBe(true)

    const soImpersonadas = await listarImpersonacoes()
    expect(soImpersonadas.some((a) => a.contaId === conta.id)).toBe(false)
  })

  /**
   * A garantia que dá sentido ao resto: a aplicação **não consegue** reescrever
   * o passado. `service_role` tem só `insert` e `select` (migration 0021), e o
   * `truncate` que sobrou na primeira escrita da migration tornava tudo isto
   * decorativo.
   */
  it('a aplicação não apaga nem edita o que já foi registrado', async () => {
    const conta = await criarCliente(`${marca} imutavel`)
    contas.push(conta.id)

    await registrar({ acao: 'apagou_cliente', contaId: conta.id, alvoNome: 'original' })
    const [ato] = await listarAtos({ contaId: conta.id })

    const alterado = await db()
      .from('af_auditoria')
      .update({ alvo_nome: 'reescrito' })
      .eq('id', ato!.id)
    expect(alterado.error).not.toBeNull()

    const apagado = await db().from('af_auditoria').delete().eq('id', ato!.id)
    expect(apagado.error).not.toBeNull()

    const [depois] = await listarAtos({ contaId: conta.id })
    expect(depois?.alvoNome).toBe('original')
  })

  /**
   * Auditoria que derruba a ação auditada é pior do que auditoria nenhuma: o
   * cliente perderia a publicação por causa do registro dela.
   */
  it('falha de registro não estoura na cara de quem agiu', async () => {
    await expect(
      registrar({ acao: 'ato_invalido', contaId: '00000000-0000-0000-0000-000000000000' }),
    ).resolves.toBeUndefined()
  })

  it('apagar a conta não apaga o que foi feito nela', async () => {
    // `on delete set null`, não `cascade`: sumir com o próprio rastro não pode
    // ser uma questão de pedir a exclusão da conta.
    const conta = await criarCliente(`${marca} some`)
    await registrar({ acao: 'apagou_cliente', contaId: conta.id, contaNome: conta.nome })

    await apagarCliente(conta.id)

    const orfaos = await listarAtos({ limite: 200 })
    const nosso = orfaos.find((a) => a.contaNome === conta.nome)
    expect(nosso).toBeDefined()
    expect(nosso?.contaId).toBeNull()
  })
})
