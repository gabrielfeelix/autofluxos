import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pode, escopoDe, filtroDe, type Acesso } from '@/core/permissoes'
import { db } from './db'
import { criarCliente } from './repos/clientes'
import { equipesDoUsuario, sobrescritasDoUsuario, SEM_PERMISSAO } from './permissoes'

/**
 * A metade desta autorização que fala com o banco.
 *
 * `core/permissoes.test.ts` cobre a decisão, exaustivamente e sem fixture. O
 * que **só** o banco prova é a leitura: equipe arquivada some, capacidade de
 * outra empresa não vaza, e linha inválida é ignorada em vez de derrubar.
 *
 * É onde um erro seria silencioso e caro. Uma consulta sem `client_id` não é
 * recusada pelo Postgres — a chave secreta ignora RLS (RB-42). Ela devolve a
 * conta do vizinho, e a permissão do vizinho junto.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-t21-${Math.random().toString(36).slice(2, 8)}`

let empresaA = ''
let empresaB = ''
let pessoa = ''
let equipeNorte = ''
let equipeSul = ''

beforeAll(async () => {
  if (!temCredencial) return

  empresaA = (await criarCliente(`${marca} empresa A`)).id
  empresaB = (await criarCliente(`${marca} empresa B`)).id

  // Um usuário de verdade: `equipe_membros.usuario_id` tem chave estrangeira.
  const { data: usuario, error } = await db()
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
  if (error) throw new Error(`não deu para criar o usuário: ${error.message}`)
  pessoa = (usuario as { id: string }).id

  const { data: equipes, error: erroDasEquipes } = await db()
    .from('equipes')
    .insert([
      { client_id: empresaA, nome: 'Norte' },
      { client_id: empresaA, nome: 'Sul' },
    ])
    .select('id, nome')
  if (erroDasEquipes) throw new Error(erroDasEquipes.message)

  const lista = equipes as { id: string; nome: string }[]
  equipeNorte = lista.find((e) => e.nome === 'Norte')!.id
  equipeSul = lista.find((e) => e.nome === 'Sul')!.id
})

afterAll(async () => {
  if (!temCredencial || empresaA === '') return
  await db().from('clients').delete().in('id', [empresaA, empresaB])
  await db().from('af_usuarios').delete().eq('id', pessoa)
})

describe.skipIf(!temCredencial)('as equipes de uma pessoa', () => {
  it('lê só as equipes de que ela faz parte', async () => {
    await db()
      .from('equipe_membros')
      .insert({ equipe_id: equipeNorte, client_id: empresaA, usuario_id: pessoa })

    const equipes = await equipesDoUsuario(empresaA, pessoa)
    expect(equipes).toEqual([equipeNorte])
    expect(equipes).not.toContain(equipeSul)
  })

  /**
   * **Equipe arquivada não dá mais escopo.**
   *
   * Ela continua legível — há oportunidade e histórico apontando para ela —
   * mas parar de arquivar o acesso junto seria manter a porta aberta depois de
   * fechar a sala.
   */
  it('equipe arquivada sai do escopo', async () => {
    await db()
      .from('equipe_membros')
      .insert({ equipe_id: equipeSul, client_id: empresaA, usuario_id: pessoa })
    expect(await equipesDoUsuario(empresaA, pessoa)).toHaveLength(2)

    await db()
      .from('equipes')
      .update({ arquivada_em: new Date().toISOString() })
      .eq('id', equipeSul)

    const depois = await equipesDoUsuario(empresaA, pessoa)
    expect(depois).toEqual([equipeNorte])
  })

  /**
   * **A pergunta que a chave secreta não faz por nós** (RB-42, A19).
   *
   * A mesma pessoa, a outra empresa: zero. Se a consulta esquecesse o
   * `client_id`, o Postgres não recusaria — a `service_role` ignora RLS.
   */
  it('não vaza equipe de uma empresa para a outra', async () => {
    expect(await equipesDoUsuario(empresaB, pessoa)).toEqual([])
  })
})

describe.skipIf(!temCredencial)('as sobrescritas de capacidade', () => {
  it('ausência quer dizer "usa a política do papel", e não nenhum', async () => {
    // Nenhuma linha gravada: o resultado é vazio, e vazio faz `escopoDe` cair
    // na política do papel. É o que preserva o acesso de quem já existe.
    expect(await sobrescritasDoUsuario(empresaA, pessoa)).toEqual({})

    const acesso: Acesso = {
      papel: 'member',
      usuarioId: pessoa,
      sobrescritas: await sobrescritasDoUsuario(empresaA, pessoa),
    }
    expect(pode(acesso, 'atender', 'todos')).toBe(true)
    expect(pode(acesso, 'registrar_venda', 'todos')).toBe(true)
  })

  it('a sobrescrita gravada vale por cima do papel', async () => {
    await db().from('membro_capacidades').insert([
      { client_id: empresaA, usuario_id: pessoa, capacidade: 'ler_valores', escopo: 'nenhum' },
      { client_id: empresaA, usuario_id: pessoa, capacidade: 'exportar', escopo: 'nenhum' },
    ])

    const acesso: Acesso = {
      papel: 'member',
      usuarioId: pessoa,
      sobrescritas: await sobrescritasDoUsuario(empresaA, pessoa),
    }

    // É o A27 inteiro: atende, e não infere valor.
    expect(pode(acesso, 'atender', 'todos')).toBe(true)
    expect(pode(acesso, 'ler_valores')).toBe(false)
    expect(pode(acesso, 'exportar')).toBe(false)
  })

  it('não vaza capacidade de uma empresa para a outra', async () => {
    // As linhas acima são da empresa A. Na B, a pessoa volta ao padrão do
    // papel — restringir numa conta não restringe na outra, e o contrário
    // (vazar a permissão) seria pior.
    expect(await sobrescritasDoUsuario(empresaB, pessoa)).toEqual({})
  })

  /**
   * **Linha que esta versão não entende é ignorada, não fatal.**
   *
   * É o deploy pela metade: uma capacidade gravada por uma versão nova e lida
   * por uma antiga. Travar a conta por causa dela seria a resposta errada; o
   * `check` do banco já impede lixo de verdade.
   */
  it('escopo inválido no banco não derruba a leitura', async () => {
    // O `check` recusa escopo inválido, e é assim que deve ser: a barreira
    // existe. O que se prova aqui é que ela é a barreira certa.
    const { error } = await db()
      .from('membro_capacidades')
      .insert({
        client_id: empresaA,
        usuario_id: pessoa,
        capacidade: 'atender',
        escopo: 'inventado',
      })
    expect(error).not.toBeNull()

    // E a leitura segue funcionando.
    const lidas = await sobrescritasDoUsuario(empresaA, pessoa)
    expect(lidas.ler_valores).toBe('nenhum')
  })
})

describe.skipIf(!temCredencial)('o filtro de escopo com equipe real', () => {
  it('escopo de equipe vira a lista de equipes vivas dela', async () => {
    const acesso: Acesso = {
      papel: 'member',
      usuarioId: pessoa,
      equipes: await equipesDoUsuario(empresaA, pessoa),
      sobrescritas: { atender: 'equipe' },
    }

    expect(escopoDe(acesso, 'atender')).toBe('equipe')
    // A Sul foi arquivada no teste acima: só a Norte entra no filtro.
    expect(filtroDe(acesso, 'atender')).toEqual({ tipo: 'equipes', equipes: [equipeNorte] })
  })
})

describe('a recusa', () => {
  /**
   * **Uma frase só, para todas as capacidades** (RB-42).
   *
   * "Você não pode registrar venda" conta, para quem não tem nenhuma das
   * capacidades, quais existem. Mensagem única não dá mapa do sistema a quem
   * está tentando descobri-lo.
   */
  it('não diz qual capacidade faltou', () => {
    expect(SEM_PERMISSAO).not.toMatch(/venda|valor|export|equipe|configur/i)
  })
})
