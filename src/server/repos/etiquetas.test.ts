import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import {
  apagarEtiqueta,
  contatosComEtiqueta,
  criarEtiqueta,
  editarEtiqueta,
  etiquetasDeContatos,
  listarEtiquetas,
  listarEtiquetasComContagem,
  marcarContatos,
} from './etiquetas'
import { paginarLeads } from './leads'

/**
 * As etiquetas manuais (0025).
 *
 * O que precisa ser provado aqui não é que a linha entra no banco — é que ela
 * **não atravessa a fronteira do cliente**. Os dois ids chegam de formulário, e
 * a chave estrangeira só sabe que eles existem, não de quem são.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-etq-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')
const telefone = (i: number) => `5511${seed}${i.toString().padStart(2, '0')}`

let clienteId = ''
let outroId = ''
let contatoA = ''
let contatoB = ''
let doOutro = ''

beforeAll(async () => {
  if (!temCredencial) return

  const [cliente, outro] = await Promise.all([
    criarCliente(`${marca} cliente`),
    criarCliente(`${marca} outro`),
  ])
  clienteId = cliente.id
  outroId = outro.id

  const [a, b, c] = await Promise.all([
    acharOuCriarContato(clienteId, telefone(1), 'Ana'),
    acharOuCriarContato(clienteId, telefone(2), 'Bruno'),
    acharOuCriarContato(outroId, telefone(3), 'De outra conta'),
  ])
  contatoA = a.id
  contatoB = b.id
  doOutro = c.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (outroId) await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('criar, editar e apagar', () => {
  it('recusa nome vazio e nome repetido, ignorando caixa e espaço', async () => {
    expect(await criarEtiqueta(clienteId, { nome: '   ', cor: 'azul' })).toEqual({
      ok: false,
      motivo: 'escreva o nome da etiqueta',
    })

    expect(await criarEtiqueta(clienteId, { nome: 'VIP', cor: 'azul' })).toEqual({ ok: true })
    const repetida = await criarEtiqueta(clienteId, { nome: '  vip ', cor: 'rosa' })
    expect(repetida.ok).toBe(false)
  })

  it('a mesma palavra em outra conta é outra etiqueta', async () => {
    expect(await criarEtiqueta(outroId, { nome: 'VIP', cor: 'verde' })).toEqual({ ok: true })
  })

  it('editar mantém a etiqueta em quem já a tinha — renomear não é recriar', async () => {
    const etiqueta = (await listarEtiquetas(clienteId)).find((e) => e.nome === 'VIP')!
    await marcarContatos(clienteId, etiqueta.id, [contatoA], true)

    expect(await editarEtiqueta(clienteId, etiqueta.id, { nome: 'Cliente antigo', cor: 'roxo' })).toEqual({
      ok: true,
    })

    const depois = await etiquetasDeContatos([contatoA])
    expect(depois.get(contatoA)).toEqual([
      expect.objectContaining({ id: etiqueta.id, nome: 'Cliente antigo', cor: 'roxo' }),
    ])
  })

  it('não edita nem apaga etiqueta de outra conta pelo id dela', async () => {
    const alheia = (await listarEtiquetas(outroId))[0]!

    expect(await editarEtiqueta(clienteId, alheia.id, { nome: 'roubada', cor: 'cinza' })).toEqual({
      ok: false,
      motivo: 'esta etiqueta não existe mais',
    })
    expect(await apagarEtiqueta(clienteId, alheia.id)).toBe(false)
    expect((await listarEtiquetas(outroId))[0]?.nome).toBe('VIP')
  })
})

describe.skipIf(!temCredencial)('aplicar em contatos', () => {
  it('recusa etiqueta de outra conta e contato de outra conta', async () => {
    const minha = (await listarEtiquetas(clienteId))[0]!
    const alheia = (await listarEtiquetas(outroId))[0]!

    expect(await marcarContatos(clienteId, alheia.id, [contatoA], true)).toEqual({
      ok: false,
      motivo: 'esta etiqueta não é deste cliente',
    })

    // O contato existe, mas não é deste cliente: a etiqueta não pode alcançá-lo.
    expect(await marcarContatos(clienteId, minha.id, [doOutro], true)).toEqual({
      ok: false,
      motivo: 'nenhum contato deste cliente na seleção',
    })
  })

  it('aplica em lote, é idempotente, e tira em lote', async () => {
    const criada = await criarEtiqueta(clienteId, { nome: 'Orçamento enviado', cor: 'ambar' })
    expect(criada.ok).toBe(true)
    const etiqueta = (await listarEtiquetas(clienteId)).find((e) => e.nome === 'Orçamento enviado')!

    expect(await marcarContatos(clienteId, etiqueta.id, [contatoA, contatoB], true)).toEqual({
      ok: true,
      afetados: 2,
    })
    // Aplicar de novo não pode estourar chave duplicada — quem clica duas vezes
    // está pedindo a mesma coisa, não uma segunda linha.
    expect(await marcarContatos(clienteId, etiqueta.id, [contatoA, contatoB], true)).toEqual({
      ok: true,
      afetados: 2,
    })

    expect((await contatosComEtiqueta(clienteId, etiqueta.id)).sort()).toEqual(
      [contatoA, contatoB].sort(),
    )

    await marcarContatos(clienteId, etiqueta.id, [contatoB], false)
    expect(await contatosComEtiqueta(clienteId, etiqueta.id)).toEqual([contatoA])
  })

  it('a contagem do rail sai junto da lista', async () => {
    const comContagem = await listarEtiquetasComContagem(clienteId)
    const orcamento = comContagem.find((e) => e.nome === 'Orçamento enviado')!
    expect(orcamento.contatos).toBe(1)
  })

  it('vira filtro na lista de contatos, e a lista traz as etiquetas de cada um', async () => {
    const etiqueta = (await listarEtiquetas(clienteId)).find((e) => e.nome === 'Orçamento enviado')!

    const pagina = await paginarLeads(clienteId, { etiquetaId: etiqueta.id })
    expect(pagina.total).toBe(1)
    expect(pagina.leads[0]?.contatoId).toBe(contatoA)
    expect(pagina.leads[0]?.etiquetasManuais.map((e) => e.nome)).toContain('Orçamento enviado')

    // Filtro que não acha ninguém tem que devolver vazio, e não a lista inteira.
    const vazia = await paginarLeads(clienteId, { etiquetaId: '00000000-0000-0000-0000-000000000000' })
    expect(vazia.total).toBe(0)
  })

  it('apagar a etiqueta a tira de quem a tinha', async () => {
    const etiqueta = (await listarEtiquetas(clienteId)).find((e) => e.nome === 'Orçamento enviado')!
    expect(await apagarEtiqueta(clienteId, etiqueta.id)).toBe(true)

    const depois = await etiquetasDeContatos([contatoA])
    expect(depois.get(contatoA)?.some((e) => e.nome === 'Orçamento enviado')).toBeFalsy()
  })
})
