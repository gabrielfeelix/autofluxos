'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/design/modal'
import { acaoRemoverDaConta } from '@/server/acoes'

export type Pendencias = { conversas: number; cartoes: number; atividades: number }

const SEM_RESPONSAVEL = 'ninguem'

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

/**
 * Tirar alguém da conta com o destino do que era dela (E15).
 *
 * Com pendência aberta, confirmar exige escolher para onde elas vão: outra
 * pessoa, ou "sem responsável" (a fila). Não há escolha padrão de propósito:
 * padrão seria decidir por quem clicou rápido. O servidor reatribui e remove
 * na mesma transação.
 */
export function RemoverComDestino({
  clienteId,
  membro,
  pendencias,
  pessoas,
  aoFechar,
}: {
  clienteId: string
  membro: { id: string; nome: string }
  pendencias: Pendencias
  pessoas: { id: string; nome: string }[]
  aoFechar: () => void
}) {
  const [destino, setDestino] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const itens = [
    pendencias.conversas > 0 && plural(pendencias.conversas, 'conversa', 'conversas'),
    pendencias.cartoes > 0 && plural(pendencias.cartoes, 'negociação aberta', 'negociações abertas'),
    pendencias.atividades > 0 && plural(pendencias.atividades, 'atividade aberta', 'atividades abertas'),
  ].filter((item): item is string => Boolean(item))
  const temPendencia = itens.length > 0
  const outras = pessoas.filter((pessoa) => pessoa.id !== membro.id)

  const confirmar = () => {
    if (temPendencia && destino === null) return
    setErro(null)
    comecar(async () => {
      const r = await acaoRemoverDaConta(
        clienteId,
        membro.id,
        destino === null || destino === SEM_RESPONSAVEL ? null : destino,
      )
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para tirar da conta')
        return
      }
      aoFechar()
    })
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Tirar ${membro.nome} desta conta?`}
      descricao="A pessoa continua existindo no sistema e o histórico dela fica como está."
      largura={460}
    >
      {temPendencia ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] leading-5 text-muted">
            Está com {membro.nome}: {itens.join(', ')}. Para quem vai?
          </legend>
          {outras.map((pessoa) => (
            <Opcao
              key={pessoa.id}
              marcada={destino === pessoa.id}
              aoMarcar={() => setDestino(pessoa.id)}
              rotulo={pessoa.nome}
            />
          ))}
          <Opcao
            marcada={destino === SEM_RESPONSAVEL}
            aoMarcar={() => setDestino(SEM_RESPONSAVEL)}
            rotulo="Deixar sem responsável"
            detalhe="as conversas voltam para a fila de quem ninguém assumiu"
          />
        </fieldset>
      ) : (
        <p className="text-[13px] leading-5 text-dim">
          {membro.nome} não tem conversa, negociação nem atividade aberta.
        </p>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-[12px] leading-5 text-perigo">
          {erro}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={aoFechar}
          className="rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-semibold text-dim transition hover:text-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={rodando || (temPendencia && destino === null)}
          className="rounded-lg bg-perigo px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {rodando ? 'Tirando…' : 'Tirar da conta'}
        </button>
      </div>
    </Modal>
  )
}

function Opcao({
  marcada,
  aoMarcar,
  rotulo,
  detalhe,
}: {
  marcada: boolean
  aoMarcar: () => void
  rotulo: string
  detalhe?: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] transition ${
        marcada ? 'border-primary bg-primary-weak' : 'border-line hover:bg-surface'
      }`}
    >
      <input type="radio" name="destino" checked={marcada} onChange={aoMarcar} className="mt-0.5" />
      <span>
        <span className="block font-semibold">{rotulo}</span>
        {detalhe && <span className="block text-[11.5px] text-dim">{detalhe}</span>}
      </span>
    </label>
  )
}
