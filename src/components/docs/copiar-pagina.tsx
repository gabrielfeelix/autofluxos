'use client'

import { BotaoCopiar } from './codigo'

/**
 * Copia a página como texto: título e corpo, para colar num chamado, num
 * e-mail ou numa IA. Lê o que está na tela, então copia o que a pessoa vê.
 */
export function CopiarPagina() {
  return (
    <BotaoCopiar
      rotulo="Copiar página"
      texto={() => {
        const titulo = document.querySelector('article h1')?.textContent ?? ''
        const corpo = document.querySelector<HTMLElement>('[data-pagina]')?.innerText ?? ''
        return `# ${titulo}\n\n${corpo}\n\n${window.location.href}`
      }}
    />
  )
}
