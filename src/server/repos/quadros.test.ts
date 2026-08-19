import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ETAPAS_INICIAIS } from '@/core/quadros'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import {
  acharQuadro,
  apagarEtapa,
  apagarQuadro,
  criarEtapa,
  criarQuadro,
  listarCartoes,
  listarQuadros,
  moverCartao,
  moverEtapa,
  porNoQuadro,
  quadrosDoContato,
  renomearEtapa,
  tirarDoQuadro,
} from './quadros'

/**
 * Os quadros contra o banco de verdade (0032).
 *
 * O que precisa ser provado aqui é a recusa: a mesma pessoa duas vezes no mesmo
 * quadro, o cartão movido para a etapa de **outro** quadro, e a etapa apagada
 * com gente dentro. As três são índice e chave estrangeira, e só aparecem
 * contra Postgres.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-qdr-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let outroId = ''
let ana = ''
let bruno = ''
let doOutro = ''
let quadroId = ''
let outroQuadroId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const [cliente, outro] = await Promise.all([
    criarCliente(`${marca} cliente`),
    criarCliente(`${marca} outro`),
  ])
  clienteId = cliente.id
  outroId = outro.id

  const [a, b, c] = await Promise.all([
    acharOuCriarContato(clienteId, `5511${seed}01`, 'Ana'),
    acharOuCriarContato(clienteId, `5511${seed}02`, 'Bruno'),
    acharOuCriarContato(outroId, `5511${seed}03`, 'De outra conta'),
  ])
  ana = a.id
  bruno = b.id
  doOutro = c.id

  const q = await criarQuadro(clienteId, `${marca} comercial`)
  if (q.ok) quadroId = q.id
  const q2 = await criarQuadro(clienteId, `${marca} suporte`)
  if (q2.ok) outroQuadroId = q2.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (outroId) await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('o quadro nasce vivo', () => {
  it('vem com as três etapas neutras, na ordem', async () => {
    // Quadro vazio abre morto: três cliques separam a pessoa de qualquer coisa.
    const quadro = await acharQuadro(clienteId, quadroId)
    expect(quadro?.etapas.map((e) => e.nome)).toEqual([...ETAPAS_INICIAIS])
  })

  it('recusa nome repetido na mesma conta', async () => {
    const r = await criarQuadro(clienteId, `  ${marca} COMERCIAL `)
    expect(r).toEqual({ ok: false, motivo: 'já existe um quadro com este nome' })
  })

  it('o mesmo nome em outra conta é outro quadro', async () => {
    expect((await criarQuadro(outroId, `${marca} comercial`)).ok).toBe(true)
  })

  it('não acha quadro de outra conta pelo id dele', async () => {
    expect(await acharQuadro(outroId, quadroId)).toBeNull()
    expect(await apagarQuadro(outroId, quadroId)).toBe(false)
  })
})

describe.skipIf(!temCredencial)('etapas', () => {
  it('a nova entra no fim e renomear não a move', async () => {
    expect(await criarEtapa(clienteId, quadroId, 'Perdido')).toEqual({ ok: true })

    let quadro = (await acharQuadro(clienteId, quadroId))!
    expect(quadro.etapas.at(-1)!.nome).toBe('Perdido')

    const alvo = quadro.etapas.at(-1)!
    expect(await renomearEtapa(clienteId, quadroId, alvo.id, 'Sem interesse')).toEqual({ ok: true })

    quadro = (await acharQuadro(clienteId, quadroId))!
    expect(quadro.etapas.at(-1)!.nome).toBe('Sem interesse')
  })

  it('recusa nome repetido de etapa', async () => {
    expect(await criarEtapa(clienteId, quadroId, 'novo')).toEqual({
      ok: false,
      motivo: 'já existe uma etapa com este nome',
    })
  })

  it('mover para o lado troca só as duas, e a ponta não move', async () => {
    const antes = (await acharQuadro(clienteId, quadroId))!.etapas
    const segunda = antes[1]!

    expect(await moverEtapa(clienteId, quadroId, segunda.id, 'esquerda')).toBe(true)

    const depois = (await acharQuadro(clienteId, quadroId))!.etapas
    expect(depois[0]!.id).toBe(segunda.id)
    expect(depois[1]!.id).toBe(antes[0]!.id)
    // As outras não foram tocadas.
    expect(depois.slice(2).map((e) => e.id)).toEqual(antes.slice(2).map((e) => e.id))

    expect(await moverEtapa(clienteId, quadroId, depois[0]!.id, 'esquerda')).toBe(false)
  })

  it('não mexe em etapa de quadro de outra conta', async () => {
    const etapa = (await acharQuadro(clienteId, quadroId))!.etapas[0]!
    expect(await renomearEtapa(outroId, quadroId, etapa.id, 'roubada')).toEqual({
      ok: false,
      motivo: 'esta etapa não existe mais',
    })
    expect(await moverEtapa(outroId, quadroId, etapa.id, 'direita')).toBe(false)
  })
})

describe.skipIf(!temCredencial)('cartões', () => {
  it('põe em lote, ignora contato de outra conta, e não move quem já está', async () => {
    const r = await porNoQuadro(clienteId, quadroId, [ana, bruno, doOutro])
    expect(r).toEqual({ ok: true, postos: 2 })

    const primeira = (await acharQuadro(clienteId, quadroId))!.etapas[0]!
    const cartoes = await listarCartoes(clienteId, quadroId)
    expect(cartoes).toHaveLength(2)
    expect(cartoes.every((c) => c.colunaId === primeira.id)).toBe(true)
    expect(cartoes.map((c) => c.nome).sort()).toEqual(['Ana', 'Bruno'])
  })

  it('mover para uma etapa e pôr de novo não devolve ninguém para a primeira', async () => {
    const quadro = (await acharQuadro(clienteId, quadroId))!
    const destino = quadro.etapas[2]!
    const cartaoDaAna = (await listarCartoes(clienteId, quadroId)).find((c) => c.contatoId === ana)!

    expect(await moverCartao(clienteId, cartaoDaAna.id, destino.id)).toEqual({ ok: true })

    // O ponto do `ignoreDuplicates`: quem selecionou trinta sem lembrar quais já
    // estavam lá não pode desfazer o trabalho de quem os arrastou até o fim.
    expect(await porNoQuadro(clienteId, quadroId, [ana, bruno])).toEqual({ ok: true, postos: 0 })

    const depois = (await listarCartoes(clienteId, quadroId)).find((c) => c.contatoId === ana)!
    expect(depois.colunaId).toBe(destino.id)
  })

  it('não move para a etapa de outro quadro', async () => {
    // O id da etapa chega da tela. Sem a conferência dentro da função do banco,
    // isto tiraria o cartão do próprio funil.
    const etapaDoOutro = (await acharQuadro(clienteId, outroQuadroId))!.etapas[0]!
    const cartao = (await listarCartoes(clienteId, quadroId))[0]!

    const r = await moverCartao(clienteId, cartao.id, etapaDoOutro.id)
    expect(r.ok).toBe(false)
  })

  it('não move cartão de outra conta', async () => {
    const cartao = (await listarCartoes(clienteId, quadroId))[0]!
    const etapa = (await acharQuadro(clienteId, quadroId))!.etapas[1]!
    expect((await moverCartao(outroId, cartao.id, etapa.id)).ok).toBe(false)
  })

  it('a mesma pessoa entra em quadros diferentes, cada um na sua etapa', async () => {
    expect(await porNoQuadro(clienteId, outroQuadroId, [ana])).toEqual({ ok: true, postos: 1 })

    const posicoes = await quadrosDoContato(clienteId, ana)
    expect(posicoes).toHaveLength(2)
    expect(posicoes.map((p) => p.quadro).sort()).toEqual(
      [`${marca} comercial`, `${marca} suporte`].sort(),
    )
  })

  it('tirar do quadro não apaga o contato', async () => {
    const cartao = (await listarCartoes(clienteId, outroQuadroId))[0]!
    expect(await tirarDoQuadro(clienteId, cartao.id)).toBe(true)
    expect(await listarCartoes(clienteId, outroQuadroId)).toHaveLength(0)

    // A pessoa continua existindo — é a diferença entre tirar do funil e apagar.
    const { data } = await db().from('contacts').select('id').eq('id', ana).maybeSingle()
    expect(data).not.toBeNull()
  })
})

describe.skipIf(!temCredencial)('apagar', () => {
  it('recusa etapa com gente dentro, e diz quantos são', async () => {
    const cartao = (await listarCartoes(clienteId, quadroId))[0]!
    const r = await apagarEtapa(clienteId, quadroId, cartao.colunaId)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toMatch(/contato\(s\) estão nesta etapa/)
  })

  it('apaga etapa vazia', async () => {
    const quadro = (await acharQuadro(clienteId, quadroId))!
    const cartoes = await listarCartoes(clienteId, quadroId)
    const ocupadas = new Set(cartoes.map((c) => c.colunaId))
    const vazia = quadro.etapas.find((etapa) => !ocupadas.has(etapa.id))!

    expect(await apagarEtapa(clienteId, quadroId, vazia.id)).toEqual({ ok: true })
  })

  it('apagar o quadro leva as etapas e os cartões, e nenhum contato', async () => {
    expect(await apagarQuadro(clienteId, quadroId)).toBe(true)
    expect((await listarQuadros(clienteId)).some((q) => q.id === quadroId)).toBe(false)

    const { data } = await db().from('contacts').select('id').eq('id', bruno).maybeSingle()
    expect(data).not.toBeNull()
  })
})
