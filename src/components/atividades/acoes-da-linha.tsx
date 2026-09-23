'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SeletorDePessoa } from './seletor-de-pessoa'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { horaDoRelogio } from '@/lib/quando'
import type { ItemDaAgenda } from '@/server/repos/atividades'

export type PedidoDaLinha =
  | { tipo: 'concluir' }
  | { tipo: 'reabrir' }
  | { tipo: 'cancelar' }
  | { tipo: 'reagendar'; dia: string; hora: string }
  | { tipo: 'atribuir'; responsavelId: string }

/** `AAAA-MM-DD` no relógio de quem usa, que é o dia que a pessoa quer dizer. */
function diaLocal(data: Date): string {
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${m}-${d}`
}

function atalhosDeDia(): { rotulo: string; dia: string }[] {
  const hoje = new Date()
  const amanha = new Date(hoje)
  amanha.setDate(hoje.getDate() + 1)
  const segunda = new Date(hoje)
  segunda.setDate(hoje.getDate() + (((8 - hoje.getDay()) % 7) || 7))
  return [
    { rotulo: 'Hoje', dia: diaLocal(hoje) },
    { rotulo: 'Amanhã', dia: diaLocal(amanha) },
    { rotulo: 'Próxima segunda', dia: diaLocal(segunda) },
  ]
}

/**
 * Concluir, reagendar e o menu `⋯` de uma linha da agenda.
 *
 * Quem executa é a lista (`ListaDaAgenda`), que guarda o estado de pendente,
 * de erro e o "Desfazer". Aqui só se pede.
 */
export function AcoesDaLinha({
  item,
  clienteId,
  equipe,
  podeAtribuir,
  pendente,
  aoPedir,
}: {
  item: ItemDaAgenda
  clienteId: string
  equipe: { id: string; nome: string }[]
  podeAtribuir: boolean
  /** O texto do botão enquanto a ação roda ("Concluindo…"), ou `null`. */
  pendente: string | null
  aoPedir: (pedido: PedidoDaLinha) => void
}) {
  const aberta = item.situacao === 'aberta'
  const [dia, setDia] = useState(item.prazo ? item.prazo.slice(0, 10) : '')
  const [hora, setHora] = useState(item.horaMarcada && item.prazo ? horaDoRelogio(item.prazo) : '')
  const ocupado = pendente !== null
  const [atribuindo, setAtribuindo] = useState(false)

  return (
    <div className="flex items-center justify-end gap-1.5">
      {aberta ? (
        <>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => aoPedir({ tipo: 'concluir' })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 text-[12px] font-semibold text-ok transition hover:bg-emerald-500/[0.14] disabled:cursor-wait disabled:opacity-60"
          >
            <span aria-hidden>✓</span>
            {pendente ?? 'Concluir'}
          </button>
          <PopoverDoQuadro
            rotulo={`Reagendar ${item.titulo}`}
            largura={272}
            gatilho={<span className="text-[12px] font-semibold">Reagendar</span>}
          >
            <form
              onSubmit={(evento) => {
                evento.preventDefault()
                aoPedir({ tipo: 'reagendar', dia, hora })
              }}
              className="flex flex-col gap-2.5 p-1.5"
            >
              <p className="quadro-menu-label px-0">Novo prazo</p>
              <div className="flex flex-wrap gap-1.5">
                {atalhosDeDia().map((atalho) => (
                  <button
                    key={atalho.rotulo}
                    type="button"
                    aria-pressed={dia === atalho.dia}
                    onClick={() => setDia(atalho.dia)}
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
                      dia === atalho.dia ? 'border-primary/40 bg-primary/10 text-primary' : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {atalho.rotulo}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dia}
                  onChange={(e) => setDia(e.currentTarget.value)}
                  aria-label="Dia"
                  className="app-field flex-[1.4] px-2 py-2 text-[12px]"
                />
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.currentTarget.value)}
                  aria-label="Hora (opcional)"
                  className="app-field flex-1 px-2 py-2 text-[12px]"
                />
              </div>
              <p className="text-[11px] leading-4 text-dim">Hora é opcional. Sem dia, vira &quot;algum dia&quot;.</p>
              <button type="submit" data-fechar-popover className="app-primary-button px-3 py-2 text-[12px]">
                Salvar prazo
              </button>
            </form>
          </PopoverDoQuadro>
        </>
      ) : (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => aoPedir({ tipo: 'reabrir' })}
          className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-[12px] font-semibold text-muted transition hover:text-ink disabled:opacity-60"
        >
          {pendente ?? 'Reabrir'}
        </button>
      )}

      <PopoverDoQuadro rotulo={`Mais ações para ${item.titulo}`} largura={240} gatilho={<span aria-hidden className="px-0.5 text-[14px] leading-none">⋯</span>}>
        <Link href={`/clientes/${clienteId}/leads/${item.contatoId}`} className="quadro-menu-item">
          Abrir contato
        </Link>
        <Link href={`/clientes/${clienteId}/inbox?conversa=${item.contatoId}`} className="quadro-menu-item">
          Abrir conversa
        </Link>
        {aberta && podeAtribuir && (
          <button
            type="button"
            data-fechar-popover
            disabled={ocupado}
            onClick={() => setAtribuindo(true)}
            className="quadro-menu-item mt-1 border-t border-line"
          >
            Atribuir tarefa…
          </button>
        )}
        {aberta && (
          <button
            type="button"
            data-fechar-popover
            disabled={ocupado}
            onClick={() => aoPedir({ tipo: 'cancelar' })}
            className="quadro-menu-item quadro-danger mt-1 border-t border-line text-perigo"
          >
            Cancelar atividade…
          </button>
        )}
      </PopoverDoQuadro>

      {atribuindo && (
        <SeletorDePessoa
          titulo="Atribuir tarefa"
          pessoas={equipe}
          fixas={[{ id: '', nome: 'Ninguém' }]}
          atual={item.responsavelId ?? ''}
          aoEscolher={(id) => {
            if (id !== (item.responsavelId ?? '')) aoPedir({ tipo: 'atribuir', responsavelId: id })
          }}
          aoFechar={() => setAtribuindo(false)}
        />
      )}
    </div>
  )
}
