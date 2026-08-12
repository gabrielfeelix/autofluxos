'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'

/**
 * As abas do cliente.
 *
 * A régua para o que vira aba: **destino que se visita, não ação que se faz.**
 * Contexto, credenciais e número são configuração — mexe-se uma vez e não se
 * volta — então moram juntos em Ajustes em vez de gastarem três abas ao lado
 * das telas do dia a dia.
 *
 * `useSelectedLayoutSegment` em vez de comparar `usePathname`: o segmento é o
 * que o roteador já sabe, e comparar string de caminho quebra calado quando a
 * rota ganha um nível.
 */
const ABAS = [
  { segmento: null, rotulo: 'Início', href: '' },
  { segmento: 'fluxos', rotulo: 'Fluxos', href: '/fluxos' },
  { segmento: 'leads', rotulo: 'Leads', href: '/leads' },
  { segmento: 'ajustes', rotulo: 'Ajustes', href: '/ajustes' },
] as const

/** Telas de configuração que moram sob Ajustes e mantêm a aba acesa. */
const DENTRO_DE_AJUSTES = ['ajustes', 'contexto', 'conexoes', 'numero']

export function AbasDoCliente({ clienteId }: { clienteId: string }) {
  const segmento = useSelectedLayoutSegment()

  const ativa = (aba: (typeof ABAS)[number]) =>
    aba.segmento === 'ajustes'
      ? segmento !== null && DENTRO_DE_AJUSTES.includes(segmento)
      : segmento === aba.segmento

  return (
    <nav className="-mb-px flex gap-1 border-b border-white/[0.06]" aria-label="Seções do cliente">
      {ABAS.map((aba) => {
        const acesa = ativa(aba)
        return (
          <Link
            key={aba.rotulo}
            href={`/clientes/${clienteId}${aba.href}`}
            aria-current={acesa ? 'page' : undefined}
            className={`rounded-t-lg border-b-2 px-4 py-2.5 text-[13px] font-bold transition ${
              acesa
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {aba.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
