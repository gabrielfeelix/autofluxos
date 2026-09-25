'use client'

import Link from 'next/link'
import { useRef, useState, type ReactNode } from 'react'
import {
  diaDoPrazo,
  paraParametros,
  urgenciaDe,
  type EscalaDaAgenda,
  type FiltroDaAgenda,
  type IntervaloDaVista,
  type Urgencia,
} from '@/core/atividades'
import { horaDoRelogio } from '@/lib/quando'
import type { ItemDaAgenda } from '@/server/repos/atividades'
import { CartaoDaAgenda, IconeDoTipo } from './linha-da-agenda'
import { useAcoesDaAgenda } from './lista-da-agenda'

const DIAS_DA_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

/** Quantas atividades um dia do mês mostra antes do "+N". */
const CABEM_NO_DIA_DO_MES = 3

/** A borda da esquerda diz a urgência; o texto ("vencida") vem no diálogo e na lista. */
const BORDA: Record<Urgencia, string> = {
  vencida: 'border-l-rose-500',
  hoje: 'border-l-amber-400',
  futura: 'border-l-primary/50',
  'sem-prazo': 'border-l-line',
}

/**
 * A agenda como calendário (plano de UX de 23/09, tarefa 1.6).
 *
 * Mesmos filtros, busca e escopo da lista: quem lê é `agendaDoIntervalo`, que
 * usa a mesma preparação de `paginaDaAgenda`. O dia de cada atividade é o dia
 * de `urgenciaDe` (`diaDoPrazo`), então "hoje" no calendário e "hoje" na lista
 * são o mesmo conjunto.
 *
 * Clicar numa atividade abre as mesmas ações da linha (`useAcoesDaAgenda`),
 * num diálogo. Sem prazo não cabe em dia nenhum e fica numa faixa à parte.
 * No celular a grade vira lista por dia: sete colunas em 390 px não se leem.
 */
export function VistaDaAgenda({
  itens,
  semPrazo,
  totalSemPrazo,
  cortado,
  intervalo,
  base,
  filtro,
  agora,
  clienteId,
  volta,
  equipe,
  podeAtribuir,
}: {
  itens: ItemDaAgenda[]
  semPrazo: ItemDaAgenda[]
  totalSemPrazo: number
  cortado: boolean
  intervalo: IntervaloDaVista
  /** `/clientes/<id>/atividades`. */
  base: string
  filtro: FiltroDaAgenda
  agora: number
  clienteId: string
  volta: string
  equipe: { id: string; nome: string }[]
  podeAtribuir: boolean
}) {
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const { acoes, erros, extras, vivos } = useAcoesDaAgenda({
    clienteId,
    equipe,
    podeAtribuir,
    aoSair: (id) => setAbertoId((atual) => (atual === id ? null : atual)),
    volta,
  })

  // Juntas e separadas de novo: reagendar para "sem prazo" (ou tirar dele)
  // muda a atividade de lista no clique.
  const todas = vivos([...itens, ...semPrazo])
  const visiveis = todas.filter((i) => i.prazo)
  const semPrazoVisiveis = todas.filter((i) => !i.prazo)
  const porDia = new Map<string, ItemDaAgenda[]>()
  for (const item of visiveis) {
    const dia = diaDoPrazo(item.prazo!)
    porDia.set(dia, [...(porDia.get(dia) ?? []), item])
  }
  const hoje = new Date(agora).toISOString().slice(0, 10)
  const mesDaReferencia = intervalo.referencia.slice(0, 7)
  const aberto = abertoId ? [...visiveis, ...semPrazoVisiveis].find((i) => i.id === abertoId) ?? null : null

  const abrir = (item: ItemDaAgenda) => setAbertoId(item.id)
  const escala = filtro.escala
  const endereco = (novo: Partial<FiltroDaAgenda>) => {
    const p = paraParametros({ ...filtro, ...novo }).toString()
    return p ? `${base}?${p}` : base
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={endereco({ dia: intervalo.anterior })} aria-label={escala === 'semana' ? 'Semana anterior' : 'Mês anterior'} className="app-secondary-button grid size-9 place-items-center text-[15px]">
            ‹
          </Link>
          <Link href={endereco({ dia: '' })} className="app-secondary-button px-3 py-2 text-[12px]">
            Hoje
          </Link>
          <Link href={endereco({ dia: intervalo.seguinte })} aria-label={escala === 'semana' ? 'Próxima semana' : 'Próximo mês'} className="app-secondary-button grid size-9 place-items-center text-[15px]">
            ›
          </Link>
        </div>
        <h2 className="text-[15px] font-bold first-letter:uppercase">{tituloDoIntervalo(intervalo, escala)}</h2>
        <div role="group" aria-label="Tamanho do calendário" className="ml-auto flex rounded-lg border border-line bg-panel p-0.5">
          {(
            [
              { valor: 'semana', rotulo: 'Semana', href: endereco({ escala: 'semana' }) },
              { valor: 'mes', rotulo: 'Mês', href: endereco({ escala: 'mes' }) },
            ] as const
          ).map((opcao) => (
            <Link
              key={opcao.valor}
              href={opcao.href}
              aria-current={escala === opcao.valor ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
                escala === opcao.valor ? 'bg-primary-weak text-primary' : 'text-muted hover:text-ink'
              }`}
            >
              {opcao.rotulo}
            </Link>
          ))}
        </div>
      </div>

      {cortado && (
        <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2 text-[12px] text-aviso">
          Atividades demais para mostrar de uma vez. Use a semana, a busca ou os filtros para ver todas.
        </p>
      )}

      {totalSemPrazo > 0 && (
        <section aria-label="Sem prazo" className="app-card mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
          <span className="mr-1 text-[11px] font-bold tracking-[0.06em] text-dim uppercase">
            Sem prazo · {totalSemPrazo}
          </span>
          {semPrazoVisiveis.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => abrir(item)}
              className="flex max-w-[240px] items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-[12px] hover:border-strong"
            >
              <IconeDoTipo tipo={item.tipo} className="size-3.5 shrink-0 text-dim" />
              <span className="truncate font-semibold">{item.titulo}</span>
              <span className="truncate text-dim">· {item.contato.nome}</span>
            </button>
          ))}
          {totalSemPrazo > 6 && (
            <Link href={endereco({ vista: 'lista', recorte: 'sem-prazo', pagina: 1 })} className="text-[12px] font-semibold text-primary hover:underline">
              Ver as {totalSemPrazo}
            </Link>
          )}
        </section>
      )}

      {/* Desktop: grade. */}
      <div className="app-card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-line">
          {(escala === 'semana' ? intervalo.dias : intervalo.dias.slice(0, 7)).map((dia, i) => (
            <div key={dia} className="border-r border-line px-3 py-2 last:border-r-0">
              <span className="text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase">{DIAS_DA_SEMANA[i]}</span>
              {escala === 'semana' && (
                <span
                  className={`ml-1.5 text-[13px] font-bold tabular-nums ${dia === hoje ? 'rounded-md bg-primary px-1.5 py-0.5 text-white' : 'text-ink'}`}
                >
                  {Number(dia.slice(8))}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {intervalo.dias.map((dia) => {
            const doDia = porDia.get(dia) ?? []
            const foraDoMes = escala === 'mes' && dia.slice(0, 7) !== mesDaReferencia
            const mostrados = escala === 'mes' ? doDia.slice(0, CABEM_NO_DIA_DO_MES) : doDia
            return (
              <div
                key={dia}
                className={`flex min-w-0 flex-col gap-1 border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0 ${
                  escala === 'semana' ? 'min-h-[440px]' : 'min-h-[118px]'
                } ${foraDoMes ? 'bg-surface/50' : ''} ${dia === hoje && escala === 'mes' ? 'bg-primary/[0.04]' : ''}`}
              >
                {escala === 'mes' && (
                  <span
                    className={`self-start px-1 text-[12px] font-bold tabular-nums ${
                      dia === hoje ? 'rounded-md bg-primary text-white' : foraDoMes ? 'text-dim' : 'text-ink'
                    }`}
                  >
                    {Number(dia.slice(8))}
                  </span>
                )}
                {mostrados.map((item) => (
                  <Bloco key={item.id} item={item} agora={agora} compacto={escala === 'mes'} aoAbrir={abrir} />
                ))}
                {escala === 'mes' && doDia.length > CABEM_NO_DIA_DO_MES && (
                  <Link
                    href={endereco({ escala: 'semana', dia })}
                    className="px-1 text-[11.5px] font-semibold text-primary hover:underline"
                  >
                    +{doDia.length - CABEM_NO_DIA_DO_MES} mais
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Celular: lista por dia. */}
      <div className="flex flex-col gap-3 md:hidden">
        {intervalo.dias
          .filter((dia) => (escala === 'semana' ? true : (porDia.get(dia)?.length ?? 0) > 0))
          .map((dia) => {
            const doDia = porDia.get(dia) ?? []
            return (
              <section key={dia} aria-label={rotuloDoDia(dia, hoje)}>
                <h3 className={`mb-1.5 text-[12px] font-bold ${dia === hoje ? 'text-primary' : 'text-soft'}`}>
                  {rotuloDoDia(dia, hoje)}
                </h3>
                {doDia.length === 0 ? (
                  <p className="text-[12px] text-dim">Nada marcado.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {doDia.map((item) => (
                      <Bloco key={item.id} item={item} agora={agora} aoAbrir={abrir} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        {escala === 'mes' && visiveis.length === 0 && <p className="text-[12.5px] text-dim">Nada marcado neste mês.</p>}
      </div>

      {aberto && (
        <DialogoDaAtividade aoFechar={() => setAbertoId(null)}>
          <ul>
            <CartaoDaAgenda
              item={aberto}
              agora={agora}
              clienteId={clienteId}
              volta={volta}
              acoes={acoes(aberto)}
              erro={erros[aberto.id] ?? null}
            />
          </ul>
        </DialogoDaAtividade>
      )}

      {extras}
    </>
  )
}

function Bloco({
  item,
  agora,
  compacto = false,
  aoAbrir,
}: {
  item: ItemDaAgenda
  agora: number
  compacto?: boolean
  aoAbrir: (item: ItemDaAgenda) => void
}) {
  const resolvida = item.situacao !== 'aberta'
  const hora = item.horaMarcada && item.prazo ? horaDoRelogio(item.prazo) : null
  return (
    <button
      type="button"
      onClick={() => aoAbrir(item)}
      aria-label={`${item.titulo}, ${item.contato.nome}${hora ? `, às ${hora}` : ''}`}
      className={`w-full min-w-0 rounded-md border border-l-[3px] border-line bg-panel px-2 text-left transition hover:border-strong hover:bg-surface ${
        resolvida ? 'border-l-line opacity-70' : BORDA[urgenciaDe(item, agora)]
      } ${compacto ? 'py-1' : 'py-1.5'}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {hora && <span className="shrink-0 text-[11px] font-semibold text-muted tabular-nums">{hora}</span>}
        <IconeDoTipo tipo={item.tipo} className="size-3.5 shrink-0 text-dim" />
        <span className={`truncate text-[12px] font-semibold ${resolvida ? 'text-dim line-through' : 'text-ink'}`}>
          {item.titulo}
        </span>
      </span>
      {!compacto && <span className="block truncate text-[11px] text-dim">{item.contato.nome}</span>}
    </button>
  )
}

function DialogoDaAtividade({ aoFechar, children }: { aoFechar: () => void; children: ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const abriu = useRef(false)
  return (
    <dialog
      ref={(no) => {
        dialogo.current = no
        if (no && !abriu.current) {
          abriu.current = true
          no.showModal()
        }
      }}
      aria-label="Atividade"
      onClose={aoFechar}
      onClick={(evento) => {
        if (evento.target === dialogo.current) dialogo.current?.close()
      }}
      className="app-dialog m-auto w-[520px] max-w-[calc(100vw-32px)] overflow-visible rounded-[18px] border border-line bg-panel p-2 text-ink shadow-[0_40px_100px_rgba(19,25,34,0.132)]"
    >
      {children}
      <div className="flex justify-end px-4 pb-2">
        <button type="button" onClick={() => dialogo.current?.close()} className="app-secondary-button px-4 py-2 text-[12.5px]">
          Fechar
        </button>
      </div>
    </dialog>
  )
}

const MESES = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
const MES_E_ANO = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

function tituloDoIntervalo(intervalo: IntervaloDaVista, escala: EscalaDaAgenda): string {
  if (escala === 'mes') return MES_E_ANO.format(new Date(`${intervalo.referencia}T00:00:00Z`))
  const de = new Date(`${intervalo.dias[0]}T00:00:00Z`)
  const ate = new Date(`${intervalo.dias.at(-1)}T00:00:00Z`)
  const mesDe = MESES.format(de)
  const mesAte = MESES.format(ate)
  return mesDe === mesAte
    ? `${de.getUTCDate()} a ${ate.getUTCDate()} de ${mesAte} de ${ate.getUTCFullYear()}`
    : `${de.getUTCDate()} de ${mesDe} a ${ate.getUTCDate()} de ${mesAte} de ${ate.getUTCFullYear()}`
}

const DIA_LONGO = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' })

function rotuloDoDia(dia: string, hoje: string): string {
  const texto = DIA_LONGO.format(new Date(`${dia}T00:00:00Z`))
  const comMaiuscula = texto.charAt(0).toUpperCase() + texto.slice(1)
  return dia === hoje ? `${comMaiuscula} · hoje` : comMaiuscula
}
