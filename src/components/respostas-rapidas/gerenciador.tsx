'use client'

import { BotaoPerigo } from '@/components/design/botao-perigo'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import type { RespostaRapida } from '@/server/repos/respostas-rapidas'

/**
 * Cadastro deliberadamente pequeno: um atalho e o texto que ele insere.
 * Editar é apagar e criar de novo por enquanto; não há ordem, categoria ou
 * estado escondido para virar uma tela de CRM antes de existir necessidade.
 */
export function GerenciadorDeRespostasRapidas({
  respostas,
  criar,
  apagar,
}: {
  respostas: RespostaRapida[]
  criar: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
  apagar: (respostaId: string) => Promise<{ ok: boolean; erro?: string }>
}) {
  return (
    <div className="space-y-6">
      <section className="app-card p-6">
        <h2 className="text-[14.5px] font-bold">Nova resposta</h2>
        <p className="mt-1 text-[12px] leading-5 text-dim">
          Clique no atalho dentro do Inbox para inserir o texto no cursor, sem apagar o que já
          estiver sendo escrito.
        </p>

        <FormularioSalvar action={criar} rotulo="Adicionar resposta" dica="O texto pode ter até 4.096 caracteres.">
          <div className="mt-5 grid grid-cols-[170px_minmax(0,1fr)] gap-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Atalho</span>
              <span className="flex items-center rounded-[10px] border border-white/[0.1] bg-white/[0.045] focus-within:border-accent/60">
                <span className="pl-3 text-[13px] text-dim">/</span>
                <input
                  required
                  name="atalho"
                  maxLength={40}
                  pattern="[a-z0-9][a-z0-9_-]{0,39}"
                  placeholder="orcamento"
                  className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[13px] outline-none placeholder:text-dim"
                />
              </span>
              <span className="mt-1.5 block text-[10.5px] text-dim">letras minúsculas, números, _ ou -</span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Mensagem</span>
              <textarea
                required
                name="texto"
                rows={4}
                maxLength={4096}
                placeholder="Oi! Para montar o orçamento, me conta um pouco mais sobre o que você precisa?"
                className="app-field resize-y px-3 py-2.5 text-[13px] leading-5"
              />
            </label>
          </div>
        </FormularioSalvar>
      </section>

      <section className="app-card overflow-hidden">
        <header className="border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-[14.5px] font-bold">Respostas salvas</h2>
          <p className="mt-0.5 text-[12px] text-dim">
            {respostas.length === 0
              ? 'Nenhuma ainda.'
              : `${respostas.length} ${respostas.length === 1 ? 'resposta disponível' : 'respostas disponíveis'} no Inbox.`}
          </p>
        </header>

        {respostas.length === 0 ? (
          <p className="px-6 py-10 text-center text-[12.5px] text-dim">Cadastre a primeira frase que a equipe repete todo dia.</p>
        ) : (
          <ul className="divide-y divide-white/[0.045]">
            {respostas.map((resposta) => (
              <li key={resposta.id} className="flex items-start gap-4 px-6 py-4">
                <span className="mt-0.5 rounded-lg border border-accent/25 bg-accent/[0.08] px-2 py-1 font-mono text-[10.5px] font-bold text-accent">
                  /{resposta.atalho}
                </span>
                <p className="min-w-0 flex-1 text-[12.5px] leading-5 whitespace-pre-wrap text-soft">{resposta.texto}</p>
                <BotaoPerigo
                  acao={apagar.bind(null, resposta.id)}
                  rotulo="Remover"
                  pergunta={`Remover a resposta rápida /${resposta.atalho}?`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
