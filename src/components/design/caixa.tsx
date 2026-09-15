'use client'

/**
 * A caixa de seleção do painel.
 *
 * O sistema não tinha uma: todo lugar usava `<input type="checkbox">` cru com
 * `accent-color`, e o navegador desenhava o quadrado dele — canto reto, sem o
 * raio de 10px que o resto da tela usa, e em três telas com uma cor de destaque
 * (`#56d0f5`) que não é mais a cor da marca. É a diferença entre um painel e um
 * formulário: nada ali estava errado sozinho, e junto dizia "isto foi montado
 * às pressas".
 *
 * **Continua sendo um `<input type="checkbox">` de verdade.** `appearance-none`
 * apaga o desenho do sistema operacional e deixa o comportamento: leitor de
 * tela anuncia caixa de seleção, `Espaço` marca, o rótulo que a envolve
 * continua clicando nela, e um `<form>` continua enviando o valor. Desenhar uma
 * caixa falsa com `<div>` custaria todas essas quatro coisas.
 *
 * O raio e o anel de foco são os do `.app-field` de propósito — foco precisa
 * parecer foco em todo lugar.
 */
export function Caixa({
  marcada,
  aoMudar,
  desabilitada = false,
  rotuloAcessivel,
  nome,
  className = '',
}: {
  marcada: boolean
  aoMudar: (marcada: boolean) => void
  desabilitada?: boolean
  /** Só quando a caixa não vem dentro de um `<label>` que já a nomeia. */
  rotuloAcessivel?: string
  /** Nome no formulário, quando ela for enviada por um. */
  nome?: string
  /** Para o alinhamento de quem a usa — `mt-0.5` ao lado de texto de duas linhas. */
  className?: string
}) {
  return (
    <span className={`relative inline-flex size-[17px] shrink-0 ${className}`}>
      <input
        type="checkbox"
        name={nome}
        aria-label={rotuloAcessivel}
        checked={marcada}
        disabled={desabilitada}
        onChange={(evento) => aoMudar(evento.currentTarget.checked)}
        className="peer size-full cursor-pointer appearance-none rounded-[6px] border border-strong bg-panel transition outline-none checked:border-primary checked:bg-primary hover:border-primary/60 focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
      />
      {/* O tique é desenhado por cima e não recebe clique: quem recebe é o
          input inteiro, que ocupa a mesma área. */}
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute inset-0 m-auto size-[11px] text-white opacity-0 transition-opacity peer-checked:opacity-100"
      >
        <path
          d="m3.2 8.2 2.8 2.8 6.8-6.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
