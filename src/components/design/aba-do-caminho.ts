import type { AbaDoCliente, ChaveDaSecao } from './secoes-do-cliente'

/**
 * Qual porta (`AbaDoCliente`) um endereço abre.
 *
 * Serve a quem precisa saber "em que tela a pessoa está" sem desenhar a barra:
 * o seletor de conta, que leva a pessoa para a mesma tela na outra conta. As
 * exceções são as mesmas que as páginas escolhem à mão: Mensagens salvas é das
 * Conversas, Respostas coletadas é de Automações, e a configuração guiada é de
 * Configurações.
 */
const PREFIXOS: [string, AbaDoCliente][] = [
  ['/inbox', 'inbox'],
  ['/favoritas', 'inbox'],
  ['/conversas/respostas-rapidas', 'respostas-rapidas'],
  ['/conversas/canais', 'canais'],
  ['/atividades', 'atividades'],
  ['/leads/etiquetas', 'etiquetas'],
  ['/leads', 'leads'],
  ['/quadros', 'quadros'],
  ['/negocios', 'quadros'],
  ['/relatorios/vendas', 'vendas'],
  ['/relatorios', 'relatorios'],
  ['/fluxos', 'fluxos'],
  ['/respostas', 'fluxos'],
  ['/transmissoes', 'transmissoes'],
  ['/loja', 'loja'],
  ['/ajustes', 'ajustes'],
  ['/configurar', 'ajustes'],
]

function restoDoCaminho(caminho: string, base: string): string | null {
  if (caminho !== base && !caminho.startsWith(`${base}/`)) return null
  return caminho.slice(base.length).replace(/\/$/, '')
}

const casa = (resto: string, prefixo: string) => resto === prefixo || resto.startsWith(`${prefixo}/`)

export function abaDoCaminho(caminho: string, base: string): AbaDoCliente | null {
  const resto = restoDoCaminho(caminho, base)
  if (resto === null) return null
  if (resto === '') return 'inicio'
  return PREFIXOS.find(([prefixo]) => casa(resto, prefixo))?.[1] ?? null
}

/**
 * A seção aberta e o subitem aceso para um endereço.
 *
 * A barra mora no `layout.tsx` e não desenha de novo a cada clique, então ela
 * não recebe o item aceso da página: descobre pelo caminho **e pela busca**,
 * porque três subitens de Conversas são a mesma tela com `?de=` diferente, e
 * três de Automações são a mesma tela com `?aba=` diferente.
 *
 * `item: null` com seção preenchida é "a seção certa, nenhum subitem": o
 * Inbox filtrado por um colega (`?de=<id>`) está em Conversas, mas não é
 * nenhuma das três visões do menu.
 */
const DO_CAMINHO: [string, ChaveDaSecao, string][] = [
  ['/favoritas', 'conversas', 'salvas'],
  ['/conversas/respostas-rapidas', 'conversas', 'respostas-rapidas'],
  ['/conversas/canais', 'conversas', 'canais'],
  ['/leads/segmentos', 'crm', 'segmentos'],
  ['/leads/etiquetas', 'crm', 'etiquetas'],
  ['/leads', 'crm', 'contatos'],
  ['/quadros', 'crm', 'negocios'],
  ['/negocios', 'crm', 'negocios'],
  ['/atividades', 'crm', 'atividades'],
  ['/transmissoes', 'automacoes', 'transmissoes'],
  ['/respostas', 'automacoes', 'respostas-coletadas'],
  ['/loja/catalogo', 'loja', 'catalogo'],
  ['/loja', 'loja', 'conectar-loja'],
  ['/relatorios/vendas', 'analise', 'vendas'],
  ['/relatorios', 'analise', 'atendimento'],
  ['/ajustes', 'ajustes', 'ajustes'],
  ['/configurar', 'ajustes', 'ajustes'],
]

export type Aceso = { secao: ChaveDaSecao; item: string | null }

export function acesoDoCaminho(
  caminho: string,
  base: string,
  busca?: { get(nome: string): string | null } | null,
  /** O id de quem olha: a fila troca `minhas` pelo id nos links dela. */
  eu?: string,
): Aceso | null {
  const resto = restoDoCaminho(caminho, base)
  if (resto === null) return null
  if (resto === '') return { secao: 'inicio', item: 'inicio' }

  if (casa(resto, '/inbox')) {
    const de = busca?.get('de') || 'todos'
    const item = de === 'minhas' || (eu && de === eu) ? 'minhas' : de === 'sem-dono' ? 'sem-dono' : de === 'todos' ? 'todas' : null
    return { secao: 'conversas', item }
  }
  if (casa(resto, '/fluxos')) {
    // Os nomes antigos de aba (`palavras`, `eventos`, `campanhas`) são
    // Gatilhos; ver `resolverAba`.
    const aba = busca?.get('aba')
    const item =
      aba === 'gatilhos' || aba === 'palavras' || aba === 'eventos' || aba === 'campanhas'
        ? 'gatilhos'
        : aba === 'sequencias'
          ? 'sequencias'
          : 'fluxos'
    return { secao: 'automacoes', item }
  }
  const achado = DO_CAMINHO.find(([prefixo]) => casa(resto, prefixo))
  return achado ? { secao: achado[1], item: achado[2] } : null
}

/**
 * O editor de fluxo é tela cheia: sem barra, sem faixa de navegação embaixo.
 * `/fluxos/<id>` e nada além disso; a lista (`/fluxos`) continua com barra.
 */
export function ehEditorDeFluxo(caminho: string, base: string): boolean {
  return new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/fluxos/[^/]+/?$`).test(caminho)
}
