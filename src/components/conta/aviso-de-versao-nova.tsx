'use client'

import { useEffect, useState } from 'react'

/** De quanto em quanto tempo a aba visível pergunta. */
const INTERVALO = 10 * 60_000
/** Voltar à aba três vezes num minuto não precisa de três perguntas. */
const ESPERA_MINIMA = 60_000

/**
 * "Saiu uma versão nova": a faixa que avisa a aba aberta antes de um deploy.
 *
 * Pedido do Eduardo em 03/10/2026: o sistema muda quase todo dia, e o cliente
 * com a aba aberta desde cedo achava que estava com problema quando, depois de
 * um deploy, alguma coisa não carregava. A recarga automática na navegação já
 * vem do `deploymentId` (`next.config.ts`); esta faixa cobre quem fica parado
 * na mesma tela, que nunca navega e por isso nunca recarrega.
 *
 * **A comparação é com a primeira resposta desta aba**, e não com um id
 * gravado no HTML: o formato do id que a Vercel injeta não é nosso, e uma
 * comparação entre dois formatos diferentes acenderia a faixa para sempre. A
 * primeira pergunta sai na montagem, quando a aba acabou de carregar a versão
 * que está no ar.
 *
 * Nunca recarrega sozinha: a pessoa pode estar no meio de uma resposta. Ela
 * escolhe a hora, e fechar a faixa vale até a próxima versão.
 */
export function AvisoDeVersaoNova() {
  const [nova, setNova] = useState<string | null>(null)
  const [fechadaPara, setFechadaPara] = useState<string | null>(null)

  useEffect(() => {
    let primeira: string | null = null
    let ultimaPergunta = 0
    let desmontou = false

    async function conferir() {
      if (document.visibilityState !== 'visible') return
      const agora = Date.now()
      if (agora - ultimaPergunta < ESPERA_MINIMA) return
      ultimaPergunta = agora
      try {
        const resposta = await fetch('/api/versao', { cache: 'no-store' })
        if (!resposta.ok) return
        const { versao } = (await resposta.json()) as { versao: string | null }
        if (desmontou || !versao) return
        if (primeira === null) primeira = versao
        else if (versao !== primeira) setNova(versao)
      } catch {
        // Sem rede, sem pergunta: a próxima volta à aba tenta de novo.
      }
    }

    void conferir()
    const relogio = setInterval(conferir, INTERVALO)
    const aoVoltar = () => void conferir()
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    return () => {
      desmontou = true
      clearInterval(relogio)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [])

  if (!nova || fechadaPara === nova) return null

  /*
   * Cartão claro, e não faixa tingida: ela mora em cima da casca azul, onde o
   * tom "info" (azul-claro sobre azul) sumia. Visto no teste de 04/10/2026.
   */
  return (
    <div role="status" className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-soft shadow-[0_6px_20px_rgba(19,25,34,0.12)] md:mx-4">
      <p className="flex min-w-0 flex-1 items-center gap-2.5 text-[12.5px] leading-5">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-weak text-primary">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 11a8 8 0 1 0-2.3 5.7" />
            <path d="M20 4v7h-7" />
          </svg>
        </span>
        <span>
          <strong className="font-semibold text-ink">Saiu uma versão nova do AutoFluxos.</strong> Atualize a página para usar a mais
          recente; o que você já salvou continua lá.
        </span>
      </p>
      <span className="flex items-center gap-1.5">
        <button type="button" onClick={() => window.location.reload()} className="botao-primario botao-sm">
          Atualizar agora
        </button>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => setFechadaPara(nova)}
          className="grid size-8 place-items-center rounded-lg text-[16px] leading-none text-muted transition hover:bg-surface hover:text-ink"
        >
          ×
        </button>
      </span>
    </div>
  )
}
