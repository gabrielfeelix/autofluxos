import { describe, expect, it } from 'vitest'
import { ITENS, secoesVisiveis } from './secoes-do-cliente'

/**
 * A barra lateral com o CRM opcional (T7.1, §4.2).
 *
 * O teste que importa é o do **padrão**: o esqueleto não pergunta nada ao banco,
 * e se "não perguntei" escondesse o item, a barra piscaria um item a menos em
 * todo carregamento. É exatamente o defeito que este arquivo existe para evitar.
 */
describe('as seções visíveis', () => {
  it('sem resposta mostra tudo: é o esqueleto, e esconder faria a barra piscar', () => {
    expect(secoesVisiveis()).toHaveLength(ITENS.length)
    expect(secoesVisiveis({})).toHaveLength(ITENS.length)
    expect(secoesVisiveis({ crmVisivel: undefined })).toHaveLength(ITENS.length)
  })

  it('com o CRM visível mostra tudo', () => {
    expect(secoesVisiveis({ crmVisivel: true }).map((i) => i.chave)).toEqual(
      ITENS.map((i) => i.chave),
    )
  })

  it('sem o CRM esconde o funil, e só ele', () => {
    const chaves = secoesVisiveis({ crmVisivel: false }).map((i) => i.chave)
    expect(chaves).not.toContain('quadros')
    expect(chaves).toEqual(ITENS.filter((i) => i.chave !== 'quadros').map((i) => i.chave))
  })

  it('Inbox, Contatos e Configurações nunca somem', () => {
    // O atendimento tem que funcionar sem CRM: é o ponto da tarefa. Se algum dia
    // esconder o CRM levar o Inbox junto, este teste cai.
    const chaves = secoesVisiveis({ crmVisivel: false }).map((i) => i.chave)
    for (const essencial of ['inicio', 'inbox', 'leads', 'ajustes'] as const) {
      expect(chaves).toContain(essencial)
    }
  })
})
