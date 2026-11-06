'use client'

import { useEffect, useMemo, useState } from 'react'
import { acaoAutomacoesParaEnviar, type AutomacaoParaEnviar } from '@/server/acoes-automacao-na-conversa'

/**
 * Enviar uma automação para o contato, de dentro da conversa (06/nov/2026).
 *
 * Dois passos de propósito: escolher e depois confirmar. O clique manda
 * mensagem de verdade para o WhatsApp de alguém, e uma lista em que tocar já
 * envia é uma lista em que o dedo escorregado vira conversa com cliente.
 */
export function PainelEnviarAutomacao({
  clienteId,
  contatoId,
  nomeDoContato,
  devolve,
  aoEnviar,
}: {
  clienteId: string
  contatoId: string
  nomeDoContato: string
  /** Alguém da equipe está atendendo: a conversa volta para ele no fim do fluxo. */
  devolve: boolean
  aoEnviar: (automacao: AutomacaoParaEnviar) => void
}) {
  const [lista, setLista] = useState<AutomacaoParaEnviar[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [escolhida, setEscolhida] = useState<AutomacaoParaEnviar | null>(null)

  useEffect(() => {
    let vivo = true
    void acaoAutomacoesParaEnviar(clienteId, contatoId).then((r) => {
      if (!vivo) return
      if (r.ok) setLista(r.automacoes)
      else setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [clienteId, contatoId])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (lista ?? []).filter((a) => !termo || a.nome.toLowerCase().includes(termo))
  }, [lista, busca])

  return (
    <div className="flex flex-col">
      <p className="text-[12px] font-bold text-soft">Enviar automação</p>
      <p className="mt-0.5 text-[11.5px] leading-4 text-dim">
        {devolve
          ? `${nomeDoContato} recebe o início da automação agora. Quando ela terminar, a conversa volta para você.`
          : `${nomeDoContato} recebe o início da automação agora, e o bot conduz a partir dali.`}
      </p>

      {(lista?.length ?? 0) > 6 && (
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar automação"
          aria-label="Buscar automação"
          className="app-field mt-2.5 w-full px-3 py-2 text-[12.5px]"
        />
      )}

      <div className="-mx-1 mt-2 max-h-[260px] overflow-y-auto">
        {erro && <p className="px-1 py-2 text-[12px] text-rose-500">{erro}</p>}
        {!erro && lista === null && (
          <div className="space-y-1.5 px-1 py-1" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-surface-strong" />
            ))}
          </div>
        )}
        {lista !== null && lista.length === 0 && (
          <p className="px-1 py-2 text-[12px] leading-5 text-dim">
            Nenhuma automação publicada e ligada para o canal desta conversa.
          </p>
        )}
        <ul>
          {filtradas.map((a) => {
            const marcada = escolhida?.id === a.id
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setEscolhida(marcada ? null : a)}
                  aria-pressed={marcada}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] transition ${
                    marcada ? 'bg-primary/[0.1] text-primary' : 'text-soft hover:bg-surface-strong'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                      marcada ? 'border-primary bg-primary' : 'border-strong'
                    }`}
                  >
                    {marcada && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 truncate">{a.nome}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <button
        type="button"
        disabled={!escolhida}
        onClick={() => escolhida && aoEnviar(escolhida)}
        className="mt-2.5 w-full rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {!escolhida ? 'Escolha uma automação' : devolve ? 'Enviar e voltar para mim' : `Enviar "${escolhida.nome}"`}
      </button>
    </div>
  )
}

export const PRAZOS_DA_PAUSA = [
  { minutos: 30, rotulo: '30 minutos' },
  { minutos: 60, rotulo: '1 hora' },
  { minutos: 240, rotulo: '4 horas' },
  { minutos: 1440, rotulo: '24 horas' },
  { minutos: null, rotulo: 'Até eu religar' },
] as const

export type MinutosDaPausa = (typeof PRAZOS_DA_PAUSA)[number]['minutos']

/**
 * Pausar o bot com prazo (06/nov/2026).
 *
 * Enquanto o prazo corre, nada automático fala com o contato: nem o fluxo, nem
 * o gatilho de story ou comentário, nem sequência. É para a conversa direta com
 * alguém não ser atropelada por uma automação que ele disparou sem querer.
 */
export function PainelPausarBot({ aoPausar }: { aoPausar: (minutos: MinutosDaPausa) => void }) {
  return (
    <div>
      <p className="px-3 pt-2 text-[12px] font-bold text-soft">Pausar o bot nesta conversa</p>
      <p className="px-3 pt-0.5 pb-1.5 text-[11.5px] leading-4 text-dim">
        Nenhuma automação fala com este contato durante a pausa.
      </p>
      <ul>
        {PRAZOS_DA_PAUSA.map((p) => (
          <li key={p.rotulo}>
            <button
              type="button"
              onClick={() => aoPausar(p.minutos)}
              className="w-full px-3 py-2 text-left text-[12.5px] text-soft transition hover:bg-surface-strong"
            >
              {p.rotulo}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "29:19", "3h12", o que falta para o bot voltar. */
export function ContadorDaPausa({ ate }: { ate: string }) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const resta = Math.max(0, new Date(ate).getTime() - agora)
  const s = Math.floor(resta / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const texto = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(seg).padStart(2, '0')}`
  return (
    <span className="ml-0.5 text-[11px] font-medium text-aviso tabular-nums" title="O bot volta sozinho quando o tempo acabar">
      {texto}
    </span>
  )
}

export function IconeAutomacao() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4" width="6" height="5" rx="1.2" />
      <rect x="14.5" y="15" width="6" height="5" rx="1.2" />
      <path d="M9.5 6.5h3a2 2 0 0 1 2 2v6.5" />
    </svg>
  )
}
