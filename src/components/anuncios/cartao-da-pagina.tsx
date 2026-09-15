'use client'

import { useState, useTransition } from 'react'
import { acaoDesligarPagina, acaoImportarLeadsAntigos } from '@/server/acoes-lead-ads'

/**
 * Uma Página ligada, e se ela está mesmo pronta para receber lead.
 *
 * **O aviso de token faltando mora aqui, e não só no cartão de cima.** Página
 * ligada com token ausente é o estado que mais engana: a lista mostra a Página,
 * a pessoa conclui que está tudo certo, e nenhum lead entra. Dizer isso na
 * linha da Página é o que liga as duas metades na cabeça de quem olha.
 */
export function CartaoDaPagina({
  clienteId,
  pageId,
  nome,
  temToken,
}: {
  clienteId: string
  pageId: string
  nome: string
  temToken: boolean
}) {
  const [saindo, comecar] = useTransition()
  const [importando, importar] = useTransition()
  const [resultado, setResultado] = useState<string | null>(null)

  return (
    <div className="app-card flex flex-wrap items-center gap-3 px-5 py-3.5">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[15px]"
      >
        📄
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold">{nome !== '' ? nome : 'Página sem nome'}</p>
        <p className="mt-0.5 font-mono text-[10.5px] text-dim">{pageId}</p>
      </div>

      {temToken ? (
        <span className="rounded-full bg-accent/[0.12] px-2.5 py-1 text-[10.5px] font-bold text-accent">
          recebendo
        </span>
      ) : (
        <span
          className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10.5px] font-bold text-dim"
          title="Ligue a conta de anúncios acima para os leads desta página entrarem"
        >
          falta o acesso
        </span>
      )}

      {/*
        Importar só aparece com o acesso ligado, porque sem token não há o que
        buscar — e um botão que só sabe dizer "ligue antes" é um botão que
        ensina a errar.
      */}
      {temToken && (
        <button
          type="button"
          disabled={importando}
          onClick={() =>
            importar(async () => {
              const r = await acaoImportarLeadsAntigos(clienteId, pageId)
              setResultado(r.ok ? (r.resumo ?? 'pronto') : (r.erro ?? 'não deu'))
            })
          }
          className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11.5px] text-soft transition hover:border-white/20 disabled:opacity-50"
          title="Traz os leads que já existiam antes de ligar — a Meta guarda 90 dias"
        >
          {importando ? 'Importando…' : 'Importar leads antigos'}
        </button>
      )}

      <button
        type="button"
        disabled={saindo}
        onClick={() => comecar(() => void acaoDesligarPagina(clienteId, pageId))}
        className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11.5px] text-soft transition hover:border-white/20 disabled:opacity-50"
      >
        {saindo ? 'Desligando…' : 'Desligar'}
      </button>

      {/*
        O resultado fica na própria linha da Página, e não some sozinho: quem
        importou precisa poder ler com calma quantos entraram — e conferir
        depois, na lista de leads, se bate.
      */}
      {resultado !== null && (
        <p className="w-full text-[11px] text-dim">{resultado}</p>
      )}
    </div>
  )
}
