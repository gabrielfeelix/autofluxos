import { describe, expect, it } from 'vitest'
import {
  botoesSemOpcao,
  campoDosEnvios,
  conferirModeloDoEvento,
  lerModeloDoEvento,
  podeReceber,
  valoresDoAviso,
  variaveisDoAviso,
  type ModeloDoEvento,
} from './evento-com-modelo'

const pcyes: ModeloDoEvento = {
  modelos: ['pesquisa_pos_compra_v4', 'pesquisa_pos_compra_v2'],
  variaveis: ['nome', 'pedido'],
  criarContato: true,
  campoDeAceite: 'aceita_whatsapp',
  umaVezPor: 'pedido',
  telefonesDeTeste: ['5544998775978'],
}

describe('configuração do evento com modelo', () => {
  it('lê o que foi gravado e ignora o que não é configuração', () => {
    expect(lerModeloDoEvento(pcyes)).toEqual(pcyes)
    expect(lerModeloDoEvento(null)).toBeNull()
    expect(lerModeloDoEvento({ modelos: [] })).toBeNull()
  })

  it('não cria contato sem campo de aceite', () => {
    const r = conferirModeloDoEvento({ ...pcyes, campoDeAceite: '' })
    expect(r).toEqual({ ok: false, erro: expect.stringContaining('aceite') })
  })

  it('normaliza o telefone de teste e recusa o inválido', () => {
    const r = conferirModeloDoEvento({ ...pcyes, telefonesDeTeste: ['(44) 99877-5978'] })
    expect(r.ok && r.modelo.telefonesDeTeste).toEqual(['5544998775978'])
    expect(conferirModeloDoEvento({ ...pcyes, telefonesDeTeste: ['12'] }).ok).toBe(false)
  })

  it('recusa nome de campo com caractere estranho', () => {
    expect(conferirModeloDoEvento({ ...pcyes, variaveis: ['nome; drop'] }).ok).toBe(false)
  })

  it('guarda a imagem do cabeçalho e recusa endereço sem https', () => {
    const imagem = 'https://dialogon.com.br/pesquisas/pcyes-pedido-confirmado.jpg'
    const r = conferirModeloDoEvento({ ...pcyes, imagem })
    expect(r.ok && r.modelo.imagem).toBe(imagem)
    expect(conferirModeloDoEvento({ ...pcyes, imagem: 'http://exemplo.com/a.jpg' })).toEqual({
      ok: false,
      erro: expect.stringContaining('https://'),
    })
  })
})

describe('o aviso vira valores', () => {
  it('preenche as lacunas em ordem, inclusive por caminho', () => {
    const modelo = { ...pcyes, variaveis: ['cliente.nome', 'pedido'] }
    expect(valoresDoAviso(modelo, { cliente: { nome: 'Ana' }, pedido: 123 })).toEqual({
      ok: true,
      valores: ['Ana', '123'],
    })
  })

  it('diz qual campo faltou', () => {
    expect(valoresDoAviso(pcyes, { nome: 'Ana' })).toEqual({ ok: false, faltou: 'pedido' })
  })

  it('aceite precisa ser true, e o número de teste passa sem ele', () => {
    expect(podeReceber(pcyes, { aceita_whatsapp: true }, '5511999990000')).toBe(true)
    expect(podeReceber(pcyes, { aceita_whatsapp: 'sim' }, '5511999990000')).toBe(false)
    expect(podeReceber(pcyes, {}, '5544998775978')).toBe(true)
    expect(podeReceber({ ...pcyes, campoDeAceite: '' }, {}, '5511999990000')).toBe(true)
  })

  it('só os campos simples viram variáveis do fluxo', () => {
    expect(variaveisDoAviso({ nome: 'Ana', customer_id: 182, itens: [1], 'a b': 'x' })).toEqual({
      nome: 'Ana',
      customer_id: '182',
    })
  })
})

describe('botões do modelo contra a primeira pergunta', () => {
  const opcoes = [{ rotulo: 'Foi ótima' }, { rotulo: 'Foi ok' }, { rotulo: 'Tive um problema' }]

  it('casam ignorando acento e caixa', () => {
    const botoes = [
      { tipo: 'QUICK_REPLY' as const, texto: 'Foi otima' },
      { tipo: 'QUICK_REPLY' as const, texto: 'FOI OK' },
    ]
    expect(botoesSemOpcao(botoes, opcoes)).toEqual([])
  })

  it('aponta o botão sem opção', () => {
    expect(botoesSemOpcao([{ tipo: 'QUICK_REPLY', texto: 'Péssima' }], opcoes)).toEqual(['Péssima'])
  })

  it('botão de link não conta', () => {
    expect(botoesSemOpcao([{ tipo: 'URL', texto: 'Ver pedido', valor: 'https://x.com' }], opcoes)).toEqual([])
  })
})

it('o campo dos envios sai do nome do evento', () => {
  expect(campoDosEnvios('pedido.processando')).toBe('enviados_pedido_processando')
})
