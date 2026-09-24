'use client'

import { useState, useTransition } from 'react'
import { acaoDefinirLoja } from '@/server/acoes-recursos'

/**
 * Ligar e desligar a Loja no menu (0103, plano de navegação 5.6).
 *
 * Mesmo desenho do `InterruptorDoCrm`: otimista, e a frase de que desligar
 * não apaga nada fica escrita junto do botão. `ativo` é o que a barra mostra
 * hoje (`lojaVisivel`), e não o valor gravado: quem nunca escolheu vê o estado
 * real do menu, e não um "desligado" que não bate com a barra ao lado.
 */
export function InterruptorDaLoja({
  clienteId,
  ativo,
  lojaConectada,
}: {
  clienteId: string
  ativo: boolean
  lojaConectada: boolean
}) {
  const [ligado, setLigado] = useState(ativo)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  function alternar() {
    const alvo = !ligado
    const anterior = ligado
    setLigado(alvo)
    setErro(null)

    comecar(async () => {
      const r = await acaoDefinirLoja(clienteId, alvo)
      if (!r.ok) {
        setLigado(anterior)
        setErro(r.erro ?? 'não deu para salvar')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={alternar}
          disabled={rodando}
          className={`rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition disabled:opacity-50 ${
            ligado
              ? 'border border-line text-muted hover:bg-white/[0.04]'
              : 'bg-accent text-[var(--accent-ink)] hover:opacity-90'
          }`}
        >
          {ligado ? 'Desativar Loja' : 'Ativar Loja'}
        </button>
        <span className="text-[12px] text-muted">
          {ligado ? 'Ligada: a Loja aparece no menu.' : 'Desligada: a Loja não aparece no menu.'}
        </span>
      </div>

      <p className="max-w-[620px] text-[12px] leading-5 text-dim">
        {ligado
          ? 'Desativar só esconde o item do menu. Nada é apagado: o catálogo e a loja cadastrada continuam onde estão, e voltam a aparecer quando você ativar de novo.'
          : 'Ativar mostra a Loja no menu: conectar a sua loja on-line e montar o catálogo que o bot usa para responder sobre produto, preço e estoque.'}
      </p>

      {!ligado && lojaConectada && (
        <p className="max-w-[620px] text-[12px] leading-5 text-muted">
          Esta conta tem uma loja conectada e o bot está consultando ela, então a
          Loja continua no menu mesmo desligada aqui: é lá que se desliga a
          conexão.
        </p>
      )}

      {erro && (
        <p role="alert" className="text-[11.5px] leading-4 text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}
