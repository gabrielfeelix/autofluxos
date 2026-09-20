'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Modal } from '@/components/design/modal'
import type { Produto } from '@/core/produtos'
import { selecionaveis } from '@/core/produtos'
import { acaoListarProdutos } from '@/server/acoes-produtos'
import { acaoRegistrarVenda } from '@/server/acoes-vendas'

/**
 * Registrar a venda (UI-10, T5.2).
 *
 * ---------------------------------------------------------------------------
 * As três coisas que esta tela recusa dizer
 * ---------------------------------------------------------------------------
 *
 * 1. **Não diz "pago".** Venda registrada quer dizer que a empresa confirmou a
 *    compra (RB-29). O rodapé escreve isso, porque a palavra "venda" numa tela
 *    de CRM é lida como dinheiro na conta, e não é.
 * 2. **Não troca desconhecido por zero.** Valor em branco é `null`, e o
 *    formulário diz "não informado" em vez de mostrar 0,00 (RB-30).
 * 3. **Não mostra sucesso antes do servidor.** O botão fica em "salvando…" até
 *    a resposta; quem fecha o modal no meio não vê uma confirmação que o
 *    servidor ainda não deu (RB-23).
 *
 * A chave da operação é **uma por formulário aberto**, no `ref`, pelo mesmo
 * motivo de `fechar-cartao.tsx`: é ela que faz "tente de novo" ser retry em
 * vez de uma segunda compra, no caso da resposta perdida.
 */
type Linha = { produtoId: string; descricao: string; quantidade: string; valorUnitario: string }

const LINHA_VAZIA: Linha = { produtoId: '', descricao: '', quantidade: '', valorUnitario: '' }

export function RegistrarVenda({
  clienteId,
  cartao,
  aoFechar,
  aoConcluir,
}: {
  clienteId: string
  cartao: { id: string; nome: string; titulo?: string | null; valor?: number | null } | null
  aoFechar: () => void
  aoConcluir: () => void
}) {
  const hoje = new Date().toISOString().slice(0, 10)

  const [dataDaVenda, setDataDaVenda] = useState(hoje)
  const [valorTotal, setValorTotal] = useState(
    cartao?.valor != null ? String(cartao.valor).replace('.', ',') : '',
  )
  const [nota, setNota] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([{ ...LINHA_VAZIA }])
  const [catalogo, setCatalogo] = useState<Produto[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const chave = useRef<string | null>(null)

  useEffect(() => {
    if (!cartao) return
    let valeu = true
    acaoListarProdutos(clienteId)
      .then((r) => {
        if (valeu && r.ok) setCatalogo(r.produtos)
      })
      .catch(() => {
        // O catálogo é opcional: sem ele a venda ainda pode ser registrada com
        // descrição livre. Falhar aqui não pode travar o registro.
      })
    return () => {
      valeu = false
    }
  }, [clienteId, cartao])

  const ativos = selecionaveis(catalogo)

  return (
    <Modal
      aberto={cartao !== null}
      aoFechar={aoFechar}
      titulo={`Registrar venda — ${cartao?.nome ?? ''}`}
      descricao="A oportunidade é marcada como ganha na mesma operação. Se este funil entrega a outro, o cartão de lá abre sozinho."
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
              Data da venda
            </span>
            <input
              type="date"
              value={dataDaVenda}
              max={hoje}
              onChange={(e) => setDataDaVenda(e.target.value)}
              className="app-field w-full px-3 py-2.5 text-[12.5px]"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
              Valor total <span className="font-normal normal-case">(opcional)</span>
            </span>
            <input
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              inputMode="decimal"
              placeholder="não informado"
              className="app-field w-full px-3 py-2.5 text-[12.5px]"
            />
          </label>
        </div>

        <div>
          <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
            O que foi vendido <span className="font-normal normal-case">(opcional)</span>
          </span>
          <div className="flex flex-col gap-2">
            {linhas.map((linha, i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={linha.produtoId}
                  onChange={(e) => {
                    const produto = ativos.find((p) => p.id === e.target.value)
                    trocar(i, {
                      produtoId: e.target.value,
                      // O nome entra na descrição, e é o nome **da época**: a
                      // venda guarda o texto, não uma busca no catálogo.
                      descricao: produto?.nome ?? linha.descricao,
                    })
                  }}
                  aria-label={`Item ${i + 1}`}
                  className="app-field min-w-0 flex-[1.4] px-2 py-2 text-[12px]"
                >
                  <option value="">livre</option>
                  {ativos.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome}
                    </option>
                  ))}
                </select>
                <input
                  value={linha.descricao}
                  onChange={(e) => trocar(i, { descricao: e.target.value })}
                  placeholder="descrição"
                  aria-label={`Descrição do item ${i + 1}`}
                  className="app-field min-w-0 flex-[1.6] px-2 py-2 text-[12px]"
                />
                <input
                  value={linha.quantidade}
                  onChange={(e) => trocar(i, { quantidade: e.target.value })}
                  inputMode="decimal"
                  placeholder="qtd"
                  aria-label={`Quantidade do item ${i + 1}`}
                  className="app-field w-[64px] px-2 py-2 text-[12px]"
                />
                <input
                  value={linha.valorUnitario}
                  onChange={(e) => trocar(i, { valorUnitario: e.target.value })}
                  inputMode="decimal"
                  placeholder="unit."
                  aria-label={`Valor unitário do item ${i + 1}`}
                  className="app-field w-[84px] px-2 py-2 text-[12px]"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLinhas((atual) => [...atual, { ...LINHA_VAZIA }])}
            className="mt-2 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/[0.04]"
          >
            + item
          </button>
          <span className="mt-1.5 block text-[11px] leading-4 text-dim">
            Quantidade e valor em branco ficam como <strong>não informado</strong>, e
            não como zero. O total só é conferido contra os itens quando todos
            estiverem preenchidos.
          </span>
        </div>

        <label>
          <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">
            Nota <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="ex.: número do pedido"
            className="app-field w-full px-3 py-2.5 text-[12.5px]"
          />
        </label>
      </div>

      {erro && (
        <p role="alert" className="mt-2 text-[11.5px] leading-5 text-perigo">
          {erro}
        </p>
      )}

      {/*
        RB-29, escrito na tela e não só no código: "venda" numa tela de CRM é
        lida como dinheiro na conta, e registrar aqui não diz nada sobre
        pagamento.
      */}
      <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] leading-5 text-dim">
        Registrar a venda quer dizer que a compra foi <strong>confirmada</strong>.
        Não quer dizer que foi paga: o pagamento fica como{' '}
        <em>não acompanhado</em>.
      </p>

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={aoFechar}
          className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={rodando}
          onClick={salvar}
          className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:opacity-50"
        >
          {rodando ? 'salvando…' : 'Registrar venda'}
        </button>
      </div>
    </Modal>
  )

  function trocar(i: number, parcial: Partial<Linha>) {
    setLinhas((atual) => atual.map((linha, j) => (j === i ? { ...linha, ...parcial } : linha)))
  }

  function salvar() {
    if (!cartao) return
    setErro(null)

    // Uma chave por formulário aberto, não uma por clique: gerá-la a cada
    // clique seria o mesmo que não ter nenhuma.
    if (!chave.current) chave.current = `venda:${cartao.id}:${crypto.randomUUID()}`

    comecar(async () => {
      try {
        const r = await acaoRegistrarVenda(clienteId, cartao.id, {
          dataDaVenda,
          valorTotal,
          nota,
          itens: linhas,
          chaveDaOperacao: chave.current ?? undefined,
        })
        if (!r.ok) {
          setErro(r.erro ?? 'não deu para registrar')
          return
        }
        aoConcluir()
      } catch {
        setErro('não deu para registrar agora — tente de novo')
      }
    })
  }
}
