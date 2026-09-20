'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'

export type AbaDaFicha = {
  chave: string
  rotulo: string
  /** Aparece ao lado do rótulo. Zero não é mostrado: contador de nada é ruído. */
  contagem?: number
  conteudo: ReactNode
  /** A conversa é a única que gerencia a própria rolagem e o próprio rodapé. */
  solta?: boolean
}

/**
 * As abas da ficha.
 *
 * **A visão geral é a primeira, e a conversa é a última.** Era o contrário: a
 * conversa abria por padrão e quem chegava para entender a pessoa via um chat
 * ocupando a tela inteira, com os fatos espremidos numa coluna de 280px ao
 * lado. A ficha responde "quem é esta pessoa e em que pé está"; para responder
 * "o que eu digo agora" existe o Inbox, que é a tela feita para isso.
 *
 * **Nenhuma aba é desmontada ao trocar**, só escondida. Desmontar a conversa
 * perderia o que já foi digitado na caixa de resposta e a rolagem do histórico:
 * ir ver de que anúncio a pessoa veio custaria o rascunho da mensagem.
 *
 * **A altura fixa é só do painel solto.** O cartão inteiro tinha `max-h-620px`,
 * então a visão geral e o histórico ganhavam uma barra de rolagem interna sem
 * precisar: a página já rola. Prender altura só faz sentido para a conversa,
 * cujo rodapé precisa ficar visível enquanto as mensagens correm.
 */
export function Abas({
  abas,
  extra,
  inicial,
}: {
  abas: AbaDaFicha[]
  extra?: ReactNode
  /** Aba aberta ao carregar. Sem isso, a primeira. */
  inicial?: string
}) {
  const base = useId()
  const [atual, setAtual] = useState(
    () => (inicial && abas.some((aba) => aba.chave === inicial) ? inicial : abas[0]?.chave) ?? '',
  )
  const tablist = useRef<HTMLDivElement>(null)

  /*
   * Atalhos de outros lugares da ficha (o menu de ações, por exemplo) pedem uma
   * aba pelo hash. Sem isto, "Anotar" rolava até um bloco escondido atrás de
   * outra aba e a pessoa via a página piscar e não acontecer nada.
   */
  const irPara = useCallback(
    (chave: string) => {
      if (abas.some((aba) => aba.chave === chave)) setAtual(chave)
    },
    [abas],
  )

  useEffect(() => {
    const ouvir = (evento: Event) => {
      const detalhe = (evento as CustomEvent<string>).detail
      if (typeof detalhe === 'string') irPara(detalhe)
    }
    window.addEventListener('ficha:aba', ouvir)
    return () => window.removeEventListener('ficha:aba', ouvir)
  }, [irPara])

  /*
   * Setas, Home e End dentro da tablist. É o que o padrão ARIA de abas manda, e
   * é o que faz a barra ser navegável sem mouse: Tab entra e sai do conjunto,
   * as setas andam entre as abas.
   */
  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    const teclas = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!teclas.includes(evento.key)) return
    evento.preventDefault()

    const indice = abas.findIndex((aba) => aba.chave === atual)
    const destino =
      evento.key === 'Home'
        ? 0
        : evento.key === 'End'
          ? abas.length - 1
          : (indice + (evento.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length

    const escolhida = abas[destino]
    if (!escolhida) return
    setAtual(escolhida.chave)
    tablist.current
      ?.querySelector<HTMLButtonElement>(`[data-aba="${escolhida.chave}"]`)
      ?.focus()
  }

  return (
    <section className="flex flex-col gap-[18px]">
      {/*
        A barra rola na horizontal no mobile em vez de quebrar em duas linhas:
        abas que descem de linha mudam a altura do cabeçalho conforme a aba
        escolhida e a página inteira pula.
      */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-line pb-0">
        <div
          ref={tablist}
          role="tablist"
          aria-label="Seções da ficha"
          onKeyDown={aoTeclar}
          className="flex flex-1 items-center gap-1"
        >
          {abas.map((aba) => {
            const escolhida = aba.chave === atual
            return (
              <button
                key={aba.chave}
                type="button"
                role="tab"
                id={`${base}-${aba.chave}-aba`}
                data-aba={aba.chave}
                aria-selected={escolhida}
                aria-controls={`${base}-${aba.chave}-painel`}
                tabIndex={escolhida ? 0 : -1}
                onClick={() => setAtual(aba.chave)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[12.5px] font-semibold transition ${
                  escolhida
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {aba.rotulo}
                {aba.contagem !== undefined && aba.contagem > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                      escolhida ? 'bg-primary/15 text-primary' : 'bg-surface-strong text-dim'
                    }`}
                  >
                    {aba.contagem}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {extra}
      </div>

      {abas.map((aba) => {
        const escolhida = aba.chave === atual
        return (
          <div
            key={aba.chave}
            role="tabpanel"
            id={`${base}-${aba.chave}-painel`}
            aria-labelledby={`${base}-${aba.chave}-aba`}
            hidden={!escolhida}
            tabIndex={0}
            className={
              aba.solta
                ? `app-card min-h-0 flex-col overflow-hidden ${escolhida ? 'flex h-[min(72vh,700px)]' : 'hidden'}`
                : escolhida
                  ? 'block'
                  : 'hidden'
            }
          >
            {aba.conteudo}
          </div>
        )
      })}
    </section>
  )
}
