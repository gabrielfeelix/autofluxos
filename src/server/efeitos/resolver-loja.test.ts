import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import type { ProdutoDaLoja } from '@/core/loja'
import { lojaFalsa } from '@/loja/falsa'
import type { Modelo, PedidoDeIa, Resposta } from '../ia/types'

/**
 * As ferramentas de loja no laço da IA.
 *
 * O que este arquivo prova, e que nenhum teste de `core/` alcança:
 *
 *  - bloco só com ferramenta de loja funciona **sem** Conexão, e bloco com
 *    ferramenta da Verandi continua exigindo (não afrouxou a agenda);
 *  - loja fora do ar ou desligada vira "não sei" com motivo, nunca catálogo
 *    inventado;
 *  - SKU que a conversa não viu não chega à loja.
 */

const chamarHttp = vi.hoisted(() => vi.fn())
vi.mock('./http', () => ({ chamarHttp }))

const lerCredencial = vi.hoisted(() => vi.fn())
vi.mock('../repos/conexoes', () => ({ lerCredencial }))

const lojaAtivaDaConta = vi.hoisted(() => vi.fn())
vi.mock('../adaptador-da-loja', () => ({ lojaAtivaDaConta }))

vi.mock('../ia/politica', () => ({
  lerPoliticas: async () => new Map(),
  politicaDe: () => 'automatico',
}))
vi.mock('../repos/ia-chamadas', () => ({ registrarChamada: async () => {} }))

const listarMateriais = vi.hoisted(() => vi.fn())
vi.mock('../repos/materiais', () => ({ listarMateriais }))
vi.mock('../alertar', () => ({ alertar: async () => {} }))

const { executarComEfeitos } = await import('./resolver')

const headset: ProdutoDaLoja = {
  produtoId: '330107',
  nome: 'Headset PCYES Comfort CM500',
  preco: 108.9,
  emEstoque: true,
  link: 'https://www.pcyes.com.br/headset-comfort-cm500-pcyes-usb-40mm-cm500',
}
const suporte: ProdutoDaLoja = {
  produtoId: '195230',
  nome: 'Suporte para Headset',
  preco: 95.92,
  precoDe: 119.9,
  emEstoque: true,
  link: 'https://www.pcyes.com.br/suporte-headset',
}

function fluxo(ferramentas: string[], conexaoId?: string): Fluxo {
  return {
    inicio: 'ia',
    nodes: [
      {
        id: 'ia',
        type: 'ia',
        position: { x: 0, y: 0 },
        data: { instrucao: 'Ajude a escolher.', ferramentas, ...(conexaoId ? { conexaoId } : {}) },
      },
    ],
    edges: [],
  } as Fluxo
}

/** Um modelo que segue um roteiro: cada volta devolve a próxima resposta. */
function modeloComRoteiro(roteiro: Resposta[]): Modelo & { pedidos: PedidoDeIa[] } {
  const pedidos: PedidoDeIa[] = []
  return {
    pedidos,
    async responder(pedido) {
      pedidos.push(pedido)
      return roteiro[Math.min(pedidos.length - 1, roteiro.length - 1)]!
    },
  }
}

async function rodar(f: Fluxo, modelo: Modelo) {
  return executarComEfeitos(f, sessaoNova(), { tipo: 'inicio' }, {
    modelo,
    contextoNegocio: 'Loja de periféricos.',
    historico: [{ de: 'pessoa', texto: 'tem headset?' }],
    clienteId: '00000000-0000-0000-0000-000000000001',
  } as Parameters<typeof executarComEfeitos>[3])
}

function textos(r: Awaited<ReturnType<typeof rodar>>): string[] {
  return r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))
}

beforeEach(() => {
  chamarHttp.mockReset()
  lerCredencial.mockReset()
  lojaAtivaDaConta.mockReset()
  listarMateriais.mockReset()
})

describe('ferramentas de loja no laço da IA', () => {
  it('busca na loja sem Conexão e devolve o produto ao modelo', async () => {
    const loja = lojaFalsa({ produtos: [headset, suporte] })
    lojaAtivaDaConta.mockResolvedValue(loja)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'Temos o CM500 por R$ 108,90.' },
    ])

    const r = await rodar(fluxo(['loja_buscar']), modelo)

    expect(loja.buscas).toEqual(['headset'])
    expect(lerCredencial).not.toHaveBeenCalled()
    expect(chamarHttp).not.toHaveBeenCalled()
    expect(JSON.stringify(modelo.pedidos[1])).toContain('330107')
    expect(textos(r)).toContain('Temos o CM500 por R$ 108,90.')
  })

  it('bloco com ferramenta da agenda continua exigindo credencial', async () => {
    lerCredencial.mockResolvedValue(null)
    const modelo = modeloComRoteiro([{ tipo: 'texto', texto: 'não devia chegar aqui' }])

    const r = await rodar(fluxo(['agenda_horarios', 'loja_buscar'], 'conexao-1'), modelo)

    expect(modelo.pedidos).toHaveLength(0)
    expect(textos(r)).not.toContain('não devia chegar aqui')
  })

  it('loja fora do ar não vira catálogo inventado', async () => {
    lojaAtivaDaConta.mockResolvedValue(lojaFalsa({ falhar: true }))
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'Temos sim, R$ 50!' },
    ])

    const r = await rodar(fluxo(['loja_buscar']), modelo)

    expect(modelo.pedidos).toHaveLength(1)
    expect(textos(r)).not.toContain('Temos sim, R$ 50!')
  })

  it('loja desligada não vira catálogo inventado', async () => {
    lojaAtivaDaConta.mockResolvedValue(null)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'Temos sim, R$ 50!' },
    ])

    const r = await rodar(fluxo(['loja_buscar']), modelo)

    expect(textos(r)).not.toContain('Temos sim, R$ 50!')
  })

  it('SKU que a conversa não viu não chega à loja', async () => {
    const loja = lojaFalsa({ produtos: [headset, suporte], complementos: { '330107': ['195230'] } })
    const combina = vi.spyOn(loja, 'combinaCom')
    lojaAtivaDaConta.mockResolvedValue(loja)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_combina_com', argumentos: { produtoId: '330107' } },
      { tipo: 'texto', texto: 'Combina com o suporte!' },
    ])

    await rodar(fluxo(['loja_buscar', 'loja_combina_com']), modelo)

    expect(combina).not.toHaveBeenCalled()
  })

  it('SKU que veio da busca passa, e o complemento chega ao modelo', async () => {
    const loja = lojaFalsa({ produtos: [headset, suporte], complementos: { '330107': ['195230'] } })
    lojaAtivaDaConta.mockResolvedValue(loja)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'cm500' } },
      { tipo: 'usar_ferramenta', nome: 'loja_combina_com', argumentos: { produtoId: '330107' } },
      { tipo: 'texto', texto: 'Leva o suporte junto?' },
    ])

    const r = await rodar(fluxo(['loja_buscar', 'loja_combina_com']), modelo)

    expect(JSON.stringify(modelo.pedidos[2])).toContain('195230')
    expect(textos(r)).toContain('Leva o suporte junto?')
  })

  it('loja_mostrar relê o preço e põe o card logo depois da frase da IA', async () => {
    const loja = lojaFalsa({ produtos: [headset, suporte] })
    lojaAtivaDaConta.mockResolvedValue({
      ...loja,
      // A loja mudou o preço entre a busca e o card: vale o de agora.
      lerPorSku: async (skus: string[]) => ({
        ok: true,
        valor: skus.includes('330107') ? [{ ...headset, preco: 99.9, foto: 'https://x/cm500.jpg' }] : [],
      }),
    })
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'usar_ferramenta', nome: 'loja_mostrar', argumentos: { produtoId: '330107' } },
      { tipo: 'texto', texto: 'Olha ele aqui:' },
    ])

    const r = await rodar(fluxo(['loja_buscar', 'loja_mostrar']), modelo)

    const tipos = r.acoes.map((a) => a.tipo)
    const posTexto = r.acoes.findIndex((a) => a.tipo === 'enviar_texto' && a.texto === 'Olha ele aqui:')
    expect(tipos[posTexto + 1]).toBe('enviar_produtos')
    const card = r.acoes[posTexto + 1]
    expect(card?.tipo === 'enviar_produtos' && card.produtos[0]?.preco).toBe(99.9)
    // O modelo vê só id e nome do que foi mostrado, nunca a foto.
    expect(JSON.stringify(modelo.pedidos[2])).not.toContain('cm500.jpg')
  })

  it('loja_mostrar com SKU que a conversa não viu não chega à loja', async () => {
    const loja = lojaFalsa({ produtos: [headset] })
    const lerPorSku = vi.spyOn(loja, 'lerPorSku')
    lojaAtivaDaConta.mockResolvedValue(loja)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_mostrar', argumentos: { produtoId: '330107' } },
      { tipo: 'texto', texto: 'não devia chegar aqui' },
    ])

    const r = await rodar(fluxo(['loja_mostrar']), modelo)

    expect(lerPorSku).not.toHaveBeenCalled()
    expect(r.acoes.some((a) => a.tipo === 'enviar_produtos')).toBe(false)
    expect(r.acoes.some((a) => a.tipo === 'transferir_humano')).toBe(true)
  })

  it('sem loja_mostrar, nenhuma resposta ganha card', async () => {
    lojaAtivaDaConta.mockResolvedValue(lojaFalsa({ produtos: [headset] }))
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'Temos.' },
    ])
    const r = await rodar(fluxo(['loja_buscar']), modelo)
    expect(r.acoes.some((a) => a.tipo === 'enviar_produtos')).toBe(false)
  })

  it('busca vazia entrega ao modelo o link da busca da loja, não um "não temos"', async () => {
    lojaAtivaDaConta.mockResolvedValue(lojaFalsa({ produtos: [headset] }))
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'teclado gamer' } },
      { tipo: 'texto', texto: 'Dá uma olhada aqui.' },
    ])
    await rodar(fluxo(['loja_buscar']), modelo)
    expect(JSON.stringify(modelo.pedidos[1])).toContain('catalogsearch/result/?q=teclado%20gamer')
  })

  it('busca com resultado não manda link de busca', async () => {
    lojaAtivaDaConta.mockResolvedValue(lojaFalsa({ produtos: [headset] }))
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'Temos.' },
    ])
    await rodar(fluxo(['loja_buscar']), modelo)
    expect(JSON.stringify(modelo.pedidos[1])).not.toContain('catalogsearch')
  })

  it('sem conta (a vitrine do link público), a loja nem é procurada', async () => {
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'não devia chegar aqui' },
    ])
    const r = await executarComEfeitos(fluxo(['loja_buscar']), sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio: 'Loja de periféricos.',
      historico: [{ de: 'pessoa', texto: 'tem headset?' }],
      semRede: true,
    } as Parameters<typeof executarComEfeitos>[3])
    expect(lojaAtivaDaConta).not.toHaveBeenCalled()
    expect(r.acoes.some((a) => a.tipo === 'transferir_humano')).toBe(true)
  })
})

/** O que a ferramenta devolveu ao modelo, lido do histórico da segunda volta. */
function resultadoDaFerramenta(modelo: { pedidos: PedidoDeIa[] }): unknown {
  const turno = modelo.pedidos[1]?.historico?.find((t) => t.de === 'ferramenta')
  return turno ? JSON.parse(turno.texto) : null
}

describe('enviar_cardapio', () => {
  const pdf = {
    tipo: 'cardapio-pdf',
    url: 'https://arquivos.exemplo/cardapio.pdf',
    nomeArquivo: 'Cardápio Pizzaria.pdf',
    atualizadoEm: '2026-09-26T12:00:00Z',
  }
  const imagem = {
    tipo: 'cardapio-imagem',
    url: 'https://arquivos.exemplo/cardapio.jpg',
    nomeArquivo: null,
    atualizadoEm: '2026-09-26T12:00:00Z',
  }

  it('manda a imagem e o PDF logo depois da frase, sem o endereço passar pelo modelo', async () => {
    listarMateriais.mockResolvedValue([pdf, imagem])
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'enviar_cardapio', argumentos: {} },
      { tipo: 'texto', texto: 'Aqui está o nosso cardápio!' },
    ])

    const r = await rodar(fluxo(['enviar_cardapio']), modelo)

    // Não depende de loja ligada: o cardápio é da conta.
    expect(lojaAtivaDaConta).not.toHaveBeenCalled()
    expect(resultadoDaFerramenta(modelo)).toEqual({ enviado: true })
    expect(JSON.stringify(modelo.pedidos[1])).not.toContain('arquivos.exemplo')

    const frase = r.acoes.findIndex((a) => a.tipo === 'enviar_texto' && a.texto === 'Aqui está o nosso cardápio!')
    expect(frase).toBeGreaterThanOrEqual(0)
    expect(r.acoes.slice(frase + 1, frase + 3)).toEqual([
      { tipo: 'enviar_midia', midia: 'imagem', url: imagem.url },
      { tipo: 'enviar_midia', midia: 'documento', url: pdf.url, nomeArquivo: 'Cardápio Pizzaria.pdf' },
    ])
  })

  it('sem cardápio cadastrado, responde ao modelo que não há arquivo e não manda mídia', async () => {
    listarMateriais.mockResolvedValue([])
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'enviar_cardapio', argumentos: {} },
      { tipo: 'texto', texto: 'Ainda não temos o cardápio em arquivo, mas posso te dizer os sabores.' },
    ])

    const r = await rodar(fluxo(['enviar_cardapio']), modelo)

    expect(resultadoDaFerramenta(modelo)).toMatchObject({ enviado: false })
    expect(r.acoes.some((a) => a.tipo === 'enviar_midia')).toBe(false)
    expect(textos(r)).toContain('Ainda não temos o cardápio em arquivo, mas posso te dizer os sabores.')
  })
})

describe('categoria nas ferramentas de loja', () => {
  it('loja_buscar e loja_mostrar passam a categoria para a loja', async () => {
    const pedidos: { termo?: string; skus?: string[]; categoria?: string }[] = []
    const loja = {
      ...lojaFalsa({ produtos: [headset] }),
      async buscar(termo: string, opcoes?: { categoria?: string }) {
        pedidos.push({ termo, ...(opcoes?.categoria ? { categoria: opcoes.categoria } : {}) })
        return { ok: true as const, valor: [headset] }
      },
      async lerPorSku(skus: string[], filtro?: { categoria?: string }) {
        pedidos.push({ skus, ...(filtro?.categoria ? { categoria: filtro.categoria } : {}) })
        return { ok: true as const, valor: [headset] }
      },
    }
    lojaAtivaDaConta.mockResolvedValue(loja)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset', categoria: 'Áudio' } },
      { tipo: 'usar_ferramenta', nome: 'loja_mostrar', argumentos: { produtoId: '330107', categoria: 'Áudio' } },
      { tipo: 'texto', texto: 'Olha esse.' },
    ])

    await rodar(fluxo(['loja_buscar', 'loja_mostrar']), modelo)

    expect(pedidos).toEqual([
      { termo: 'headset', categoria: 'Áudio' },
      { skus: ['330107'], categoria: 'Áudio' },
    ])
  })

  it('sem categoria, a busca sai como sempre', async () => {
    const loja = lojaFalsa({ produtos: [headset] })
    const buscar = vi.spyOn(loja, 'buscar')
    lojaAtivaDaConta.mockResolvedValue(loja)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'Temos.' },
    ])

    await rodar(fluxo(['loja_buscar']), modelo)

    expect(buscar).toHaveBeenCalledWith('headset', undefined)
  })
})
