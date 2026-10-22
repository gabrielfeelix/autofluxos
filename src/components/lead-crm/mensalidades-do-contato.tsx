'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import { ANTECEDENCIA_PADRAO, DIA_MAXIMO, type StatusDeMensalidade } from '@/core/mensalidade'
import { acaoCriarMensalidade, acaoMudarMensalidade } from '@/server/acoes-mensalidades'
import type { Assinatura } from '@/server/repos/assinaturas'
import { IconeDaSecao, iconeDinheiro } from './icones'

export type PlanoParaMensalidade = { id: string; nome: string; preco: number }

const STATUS: Record<StatusDeMensalidade, { rotulo: string; tom: TomDaPilula }> = {
  ativa: { rotulo: 'Ativa', tom: 'ok' },
  aguardando: { rotulo: 'Aguardando adesão', tom: 'aviso' },
  pausada: { rotulo: 'Pausada', tom: 'neutro' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutro' },
}

const reais = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const LIVRE = '__livre'

/**
 * As mensalidades da pessoa, na aba Cobranças da ficha (0145).
 *
 * Todo mês, alguns dias antes do vencimento, o Pix sai sozinho na conversa;
 * quem não conversa há mais de 24 horas recebe pelo modelo de lembrete. O
 * plano vem do catálogo com o preço dele, ou em valor livre.
 *
 * Pausar, retomar e cancelar mudam na hora e voltam se o servidor recusar.
 */
export function MensalidadesDoContato({
  clienteId,
  contatoId,
  iniciais,
  planos,
  conectado,
}: {
  clienteId: string
  contatoId: string
  iniciais: Assinatura[]
  planos: PlanoParaMensalidade[]
  conectado: boolean
}) {
  const [lista, setLista] = useState(iniciais)
  const [criando, setCriando] = useState(false)
  const [plano, setPlano] = useState(planos[0]?.id ?? LIVRE)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dia, setDia] = useState(10)
  const [antecedencia, setAntecedencia] = useState(ANTECEDENCIA_PADRAO)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const visiveis = lista.filter((a) => a.status !== 'cancelada')
  const livre = plano === LIVRE

  async function criar() {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await acaoCriarMensalidade(clienteId, contatoId, {
        ...(livre ? { valor, descricao } : { produtoId: plano }),
        dia,
        antecedencia,
      })
      if (!r.ok) return setErro(r.erro)
      setLista((atual) => [r.assinatura, ...atual])
      setCriando(false)
      setValor('')
      setDescricao('')
      setAviso(r.cobrouAgora ? 'A cobrança deste mês já saiu na conversa.' : null)
    } catch {
      setErro('Não foi possível criar agora. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  async function mudar(a: Assinatura, acao: 'pausar' | 'retomar' | 'cancelar') {
    const antes = a.status
    const otimista: StatusDeMensalidade = acao === 'pausar' ? 'pausada' : acao === 'retomar' ? 'ativa' : 'cancelada'
    setLista((atual) => atual.map((x) => (x.id === a.id ? { ...x, status: otimista } : x)))
    setErro(null)
    try {
      const r = await acaoMudarMensalidade(clienteId, a.id, acao)
      const final = r.ok ? r.status : antes
      if (!r.ok) setErro(r.erro)
      setLista((atual) => atual.map((x) => (x.id === a.id ? { ...x, status: final } : x)))
    } catch {
      setErro('Não foi possível mudar agora.')
      setLista((atual) => atual.map((x) => (x.id === a.id ? { ...x, status: antes } : x)))
    }
  }

  return (
    <section className="app-card overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        <IconeDaSecao tom="ok">{iconeDinheiro}</IconeDaSecao>
        Mensalidades
        <span className="flex-1" />
        {conectado && !criando && (
          <button type="button" onClick={() => setCriando(true)} className="text-[11.5px] font-semibold text-primary hover:underline">
            Nova mensalidade
          </button>
        )}
      </h2>

      {!conectado ? (
        <p className="px-[18px] py-4 text-[12px] leading-5 text-dim">
          Cobre todo mês sem lembrar: o Pix sai sozinho na conversa antes do vencimento.{' '}
          <Link href={`/clientes/${clienteId}/ajustes/pagamentos`} className="font-semibold text-primary hover:underline">
            Conectar conta de recebimento
          </Link>
        </p>
      ) : (
        <>
          {criando && (
            <div className="flex flex-col gap-2.5 border-b border-line-soft px-[18px] py-4">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-soft">Plano</span>
                <select value={plano} onChange={(e) => setPlano(e.target.value)} className="app-field h-9 px-2.5 text-[13px]">
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} · {reais(Math.round(p.preco * 100))}
                    </option>
                  ))}
                  <option value={LIVRE}>Valor livre</option>
                </select>
              </label>
              {livre && (
                <div className="grid gap-2.5 sm:grid-cols-[1fr_140px]">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-semibold text-soft">Descrição</span>
                    <input
                      value={descricao}
                      maxLength={160}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Exemplo: Pilates 2x por semana"
                      className="app-field h-9 px-2.5 text-[13px]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-semibold text-soft">Valor por mês</span>
                    <span className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[12.5px] text-dim">R$</span>
                      <input
                        inputMode="decimal"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder="Exemplo: 280,00"
                        className="app-field h-9 w-full pr-2.5 pl-8 text-[13px] tabular-nums"
                      />
                    </span>
                  </label>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1">
                  <span className="text-[11.5px] font-semibold text-soft">Vence todo dia</span>
                  <select value={dia} onChange={(e) => setDia(Number(e.target.value))} className="app-field h-9 px-2.5 text-[13px] tabular-nums">
                    {Array.from({ length: DIA_MAXIMO }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11.5px] font-semibold text-soft">Cobrança sai</span>
                  <select
                    value={antecedencia}
                    onChange={(e) => setAntecedencia(Number(e.target.value))}
                    className="app-field h-9 px-2.5 text-[13px]"
                  >
                    {[0, 1, 2, 3, 5, 7, 10].map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'no dia' : `${n} ${n === 1 ? 'dia' : 'dias'} antes`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-[11.5px] leading-4 text-dim">
                Pix e link na conversa, todo mês. Se a pessoa não conversa há mais de 24 horas, vai pelo modelo de
                lembrete, criado em Ajustes &gt; Pagamentos.
              </p>
              {erro && (
                <p role="alert" className="text-[12px] text-perigo">
                  {erro}
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => void criar()} disabled={enviando} className="botao-primario botao-md">
                  {enviando ? 'Criando…' : 'Criar mensalidade'}
                </button>
                <button type="button" onClick={() => setCriando(false)} className="botao-secundario botao-md">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {aviso && <p className="border-b border-line-soft px-[18px] py-2.5 text-[12px] font-semibold text-ok">{aviso}</p>}
          {!criando && erro && (
            <p role="alert" className="border-b border-line-soft px-[18px] py-2.5 text-[12px] text-perigo">
              {erro}
            </p>
          )}

          {visiveis.length === 0 && !criando ? (
            <p className="px-[18px] py-4 text-[12px] leading-5 text-dim">
              Nenhuma mensalidade. Crie uma e o Pix sai sozinho na conversa todo mês, antes do vencimento.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {visiveis.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[18px] py-3.5">
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <p className="truncate text-[13px] font-semibold text-ink">{a.descricao}</p>
                    <p className="text-[11.5px] text-dim tabular-nums">
                      {reais(a.valorCentavos)} por mês · vence todo dia {a.diaDoVencimento}
                    </p>
                  </div>
                  <Pilula tom={STATUS[a.status].tom}>{STATUS[a.status].rotulo}</Pilula>
                  <span className="flex gap-3 text-[12px] font-semibold">
                    {a.status === 'ativa' && (
                      <button type="button" onClick={() => void mudar(a, 'pausar')} className="text-soft hover:text-ink">
                        Pausar
                      </button>
                    )}
                    {a.status === 'pausada' && (
                      <button type="button" onClick={() => void mudar(a, 'retomar')} className="text-primary hover:underline">
                        Retomar
                      </button>
                    )}
                    <BotaoDeCancelar aoConfirmar={() => void mudar(a, 'cancelar')} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** Cancelar não volta: o primeiro toque só pergunta. */
function BotaoDeCancelar({ aoConfirmar }: { aoConfirmar: () => void }) {
  const [confirmando, setConfirmando] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        if (confirmando) {
          setConfirmando(false)
          aoConfirmar()
        } else {
          setConfirmando(true)
          setTimeout(() => setConfirmando(false), 4000)
        }
      }}
      className={confirmando ? 'text-perigo' : 'text-soft hover:text-perigo'}
    >
      {confirmando ? 'Cancelar mesmo?' : 'Cancelar'}
    </button>
  )
}
