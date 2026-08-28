import { afterAll, describe, expect, it } from 'vitest'
import { textoDaMensagem } from '@/core/flow/mensagem'
import { fluxoNovo } from '@/core/flow/novo'
import { db } from '../db'
import { acharCliente, atualizarContexto, criarCliente, listarClientes } from './clientes'
import {
  acharFluxo,
  acharVersao,
  acharVersaoDoFluxo,
  apagarFluxo,
  criarFluxo,
  definirIa,
  listarFluxos,
  listarVersoes,
  publicar,
  salvarRascunho,
} from './fluxos'
import { listarConexoes } from './conexoes'
import {
  contextoDeResposta,
  criarCanal,
  desconectarNumero,
  listarCanais,
} from './conversas'
import { acharLead, lerConversa, listarLeads } from './leads'

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

    await salvarRascunho(fluxo.id, cliente.id, mexido)

    const relido = await acharFluxo(fluxo.id)
    const aberturaRelida = relido?.rascunho.nodes.find((n) => n.id === 'abertura')
    expect(aberturaRelida?.type === 'mensagem' && aberturaRelida.data.texto).toBe('texto trocado')
  })

  it('recusa gravar grafo inválido em vez de sujar o banco', async () => {
    const cliente = await criarCliente(`${marca} invalido`)
    criados.push(cliente.id)

    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())
    const torto = { inicio: 'abertura', nodes: [], edges: [] }

    await expect(salvarRascunho(fluxo.id, cliente.id, torto as never)).rejects.toThrow()
  })

  it('publica, numera a versão e aponta o fluxo para ela', async () => {
    const cliente = await criarCliente(`${marca} publicar`)
    criados.push(cliente.id)
    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())

    const primeira = await publicar(fluxo.id, cliente.id, fluxo.rascunho)
    expect(primeira.ok && primeira.versao.versao).toBe(1)

    const segunda = await publicar(fluxo.id, cliente.id, fluxo.rascunho)
    expect(segunda.ok && segunda.versao.versao).toBe(2)

    const relido = await acharFluxo(fluxo.id)
    expect(segunda.ok && relido?.versaoPublicadaId).toBe(segunda.ok && segunda.versao.id)

    const versoes = await listarVersoes(fluxo.id)
    expect(versoes.map((v) => v.versao)).toEqual([2, 1])
  })

  /**
   * O caminho exato do rollback: achar a versão antiga provando o fluxo, e
   * publicá-la de novo. Voltar nunca reescreve nem aponta para trás.
   */
  it('voltar para uma versão antiga publica ela como versão nova', async () => {
    const cliente = await criarCliente(`${marca} rollback`)
    criados.push(cliente.id)

    const primeiroDesenho = fluxoNovo()
    const fluxo = await criarFluxo(cliente.id, `${marca} f`, primeiroDesenho)
    const v1 = await publicar(fluxo.id, cliente.id, primeiroDesenho)
    if (!v1.ok) throw new Error('deveria ter publicado a v1')

    const segundoDesenho = structuredClone(primeiroDesenho)
    const abertura = segundoDesenho.nodes.find((no) => no.id === 'abertura')
    if (abertura?.type === 'mensagem') abertura.data.texto = 'texto da v2'
    const v2 = await publicar(fluxo.id, cliente.id, segundoDesenho)
    if (!v2.ok) throw new Error('deveria ter publicado a v2')

    const antiga = await acharVersaoDoFluxo(v1.versao.id, fluxo.id)
    if (!antiga) throw new Error('a v1 deveria continuar existindo')
    const v3 = await publicar(fluxo.id, cliente.id, antiga.grafo)

    expect(v3.ok && v3.versao.versao).toBe(3)
    expect(v3.ok && v3.versao.grafo).toEqual(v1.versao.grafo)

    // O histórico cresce: a v2 continua lá, inteira, com o desenho dela.
    expect((await listarVersoes(fluxo.id)).map((v) => v.versao)).toEqual([3, 2, 1])
    expect((await acharVersao(v2.versao.id))?.grafo).toEqual(segundoDesenho)

    // E o que está no ar é a nova, não a antiga — nada aponta para trás.
    const relido = await acharFluxo(fluxo.id)
    expect(relido?.versaoPublicadaId).toBe(v3.ok ? v3.versao.id : null)
    expect(relido?.rascunho).toEqual(primeiroDesenho)
  })

  it('não acha a versão de uma automação usando o id de outra', async () => {
    const cliente = await criarCliente(`${marca} versao cruzada`)
    criados.push(cliente.id)
    const meu = await criarFluxo(cliente.id, `${marca} meu`, fluxoNovo())
    const outro = await criarFluxo(cliente.id, `${marca} outro`, fluxoNovo())

    const publicada = await publicar(meu.id, cliente.id, meu.rascunho)
    if (!publicada.ok) throw new Error('deveria ter publicado')

    expect(await acharVersaoDoFluxo(publicada.versao.id, meu.id)).not.toBeNull()
    expect(await acharVersaoDoFluxo(publicada.versao.id, outro.id)).toBeNull()
    expect(await acharVersaoDoFluxo(publicada.versao.id, 'nao-existe')).toBeNull()
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
    const r = await publicar(fluxo.id, cliente.id, fluxo.rascunho)

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

    const pub = await publicar(fluxo.id, cliente.id, fluxo.rascunho)
    if (!pub.ok) throw new Error('deveria ter publicado')

    const mexido = structuredClone(fluxo.rascunho)
    const abertura = mexido.nodes.find((n) => n.id === 'abertura')
    if (abertura?.type === 'mensagem') {
      abertura.data.partes = [{ tipo: 'texto', texto: 'texto novo do rascunho' }]
    }
    await salvarRascunho(fluxo.id, cliente.id, mexido)

    /**
     * Lê pelo normalizador, e não por `data.texto`, porque o bloco tem dois
     * formatos gravados no banco: o antigo (`{ texto }`, de tudo que foi
     * publicado antes da A3) e a pilha de pedaços. É justamente esta leitura
     * que mantém viva a conversa presa a uma versão antiga.
     */
    const congelada = await acharVersao(pub.versao.id)
    const aberturaCongelada = congelada?.grafo.nodes.find((n) => n.id === 'abertura')

    expect(aberturaCongelada?.type === 'mensagem' && textoDaMensagem(aberturaCongelada)).toBe(
      'Oi! 👋 Sou o assistente virtual. Posso te ajudar?',
    )

    const relido = await acharFluxo(fluxo.id)
    const aberturaRascunho = relido?.rascunho.nodes.find((n) => n.id === 'abertura')
    expect(aberturaRascunho?.type === 'mensagem' && textoDaMensagem(aberturaRascunho)).toBe(
      'texto novo do rascunho',
    )
  })

  it('o banco recusa alterar uma versão já publicada', async () => {
    const cliente = await criarCliente(`${marca} imutavel`)
    criados.push(cliente.id)
    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())

    const pub = await publicar(fluxo.id, cliente.id, fluxo.rascunho)
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
      data: { instrucao: 'Responda a dúvida do cliente.', ferramentas: [] },
    })
    comIa.edges.push({ id: 'para-ia', source: 'abertura', target: 'duvida' })

    const fluxo = await criarFluxo(cliente.id, `${marca} f`, comIa)
    expect(fluxo.iaHabilitada).toBe(false)

    const recusado = await publicar(fluxo.id, cliente.id, fluxo.rascunho)
    expect(recusado.ok).toBe(false)
    expect(!recusado.ok && recusado.erros.map((e) => e.codigo)).toContain('IA_NAO_CONTRATADA')
    expect(await listarVersoes(fluxo.id)).toEqual([])

    // Contratou o plano, mas o contexto do negócio continua vazio: ainda não
    // publica. Com o contexto vazio a IA responde "não sei" a tudo, e o bot
    // pareceria pronto sem nunca responder.
    await definirIa(fluxo.id, cliente.id, true)
    const semContexto = await publicar(fluxo.id, cliente.id, fluxo.rascunho)
    expect(semContexto.ok).toBe(false)
    expect(!semContexto.ok && semContexto.erros.map((e) => e.codigo)).toContain(
      'SEM_CONTEXTO_DE_NEGOCIO',
    )

    // Com as duas coisas, a mesma publicação passa, sem redesenhar nada.
    await atualizarContexto(cliente.id, 'Pintura residencial em Maringá. Orçamento gratuito.')
    const aceito = await publicar(fluxo.id, cliente.id, fluxo.rascunho)
    expect(aceito.ok).toBe(true)
  })

  it('devolve null para id que não existe', async () => {
    expect(await acharCliente('00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(await acharFluxo('00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  /**
   * Id torto no endereço é "não achei", nunca 500.
   *
   * O Postgres recusa `where id = 'nao-existe'` com 22P02 antes de olhar a
   * tabela. Sem tratar, a exceção subia e a pessoa via "Alguma coisa quebrou
   * aqui" — para um link truncado no WhatsApp ou um id colado pela metade, que
   * é o jeito mais comum de chegar num endereço errado aqui.
   */
  it('id sem forma de uuid é não-encontrado, e não erro', async () => {
    expect(await acharCliente('nao-existe')).toBeNull()
    expect(await acharFluxo('nao-existe')).toBeNull()
    expect(await acharVersao('nao-existe')).toBeNull()
    expect(await listarFluxos('nao-existe')).toEqual([])
    expect(await listarVersoes('nao-existe')).toEqual([])
    expect(await listarLeads('nao-existe')).toEqual([])
    expect(await acharLead('nao-existe', 'nao-existe')).toBeNull()
    expect(await lerConversa('nao-existe')).toEqual({ cortada: false, mensagens: [] })
    expect(await listarConexoes('nao-existe')).toEqual([])
    expect(await listarCanais('nao-existe')).toEqual([])
    expect(await contextoDeResposta('nao-existe', 'nao-existe')).toBeNull()
  })

  /**
   * Apagar automação recusa enquanto ela estiver ligada a um número: apagar
   * um fluxo que um número executa deixa o bot mudo no WhatsApp de gente de
   * verdade, e desligar o número tem que ser um ato deliberado.
   */
  it('RECUSA apagar automação ligada a um número, e aceita depois de desligar', async () => {
    const cliente = await criarCliente(`${marca} apagar`)
    criados.push(cliente.id)

    const fluxo = await criarFluxo(cliente.id, `${marca} descartável`, fluxoNovo())
    const canal = await criarCanal({
      clienteId: cliente.id,
      phoneNumberId: `test-apagar-${Math.random().toString(36).slice(2, 10)}`,
      flowId: fluxo.id,
    })

    const negado = await apagarFluxo(cliente.id, fluxo.id)
    expect(negado.ok).toBe(false)
    expect(!negado.ok && negado.motivo).toContain(canal.phoneNumberId)
    expect(await acharFluxo(fluxo.id)).not.toBeNull()

    // Sem conversa nenhuma, desconectar o número passa.
    expect(await desconectarNumero(cliente.id, canal.id)).toEqual({ ok: true })
    expect(await apagarFluxo(cliente.id, fluxo.id)).toEqual({ ok: true })
    expect(await acharFluxo(fluxo.id)).toBeNull()
  })

  it('não apaga a automação de um cliente pelo id de outro', async () => {
    const dono = await criarCliente(`${marca} dono`)
    const intruso = await criarCliente(`${marca} intruso`)
    criados.push(dono.id, intruso.id)

    const fluxo = await criarFluxo(dono.id, `${marca} protegido`, fluxoNovo())
    expect(await apagarFluxo(intruso.id, fluxo.id)).toEqual({ ok: true })
    // O `delete` filtra por cliente, então "ok" não significa que apagou algo
    // de outro dono — o fluxo continua lá.
    expect(await acharFluxo(fluxo.id)).not.toBeNull()
  })

  it('não altera nem publica a automação de um cliente pelo id de outro', async () => {
    const dono = await criarCliente(`${marca} dono de escrita`)
    const intruso = await criarCliente(`${marca} intruso de escrita`)
    criados.push(dono.id, intruso.id)
    const fluxo = await criarFluxo(dono.id, `${marca} protegido`, fluxoNovo())
    const alterado = structuredClone(fluxo.rascunho)
    const abertura = alterado.nodes.find((no) => no.id === 'abertura')
    if (abertura?.type === 'mensagem') abertura.data.texto = 'não pode gravar'

    await expect(salvarRascunho(fluxo.id, intruso.id, alterado)).rejects.toThrow(
      'esta automação não existe mais',
    )
    await expect(definirIa(fluxo.id, intruso.id, true)).rejects.toThrow('esta automação não existe mais')
    const publicacao = await publicar(fluxo.id, intruso.id, alterado)

    expect(publicacao.ok).toBe(false)
    expect(!publicacao.ok && publicacao.erros.map((erro) => erro.codigo)).toContain('FLUXO_SUMIU')
    expect((await acharFluxo(fluxo.id))?.rascunho).toEqual(fluxo.rascunho)
    expect((await acharFluxo(fluxo.id))?.iaHabilitada).toBe(false)
    expect(await listarVersoes(fluxo.id)).toEqual([])
  })
})
