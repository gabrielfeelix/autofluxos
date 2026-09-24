'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Modal } from '@/components/design/modal'
import { diaCurto, diasEntre, MAXIMO_DE_DIAS } from '@/core/relatorios'

/**
 * O "Personalizado" da barra de período: um botão que abre um modal com De e
 * Até, em vez de um formulário que se abria no meio da barra e empurrava tudo.
 *
 * Aplicar muda o endereço (`?de=&ate=`), como os atalhos: o período escolhido
 * continua podendo ser salvo e mandado para alguém.
 */
export function PeriodoPersonalizado({
  base,
  manter,
  de,
  ate,
  hoje,
  ativo,
}: {
  base: string
  manter: Record<string, string>
  de: string
  ate: string
  hoje: string
  ativo: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [inicio, setInicio] = useState(de)
  const [fim, setFim] = useState(ate)

  const ano = hoje.slice(0, 4)
  const mes = hoje.slice(0, 7)
  const mesPassado = (() => {
    const d = new Date(`${mes}-01T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - 1)
    return d.toISOString().slice(0, 7)
  })()
  const ultimoDia = (m: string) => {
    const d = new Date(`${m}-01T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + 1)
    d.setUTCDate(0)
    return d.toISOString().slice(0, 10)
  }
  const sugestoes = [
    { rotulo: 'Este mês', de: `${mes}-01`, ate: hoje },
    { rotulo: 'Mês passado', de: `${mesPassado}-01`, ate: ultimoDia(mesPassado) },
    { rotulo: 'Este ano', de: `${ano}-01-01`, ate: hoje },
  ]

  const valido = Boolean(inicio && fim)
  const dias = valido ? diasEntre(inicio, fim) : 0
  const erro = !valido
    ? 'Escolha as duas datas.'
    : inicio > fim
      ? 'O início precisa vir antes do fim.'
      : fim > hoje
        ? 'O fim não pode passar de hoje.'
        : dias > MAXIMO_DE_DIAS
          ? `O período cabe em até ${MAXIMO_DE_DIAS} dias.`
          : null

  function abrir() {
    setInicio(de)
    setFim(ate)
    setAberto(true)
  }

  function aplicar() {
    if (erro) return
    setAberto(false)
    router.push(`${base}?${new URLSearchParams({ ...manter, de: inicio, ate: fim }).toString()}`)
  }

  const cruza = de.slice(0, 4) !== ate.slice(0, 4) || de.slice(0, 4) !== ano

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={`inline-flex h-[38px] items-center gap-2 rounded-lg border px-3 text-[12.5px] font-semibold whitespace-nowrap transition ${
          ativo
            ? 'border-primary/40 bg-primary-weak text-primary'
            : 'border-line bg-panel text-dim hover:border-strong hover:text-ink'
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" strokeLinecap="round" />
        </svg>
        {ativo ? `${diaCurto(de, cruza)} a ${diaCurto(ate, cruza)}` : 'Personalizado'}
      </button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Escolher período"
        descricao="Qualquer intervalo até hoje, com até um ano. Os dias são os de Brasília."
        largura={440}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            aplicar()
          }}
        >
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((s) => {
              const escolhida = s.de === inicio && s.ate === fim
              return (
                <button
                  key={s.rotulo}
                  type="button"
                  onClick={() => {
                    setInicio(s.de)
                    setFim(s.ate)
                  }}
                  className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                    escolhida
                      ? 'border-primary bg-primary text-primary-ink'
                      : 'border-line text-soft hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  {s.rotulo}
                </button>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted">
              De
              <input
                type="date"
                value={inicio}
                max={fim || hoje}
                onChange={(e) => setInicio(e.target.value)}
                className="app-field h-10 px-3 text-[13.5px] font-normal"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted">
              Até
              <input
                type="date"
                value={fim}
                min={inicio || undefined}
                max={hoje}
                onChange={(e) => setFim(e.target.value)}
                className="app-field h-10 px-3 text-[13.5px] font-normal"
              />
            </label>
          </div>

          <p className={`mt-3 text-[12px] ${erro ? 'text-aviso' : 'text-dim'}`} aria-live="polite">
            {erro ?? `${dias} ${dias === 1 ? 'dia' : 'dias'}, comparado com os ${dias} ${dias === 1 ? 'dia' : 'dias'} logo antes.`}
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="h-9 rounded-lg px-4 text-[13px] font-semibold text-soft hover:bg-surface-strong"
            >
              Cancelar
            </button>
            <button type="submit" disabled={Boolean(erro)} className="app-primary-button h-9 px-4 text-[13px] disabled:opacity-50">
              Aplicar
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
