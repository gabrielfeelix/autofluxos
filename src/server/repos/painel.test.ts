import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato, registrarEntrada, registrarSaida } from './conversas'
import { listarMotivos } from './motivos-de-perda'
import { fechamentos, filaDoPainel } from './painel'
import { criarQuadro, fecharCartao, porNoQuadro } from './quadros'

/**
 * A fila da primeira tela contra o banco de verdade.
 *
 * Só dá para testar aqui, e não com dado falso: a fila lê a **view** `leads`,
 * cujas colunas `ultima_direcao` e `estado_efetivo` são calculadas por `lateral
 * join` e por `case`. Um mock devolveria exatamente o que eu imaginei que a
 * view faz, que é o erro que este arquivo existe para pegar.
 *
 * O outro motivo é `numeric`: o supabase-js entrega `quadro_cartoes.valor` como
 * string, e somar sem converter concatena, "1500" + "800" vira "1500800". O
 * teste soma dois valores diferentes de propósito.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-painel-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7)
  .toString()
  .padStart(7, '0')

let clienteId = ''
let ana = ''
let bruno = ''
let carla = ''
let quadroId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  // Ana escreveu e ninguém respondeu: deve entrar na fila.
  ana = (await acharOuCriarContato(clienteId, `5511${seed}01`, 'Ana')).id
  await registrarEntrada({
    contatoId: ana,
    sessaoId: null,
    waMessageId: `${marca}-ana-1`,
    texto: 'oi, tem horário amanhã?',
    payload: { type: 'text' },
  })

  // Bruno escreveu e foi respondido: não deve entrar.
  bruno = (await acharOuCriarContato(clienteId, `5511${seed}02`, 'Bruno')).id
  await registrarEntrada({
    contatoId: bruno,
    sessaoId: null,
    waMessageId: `${marca}-bruno-1`,
    texto: 'bom dia',
    payload: { type: 'text' },
  })
  await registrarSaida({
    contatoId: bruno,
    sessaoId: null,
    texto: 'bom dia! como posso ajudar?',
    payload: { type: 'text' },
  })

  // Carla nunca escreveu: contato existe, fila não.
  carla = (await acharOuCriarContato(clienteId, `5511${seed}03`, 'Carla')).id

  const quadro = await criarQuadro(clienteId, `${marca} vendas`)
  if (quadro.ok) quadroId = quadro.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('a fila do painel', () => {
  it('traz quem escreveu e não foi respondido, e só ele', async () => {
    const fila = await filaDoPainel(clienteId)

    expect(fila.itens.map((item) => item.contatoId)).toEqual([ana])
    expect(fila.itens[0]!.motivo).toBe('esperando-resposta')
    expect(fila.total).toBe(1)
    expect(fila.pedindoPessoa).toBe(0)
  })

  it('não conta quem já foi respondido nem quem nunca escreveu', async () => {
    const fila = await filaDoPainel(clienteId)
    const ids = fila.itens.map((item) => item.contatoId)

    expect(ids).not.toContain(bruno)
    expect(ids).not.toContain(carla)
  })

  it('conversa resolvida sai da fila', async () => {
    await db().from('contacts').update({ estado: 'resolvida' }).eq('id', ana)
    try {
      const fila = await filaDoPainel(clienteId)
      expect(fila.itens).toEqual([])
      expect(fila.total).toBe(0)
    } finally {
      await db().from('contacts').update({ estado: 'aberta' }).eq('id', ana)
    }
  })

  it('id torto devolve fila vazia em vez de estourar a tela', async () => {
    await expect(filaDoPainel('nao-sou-uuid')).resolves.toEqual({
      itens: [],
      total: 0,
      pedindoPessoa: 0,
    })
  })
})

describe.skipIf(!temCredencial)('os fechamentos', () => {
  it('conta ganho e perdido e soma o valor sem concatenar', async () => {
    expect((await porNoQuadro(clienteId, quadroId, [ana, bruno, carla])).ok).toBe(true)

    const cartoes = await db()
      .from('quadro_cartoes')
      .select('id, contact_id')
      .eq('quadro_id', quadroId)
    const cartaoDe = (contatoId: string) =>
      (cartoes.data as { id: string; contact_id: string }[]).find(
        (linha) => linha.contact_id === contatoId,
      )!.id

    expect((await fecharCartao(clienteId, cartaoDe(ana), 'ganha', { valor: 1500 })).ok).toBe(true)
    expect((await fecharCartao(clienteId, cartaoDe(bruno), 'ganha', { valor: 800 })).ok).toBe(true)

    // Perder exige motivo da lista da conta, `conferirFechamento` recusa texto
    // livre, e a lista é semeada na primeira leitura.
    const motivos = await listarMotivos(clienteId)
    expect(
      (await fecharCartao(clienteId, cartaoDe(carla), 'perdida', { motivo: motivos[0]!.nome })).ok,
    ).toBe(true)

    const fechou = await fechamentos(clienteId)
    expect(fechou.ganhos).toBe(2)
    expect(fechou.perdidos).toBe(1)
    expect(fechou.valor).toBe(2300)
  })

  it('a janela exclui o que fechou antes dela', async () => {
    const fechou = await fechamentos(clienteId, 30, new Date(Date.now() + 90 * 24 * 3600 * 1000))
    expect(fechou).toEqual({ ganhos: 0, perdidos: 0, valor: null, dias: 30 })
  })
})
