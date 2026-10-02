'use client'

import { useState, useTransition } from 'react'
import { Botao } from '@/components/design/botao'
import { acaoAdminSalvarTetoDaApi } from '@/server/acoes-admin'

/**
 * O teto diário de modelos enviados pela API, por organização. Vazio volta ao
 * padrão. Fica na aba Plano porque é limite de contrato, como as conversas.
 */
export function TetoDaApi({ organizacaoId, inicial, padrao }: { organizacaoId: string; inicial: number | null; padrao: number }) {
  const [valor, setValor] = useState(inicial === null ? '' : String(inicial))
  const [salvo, setSalvo] = useState(inicial === null ? '' : String(inicial))
  const [mensagem, setMensagem] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [rodando, comecar] = useTransition()

  const salvar = () =>
    comecar(async () => {
      const limpo = valor.trim()
      const teto = limpo === '' ? null : Number(limpo)
      const r = await acaoAdminSalvarTetoDaApi(organizacaoId, teto)
      if (!r.ok) {
        setMensagem({ tom: 'erro', texto: r.erro ?? 'Não deu para salvar.' })
        return
      }
      setSalvo(limpo)
      setMensagem({ tom: 'ok', texto: teto === null ? `Voltou ao padrão de ${padrao} por dia.` : 'Salvo.' })
    })

  return (
    <section aria-labelledby="titulo-teto-api" className="app-card px-5 py-4">
      <h2 id="titulo-teto-api" className="text-[14px] font-bold">
        Modelos pela API
      </h2>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">
        Quantos modelos aprovados a organização pode enviar pela API por dia. Cada um é cobrado pela Meta. Vazio
        usa o padrão de {padrao}; zero bloqueia o envio.
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(evento) => {
          evento.preventDefault()
          salvar()
        }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100000}
          value={valor}
          onChange={(e) => {
            setValor(e.target.value)
            setMensagem(null)
          }}
          placeholder={`Exemplo: ${padrao}`}
          aria-label="Modelos por dia"
          className="app-field w-40 px-3 py-2 text-[13px] tabular-nums"
        />
        <span className="text-[12.5px] text-muted">por dia</span>
        <Botao type="submit" variante="secundario" disabled={rodando || valor.trim() === salvo}>
          {rodando ? 'Salvando…' : 'Salvar'}
        </Botao>
        {mensagem && (
          <span role="status" className={`text-[12px] ${mensagem.tom === 'erro' ? 'text-perigo' : 'text-muted'}`}>
            {mensagem.texto}
          </span>
        )}
      </form>
    </section>
  )
}
