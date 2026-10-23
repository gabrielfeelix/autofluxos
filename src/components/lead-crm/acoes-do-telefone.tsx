'use client'

import { GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import { useState } from 'react'

/**
 * O telefone da ficha, e as três coisas que se faz com ele.
 *
 * **A queixa é o desktop.** O número era um `tel:`, e `tel:` no computador abre
 * um diálogo de aplicativo que ninguém tem configurado, ou seja, na tela onde
 * o time passa o dia, clicar no telefone não fazia nada. Quem queria falar com
 * a pessoa selecionava o número com o mouse, copiava, e procurava o contato no
 * WhatsApp à mão.
 *
 * `tel:` continua, porque no celular ele é exatamente o certo. O que entra ao
 * lado é o que faltava: abrir a conversa e copiar.
 *
 * **`wa.me` e não `web.whatsapp.com`**: o primeiro decide sozinho entre o
 * aplicativo e o navegador, conforme o aparelho de quem clicou. Escolher por ele
 * erra na metade dos casos.
 *
 * A confirmação some sozinha, um "copiado" permanente vira parte do layout e
 * para de significar que alguma coisa acabou de acontecer.
 */
export function AcoesDoTelefone({ waId, legivel }: { waId: string; legivel: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(legivel)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1600)
    } catch {
      // Área de transferência bloqueada (http, permissão negada). O número
      // continua visível ao lado para ser selecionado à mão, que é o motivo de
      // ele não viver dentro do botão.
    }
  }

  return (
    <span className="flex items-center gap-1.5">
      <a href={`tel:+${waId}`} className="font-semibold transition hover:text-primary">
        {legivel}
      </a>

      <a
        href={`https://wa.me/${waId}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir a conversa no WhatsApp"
        title="Abrir no WhatsApp"
        className="rounded-md p-1 text-dim transition hover:bg-surface hover:text-ok"
      >
        <IconeWhatsApp />
      </a>

      <button
        type="button"
        onClick={copiar}
        aria-label="Copiar o telefone"
        title="Copiar o telefone"
        className="rounded-md p-1 text-dim transition hover:bg-surface hover:text-primary"
      >
        {copiado ? (
          <span className="text-[10.5px] font-semibold text-ok">copiado</span>
        ) : (
          <IconeCopiar />
        )}
      </button>
    </span>
  )
}

function IconeWhatsApp() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={GLIFO_WHATSAPP} />
    </svg>
  )
}

function IconeCopiar() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}
