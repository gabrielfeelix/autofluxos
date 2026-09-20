'use client'

import { useState, useTransition } from 'react'
import { acaoArquivarEquipe, acaoCriarEquipe } from '@/server/acoes-acesso'

/**
 * As equipes da conta (RB-40).
 *
 * Equipe é o que dá sentido ao escopo "da equipe": sem nenhuma, esse escopo
 * alcança zero registros e vira um jeito confuso de dizer "não pode". Por isso
 * a caixa fica **na mesma tela** do acesso, e não numa página própria — quem
 * descobre que precisa de equipe é quem está editando permissão.
 *
 * Arquivar em vez de apagar: há oportunidade e histórico apontando para ela, e
 * apagar em cascata transformaria "a equipe Norte fechou isso" em "ninguém
 * fechou isso" (RB-24).
 */
export function GerenciarEquipes({
  clienteId,
  equipes,
}: {
  clienteId: string
  equipes: { id: string; nome: string; pessoas: number }[]
}) {
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const criar = () => {
    const limpo = nome.trim()
    if (limpo === '') return
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarEquipe(clienteId, limpo)
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para criar a equipe')
        return
      }
      setNome('')
    })
  }

  const arquivar = (equipe: { id: string; nome: string; pessoas: number }) => {
    setErro(null)
    const aviso =
      equipe.pessoas > 0
        ? `\n\n${equipe.pessoas} pessoa(s) perdem o escopo desta equipe. Quem estiver em "da equipe dela" e não tiver outra passa a não alcançar nada.`
        : ''
    if (!confirm(`Arquivar a equipe ${equipe.nome}? O histórico continua legível.${aviso}`)) return

    comecar(async () => {
      const r = await acaoArquivarEquipe(clienteId, equipe.id)
      if (!r.ok) setErro(r.erro ?? 'não deu para arquivar')
    })
  }

  return (
    <section className="app-card mt-6 overflow-hidden">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-[14.5px] font-bold">Equipes</h2>
        <p className="mt-1 max-w-[620px] text-[12px] leading-5 text-dim">
          Agrupam gente para o escopo <strong className="text-muted">da equipe dela</strong>{' '}
          no acesso. Uma pessoa pode estar em mais de uma — quem cobre duas praças
          não precisa de um papel novo.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') criar()
          }}
          placeholder="Nome da equipe (Norte, Vendas, Suporte…)"
          className="app-field min-w-0 flex-1 px-3 py-2 text-[13px]"
        />
        <button
          type="button"
          onClick={criar}
          disabled={rodando || nome.trim() === ''}
          className="rounded-lg border border-line px-3 py-2 text-[12px] font-semibold text-muted transition hover:text-claro disabled:opacity-40"
        >
          Criar equipe
        </button>
      </div>

      {equipes.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs leading-5 text-dim">
          Nenhuma equipe ainda. Sem equipe, o escopo &ldquo;da equipe dela&rdquo; não
          alcança nada — crie uma antes de usá-lo no acesso.
        </p>
      ) : (
        <ul>
          {equipes.map((equipe) => (
            <li
              key={equipe.id}
              className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 last:border-0"
            >
              <span className="min-w-0">
                <strong className="block truncate text-[13px] font-semibold">{equipe.nome}</strong>
                <span className="text-[11.5px] text-dim">
                  {equipe.pessoas} {equipe.pessoas === 1 ? 'pessoa' : 'pessoas'}
                </span>
              </span>
              <button
                type="button"
                disabled={rodando}
                onClick={() => arquivar(equipe)}
                className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-rose-400/40 hover:text-perigo disabled:opacity-50"
              >
                Arquivar
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p role="alert" className="px-5 pb-3.5 text-[11.5px] text-perigo">
          {erro}
        </p>
      )}
    </section>
  )
}
