'use client'

import { useState } from 'react'

/**
 * O bloco de código que aparece embaixo de toda tela de erro.
 *
 * Ele existe porque a mensagem bonita ("Alguma coisa quebrou aqui") não diz
 * nada para quem vai consertar. O que conserta é o que está aqui: a mensagem
 * técnica e um código curto que identifica **este** erro.
 */

/**
 * O código que a pessoa lê e repassa.
 *
 * Erro do **servidor** já vem com `digest`: o Next esconde a mensagem real de
 * propósito (mensagem de banco vaza nome de tabela e coluna) e deixa só esse
 * número, que é o que liga a tela ao log da Vercel.
 *
 * Erro do **navegador** não tem `digest` nenhum — e era justamente o caso do
 * editor entrando em laço. A tela mostrava a caixa vazia, sem código e sem
 * mensagem, e a única forma de saber o que tinha acontecido era abrir o
 * console. Aqui a gente inventa o código a partir do próprio texto do erro:
 * não serve para procurar em log, mas serve para o que ele precisa servir —
 * duas telas com o mesmo código quebraram pelo mesmo motivo, e duas com código
 * diferente não.
 *
 * O prefixo `c` é de cliente, e existe para ninguém confundir com um `digest`
 * de servidor e ir procurar na Vercel um número que nunca esteve lá.
 */
export function codigoDoErro(erro: { name?: string; message?: string; digest?: string }): string {
  if (erro.digest) return erro.digest
  const semente = `${erro.name ?? 'Error'}:${erro.message ?? ''}`
  let soma = 0
  for (let i = 0; i < semente.length; i++) soma = (Math.imul(31, soma) + semente.charCodeAt(i)) | 0
  return `c${(soma >>> 0).toString(36)}`
}

export function DetalheDoErro({
  erro,
  escuro = false,
}: {
  erro: Error & { digest?: string }
  /** A versão do `global-error`, que roda sem o CSS do app. Ver o arquivo. */
  escuro?: boolean
}) {
  const [copiado, setCopiado] = useState(false)
  const codigo = codigoDoErro(erro)
  const texto = `${codigo}\n${erro.name}: ${erro.message}`

  /**
   * Copiar é o caminho principal, não um extra.
   *
   * Sem ele, reportar um erro vira print de tela — que chega cortado, ilegível
   * na metade que importa, e ainda por cima caro de ler. O botão entrega o
   * texto exato, pronto para colar.
   */
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Navegador sem permissão de área de transferência. O texto continua na
      // tela para ser selecionado à mão — que é o motivo de ele estar visível
      // em vez de viver só dentro do botão.
    }
  }

  // O `global-error` substitui o layout raiz, então lá as cores do tema não
  // existem — só as classes cruas do Tailwind. Daí os hex escritos à mão.
  const rotulo = escuro ? 'text-[#5a6478]' : 'text-dim'
  const corpo = escuro ? 'text-[#8d97a8]' : 'text-muted'

  return (
    <div className="mt-5 rounded-[10px] border border-white/10 bg-white/[0.03] p-3 text-left">
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[10px] font-bold tracking-wider uppercase ${rotulo}`}>
          Código do erro
        </span>
        <button
          type="button"
          onClick={copiar}
          className={`rounded-md border border-white/10 px-2 py-1 text-[10.5px] font-bold transition hover:border-white/25 ${corpo}`}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <code className={`mt-1.5 block font-mono text-[12px] break-all ${escuro ? 'text-[#e9eef5]' : 'text-white'}`}>
        {codigo}
      </code>
      {erro.message && (
        <code className={`mt-2 block font-mono text-[11px] leading-[1.55] break-all ${corpo}`}>
          {erro.name}: {erro.message}
        </code>
      )}
    </div>
  )
}
