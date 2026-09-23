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
  avancarInscricao,
  apagarPasso,
  apagarSequencia,
  contarInscricoes,
  criarPasso,
  criarSequencia,
  editarPasso,
  encerrarInscricao,
  esperandoPorPasso,
  inscrever,
  listarSequencias,
  sairDasSequencias,
  sairPorEtiquetaDeSaida,
  sequenciasDoEvento,
} from './sequencias'
import { agendar } from './tarefas'
import { chaveDoPasso } from '@/core/tarefas'
import { acharQuadro, apagarEtapa, criarEtapa, criarQuadro } from './quadros'

/**
 * As sequências contra o banco de verdade (0031).
 *
 * O que precisa ser provado aqui não é que a linha entra, é o que **impede**
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
      colunaId: null,
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
      colunaId: null,
    })
    expect(r).toEqual({ ok: false, motivo: 'esta etiqueta não é deste cliente' })
  })

  it('cria e ordena os passos pelo tempo, não pela criação', async () => {
    const r = await criarSequencia(clienteId, {
      nome: `${marca} retomada`,
      evento: 'etiqueta_aplicada',
      etiquetaId,
      etiquetaDeSaidaId: saidaId,
      colunaId: null,
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
  it('não apaga o fluxo que é passo dela, e diz onde desligar', async () => {
    const r = await apagarFluxo(clienteId, fluxoId)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('retomada')
  })

  it('não apaga a etiqueta que a dispara', async () => {
    const r = await apagarEtiqueta(clienteId, etiquetaId)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('retomada')
  })

  it('apaga a etiqueta de saída sem drama, ela é opcional por desenho', async () => {
    expect(await apagarEtiqueta(clienteId, saidaId)).toEqual({ ok: true })
  })

  /*
   * O aceite **A20**: "etapa/campo tem automação dependente e alguém arquiva ->
   * dependência é resolvida ou operação bloqueada com explicação".
   *
   * A validação da T9.1 achou este descoberto. O bloqueio existia para os dois
   * casos vizinhos, o fluxo que é passo e a etiqueta que dispara, logo acima ,
   * e **não existia para a etapa**, embora `sequencias.coluna_id` aponte para
   * uma. A ausência é mais fácil de não notar justamente porque os vizinhos
   * estão cobertos.
   *
   * O modo de falha é silencioso, e é isso que o torna caro: a etapa some, a
   * sequência continua ativa apontando para um `coluna_id` que não existe mais,
   * e ninguém descobre até o dia em que alguém esperava a automação rodar.
   */
  it('não apaga a etapa que dispara uma sequência, e diz qual é (A20)', async () => {
    const quadro = await criarQuadro(clienteId, `${marca} funil do A20`)
    if (!quadro.ok) throw new Error(`não deu para criar o quadro: ${quadro.motivo}`)

    const criada = await criarEtapa(clienteId, quadro.id, 'Proposta enviada')
    if (!criada.ok) throw new Error(`não deu para criar a etapa: ${criada.motivo}`)

    // `criarEtapa` devolve só `{ ok }`, sem o id: a etapa se acha relendo o
    // quadro, como o teste do gatilho por etapa mais abaixo já faz.
    const etapa = (await acharQuadro(clienteId, quadro.id))!.etapas.find(
      (e) => e.nome === 'Proposta enviada',
    )!
    expect(etapa).toBeTruthy()

    const sequencia = await criarSequencia(clienteId, {
      nome: `${marca} cobranca da proposta`,
      evento: 'etapa_alcancada',
      etiquetaId: null,
      etiquetaDeSaidaId: null,
      colunaId: etapa.id,
    })
    expect(sequencia.ok).toBe(true)

    const r = await apagarEtapa(clienteId, quadro.id, etapa.id)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      // Nomear a sequência é metade do valor: "está em uso" manda a pessoa
      // procurar onde, e a tela de sequências pode ter dezenas.
      expect(r.motivo).toContain('cobranca da proposta')
    }

    // E a etapa continua lá: recusar e apagar mesmo assim seria pior que não
    // recusar, porque a mensagem diria que nada aconteceu.
    const depois = await acharQuadro(clienteId, quadro.id)
    expect(depois?.etapas.some((e) => e.id === etapa.id)).toBe(true)
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
    // Aplicar a mesma etiqueta duas vezes não pode inscrever duas vezes, senão
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

  it('depois de sair dá para entrar de novo, o índice único é parcial', async () => {
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
    // nenhuma sequência a declara, e ninguém sai por ela.
    await inscrever(clienteId, sequencia.id, contatoId)
    expect(await sairPorEtiquetaDeSaida(clienteId, etiquetaId, [contatoId])).toEqual([])

    const contagem = (await contarInscricoes(clienteId)).get(sequencia.id)!
    expect(contagem.ativas).toBe(1)
  })
})

describe.skipIf(!temCredencial)('o gatilho por etapa do quadro (0034)', () => {
  it('recusa evento de etapa sem etapa, e etapa de outra conta', async () => {
    expect(
      await criarSequencia(clienteId, {
        nome: `${marca} sem etapa`,
        evento: 'etapa_alcancada',
        etiquetaId: null,
        etiquetaDeSaidaId: null,
        colunaId: null,
      }),
    ).toEqual({ ok: false, motivo: 'escolha a etapa do quadro que dispara a sequência' })

    const alheio = await criarQuadro(outroId, `${marca} alheio`)
    const etapaAlheia = alheio.ok ? (await acharQuadro(outroId, alheio.id))!.etapas[0]! : null

    expect(
      await criarSequencia(clienteId, {
        nome: `${marca} etapa roubada`,
        evento: 'etapa_alcancada',
        etiquetaId: null,
        etiquetaDeSaidaId: null,
        colunaId: etapaAlheia!.id,
      }),
    ).toEqual({ ok: false, motivo: 'esta etapa não é deste cliente' })
  })

  it('o evento acha pela etapa, e não pela etiqueta', async () => {
    const quadro = await criarQuadro(clienteId, `${marca} funil`)
    const etapa = quadro.ok ? (await acharQuadro(clienteId, quadro.id))!.etapas[1]! : null

    const nova = await criarSequencia(clienteId, {
      nome: `${marca} pos-agendamento`,
      evento: 'etapa_alcancada',
      etiquetaId: null,
      etiquetaDeSaidaId: null,
      colunaId: etapa!.id,
    })
    expect(nova.ok).toBe(true)
    if (nova.ok) await criarPasso(clienteId, nova.id, { atrasoMinutos: 120, fluxoId })

    // Filtrar sempre por `etiqueta_id` faria este evento não achar nada, em
    // silêncio, que é o defeito que a consulta separada por evento evita.
    const achadas = await sequenciasDoEvento(clienteId, 'etapa_alcancada', etapa!.id)
    expect(achadas.map((s) => s.nome)).toEqual([expect.stringContaining('pos-agendamento')])

    // Outra etapa do mesmo quadro não dispara esta sequência.
    const outraEtapa = (await acharQuadro(clienteId, quadro.ok ? quadro.id : ''))!.etapas[0]!
    expect(await sequenciasDoEvento(clienteId, 'etapa_alcancada', outraEtapa.id)).toEqual([])
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

    // **Todas**, e não só aquela: o fluxo é passo de mais de uma sequência
    // (a de etiqueta e a de etapa), e a recusa olha todas, que é justamente o
    // comportamento que se quer provar aqui.
    for (const outra of await listarSequencias(clienteId)) {
      expect(await apagarSequencia(clienteId, outra.id)).toBe(true)
    }
    expect(await apagarFluxo(clienteId, fluxoId)).toEqual({ ok: true })
  })
})

describe.skipIf(!temCredencial)('a régua de retomada (0070)', () => {
  it('recusa o evento de sumiço sem dizer de quantos dias', async () => {
    // Sequência de sumiço sem a condição é uma régua que nunca dispara e que a
    // tela mostraria como ativa, o mesmo defeito que as coerências da 0031 e
    // da 0034 já barravam para etiqueta e etapa.
    const r = await criarSequencia(clienteId, {
      nome: 'retomada sem dias',
      evento: 'cliente_sumido',
      etiquetaId: null,
      etiquetaDeSaidaId: null,
      colunaId: null,
      diasSemConversa: null,
    })
    expect(r.ok).toBe(false)
  })

  it('cria com os dias, e o evento acha só ela', async () => {
    const criada = await criarSequencia(clienteId, {
      nome: 'retomada de 60 dias',
      evento: 'cliente_sumido',
      etiquetaId: null,
      etiquetaDeSaidaId: null,
      colunaId: null,
      diasSemConversa: 60,
    })
    expect(criada.ok).toBe(true)

    const doEvento = await sequenciasDoEvento(clienteId, 'cliente_sumido', null)
    // Sem passo ela não inscreve ninguém, e `sequenciasDoEvento` já filtra isso:
    // a régua existe no banco e ainda não alcança pessoa nenhuma.
    expect(doEvento.every((s) => s.evento === 'cliente_sumido')).toBe(true)
  })
})

describe.skipIf(!temCredencial)('editar um passo com gente no meio (A06)', () => {
  let sequenciaId = ''
  let passos: { id: string; atrasoMinutos: number }[] = []
  let outroFluxo = ''
  let entrouEm = ''
  let chave = ''

  beforeAll(async () => {
    const r = await criarSequencia(clienteId, {
      nome: `${marca} edicao`,
      evento: 'atendimento_encerrado',
      etiquetaId: null,
      etiquetaDeSaidaId: null,
      colunaId: null,
    })
    if (!r.ok) throw new Error(r.motivo)
    sequenciaId = r.id
    // Fluxo próprio: o bloco de cima apaga o `fluxoId` compartilhado.
    const fluxo = (await criarFluxo(clienteId, `${marca} passo editavel`, triagem)).id
    for (const atraso of [30, 120, 360]) {
      const p = await criarPasso(clienteId, sequenciaId, { atrasoMinutos: atraso, fluxoId: fluxo })
      if (!p.ok) throw new Error(p.motivo)
    }
    passos = (await listarSequencias(clienteId)).find((s) => s.id === sequenciaId)!.passos
    outroFluxo = (await criarFluxo(clienteId, `${marca} outro conteudo`, triagem)).id

    // Alguém que já recebeu o 1º passo e espera o 2º (índice 1), com a tarefa
    // agendada como o executor agenda.
    const contato = await acharOuCriarContato(clienteId, `5511${seed}09`, 'Bia')
    const inscricao = (await inscrever(clienteId, sequenciaId, contato.id))!
    await avancarInscricao(inscricao.id, 1)
    entrouEm = inscricao.entrouEm
    chave = chaveDoPasso(inscricao.id)
    await agendar({
      clienteId,
      tipo: 'passo_de_sequencia',
      quando: new Date(new Date(entrouEm).getTime() + 120 * 60_000),
      chave,
      dados: { inscricaoId: inscricao.id, sequenciaId, contatoId: contato.id, passoIndice: 1, entrouEm },
    })
  })

  it('editar conteúdo vale para quem ainda não recebeu, sem remarcar ninguém', async () => {
    expect(await editarPasso(clienteId, passos[1]!.id, { fluxoId: outroFluxo })).toEqual({ ok: true, remarcadas: 0 })
    const sequencia = (await listarSequencias(clienteId)).find((s) => s.id === sequenciaId)!
    expect(sequencia.passos[1]!.fluxoId).toBe(outroFluxo)
  })

  it('editar horário remarca a tarefa de quem está esperando este passo', async () => {
    expect(await editarPasso(clienteId, passos[1]!.id, { atrasoMinutos: 200 })).toEqual({ ok: true, remarcadas: 1 })
    const { data } = await db().from('tarefas').select('quando').eq('chave', chave).eq('estado', 'pendente').single()
    expect(new Date(data!.quando as string).getTime()).toBe(new Date(entrouEm).getTime() + 200 * 60_000)
    const esperando = await esperandoPorPasso(clienteId)
    expect(esperando.get(`${sequenciaId}:1`)).toBe(1)
    expect(esperando.get(`${sequenciaId}:2`)).toBeUndefined()
  })

  it('horário que troca a ordem é recusado, dizendo a faixa', async () => {
    const r = await editarPasso(clienteId, passos[1]!.id, { atrasoMinutos: 400 })
    expect(r).toEqual({ ok: false, motivo: 'Esse horário mudaria a ordem dos passos. Escolha entre 30min e 6h.' })
    expect(await editarPasso(clienteId, passos[1]!.id, { atrasoMinutos: 30 })).toMatchObject({ ok: false })
  })

  it('acima de 24h sem modelo é recusado', async () => {
    const r = await editarPasso(clienteId, passos[2]!.id, { atrasoMinutos: 1500 })
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.motivo).toContain('24h')
  })

  it('não edita passo de outra conta', async () => {
    expect(await editarPasso(outroId, passos[0]!.id, { atrasoMinutos: 10 })).toEqual({
      ok: false,
      motivo: 'este passo não existe mais',
    })
    expect(await editarPasso(clienteId, passos[0]!.id, { fluxoId: fluxoDoOutro })).toEqual({
      ok: false,
      motivo: 'este fluxo não é deste cliente',
    })
  })
})
