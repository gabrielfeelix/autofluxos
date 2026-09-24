'use client'

import { useActionState, useState } from 'react'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import type { LinhaRecusada } from '@/server/acoes'

type Estado = EstadoSalvar & { resumo?: string; recusadas?: LinhaRecusada[] }

/**
 * Importa a planilha de contatos do cliente.
 *
 * **O resultado é a parte que importa, não o formulário.** O dono do negócio
 * manda um CSV exportado do Excel dele, e o que ele precisa saber depois é
 * quantas linhas casaram com quem já conversou, quantas viraram contato novo e,
 * principalmente, **quais não entraram e por quê**. Importação que engole 40
 * de 300 linhas em silêncio é pior do que importação que recusa.
 *
 * As recusadas voltam editáveis na própria tela, e "Tentar de novo" manda só
 * elas: consertar o telefone de três linhas não deveria exigir abrir o Excel,
 * salvar outro CSV e reler o resumo das trezentas.
 */
export function ImportarContatos({
  acao,
}: {
  acao: (estado: Estado, formData: FormData) => Promise<Estado>
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(acao, {})
  const recusadas = estado.ok ? (estado.recusadas ?? []) : []

  return (
    <section className="app-card p-6">
      <h2 className="text-[14.5px] font-bold">Importar da planilha</h2>
      <p className="mt-1 max-w-[620px] text-[12.5px] leading-5 text-dim">
        Um CSV com uma coluna de nome e uma de telefone, exportado do Excel ou do Google
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
          className="app-field max-w-[380px] px-3 py-2.5 text-[13.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-surface-strong file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-soft"
        />
        <button
          type="submit"
          disabled={enviando}
          className="app-primary-button px-5 py-2.5 text-[13.5px] disabled:opacity-50"
        >
          {enviando ? 'Importando…' : 'Importar'}
        </button>
      </form>

      {estado.erro && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/[0.07] px-3.5 py-2.5 text-[13px] leading-5 text-perigo"
        >
          {estado.erro}
        </p>
      )}

      {estado.ok && estado.resumo && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3.5 py-2.5"
        >
          <p className="text-[13px] font-semibold text-ok">{estado.resumo}</p>
        </div>
      )}

      {recusadas.length > 0 && (
        /*
          `key` com as linhas: cada volta do servidor traz outra lista, e o que
          foi digitado na lista anterior não vale para a nova.
        */
        <Recusadas
          key={recusadas.map((r) => r.numero).join(',')}
          recusadas={recusadas}
          enviar={enviar}
          enviando={enviando}
        />
      )}
    </section>
  )
}

function Recusadas({
  recusadas,
  enviar,
  enviando,
}: {
  recusadas: LinhaRecusada[]
  enviar: (dados: FormData) => void
  enviando: boolean
}) {
  const [linhas, setLinhas] = useState(() =>
    recusadas.map(({ numero, nome, telefone }) => ({ numero, nome, telefone })),
  )

  function mudar(numero: number, campo: 'nome' | 'telefone', valor: string) {
    setLinhas((atuais) => atuais.map((l) => (l.numero === numero ? { ...l, [campo]: valor } : l)))
  }

  return (
    <form action={enviar} className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/[0.05] p-3.5">
      <input type="hidden" name="linhas" value={JSON.stringify(linhas)} />
      <p className="text-[13px] font-semibold text-aviso">
        {recusadas.length === 1 ? '1 linha não entrou' : `${recusadas.length} linhas não entraram`}
      </p>
      <p className="mt-0.5 text-[12px] leading-5 text-dim">
        Corrija aqui e tente de novo: só estas linhas são enviadas. O número é o da linha na sua
        planilha.
      </p>

      <ul className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
        {recusadas.map((r) => {
          const linha = linhas.find((l) => l.numero === r.numero)
          return (
            <li key={r.numero} className="flex flex-wrap items-center gap-2">
              <span className="w-[62px] shrink-0 font-mono text-[12px] text-muted">linha {r.numero}</span>
              <input
                aria-label={`Nome da linha ${r.numero}`}
                value={linha?.nome ?? ''}
                onChange={(e) => mudar(r.numero, 'nome', e.target.value)}
                placeholder="nome"
                className="app-field w-[180px] px-2.5 py-1.5 text-[12.5px]"
              />
              <input
                aria-label={`Telefone da linha ${r.numero}`}
                value={linha?.telefone ?? ''}
                onChange={(e) => mudar(r.numero, 'telefone', e.target.value)}
                placeholder="telefone com DDD"
                inputMode="tel"
                className="app-field w-[170px] px-2.5 py-1.5 text-[12.5px] tabular-nums"
              />
              <span className="min-w-[160px] flex-1 text-[12px] leading-4 text-perigo">{r.motivo}</span>
            </li>
          )
        })}
      </ul>

      <button
        type="submit"
        disabled={enviando}
        className="app-primary-button mt-3 px-4 py-2 text-[13px] disabled:opacity-50"
      >
        {enviando
          ? 'Importando…'
          : recusadas.length === 1
            ? 'Tentar de novo esta linha'
            : `Tentar de novo estas ${recusadas.length} linhas`}
      </button>
    </form>
  )
}
