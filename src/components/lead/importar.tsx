'use client'

import { useActionState } from 'react'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'

type Estado = EstadoSalvar & { resumo?: string; pendentes?: string[] }

/**
 * Importa a planilha de contatos do cliente.
 *
 * **O resultado é a parte que importa, não o formulário.** O dono do negócio
 * manda um CSV exportado do Excel dele, e o que ele precisa saber depois é
 * quantas linhas casaram com quem já conversou, quantas viraram contato novo e
 * — principalmente — **quais não entraram e por quê**. Importação que engole 40
 * de 300 linhas em silêncio é pior do que importação que recusa.
 */
export function ImportarContatos({
  acao,
}: {
  acao: (estado: Estado, formData: FormData) => Promise<Estado>
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(acao, {})

  return (
    <section className="app-card p-6">
      <h2 className="text-[14.5px] font-bold">Importar da planilha</h2>
      <p className="mt-1 max-w-[620px] text-[12px] leading-5 text-dim">
        Um CSV com uma coluna de nome e uma de telefone — exportado do Excel ou do Google
        Planilhas, do jeito que estiver. O telefone casa com quem já conversou mesmo se estiver
        escrito de outro jeito, <strong className="text-soft">inclusive sem o nono dígito</strong>.
        Nada é apagado: nome corrigido pode ser desfeito e contato criado pode ser removido.
      </p>

      <form action={enviar} className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="planilha"
          required
          accept=".csv,text/csv"
          className="app-field max-w-[380px] px-3 py-2.5 text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-soft"
        />
        <button
          type="submit"
          disabled={enviando}
          className="app-primary-button px-5 py-2.5 text-[13px] disabled:opacity-50"
        >
          {enviando ? 'Importando…' : 'Importar'}
        </button>
      </form>

      {estado.erro && (
        <p className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/[0.07] px-3.5 py-2.5 text-[12.5px] leading-5 text-rose-200">
          {estado.erro}
        </p>
      )}

      {estado.ok && estado.resumo && (
        <div className="mt-4 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold text-emerald-200">{estado.resumo}</p>

          {estado.pendentes && estado.pendentes.length > 0 && (
            <details className="mt-2.5">
              <summary className="cursor-pointer text-[12px] text-amber-200">
                Ver as {estado.pendentes.length} que não entraram
              </summary>
              {/* Com o número da linha, porque "40 sem importar" não diz quais
                  e a pessoa precisa achá-las na planilha dela. */}
              <ul className="mt-2 max-h-56 space-y-1 overflow-auto font-mono text-[11px] text-muted">
                {estado.pendentes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
