'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

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
   * Atalhos de outros lugares da ficha ("Anotar" e "Etiquetar", no alto) pedem
   * uma aba, e às vezes um bloco dentro dela.
   *
   * **Quem troca a aba é quem foca o bloco.** Antes o atalho disparava o evento
   * e, no `requestAnimationFrame` seguinte, procurava o bloco por
   * `getElementById`: esse quadro roda antes de o React ter trocado o painel,
   * então achava o bloco ainda dentro de um painel `hidden`, onde
   * `scrollIntoView` e `focus` não fazem nada. No preview passava por acaso de
   * tempo; em produção, mais lenta, "Anotar" não fazia nada. Dois componentes
   * adivinhando o tempo um do outro é o defeito: o alvo viaja no evento e o
   * foco acontece no efeito, depois da pintura, quando o painel existe de fato.
   */
  const aFocar = useRef<string | null>(null)

  useEffect(() => {
    const ouvir = (evento: Event) => {
      const detalhe = (evento as CustomEvent<string | { aba: string; focar?: string }>).detail
      const pedido = typeof detalhe === 'string' ? { aba: detalhe } : detalhe
      if (!pedido || !abas.some((aba) => aba.chave === pedido.aba)) return
      aFocar.current = pedido.focar ?? null
      setAtual(pedido.aba)
    }
    window.addEventListener('ficha:aba', ouvir)
    return () => window.removeEventListener('ficha:aba', ouvir)
  }, [abas])

  /*
   * O pedido de foco viaja num `ref`, e não em estado: ele não muda o que é
   * desenhado, só o que acontece **depois** de desenhar, e guardá-lo em estado
   * obrigaria a limpá-lo de dentro do efeito, que é uma renderização em cascata.
   */
  useEffect(() => {
    const id = aFocar.current
    if (!id) return
    aFocar.current = null
    const alvo = document.getElementById(id)
    if (!alvo) return
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' })
    /*
      O `?` da ajuda é um `button` e costuma vir antes, no título: procurar
      "o primeiro botão" punha o foco nele, e o atalho "Anotar" abria a aba
      certa para deixar a pessoa em cima de um ponto de interrogação. O que se
      quer focar é o controle que começa a edição, marcado com `data-foco`.
    */
    const campo =
      alvo.querySelector<HTMLElement>('[data-foco]') ??
      alvo.querySelector<HTMLElement>('textarea, input')
    campo?.focus({ preventScroll: true })
  }, [atual])

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
        **Só a lista de abas rola, e só quando ela mesma não couber.** A barra
        inteira tinha `overflow-x-auto` com a tablist em `flex-1` ao lado do
        relógio: a lista esticava para ocupar a sobra, somava com o relógio e
        estourava o contêiner. Dava barra de rolagem no desktop com cinco abas
        que ocupam 548px de 1196px disponíveis, e sobrava arrastar para o lado
        sem ter nada para onde arrastar.

        A rolagem fica na tablist, que só transborda se as abas de fato não
        couberem (mobile estreito). Rolar em vez de quebrar em duas linhas é de
        propósito: abas que descem de linha mudam a altura do cabeçalho conforme
        a aba escolhida e a página inteira pula.
      */}
      <div className="flex items-center justify-between gap-2 border-b border-line pb-0">
        <div
          ref={tablist}
          role="tablist"
          aria-label="Seções da ficha"
          onKeyDown={aoTeclar}
          className="flex min-w-0 items-center gap-1 overflow-x-auto"
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
        {/*
          O `extra` é o relógio da janela de 24h, e ele carrega um balão de dica
          `absolute` de 342px centrado nele. Encostado na direita da barra, esse
          balão passava da borda da página e esticava o `scrollWidth` do pai em
          135px: aparecia uma barra de rolagem horizontal na ficha inteira por
          causa de um texto que só existe quando o mouse está em cima. `relative`
          aqui dá ao balão um contexto de posicionamento que não empurra o
          tamanho da barra.
        */}
        <span className="relative shrink-0">{extra}</span>
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
            /*
              **Sem `tabIndex` aqui.** Um painel focável vira um contêiner
              rolável para o navegador, e dava para rolar *dentro* da aba, em
              alguns pixels, sobre uma página que já rola: duas rolagens
              disputando o mesmo gesto. O padrão ARIA só pede painel focável
              quando ele não tem nada focável dentro, e todos estes têm.
            */
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
