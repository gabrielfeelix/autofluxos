'use client'

/**
 * A caixa de seleção do painel.
 *
 * O sistema não tinha uma: todo lugar usava `<input type="checkbox">` cru com
 * `accent-color`, e o navegador desenhava o quadrado dele, canto reto, sem o
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
 * O desenho mora em `.caixa-de-marcar` (`globals.css`), a mesma classe que as
 * caixas soltas da tabela e do menu usam.
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
  /** Para o alinhamento de quem a usa, `mt-0.5` ao lado de texto de duas linhas. */
  className?: string
}) {
  return (
    <input
      type="checkbox"
      name={nome}
      aria-label={rotuloAcessivel}
      checked={marcada}
      disabled={desabilitada}
      onChange={(evento) => aoMudar(evento.currentTarget.checked)}
      className={`caixa-de-marcar ${className}`}
    />
  )
}
