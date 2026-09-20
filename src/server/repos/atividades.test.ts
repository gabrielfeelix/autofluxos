import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { proximaAcao, urgenciaDe } from '@/core/atividades'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import {
  abertasDoCartao,
  agenda,
  atividadesDoContato,
  criarAtividade,
  reabrirAtividade,
  resolverAoFechar,
  resolverAtividade,
} from './atividades'
import { criarQuadro, listarCartoes, porNoQuadro } from './quadros'

/**
 * A agenda humana contra o banco (0081, T5.3).
 *
 * O teste que mais importa aqui é o primeiro, e ele é sobre o que **não**
 * acontece: criar atividade não pode escrever em `mensagens_agendadas` nem em
 * `contacts.adiada_ate`. É a RB-33, e é a que custaria caro errar — uma
 * atividade virando mensagem é um cliente recebendo um bilhete interno.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-atv-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7)
  .toString()
  .padStart(7, '0')

let clienteId = ''
let contatoId = ''
let quadroId = ''
let cartaoId = ''
let pessoa = ''

beforeAll(async () => {
  if (!temCredencial) return

  clienteId = (await criarCliente(`${marca} cliente`)).id
  contatoId = (await acharOuCriarContato(clienteId, `5511${seed}01`, 'Ana')).id

  const quadro = await criarQuadro(clienteId, `${marca} comercial`)
  if (quadro.ok) quadroId = quadro.id
  await porNoQuadro(clienteId, quadroId, [contatoId])
  cartaoId = (await listarCartoes(clienteId, quadroId))[0]?.id ?? ''

  const { data } = await db()
    .from('af_usuarios')
    .insert({
      id: crypto.randomUUID(),
      name: `${marca} vendedor`,
      email: `${marca}@exemplo.test`,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .select('id')
    .single()
  pessoa = (data as { id: string }).id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (pessoa) await db().from('af_usuarios').delete().eq('id', pessoa)
})

describe.skipIf(!temCredencial)('lembrete não é envio (RB-33)', () => {
  it('criar atividade não escreve em mensagens_agendadas nem adia a conversa', async () => {
    const antesDasAgendadas = await db()
      .from('mensagens_agendadas')
      .select('id')
      .eq('cliente_id', clienteId)
    const antesDoAdiamento = await db()
      .from('contacts')
      .select('adiada_ate')
      .eq('id', contatoId)
      .single()

    const r = await criarAtividade({
      clienteId,
      contatoId,
      cartaoId,
      tipo: 'ligacao',
      titulo: 'Ligar para a Ana quinta',
      prazo: '2026-09-24T13:00:00Z',
      responsavelId: pessoa,
    })
    expect(r.ok).toBe(true)

    // Nenhuma mensagem foi agendada: a fila de envio não sabe que isto existe.
    const depoisDasAgendadas = await db()
      .from('mensagens_agendadas')
      .select('id')
      .eq('cliente_id', clienteId)
    expect(depoisDasAgendadas.data).toHaveLength(
      (antesDasAgendadas.data as unknown[] | null)?.length ?? 0,
    )

    // E a conversa não foi adiada: são eixos diferentes.
    const depoisDoAdiamento = await db()
      .from('contacts')
      .select('adiada_ate')
      .eq('id', contatoId)
      .single()
    expect((depoisDoAdiamento.data as { adiada_ate: string | null }).adiada_ate).toBe(
      (antesDoAdiamento.data as { adiada_ate: string | null }).adiada_ate,
    )
  })

  it('atividade só do contato funciona, sem cartão nenhum', async () => {
    // "Funciona sem ativar o CRM" é requisito da T5.3: quem usa só o Inbox
    // precisa poder anotar um retorno sem criar funil, etapa e oportunidade.
    const r = await criarAtividade({
      clienteId,
      contatoId,
      cartaoId: null,
      tipo: 'tarefa',
      titulo: 'Retornar a ligação',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.atividade.cartaoId).toBeNull()
    expect(r.atividade.prazo).toBeNull() // "algum dia" é resposta legítima
  })
})

describe.skipIf(!temCredencial)('a régua da agenda lida do banco', () => {
  it('a próxima ação é a mais cedo entre as abertas', async () => {
    const lista = await atividadesDoContato(clienteId, contatoId)
    const proxima = proximaAcao(lista)
    expect(proxima?.titulo).toBe('Ligar para a Ana quinta')

    // E ela não está vencida hoje, porque o prazo é no futuro.
    expect(urgenciaDe(proxima!, Date.parse('2026-09-20T12:00:00Z'))).toBe('futura')
  })

  it('a agenda respeita o escopo de quem olha', async () => {
    const tudo = await agenda(clienteId, { tipo: 'tudo' })
    expect(tudo.length).toBeGreaterThan(0)

    // Quem só vê o próprio trabalho não vê a atividade sem responsável.
    const doVendedor = await agenda(clienteId, { tipo: 'proprios', usuarioId: pessoa })
    expect(doVendedor.every((a) => a.responsavelId === pessoa)).toBe(true)
    expect(doVendedor.length).toBeLessThan(tudo.length)

    expect(await agenda(clienteId, { tipo: 'impossivel' })).toHaveLength(0)
  })

  it('não lê agenda de outra conta', async () => {
    const outro = (await criarCliente(`${marca} vizinho`)).id
    expect(await agenda(outro, { tipo: 'tudo' })).toHaveLength(0)
    expect(await atividadesDoContato(outro, contatoId)).toHaveLength(0)
    await db().from('clients').delete().eq('id', outro)
  })
})

describe.skipIf(!temCredencial)('concluir, cancelar e reabrir', () => {
  it('cancelar exige motivo, e concluir não', async () => {
    const criada = await criarAtividade({
      clienteId,
      contatoId,
      tipo: 'tarefa',
      titulo: `${marca} para resolver`,
    })
    expect(criada.ok).toBe(true)
    if (!criada.ok) return

    const semMotivo = await resolverAtividade(clienteId, criada.atividade.id, 'cancelada')
    expect(semMotivo.ok).toBe(false)

    expect((await resolverAtividade(clienteId, criada.atividade.id, 'concluida')).ok).toBe(true)

    // O segundo clique não reescreve a data de ontem.
    const denovo = await resolverAtividade(clienteId, criada.atividade.id, 'concluida')
    expect(denovo.ok).toBe(false)

    expect((await reabrirAtividade(clienteId, criada.atividade.id)).ok).toBe(true)
    expect((await reabrirAtividade(clienteId, criada.atividade.id)).ok).toBe(false)
  })

  it('não resolve atividade de outra conta', async () => {
    const criada = await criarAtividade({
      clienteId,
      contatoId,
      tipo: 'tarefa',
      titulo: `${marca} minha`,
    })
    expect(criada.ok).toBe(true)
    if (!criada.ok) return

    const outro = (await criarCliente(`${marca} intruso`)).id
    expect((await resolverAtividade(outro, criada.atividade.id, 'concluida')).ok).toBe(false)
    await db().from('clients').delete().eq('id', outro)
  })
})

describe.skipIf(!temCredencial)('ao fechar a oportunidade (RB-28)', () => {
  it('manter não mexe em nada', async () => {
    await criarAtividade({
      clienteId,
      contatoId,
      cartaoId,
      tipo: 'visita',
      titulo: `${marca} visita marcada`,
    })

    const antes = (await abertasDoCartao(clienteId, cartaoId)).length
    expect(antes).toBeGreaterThan(0)

    // A visita marcada para a semana que vem continua marcada depois da venda
    // fechada. Concluí-la sozinha inventaria trabalho que ninguém fez.
    expect(await resolverAoFechar(clienteId, cartaoId, 'manter')).toEqual({ resolvidas: 0 })
    expect(await abertasDoCartao(clienteId, cartaoId)).toHaveLength(antes)
  })

  it('concluir resolve só as do cartão, e não as soltas do contato', async () => {
    const soltas = (await atividadesDoContato(clienteId, contatoId)).filter(
      (a) => a.cartaoId === null && a.situacao === 'aberta',
    ).length
    expect(soltas).toBeGreaterThan(0)

    const r = await resolverAoFechar(clienteId, cartaoId, 'concluir')
    expect(r.resolvidas).toBeGreaterThan(0)

    expect(await abertasDoCartao(clienteId, cartaoId)).toHaveLength(0)

    // As atividades do contato que não eram da oportunidade continuam abertas.
    const aindaSoltas = (await atividadesDoContato(clienteId, contatoId)).filter(
      (a) => a.cartaoId === null && a.situacao === 'aberta',
    ).length
    expect(aindaSoltas).toBe(soltas)
  })
})
