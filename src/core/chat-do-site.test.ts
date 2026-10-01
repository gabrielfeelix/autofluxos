import { describe, expect, it } from 'vitest'
import {
  camposQueFaltam,
  chaveDoCampoProprio,
  lerConfigDoSite,
  lerFicha,
  lerFormulario,
  lerListaDeDominios,
  mensagemPublica,
  normalizarDominio,
  origemPermitida,
  segredoValido,
} from './chat-do-site'
import { varsIniciais } from './contatos/vars-iniciais'

describe('o domínio que o lojista cola', () => {
  it('aceita o endereço como vem da barra do navegador', () => {
    expect(normalizarDominio('https://www.PCYES.com.br/loja?x=1')).toBe('www.pcyes.com.br')
    expect(normalizarDominio('dev.pcyes.com.br')).toBe('dev.pcyes.com.br')
  })

  it('recusa o que não é endereço público', () => {
    expect(normalizarDominio('localhost')).toBeNull()
    expect(normalizarDominio('')).toBeNull()
    expect(normalizarDominio('loja')).toBeNull()
  })

  it('separa uma lista por linha ou vírgula, sem repetir, e diz o que recusou', () => {
    expect(lerListaDeDominios('pcyes.com.br\nhttps://pcyes.com.br/, dev.pcyes.com.br loja')).toEqual({
      validos: ['pcyes.com.br', 'dev.pcyes.com.br'],
      recusados: ['loja'],
    })
  })
})

describe('de onde o balão pode falar', () => {
  const dominios = ['pcyes.com.br', 'dev.pcyes.com.br']

  it('aceita o domínio cadastrado, com e sem www', () => {
    expect(origemPermitida('https://pcyes.com.br', dominios)).toBe(true)
    expect(origemPermitida('https://www.pcyes.com.br', dominios)).toBe(true)
    expect(origemPermitida('https://dev.pcyes.com.br', dominios)).toBe(true)
  })

  it('recusa subdomínio não cadastrado, outro site, http e origem ausente', () => {
    expect(origemPermitida('https://blog.pcyes.com.br', dominios)).toBe(false)
    expect(origemPermitida('https://pcyes.com.br.golpe.com', dominios)).toBe(false)
    expect(origemPermitida('http://pcyes.com.br', dominios)).toBe(false)
    expect(origemPermitida(null, dominios)).toBe(false)
    expect(origemPermitida('https://pcyes.com.br', [])).toBe(false)
    expect(origemPermitida('http://localhost:5500', dominios)).toBe(false)
  })

  it('aceita localhost só quando pedido, para testar na máquina', () => {
    expect(origemPermitida('http://localhost:5500', [], true)).toBe(true)
  })
})

describe('a configuração guardada', () => {
  it('completa o que falta e corrige cor inválida', () => {
    const config = lerConfigDoSite({ titulo: '  PCYES  ', cor: 'vermelho' })
    expect(config.titulo).toBe('PCYES')
    expect(config.cor).toBe('#6366F1')
    expect(config.formulario).toEqual([
      { tipo: 'nome', obrigatorio: true },
      { tipo: 'telefone', obrigatorio: false },
    ])
    expect(config.dominios).toEqual([])
  })

  it('o pedirContato desligado de antes vira formulário vazio', () => {
    expect(lerConfigDoSite({ pedirContato: false }).formulario).toEqual([])
  })
})

describe('o formulário antes da conversa', () => {
  it('limpa a lista: um de cada, ordem fixa, próprio só com pergunta', () => {
    expect(
      lerFormulario([
        { tipo: 'cpf', obrigatorio: true },
        { tipo: 'nome' },
        { tipo: 'cpf', obrigatorio: false },
        { tipo: 'proprio', obrigatorio: true, rotulo: '   ' },
        { tipo: 'senha' },
      ]),
    ).toEqual([
      { tipo: 'nome', obrigatorio: false },
      { tipo: 'cpf', obrigatorio: true },
    ])
  })

  it('a pergunta própria vira chave sem acento, e não toma chave reservada', () => {
    expect(chaveDoCampoProprio('Número do pedido')).toBe('numero_do_pedido')
    expect(chaveDoCampoProprio('Telefone')).toBe('site_telefone')
    expect(chaveDoCampoProprio('123')).toBeNull()
  })

  const formulario = lerFormulario([
    { tipo: 'nome', obrigatorio: true },
    { tipo: 'telefone', obrigatorio: true },
    { tipo: 'cpf', obrigatorio: false },
    { tipo: 'cnpj', obrigatorio: false },
    { tipo: 'proprio', obrigatorio: false, rotulo: 'Número do pedido' },
  ])

  it('aceita e normaliza o que está certo', () => {
    expect(
      lerFicha(formulario, {
        nome: '  Ana   Souza ',
        telefone: '+55 (44) 99999-1234',
        cpf: '529.982.247-25',
        cnpj: '11.222.333/0001-81',
        proprio: '1234',
        email: 'ignorado@x.com',
      }),
    ).toEqual({
      ok: true,
      nome: 'Ana Souza',
      campos: { whatsapp: '5544999991234', cpf: '52998224725', cnpj: '11222333000181', numero_do_pedido: '1234' },
    })
  })

  it('recusa verificador errado e obrigatório vazio', () => {
    const r = lerFicha(formulario, { nome: 'Ana', cpf: '529.982.247-26', cnpj: '11.222.333/0001-80' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['cnpj', 'cpf', 'telefone'])
  })

  it('telefone de fora do Brasil passa só pelo tamanho', () => {
    const r = lerFicha([{ tipo: 'telefone', obrigatorio: true }], { telefone: '+1 202 555 0123' })
    expect(r).toEqual({ ok: true, nome: null, campos: { whatsapp: '12025550123' } })
  })

  it('o que falta sai do contato', () => {
    expect(camposQueFaltam(formulario, null)).toEqual(['nome', 'telefone', 'cpf', 'cnpj', 'proprio'])
    expect(
      camposQueFaltam(formulario, { nome: 'Ana', campos: { whatsapp: '5544999991234', numero_do_pedido: '1' } }),
    ).toEqual(['cpf', 'cnpj'])
  })
})

describe('o segredo do visitante', () => {
  it('exige tamanho de segredo', () => {
    expect(segredoValido('a'.repeat(43))).toBe(true)
    expect(segredoValido('curto')).toBe(false)
    expect(segredoValido('com espaço'.repeat(5))).toBe(false)
    expect(segredoValido(undefined)).toBe(false)
  })
})

describe('o que sai do banco para o navegador do visitante', () => {
  it('leva só o primeiro nome de quem atende, nunca o id nem o corpo cru', () => {
    const m = mensagemPublica({
      id: 'm1',
      direcao: 'saida',
      texto: 'Oi!',
      ts: '2026-09-25T12:00:00Z',
      payload: { autor: { tipo: 'pessoa', id: 'usuario-123', nome: 'Gabriel Barbosa' }, cru: { segredo: 'x' } },
    })
    expect(m).toEqual({ id: 'm1', de: 'empresa', texto: 'Oi!', em: '2026-09-25T12:00:00Z', autor: 'Gabriel' })
    expect(JSON.stringify(m)).not.toContain('usuario-123')
  })

  it('desenha opções, produto com preço e estoque, e recusa link que não é http', () => {
    const m = mensagemPublica({
      id: 'm2',
      direcao: 'saida',
      texto: 'Escolha',
      ts: 't',
      payload: {
        opcoes: [{ id: 'a', rotulo: 'Vendas' }],
        produtos: [{ nome: 'Mouse', preco: 99.9, emEstoque: true, foto: 'javascript:alert(1)', link: 'https://loja/p' }],
      },
    })
    expect(m.opcoes).toEqual([{ id: 'a', rotulo: 'Vendas' }])
    expect(m.produtos?.[0]?.foto).toBeUndefined()
    expect(m.produtos?.[0]?.link).toBe('https://loja/p')
    expect(m.produtos?.[0]?.detalhe).toContain('em estoque')
  })

  it('devolve o ref do balão na mensagem do visitante', () => {
    const m = mensagemPublica({
      id: 'm3',
      direcao: 'entrada',
      texto: 'oi',
      ts: 't',
      payload: { from: 'site:abc' },
      wa_message_id: 'site:abc:ref12345',
    })
    expect(m).toEqual({ id: 'm3', de: 'visitante', texto: 'oi', em: 't', ref: 'ref12345' })
  })
})

describe('as variáveis do visitante', () => {
  it('não viram telefone, que a consulta de pedido usaria como prova', () => {
    expect(varsIniciais({ waId: 'site:abc123' }).telefone).toBeUndefined()
    expect(varsIniciais({ waId: '5544999999999' }).telefone).toBe('5544999999999')
  })
})
