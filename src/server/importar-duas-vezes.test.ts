import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { importarLeadsAntigos } from './importar-leads-antigos'
import { apagarCliente, criarCliente } from './repos/clientes'
import { criarQuadro, definirEntradaNoFunil, definirQuadroPadrao, listarCartoes } from './repos/quadros'

/**
 * O aceite A23: a migração roda de novo e não duplica registro nem envia mensagem.
 *
 * **Por que este arquivo existe, tendo já um teste de lead repetido.** O
 * `receber-lead-do-formulario.test.ts` prova que *dois leads diferentes com o
 * mesmo telefone* não viram dois contatos. O A23 pergunta outra coisa: **a
 * mesma importação, rodada duas vezes**. É o caso real de quem clica "importar"
 * de novo porque a primeira vez pareceu não terminar, e é onde a reentrega da
 * Meta cai também.
 *
 * O cabeçalho de `importar-leads-antigos.ts` *afirma* que "importar duas vezes
 * não estraga nada". A T9.1 existe para transformar essa afirmação em
 * evidência: o plano pede checklist com evidência, e um comentário não é
 * evidência.
 *
 * **A segunda metade do aceite é a cara, e não tinha cobertura nenhuma:** "nem
 * envia mensagens". Um contato que não duplica mas recebe duas vezes a
 * mensagem de boas-vindas é, para quem está do outro lado, o mesmo defeito.
 * Importar 90 dias de leads duas vezes com envio ligado seria uma enxurrada no
 * WhatsApp de gente que não pediu nada.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-imp-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let quadroId = ''

/** Quantas vezes alguém tentou mandar mensagem pela Cloud API. */
let enviosAoWhatsApp: string[] = []

/**
 * Intercepta a Graph por host, deixando o Supabase passar.
 *
 * Mesmo desenho de `receber-lead-do-formulario.test.ts`, e pela mesma razão
 * registrada lá: trocar `fetch` inteiro quebra o `supabase-js`, que precisa de
 * um `Response` de verdade.
 *
 * A diferença aqui é que este também **conta os envios**: o endpoint de
 * mensagem da Cloud API é `/{phone_number_id}/messages`, e é isso que a segunda
 * metade do A23 precisa observar.
 */
function metaResponde(leadsPorFormulario: Record<string, { id: string; telefone: string }[]>) {
  const original = globalThis.fetch
  vi.stubGlobal('fetch', async (entrada: unknown, init?: unknown) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request)?.url ?? entrada)

    if (url.includes('graph.facebook.com')) {
      if (url.includes('/messages')) {
        enviosAoWhatsApp.push(url)
        return new Response(JSON.stringify({ messages: [{ id: `wamid.${enviosAoWhatsApp.length}` }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      // A lista de formulários da Página.
      if (url.includes('/leadgen_forms')) {
        return new Response(
          JSON.stringify({
            data: Object.keys(leadsPorFormulario).map((id) => ({
              id,
              name: `formulário ${id}`,
              leads_count: leadsPorFormulario[id]?.length ?? 0,
            })),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }

      // Os leads de um formulário.
      const doFormulario = Object.entries(leadsPorFormulario).find(([id]) => url.includes(`/${id}/leads`))
      if (doFormulario) {
        return new Response(
          JSON.stringify({
            data: doFormulario[1].map((lead) => ({
              id: lead.id,
              created_time: '2026-07-01T10:00:00+0000',
              ad_id: 'ad_antigo',
              field_data: [
                { name: 'nome', values: ['Pessoa Importada'] },
                { name: 'telefone', values: [lead.telefone] },
              ],
            })),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }

      // `GET /{leadgen_id}`: o detalhe de um lead, pedido pelo caminho do webhook.
      const porId = Object.values(leadsPorFormulario)
        .flat()
        .find((lead) => url.includes(`/${lead.id}`))
      if (porId) {
        return new Response(
          JSON.stringify({
            id: porId.id,
            created_time: '2026-07-01T10:00:00+0000',
            ad_id: 'ad_antigo',
            field_data: [
              { name: 'nome', values: ['Pessoa Importada'] },
              { name: 'telefone', values: [porId.telefone] },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return original(entrada as RequestInfo, init as RequestInit)
  })
}

beforeAll(async () => {
  if (!temCredencial) return
  const conta = await criarCliente(`${marca} conta`)
  clienteId = conta.id
  const quadro = await criarQuadro(clienteId, `${marca} quadro`)
  if (!quadro.ok) throw new Error(`não deu para criar o quadro: ${quadro.motivo}`)
  quadroId = quadro.id
  await definirQuadroPadrao(clienteId, quadroId)
  await definirEntradaNoFunil(clienteId, 'quadro_marcado')
})

afterEach(() => {
  vi.unstubAllGlobals()
  enviosAoWhatsApp = []
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await apagarCliente(clienteId)
})

describe.skipIf(!temCredencial)('A23: a importação roda de novo', () => {
  it('a mesma importação, duas vezes, não duplica contato nem cartão e não envia mensagem', async () => {
    const telefone = `11${seed}55`
    const leads = { form_a: [{ id: 'lead_antigo_1', telefone }] }

    metaResponde(leads)
    const primeira = await importarLeadsAntigos({
      clienteId,
      pageId: 'pagina_1',
      token: 'token-de-teste',
    })
    expect(primeira.criados).toBe(1)

    // Exatamente a mesma resposta da Meta, como seria num segundo clique.
    metaResponde(leads)
    const segunda = await importarLeadsAntigos({
      clienteId,
      pageId: 'pagina_1',
      token: 'token-de-teste',
    })

    // O lead já conhecido conta como repetido, e não como criado.
    expect(segunda.criados).toBe(0)
    expect(segunda.repetidos).toBe(1)

    // Metade 1 do aceite: nenhum registro duplicado.
    const { count: contatos } = await db()
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('wa_id', `55${telefone}`)
    expect(contatos).toBe(1)

    const cartoes = await listarCartoes(clienteId, quadroId)
    expect(cartoes).toHaveLength(1)

    // Metade 2, a que não tinha cobertura: nenhuma mensagem saiu, nas duas
    // passadas. Importação é conversa antiga chegando de uma vez, e não gente
    // batendo na porta agora.
    expect(enviosAoWhatsApp).toEqual([])
  })

  it('a segunda passada não reabre a conversa que alguém já tinha resolvido', async () => {
    const telefone = `11${seed}66`
    const leads = { form_b: [{ id: 'lead_antigo_2', telefone }] }

    metaResponde(leads)
    await importarLeadsAntigos({ clienteId, pageId: 'pagina_1', token: 'token-de-teste' })

    const { data: contato } = await db()
      .from('contacts')
      .select('id')
      .eq('client_id', clienteId)
      .eq('wa_id', `55${telefone}`)
      .single()
    expect(contato?.id).toBeTruthy()

    // Alguém atendeu e resolveu.
    await db().from('contacts').update({ estado: 'resolvida' }).eq('id', contato?.id as string)

    metaResponde(leads)
    await importarLeadsAntigos({ clienteId, pageId: 'pagina_1', token: 'token-de-teste' })

    /*
     * A conversa precisa continuar resolvida. O gatilho `reabrir_ao_receber`
     * (0049) reabre contato ao receber mensagem de entrada, e é justamente por
     * isso que ele ignora `historico = true`: reimportar não pode desfazer o
     * trabalho de quem já atendeu, senão a fila enche de conversa fechada toda
     * vez que alguém clica em importar.
     */
    const { data: depois } = await db()
      .from('contacts')
      .select('estado')
      .eq('id', contato?.id as string)
      .single()
    expect(depois?.estado).toBe('resolvida')
  })
})
