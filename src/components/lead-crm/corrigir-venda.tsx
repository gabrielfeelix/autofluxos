'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/design/modal'
import { acaoCancelarVenda } from '@/server/acoes-vendas'

/**
 * Cancelar o registro de uma venda (UI-12, RB-31).
 *
 * ---------------------------------------------------------------------------
 * O destino é obrigatório, e é por isso que este modal existe
 * ---------------------------------------------------------------------------
 *
 * Cancelar a venda **e** decidir o que acontece com a oportunidade são a mesma
 * operação. Se fossem dois passos, existiria um instante, e, na prática, um
 * estado permanente quando alguém fecha a aba no meio, em que a oportunidade
 * está ganha e não há venda válida nenhuma. É exatamente o que a RB-31 proíbe.
 *
 * Por isso não há opção pré-selecionada nem caminho de "decidir depois": as
 * duas respostas possíveis são reabrir ou marcar como perdida, e quem cancela
 * escolhe uma.
 *
 * ---------------------------------------------------------------------------
 * As duas frases que a tela precisa dizer
 * ---------------------------------------------------------------------------
 *
 * 1. **Não apaga.** O registro continua legível, com motivo e data, e sai dos
 *    indicadores. Sem isso ninguém consegue explicar por que o total do mês
 *    mudou.
 * 2. **Não estorna.** Cancelar aqui não devolve dinheiro a ninguém: o produto
 *    não fala com pagamento, e deixar isso implícito seria deixar alguém
 *    achar que o reembolso foi feito.
 */
export function CorrigirVenda({
  clienteId,
  venda,
  motivos,
  aoFechar,
  aoConcluir,
}: {
  clienteId: string
  venda: { id: string; titulo: string; valorTotal: number | null } | null
  /** Os motivos de perda da conta. Lista fechada, como no fechamento normal. */
  motivos: { id: string; nome: string }[]
  aoFechar: () => void
  aoConcluir: () => void
}) {
  const [motivo, setMotivo] = useState('')
  // Sem opção pré-selecionada: a escolha precisa ser explícita.
  const [destino, setDestino] = useState<'' | 'reabrir' | 'perdida'>('')
  const [motivoDaPerda, setMotivoDaPerda] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  return (
    <Modal
      aberto={venda !== null}
      aoFechar={aoFechar}
      titulo="Cancelar o registro da venda"
      descricao="O registro continua existindo, com o motivo e a data, e sai dos indicadores. Cancelar aqui não faz estorno financeiro."
    >
      <div className="flex flex-col gap-3">
        <label>
          <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
            Por que está sendo cancelada
          </span>
          <input
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="ex.: lançada na oportunidade errada"
            className="app-field w-full px-3 py-2.5 text-[12.5px]"
          />
        </label>

        <div>
          <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
            E a oportunidade
          </span>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="radio"
                name="destino"
                checked={destino === 'reabrir'}
                onChange={() => setDestino('reabrir')}
              />
              <span>
                Volta a ficar <strong>aberta</strong>
                <span className="block text-[11px] leading-4 text-dim">
                  A negociação continua: dá para registrar outra venda nela depois.
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="radio"
                name="destino"
                checked={destino === 'perdida'}
                onChange={() => setDestino('perdida')}
              />
              <span>
                Vira <strong>perdida</strong>
                <span className="block text-[11px] leading-4 text-dim">
                  A negociação acabou sem compra.
                </span>
              </span>
            </label>
          </div>
        </div>

        {destino === 'perdida' && (
          <label>
            <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
              Motivo da perda
            </span>
            <select
              value={motivoDaPerda}
              onChange={(e) => setMotivoDaPerda(e.target.value)}
              className="app-field w-full px-3 py-2.5 text-[12.5px]"
            >
              <option value="">escolha um motivo</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.nome}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {erro && (
        <p role="alert" className="mt-2 text-[11.5px] leading-5 text-perigo">
          {erro}
        </p>
      )}

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={aoFechar}
          className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
        >
          Voltar
        </button>
        <button
          type="button"
          disabled={rodando || destino === ''}
          onClick={salvar}
          className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:opacity-50"
        >
          {rodando ? 'cancelando…' : 'Cancelar a venda'}
        </button>
      </div>
    </Modal>
  )

  function salvar() {
    if (!venda || destino === '') return
    setErro(null)

    comecar(async () => {
      try {
        const r = await acaoCancelarVenda(clienteId, venda.id, {
          motivo,
          destino,
          motivoDaPerda: destino === 'perdida' ? motivoDaPerda : undefined,
        })
        if (!r.ok) {
          setErro(r.erro ?? 'não deu para cancelar')
          return
        }
        aoConcluir()
      } catch {
        setErro('não deu para cancelar agora, tente de novo')
      }
    })
  }
}
