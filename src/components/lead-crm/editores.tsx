'use client'

import { useState } from 'react'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { Modal } from '@/components/design/modal'
import { acaoCorrigirNome, acaoSalvarNotas } from '@/server/acoes'
import { acaoDescreverCartao } from '@/server/acoes-crm'
import { comoDinheiro, lerValor, LIMITE_DO_TITULO } from '@/core/crm'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'

export function EditarTextoDoContato({
  clienteId,
  contatoId,
  tipo,
  valor,
  aoSalvar,
}: {
  clienteId: string
  contatoId: string
  tipo: 'nome' | 'notas'
  valor: string
  aoSalvar: (valor: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [rascunho, setRascunho] = useState(valor)
  const [erro, setErro] = useState<string | null>(null)
  const titulo = tipo === 'nome' ? 'Editar nome' : 'Editar anotação'
  return (
    <>
      <button
        type="button"
        className="crm-edit"
        aria-label={titulo}
        onClick={() => {
          setRascunho(valor)
          setErro(null)
          setAberto(true)
        }}
      >
        {tipo === 'nome' ? 'Editar' : valor ? 'Editar' : '+ Anotar'}
      </button>
      <Modal
        aberto={aberto}
        aoFechar={() => {
          setAberto(false)
        }}
        titulo={titulo}
        descricao={
          tipo === 'nome'
            ? 'O nome de exibição usado pela sua equipe.'
            : 'Uma nota interna para a equipe. Não é enviada ao contato.'
        }
      >
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            setErro(null)
            const texto = rascunho.trim()
            if (tipo === 'nome' && !texto) {
              setErro('Informe um nome para o contato.')
              return
            }
            /*
             * Era "Salvando…" até o servidor responder, e o servidor ainda
             * redesenhava a ficha. Agora o texto aparece e o modal fecha no
             * clique; se o servidor recusar, o valor antigo volta e o modal
             * reabre com o texto digitado e o motivo.
             */
            const antes = valor
            aoSalvar(texto)
            setAberto(false)
            const form = new FormData()
            form.set(tipo, texto)
            const desfazer = (motivo: string) => {
              aoSalvar(antes)
              setRascunho(texto)
              setErro(motivo)
              setAberto(true)
            }
            depoisDaTela(() =>
              (tipo === 'nome' ? acaoCorrigirNome : acaoSalvarNotas)(clienteId, contatoId, {}, form),
            ).then(
              (resposta) => {
                if (resposta.erro || !resposta.ok) desfazer(resposta.erro ?? 'Não foi possível salvar.')
              },
              () => desfazer('Não foi possível salvar. Seu texto foi mantido; tente novamente.'),
            )
          }}
        >
          <label className="crm-field">
            <span>{tipo === 'nome' ? 'Nome do contato' : 'Anotação da equipe'}</span>
            {tipo === 'nome' ? (
              <input
                autoFocus
                required
                maxLength={120}
                className="app-field px-3 py-2.5 text-sm"
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
              />
            ) : (
              <textarea
                autoFocus
                rows={6}
                maxLength={LIMITE_DA_NOTA}
                className="app-field resize-y px-3 py-2.5 text-sm"
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
              />
            )}
          </label>
          {erro && (
            <p role="alert" className="mt-3 text-xs text-perigo">
              {erro}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="crm-button"
              onClick={() => setAberto(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="app-primary-button px-4 py-2 text-xs"
            >
              Salvar alterações
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

export function DetalhesDaOportunidade({
  clienteId,
  cartaoId,
  titulo,
  valor,
  aoSalvar,
}: {
  clienteId: string
  cartaoId: string
  titulo: string | null
  valor: number | null
  aoSalvar?: (dados: { titulo: string | null; valor: number | null }) => void
}) {
  const [confirmado, setConfirmado] = useState({ titulo, valor })
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(titulo ?? '')
  const [preco, setPreco] = useState(valor === null ? '' : String(valor).replace('.', ','))
  const [erro, setErro] = useState<string | null>(null)
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-[15px] font-semibold text-ink">
            {confirmado.titulo || 'Oportunidade sem título'}
          </h3>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${confirmado.valor === null ? 'text-muted text-[12px] font-normal' : 'text-ink'}`}
          >
            {confirmado.valor === null ? 'Valor não informado' : comoDinheiro(confirmado.valor)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Editar negociação"
          className="crm-edit"
          onClick={() => {
            setNome(confirmado.titulo ?? '')
            setPreco(confirmado.valor === null ? '' : String(confirmado.valor).replace('.', ','))
            setErro(null)
            setEditando(true)
          }}
        >
          Editar
        </button>
      </div>
      <Modal
        aberto={editando}
        aoFechar={() => {
          setEditando(false)
        }}
        titulo="Editar negociação"
        descricao="Descreva a oportunidade e o valor estimado. Isso não registra uma venda."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setErro(null)
            const lido = lerValor(preco)
            if (!lido.ok) {
              setErro(lido.motivo)
              return
            }
            const proximo = { titulo: nome.trim() || null, valor: lido.valor }
            const antes = confirmado
            const digitado = { nome, preco }
            setConfirmado(proximo)
            setEditando(false)
            aoSalvar?.(proximo)
            const desfazer = (motivo: string) => {
              setConfirmado(antes)
              aoSalvar?.(antes)
              setNome(digitado.nome)
              setPreco(digitado.preco)
              setErro(motivo)
              setEditando(true)
            }
            depoisDaTela(() => acaoDescreverCartao(clienteId, cartaoId, { titulo: nome.trim(), valor: preco })).then(
              (r) => {
                if (!r.ok) desfazer(r.erro ?? 'Não foi possível salvar.')
              },
              () => desfazer('Não foi possível salvar. Tente novamente.'),
            )
          }}
          className="space-y-4"
        >
          <label className="crm-field">
            <span>Título da negociação</span>
            <input
              autoFocus
              maxLength={LIMITE_DO_TITULO}
              className="app-field px-3 py-2.5 text-sm"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Plano anual"
            />
          </label>
          <label className="crm-field">
            <span>Valor estimado (R$)</span>
            <input
              inputMode="decimal"
              className="app-field px-3 py-2.5 text-sm"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="Não informado"
            />
          </label>
          {erro && (
            <p role="alert" className="text-xs text-perigo">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="crm-button"
              onClick={() => setEditando(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="app-primary-button px-4 py-2 text-xs"
            >
              Salvar alterações
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
