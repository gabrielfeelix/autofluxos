import { describe, expect, it } from 'vitest'
import { partirPorEndereco } from './enderecos'

/**
 * O defeito que estes testes trancam.
 *
 * Um link de campanha do Google colado na conversa aparecia metade azul e
 * metade em itálico preto, porque `_` é itálico na marcação do WhatsApp e a
 * marcação era interpretada antes de o endereço ser reconhecido. Não é caso de
 * borda: `gclid`, `utm_*` e `_ga` fazem de quase todo link de campanha um texto
 * cheio de sublinhados.
 */
describe('partir o texto por endereço', () => {
  it('texto sem endereço nenhum volta inteiro, num pedaço só', () => {
    expect(partirPorEndereco('oi, tudo bem?')).toEqual([{ tipo: 'texto', valor: 'oi, tudo bem?' }])
  })

  it('o endereço com sublinhado sai INTEIRO, é o defeito de produção', () => {
    const link =
      'https://www.dlcash.com.br/emprestimo?gadsource=1&gadcampaignid=232&gclid=CjwKCAj_BwE'
    const pedacos = partirPorEndereco(`olha ${link} aqui`)

    expect(pedacos).toEqual([
      { tipo: 'texto', valor: 'olha ' },
      { tipo: 'endereco', valor: link, href: link },
      { tipo: 'texto', valor: ' aqui' },
    ])
  })

  it('o ponto que termina a frase não entra no endereço', () => {
    const pedacos = partirPorEndereco('veja em https://exemplo.com.br/a.')
    expect(pedacos[1]).toEqual({
      tipo: 'endereco',
      valor: 'https://exemplo.com.br/a',
      href: 'https://exemplo.com.br/a',
    })
    expect(pedacos[2]).toEqual({ tipo: 'texto', valor: '.' })
  })

  it('`www.` sem esquema ganha https, senão o clique iria para dentro do painel', () => {
    expect(partirPorEndereco('www.4yu.com.br')).toEqual([
      { tipo: 'endereco', valor: 'www.4yu.com.br', href: 'https://www.4yu.com.br' },
    ])
  })

  it('acha todos, e não só o primeiro, a expressão global não guarda estado entre chamadas', () => {
    const pedacos = partirPorEndereco('a http://um.com b http://dois.com c')
    expect(pedacos.filter((p) => p.tipo === 'endereco').map((p) => p.valor)).toEqual([
      'http://um.com',
      'http://dois.com',
    ])
    // Roda de novo com o mesmo módulo: se a expressão fosse global compartilhada,
    // o `lastIndex` sobraria da chamada anterior e esta acharia menos.
    expect(partirPorEndereco('a http://um.com b http://dois.com c')).toHaveLength(5)
  })

  it('endereço colado no fim do texto não perde o último caractere', () => {
    expect(partirPorEndereco('entra em https://4yu.com.br')).toEqual([
      { tipo: 'texto', valor: 'entra em ' },
      { tipo: 'endereco', valor: 'https://4yu.com.br', href: 'https://4yu.com.br' },
    ])
  })
})
