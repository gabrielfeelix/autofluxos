'use client'

import { useCallback, useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { useConfirmar } from '@/components/design/confirmar'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { acaoEditarRespostaRapida, acaoNovaRespostaRapida, acaoTirarRespostaRapida } from '@/server/acoes-respostas-rapidas'
import type { RespostaRapida } from '@/server/repos/respostas-rapidas'

type Recado = { texto: string; erro?: boolean }

/**
 * Conversas > Respostas rápidas: um atalho e o texto que ele insere.
 *
 * Mesmo desenho de Etiquetas e Segmentos: lista, `⋯` com Editar e Apagar, e o
 * formulário num modal. Criar e editar esperam o servidor aceitar o atalho
 * (ele é único na conta, e só o banco sabe) e aí mudam a lista sem refazer a
 * página. Apagar confirma antes.
 */
export function GerenciadorDeRespostasRapidas({ clienteId, inicial }: { clienteId: string; inicial: RespostaRapida[] }) {
  const [lista, setLista] = useState(inicial)
  const [editando, setEditando] = useState<RespostaRapida | 'nova' | null>(null)
  const [recado, setRecado] = useState<Recado | null>(null)
  const { confirmar, dialogo } = useConfirmar()
  const sumir = useCallback(() => setRecado(null), [])

  const apagar = (r: RespostaRapida) =>
    confirmar({
      titulo: `Apagar /${r.atalho}?`,
      descricao: 'Ela some da caixa de resposta de quem atende. As mensagens já enviadas com ela não mudam.',
      rotulo: 'Apagar resposta',
      aoConfirmar: async () => {
        const resultado = await acaoTirarRespostaRapida(clienteId, r.id)
        if (!resultado.ok) return { ok: false, erro: resultado.erro }
        setLista((atual) => atual.filter((x) => x.id !== r.id))
        setRecado({ texto: `Resposta /${r.atalho} apagada.` })
        return { ok: true }
      },
    })

  return (
    <section className="app-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-bold">
            {lista.length} {lista.length === 1 ? 'resposta' : 'respostas'}
          </h2>
          {lista.length > 0 && <p className="mt-0.5 text-[12px] text-dim">Aparecem na caixa de resposta das Conversas.</p>}
        </div>
        <button type="button" onClick={() => setEditando('nova')} className="app-primary-button h-9 px-4 text-[13px]">
          + Nova resposta
        </button>
      </header>

      {lista.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="text-[13.5px] font-semibold text-soft">Nenhuma resposta ainda</p>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[12.5px] leading-5 text-dim">
            Cadastre a frase que a equipe repete todo dia, como o endereço, o horário ou o primeiro passo do orçamento.
            Na conversa, ela entra com um clique.
          </p>
          <button type="button" onClick={() => setEditando('nova')} className="app-primary-button mt-5 h-9 px-4 text-[13px]">
            Criar a primeira resposta
          </button>
        </div>
      ) : (
        <ul>
          {lista.map((r) => (
            <li key={r.id} className="flex items-start gap-4 border-t border-line-soft px-5 py-3.5 first:border-t-0">
              <button
                type="button"
                onClick={() => setEditando(r)}
                title="Editar"
                className="mt-0.5 shrink-0 rounded-lg border border-primary/25 bg-primary/[0.08] px-2 py-1 font-mono text-[11px] font-bold text-primary hover:border-primary/50"
              >
                /{r.atalho}
              </button>
              <p className="line-clamp-3 min-w-0 flex-1 text-[13px] leading-5 whitespace-pre-wrap text-soft">{r.texto}</p>
              <PopoverDoQuadro
                rotulo={`Mais ações para /${r.atalho}`}
                largura={180}
                gatilho={<span aria-hidden className="px-0.5 text-[14px] leading-none">⋯</span>}
              >
                <button type="button" data-fechar-popover className="quadro-menu-item" onClick={() => setEditando(r)}>
                  Editar
                </button>
                <button
                  type="button"
                  data-fechar-popover
                  className="quadro-menu-item quadro-danger mt-1 border-t border-line text-perigo"
                  onClick={() => apagar(r)}
                >
                  Apagar…
                </button>
              </PopoverDoQuadro>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <FormularioDaResposta
          key={editando === 'nova' ? 'nova' : editando.id}
          clienteId={clienteId}
          resposta={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(salva) => {
            const nova = editando === 'nova'
            setLista((atual) => (nova ? [...atual, salva] : atual.map((x) => (x.id === salva.id ? salva : x))))
            setEditando(null)
            setRecado({ texto: nova ? `Resposta /${salva.atalho} criada.` : `Resposta /${salva.atalho} salva.` })
          }}
        />
      )}

      {dialogo}

      {/* Sempre montada: região viva que nasce junto do texto não é lida. */}
      <span role="status" className="sr-only">
        {recado?.texto ?? ''}
      </span>
      {recado && (
        <AvisoFlutuante tom={recado.erro ? 'erro' : 'neutro'} aoSumir={sumir}>
          {recado.texto}
        </AvisoFlutuante>
      )}
    </section>
  )
}

function FormularioDaResposta({
  clienteId,
  resposta,
  aoFechar,
  aoSalvar,
}: {
  clienteId: string
  resposta: RespostaRapida | null
  aoFechar: () => void
  aoSalvar: (salva: RespostaRapida) => void
}) {
  const [atalho, setAtalho] = useState(resposta?.atalho ?? '')
  const [texto, setTexto] = useState(resposta?.texto ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()
  const vazio = atalho.trim() === '' || texto.trim() === ''

  return (
    <Modal
      aberto
      largura={520}
      aoFechar={() => !rodando && aoFechar()}
      titulo={resposta ? `Editar /${resposta.atalho}` : 'Nova resposta rápida'}
      descricao="Na conversa, clique no atalho para inserir o texto onde está o cursor, sem apagar o que já foi escrito."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(evento) => {
          evento.preventDefault()
          setErro(null)
          comecar(async () => {
            const dados = { atalho, texto }
            const r = await (resposta
              ? acaoEditarRespostaRapida(clienteId, resposta.id, dados)
              : acaoNovaRespostaRapida(clienteId, dados)
            ).catch(() => ({ ok: false, erro: 'sem conexão com o servidor', resposta: undefined }))
            if (r.ok && r.resposta) aoSalvar(r.resposta)
            else setErro(r.erro ?? 'não deu para salvar')
          })
        }}
      >
        <label className="block">
          <RotuloCampo>Atalho</RotuloCampo>
          <span className="flex items-center rounded-[10px] border border-line bg-surface focus-within:border-primary/60">
            <span className="pl-3 text-[13px] text-dim">/</span>
            <input
              required
              autoFocus
              value={atalho}
              onChange={(e) => setAtalho(e.target.value.toLowerCase())}
              maxLength={40}
              pattern="[a-z0-9][a-z0-9_\-]{0,39}"
              placeholder="Exemplo: orcamento"
              className="min-w-0 flex-1 bg-transparent px-1 py-[11px] text-[13.5px] outline-none placeholder:text-dim"
            />
          </span>
          <span className="mt-1.5 block text-[11px] text-dim">Letras minúsculas, números, _ ou -</span>
        </label>

        <label className="block">
          <RotuloCampo>Mensagem</RotuloCampo>
          <textarea
            required
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            maxLength={4096}
            placeholder="Exemplo: Oi! Para montar o orçamento, me conta um pouco mais sobre o que você precisa?"
            className="app-field resize-y px-3 py-2.5 text-[13px] leading-5"
          />
          <span className="mt-1.5 block text-[11px] text-dim tabular-nums">{texto.length} de 4.096 caracteres</span>
        </label>

        {erro && (
          <p role="alert" className="text-[12.5px] text-perigo">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={aoFechar} disabled={rodando} className="app-secondary-button h-9 px-4 text-[13px]">
            Cancelar
          </button>
          <button type="submit" disabled={rodando || vazio} className="app-primary-button h-9 px-4 text-[13px]">
            {rodando ? 'Salvando…' : resposta ? 'Salvar' : 'Criar resposta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
