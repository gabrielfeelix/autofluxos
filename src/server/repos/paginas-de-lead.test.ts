import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import {
  anotarFormulario,
  clientePelaPagina,
  desligarPagina,
  formulariosAtivos,
  ligarPagina,
  paginasDaConta,
} from './paginas-de-lead'

/**
 * A tradução de Página para conta (0051), contra o banco de verdade.
 *
 * O que precisa ser provado aqui é a **recusa**: a mesma Página em duas contas
 * mandaria o lead de um cliente para a base de outro, e isso é chave primária,
 * que só aparece contra Postgres.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-pag-${Math.random().toString(36).slice(2, 8)}`
const pagina = `page-${marca}`
const formulario = `form-${marca}`

let clienteId = ''
let outroId = ''

beforeAll(async () => {
  if (!temCredencial) return
  const [a, b] = await Promise.all([
    criarCliente(`${marca} cliente`),
    criarCliente(`${marca} outro`),
  ])
  clienteId = a.id
  outroId = b.id
})

afterAll(async () => {
  if (!temCredencial) return
  await db().from('paginas_de_lead').delete().eq('page_id', pagina)
  await db().from('formularios_de_lead').delete().eq('form_id', formulario)
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (outroId) await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('ligar página a uma conta', () => {
  it('página não cadastrada não pertence a ninguém', async () => {
    expect(await clientePelaPagina(pagina)).toBeNull()
  })

  it('liga e acha', async () => {
    expect(await ligarPagina({ clienteId, pageId: pagina, nome: 'Página X' })).toEqual({ ok: true })
    expect(await clientePelaPagina(pagina)).toBe(clienteId)
  })

  /*
   * A recusa que importa: sem ela, ligar a mesma Página noutra conta desviaria
   * silenciosamente os leads de um cliente que não pediu nada.
   */
  it('recusa a mesma página em outra conta, sem sobrescrever', async () => {
    const r = await ligarPagina({ clienteId: outroId, pageId: pagina })
    expect(r).toEqual({ ok: false, motivo: 'esta página já está ligada a outra conta' })
    expect(await clientePelaPagina(pagina)).toBe(clienteId)
  })

  it('religar na mesma conta é idempotente', async () => {
    expect(await ligarPagina({ clienteId, pageId: pagina, nome: 'Página X renomeada' })).toEqual({
      ok: true,
    })
    const lista = await paginasDaConta(clienteId)
    expect(lista).toHaveLength(1)
    expect(lista[0]?.nome).toBe('Página X renomeada')
  })

  it('id vazio é recusado com motivo', async () => {
    expect((await ligarPagina({ clienteId, pageId: '   ' })).ok).toBe(false)
    expect(await clientePelaPagina('')).toBeNull()
  })

  it('desligar só vale para a conta dona', async () => {
    expect(await desligarPagina(outroId, pagina)).toBe(false)
    expect(await clientePelaPagina(pagina)).toBe(clienteId)
  })
})

describe.skipIf(!temCredencial)('formulários vistos', () => {
  it('a lista se preenche sozinha, e não duplica', async () => {
    await anotarFormulario({ clienteId, pageId: pagina, formId: formulario })
    await anotarFormulario({ clienteId, pageId: pagina, formId: formulario })

    const meus = (await formulariosAtivos()).filter((f) => f.formId === formulario)
    expect(meus).toHaveLength(1)
    expect(meus[0]?.clienteId).toBe(clienteId)
  })

  it('formulário sem id não vira linha', async () => {
    const antes = (await formulariosAtivos()).length
    await anotarFormulario({ clienteId, pageId: pagina, formId: '  ' })
    expect((await formulariosAtivos()).length).toBe(antes)
  })
})
