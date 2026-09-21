'use client'

import { useState } from 'react'

/**
 * Um endereço que existe para ser copiado, e o botão que copia.
 *
 * O caso que ele resolve é o webhook da Meta: uma URL longa, que ninguém digita
 * à mão, exibida num campo que a pessoa precisava selecionar com o mouse até o
 * fim. Selecionar texto truncado dentro de um bloco é justamente o que dá
 * errado, para no "..." e leva meia URL para o painel da Meta, que então
 * responde um erro que não diz que o endereço veio cortado.
 *
 * **O texto quebra em vez de truncar.** Endereço cortado por reticências é
 * informação escondida num lugar onde o valor inteiro é o ponto.
 *
 * A confirmação some sozinha: um "copiado" permanente vira parte do layout e
 * para de significar que alguma coisa acabou de acontecer.
 *
 * Nenhuma cor escrita aqui. O campo usa `surface`/`line`/`muted`, que são os
 * mesmos tokens do resto do painel, o bloco antigo usava `bg-black/30` com
 * texto `primary`, que no tema claro virava uma faixa cinza com texto azul em
 * cima, ilegível nos dois sentidos.
 */
export function CampoParaCopiar({
  valor,
  rotuloAcessivel,
}: {
  valor: string
  rotuloAcessivel: string
}) {
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor)
      setErro(false)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Área de transferência bloqueada (http, permissão negada). O valor
      // continua inteiro e visível ao lado, então isto não é um beco sem saída.
      setErro(true)
    }
  }

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-[11.5px] leading-5 break-all text-muted">
          {valor}
        </code>
        <button
          type="button"
          onClick={copiar}
          aria-label={rotuloAcessivel}
          title={rotuloAcessivel}
          className="shrink-0 rounded-lg border border-line px-3 text-[11.5px] font-semibold text-soft transition hover:bg-surface hover:text-primary"
        >
          {copiado ? 'copiado' : <IconeCopiar />}
        </button>
      </div>
      {erro && (
        <p className="mt-1.5 text-[11px] text-aviso">
          O navegador bloqueou a cópia automática, selecione o endereço acima e copie.
        </p>
      )}
    </div>
  )
}

function IconeCopiar() {
  return (
    <svg
      width="14"
      height="14"
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
