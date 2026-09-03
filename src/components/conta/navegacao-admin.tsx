'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * A navegação da área de administração.
 *
 * **Quatro itens, não cinco.** O desenho da §2.2 do PLANO-SISTEMA lista também
 * `Plataforma`, e essa tela não existe. A regra do próprio plano vale aqui:
 * item de menu para tela que não existe é promessa que a interface faz e o
 * produto não cumpre. `Alertas` entrou porque a tela passou a existir — é o
 * `Saúde` do plano, com o nome do que ela realmente mostra.
 *
 * É componente de cliente só por causa do `usePathname` — a moldura precisa
 * saber qual item acender, e na área do administrador o item é a rota, sem a
 * ambiguidade que obriga a moldura do cliente a receber `ativa` na mão.
 */
const ITENS = [
  { href: '/admin/contas', rotulo: 'Contas' },
  { href: '/admin/usuarios', rotulo: 'Usuários' },
  { href: '/admin/auditoria', rotulo: 'Auditoria' },
  { href: '/admin/alertas', rotulo: 'Alertas' },
]

export function NavegacaoDoAdmin() {
  const caminho = usePathname()

  return (
    <nav
      aria-label="Administração"
      className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2 md:flex-col md:gap-0.5 md:overflow-visible md:border-0 md:p-0"
    >
      {ITENS.map((item) => {
        const acesa = caminho === item.href || caminho.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={acesa ? 'page' : undefined}
            className={`shrink-0 rounded-[10px] px-2.5 py-2.5 text-[13px] font-semibold transition ${
              acesa
                ? 'bg-accent/[0.12] text-white hover:bg-accent/[0.16]'
                : 'text-muted hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {item.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
