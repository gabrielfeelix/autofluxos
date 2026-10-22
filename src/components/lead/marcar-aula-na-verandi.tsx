'use client'

import { useEffect, useState } from 'react'
import { rotuloDoDia, type HorarioLivre } from '@/core/formulario-de-agendamento'
import { acaoHorariosParaMarcar } from '@/server/acoes-ponte-verandi'

/**
 * O escolhido, em azul cheio. Pelo `--p-primary` e não pelo `primary`: o
 * cartão mora na casca da ficha, onde os tokens de uso viram branco, e um
 * escolhido claro sobre o azul some.
 */
const SELECIONADO = 'border-transparent bg-[var(--p-primary)] text-white shadow-sm'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** `2026-10-23` vira `sex` e `23/10`, as duas linhas do botão do dia. */
function partesDoDia(data: string): { semana: string; dia: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data)
  if (!m) return { semana: '', dia: data }
  return { semana: DIAS[new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, 12)).getUTCDay()]!, dia: `${m[3]}/${m[2]}` }
}

/**
 * Escolher o horário de uma aula, dentro do cartão "Na Verandi": os próximos
 * 7 dias que têm vaga, e os horários do dia escolhido. Só a modalidade do
 * aluno quando ele faz uma. Quem marca de fato é o cartão (`onMarcar`), que
 * atualiza a lista na hora.
 */
export function MarcarAulaNaVerandi({
  clienteId,
  contatoId,
  reposicao,
  modalidade,
  erroAoMarcar,
  onMarcar,
  onFechar,
}: {
  clienteId: string
  contatoId: string
  /** O aluno tem reposição em aberto: esta aula repõe a falta mais antiga. */
  reposicao: boolean
  modalidade: string | null
  /** A frase da Verandi quando a última tentativa não marcou (409). */
  erroAoMarcar: string | null
  onMarcar: (horario: HorarioLivre) => void
  onFechar: () => void
}) {
  const [lido, setLido] = useState<{ horarios: HorarioLivre[] } | { erro: string } | null>(null)
  const [dia, setDia] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState<HorarioLivre | null>(null)

  // Lê de novo quando a marcação falha: a vaga que acabou não pode continuar na lista.
  useEffect(() => {
    let vivo = true
    acaoHorariosParaMarcar(clienteId, contatoId)
      .then((r) => vivo && setLido(r.ok ? { horarios: r.horarios } : { erro: r.erro }))
      .catch(() => vivo && setLido({ erro: 'A Verandi não respondeu agora. Tente de novo em instantes.' }))
    return () => {
      vivo = false
    }
  }, [clienteId, contatoId, erroAoMarcar])

  const horarios = lido && 'horarios' in lido ? lido.horarios : []
  const dias = [...new Set(horarios.map((h) => h.data))]
  const diaAtivo = dia && dias.includes(dia) ? dia : (dias[0] ?? null)
  const doDia = horarios.filter((h) => h.data === diaAtivo)

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <div className="flex items-center gap-2">
        <p className="text-[12px] font-bold text-ink">{reposicao ? 'Marcar reposição' : 'Marcar aula avulsa'}</p>
        {modalidade && <span className="truncate text-[11.5px] text-dim">{modalidade}</span>}
        <span className="flex-1" />
        <button type="button" onClick={onFechar} className="text-[11.5px] font-semibold text-dim hover:text-ink">
          Fechar
        </button>
      </div>

      {erroAoMarcar && (
        <p role="status" className="mt-2 rounded-[9px] border border-rose-400/40 bg-panel px-2.5 py-2 text-[11.5px] leading-4 text-perigo">
          {erroAoMarcar}
        </p>
      )}

      {!lido ? (
        <div className="mt-2.5 space-y-2" aria-hidden>
          <div className="h-[44px] animate-pulse rounded-[9px] bg-line-soft/60" />
          <div className="h-[34px] animate-pulse rounded-[9px] bg-line-soft/60" />
        </div>
      ) : 'erro' in lido ? (
        <p className="mt-2 text-[11.5px] leading-4 text-perigo">{lido.erro}</p>
      ) : dias.length === 0 ? (
        <p className="mt-2 text-[11.5px] leading-4 text-dim">Nenhum horário com vaga nos próximos 7 dias.</p>
      ) : (
        <>
          <div className="-mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 py-1" role="tablist" aria-label="Dia">
            {dias.map((d) => {
              const { semana, dia: dm } = partesDoDia(d)
              const ativo = d === diaAtivo
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => {
                    setDia(d)
                    setEscolhido(null)
                  }}
                  className={`flex min-w-[48px] shrink-0 flex-col items-center rounded-[9px] border px-2 py-1.5 leading-tight transition-colors ${
                    ativo ? SELECIONADO : 'border-line bg-panel text-soft hover:border-primary/40'
                  }`}
                >
                  <span className="text-[10.5px] font-semibold uppercase">{semana}</span>
                  <span className="text-[12px] font-bold">{dm}</span>
                </button>
              )
            })}
          </div>

          <ul className="mt-2 grid gap-1">
            {doDia.map((h) => {
              const ativo = escolhido?.sessaoId === h.sessaoId
              const detalhe = [h.profissional ? `com ${h.profissional}` : null, h.livres ? `${h.livres} ${h.livres === 1 ? 'vaga' : 'vagas'}` : null]
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={h.sessaoId}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setEscolhido(ativo ? null : h)}
                    className={`flex w-full items-center gap-2.5 rounded-[9px] border px-2.5 py-2 text-left transition-colors ${
                      ativo ? SELECIONADO : 'border-line-soft bg-panel hover:border-primary/40'
                    }`}
                  >
                    <span className={`text-[12.5px] font-bold tabular-nums ${ativo ? '' : 'text-ink'}`}>{h.hora}</span>
                    <span className="min-w-0 flex-1">
                      {!modalidade && h.servico && <span className={`block truncate text-[11.5px] font-semibold ${ativo ? 'opacity-90' : 'text-soft'}`}>{h.servico}</span>}
                      {detalhe && <span className={`block truncate text-[11px] ${ativo ? 'opacity-85' : 'text-dim'}`}>{detalhe}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            disabled={!escolhido}
            onClick={() => escolhido && onMarcar(escolhido)}
            className="botao-primario botao-sm mt-2.5 w-full"
          >
            {escolhido ? `Marcar ${rotuloDoDia(escolhido.data).toLowerCase()} às ${escolhido.hora}` : 'Escolha um horário'}
          </button>
        </>
      )}
    </div>
  )
}
