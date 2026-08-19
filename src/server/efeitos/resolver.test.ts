import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sessaoNova, type Resultado } from '@/core/engine/types'
import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import type { Modelo, PedidoDeIa, Resposta } from '../ia/types'

const chamarHttp = vi.hoisted(() => vi.fn())
vi.mock('./http', () => ({ chamarHttp }))

const lerCredencial = vi.hoisted(() => vi.fn())
vi.mock('../repos/conexoes', () => ({ lerCredencial }))

const { executarComEfeitos, MAX_EFEITOS } = await import('./resolver')

/**
 * Sem rede e sem chave: o modelo é de mentira de propósito.
 *
 * O que precisa ser provado aqui não é se o Gemini responde bem — isso é o
 * `gemini.test.ts`. É o que o sistema faz com a resposta: quando a IA sabe,
 * quando não sabe, e quando não existe IA nenhuma.
 */

function modeloQue(responde: (p: PedidoDeIa) => Resposta): Modelo & { pedidos: PedidoDeIa[] } {
  const pedidos: PedidoDeIa[] = []
  return {
    pedidos,
    async responder(pedido) {
      pedidos.push(pedido)
      return responde(pedido)
    },
  }
}

/** Pessoa escreve → IA responde → despedida. Com saída para humano, como manda o validador. */
const fluxoComIa: Fluxo = {
  inicio: 'duvida',
  nodes: [
    {
      id: 'duvida',
      type: 'ia',
      position: { x: 0, y: 0 },
      data: { instrucao: 'Responda a dúvida sobre o serviço.' },
    },
    {
      id: 'fim',
      type: 'handoff',
      position: { x: 0, y: 120 },
      data: { motivo: 'fim da conversa', mensagem: 'Já te passo para alguém.' },
    },
  ],
  edges: [{ id: 'a1', source: 'duvida', target: 'fim' }],
}

const contextoNegocio = 'Pintura em Maringá. Orçamento gratuito.'

describe('quando existe IA', () => {
  it('chama o modelo, manda a resposta e segue o fluxo', async () => {
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'O orçamento é gratuito!' }))

    const r = await executarComEfeitos(fluxoComIa, sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio,
      historico: [{ de: 'pessoa', texto: 'o orçamento é pago?' }],
    })

    const textos = r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))
    expect(textos).toContain('O orçamento é gratuito!')

    // O pedido de IA já foi atendido: deixar ele na lista faria quem aplica
    // mandar a conversa para um humano em cima de uma resposta que deu certo.
    expect(r.acoes.some((a) => a.tipo === 'chamar_ia')).toBe(false)

    // E o fluxo continuou: o bloco seguinte é o handoff do fim.
    expect(r.sessao.status).toBe('humano')
  })

  it('leva o contexto do negócio e a pergunta da pessoa até o modelo', async () => {
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'ok' }))

    await executarComEfeitos(fluxoComIa, sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio,
      historico: [
        { de: 'pessoa', texto: 'primeira' },
        { de: 'bot', texto: 'oi' },
        { de: 'pessoa', texto: 'o orçamento é pago?' },
      ],
    })

    expect(modelo.pedidos).toHaveLength(1)
    expect(modelo.pedidos[0]?.contextoNegocio).toBe(contextoNegocio)
    expect(modelo.pedidos[0]?.instrucao).toBe('Responda a dúvida sobre o serviço.')
    // A pergunta é a última coisa que a PESSOA disse, não a última linha.
    expect(modelo.pedidos[0]?.pergunta).toBe('o orçamento é pago?')
  })

  /** A saída de emergência: entre calar e inventar, uma pessoa assume. */
  it('quando a IA não sabe, avisa e passa para uma pessoa', async () => {
    const modelo = modeloQue(() => ({ tipo: 'nao_sei', motivo: 'fora do contexto' }))

    const r = await executarComEfeitos(fluxoComIa, sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio,
    })

    const transferencia = r.acoes.find((a) => a.tipo === 'transferir_humano')
    expect(transferencia).toBeDefined()
    expect(transferencia?.tipo === 'transferir_humano' && transferencia.motivo).toContain(
      'fora do contexto',
    )
    expect(r.sessao.status).toBe('humano')

    // A pessoa não pode ficar no vácuo esperando: sai um aviso antes.
    expect(r.acoes.some((a) => a.tipo === 'enviar_texto')).toBe(true)
  })
})

describe('quando não existe IA', () => {
  /**
   * Sem plano contratado ou sem chave, `chamar_ia` fica na lista e quem chamou
   * decide — hoje, mandar para uma pessoa. O que não pode é fingir que
   * respondeu.
   */
  it('devolve o pedido de IA intacto, sem inventar resposta', async () => {
    const r = await executarComEfeitos(fluxoComIa, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio,
    })

    expect(r.acoes.some((a) => a.tipo === 'chamar_ia')).toBe(true)
    expect(r.sessao.status).toBe('aguardando_ia')
  })
})

describe('fluxo sem IA nenhuma', () => {
  it('não chama o modelo à toa', async () => {
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'não deveria ser chamado' }))
    const simples: Fluxo = {
      inicio: 'oi',
      nodes: [
        { id: 'oi', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'Olá!' } },
        {
          id: 'fim',
          type: 'handoff',
          position: { x: 0, y: 100 },
          data: { motivo: 'fim', mensagem: 'Já te passo para alguém.' },
        },
      ],
      edges: [{ id: 'a1', source: 'oi', target: 'fim' }],
    }

    await executarComEfeitos(simples, sessaoNova(), { tipo: 'inicio' }, { modelo, contextoNegocio })
    expect(modelo.pedidos).toHaveLength(0)
  })
})

describe('resolvendo o nó de API', () => {
  const comApi = fluxoSchema.parse({
    inicio: 'consulta',
    nodes: [
      {
        id: 'consulta',
        type: 'http',
        position: { x: 0, y: 0 },
        data: { url: 'https://e.com', mapear: [{ variavel: 'situacao', caminho: 'status' }] },
      },
      { id: 'diz', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'está {{situacao}}' } },
      { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: 'a1', source: 'consulta', target: 'diz' },
      { id: 'a2', source: 'diz', target: 'humano' },
    ],
  })

  const semIa = { modelo: null, contextoNegocio: '', origem: 'whatsapp' as const }
  const textosDe = (r: Resultado) =>
    r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))

  beforeEach(() => chamarHttp.mockReset())

  it('chama, mapeia e a conversa segue', async () => {
    chamarHttp.mockResolvedValue({ ok: true, valores: { situacao: 'a caminho' } })

    const r = await executarComEfeitos(comApi, sessaoNova(), { tipo: 'inicio' }, semIa)

    // O pedido já foi atendido: deixar ele na lista faria quem aplica mandar a
    // conversa para um humano em cima de uma chamada que deu certo.
    expect(r.acoes.some((a) => a.tipo === 'chamar_http')).toBe(false)
    expect(textosDe(r)).toContain('está a caminho')
  })

  it('falha com aoFalhar humano passa a conversa e diz o motivo real', async () => {
    chamarHttp.mockResolvedValue({ ok: false, motivo: 'a chamada respondeu 500' })

    const r = await executarComEfeitos(comApi, sessaoNova(), { tipo: 'inicio' }, semIa)

    expect(r.sessao.status).toBe('humano')
    const transferencia = r.acoes.find((a) => a.tipo === 'transferir_humano')
    if (transferencia?.tipo !== 'transferir_humano') throw new Error('faltou a transferência')
    expect(transferencia.motivo).toContain('500')
    expect(r.acoes.some((a) => a.tipo === 'chamar_http')).toBe(false)
  })

  it('falha com aoFalhar seguir continua a conversa com a variável vazia', async () => {
    const tolerante = fluxoSchema.parse({
      ...comApi,
      nodes: comApi.nodes.map((n) =>
        n.id === 'consulta' ? { ...n, data: { ...n.data, aoFalhar: 'seguir' } } : n,
      ),
    })
    chamarHttp.mockResolvedValue({ ok: false, motivo: 'caiu' })

    const r = await executarComEfeitos(tolerante, sessaoNova(), { tipo: 'inicio' }, semIa)

    // A conversa seguiu com a variável vazia, em vez de morrer na falha.
    expect(textosDe(r)).toContain('está ')

    // Ela termina em `humano` porque o FLUXO acaba num handoff — não porque a
    // integração caiu. É a diferença que este teste existe para provar.
    const transferencia = r.acoes.find((a) => a.tipo === 'transferir_humano')
    if (transferencia?.tipo !== 'transferir_humano') throw new Error('faltou a transferência')
    expect(transferencia.motivo).not.toContain('integração')
  })

  it('marca como teste quando a origem é o simulador', async () => {
    chamarHttp.mockResolvedValue({ ok: true, valores: {} })

    await executarComEfeitos(comApi, sessaoNova(), { tipo: 'inicio' }, {
      ...semIa,
      origem: 'simulador',
    })

    expect(chamarHttp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ deTeste: true }),
    )
  })

  it('sem dizer a origem, NÃO marca como teste', async () => {
    // O padrão erra para o lado seguro: marcar conversa real como teste faria o
    // cliente filtrar lead de verdade fora do sistema dele.
    chamarHttp.mockResolvedValue({ ok: true, valores: {} })

    await executarComEfeitos(comApi, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio: '',
    })

    expect(chamarHttp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ deTeste: false }),
    )
  })

  it('a trava para o encadeamento sem fim, e conta IA e API juntas', async () => {
    // Um bloco de API ligado em si mesmo: sem trava, o laço nunca sai daqui.
    const ciclo = fluxoSchema.parse({
      inicio: 'consulta',
      nodes: [
        { id: 'consulta', type: 'http', position: { x: 0, y: 0 }, data: { url: 'https://e.com' } },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [{ id: 'a1', source: 'consulta', target: 'consulta' }],
    })
    chamarHttp.mockResolvedValue({ ok: true, valores: {} })

    const r = await executarComEfeitos(ciclo, sessaoNova(), { tipo: 'inicio' }, semIa)

    expect(chamarHttp).toHaveBeenCalledTimes(MAX_EFEITOS)

    // Estourar a trava não pode terminar em silêncio nem com o motivo errado.
    // A conversa vai para uma pessoa, e o motivo aponta para o ciclo no
    // desenho — não para a integração, que respondeu certo todas as vezes.
    expect(r.sessao.status).toBe('humano')
    expect(r.acoes.some((a) => a.tipo === 'chamar_http')).toBe(false)

    const transferencia = r.acoes.find((a) => a.tipo === 'transferir_humano')
    expect(transferencia).toBeDefined()
    expect(transferencia?.tipo === 'transferir_humano' && transferencia.motivo).toContain('ciclo')
  })

  it('IA e API no mesmo fluxo, cada uma atendida pelo seu resolvedor', async () => {
    const misto = fluxoSchema.parse({
      inicio: 'consulta',
      nodes: [
        {
          id: 'consulta',
          type: 'http',
          position: { x: 0, y: 0 },
          data: { url: 'https://e.com', mapear: [{ variavel: 'situacao', caminho: 'status' }] },
        },
        { id: 'duvida', type: 'ia', position: { x: 0, y: 0 }, data: { instrucao: 'explique {{situacao}}' } },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'a1', source: 'consulta', target: 'duvida' },
        { id: 'a2', source: 'duvida', target: 'humano' },
      ],
    })
    chamarHttp.mockResolvedValue({ ok: true, valores: { situacao: 'parado' } })
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'está parado por falta de pagamento' }))

    const r = await executarComEfeitos(misto, sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio: 'loja',
      origem: 'whatsapp',
    })

    expect(chamarHttp).toHaveBeenCalledTimes(1)
    expect(modelo.pedidos).toHaveLength(1)
    // A instrução da IA chegou já interpolada com o que a API devolveu.
    expect(modelo.pedidos[0]?.instrucao).toBe('explique parado')
    expect(textosDe(r)).toContain('está parado por falta de pagamento')
    expect(r.acoes.some((a) => a.tipo === 'chamar_http' || a.tipo === 'chamar_ia')).toBe(false)
  })
})

describe('falha com seguir não deixa dado velho passando por fresco', () => {
  const duasChamadas = fluxoSchema.parse({
    inicio: 'primeira',
    nodes: [
      {
        id: 'primeira',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          url: 'https://e.com/1',
          mapear: [{ variavel: 'situacao', caminho: 'status' }],
          aoFalhar: 'seguir',
        },
      },
      {
        id: 'segunda',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          url: 'https://e.com/2',
          mapear: [{ variavel: 'situacao', caminho: 'status' }],
          aoFalhar: 'seguir',
        },
      },
      { id: 'diz', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'está {{situacao}}' } },
      { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: 'a1', source: 'primeira', target: 'segunda' },
      { id: 'a2', source: 'segunda', target: 'diz' },
      { id: 'a3', source: 'diz', target: 'humano' },
    ],
  })

  it('a segunda chamada falhando apaga o que a primeira tinha guardado', async () => {
    chamarHttp.mockReset()
    chamarHttp
      .mockResolvedValueOnce({ ok: true, valores: { situacao: 'a caminho' } })
      .mockResolvedValueOnce({ ok: false, motivo: 'caiu' })

    const r = await executarComEfeitos(duasChamadas, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio: '',
      origem: 'whatsapp',
    })

    const textos = r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))
    expect(textos).toContain('está ')
    expect(textos).not.toContain('está a caminho')
  })
})

describe('credencial da conexão', () => {
  const comConexao = (conexaoId?: string) =>
    fluxoSchema.parse({
      inicio: 'consulta',
      nodes: [
        {
          id: 'consulta',
          type: 'http',
          position: { x: 0, y: 0 },
          data: { url: 'https://crm.com/leads', metodo: 'POST', corpo: '{}', conexaoId },
        },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [{ id: 'a1', source: 'consulta', target: 'humano' }],
    })

  const base = { modelo: null, contextoNegocio: '', origem: 'whatsapp' as const }

  beforeEach(() => {
    chamarHttp.mockReset()
    lerCredencial.mockReset()
  })

  it('lê a credencial do cliente e entrega a quem dispara', async () => {
    chamarHttp.mockResolvedValue({ ok: true, valores: {} })
    lerCredencial.mockResolvedValue({ tipo: 'bearer', campo: null, valor: 'tok_123' })

    await executarComEfeitos(comConexao('cx1'), sessaoNova(), { tipo: 'inicio' }, {
      ...base,
      clienteId: 'cli1',
    })

    // O par (conexão, cliente) é o que impede um cliente alcançar o cofre do
    // outro. Ler só pelo id da conexão bastaria para vazar entre clientes.
    expect(lerCredencial).toHaveBeenCalledWith('cx1', 'cli1')
    expect(chamarHttp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ credencial: { tipo: 'bearer', campo: null, valor: 'tok_123' } }),
    )
  })

  it('a credencial NÃO entra na sessão nem nas ações', async () => {
    chamarHttp.mockResolvedValue({ ok: true, valores: {} })
    lerCredencial.mockResolvedValue({ tipo: 'bearer', campo: null, valor: 'tok_secreto' })

    const r = await executarComEfeitos(comConexao('cx1'), sessaoNova(), { tipo: 'inicio' }, {
      ...base,
      clienteId: 'cli1',
    })

    // A sessão viaja para o navegador a cada mensagem do simulador. Se o
    // segredo aparecesse aqui, ele chegaria ao browser.
    const tudo = JSON.stringify(r)
    expect(tudo).not.toContain('tok_secreto')
  })

  it('bloco sem conexão nem consulta o cofre', async () => {
    chamarHttp.mockResolvedValue({ ok: true, valores: {} })

    await executarComEfeitos(comConexao(undefined), sessaoNova(), { tipo: 'inicio' }, {
      ...base,
      clienteId: 'cli1',
    })

    expect(lerCredencial).not.toHaveBeenCalled()
    expect(chamarHttp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ credencial: null }),
    )
  })

  it('conexão apagada não vira chamada sem credencial — vai para uma pessoa', async () => {
    lerCredencial.mockResolvedValue(null)

    const r = await executarComEfeitos(comConexao('cx-sumida'), sessaoNova(), { tipo: 'inicio' }, {
      ...base,
      clienteId: 'cli1',
    })

    // Chamar sem a credencial faria uma de duas coisas ruins: 401 com motivo
    // confuso, ou pior, a API aceitando anônimo e agindo em nome do cliente.
    expect(chamarHttp).not.toHaveBeenCalled()
    expect(r.sessao.status).toBe('humano')
    const t = r.acoes.find((a) => a.tipo === 'transferir_humano')
    if (t?.tipo !== 'transferir_humano') throw new Error('faltou a transferência')
    expect(t.motivo).toContain('credencial')
  })
})

/**
 * O salto entre automações (0036).
 *
 * O que precisa ser provado aqui não é o desenho do bloco — isso é o
 * `executar.test.ts`. É o que o servidor faz com o pedido: carrega a versão
 * publicada do destino, continua a conversa dentro dela **com as variáveis
 * intactas**, e diz a quem chamou qual versão passou a valer. E, quando o
 * destino não serve, manda para uma pessoa em vez de deixar a conversa muda.
 */
describe('ir para outra automação', () => {
  const fluxoQueSalta: Fluxo = fluxoSchema.parse({
    inicio: 'guarda',
    nodes: [
      {
        id: 'guarda',
        type: 'salvar-campo',
        position: { x: 0, y: 0 },
        data: { campo: 'nome', valor: 'Ana' },
      },
      {
        id: 'salta',
        type: 'ir-fluxo',
        position: { x: 0, y: 120 },
        data: { fluxoId: 'fisio', rotulo: 'Fisioterapia' },
      },
    ],
    edges: [{ id: 'a1', source: 'guarda', target: 'salta' }],
  })

  const fluxoDestino: Fluxo = fluxoSchema.parse({
    inicio: 'ola',
    nodes: [
      {
        id: 'ola',
        type: 'mensagem',
        position: { x: 0, y: 0 },
        data: { texto: 'Oi {{nome}}, vamos falar de fisioterapia.' },
      },
      {
        id: 'fim',
        type: 'handoff',
        position: { x: 0, y: 120 },
        data: { motivo: 'fim', mensagem: 'Já te passo para alguém.' },
      },
    ],
    edges: [{ id: 'b1', source: 'ola', target: 'fim' }],
  })

  it('continua no destino, com as variáveis, e diz qual versão passou a valer', async () => {
    const r = await executarComEfeitos(fluxoQueSalta, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio: '',
      carregarFluxo: async (id) =>
        id === 'fisio'
          ? { versaoId: 'v-fisio', grafo: fluxoDestino, iaHabilitada: false }
          : null,
    })

    // O pedido de salto não sobra na lista: quem aplica as ações veria um
    // pedido já atendido e não saberia o que fazer com ele.
    expect(r.acoes.some((a) => a.tipo === 'ir_para_fluxo')).toBe(false)
    expect(r.acoes).toContainEqual({
      tipo: 'enviar_texto',
      texto: 'Oi Ana, vamos falar de fisioterapia.',
    })
    expect(r.destino?.versaoId).toBe('v-fisio')
    expect(r.sessao.vars.nome).toBe('Ana')
  })

  it('destino que não serve vira handoff, e não silêncio', async () => {
    const r = await executarComEfeitos(fluxoQueSalta, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio: '',
      // Desligado, despublicado, apagado ou de outro cliente chegam todos aqui
      // como `null` — quem decide isso é o carregador de quem chamou.
      carregarFluxo: async () => null,
    })

    expect(r.sessao.status).toBe('humano')
    expect(r.acoes).toContainEqual(
      expect.objectContaining({
        tipo: 'transferir_humano',
        motivo: expect.stringContaining('não está disponível'),
      }),
    )
    expect(r.destino).toBeUndefined()
  })

  it('sem carregador configurado o salto não acontece', async () => {
    // É o caso de quem chama o motor sem saber de que cliente é a conversa.
    // Saltar por id ali seria justamente o que não pode.
    const r = await executarComEfeitos(fluxoQueSalta, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio: '',
    })

    expect(r.sessao.status).toBe('humano')
  })

  it('a IA do destino obedece ao contrato do destino, não ao da origem', async () => {
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'não devia ser chamado' }))
    const destinoComIa: Fluxo = fluxoSchema.parse({
      inicio: 'pergunta-ia',
      nodes: [
        {
          id: 'pergunta-ia',
          type: 'ia',
          position: { x: 0, y: 0 },
          data: { instrucao: 'Responda a dúvida.' },
        },
      ],
      edges: [],
    })

    const r = await executarComEfeitos(fluxoQueSalta, sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio: 'Clínica.',
      carregarFluxo: async () => ({
        versaoId: 'v-sem-ia',
        grafo: destinoComIa,
        // O destino não contratou a Etapa 2: o modelo não pode ir de carona só
        // porque a conversa começou numa automação que contratou.
        iaHabilitada: false,
      }),
    })

    expect(modelo.pedidos).toHaveLength(0)
    expect(r.acoes.some((a) => a.tipo === 'chamar_ia')).toBe(true)
  })

  it('laço entre automações morre na trava, com o motivo certo', async () => {
    const emLaco: Fluxo = fluxoSchema.parse({
      inicio: 'salta',
      nodes: [
        {
          id: 'salta',
          type: 'ir-fluxo',
          position: { x: 0, y: 0 },
          data: { fluxoId: 'ele-mesmo', rotulo: 'Ele mesmo' },
        },
      ],
      edges: [],
    })

    const r = await executarComEfeitos(emLaco, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio: '',
      carregarFluxo: async () => ({ versaoId: 'v', grafo: emLaco, iaHabilitada: false }),
    })

    expect(r.sessao.status).toBe('humano')
    expect(r.acoes).toContainEqual(
      expect.objectContaining({
        tipo: 'transferir_humano',
        motivo: expect.stringContaining('ciclo'),
      }),
    )
  })
})
