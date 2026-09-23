import Link from 'next/link'
import type { ReactNode } from 'react'
import { iniciaisDe } from '@/components/design/logo-cliente'
import { NOME_DO_TIPO, urgenciaDe, type TipoDeAtividade, type Urgencia } from '@/core/atividades'
import { horaDoRelogio } from '@/lib/quando'
import type { ItemDaAgenda } from '@/server/repos/atividades'

/**
 * Uma atividade da agenda: linha de tabela no desktop, cartão no celular.
 *
 * As duas formas saem do mesmo `PartesDaLinha`, para o conteúdo não divergir
 * entre elas. Cor de urgência nunca vem sozinha: sempre há a palavra
 * ("vencida", "hoje") ao lado, para quem não distingue vermelho de âmbar.
 */

const PONTO: Record<Urgencia, string> = {
  vencida: 'bg-rose-500',
  hoje: 'bg-amber-400',
  futura: 'bg-line',
  'sem-prazo': 'bg-line',
}

const PALAVRA: Record<Urgencia, { texto: string; classe: string } | null> = {
  vencida: { texto: 'vencida', classe: 'text-perigo' },
  hoje: { texto: 'hoje', classe: 'text-aviso' },
  futura: null,
  'sem-prazo': null,
}

const DIA = 86_400_000

function diaUtc(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * "Hoje", "Amanhã", "Ontem" ou `20/09`, na mesma régua de dia de `urgenciaDe`
 * (dia UTC), para o texto e a cor da linha nunca discordarem.
 */
export function rotuloDoPrazo(item: Pick<ItemDaAgenda, 'prazo' | 'horaMarcada'>, agora: number): string {
  if (!item.prazo) return 'Sem prazo'
  const prazo = Date.parse(item.prazo)
  if (Number.isNaN(prazo)) return 'Sem prazo'
  const dias = Math.round((diaUtc(prazo) - diaUtc(agora)) / DIA)
  const d = new Date(prazo)
  const dia =
    dias === 0
      ? 'Hoje'
      : dias === 1
        ? 'Amanhã'
        : dias === -1
          ? 'Ontem'
          : `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}${
              d.getUTCFullYear() === new Date(agora).getUTCFullYear() ? '' : `/${d.getUTCFullYear()}`
            }`
  return item.horaMarcada ? `${dia} · ${horaDoRelogio(item.prazo)}` : dia
}

export function IconeDoTipo({ tipo, className = 'size-4' }: { tipo: TipoDeAtividade; className?: string }) {
  const comum = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (tipo) {
    case 'ligacao':
      return (
        <svg {...comum}>
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        </svg>
      )
    case 'reuniao':
      return (
        <svg {...comum}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.6" />
        </svg>
      )
    case 'visita':
      return (
        <svg {...comum}>
          <path d="M12 21s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      )
    case 'proposta':
      return (
        <svg {...comum}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </svg>
      )
    default:
      return (
        <svg {...comum}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
      )
  }
}

function ehLink(onde: string): boolean {
  return /^https?:\/\//i.test(onde) || /^(meet\.google\.com|zoom\.us|teams\.microsoft\.com)\//i.test(onde)
}

function Onde({ onde }: { onde: string }) {
  if (ehLink(onde)) {
    const href = /^https?:\/\//i.test(onde) ? onde : `https://${onde}`
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="truncate text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {onde.replace(/^https?:\/\//i, '')}
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    )
  }
  return <span className="truncate">{onde}</span>
}

function Responsavel({ nome }: { nome: string | null }) {
  if (!nome) return <span className="text-[12px] text-dim">Sem responsável</span>
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-weak text-[9.5px] font-bold text-primary"
      >
        {iniciaisDe(nome)}
      </span>
      <span className="truncate text-[12px] text-muted">{nome}</span>
    </span>
  )
}

type Props = {
  item: ItemDaAgenda
  agora: number
  clienteId: string
  /** A URL atual da agenda, para a ficha saber para onde voltar. */
  volta: string
  /** Botões de ação. Vêm de fora porque são componente de cliente. */
  acoes?: ReactNode
  /** A mensagem do servidor quando a última ação nesta linha falhou. */
  erro?: string | null
}

function Erro({ texto }: { texto: string }) {
  return (
    <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/[0.07] px-3 py-2 text-[12px] leading-5 text-perigo">
      {texto}
    </p>
  )
}

function partes({ item, agora, clienteId, volta }: Props) {
  const urgencia = urgenciaDe(item, agora)
  const palavra = PALAVRA[urgencia]
  const resolvida = item.situacao !== 'aberta'
  const hrefDoContato = `/clientes/${clienteId}/leads/${item.contatoId}?volta=${encodeURIComponent(volta)}`

  const prazo = (
    <span className="flex items-start gap-2">
      <span aria-hidden className={`mt-[5px] size-2 shrink-0 rounded-full ${resolvida ? 'bg-line' : PONTO[urgencia]}`} />
      <span className="min-w-0">
        <span className={`block text-[12.5px] font-semibold tabular-nums ${resolvida ? 'text-dim' : 'text-ink'}`}>
          {rotuloDoPrazo(item, agora)}
        </span>
        {!resolvida && palavra && <span className={`block text-[11px] font-semibold ${palavra.classe}`}>{palavra.texto}</span>}
        {item.situacao === 'concluida' && <span className="block text-[11px] text-ok">concluída</span>}
        {item.situacao === 'cancelada' && <span className="block text-[11px] text-dim">cancelada</span>}
      </span>
    </span>
  )

  const atividade = (
    <span className="flex min-w-0 items-start gap-2.5">
      <span
        className="mt-px grid size-7 shrink-0 place-items-center rounded-lg bg-surface text-muted"
        title={NOME_DO_TIPO[item.tipo]}
      >
        <IconeDoTipo tipo={item.tipo} />
        <span className="sr-only">{NOME_DO_TIPO[item.tipo]}: </span>
      </span>
      <span className="min-w-0">
        <span className={`block text-[13px] leading-5 font-semibold ${resolvida ? 'text-dim line-through' : 'text-ink'}`}>
          {item.titulo}
        </span>
        {(item.negocio || item.onde) && (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-[11.5px] leading-5 text-dim">
            {item.negocio && (
              <span className="truncate">
                {item.negocio.funil}
                {item.negocio.etapa && ` · ${item.negocio.etapa}`}
              </span>
            )}
            {item.onde && <Onde onde={item.onde} />}
          </span>
        )}
        {item.nota && <span className="line-clamp-1 text-[11.5px] leading-5 text-dim italic">{item.nota}</span>}
        {item.situacao === 'cancelada' && item.motivoDoCancelamento && (
          <span className="line-clamp-1 text-[11.5px] leading-5 text-dim">Motivo: {item.motivoDoCancelamento}</span>
        )}
      </span>
    </span>
  )

  const contato = (
    <span className="block min-w-0">
      <Link href={hrefDoContato} className="block truncate text-[12.5px] font-semibold text-ink hover:text-primary hover:underline">
        {item.contato.nome}
      </Link>
      {item.contato.telefone && item.contato.telefone !== item.contato.nome && (
        <span className="block truncate font-mono text-[10.5px] text-dim">{item.contato.telefone}</span>
      )}
    </span>
  )

  return { prazo, atividade, contato, responsavel: <Responsavel nome={item.responsavelNome} /> }
}

export function LinhaDaAgenda(props: Props) {
  const p = partes(props)
  const colunas = props.acoes !== undefined ? 5 : 4
  return (
    <>
      <tr className={`align-top hover:bg-surface/60 ${props.erro ? '' : 'border-b border-line last:border-0'}`}>
        <td className="w-[150px] px-4 py-3.5">{p.prazo}</td>
        <td className="px-4 py-3.5">{p.atividade}</td>
        <td className="w-[210px] max-w-[210px] px-4 py-3.5">{p.contato}</td>
        <td className="w-[170px] max-w-[170px] px-4 py-3.5">{p.responsavel}</td>
        {props.acoes !== undefined && <td className="w-[1%] px-4 py-3 whitespace-nowrap">{props.acoes}</td>}
      </tr>
      {props.erro && (
        <tr className="border-b border-line last:border-0">
          <td colSpan={colunas} className="px-4 pb-3">
            <Erro texto={props.erro} />
          </td>
        </tr>
      )}
    </>
  )
}

export function CartaoDaAgenda(props: Props) {
  const p = partes(props)
  return (
    <li className="border-b border-line px-4 py-3.5 last:border-0">
      <div className="flex items-start justify-between gap-3">
        {p.prazo}
        {props.acoes}
      </div>
      <div className="mt-2.5">{p.atividade}</div>
      <div className="mt-2.5 flex items-end justify-between gap-3 border-t border-line-soft pt-2.5">
        {p.contato}
        <span className="shrink-0">{p.responsavel}</span>
      </div>
      {props.erro && (
        <div className="mt-2.5">
          <Erro texto={props.erro} />
        </div>
      )}
    </li>
  )
}
