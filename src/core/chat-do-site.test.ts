import { describe, expect, it } from 'vitest'
import {
  lerConfigDoSite,
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
    expect(config.pedirContato).toBe(true)
    expect(config.dominios).toEqual([])
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
