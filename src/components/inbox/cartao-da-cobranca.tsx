'use client'

import { useEffect, useState } from 'react'
import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import { IconeCobrar } from '@/components/lead/icones-da-barra'
import type { CobrancaNaMensagem } from '@/server/repos/leads'
import { acaoCancelarCobranca, acaoStatusDasCobrancas } from '@/server/acoes-cobrancas'

const STATUS: Record<CobrancaNaMensagem['status'], { rotulo: string; tom: TomDaPilula }> = {
  pendente: { rotulo: 'Aguardando', tom: 'aviso' },
  paga: { rotulo: 'Paga', tom: 'ok' },
  vencida: { rotulo: 'Vencida', tom: 'neutro' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutro' },
  estornada: { rotulo: 'Estornada', tom: 'perigo' },
}

/** Enquanto aguarda, confere a cada 15 segundos com a aba visível. */
const INTERVALO_MS = 15_000

const DATA_E_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const reais = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * A cobrança na conversa como cartão, e não como o texto que o cliente leu.
 *
 * Quem atende precisa saber, sem abrir a ficha, se o Pix daquela mensagem foi
 * pago. O selo muda sozinho: enquanto aguarda, o cartão pergunta o status
 * (o aviso de pagamento chega pelo gateway, e o Inbox não tem outro sinal
 * dele). Cancelar muda na hora e volta se o servidor recusar.
 */
export function CartaoDaCobranca({
  clienteId,
  contatoId,
  cobranca,
  rodape,
}: {
  clienteId: string
  contatoId: string
  cobranca: CobrancaNaMensagem
  rodape: React.ReactNode
}) {
  const [status, setStatus] = useState(cobranca.status)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  // Cancelar fecha o Pix no gateway e não volta: o primeiro toque só pergunta.
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    if (!confirmando) return
    const t = setTimeout(() => setConfirmando(false), 4000)
    return () => clearTimeout(t)
  }, [confirmando])

  // O servidor redesenhou com outro status (pagou com a conversa aberta): vale o dele.
  const [doServidor, setDoServidor] = useState(cobranca.status)
  if (doServidor !== cobranca.status) {
    setDoServidor(cobranca.status)
    setStatus(cobranca.status)
  }

  useEffect(() => {
    if (status !== 'pendente') return
    const conferir = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const lido = (await acaoStatusDasCobrancas(clienteId, contatoId, [cobranca.id]))[cobranca.id]
        if (lido) setStatus(lido)
      } catch {
        // Rede caiu: a próxima volta tenta de novo.
      }
    }
    const t = setInterval(() => void conferir(), INTERVALO_MS)
    return () => clearInterval(t)
  }, [status, clienteId, contatoId, cobranca.id])

  async function copiarPix() {
    if (!cobranca.pixCopiaCola) return
    try {
      await navigator.clipboard.writeText(cobranca.pixCopiaCola)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      setErro('Não foi possível copiar.')
    }
  }

  async function cancelar() {
    if (cancelando) return
    if (!confirmando) {
      setConfirmando(true)
      return
    }
    setConfirmando(false)
    const antes = status
    setCancelando(true)
    setStatus('cancelada')
    setErro(null)
    try {
      const r = await acaoCancelarCobranca(clienteId, cobranca.id)
      if (r.ok) setStatus(r.status)
      else {
        setStatus(antes)
        setErro(r.erro)
      }
    } catch {
      setStatus(antes)
      setErro('Não foi possível cancelar agora.')
    } finally {
      setCancelando(false)
    }
  }

  const selo = STATUS[status]
  const quando =
    status === 'paga' && cobranca.pagaEm
      ? `Paga em ${DATA_E_HORA.format(new Date(cobranca.pagaEm))}`
      : status === 'pendente'
        ? `Vence em ${DATA_E_HORA.format(new Date(cobranca.venceEm))}`
        : null

  return (
    <div className="w-[300px] max-w-[85%] overflow-hidden rounded-[15px_15px_4px_15px] border border-line bg-panel font-texto text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-soft [&_svg]:size-4">
          <IconeCobrar />
          Cobrança
        </span>
        <Pilula tom={selo.tom}>{selo.rotulo}</Pilula>
      </div>

      <div className="px-3 pt-1.5 pb-2 [overflow-wrap:anywhere]">
        <p className="text-[14px] leading-[1.35] font-semibold">{cobranca.descricao}</p>
        {cobranca.itens.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {cobranca.itens.map((item, i) => (
              <li key={`${item.nome}-${i}`} className="flex items-baseline justify-between gap-3 text-[12.5px] leading-[1.4] text-soft">
                <span className="min-w-0">
                  <span className="tabular-nums">{item.quantidade}×</span> {item.nome}
                </span>
                <span className="shrink-0 tabular-nums">{reais(item.valorCentavos * item.quantidade)}</span>
              </li>
            ))}
          </ul>
        )}
        <div
          className={`flex items-baseline justify-between gap-3 ${cobranca.itens.length > 0 ? 'mt-1.5 border-t border-line pt-1.5' : 'mt-1'}`}
        >
          <span className="text-[12.5px] text-soft">Total</span>
          <span className="text-[15px] font-bold tabular-nums">{reais(cobranca.valorCentavos)}</span>
        </div>
        {quando && <p className="mt-0.5 text-[11.5px] text-dim">{quando}</p>}
        {erro && (
          <p role="alert" className="mt-1 text-[12px] text-perigo">
            {erro}
          </p>
        )}
        <div className="mt-1 text-right text-[11px] text-muted">{rodape}</div>
      </div>

      {status === 'pendente' && (
        <div className="flex border-t border-line text-[12.5px] font-semibold">
          {cobranca.pixCopiaCola && (
            <button type="button" onClick={() => void copiarPix()} className="flex-1 py-2 text-primary transition hover:bg-surface-strong">
              {copiado ? 'Copiado' : 'Copiar Pix'}
            </button>
          )}
          {cobranca.link && (
            <a
              href={cobranca.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 border-l border-line py-2 text-center text-primary transition hover:bg-surface-strong first:border-l-0"
            >
              Abrir link
            </a>
          )}
          <button
            type="button"
            onClick={() => void cancelar()}
            disabled={cancelando}
            className={`flex-1 border-l border-line py-2 transition hover:bg-surface-strong first:border-l-0 disabled:opacity-60 ${
              confirmando ? 'text-perigo' : 'text-soft hover:text-perigo'
            }`}
          >
            {confirmando ? 'Cancelar mesmo?' : 'Cancelar'}
          </button>
        </div>
      )}
    </div>
  )
}
