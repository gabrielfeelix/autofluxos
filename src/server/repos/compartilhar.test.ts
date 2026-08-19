import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { triagem } from '@/exemplos/triagem'
import { db } from '../db'
import { criarCliente } from './clientes'
import { criarFluxo, publicar } from './fluxos'
import {
  acharPorToken,
  contarAbertura,
  contarImportacao,
  criarLink,
  listarLinks,
  revogarLink,
} from './compartilhar'

/**
 * O link público de um fluxo (0030).
 *
 * A rota `/f/<token>` é a única do sistema que abre sem sessão nenhuma, então o
 * que estes testes prendem é a recusa: rascunho não gera link, link revogado e
 * link vencido **não devolvem o grafo**, e o token de um fluxo não alcança o
 * fluxo de outra conta.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-link-${Math.random().toString(36).slice(2, 8)}`

let clienteId = ''
let outroId = ''
let publicadoId = ''
let rascunhoId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const [cliente, outro] = await Promise.all([
    criarCliente(`${marca} cliente`),
    criarCliente(`${marca} outro`),
  ])
  clienteId = cliente.id
  outroId = outro.id

  const [publicado, rascunho] = await Promise.all([
    criarFluxo(clienteId, `${marca} triagem`, triagem),
    criarFluxo(clienteId, `${marca} rascunho`, triagem),
  ])
  publicadoId = publicado.id
  rascunhoId = rascunho.id

  const r = await publicar(publicadoId, clienteId, triagem)
  expect(r.ok).toBe(true)
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (outroId) await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('quem pode virar link', () => {
  it('rascunho não gera link, e a recusa explica por quê', async () => {
    // O link aponta para uma versão imutável. Apontar para o rascunho faria o
    // desenho mudar por baixo de quem recebeu.
    const r = await criarLink(clienteId, rascunhoId, { dias: 30, criadoPor: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('publique o fluxo antes de compartilhar')
  })

  it('o fluxo de outra conta não vira link pelo id dele', async () => {
    const r = await criarLink(outroId, publicadoId, { dias: 30, criadoPor: null })
    expect(r).toEqual({ ok: false, motivo: 'esta automação não é deste cliente' })
  })
})

describe.skipIf(!temCredencial)('o que o link entrega', () => {
  it('devolve o desenho, a procedência e a versão — e nada de id interno', async () => {
    const criado = await criarLink(clienteId, publicadoId, { dias: 30, criadoPor: null })
    expect(criado.ok).toBe(true)
    if (!criado.ok) return

    // 24 bytes em base64url = 32 caracteres, sem nada que precise de escape.
    expect(criado.link.token).toMatch(/^[A-Za-z0-9_-]{32}$/)

    const aberto = await acharPorToken(criado.link.token)
    expect(aberto?.estado).toBe('valido')
    expect(aberto?.grafo?.nodes.length).toBe(triagem.nodes.length)
    expect(aberto?.origem).toBe(`${marca} cliente`)
    expect(aberto?.versao).toBe(1)
  })

  it('token que não existe é `null`, não erro', async () => {
    expect(await acharPorToken('nao-existe-nem-de-longe')).toBeNull()
    expect(await acharPorToken('')).toBeNull()
  })

  it('abertura e importação contam separadamente', async () => {
    const link = (await listarLinks(clienteId, publicadoId))[0]!

    await contarAbertura(link.id)
    await contarAbertura(link.id)
    await contarImportacao(link.id)

    const depois = (await listarLinks(clienteId, publicadoId)).find((l) => l.id === link.id)!
    expect(depois.aberturas).toBe(2)
    expect(depois.importacoes).toBe(1)
  })
})

describe.skipIf(!temCredencial)('revogar fecha de verdade', () => {
  it('o grafo para de sair, e a contagem fica', async () => {
    const link = (await listarLinks(clienteId, publicadoId))[0]!

    expect(await revogarLink(clienteId, link.id)).toBe(true)

    const aberto = await acharPorToken(link.token)
    expect(aberto?.estado).toBe('revogado')
    // **O desenho não vem.** Ler e esconder na tela seria mandar o fluxo de um
    // cliente pelo fio de um link já fechado.
    expect(aberto?.grafo).toBeNull()

    const depois = (await listarLinks(clienteId, publicadoId)).find((l) => l.id === link.id)!
    expect(depois.aberturas).toBe(2)
  })

  it('revogar de novo devolve `false`, e outra conta não revoga', async () => {
    const link = (await listarLinks(clienteId, publicadoId))[0]!
    expect(await revogarLink(clienteId, link.id)).toBe(false)

    const novo = await criarLink(clienteId, publicadoId, { dias: 7, criadoPor: null })
    expect(novo.ok).toBe(true)
    if (novo.ok) expect(await revogarLink(outroId, novo.link.id)).toBe(false)
  })

  it('link vencido também não devolve o grafo', async () => {
    const novo = await criarLink(clienteId, publicadoId, { dias: 7, criadoPor: null })
    expect(novo.ok).toBe(true)
    if (!novo.ok) return

    // Empurra o prazo para ontem sem esperar sete dias. É a única coisa aqui
    // que o teste faz pelas costas do repositório.
    await db()
      .from('fluxo_links')
      .update({ expira_em: new Date(Date.now() - 86_400_000).toISOString() })
      .eq('id', novo.link.id)

    const aberto = await acharPorToken(novo.link.token)
    expect(aberto?.estado).toBe('expirado')
    expect(aberto?.grafo).toBeNull()
  })
})
