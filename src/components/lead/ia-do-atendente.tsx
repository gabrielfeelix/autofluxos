'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dica } from '@/components/design/dica'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import type { RespostaDoCopiloto } from '@/server/acoes-copiloto'

/**
 * A IA do atendente dentro do compositor: sugerir, corrigir, mais formal, mais
 * curto.
 *
 * ---------------------------------------------------------------------------
 * Nada muda sem o atendente aceitar
 * ---------------------------------------------------------------------------
 *
 * Decisão do Gabriel em 29/out/2026. O resultado aparece num cartão acima do
 * campo, e o que está escrito no campo continua lá, intocado, até o clique em
 * "Usar". Nem o rascunho é apagado: pedir uma sugestão com meia frase escrita
 * e descartar devolve a meia frase como estava. E "Usar" só põe no campo;
 * mandar continua sendo o botão de enviar.
 */

export type ModoDeAjuste = 'corrigir' | 'formal' | 'curto'

export type CopilotoDoCompositor = {
  sugerir: () => Promise<RespostaDoCopiloto>
  ajustar: (modo: ModoDeAjuste, texto: string) => Promise<RespostaDoCopiloto>
}

type Pedido = 'sugerir' | ModoDeAjuste

const ROTULO: Record<Pedido, string> = {
  sugerir: 'Sugestão de resposta',
  corrigir: 'Texto corrigido',
  formal: 'Mais formal',
  curto: 'Mais curto',
}

type Estado =
  | { tipo: 'parado' }
  | { tipo: 'pensando'; pedido: Pedido }
  | { tipo: 'pronto'; pedido: Pedido; texto: string }
  | { tipo: 'falhou'; pedido: Pedido; erro: string }

export function useIaDoAtendente(copiloto: CopilotoDoCompositor | undefined, lerTexto: () => string) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'parado' })
  // O pedido mais novo ganha: clicar de novo enquanto o primeiro pensa não
  // pode deixar a resposta velha chegar por cima da nova.
  const vez = useRef(0)

  const pedir = useCallback(
    async (pedido: Pedido) => {
      if (!copiloto) return
      const minha = ++vez.current
      setEstado({ tipo: 'pensando', pedido })
      let r: RespostaDoCopiloto
      try {
        r = pedido === 'sugerir' ? await copiloto.sugerir() : await copiloto.ajustar(pedido, lerTexto())
      } catch {
        r = { ok: false, erro: 'Não foi possível falar com a IA agora. Tente de novo em instantes.' }
      }
      if (minha !== vez.current) return
      setEstado(r.ok ? { tipo: 'pronto', pedido, texto: r.texto } : { tipo: 'falhou', pedido, erro: r.erro })
    },
    [copiloto, lerTexto],
  )

  const fechar = useCallback(() => {
    vez.current++
    setEstado({ tipo: 'parado' })
  }, [])

  return { estado, pedir, fechar }
}

/** O botão da barra, com o menu dos quatro gestos. */
export function BotaoDaIa({
  aoPedir,
  temTexto,
  desabilitado,
}: {
  aoPedir: (pedido: Pedido) => void
  temTexto: boolean
  desabilitado?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const escolher = (pedido: Pedido) => {
    setAberto(false)
    aoPedir(pedido)
  }

  const opcoes: { pedido: Pedido; rotulo: string; detalhe: string; precisaTexto: boolean }[] = [
    { pedido: 'sugerir', rotulo: 'Sugerir resposta', detalhe: 'Pela conversa, pelo negócio e pelo catálogo', precisaTexto: false },
    { pedido: 'corrigir', rotulo: 'Corrigir o texto', detalhe: 'Ortografia, acentos e pontuação', precisaTexto: true },
    { pedido: 'formal', rotulo: 'Deixar mais formal', detalhe: 'Mesmo conteúdo, tom profissional', precisaTexto: true },
    { pedido: 'curto', rotulo: 'Deixar mais curto', detalhe: 'Mais direto, sem perder informação', precisaTexto: true },
  ]

  return (
    <div className="relative shrink-0" ref={caixa}>
      <Dica texto="Ajuda da IA" lado="cima">
        <button
          type="button"
          disabled={desabilitado}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAberto((x) => !x)}
          aria-label="Ajuda da IA para escrever"
          aria-expanded={aberto}
          className={BOTAO_DA_BARRA}
        >
          <IconeEscrever />
        </button>
      </Dica>
      {aberto && (
        <div
          role="menu"
          aria-label="Ajuda da IA"
          className="absolute bottom-full left-0 z-30 mb-2 w-[280px] max-w-[88vw] rounded-[12px] border border-line bg-panel p-1.5 shadow-[0_10px_30px_rgba(19,25,34,0.11)]"
        >
          {opcoes.map((o, i) => {
            const bloqueada = o.precisaTexto && !temTexto
            return (
              <div key={o.pedido}>
                {i === 1 && <div aria-hidden className="mx-2 my-1 h-px bg-line" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={bloqueada}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(o.pedido)}
                  className="block w-full rounded-[8px] px-2.5 py-2 text-left transition hover:bg-surface disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent"
                >
                  <span className="block text-[13px] font-semibold text-ink">{o.rotulo}</span>
                  <span className="block text-[11.5px] leading-4 text-dim">
                    {bloqueada ? 'Escreva no campo primeiro' : o.detalhe}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** O cartão com o resultado, acima do campo. Só "Usar" mexe no que está escrito. */
export function CartaoDaIa({
  estado,
  aoUsar,
  aoFechar,
  aoTentarDeNovo,
}: {
  estado: Estado
  aoUsar: (texto: string) => void
  aoFechar: () => void
  aoTentarDeNovo: (pedido: Pedido) => void
}) {
  if (estado.tipo === 'parado') return null
  const ajuste = estado.pedido !== 'sugerir'

  return (
    <div
      role="region"
      aria-label={ROTULO[estado.pedido]}
      aria-busy={estado.tipo === 'pensando'}
      className="mb-2 rounded-[12px] border border-line bg-surface px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">{ROTULO[estado.pedido]}</span>
        <span className="text-[11px] text-dim">· só você vê</span>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Descartar"
          className="ml-auto rounded-full px-1.5 py-0.5 text-[13px] leading-none text-dim transition hover:bg-surface-strong hover:text-ink"
        >
          ×
        </button>
      </div>

      {estado.tipo === 'pensando' && (
        <div className="mt-2 space-y-1.5" aria-label="Escrevendo">
          <div className="h-3 w-[92%] animate-pulse rounded bg-surface-strong" />
          <div className="h-3 w-[64%] animate-pulse rounded bg-surface-strong" />
        </div>
      )}

      {estado.tipo === 'falhou' && (
        <>
          <p className="mt-1.5 text-[12.5px] leading-5 text-perigo">{estado.erro}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => aoTentarDeNovo(estado.pedido)} className="botao-secundario botao-sm">
              Tentar de novo
            </button>
          </div>
        </>
      )}

      {estado.tipo === 'pronto' && (
        <>
          <p className="mt-1.5 max-h-[160px] overflow-y-auto text-[13px] leading-5 whitespace-pre-wrap text-ink">
            {estado.texto}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => aoUsar(estado.texto)} className="botao-primario botao-sm">
              {ajuste ? 'Trocar pelo ajustado' : 'Usar no campo'}
            </button>
            <button type="button" onClick={() => aoTentarDeNovo(estado.pedido)} className="botao-secundario botao-sm">
              Gerar outra
            </button>
            <span className="text-[11.5px] text-dim">Você revisa e envia. Nada sai sozinho.</span>
          </div>
        </>
      )}
    </div>
  )
}

function IconeEscrever() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M14.5 7.5l3 3" />
      <path d="M19 15v4M17 17h4" />
    </svg>
  )
}
