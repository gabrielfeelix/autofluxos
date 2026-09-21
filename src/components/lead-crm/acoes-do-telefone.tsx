'use client'

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
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.69 8.22-8.24 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42-.14 0-.31-.02-.47-.02-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.28Z" />
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
