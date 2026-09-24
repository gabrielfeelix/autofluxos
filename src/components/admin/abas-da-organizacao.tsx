'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ABAS_DA_ORGANIZACAO } from './abas'

/**
 * As abas do detalhe da organização, no mesmo desenho das abas do app
 * (sublinhado na cor primária). Moram no layout, então trocar de aba não
 * redesenha o cabeçalho: só o miolo carrega.
 */
export function AbasDaOrganizacao({ base }: { base: string }) {
  const caminho = usePathname().replace(/\/$/, '')
  const acesa = [...ABAS_DA_ORGANIZACAO].reverse().find((aba) => (aba.caminho === '' ? caminho === base : caminho.startsWith(`${base}${aba.caminho}`)))

  return (
    <nav aria-label="Seções da organização" className="mb-5 flex gap-1 overflow-x-auto border-b border-line whitespace-nowrap [scrollbar-width:none]">
      {ABAS_DA_ORGANIZACAO.map((aba) => {
        const ativa = aba.chave === acesa?.chave
        return (
          <Link
            key={aba.chave}
            href={`${base}${aba.caminho}`}
            aria-current={ativa ? 'page' : undefined}
            scroll={false}
            className={`-mb-px flex shrink-0 items-center border-b-2 px-3 py-2.5 text-[13px] font-semibold transition sm:px-3.5 ${
              ativa ? 'border-primary text-primary' : 'border-transparent text-dim hover:text-ink'
            } ${aba.chave === 'perigo' && !ativa ? 'hover:text-perigo' : ''}`}
          >
            {aba.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
