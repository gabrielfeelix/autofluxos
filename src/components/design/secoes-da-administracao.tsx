import type { ReactNode } from 'react'

/**
 * As seções da administração da plataforma, os ícones e o item aceso.
 *
 * Mesmo princípio de `secoes-do-cliente.tsx`: nada aqui vai ao banco, então o
 * `loading.tsx` de qualquer tela da administração desenha a barra de verdade,
 * com os nomes escritos e o item aceso, antes de qualquer consulta terminar.
 *
 * Os grupos seguem o plano da administração (24/set/2026): o que se usa todo
 * dia (Operação), o que se vende (Comercial) e o que se confere quando algo
 * está estranho (Sistema).
 */

export type AbaDaAdministracao =
  | 'inicio'
  | 'organizacoes'
  | 'usuarios'
  | 'planos'
  | 'pedidos'
  | 'funcoes'
  | 'consumo'
  | 'alertas'
  | 'auditoria'

export const ITENS_DA_ADMINISTRACAO: {
  chave: AbaDaAdministracao
  rotulo: string
  href: string
  icone: ReactNode
}[] = [
  { chave: 'inicio', rotulo: 'Visão geral', href: '/admin', icone: <IconeVisao /> },
  { chave: 'organizacoes', rotulo: 'Organizações', href: '/admin/organizacoes', icone: <IconeOrganizacoes /> },
  { chave: 'usuarios', rotulo: 'Usuários', href: '/admin/usuarios', icone: <IconeUsuarios /> },
  { chave: 'planos', rotulo: 'Planos', href: '/admin/planos', icone: <IconePlanos /> },
  { chave: 'pedidos', rotulo: 'Pedidos de plano', href: '/admin/pedidos', icone: <IconePedidos /> },
  { chave: 'funcoes', rotulo: 'Funções', href: '/admin/funcoes', icone: <IconeFuncoes /> },
  { chave: 'consumo', rotulo: 'Consumo', href: '/admin/consumo', icone: <IconeConsumo /> },
  { chave: 'alertas', rotulo: 'Alertas', href: '/admin/alertas', icone: <IconeAlertas /> },
  { chave: 'auditoria', rotulo: 'Auditoria', href: '/admin/auditoria', icone: <IconeAuditoria /> },
]

export const GRUPOS_DA_ADMINISTRACAO = [
  { nome: 'Operação', chaves: ['organizacoes', 'usuarios'] },
  { nome: 'Comercial', chaves: ['planos', 'pedidos'] },
  { nome: 'Sistema', chaves: ['funcoes', 'consumo', 'alertas', 'auditoria'] },
]

/** Os cinco atalhos da barra de baixo, no celular. O resto fica na gaveta. */
export const EMBAIXO_DA_ADMINISTRACAO = ['inicio', 'organizacoes', 'usuarios', 'pedidos', 'alertas'] as const

/** O item aceso para um endereço da administração. */
export function abaDaAdministracao(caminho: string): AbaDaAdministracao | null {
  const resto = caminho.replace(/\/$/, '')
  if (resto === '/admin') return 'inicio'
  // `/admin/contas` é o endereço antigo de Organizações, e continua acendendo
  // o mesmo item enquanto redireciona.
  if (resto === '/admin/contas' || resto.startsWith('/admin/contas/')) return 'organizacoes'
  const achado = ITENS_DA_ADMINISTRACAO.find(
    (item) => item.chave !== 'inicio' && (resto === item.href || resto.startsWith(`${item.href}/`)),
  )
  return achado?.chave ?? null
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function IconeVisao() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.6" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.6" opacity=".45" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.6" opacity=".45" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.6" opacity=".45" />
    </svg>
  )
}

function IconeOrganizacoes() {
  return (
    <Svg>
      <path d="M2 13.2V3.4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v9.8M9 6.2h3a1 1 0 0 1 1 1v6M1.2 13.2h12.6" />
      <path d="M4.3 5h1.4M4.3 7.4h1.4M4.3 9.8h1.4M10.6 8.6h.6M10.6 10.8h.6" />
    </Svg>
  )
}

function IconeUsuarios() {
  return (
    <Svg>
      <circle cx="6" cy="5" r="2.6" />
      <path d="M1.4 13c0-2.4 2.1-4 4.6-4s4.6 1.6 4.6 4" />
      <path d="M10.6 3.1a2.4 2.4 0 0 1 0 4.4M11.6 9.3c1.3.5 2.1 1.6 2.1 3.1" opacity=".5" />
    </Svg>
  )
}

function IconePlanos() {
  return (
    <Svg>
      <path d="M7.5 1.6 13 4.4 7.5 7.2 2 4.4Z" />
      <path d="m2 7.5 5.5 2.8L13 7.5M2 10.6l5.5 2.8 5.5-2.8" opacity=".6" />
    </Svg>
  )
}

function IconePedidos() {
  return (
    <Svg>
      <path d="M3 1.8h6.2L12 4.6v8.6H3Z" />
      <path d="M9 1.8v2.8h3M5.2 8.6l1.5 1.5 3-3" />
    </Svg>
  )
}

function IconeFuncoes() {
  return (
    <Svg>
      <path d="M7.5 1.4 12.6 3.4v3.8c0 3-2.2 5.2-5.1 6.4-2.9-1.2-5.1-3.4-5.1-6.4V3.4Z" />
      <path d="m5.2 7.4 1.6 1.6 3-3" />
    </Svg>
  )
}

function IconeConsumo() {
  return (
    <Svg>
      <path d="M2 13h11M4 10.5V8M7.5 10.5V4M11 10.5V6.5" />
    </Svg>
  )
}

function IconeAlertas() {
  return (
    <Svg>
      <path d="M7.5 1.8 13.6 12.6H1.4Z" />
      <path d="M7.5 5.8v3M7.5 10.6h.01" />
    </Svg>
  )
}

function IconeAuditoria() {
  return (
    <Svg>
      <circle cx="7.5" cy="7.5" r="5.8" />
      <path d="M7.5 4.2v3.5l2.3 1.4" />
    </Svg>
  )
}
