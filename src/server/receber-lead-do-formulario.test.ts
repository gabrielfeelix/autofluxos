import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { receberLeadsDoFormulario } from './receber-lead-do-formulario'
import { criarCliente } from './repos/clientes'
import {
  criarQuadro,
  definirEntradaNoFunil,
  definirQuadroPadrao,
  listarCartoes,
} from './repos/quadros'

/**
 * O caminho do Lead Ads, de ponta a ponta, contra o banco de verdade.
 *
 * **A Graph é falsa; o resto não.** O que precisa ser provado aqui não é que
 * sabemos chamar a Meta, isso `marketing-api.test.ts` cobre, é o que
 * acontece **depois** da resposta: o contato nasce com o telefone normalizado,
 * as respostas do formulário viram `campos`, a passagem é registrada, o cartão
 * entra no quadro padrão, e o lead repetido não vira contato duplicado.
 *
 * Nada disso é observável sem Postgres: são índice único, chave estrangeira e
 * normalização de telefone conversando entre si.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-lead-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let quadroId = ''

/**
 * Troca **só** as chamadas à Graph, deixando o Supabase passar.
 *
 * O primeiro desenho deste teste substituía `fetch` inteiro, e quebrou tudo com
 * `res.text is not a function`: o `supabase-js` usa o mesmo `fetch` global e
 * precisa de um `Response` de verdade. Interceptar por host é o que mantém o
 * teste falando com o banco real, que é o ponto de existir.
 */
function graphResponde(fabrica: (url: string) => unknown) {
  const original = globalThis.fetch
  vi.stubGlobal('fetch', async (entrada: unknown, init?: unknown) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request)?.url ?? entrada)
    if (url.includes('graph.facebook.com')) {
      const corpo = fabrica(url) as { status?: number; corpo: unknown }
      return new Response(JSON.stringify(corpo.corpo), {
        status: corpo.status ?? 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return original(entrada as RequestInfo, init as RequestInit)
  })
}

/** O corpo que a Graph devolve para `GET /{leadgen_id}`. */
function leadDaMeta(campos: { name: string; values: string[] }[], adId = 'ad_1') {
  return {
    corpo: {
      id: 'lead_1',
      created_time: '2026-09-14T10:00:00+0000',
      ad_id: adId,
      field_data: campos,
    },
  }
}

function aviso(leadgenId: string, adId = 'ad_1') {
  return { leadgenId, formId: `form-${marca}`, adId, pageId: `page-${marca}` }
}

beforeAll(async () => {
  if (!temCredencial) return
  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const q = await criarQuadro(clienteId, `${marca} funil`)
  if (q.ok) {
    quadroId = q.id
    /*
     * A política é declarada desde a 0075: conta nova nasce em `nao_criar`
     * (RB-12), e este bloco está provando o caminho em que o cartão **deve**
     * aparecer.
     */
    await definirEntradaNoFunil(clienteId, 'quadro_marcado')
    await definirQuadroPadrao(clienteId, quadroId)
  }
})

afterEach(() => vi.unstubAllGlobals())

afterAll(async () => {
  if (!temCredencial) return
  await db().from('formularios_de_lead').delete().eq('client_id', clienteId)
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('o lead do formulário vira contato no funil', () => {
  it('cria o contato, guarda as respostas e põe no quadro padrão', async () => {
    const telefone = `11${seed}01`
    graphResponde(() =>
      leadDaMeta([
        { name: 'full_name', values: ['Joana Silva'] },
        { name: 'phone_number', values: [telefone] },
        { name: 'email', values: ['joana@exemplo.com'] },
        { name: 'qual_seu_orcamento', values: ['ate 5 mil'] },
      ]),
    )

    const r = await receberLeadsDoFormulario({
      clienteId,
      avisos: [aviso('lead_1')],
      token: 'token-de-teste',
    })

    expect(r).toEqual({ criados: 1, repetidos: 0, recusados: 0 })

    const { data: contato } = await db()
      .from('contacts')
      .select('id, wa_id, nome_real, campos')
      .eq('client_id', clienteId)
      .eq('wa_id', `55${telefone}`)
      .single()

    // O telefone entrou normalizado, com DDI, é a identidade do sistema.
    expect(contato?.wa_id).toBe(`55${telefone}`)
    expect(contato?.nome_real).toBe('Joana Silva')

    // As respostas do formulário viram campos, inclusive as que não conhecemos.
    expect(contato?.campos).toMatchObject({
      origem: 'Formulário',
      origem_anuncio: 'ad_1',
      email: 'joana@exemplo.com',
      qual_seu_orcamento: 'ate 5 mil',
      lead_da_meta: 'lead_1',
    })

    // A passagem pelo anúncio ficou registrada.
    const { data: passagens } = await db()
      .from('passagens')
      .select('ad_id')
      .eq('contact_id', contato?.id as string)
    expect((passagens ?? []).map((p) => (p as { ad_id: string }).ad_id)).toEqual(['ad_1'])

    // E o cartão entrou no funil sozinho, a razão de `porNoQuadroPadrao`
    // ter saído de `receber-mensagem.ts`.
    const cartoes = await listarCartoes(clienteId, quadroId)
    expect(cartoes.map((c) => c.contatoId)).toContain(contato?.id)
  })

  /*
   * A Meta reentrega, e a mesma pessoa preenche o formulário duas vezes. Nem
   * um nem outro pode virar contato duplicado.
   */
  it('o mesmo telefone de novo não duplica contato, conta como repetido', async () => {
    const telefone = `11${seed}02`
    graphResponde(() =>
      leadDaMeta([
        { name: 'nome', values: ['Carlos'] },
        { name: 'telefone', values: [telefone] },
      ]),
    )

    const primeira = await receberLeadsDoFormulario({
      clienteId,
      avisos: [aviso('lead_2')],
      token: 't',
    })
    expect(primeira.criados).toBe(1)

    const segunda = await receberLeadsDoFormulario({
      clienteId,
      avisos: [aviso('lead_2b', 'ad_2')],
      token: 't',
    })
    expect(segunda).toEqual({ criados: 0, repetidos: 1, recusados: 0 })

    const { count } = await db()
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('wa_id', `55${telefone}`)
    expect(count).toBe(1)

    /*
     * Mas a segunda chegada É um fato: o contato repetido ganha a passagem do
     * anúncio novo. É o mesmo princípio do CTWA, o lead é a entidade, a
     * campanha é o meio por onde ele veio daquela vez.
     */
    const { data: contato } = await db()
      .from('contacts')
      .select('id')
      .eq('client_id', clienteId)
      .eq('wa_id', `55${telefone}`)
      .single()

    const { data: passagens } = await db()
      .from('passagens')
      .select('ad_id')
      .eq('contact_id', contato?.id as string)
      .order('criado_em', { ascending: false })

    expect((passagens ?? []).map((p) => (p as { ad_id: string }).ad_id)).toEqual(['ad_2', 'ad_1'])
  })

  it('formulário sem telefone é recusado, e não cria nada', async () => {
    graphResponde(() => leadDaMeta([{ name: 'email', values: ['so@email.com'] }]))

    const antes = await db()
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)

    const r = await receberLeadsDoFormulario({
      clienteId,
      avisos: [aviso('lead_3')],
      token: 't',
    })
    expect(r).toEqual({ criados: 0, repetidos: 0, recusados: 1 })

    const depois = await db()
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
    expect(depois.count).toBe(antes.count)
  })

  /*
   * O lote não pode parar no primeiro defeito: a Meta reentregaria os outros,
   * e eles virariam duplicados.
   */
  it('um lead defeituoso no lote não impede os outros', async () => {
    const bom = `11${seed}03`
    let chamada = 0
    graphResponde(() => {
      chamada += 1
      if (chamada === 1) {
        return { status: 400, corpo: { error: { message: 'sumiu', code: 100 } } }
      }
      return leadDaMeta([
        { name: 'nome', values: ['Maria'] },
        { name: 'phone_number', values: [bom] },
      ])
    })

    const r = await receberLeadsDoFormulario({
      clienteId,
      avisos: [aviso('lead_ruim'), aviso('lead_bom')],
      token: 't',
    })

    expect(r).toEqual({ criados: 1, repetidos: 0, recusados: 1 })
  })

  it('lead orgânico, sem ad_id, entra sem passagem', async () => {
    const telefone = `11${seed}04`
    graphResponde(() =>
      leadDaMeta(
        [
          { name: 'nome', values: ['Organico'] },
          { name: 'phone_number', values: [telefone] },
        ],
        '',
      ),
    )

    const r = await receberLeadsDoFormulario({
      clienteId,
      avisos: [{ ...aviso('lead_4'), adId: '' }],
      token: 't',
    })
    expect(r.criados).toBe(1)

    const { data: contato } = await db()
      .from('contacts')
      .select('id, campos')
      .eq('client_id', clienteId)
      .eq('wa_id', `55${telefone}`)
      .single()

    expect(contato?.campos).toMatchObject({ origem: 'Formulário' })
    expect(contato?.campos).not.toHaveProperty('origem_anuncio')

    const { count } = await db()
      .from('passagens')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', contato?.id as string)
    expect(count).toBe(0)
  })

  it('token vencido recusa o lead e não derruba o lote', async () => {
    graphResponde(() => ({
      status: 401,
      corpo: { error: { message: 'Invalid OAuth Access Token', code: 190 } },
    }))

    const r = await receberLeadsDoFormulario({
      clienteId,
      avisos: [aviso('lead_5')],
      token: 'velho',
    })
    expect(r).toEqual({ criados: 0, repetidos: 0, recusados: 1 })
  })
})
