import type { ReactNode } from 'react'

/**
 * A dica que aparece ao passar o mouse — no lugar do `title` do navegador.
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
 * fundo — o contraste invertido que toda dica boa usa, porque ela precisa se
 * separar do que está embaixo sem virar outro cartão.
 *
 * ---------------------------------------------------------------------------
 * CSS puro, sem estado
 * ---------------------------------------------------------------------------
 *
 * `group-hover` e `group-focus-visible` fazem tudo. Sem `useState`, sem efeito,
 * sem medir posição: o componente serve tanto a servidor quanto a cliente, e
 * uma dica que precisa de JavaScript é uma dica que não aparece enquanto a
 * página hidrata.
 *
 * O `transition-delay` de 400ms é do **aparecer**, não do sumir: sem ele, o
 * mouse atravessando a fileira acende as seis. Ao sair é imediato, porque dica
 * que insiste em ficar tapa o que a pessoa foi clicar.
 *
 * ---------------------------------------------------------------------------
 * Acessibilidade
 * ---------------------------------------------------------------------------
 *
 * A dica é `aria-hidden`: quem usa leitor de tela já recebe o nome pelo
 * `aria-label` do próprio botão, e anunciar as duas coisas leria o rótulo duas
 * vezes. `pointer-events-none` evita que ela roube o clique que ia para o botão
 * embaixo — o defeito clássico de dica posicionada por cima.
 */
export function Dica({
  texto,
  children,
  lado = 'baixo',
  alinhar = 'centro',
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
   * Centrado, um balão de 342px num ícone de 72px sobra 135px para cada lado:
   * na borda direita ele passa da página e estica o `scrollWidth`, o que
   * aparece como uma barra de rolagem horizontal causada por um texto que só
   * existe enquanto o mouse está em cima.
   */
  alinhar?: 'centro' | 'direita'
}) {
  return (
    /*
      `shrink-0`: a dica embrulha o botão, e dentro de uma linha flex sem quebra
      — a de escrever, por exemplo — um embrulho que encolhe amassa o ícone que
      ele carrega assim que o texto ao lado cresce.
    */
    <span className="group/dica relative inline-flex shrink-0">
      {children}
      <span
        aria-hidden
        className={`pointer-events-none absolute z-[70] scale-95 rounded-[8px] bg-ink px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-panel opacity-0 shadow-menu transition duration-100 group-hover/dica:scale-100 group-hover/dica:opacity-100 group-focus-visible/dica:scale-100 group-focus-visible/dica:opacity-100 group-hover/dica:delay-[400ms] group-focus-visible/dica:delay-0 ${
          alinhar === 'direita' ? 'right-0' : 'left-1/2 -translate-x-1/2'
        } ${lado === 'cima' ? 'bottom-[calc(100%+7px)]' : 'top-[calc(100%+7px)]'}`}
      >
        {texto}
        {/* O bico. Um quadrado girado, herdando o fundo: um `border` em
            triângulo não acompanharia a troca de tema. */}
        <span
          className={`absolute size-1.5 rotate-45 bg-ink ${
            alinhar === 'direita' ? 'right-3' : 'left-1/2 -translate-x-1/2'
          } ${lado === 'cima' ? 'top-[calc(100%-3px)]' : 'bottom-[calc(100%-3px)]'}`}
        />
      </span>
    </span>
  )
}
