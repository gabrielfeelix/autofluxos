import { afterAll, describe, expect, it } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import { fluxoNovo } from '@/core/flow/novo'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato, criarCanal, criarSessao, registrarEntrada } from './conversas'
import { criarFluxo, publicar } from './fluxos'
import { acharLead, lerConversa } from './leads'
import {
  apagarContato,
  apagarContatosVencidos,
  limiteDaRetencao,
  MESES_DE_RETENCAO_PADRAO,
} from './retencao'

const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-teste-${Math.random().toString(36).slice(2, 8)}`
const criados: string[] = []

afterAll(async () => {
  if (!temCredencial) return
  for (const id of criados) await db().from('clients').delete().eq('id', id)
})

let sequencia = 0
const idDeMensagem = () => `${marca}-msg-${++sequencia}`

async function montarCliente(nome: string) {
  const cliente = await criarCliente(`${marca} ${nome}`)
  criados.push(cliente.id)

  const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())
  const publicado = await publicar(fluxo.id, cliente.id, fluxo.rascunho)
  if (!publicado.ok) throw new Error('o fluxo de teste deveria ter publicado')

  const canal = await criarCanal({
    clienteId: cliente.id,
    phoneNumberId: `${marca}-${nome}-numero`,
    flowId: fluxo.id,
  })

  return { cliente, canal, versaoId: publicado.versao.id }
}

/**
 * A fronteira é o que precisa de prova, e ela é aritmética de calendário —
 * nada de banco. Fevereiro e ano bissexto entram porque "doze meses atrás" não
 * é "menos 365 dias".
 */
describe('limite da retenção', () => {
  it('volta a mesma data doze meses antes', () => {
    const limite = limiteDaRetencao(12, new Date('2026-08-14T12:00:00.000Z'))
    expect(limite.toISOString()).toBe('2025-08-14T12:00:00.000Z')
  })

  it('atravessa a virada do ano sem perder o dia', () => {
    expect(limiteDaRetencao(12, new Date('2026-01-05T00:00:00.000Z')).toISOString()).toBe(
      '2025-01-05T00:00:00.000Z',
    )
  })

  it('não inventa 31 de fevereiro', () => {
    // 31/03 menos um mês não existe: o JavaScript transborda para abril, e o
    // que importa aqui é que o limite continue sendo uma data real no passado.
    const limite = limiteDaRetencao(1, new Date('2026-03-31T00:00:00.000Z'))
    expect(limite.getTime()).toBeLessThan(new Date('2026-03-31T00:00:00.000Z').getTime())
  })

  it('o padrão combinado é de doze meses', () => {
    expect(MESES_DE_RETENCAO_PADRAO).toBe(12)
  })
})

describe.skipIf(!temCredencial)('retenção contra o Supabase', () => {
  it('apaga o contato com a conversa inteira, e só no cliente certo', async () => {
    const dono = await montarCliente('exclusao')
    const estranho = await montarCliente('exclusao alheia')

    const contato = await acharOuCriarContato(dono.cliente.id, `${marca}-5544555001`, 'Apagável')
    const sessao = await criarSessao(contato.id, dono.canal.id, dono.versaoId, sessaoNova())
    await registrarEntrada({
      contatoId: contato.id,
      sessaoId: sessao.id,
      waMessageId: idDeMensagem(),
      texto: 'oi',
      payload: {},
    })

    // O id certo no cliente errado não apaga nada.
    expect(await apagarContato(estranho.cliente.id, contato.id)).toBe(false)
    expect(await acharLead(dono.cliente.id, contato.id)).not.toBeNull()

    expect(await apagarContato(dono.cliente.id, contato.id)).toBe(true)
    expect(await acharLead(dono.cliente.id, contato.id)).toBeNull()
    // A conversa vai junto por cascata: não fica mensagem órfã no banco.
    expect((await lerConversa(contato.id)).mensagens).toEqual([])

    // Apagar de novo não é erro, é "não havia o que apagar".
    expect(await apagarContato(dono.cliente.id, contato.id)).toBe(false)
  }, 15_000)

  /**
   * A fronteira do prazo: um segundo antes do limite fica, um segundo depois
   * some. O instante é passado por parâmetro para o teste não depender do
   * relógio da máquina.
   */
  it('apaga quem passou do prazo e mantém quem está no limite', async () => {
    const { cliente, canal, versaoId } = await montarCliente('retencao')
    const agora = new Date('2026-08-14T12:00:00.000Z')
    const limite = limiteDaRetencao(MESES_DE_RETENCAO_PADRAO, agora)

    const noLimite = await acharOuCriarContato(cliente.id, `${marca}-5544555010`, 'No limite')
    const vencido = await acharOuCriarContato(cliente.id, `${marca}-5544555011`, 'Vencido')
    const recente = await acharOuCriarContato(cliente.id, `${marca}-5544555012`, 'Recente')

    const sessao = await criarSessao(noLimite.id, canal.id, versaoId, sessaoNova())
    for (const [contato, quando] of [
      [noLimite, new Date(limite.getTime() + 1_000)],
      [vencido, new Date(limite.getTime() - 1_000)],
      [recente, agora],
    ] as const) {
      const mensagem = await registrarEntrada({
        contatoId: contato.id,
        sessaoId: sessao.id,
        waMessageId: idDeMensagem(),
        texto: 'oi',
        payload: {},
      })
      if (!mensagem) throw new Error('a mensagem de teste deveria ser inédita')
      await db().from('messages').update({ ts: quando.toISOString() }).eq('contact_id', contato.id)
    }

    const r = await apagarContatosVencidos({ agora, clienteId: cliente.id })

    expect(r.apagados).toBe(1)
    expect(await acharLead(cliente.id, vencido.id)).toBeNull()
    expect(await acharLead(cliente.id, noLimite.id)).not.toBeNull()
    expect(await acharLead(cliente.id, recente.id)).not.toBeNull()
  }, 20_000)

  it('quem nunca escreveu é julgado pela data em que entrou', async () => {
    const { cliente } = await montarCliente('retencao mudo')
    const agora = new Date('2026-08-14T12:00:00.000Z')

    const antigo = await acharOuCriarContato(cliente.id, `${marca}-5544555020`, 'Mudo antigo')
    const novo = await acharOuCriarContato(cliente.id, `${marca}-5544555021`, 'Mudo novo')
    await db()
      .from('contacts')
      .update({ criado_em: '2020-01-01T00:00:00.000Z' })
      .eq('id', antigo.id)

    await apagarContatosVencidos({ agora, clienteId: cliente.id })

    expect(await acharLead(cliente.id, antigo.id)).toBeNull()
    expect(await acharLead(cliente.id, novo.id)).not.toBeNull()
  }, 15_000)

  it('avisa quando bateu no teto e ainda há fila', async () => {
    const { cliente } = await montarCliente('retencao lote')
    const agora = new Date('2026-08-14T12:00:00.000Z')

    for (let i = 0; i < 3; i++) {
      const contato = await acharOuCriarContato(cliente.id, `${marca}-554455503${i}`, `Velho ${i}`)
      await db()
        .from('contacts')
        .update({ criado_em: '2020-01-01T00:00:00.000Z' })
        .eq('id', contato.id)
    }

    const primeira = await apagarContatosVencidos({ agora, clienteId: cliente.id, teto: 2 })
    expect(primeira).toEqual({ apagados: 2, temMais: true })

    const segunda = await apagarContatosVencidos({ agora, clienteId: cliente.id, teto: 2 })
    expect(segunda).toEqual({ apagados: 1, temMais: false })
  }, 20_000)
})
