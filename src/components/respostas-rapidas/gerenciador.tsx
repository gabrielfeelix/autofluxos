'use client'

import { BotaoPerigo } from '@/components/design/botao-perigo'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
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
      <section className="app-card overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-4">
          <div className="min-w-0">
          <h2 className="text-[14.5px] font-bold">Respostas salvas</h2>
          <p className="mt-0.5 text-[12px] text-dim">
            {respostas.length === 0
              ? 'Nenhuma ainda.'
              : `${respostas.length} ${respostas.length === 1 ? 'resposta disponível' : 'respostas disponíveis'} no Inbox.`}
          </p>
          </div>
          <ModalFormulario
            botao="+ Nova resposta"
            titulo="Nova resposta rápida"
            descricao="Clique no atalho dentro do Inbox para inserir o texto no cursor, sem apagar o que já estiver sendo escrito."
            rotuloEnviar="Adicionar"
            variante={respostas.length === 0 ? 'primario' : 'secundario'}
            action={criar.bind(null, {})}
          >
            <label className="block">
              <RotuloCampo>Atalho</RotuloCampo>
              <span className="flex items-center rounded-[10px] border border-white/[0.1] bg-white/[0.045] focus-within:border-accent/60">
                <span className="pl-3 text-[13px] text-dim">/</span>
                <input
                  required
                  autoFocus
                  name="atalho"
                  maxLength={40}
                  pattern="[a-z0-9][a-z0-9_-]{0,39}"
                  placeholder="orcamento"
                  className="min-w-0 flex-1 bg-transparent px-1 py-[11px] text-[13.5px] outline-none placeholder:text-dim"
                />
              </span>
              <span className="mt-1.5 block text-[10.5px] text-dim">
                letras minúsculas, números, _ ou -
              </span>
            </label>

            <label className="block">
              <RotuloCampo>Mensagem</RotuloCampo>
              <textarea
                required
                name="texto"
                rows={5}
                maxLength={4096}
                placeholder="Oi! Para montar o orçamento, me conta um pouco mais sobre o que você precisa?"
                className="app-field resize-y px-3 py-2.5 text-[13px] leading-5"
              />
              <span className="mt-1.5 block text-[10.5px] text-dim">até 4.096 caracteres</span>
            </label>
          </ModalFormulario>
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
