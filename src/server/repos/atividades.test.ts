import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerFiltroDaAgenda, prazoDoDia, proximaAcao, urgenciaDe, type FiltroDaAgenda } from '@/core/atividades'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import {
  abertasDoCartao,
  atividadesDoContato,
  paginaDaAgenda,
  atribuirAtividade,
  reagendarAtividade,
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
 * `contacts.adiada_ate`. É a RB-33, e é a que custaria caro errar, uma
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
    const ver = (escopo: Parameters<typeof paginaDaAgenda>[1]) =>
      paginaDaAgenda(clienteId, escopo, pessoa, { ...lerFiltroDaAgenda({}), alcance: 'equipe' }, Date.now())
    const tudo = await ver({ tipo: 'tudo' })
    expect(tudo.total).toBeGreaterThan(0)

    // Quem só vê o próprio trabalho não vê a atividade sem responsável.
    const doVendedor = await ver({ tipo: 'proprios', usuarioId: pessoa })
    expect(doVendedor.itens.every((a) => a.responsavelId === pessoa)).toBe(true)
    expect(doVendedor.total).toBeLessThan(tudo.total)

    expect((await ver({ tipo: 'impossivel' })).total).toBe(0)
  })

  it('não lê agenda de outra conta', async () => {
    const outro = (await criarCliente(`${marca} vizinho`)).id
    const daOutra = await paginaDaAgenda(outro, { tipo: 'tudo' }, pessoa, { ...lerFiltroDaAgenda({}), alcance: 'equipe' }, Date.now())
    expect(daOutra.total).toBe(0)
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

/*
 * A agenda paginada (tarefa 1.1 do plano de UX de 23/09).
 *
 * Fixture própria: uma conta nova com 60 abertas, porque os testes de cima
 * mexem nas atividades da outra conta e contagem exata não sobrevive a isso.
 */
describe.skipIf(!temCredencial)('agenda paginada', () => {
  const AGORA = Date.UTC(2026, 8, 23, 15, 0)
  let conta = ''
  let vizinha = ''
  let eu = ''
  let colega = ''
  let joao = ''
  const telefoneDoJoao = `5544${seed.slice(0, 3)}9901021`.slice(0, 13)

  const filtro = (parcial: Partial<FiltroDaAgenda> = {}): FiltroDaAgenda => ({
    ...lerFiltroDaAgenda({}),
    alcance: 'equipe',
    ...parcial,
  })

  beforeAll(async () => {
    if (!temCredencial) return
    conta = (await criarCliente(`${marca} agenda`)).id
    vizinha = (await criarCliente(`${marca} agenda vizinha`)).id

    const usuarios = [`${marca} eu`, `${marca} colega`].map((nome) => ({
      id: crypto.randomUUID(),
      name: nome,
      email: `${nome.replace(/\s/g, '-')}@exemplo.test`,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    await db().from('af_usuarios').insert(usuarios)
    ;[eu, colega] = [usuarios[0]!.id, usuarios[1]!.id]

    joao = (await acharOuCriarContato(conta, telefoneDoJoao, 'João Pedro')).id
    const maria = (await acharOuCriarContato(conta, `5511${seed}31`, 'Maria')).id
    const pedro = (await acharOuCriarContato(conta, `5511${seed}32`, 'Pedro')).id
    const outroDaVizinha = (await acharOuCriarContato(vizinha, `5511${seed}33`, 'João Vizinho')).id

    const dia = (d: number, h = 12, m = 0) => new Date(Date.UTC(2026, 8, d, h, m)).toISOString()
    const linhas: Record<string, unknown>[] = []
    const abre = (prazo: string | null, contato: string, titulo: string, responsavel = eu) =>
      linhas.push({ client_id: conta, contact_id: contato, tipo: 'tarefa', titulo, prazo, responsavel, situacao: 'aberta', concluida_em: null })

    // 20 vencidas, 10 de hoje (uma às 23h30 UTC), 25 próximas, 5 sem prazo = 60 abertas.
    for (let i = 0; i < 20; i++) abre(dia(1 + (i % 20)), maria, `Vencida ${i}`)
    for (let i = 0; i < 9; i++) abre(dia(23, 9 + i), pedro, `Hoje ${i}`)
    abre(dia(23, 23, 30), pedro, 'Hoje tarde da noite')
    for (let i = 0; i < 24; i++) abre(dia(24 + (i % 6)), maria, `Próxima ${i}`, i < 5 ? colega : eu)
    // A do João é a última da ordem: sem busca, ela só aparece na página 2.
    abre(dia(30, 18), joao, 'Aula experimental')
    for (let i = 0; i < 5; i++) abre(null, pedro, `Algum dia ${i}`)

    const fechadas = [dia(20, 10), dia(22, 10), dia(21, 10)].map((quando, i) => ({
      client_id: conta, contact_id: maria, tipo: 'tarefa', titulo: `Feita ${i}`,
      situacao: 'concluida', concluida_em: quando, responsavel: eu, prazo: null,
    }))
    const daVizinha = { client_id: vizinha, contact_id: outroDaVizinha, tipo: 'tarefa', titulo: 'Da vizinha', prazo: dia(22), responsavel: null, situacao: 'aberta', concluida_em: null }

    const { error } = await db().from('atividades').insert([...linhas, ...fechadas, daVizinha])
    if (error) throw new Error(error.message)
  })

  afterAll(async () => {
    if (!temCredencial) return
    await db().from('clients').delete().in('id', [conta, vizinha].filter(Boolean))
    await db().from('af_usuarios').delete().in('id', [eu, colega].filter(Boolean))
  })

  it('acha atividade além das primeiras 50 pela busca do nome do contato, sem acento', async () => {
    const sem = await paginaDaAgenda(conta, { tipo: 'tudo' }, eu, filtro(), AGORA)
    expect(sem.itens.some((a) => a.contato.id === joao)).toBe(false)

    const r = await paginaDaAgenda(conta, { tipo: 'tudo' }, eu, filtro({ busca: 'joao' }), AGORA)
    expect(r.total).toBe(1)
    expect(r.itens[0]?.titulo).toBe('Aula experimental')
    expect(r.itens[0]?.contato.nome).toBe('João Pedro')
  })

  it('busca por telefone ignora espaço e traço', async () => {
    const final = telefoneDoJoao.slice(-8)
    const digitado = `${final.slice(0, 4)} ${final.slice(4, 6)}-${final.slice(6)}`
    const r = await paginaDaAgenda(conta, { tipo: 'tudo' }, eu, filtro({ busca: digitado }), AGORA)
    expect(r.itens.map((a) => a.contato.id)).toEqual([joao])
  })

  it('recortes somam o total de abertas', async () => {
    const r = await paginaDaAgenda(conta, { tipo: 'tudo' }, eu, filtro(), AGORA)
    expect(r.contagens).toEqual({ vencidas: 20, hoje: 10, proximas: 25, 'sem-prazo': 5 })
    const soma = Object.values(r.contagens).reduce((a, b) => a + b, 0)
    expect(soma).toBe(r.total)
  })

  it('atividade de hoje às 23h30 UTC conta como hoje, igual a urgenciaDe', async () => {
    const r = await paginaDaAgenda(conta, { tipo: 'tudo' }, eu, filtro({ recorte: 'hoje' }), AGORA)
    const tarde = r.itens.find((a) => a.titulo === 'Hoje tarde da noite')
    expect(tarde).toBeDefined()
    expect(r.itens.every((a) => urgenciaDe(a, AGORA) === 'hoje')).toBe(true)
  })

  it('escopo proprios não vê a de outra pessoa nem pedindo responsavel na URL', async () => {
    const r = await paginaDaAgenda(
      conta,
      { tipo: 'proprios', usuarioId: eu },
      eu,
      filtro({ responsavel: colega }),
      AGORA,
    )
    expect(r.total).toBe(55)
    expect(r.itens.every((a) => a.responsavelId === eu)).toBe(true)
    expect(r.contagens.proximas).toBe(20)
  })

  it('minhas mostra só as de quem olha, mesmo com escopo amplo', async () => {
    const r = await paginaDaAgenda(conta, { tipo: 'tudo' }, colega, filtro({ alcance: 'minhas' }), AGORA)
    expect(r.total).toBe(5)
  })

  it('concluídas vêm em ordem de conclusão, a mais recente primeiro', async () => {
    const r = await paginaDaAgenda(conta, { tipo: 'tudo' }, eu, filtro({ situacao: 'concluida' }), AGORA)
    expect(r.itens.map((a) => a.titulo)).toEqual(['Feita 1', 'Feita 2', 'Feita 0'])
  })

  it('total e página: 60 abertas dão página 2 com 10 itens', async () => {
    const r = await paginaDaAgenda(conta, { tipo: 'tudo' }, eu, filtro({ pagina: 2 }), AGORA)
    expect(r.total).toBe(60)
    expect(r.itens).toHaveLength(10)
    expect(r.itens.at(-1)?.prazo).toBeNull()
  })

  it('não lê atividade de outra conta', async () => {
    const r = await paginaDaAgenda(conta, { tipo: 'tudo' }, eu, filtro({ busca: 'vizinh' }), AGORA)
    expect(r.total).toBe(0)
    const daVizinha = await paginaDaAgenda(vizinha, { tipo: 'tudo' }, eu, filtro(), AGORA)
    expect(daVizinha.itens.map((a) => a.titulo)).toEqual(['Da vizinha'])
  })
})

/*
 * Reagendar e atribuir pela agenda (tarefa 1.2).
 */
describe.skipIf(!temCredencial)('reagendar e atribuir', () => {
  let conta = ''
  let membro = ''
  let estranho = ''
  let contato = ''

  beforeAll(async () => {
    if (!temCredencial) return
    conta = (await criarCliente(`${marca} reagendar`)).id
    contato = (await acharOuCriarContato(conta, `5511${seed}41`, 'Bia')).id
    const usuarios = [`${marca} membro`, `${marca} estranho`].map((nome) => ({
      id: crypto.randomUUID(),
      name: nome,
      email: `${nome.replace(/\s/g, '-')}@exemplo.test`,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    await db().from('af_usuarios').insert(usuarios)
    membro = usuarios[0]!.id
    estranho = usuarios[1]!.id
    const { error } = await db()
      .from('af_membros')
      .insert({ organizationId: conta, userId: membro, role: 'member' })
    if (error) throw new Error(error.message)
  })

  afterAll(async () => {
    if (!temCredencial) return
    await db().from('af_membros').delete().eq('organizationId', conta)
    if (conta) await db().from('clients').delete().eq('id', conta)
    await db().from('af_usuarios').delete().in('id', [membro, estranho].filter(Boolean))
  })

  const nova = async () => {
    const r = await criarAtividade({
      clienteId: conta, contatoId: contato, tipo: 'ligacao', titulo: 'Ligar para a Bia',
      prazo: '2026-09-24T17:00:00.000Z', horaMarcada: true, responsavelId: membro,
    })
    if (!r.ok) throw new Error(r.motivo)
    return r.atividade
  }

  it('reagendar muda dia e hora e mantém tipo, contato e responsável', async () => {
    const a = await nova()
    const r = await reagendarAtividade(conta, a.id, { prazo: '2026-10-02T14:30:00.000Z', horaMarcada: true })
    expect(r).toEqual({ ok: true })
    const [depois] = (await atividadesDoContato(conta, contato)).filter((x) => x.id === a.id)
    expect(depois).toMatchObject({
      prazo: '2026-10-02T14:30:00+00:00', horaMarcada: true, tipo: 'ligacao', contatoId: contato, responsavelId: membro,
    })
  })

  it('reagendar sem hora grava meio-dia UTC e hora_marcada falso', async () => {
    const a = await nova()
    const prazo = prazoDoDia('2026-10-05', '')
    expect(prazo).toBe('2026-10-05T12:00:00.000Z')
    await reagendarAtividade(conta, a.id, { prazo, horaMarcada: false })
    const [depois] = (await atividadesDoContato(conta, contato)).filter((x) => x.id === a.id)
    expect(depois).toMatchObject({ prazo: '2026-10-05T12:00:00+00:00', horaMarcada: false })
  })

  it('não reagenda concluída', async () => {
    const a = await nova()
    await resolverAtividade(conta, a.id, 'concluida')
    const r = await reagendarAtividade(conta, a.id, { prazo: null, horaMarcada: false })
    expect(r).toEqual({ ok: false, motivo: 'só dá para mudar atividade aberta' })
  })

  it('atribuir para quem não é membro é recusado', async () => {
    const a = await nova()
    expect(await atribuirAtividade(conta, a.id, estranho)).toEqual({
      ok: false, motivo: 'essa pessoa não é da equipe desta conta',
    })
    expect(await atribuirAtividade(conta, a.id, null)).toEqual({ ok: true })
    expect(await atribuirAtividade(conta, a.id, membro)).toEqual({ ok: true })
  })

  it('não mexe em atividade de outra conta', async () => {
    const a = await nova()
    const outra = (await criarCliente(`${marca} reagendar vizinha`)).id
    expect((await reagendarAtividade(outra, a.id, { prazo: null, horaMarcada: false })).ok).toBe(false)
    expect((await atribuirAtividade(outra, a.id, null)).ok).toBe(false)
    const [intacta] = (await atividadesDoContato(conta, contato)).filter((x) => x.id === a.id)
    expect(intacta?.responsavelId).toBe(membro)
    await db().from('clients').delete().eq('id', outra)
  })
})
