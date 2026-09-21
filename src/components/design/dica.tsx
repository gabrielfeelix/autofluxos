'use client'

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * A dica que aparece ao passar o mouse, no lugar do `title` do navegador.
 *
 * ---------------------------------------------------------------------------
 * Por que trocar o `title`
 * ---------------------------------------------------------------------------
 *
 * O `title` é um retângulo preto do sistema operacional: fonte diferente da do
 * produto, canto reto, sem controle de posição, e um atraso de quase um segundo
 * que o navegador decide. Numa fileira de seis ícones onde o `title` é a única
 * coisa que diz o que cada um faz, esse atraso é a diferença entre uma barra
 * legível e uma adivinhação.
 *
 * Aqui a dica é do produto: mesma tipografia, mesmo raio, a cor da tinta como
 * fundo, o contraste invertido que toda dica boa usa, porque ela precisa se
 * separar do que está embaixo sem virar outro cartão.
 *
 * ---------------------------------------------------------------------------
 * Por que ela saiu do fluxo e foi para um portal
 * ---------------------------------------------------------------------------
 *
 * Era `position: absolute` dentro do elemento, e CSS puro. Funcionava em barra
 * de ícones e falhava exatamente onde a dica é mais necessária: o `?` de
 * "Próximos passos" fica dentro de um `app-card`, que tem `overflow-hidden`
 * para arredondar o cabeçalho, e o balão de 248px nascia cortado pela borda do
 * cartão. Recortado à esquerda, cobrindo o título, ilegível.
 *
 * `overflow` de ancestral não tem como ser vencido de dentro: quem está no
 * fluxo é recortado. O balão passa a ser `position: fixed` num portal no
 * `<body>`, medido a partir do elemento, e preso à janela para não vazar pelas
 * laterais.
 *
 * O custo é que agora ela precisa de JavaScript, e some enquanto a página
 * hidrata. Para um texto de apoio que só aparece no hover, é o preço certo: a
 * alternativa era continuar aparecendo pela metade.
 *
 * O atraso de 400ms é do **aparecer**, não do sumir: sem ele, o mouse
 * atravessando a fileira acende as seis. Ao sair é imediato, porque dica que
 * insiste em ficar tapa o que a pessoa foi clicar.
 *
 * ---------------------------------------------------------------------------
 * Acessibilidade
 * ---------------------------------------------------------------------------
 *
 * A dica é `aria-hidden`: quem usa leitor de tela já recebe o nome pelo
 * `aria-label` do próprio botão, e anunciar as duas coisas leria o rótulo duas
 * vezes. `pointer-events-none` evita que ela roube o clique que ia para o botão
 * embaixo, o defeito clássico de dica posicionada por cima.
 */

/** A folga entre o elemento e o balão, e entre o balão e a borda da janela. */
const FOLGA = 7
const MARGEM_DA_JANELA = 8

export function Dica({
  texto,
  children,
  lado = 'baixo',
  alinhar = 'centro',
  largo = false,
}: {
  texto: string
  children: ReactNode
  /** `baixo` na barra de ações; `cima` quando o elemento está no rodapé. */
  lado?: 'cima' | 'baixo'
  /**
   * O eixo horizontal. `centro` é o certo no meio de uma barra; `direita`
   * alinha o balão pela borda direita do elemento, e é o que serve quando a
   * dica fica encostada na lateral da tela.
   *
   * Continua valendo como **preferência**: se o balão alinhado assim passasse
   * da janela, ele é puxado para dentro, e o bico é que se move para continuar
   * apontando o elemento.
   */
  alinhar?: 'centro' | 'direita'
  /**
   * Deixa o balão quebrar linha, num bloco de largura fixa.
   *
   * O padrão é `whitespace-nowrap` porque a dica de um ícone de barra é de três
   * palavras, e quebrar ali produziria um retângulo alto e estreito por nada.
   * A ajuda de campo é outra coisa: a frase tem uma linha ou duas, e sem isto
   * ela sairia numa tira só, mais larga que a janela.
   */
  largo?: boolean
}) {
  const alvo = useRef<HTMLSpanElement>(null)
  const balao = useRef<HTMLSpanElement>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pedida, setPedida] = useState(false)
  const [caixa, setCaixa] = useState<{ top: number; left: number; bico: number } | null>(null)

  /*
    Medir depois de montar o balão, e não antes.

    A largura depende do texto (`whitespace-nowrap` não tem largura fixa), então
    ele é montado invisível, medido, e só então posicionado. É um quadro a mais
    antes de aparecer, e o atraso de 400ms já é maior que isso.
  */
  const medir = useCallback(() => {
    const elemento = alvo.current
    const caixaDoBalao = balao.current
    if (!elemento || !caixaDoBalao) return

    const r = elemento.getBoundingClientRect()
    const b = caixaDoBalao.getBoundingClientRect()

    const top = lado === 'cima' ? r.top - b.height - FOLGA : r.bottom + FOLGA
    const preferido = alinhar === 'direita' ? r.right - b.width : r.left + r.width / 2 - b.width / 2
    const left = Math.min(
      Math.max(MARGEM_DA_JANELA, preferido),
      Math.max(MARGEM_DA_JANELA, window.innerWidth - b.width - MARGEM_DA_JANELA),
    )

    // O bico aponta o meio do elemento, onde quer que o balão tenha parado.
    const bico = Math.min(Math.max(10, r.left + r.width / 2 - left), Math.max(10, b.width - 10))

    setCaixa({ top, left, bico })
  }, [alinhar, lado])

  useLayoutEffect(() => {
    if (!pedida) return

    medir()
    const sumir = () => esconder()
    window.addEventListener('scroll', sumir, true)
    window.addEventListener('resize', sumir)
    return () => {
      window.removeEventListener('scroll', sumir, true)
      window.removeEventListener('resize', sumir)
    }
    // `esconder` é estável o bastante: ela só limpa o relógio e zera o estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida, medir])

  const mostrar = (atraso: number) => {
    if (relogio.current) clearTimeout(relogio.current)
    relogio.current = setTimeout(() => setPedida(true), atraso)
  }

  const esconder = () => {
    if (relogio.current) clearTimeout(relogio.current)
    setPedida(false)
    setCaixa(null)
  }

  return (
    /*
      `shrink-0`: a dica embrulha o botão, e dentro de uma linha flex sem quebra
      (a de escrever, por exemplo) um embrulho que encolhe amassa o ícone que
      ele carrega assim que o texto ao lado cresce.
    */
    <span
      ref={alvo}
      className="relative inline-flex shrink-0"
      onMouseEnter={() => mostrar(400)}
      onMouseLeave={esconder}
      onFocus={() => mostrar(0)}
      onBlur={esconder}
    >
      {children}

      {pedida &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            ref={balao}
            aria-hidden
            style={caixa ? { top: caixa.top, left: caixa.left } : { top: 0, left: 0 }}
            className={`pointer-events-none fixed z-[70] rounded-[8px] bg-ink px-2 py-1 text-[11px] font-semibold text-panel shadow-menu transition-opacity duration-100 ${
              largo ? 'w-[248px] leading-[1.45] whitespace-normal normal-case' : 'whitespace-nowrap'
            } ${caixa ? 'opacity-100' : 'opacity-0'}`}
          >
            {texto}
            {/* O bico. Um quadrado girado, herdando o fundo: um `border` em
                triângulo não acompanharia a troca de tema. */}
            <span
              className="absolute size-1.5 -translate-x-1/2 rotate-45 bg-ink"
              style={{
                left: caixa?.bico ?? 0,
                ...(lado === 'cima'
                  ? { top: 'calc(100% - 3px)' }
                  : { bottom: 'calc(100% - 3px)' }),
              }}
            />
          </span>,
          document.body,
        )}
    </span>
  )
}
