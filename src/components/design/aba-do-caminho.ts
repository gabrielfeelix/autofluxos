import type { AbaDoCliente } from './secoes-do-cliente'

/**
 * Qual item da barra acende para um endereço.
 *
 * A barra mora no `layout.tsx` e não desenha de novo a cada clique, então ela
 * não recebe mais `ativa` da página: descobre pelo caminho. As exceções são as
 * mesmas que as páginas escolhiam à mão: Favoritas acende o Inbox, Respostas
 * acende Automações, e a configuração guiada acende Configurações.
 */
const PREFIXOS: [string, AbaDoCliente][] = [
  ['/inbox', 'inbox'],
  ['/favoritas', 'inbox'],
  ['/atividades', 'atividades'],
  ['/leads', 'leads'],
  ['/quadros', 'quadros'],
  ['/relatorios', 'relatorios'],
  ['/fluxos', 'fluxos'],
  ['/respostas', 'fluxos'],
  ['/transmissoes', 'transmissoes'],
  ['/ajustes', 'ajustes'],
  ['/configurar', 'ajustes'],
]

export function abaDoCaminho(caminho: string, base: string): AbaDoCliente | null {
  if (!caminho.startsWith(base)) return null
  const resto = caminho.slice(base.length).replace(/\/$/, '')
  if (resto === '') return 'inicio'
  const achado = PREFIXOS.find(([prefixo]) => resto === prefixo || resto.startsWith(`${prefixo}/`))
  return achado ? achado[1] : null
}

/**
 * O editor de fluxo é tela cheia: sem barra, sem faixa de navegação embaixo.
 * `/fluxos/<id>` e nada além disso; a lista (`/fluxos`) continua com barra.
 */
export function ehEditorDeFluxo(caminho: string, base: string): boolean {
  return new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/fluxos/[^/]+/?$`).test(caminho)
}
