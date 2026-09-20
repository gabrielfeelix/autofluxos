import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { criarQuadro } from './quadros'
import {
  crmAoCriar,
  crmVisivel,
  definirCrmAtivo,
  definirObjetivo,
  recursosDaConta,
} from './recursos'

/**
 * O objetivo e os recursos contra o banco de verdade (0084, T7.1).
 *
 * O que só aparece contra o Postgres, e é o que este arquivo prova:
 *
 *  - o **default da 0084** é `atender` com o CRM ligado: conta que já existe
 *    acorda exatamente como se comportava antes da migration, e nenhuma tela
 *    desaparece no deploy;
 *  - o `check` recusa objetivo fora da lista, e a recusa chega como frase e não
 *    como 23514 na cara de quem escolheu numa lista de três itens;
 *  - `crmVisivel` respeita o funil existente: desligar o CRM numa conta com
 *    quadro montado **não** esconde a tela;
 *  - trocar o objetivo não mexe no interruptor do CRM.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-rec-${Math.random().toString(36).slice(2, 8)}`

let clienteId = ''
let comQuadroId = ''

beforeAll(async () => {
  if (!temCredencial) return
  const [cliente, comQuadro] = await Promise.all([
    criarCliente(`${marca} cliente`),
    criarCliente(`${marca} com funil`),
  ])
  clienteId = cliente.id
  comQuadroId = comQuadro.id
  await criarQuadro(comQuadroId, `${marca} funil`)
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (comQuadroId) await db().from('clients').delete().eq('id', comQuadroId)
})

describe.skipIf(!temCredencial)('o default da migration', () => {
  it('conta nova nasce em atender, com o CRM ligado', async () => {
    // **É a prova de que a 0084 não esconde tela de ninguém.** Se o default
    // fosse `false`, as contas que já existem perderiam o funil do menu no
    // deploy, sem ninguém ter pedido.
    const recursos = await recursosDaConta(clienteId)
    expect(recursos.objetivo).toBe('atender')
    expect(recursos.crmAtivo).toBe(true)
  })

  it('cliente que não existe devolve o default em vez de estourar', async () => {
    // Isto é lido para desenhar a barra lateral: uma tela inteira não pode cair
    // porque a preferência de menu não foi lida.
    const recursos = await recursosDaConta('00000000-0000-0000-0000-000000000000')
    expect(recursos.objetivo).toBe('atender')
    expect(recursos.crmAtivo).toBe(true)
  })
})

describe.skipIf(!temCredencial)('trocar o objetivo', () => {
  it('grava os três da lista', async () => {
    for (const objetivo of ['vender', 'automatizar', 'atender'] as const) {
      const r = await definirObjetivo(clienteId, objetivo)
      expect(r.ok).toBe(true)
      expect((await recursosDaConta(clienteId)).objetivo).toBe(objetivo)
    }
  })

  it('o banco recusa objetivo fora da lista, e a recusa vira frase', async () => {
    // O check da 0084 é a última linha de defesa: `ehObjetivo` já barra na ação,
    // e aqui provamos que o banco também barra, para o caso de alguém escrever
    // outro caminho de escrita amanhã.
    const r = await definirObjetivo(clienteId, 'crescer' as never)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo.length).toBeGreaterThan(0)
  })

  it('não mexe no interruptor do CRM', async () => {
    // A decisão registrada em `definirObjetivo`: quem desligou o CRM de
    // propósito não quer que uma resposta de onboarding o traga de volta.
    await definirCrmAtivo(clienteId, false)
    await definirObjetivo(clienteId, 'vender')
    expect((await recursosDaConta(clienteId)).crmAtivo).toBe(false)

    await definirCrmAtivo(clienteId, true)
    await definirObjetivo(clienteId, 'atender')
    expect((await recursosDaConta(clienteId)).crmAtivo).toBe(true)
  })
})

describe.skipIf(!temCredencial)('o CRM no menu', () => {
  it('ligado aparece', async () => {
    await definirCrmAtivo(clienteId, true)
    expect(await crmVisivel(clienteId)).toBe(true)
  })

  it('desligado e sem funil não aparece', async () => {
    await definirCrmAtivo(clienteId, false)
    expect(await crmVisivel(clienteId)).toBe(false)
  })

  it('desligado mas COM funil continua aparecendo', async () => {
    /*
     * O caso que só o banco prova, e o que mais importa aqui: a conta tem quadro
     * de verdade, e `crmVisivel` vai contá-lo. Sem esta regra, desligar o
     * interruptor esconderia a tela que a equipe usa todo dia, e quem desligou
     * acharia que o funil foi apagado.
     */
    await definirCrmAtivo(comQuadroId, false)
    expect((await recursosDaConta(comQuadroId)).crmAtivo).toBe(false)
    expect(await crmVisivel(comQuadroId)).toBe(true)
  })

  it('uma conta não vê o recurso da outra', async () => {
    // `service_role` ignora RLS: quem isola é o `client_id` em cada consulta.
    await definirCrmAtivo(clienteId, false)
    await definirCrmAtivo(comQuadroId, true)
    expect((await recursosDaConta(clienteId)).crmAtivo).toBe(false)
    expect((await recursosDaConta(comQuadroId)).crmAtivo).toBe(true)
  })
})

describe('o valor de uma conta nova', () => {
  it('só vender nasce com o CRM', () => {
    expect(crmAoCriar('vender')).toBe(true)
    expect(crmAoCriar('atender')).toBe(false)
    expect(crmAoCriar('automatizar')).toBe(false)
  })
})
