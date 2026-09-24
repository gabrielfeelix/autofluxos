import { describe, expect, it } from 'vitest'
import { MODELOS_EXTRA, type Acesso } from '@/core/permissoes'
import { ITENS, SECOES, destinoNaConta, liberaSecao, secoesVisiveis, telaInicial } from './secoes-do-cliente'

/**
 * A barra lateral com o CRM opcional (T7.1, §4.2).
 *
 * O teste que importa é o do **padrão**: o esqueleto não pergunta nada ao banco,
 * e se "não perguntei" escondesse o item, a barra piscaria um item a menos em
 * todo carregamento. É exatamente o defeito que este arquivo existe para evitar.
 */
const ids = (secoes: ReturnType<typeof secoesVisiveis>) => secoes.flatMap((secao) => secao.itens.map((item) => item.id))
const chaves = (secoes: ReturnType<typeof secoesVisiveis>) => secoes.map((secao) => secao.chave)

describe('as seções visíveis', () => {
  it('sem resposta mostra tudo: é o esqueleto, e esconder faria a barra piscar', () => {
    expect(ids(secoesVisiveis())).toEqual(ITENS.map((item) => item.id))
    expect(ids(secoesVisiveis({}))).toEqual(ITENS.map((item) => item.id))
    expect(chaves(secoesVisiveis({ crmVisivel: undefined, lojaVisivel: undefined }))).toEqual(SECOES.map((secao) => secao.chave))
  })

  it('sem o CRM esconde Negócios e Vendas, e só eles', () => {
    expect(ids(secoesVisiveis({ crmVisivel: false }))).toEqual(
      ITENS.map((item) => item.id).filter((id) => id !== 'negocios' && id !== 'vendas'),
    )
  })

  it('sem Loja a seção some inteira, e só ela', () => {
    expect(chaves(secoesVisiveis({ lojaVisivel: false }))).toEqual(SECOES.map((secao) => secao.chave).filter((chave) => chave !== 'loja'))
  })

  it('Conversas, Contatos e Configurações nunca somem por recurso', () => {
    // O atendimento tem que funcionar sem CRM e sem Loja.
    const visiveis = ids(secoesVisiveis({ crmVisivel: false, lojaVisivel: false }))
    for (const essencial of ['inicio', 'minhas', 'todas', 'contatos', 'ajustes']) {
      expect(visiveis).toContain(essencial)
    }
  })

  it('todo subitem tem id único: é ele que acende', () => {
    expect(new Set(ITENS.map((item) => item.id)).size).toBe(ITENS.length)
  })
})

describe('as seções que esta pessoa pode usar (E7)', () => {
  const atendimento: Acesso = {
    papel: 'member',
    usuarioId: 'u1',
    sobrescritas: { ...MODELOS_EXTRA.operador },
  }

  it('acesso de atendimento não vê Automações nem Configurações', () => {
    const secoes = secoesVisiveis({ crmVisivel: true, regras: atendimento })
    expect(chaves(secoes)).not.toContain('automacoes')
    expect(chaves(secoes)).not.toContain('ajustes')
    // As telas que saíram de Configurações levaram a exigência junto.
    expect(ids(secoes)).not.toContain('respostas-rapidas')
    expect(ids(secoes)).not.toContain('etiquetas')
    expect(ids(secoes)).toEqual(expect.arrayContaining(['minhas', 'sem-dono', 'todas', 'salvas', 'contatos', 'atividades']))
  })

  it('membro sem exceção continua vendo tudo: o menu não tira acesso de quem já tinha', () => {
    expect(ids(secoesVisiveis({ crmVisivel: true, regras: { papel: 'member', usuarioId: 'u1' } }))).toEqual(ITENS.map((item) => item.id))
  })

  it('suporte 4YU vê tudo', () => {
    expect(ids(secoesVisiveis({ crmVisivel: true, regras: { papel: null, ehAdminDaPlataforma: true } }))).toEqual(ITENS.map((item) => item.id))
  })

  it('Configurações abre para quem mexe só na operação', () => {
    const soOperacao: Acesso = {
      papel: 'member',
      usuarioId: 'u1',
      sobrescritas: { ...MODELOS_EXTRA.operador, configurar_operacao: 'todos' },
    }
    expect(liberaSecao(soOperacao, 'ajustes')).toBe(true)
    expect(liberaSecao(atendimento, 'ajustes')).toBe(false)
  })

  it('sem regras é o esqueleto, e mostra tudo', () => {
    expect(liberaSecao(undefined, 'fluxos')).toBe(true)
  })
})

describe('telaInicial e destinoNaConta', () => {
  const operador = {
    papel: 'member' as const,
    sobrescritas: { atender: 'proprios' as const, configurar_operacao: 'nenhum' as const, exportar: 'nenhum' as const },
  }

  it('quem atende só as próprias conversas entra pelo Inbox', () => {
    expect(telaInicial(operador)).toBe('/inbox')
  })

  it('dono, membro sem restrição e administrador da 4YU entram pelo Painel', () => {
    expect(telaInicial({ papel: 'owner' })).toBe('')
    expect(telaInicial({ papel: 'member' })).toBe('')
    expect(telaInicial({ papel: null, ehAdminDaPlataforma: true })).toBe('')
  })

  it('a troca de conta mantém a seção quando a outra conta libera', () => {
    expect(destinoNaConta({ papel: 'owner' }, 'inbox')).toBe('/inbox')
    expect(destinoNaConta({ papel: 'owner' }, 'fluxos')).toBe('/fluxos')
    expect(destinoNaConta({ papel: 'owner' }, 'etiquetas')).toBe('/leads/etiquetas')
    expect(destinoNaConta({ papel: 'owner' }, 'vendas')).toBe('/relatorios/vendas')
  })

  it('seção fechada ou inventada cai na tela inicial, nunca na de sem acesso', () => {
    expect(destinoNaConta(operador, 'fluxos')).toBe('/inbox')
    expect(destinoNaConta({ papel: 'owner' }, 'nao-existe')).toBe('')
    expect(destinoNaConta({ papel: 'owner' }, null)).toBe('')
  })
})
