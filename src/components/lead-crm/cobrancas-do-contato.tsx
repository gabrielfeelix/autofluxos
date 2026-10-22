'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import type { CobrancaRegistrada, StatusDeCobranca } from '@/server/repos/cobrancas'
import { IrParaAba } from './abas'
import { IconeDaSecao, iconeDinheiro } from './icones'

const STATUS: Record<StatusDeCobranca, { rotulo: string; tom: TomDaPilula }> = {
  pendente: { rotulo: 'Aguardando', tom: 'aviso' },
  paga: { rotulo: 'Paga', tom: 'ok' },
  vencida: { rotulo: 'Vencida', tom: 'neutro' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutro' },
  estornada: { rotulo: 'Estornada', tom: 'perigo' },
}

const ORIGEM: Record<string, string> = { inbox: 'pela conversa', fluxo: 'pela automação', ia: 'pela IA', api: 'pela API' }

const DATA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
const DATA_E_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const reais = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Recebido, aguardando e vencido sem pagar: o que a equipe olha primeiro. */
function totais(cobrancas: CobrancaRegistrada[]) {
  const soma = (status: StatusDeCobranca) =>
    cobrancas.filter((c) => c.status === status).reduce((t, c) => t + c.valorCentavos, 0)
  return { recebido: soma('paga'), aguardando: soma('pendente'), vencido: soma('vencida') }
}

function quando(c: CobrancaRegistrada): string {
  if (c.status === 'paga' && c.pagaEm) return `paga em ${DATA.format(new Date(c.pagaEm))}`
  if (c.status === 'pendente') return `vence ${DATA_E_HORA.format(new Date(c.venceEm))}`
  return `criada em ${DATA.format(new Date(c.criadoEm))}`
}

/** Sem cobrança: diz como cobrar, ou onde conectar a conta de recebimento. */
function ComoCobrar({ clienteId, conectado }: { clienteId: string; conectado: boolean }) {
  return conectado ? (
    <p className="text-[12px] leading-5 text-dim">
      Cobre pelo botão <strong className="font-semibold text-soft">Cobrar</strong> da caixa de resposta: sai Pix
      e link de cartão ou boleto, e a cobrança vira paga sozinha.{' '}
      <IrParaAba aba="conversa" className="font-semibold text-primary hover:underline">
        Abrir a conversa
      </IrParaAba>
    </p>
  ) : (
    <p className="text-[12px] leading-5 text-dim">
      Conecte a conta onde você recebe, no Mercado Pago ou no Asaas, para cobrar por Pix e link direto na
      conversa.{' '}
      <Link href={`/clientes/${clienteId}/ajustes/pagamentos`} className="font-semibold text-primary hover:underline">
        Conectar conta de recebimento
      </Link>
    </p>
  )
}

function Totais({ cobrancas, grande = false }: { cobrancas: CobrancaRegistrada[]; grande?: boolean }) {
  const t = totais(cobrancas)
  const itens = [
    { rotulo: 'Recebido', valor: t.recebido, cor: 'text-ok' },
    { rotulo: 'Aguardando', valor: t.aguardando, cor: 'text-aviso' },
    { rotulo: 'Vencido', valor: t.vencido, cor: 'text-muted' },
  ]
  return (
    <dl className={`grid grid-cols-3 ${grande ? 'gap-2 sm:gap-3' : 'divide-x divide-line-soft border-b border-line-soft'}`}>
      {itens.map((item) => (
        <div
          key={item.rotulo}
          className={grande ? 'app-card px-3 py-3 sm:px-4 sm:py-3.5' : 'px-[18px] py-3'}
        >
          <dt className="text-[11px] font-semibold text-dim">{item.rotulo}</dt>
          <dd className={`mt-0.5 font-bold whitespace-nowrap tabular-nums ${grande ? 'text-[14px] sm:text-[18px]' : 'text-[13px] sm:text-[14px]'} ${item.valor > 0 ? item.cor : 'text-dim'}`}>
            {reais(item.valor)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * As cobranças na Visão geral, logo abaixo dos negócios: cobrança é venda.
 *
 * Aparece sempre que a conta tem cobrança no plano, mesmo vazia. Escondido,
 * ninguém descobria que dava para cobrar pela conversa.
 */
export function ResumoDeCobrancas({
  clienteId,
  cobrancas,
  conectado,
}: {
  clienteId: string
  cobrancas: CobrancaRegistrada[]
  conectado: boolean
}) {
  return (
    <section id="cobrancas" className="app-card overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        <IconeDaSecao tom="ok">{iconeDinheiro}</IconeDaSecao>
        Cobranças
        <span className="flex-1" />
        {cobrancas.length > 0 && (
          <IrParaAba aba="cobrancas" className="text-[11.5px] font-semibold text-primary hover:underline">
            Ver todas
          </IrParaAba>
        )}
      </h2>
      {cobrancas.length === 0 ? (
        <div className="px-[18px] py-4">
          <p className="mb-1 text-[12.5px] font-semibold text-ink">Nenhuma cobrança com esta pessoa.</p>
          <ComoCobrar clienteId={clienteId} conectado={conectado} />
        </div>
      ) : (
        <>
          <Totais cobrancas={cobrancas} />
          <ul className="divide-y divide-line-soft">
            {cobrancas.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-[18px] py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-ink">{c.descricao}</p>
                  <p className="text-[11.5px] text-dim tabular-nums">{quando(c)}</p>
                </div>
                <span className="text-[13px] font-semibold tabular-nums">{reais(c.valorCentavos)}</span>
                <Pilula tom={STATUS[c.status].tom}>{STATUS[c.status].rotulo}</Pilula>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** A aba Cobranças da ficha: os totais e todas as cobranças da pessoa. */
export function AbaDeCobrancas({
  clienteId,
  cobrancas,
  conectado,
}: {
  clienteId: string
  cobrancas: CobrancaRegistrada[]
  conectado: boolean
}) {
  const [copiado, setCopiado] = useState<string | null>(null)

  async function copiar(c: CobrancaRegistrada) {
    if (!c.pixCopiaCola) return
    try {
      await navigator.clipboard.writeText(c.pixCopiaCola)
      setCopiado(c.id)
      setTimeout(() => setCopiado((atual) => (atual === c.id ? null : atual)), 2000)
    } catch {
      setCopiado(null)
    }
  }

  if (cobrancas.length === 0) {
    return (
      <section className="app-card px-[18px] py-6">
        <p className="mb-1 text-[13px] font-semibold text-ink">Nenhuma cobrança com esta pessoa.</p>
        <ComoCobrar clienteId={clienteId} conectado={conectado} />
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Totais cobrancas={cobrancas} grande />
      <section className="app-card overflow-hidden">
        <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
          <IconeDaSecao tom="ok">{iconeDinheiro}</IconeDaSecao>
          Todas as cobranças
          <span className="flex-1" />
          <Link
            href={`/clientes/${clienteId}/leads/cobrancas`}
            className="text-[11.5px] font-semibold text-primary hover:underline"
          >
            Cobranças da conta
          </Link>
        </h2>
        <ul className="divide-y divide-line-soft">
          {cobrancas.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[18px] py-3.5">
              <div className="min-w-0 flex-1 basis-[220px]">
                <p className="truncate text-[13px] font-semibold text-ink">{c.descricao}</p>
                <p className="text-[11.5px] text-dim tabular-nums">
                  {quando(c)} · {ORIGEM[c.origem] ?? 'pela conversa'}
                  {c.origem === 'inbox' && c.criadaPor ? `, por ${c.criadaPor}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {c.status === 'pendente' && c.pixCopiaCola && (
                  <button
                    type="button"
                    onClick={() => void copiar(c)}
                    className="text-[11.5px] font-semibold text-primary hover:underline"
                  >
                    {copiado === c.id ? 'Copiado' : 'Copiar Pix'}
                  </button>
                )}
                {c.status === 'pendente' && c.link && (
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11.5px] font-semibold text-primary hover:underline"
                  >
                    Link de pagamento
                  </a>
                )}
                <span className="w-[92px] text-right text-[13px] font-semibold tabular-nums">{reais(c.valorCentavos)}</span>
                <Pilula tom={STATUS[c.status].tom}>{STATUS[c.status].rotulo}</Pilula>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
