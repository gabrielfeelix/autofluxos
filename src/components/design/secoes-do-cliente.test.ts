import { describe, expect, it } from 'vitest'
import { MODELOS_EXTRA, type Acesso } from '@/core/permissoes'
import { ITENS, destinoNaConta, liberaSecao, secoesVisiveis, telaInicial } from './secoes-do-cliente'

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

describe('as seções que esta pessoa pode usar (E7)', () => {
  const atendimento: Acesso = {
    papel: 'member',
    usuarioId: 'u1',
    sobrescritas: { ...MODELOS_EXTRA.operador },
  }

  it('acesso de atendimento não vê Automações, Transmissões nem Configurações', () => {
    const chaves = secoesVisiveis({ crmVisivel: true, regras: atendimento }).map((i) => i.chave)
    expect(chaves).not.toContain('fluxos')
    expect(chaves).not.toContain('transmissoes')
    expect(chaves).not.toContain('ajustes')
    expect(chaves).toEqual(ITENS.map((i) => i.chave).filter((c) => !['fluxos', 'transmissoes', 'ajustes'].includes(c)))
  })

  it('membro sem exceção continua vendo tudo: o menu não tira acesso de quem já tinha', () => {
    const chaves = secoesVisiveis({ crmVisivel: true, regras: { papel: 'member', usuarioId: 'u1' } })
    expect(chaves).toHaveLength(ITENS.length)
  })

  it('suporte 4YU vê tudo', () => {
    expect(
      secoesVisiveis({ crmVisivel: true, regras: { papel: null, ehAdminDaPlataforma: true } }),
    ).toHaveLength(ITENS.length)
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
  })

  it('seção fechada ou inventada cai na tela inicial, nunca na de sem acesso', () => {
    expect(destinoNaConta(operador, 'fluxos')).toBe('/inbox')
    expect(destinoNaConta({ papel: 'owner' }, 'nao-existe')).toBe('')
    expect(destinoNaConta({ papel: 'owner' }, null)).toBe('')
  })
})
