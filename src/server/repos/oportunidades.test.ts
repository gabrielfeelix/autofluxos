import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { criarEquipe, definirEquipesDoMembro } from './equipes'
import { criarProduto, arquivarProduto } from './produtos'
import {
  atribuirCartao,
  avaliarCartao,
  criarQuadro,
  definirInteresse,
  listarCartoes,
  oportunidadesAbertasDoContato,
  porNoQuadro,
} from './quadros'

/**
 * A oportunidade da T5.1 contra o banco (0079).
 *
 * Três coisas que só aparecem aqui:
 *
 *  1. **temperatura de cartão nasce `null`**, e `null` não é `morno`. A 0068
 *     pôs default `'morno'` em `contacts`, que sempre significou "ninguém
 *     opinou"; se a 0079 tivesse copiado aquele default para as negociações,
 *     este teste veria `morno` em cartão que ninguém avaliou;
 *  2. **oportunidade de outra equipe não vira sugestão de duplicata** (RB-26),
 *     e o filtro é aplicado na consulta, não na tela;
 *  3. **produto arquivado não pode ser escolhido**, mas o vínculo já feito
 *     continua legível (RB-24).
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-opo-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7)
  .toString()
  .padStart(7, '0')

let clienteId = ''
let contatoId = ''
let quadroId = ''
let norte = ''
let sul = ''
let daNorte = ''
let daSul = ''

async function criarPessoa(sufixo: string): Promise<string> {
  const { data, error } = await db()
    .from('af_usuarios')
    .insert({
      id: crypto.randomUUID(),
      name: `${marca} ${sufixo}`,
      email: `${marca}-${sufixo}@exemplo.test`,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

beforeAll(async () => {
  if (!temCredencial) return

  clienteId = (await criarCliente(`${marca} cliente`)).id
  contatoId = (await acharOuCriarContato(clienteId, `5511${seed}01`, 'Ana')).id

  const quadro = await criarQuadro(clienteId, `${marca} comercial`)
  if (quadro.ok) quadroId = quadro.id

  const eqNorte = await criarEquipe(clienteId, `${marca} Norte`)
  const eqSul = await criarEquipe(clienteId, `${marca} Sul`)
  if (eqNorte.ok) norte = eqNorte.id
  if (eqSul.ok) sul = eqSul.id

  daNorte = await criarPessoa('norte')
  daSul = await criarPessoa('sul')
  await definirEquipesDoMembro(clienteId, daNorte, [norte])
  await definirEquipesDoMembro(clienteId, daSul, [sul])
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (daNorte) await db().from('af_usuarios').delete().in('id', [daNorte, daSul])
})

describe.skipIf(!temCredencial)('a temperatura é da oportunidade, e nasce sem opinião', () => {
  it('cartão novo vem com temperatura nula, e não com o morno do contato', async () => {
    expect((await porNoQuadro(clienteId, quadroId, [contatoId])).ok).toBe(true)

    const cartoes = await listarCartoes(clienteId, quadroId)
    expect(cartoes).toHaveLength(1)

    // O default de `contacts.temperatura` é 'morno' desde a 0068, e o contato
    // desta fixture o tem. O cartão **não** pode tê-lo herdado: seria um
    // default virando avaliação humana.
    const doContato = await db()
      .from('contacts')
      .select('temperatura')
      .eq('id', contatoId)
      .single()
    expect((doContato.data as { temperatura: string }).temperatura).toBe('morno')

    expect(cartoes[0]?.temperatura ?? null).toBeNull()
  })

  it('avaliar grava, e desfazer volta para não avaliada', async () => {
    const cartaoId = (await listarCartoes(clienteId, quadroId))[0]!.id

    expect((await avaliarCartao(clienteId, cartaoId, 'quente')).ok).toBe(true)
    expect((await listarCartoes(clienteId, quadroId))[0]?.temperatura).toBe('quente')

    // `null` é estado legítimo: quem avaliou errado desfaz sem ter que
    // escolher 'morno' por falta de opção.
    expect((await avaliarCartao(clienteId, cartaoId, null)).ok).toBe(true)
    expect((await listarCartoes(clienteId, quadroId))[0]?.temperatura ?? null).toBeNull()
  })

  it('não avalia cartão de outra conta', async () => {
    const cartaoId = (await listarCartoes(clienteId, quadroId))[0]!.id
    const outro = (await criarCliente(`${marca} intruso`)).id
    expect((await avaliarCartao(outro, cartaoId, 'quente')).ok).toBe(false)
    await db().from('clients').delete().eq('id', outro)
  })
})

describe.skipIf(!temCredencial)('o interesse vem do catálogo da própria conta', () => {
  it('vincula produto ativo e mostra o nome de hoje', async () => {
    const cartaoId = (await listarCartoes(clienteId, quadroId))[0]!.id
    const produto = await criarProduto(clienteId, `${marca} Plano Ouro`, 'servico')
    expect(produto.ok).toBe(true)
    if (!produto.ok) return

    expect((await definirInteresse(clienteId, cartaoId, produto.produto.id)).ok).toBe(true)

    const cartao = (await listarCartoes(clienteId, quadroId))[0]
    expect(cartao?.produtoId).toBe(produto.produto.id)
    expect(cartao?.produtoNome).toBe(`${marca} Plano Ouro`)
  })

  it('recusa produto de outra conta, que a FK sozinha deixaria passar', async () => {
    const cartaoId = (await listarCartoes(clienteId, quadroId))[0]!.id
    const outro = (await criarCliente(`${marca} vizinho`)).id
    const doVizinho = await criarProduto(outro, 'Plano do vizinho', 'produto')
    expect(doVizinho.ok).toBe(true)
    if (!doVizinho.ok) return

    // A FK garante que o id existe em `produtos`; ela não garante de quem é.
    const r = await definirInteresse(clienteId, cartaoId, doVizinho.produto.id)
    expect(r).toEqual({ ok: false, motivo: 'esse item do catálogo não existe' })

    await db().from('clients').delete().eq('id', outro)
  })

  it('arquivado não pode ser escolhido, mas o vínculo já feito continua legível', async () => {
    const cartaoId = (await listarCartoes(clienteId, quadroId))[0]!.id
    const produto = await criarProduto(clienteId, `${marca} Plano Antigo`, 'produto')
    expect(produto.ok).toBe(true)
    if (!produto.ok) return

    expect((await definirInteresse(clienteId, cartaoId, produto.produto.id)).ok).toBe(true)
    await arquivarProduto(clienteId, produto.produto.id, true)

    // O que já estava vinculado continua lendo o nome: é a RB-24.
    expect((await listarCartoes(clienteId, quadroId))[0]?.produtoNome).toBe(
      `${marca} Plano Antigo`,
    )

    // Mas escolher de novo é recusado.
    await definirInteresse(clienteId, cartaoId, null)
    const r = await definirInteresse(clienteId, cartaoId, produto.produto.id)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toContain('arquivado')
  })
})

describe.skipIf(!temCredencial)('sugestão de duplicata respeita o escopo (RB-26)', () => {
  it('quem só vê a própria equipe não recebe a oportunidade da outra', async () => {
    const cartaoId = (await listarCartoes(clienteId, quadroId))[0]!.id
    // A oportunidade aberta é da pessoa do Sul.
    expect((await atribuirCartao(clienteId, cartaoId, daSul)).ok).toBe(true)

    // Quem enxerga tudo vê.
    const tudo = await oportunidadesAbertasDoContato(clienteId, contatoId, { tipo: 'tudo' })
    expect(tudo.map((o) => o.cartaoId)).toContain(cartaoId)

    // Quem enxerga só a equipe Norte **não** vê: sugerir "já existe uma
    // negociação" sem poder dizer qual vaza o negócio do vizinho.
    const soNorte = await oportunidadesAbertasDoContato(clienteId, contatoId, {
      tipo: 'equipes',
      equipes: [norte],
    })
    expect(soNorte).toHaveLength(0)

    // E a equipe Sul vê a dela.
    const soSul = await oportunidadesAbertasDoContato(clienteId, contatoId, {
      tipo: 'equipes',
      equipes: [sul],
    })
    expect(soSul.map((o) => o.cartaoId)).toEqual([cartaoId])
  })

  it('escopo próprio olha o responsável, e escopo impossível não consulta nada', async () => {
    const cartaoId = (await listarCartoes(clienteId, quadroId))[0]!.id

    const daPessoaCerta = await oportunidadesAbertasDoContato(clienteId, contatoId, {
      tipo: 'proprios',
      usuarioId: daSul,
    })
    expect(daPessoaCerta.map((o) => o.cartaoId)).toEqual([cartaoId])

    const daOutraPessoa = await oportunidadesAbertasDoContato(clienteId, contatoId, {
      tipo: 'proprios',
      usuarioId: daNorte,
    })
    expect(daOutraPessoa).toHaveLength(0)

    expect(
      await oportunidadesAbertasDoContato(clienteId, contatoId, { tipo: 'impossivel' }),
    ).toHaveLength(0)
  })

  it('cartão sem responsável não pertence a equipe nenhuma', async () => {
    const cartaoId = (await listarCartoes(clienteId, quadroId))[0]!.id
    expect((await atribuirCartao(clienteId, cartaoId, null)).ok).toBe(true)

    // Órfão some do escopo de equipe, e continua visível para quem vê tudo.
    expect(
      await oportunidadesAbertasDoContato(clienteId, contatoId, {
        tipo: 'equipes',
        equipes: [sul],
      }),
    ).toHaveLength(0)
    expect(
      await oportunidadesAbertasDoContato(clienteId, contatoId, { tipo: 'tudo' }),
    ).toHaveLength(1)
  })
})
