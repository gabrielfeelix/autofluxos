import Link from 'next/link'
import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import type { CobrancaRegistrada, StatusDeCobranca } from '@/server/repos/cobrancas'
import { IconeDaSecao, iconeDinheiro } from './icones'

const STATUS: Record<StatusDeCobranca, { rotulo: string; tom: TomDaPilula }> = {
  pendente: { rotulo: 'Aguardando', tom: 'aviso' },
  paga: { rotulo: 'Paga', tom: 'ok' },
  vencida: { rotulo: 'Vencida', tom: 'neutro' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutro' },
  estornada: { rotulo: 'Estornada', tom: 'perigo' },
}

const DATA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })

const reais = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * As últimas cobranças desta pessoa, na ficha (cobrança no chat, etapa C).
 *
 * Só aparece quando há alguma: um cartão vazio em toda ficha de quem nunca foi
 * cobrado seria ruído para a conta que não cobra pela conversa.
 */
export function CobrancasDoContato({
  clienteId,
  cobrancas,
}: {
  clienteId: string
  cobrancas: CobrancaRegistrada[]
}) {
  if (cobrancas.length === 0) return null
  return (
    <section id="cobrancas" className="app-card overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        <IconeDaSecao tom="ok">{iconeDinheiro}</IconeDaSecao>
        Cobranças
        <span className="flex-1" />
        <Link
          href={`/clientes/${clienteId}/leads/cobrancas`}
          className="text-[11.5px] font-semibold text-primary hover:underline"
        >
          Ver todas
        </Link>
      </h2>
      <ul className="divide-y divide-line-soft">
        {cobrancas.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-[18px] py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-ink">{c.descricao}</p>
              <p className="text-[11.5px] text-dim tabular-nums">
                {c.status === 'paga' && c.pagaEm ? `paga em ${DATA.format(new Date(c.pagaEm))}` : `criada em ${DATA.format(new Date(c.criadoEm))}`}
              </p>
            </div>
            <span className="text-[13px] font-semibold tabular-nums">{reais(c.valorCentavos)}</span>
            <Pilula tom={STATUS[c.status].tom}>{STATUS[c.status].rotulo}</Pilula>
          </li>
        ))}
      </ul>
    </section>
  )
}
