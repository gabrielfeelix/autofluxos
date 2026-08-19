import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { triagem } from '@/exemplos/triagem'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { criarEtiqueta, apagarEtiqueta, listarEtiquetas } from './etiquetas'
import { apagarFluxo, criarFluxo } from './fluxos'
import {
  acharInscricao,
  alternarSequencia,
  apagarPasso,
  apagarSequencia,
  contarInscricoes,
  criarPasso,
  criarSequencia,
  encerrarInscricao,
  inscrever,
  listarSequencias,
  sairDasSequencias,
  sairPorEtiquetaDeSaida,
  sequenciasDoEvento,
} from './sequencias'

/**
 * As sequências contra o banco de verdade (0031).
 *
 * O que precisa ser provado aqui não é que a linha entra — é o que **impede**
 * ela de entrar: a inscrição em dobro, o passo em fluxo de outra conta, e o
 * apagar em silêncio de um fluxo ou de uma etiqueta que uma sequência usa. As
 * três coisas só aparecem contra Postgres, porque as três são índice e chave
 * estrangeira, não código.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-seq-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let outroId = ''
let contatoId = ''
let fluxoId = ''
let fluxoDoOutro = ''
let etiquetaId = ''
let saidaId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const [cliente, outro] = await Promise.all([
    criarCliente(`${marca} cliente`),
    criarCliente(`${marca} outro`),
  ])
  clienteId = cliente.id
  outroId = outro.id

  const [contato, fluxo, alheio] = await Promise.all([
    acharOuCriarContato(clienteId, `5511${seed}01`, 'Ana'),
    criarFluxo(clienteId, `${marca} lembrete`, triagem),
    criarFluxo(outroId, `${marca} alheio`, triagem),
  ])
  contatoId = contato.id
  fluxoId = fluxo.id
  fluxoDoOutro = alheio.id

  await criarEtiqueta(clienteId, { nome: 'Orçamento enviado', cor: 'ambar' })
  await criarEtiqueta(clienteId, { nome: 'Virou aluno', cor: 'verde' })
  const etiquetas = await listarEtiquetas(clienteId)
  etiquetaId = etiquetas.find((e) => e.nome === 'Orçamento enviado')!.id
  saidaId = etiquetas.find((e) => e.nome === 'Virou aluno')!.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (outroId) await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('criar a sequência e os passos', () => {
  it('recusa gatilho de etiqueta sem etiqueta', async () => {
    // Sequência de etiqueta sem etiqueta nunca dispara, e a tela a mostraria
    // ativa. O `check` da 0031 diz o mesmo; aqui a recusa chega como frase.
    const r = await criarSequencia(clienteId, {
      nome: `${marca} torta`,
      evento: 'etiqueta_aplicada',
      etiquetaId: null,
      etiquetaDeSaidaId: null,
    })
    expect(r).toEqual({ ok: false, motivo: 'escolha a etiqueta que dispara a sequência' })
  })

  it('recusa etiqueta de outra conta', async () => {
    await criarEtiqueta(outroId, { nome: 'Alheia', cor: 'cinza' })
    const alheia = (await listarEtiquetas(outroId))[0]!

    const r = await criarSequencia(clienteId, {
      nome: `${marca} roubada`,
      evento: 'etiqueta_aplicada',
      etiquetaId: alheia.id,
      etiquetaDeSaidaId: null,
    })
    expect(r).toEqual({ ok: false, motivo: 'esta etiqueta não é deste cliente' })
  })

  it('cria e ordena os passos pelo tempo, não pela criação', async () => {
    const r = await criarSequencia(clienteId, {
      nome: `${marca} retomada`,
      evento: 'etiqueta_aplicada',
      etiquetaId,
      etiquetaDeSaidaId: saidaId,
    })
    expect(r.ok).toBe(true)
    const sequenciaId = r.ok ? r.id : ''

    // Fora de ordem de propósito: quem acrescenta 30min depois de 6h está
    // inserindo no meio.
    expect(await criarPasso(clienteId, sequenciaId, { atrasoMinutos: 360, fluxoId })).toEqual({
      ok: true,
    })
    expect(await criarPasso(clienteId, sequenciaId, { atrasoMinutos: 30, fluxoId })).toEqual({
      ok: true,
    })

    const sequencia = (await listarSequencias(clienteId)).find((s) => s.id === sequenciaId)!
    expect(sequencia.passos.map((p) => p.atrasoMinutos)).toEqual([30, 360])
  })

  it('recusa dois passos no mesmo minuto e passo com fluxo de outra conta', async () => {
    const sequencia = (await listarSequencias(clienteId)).find((s) =>
      s.nome.endsWith('retomada'),
    )!

    expect(await criarPasso(clienteId, sequencia.id, { atrasoMinutos: 30, fluxoId })).toEqual({
      ok: false,
      motivo: 'já existe um passo neste mesmo tempo',
    })
    expect(
      await criarPasso(clienteId, sequencia.id, { atrasoMinutos: 90, fluxoId: fluxoDoOutro }),
    ).toEqual({ ok: false, motivo: 'este fluxo não é deste cliente' })
  })
})

describe.skipIf(!temCredencial)('o que uma sequência viva impede de apagar', () => {
  it('não apaga o fluxo que é passo dela — e diz onde desligar', async () => {
    const r = await apagarFluxo(clienteId, fluxoId)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('retomada')
  })

  it('não apaga a etiqueta que a dispara', async () => {
    const r = await apagarEtiqueta(clienteId, etiquetaId)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('retomada')
  })

  it('apaga a etiqueta de saída sem drama — ela é opcional por desenho', async () => {
    expect(await apagarEtiqueta(clienteId, saidaId)).toEqual({ ok: true })
  })
})

describe.skipIf(!temCredencial)('inscrever, e não inscrever duas vezes', () => {
  it('só lista sequências ativas, do evento certo, e com passo', async () => {
    const doEvento = await sequenciasDoEvento(clienteId, 'etiqueta_aplicada', etiquetaId)
    expect(doEvento.map((s) => s.nome)).toEqual([expect.stringContaining('retomada')])

    // Evento diferente não pega nada, mesmo com a mesma etiqueta na mão.
    expect(await sequenciasDoEvento(clienteId, 'atendimento_encerrado', null)).toEqual([])
  })

  it('a segunda inscrição ativa da mesma pessoa é recusada pelo índice', async () => {
    // Aplicar a mesma etiqueta duas vezes não pode inscrever duas vezes — senão
    // a pessoa recebe a sequência inteira em dobro.
    const sequencia = (await listarSequencias(clienteId)).find((s) =>
      s.nome.endsWith('retomada'),
    )!

    const primeira = await inscrever(clienteId, sequencia.id, contatoId)
    expect(primeira).not.toBeNull()
    expect(await inscrever(clienteId, sequencia.id, contatoId)).toBeNull()

    const contagem = (await contarInscricoes(clienteId)).get(sequencia.id)!
    expect(contagem.ativas).toBe(1)
  })

  it('sair devolve os ids, para as tarefas serem canceladas', async () => {
    const saidas = await sairDasSequencias(contatoId, 'respondeu')
    expect(saidas).toHaveLength(1)

    const inscricao = await acharInscricao(saidas[0]!)
    expect(inscricao?.estado).toBe('saiu')

    // E, fora de qualquer sequência, sair de novo não devolve nada.
    expect(await sairDasSequencias(contatoId, 'respondeu')).toEqual([])
  })

  it('depois de sair dá para entrar de novo — o índice único é parcial', async () => {
    const sequencia = (await listarSequencias(clienteId)).find((s) =>
      s.nome.endsWith('retomada'),
    )!
    const nova = await inscrever(clienteId, sequencia.id, contatoId)
    expect(nova).not.toBeNull()

    // `bloqueada` é estado próprio, e não um `saiu` com motivo: ele responde
    // "a sequência não entregou", que é outra pergunta.
    await encerrarInscricao(nova!.id, 'bloqueada', 'a janela de 24h fechou')
    const contagem = (await contarInscricoes(clienteId)).get(sequencia.id)!
    expect(contagem.bloqueadas).toBe(1)
    expect(contagem.ativas).toBe(0)
  })

  it('a etiqueta de saída só tira de quem a declara', async () => {
    const sequencia = (await listarSequencias(clienteId)).find((s) =>
      s.nome.endsWith('retomada'),
    )!
    // A etiqueta de saída desta sequência foi apagada no teste acima, então
    // nenhuma sequência a declara — e ninguém sai por ela.
    await inscrever(clienteId, sequencia.id, contatoId)
    expect(await sairPorEtiquetaDeSaida(clienteId, etiquetaId, [contatoId])).toEqual([])

    const contagem = (await contarInscricoes(clienteId)).get(sequencia.id)!
    expect(contagem.ativas).toBe(1)
  })
})

describe.skipIf(!temCredencial)('desligar, tirar passo e apagar', () => {
  it('desligar não esvazia quem já está dentro', async () => {
    const sequencia = (await listarSequencias(clienteId)).find((s) =>
      s.nome.endsWith('retomada'),
    )!

    expect(await alternarSequencia(clienteId, sequencia.id, false)).toBe(true)
    const contagem = (await contarInscricoes(clienteId)).get(sequencia.id)!
    expect(contagem.ativas).toBe(1)

    // Desligada, ela para de inscrever gente nova.
    expect(await sequenciasDoEvento(clienteId, 'etiqueta_aplicada', etiquetaId)).toEqual([])
  })

  it('não mexe em sequência de outra conta pelo id dela', async () => {
    const sequencia = (await listarSequencias(clienteId))[0]!
    expect(await alternarSequencia(outroId, sequencia.id, true)).toBe(false)
    expect(await apagarSequencia(outroId, sequencia.id)).toBe(false)
    expect(await apagarPasso(outroId, sequencia.id, sequencia.passos[0]!.id)).toBe(false)
  })

  it('apagada, ela libera o fluxo para ser apagado', async () => {
    const sequencia = (await listarSequencias(clienteId)).find((s) =>
      s.nome.endsWith('retomada'),
    )!
    expect(await apagarSequencia(clienteId, sequencia.id)).toBe(true)
    expect(await apagarFluxo(clienteId, fluxoId)).toEqual({ ok: true })
  })
})
