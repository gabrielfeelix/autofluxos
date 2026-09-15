'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { comoDinheiro, comoFrase, type Evento } from '@/core/crm'
import { acaoAbrirPainelDoContato } from '@/server/acoes-crm'

/**
 * O painel lateral do contato.
 *
 * **Abrir o perfil não pode tirar a pessoa do quadro.** Era o que acontecia: o
 * nome do cartão era um link para a página de lead, e conferir quem é alguém
 * custava perder a visão do funil e a rolagem de cada coluna. O painel resolve
 * isso do jeito que o RD resolve — dado à esquerda, histórico à direita, quadro
 * ainda visível atrás.
 *
 * O conteúdo vem sob demanda, e não com a página: carregar linha do tempo de
 * cinquenta cartões para mostrar uma seria pagar cinquenta consultas por uma
 * leitura.
 *
 * Quem troca de contato remonta o componente pela `key` — é o que garante que o
 * painel nunca abra mostrando o histórico da pessoa anterior enquanto o novo
 * não chega.
 */
export function PainelDoContato({
  clienteId,
  contato,
  aoFechar,
}: {
  clienteId: string
  contato: {
    id: string
    nome: string
    telefone: string
    titulo?: string | null
    valor?: number | null
    responsavelNome?: string | null
    situacao?: string
  } | null
  aoFechar: () => void
}) {
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [resumo, setResumo] = useState<{ total: number; compras: number; ultimaEm: string | null } | null>(
    null,
  )

  useEffect(() => {
    if (!contato) return
    let valeu = true

    acaoAbrirPainelDoContato(clienteId, contato.id)
      .then((r) => {
        if (!valeu) return
        setEventos(r.eventos)
        setResumo(r.resumo)
      })
      .catch(() => {
        if (valeu) setEventos([])
      })

    return () => {
      valeu = false
    }
  }, [clienteId, contato])

  // Fechar com Esc: o painel cobre parte da tela, e sair dele com o teclado é o
  // que se espera de qualquer coisa que cobre.
  useEffect(() => {
    if (!contato) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [contato, aoFechar])

  if (!contato) return null

  return (
    <>
      <div
        aria-hidden
        onClick={aoFechar}
        className="fixed inset-0 z-30 bg-[rgba(19,25,34,0.22)] backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-label={`Perfil de ${contato.nome}`}
        className="fixed top-0 right-0 z-40 flex h-full w-[min(420px,92vw)] flex-col border-l border-line bg-panel shadow-[0_0_60px_rgba(19,25,34,0.18)]"
      >
        <header className="flex shrink-0 items-start gap-2 border-b border-line px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[14px] font-bold">{contato.nome}</strong>
            <span className="text-[11.5px] text-dim">{contato.telefone}</span>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar painel"
            className="rounded px-1.5 py-0.5 text-[15px] leading-none text-dim transition hover:text-soft"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3.5">
          <section className="grid grid-cols-3 gap-2">
            <Numero titulo="Já rendeu" valor={resumo ? comoDinheiro(resumo.total) || 'R$ 0,00' : '—'} />
            <Numero titulo="Compras" valor={resumo ? String(resumo.compras) : '—'} />
            <Numero
              titulo="Última"
              valor={resumo?.ultimaEm ? new Date(resumo.ultimaEm).toLocaleDateString('pt-BR') : '—'}
            />
          </section>

          {(contato.titulo || contato.valor != null) && (
            <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] leading-5">
              <span className="text-dim">Negociação: </span>
              {contato.titulo || 'sem título'}
              {contato.valor != null && ` — ${comoDinheiro(contato.valor)}`}
            </p>
          )}

          <p className="mt-3 text-[11.5px] text-dim">
            {contato.responsavelNome ? `Com ${contato.responsavelNome}` : 'Sem responsável'}
          </p>

          <h4 className="mt-5 mb-2 text-[10.5px] font-bold tracking-[0.05em] text-dim uppercase">
            O que aconteceu
          </h4>

          {eventos === null ? (
            <p className="text-[12px] text-dim">carregando…</p>
          ) : eventos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11.5px] leading-5 text-dim">
              Nada registrado ainda. A partir de agora, mudança de etapa, quem assumiu e o que foi
              ganho ou perdido aparecem aqui.
            </p>
          ) : (
            <ol className="flex flex-col gap-0">
              {eventos.map((evento) => (
                <li key={evento.id} className="flex gap-2.5 border-l border-line pb-3 pl-3 last:pb-0">
                  <span className="-ml-[17px] mt-[5px] size-[7px] shrink-0 rounded-full bg-surface-strong ring-2 ring-[var(--panel,#fff)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] leading-5">{comoFrase(evento)}</span>
                    <span className="text-[10.5px] text-dim">
                      {new Date(evento.criadoEm).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {evento.autor ? ` · ${evento.autor}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <footer className="shrink-0 border-t border-line px-4 py-3">
          <Link
            href={`/clientes/${clienteId}/leads/${contato.id}`}
            className="app-secondary-button block w-full px-4 py-2.5 text-center text-[12.5px]"
          >
            Abrir a conversa
          </Link>
        </footer>
      </aside>
    </>
  )
}

function Numero({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <span className="rounded-lg border border-line bg-surface px-2 py-2 text-center">
      <span className="block truncate text-[13px] font-bold">{valor}</span>
      <span className="block text-[10px] text-dim">{titulo}</span>
    </span>
  )
}
