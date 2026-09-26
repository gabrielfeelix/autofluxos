import { describe, expect, it } from 'vitest'
import { MODELOS_EXTRA, type Acesso } from '@/core/permissoes'
import { LUGARES_DA_BARRA, NICHOS, PACOTES } from '@/core/nichos'
import { ITENS, SECOES, destinoNaConta, liberaSecao, rotuloDaSecao, secoesVisiveis, telaInicial } from './secoes-do-cliente'

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
    expect(destinoNaConta({ papel: 'owner' }, 'etiquetas')).toBe('/ajustes/etiquetas')
    expect(destinoNaConta({ papel: 'owner' }, 'vendas')).toBe('/relatorios/vendas')
  })

  it('seção fechada ou inventada cai na tela inicial, nunca na de sem acesso', () => {
    expect(destinoNaConta(operador, 'fluxos')).toBe('/inbox')
    expect(destinoNaConta({ papel: 'owner' }, 'nao-existe')).toBe('')
    expect(destinoNaConta({ papel: 'owner' }, null)).toBe('')
  })
})

describe('as palavras do ramo (core/nichos.ts)', () => {
  const secaoLoja = (nicho: Parameters<typeof secoesVisiveis>[0]) => secoesVisiveis(nicho).find((secao) => secao.chave === 'loja')

  it('sem ramo, nada muda: mesma barra, mesmas palavras', () => {
    expect(secoesVisiveis({ nicho: null })).toEqual(secoesVisiveis())
    expect(secaoLoja({ nicho: null })?.rotulo).toBe('Comércio')
    expect(rotuloDaSecao('loja')).toBe('Comércio')
  })

  it('restaurante chama de Cardápio e Pratos', () => {
    const loja = secaoLoja({ nicho: 'restaurante' })
    expect(loja?.rotulo).toBe('Cardápio')
    expect(loja?.itens.map((item) => item.rotulo)).toEqual(['Pratos', 'Integrações'])
    expect(rotuloDaSecao('loja', 'restaurante')).toBe('Cardápio')
  })

  it('comércio de rua não vê Integrações, que é de loja on-line', () => {
    expect(secaoLoja({ nicho: 'comercio' })?.itens.map((item) => item.id)).toEqual(['catalogo'])
  })

  it('o ramo não muda a ordem: só esconde, e só o que o pacote diz', () => {
    for (const nicho of NICHOS) {
      const ordem = SECOES.map((secao) => secao.chave)
      const vistas = chaves(secoesVisiveis({ nicho }))
      expect(vistas, nicho).toEqual(ordem.filter((chave) => vistas.includes(chave)))
      const semOcultos = ids(secoesVisiveis()).filter((id) => !(PACOTES[nicho].ocultos as string[]).includes(id))
      expect(ids(secoesVisiveis({ nicho })), nicho).toEqual(semOcultos)
    }
  })

  it('todo lugar que um ramo renomeia ou esconde existe na barra', () => {
    const existentes = [...SECOES.map((secao) => secao.chave as string), ...ITENS.map((item) => item.id)]
    for (const lugar of LUGARES_DA_BARRA) expect(existentes, lugar).toContain(lugar)
  })

  it('Início, Conversas, Automações e Configurações são iguais em todo ramo', () => {
    const fixas = (lista: ReturnType<typeof secoesVisiveis>) =>
      lista.filter((secao) => ['inicio', 'conversas', 'automacoes', 'ajustes'].includes(secao.chave)).map((secao) => [secao.rotulo, ...secao.itens.map((item) => item.rotulo)])
    for (const nicho of NICHOS) expect(fixas(secoesVisiveis({ nicho })), nicho).toEqual(fixas(secoesVisiveis()))
  })

  it('aulas fala como a MGM: Alunos, Matrículas e Planos, sem integração de loja', () => {
    const barra = secoesVisiveis({ nicho: 'aulas' })
    const crm = barra.find((secao) => secao.chave === 'crm')
    expect(crm?.itens.find((item) => item.id === 'contatos')?.rotulo).toBe('Alunos')
    expect(crm?.itens.find((item) => item.id === 'negocios')?.rotulo).toBe('Matrículas')
    const planos = barra.find((secao) => secao.chave === 'loja')
    expect(planos?.rotulo).toBe('Planos')
    expect(planos?.itens.map((item) => item.rotulo)).toEqual(['Planos e modalidades'])
    expect(rotuloDaSecao('leads', 'aulas')).toBe('Alunos')
    expect(rotuloDaSecao('quadros', 'aulas')).toBe('Matrículas')
  })

  it('o ramo não passa por cima do interruptor nem da permissão', () => {
    expect(secaoLoja({ nicho: 'restaurante', lojaVisivel: false })).toBeUndefined()
    const atendimento: Acesso = { papel: 'member', usuarioId: 'u1', sobrescritas: { ...MODELOS_EXTRA.operador } }
    expect(secaoLoja({ nicho: 'restaurante', regras: atendimento })).toBeUndefined()
  })
})
