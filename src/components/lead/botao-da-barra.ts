/**
 * A aparência dos ícones da linha de escrever: clipe, emoji e microfone.
 *
 * Vive fora dos três componentes porque eles são irmãos na mesma linha e
 * precisam ser indistinguíveis. Quando a classe morava em cada arquivo, os três
 * já tinham nascido diferentes — um com borda arredondada, outro com `rounded-lg`,
 * e cada um com o seu tamanho de fonte. Numa fileira, o que destoa parece outro
 * tipo de botão.
 *
 * **Sem borda, e isso é o ponto.** O que tem borda na caixa de resposta é o
 * campo de texto e o botão de enviar — o que se preenche e o que decide. Um
 * clipe com borda disputa atenção com os dois e não tem nada a decidir; ele é o
 * caminho para outro gesto. Todo chat que a mão conhece desenha assim.
 *
 * 36px é a medida do alvo: o mínimo confortável de toque (WCAG 2.5.8 pede 24,
 * as diretrizes de plataforma pedem 44 no dedo e 32 no mouse) e a mesma altura
 * do campo com uma linha, o que faz a fileira encostar reta.
 */
export const BOTAO_DA_BARRA =
  'flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] leading-none text-muted transition hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40'
