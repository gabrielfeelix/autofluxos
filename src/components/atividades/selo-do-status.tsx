import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import { NOME_DO_STATUS, type StatusDaAtividade } from '@/core/atividades'

/**
 * O status de uma atividade como selo: ícone, palavra e cor, os três juntos.
 *
 * A cor nunca vem sozinha (quem não distingue vermelho de âmbar continua
 * lendo "Atrasada"), e o ícone é o que deixa a coluna ser varrida de cima a
 * baixo sem ler: o relógio com exclamação salta entre os círculos neutros.
 */
const TOM: Record<StatusDaAtividade, TomDaPilula> = {
  atrasada: 'perigo',
  hoje: 'aviso',
  pendente: 'neutro',
  concluida: 'ok',
  cancelada: 'neutro',
}

export function SeloDoStatus({
  status,
  compacto = false,
  className = '',
}: {
  status: StatusDaAtividade
  /** A versão de 20px, para listas laterais em que a de 24px pesa. */
  compacto?: boolean
  className?: string
}) {
  return (
    <Pilula
      tom={TOM[status]}
      className={`${compacto ? '!h-5 !gap-1 !px-2 !text-[10.5px]' : ''} ${status === 'cancelada' ? 'text-dim' : ''} ${className}`}
    >
      <IconeDoStatus status={status} />
      {NOME_DO_STATUS[status]}
    </Pilula>
  )
}

function IconeDoStatus({ status }: { status: StatusDaAtividade }) {
  const comum = {
    'aria-hidden': true,
    viewBox: '0 0 24 24',
    className: 'size-3 shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (status) {
    case 'atrasada':
      return (
        <svg {...comum}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5.5M12 16.5h.01" />
        </svg>
      )
    case 'hoje':
      return (
        <svg {...comum}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'concluida':
      return (
        <svg {...comum}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12.5 2.7 2.7L16.5 9.5" />
        </svg>
      )
    case 'cancelada':
      return (
        <svg {...comum}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </svg>
      )
    default:
      return (
        <svg {...comum}>
          <circle cx="12" cy="12" r="9" strokeDasharray="3.2 2.6" />
        </svg>
      )
  }
}
