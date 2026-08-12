import { afterAll, describe, expect, it } from 'vitest'
import { fluxoNovo } from '@/core/flow/novo'
import { db } from '../db'
import { acharCliente, atualizarContexto, criarCliente, listarClientes } from './clientes'
import {
  acharFluxo,
  acharVersao,
  criarFluxo,
  definirIa,
  listarFluxos,
  listarVersoes,
  publicar,
  salvarRascunho,
} from './fluxos'

/**
 * Fala com o Supabase de verdade. Não tem mock: o que a gente precisa saber é
 * se o banco aceita o que a gente manda, e mock nenhum responde isso.
 *
 * Cria tudo com um nome carimbado e apaga no fim. Se rodar sem `.env`, pula.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-teste-${Math.random().toString(36).slice(2, 8)}`
const criados: string[] = []

afterAll(async () => {
  if (!temCredencial) return
  for (const id of criados) {
    // `on delete cascade` leva os fluxos junto.
    await db().from('clients').delete().eq('id', id)
  }
})

describe.skipIf(!temCredencial)('repos contra o Supabase', () => {
  it('cria um cliente e acha ele depois', async () => {
    const criado = await criarCliente(`${marca} cliente`)
    criados.push(criado.id)

    expect(criado.id).toMatch(/^[0-9a-f-]{36}$/)
    // Nasce sem contexto, e é por isso que a tela de contexto existe: sem ele
    // preenchido, fluxo com bloco de IA não publica.
    expect(criado.contextoNegocio).toBe('')

    const achado = await acharCliente(criado.id)
    expect(achado?.nome).toBe(`${marca} cliente`)

    const todos = await listarClientes()
    expect(todos.some((c) => c.id === criado.id)).toBe(true)
  })

  it('cria um fluxo, guarda o grafo e devolve ele validado', async () => {
    const cliente = await criarCliente(`${marca} com fluxo`)
    criados.push(cliente.id)

    const fluxo = await criarFluxo(cliente.id, `${marca} triagem`, fluxoNovo())

    expect(fluxo.clienteId).toBe(cliente.id)
    expect(fluxo.rascunho.inicio).toBe('abertura')
    expect(fluxo.rascunho.nodes).toHaveLength(4)

    const lista = await listarFluxos(cliente.id)
    expect(lista.map((f) => f.id)).toEqual([fluxo.id])
  })

  it('salva o rascunho e a leitura seguinte traz o grafo novo', async () => {
    const cliente = await criarCliente(`${marca} rascunho`)
    criados.push(cliente.id)

    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())

    const mexido = structuredClone(fluxo.rascunho)
    const abertura = mexido.nodes.find((n) => n.id === 'abertura')
    if (abertura?.type === 'mensagem') abertura.data.texto = 'texto trocado'

    await salvarRascunho(fluxo.id, mexido)

    const relido = await acharFluxo(fluxo.id)
    const aberturaRelida = relido?.rascunho.nodes.find((n) => n.id === 'abertura')
    expect(aberturaRelida?.type === 'mensagem' && aberturaRelida.data.texto).toBe('texto trocado')
  })

  it('recusa gravar grafo inválido em vez de sujar o banco', async () => {
    const cliente = await criarCliente(`${marca} invalido`)
    criados.push(cliente.id)

    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())
    const torto = { inicio: 'abertura', nodes: [], edges: [] }

    await expect(salvarRascunho(fluxo.id, torto as never)).rejects.toThrow()
  })

  it('publica, numera a versão e aponta o fluxo para ela', async () => {
    const cliente = await criarCliente(`${marca} publicar`)
    criados.push(cliente.id)
    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())

    const primeira = await publicar(fluxo.id, fluxo.rascunho)
    expect(primeira.ok && primeira.versao.versao).toBe(1)

    const segunda = await publicar(fluxo.id, fluxo.rascunho)
    expect(segunda.ok && segunda.versao.versao).toBe(2)

    const relido = await acharFluxo(fluxo.id)
    expect(segunda.ok && relido?.versaoPublicadaId).toBe(segunda.ok && segunda.versao.id)

    const versoes = await listarVersoes(fluxo.id)
    expect(versoes.map((v) => v.versao)).toEqual([2, 1])
  })

  /**
   * O portão de qualidade tem que estar no servidor. O botão desabilitado no
   * editor é conveniência; isto aqui é a garantia.
   */
  it('RECUSA publicar fluxo sem caminho até um humano', async () => {
    const cliente = await criarCliente(`${marca} sem humano`)
    criados.push(cliente.id)

    const semSaida = structuredClone(fluxoNovo())
    semSaida.nodes = semSaida.nodes.filter((n) => n.type !== 'handoff')
    semSaida.edges = semSaida.edges.filter((a) => a.target !== 'humano')

    const fluxo = await criarFluxo(cliente.id, `${marca} f`, semSaida)
    const r = await publicar(fluxo.id, fluxo.rascunho)

    expect(r.ok).toBe(false)
    expect(!r.ok && r.erros.map((e) => e.codigo)).toContain('SEM_SAIDA_HUMANA')

    const relido = await acharFluxo(fluxo.id)
    expect(relido?.versaoPublicadaId).toBeNull()
    expect(await listarVersoes(fluxo.id)).toEqual([])
  })

  it('a versão publicada não muda quando o rascunho muda depois', async () => {
    const cliente = await criarCliente(`${marca} congelada`)
    criados.push(cliente.id)
    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())

    const pub = await publicar(fluxo.id, fluxo.rascunho)
    if (!pub.ok) throw new Error('deveria ter publicado')

    const mexido = structuredClone(fluxo.rascunho)
    const abertura = mexido.nodes.find((n) => n.id === 'abertura')
    if (abertura?.type === 'mensagem') abertura.data.texto = 'texto novo do rascunho'
    await salvarRascunho(fluxo.id, mexido)

    const congelada = await acharVersao(pub.versao.id)
    const aberturaCongelada = congelada?.grafo.nodes.find((n) => n.id === 'abertura')

    expect(aberturaCongelada?.type === 'mensagem' && aberturaCongelada.data.texto).toBe(
      'Oi! 👋 Sou o assistente virtual. Posso te ajudar?',
    )

    const relido = await acharFluxo(fluxo.id)
    const aberturaRascunho = relido?.rascunho.nodes.find((n) => n.id === 'abertura')
    expect(aberturaRascunho?.type === 'mensagem' && aberturaRascunho.data.texto).toBe(
      'texto novo do rascunho',
    )
  })

  it('o banco recusa alterar uma versão já publicada', async () => {
    const cliente = await criarCliente(`${marca} imutavel`)
    criados.push(cliente.id)
    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())

    const pub = await publicar(fluxo.id, fluxo.rascunho)
    if (!pub.ok) throw new Error('deveria ter publicado')

    const { error } = await db()
      .from('flow_versions')
      .update({ grafo: {} })
      .eq('id', pub.versao.id)

    expect(error?.message).toContain('não pode ser alterada')
  })

  /**
   * O portão comercial da Etapa 2, ponta a ponta: coluna no banco, leitura no
   * repo, recusa no `publicar`. Vender IA tem que ser ligar um booleano — e não
   * ligar tem que impedir de verdade, não só sumir com o botão da tela.
   */
  it('RECUSA publicar fluxo com IA enquanto a automação não tiver o plano', async () => {
    const cliente = await criarCliente(`${marca} plano ia`)
    criados.push(cliente.id)

    const comIa = structuredClone(fluxoNovo())
    comIa.nodes.push({
      id: 'duvida',
      type: 'ia',
      position: { x: 400, y: 400 },
      data: { instrucao: 'Responda a dúvida do cliente.' },
    })
    comIa.edges.push({ id: 'para-ia', source: 'abertura', target: 'duvida' })

    const fluxo = await criarFluxo(cliente.id, `${marca} f`, comIa)
    expect(fluxo.iaHabilitada).toBe(false)

    const recusado = await publicar(fluxo.id, fluxo.rascunho)
    expect(recusado.ok).toBe(false)
    expect(!recusado.ok && recusado.erros.map((e) => e.codigo)).toContain('IA_NAO_CONTRATADA')
    expect(await listarVersoes(fluxo.id)).toEqual([])

    // Contratou o plano, mas o contexto do negócio continua vazio: ainda não
    // publica. Com o contexto vazio a IA responde "não sei" a tudo, e o bot
    // pareceria pronto sem nunca responder.
    await definirIa(fluxo.id, true)
    const semContexto = await publicar(fluxo.id, fluxo.rascunho)
    expect(semContexto.ok).toBe(false)
    expect(!semContexto.ok && semContexto.erros.map((e) => e.codigo)).toContain(
      'SEM_CONTEXTO_DE_NEGOCIO',
    )

    // Com as duas coisas, a mesma publicação passa, sem redesenhar nada.
    await atualizarContexto(cliente.id, 'Pintura residencial em Maringá. Orçamento gratuito.')
    const aceito = await publicar(fluxo.id, fluxo.rascunho)
    expect(aceito.ok).toBe(true)
  })

  it('devolve null para id que não existe', async () => {
    expect(await acharCliente('00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(await acharFluxo('00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})
