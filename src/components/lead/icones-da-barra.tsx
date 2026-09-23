/**
 * Os três ícones da linha de escrever: clipe, carinha e microfone.
 *
 * ---------------------------------------------------------------------------
 * Por que traço e não emoji
 * ---------------------------------------------------------------------------
 *
 * Eram `📎`, `😊` e `🎤`, emoji do sistema. Três problemas de uma vez: o
 * desenho muda de sistema para sistema (o microfone do Windows é um de palco,
 * com grade redonda e cabo, que quem olha lê como karaokê), vêm coloridos e
 * brigam com uma barra que é toda monocromática, e não obedecem `currentColor`, o hover que escurece os outros não os alcança.
 *
 * Em traço, os três são a mesma família dos ícones das ações rápidas
 * (`acoes-rapidas.tsx`, traço de 1,7px) e herdam a cor do botão.
 *
 * O microfone é o de gravador: cápsula arredondada, arco embaixo e um pé curto.
 * É o desenho que WhatsApp, Telegram e Instagram usam, e é o que separa "gravar
 * a minha voz" de "cantar num palco".
 */

const traco = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/**
 * 18px, e não 15.
 *
 * Os emoji anteriores desenhavam bem menor do que a caixa de texto ao lado, e
 * a fileira parecia recuada. Dois pixels a mais é o que faz os três encostarem
 * opticamente na altura da letra do campo.
 */
const TAMANHO = 18

export function IconeClipe() {
  return (
    <svg {...traco} width={TAMANHO} height={TAMANHO}>
      <path d="M20.5 11.5 12 20a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.5-2.5l7.4-7.4" />
    </svg>
  )
}

export function IconeCarinha() {
  return (
    <svg {...traco} width={TAMANHO} height={TAMANHO}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
      {/* Olhos como traço de um ponto só: um `circle` cheio pesaria mais que o
          resto do desenho, e a carinha ficaria com duas manchas no rosto. */}
      <path d="M9 9.5v.5M15 9.5v.5" />
    </svg>
  )
}

/** Sacola de compras: o catálogo, na mesma família de traço. */
export function IconeSacola() {
  return (
    <svg {...traco} width={TAMANHO} height={TAMANHO}>
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </svg>
  )
}

export function IconeMicrofone() {
  return (
    <svg {...traco} width={TAMANHO} height={TAMANHO}>
      {/* A cápsula. Raio igual à metade da largura: é o que a faz ler como
          microfone de gravação e não como retângulo com cantos. */}
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      {/* O arco que segura, e o pé. Sem a base horizontal: em 18px ela vira uma
          terceira linha paralela e embola o desenho. */}
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  )
}
