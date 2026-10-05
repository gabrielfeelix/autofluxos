import type { ReactNode } from 'react'
import { comoFrase, type Evento } from '@/core/crm'
import { horaExata, quando } from '@/lib/quando'
import { iconeLapis } from './icones'

/**
 * A linha do tempo do contato, com um desenho por tipo de fato.
 *
 * Mora aqui porque são duas telas lendo o mesmo histórico: o painel do negócio
 * e a aba Histórico da ficha. Com o desenho copiado em cada uma, a primeira
 * ganharia um ícone novo e a segunda não, e quem usa as duas aprenderia dois
 * produtos.
 */
export function LinhaDoTempo({ grupos }: { grupos: { evento: Evento; vezes: number }[] }) {
  return (
    <ol className="crm-linha">
      {grupos.map(({ evento, vezes }) => {
        const marca = marcaDoEvento(evento.tipo)
        return (
          <li key={evento.id}>
            <span className={`crm-linha-marca ${marca.tom}`} aria-hidden>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {marca.desenho}
              </svg>
            </span>
            <div className="min-w-0 flex-1 pt-px">
              <p className="text-xs leading-5 text-soft first-letter:uppercase">
                {comoFrase(evento)}
                {vezes > 1 && (
                  <span className="ml-1.5 rounded-full bg-surface px-1.5 py-px text-[10px] font-semibold text-muted">
                    ×{vezes}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-dim" title={horaExata(evento.criadoEm)}>
                {quando(evento.criadoEm)}
                {evento.autor && ` · ${evento.autor}`}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * O mesmo evento repetido em sequência vira uma linha só com "×3": três
 * "automação pausada" no mesmo minuto empurravam para fora o que importava.
 */
export function agruparEventos(eventos: Evento[]): { evento: Evento; vezes: number }[] {
  const grupos: { evento: Evento; vezes: number; chave: string }[] = []
  for (const evento of eventos) {
    const chave = `${comoFrase(evento)}|${evento.autor ?? ''}`
    const ultimo = grupos.at(-1)
    if (ultimo && ultimo.chave === chave) ultimo.vezes += 1
    else grupos.push({ evento, vezes: 1, chave })
  }
  return grupos
}

/** Um desenho por tipo de fato, para se achar "ganhou" sem ler a lista inteira. */
export function marcaDoEvento(tipo: string): { desenho: ReactNode; tom: string } {
  switch (tipo) {
    case 'mudou-de-etapa':
    case 'entrou-no-quadro':
    case 'saiu-do-quadro':
      return { desenho: <path d="M5 12h14M13 6l6 6-6 6" />, tom: 'text-primary' }
    case 'ganhou':
      return { desenho: <path d="M5 12.5l4.5 4.5L19 7.5" />, tom: 'text-ok' }
    case 'perdeu':
      return { desenho: <path d="M7 7l10 10M17 7 7 17" />, tom: 'text-perigo' }
    case 'mensagem-recebida':
    case 'mensagem-enviada':
    case 'agendou':
      return {
        desenho: <path d="M5 6.5h14v9H10l-4 3v-3H5z" />,
        tom: 'text-muted',
      }
    case 'automacao':
      return { desenho: <path d="M13 3.5 6 13h5l-1 7.5L18 11h-5l1-7.5Z" />, tom: 'text-aviso' }
    case 'assumiu':
      return {
        desenho: (
          <>
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" />
          </>
        ),
        tom: 'text-muted',
      }
    case 'mudou-de-temperatura':
      return {
        desenho: <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z" />,
        tom: 'text-perigo',
      }
    case 'nota':
      return { desenho: iconeLapis, tom: 'text-aviso' }
    default:
      return { desenho: <circle cx="12" cy="12" r="3" />, tom: 'text-dim' }
  }
}
