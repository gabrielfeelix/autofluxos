'use client'

import { useState, useTransition } from 'react'
import { Botao } from '@/components/design/botao'
import { acaoAdminSalvarCobranca } from '@/server/acoes-admin'
import type { CobrancaDaConta, FormaDeCobranca } from '@/server/repos/faturas-da-conta'

const FORMAS: { valor: FormaDeCobranca; rotulo: string; descricao: string }[] = [
  { valor: 'asaas', rotulo: 'Pelo app', descricao: 'Assina em Plano e consumo e paga pelo Asaas, com nota fiscal e régua de atraso.' },
  { valor: 'por_fora', rotulo: 'Por fora', descricao: 'Pix ou transferência combinado com a 4YU. Não vê o botão Assinar.' },
  { valor: 'cortesia', rotulo: 'Cortesia', descricao: 'Não paga: organização de teste ou parceira. Não vê o botão Assinar.' },
]

/**
 * Como a 4YU cobra esta organização (0148). O controle interno de quem paga
 * por fora e de quem não paga, ao lado do plano, que é o que se cobra.
 */
export function FormaDeCobrancaDaOrganizacao({
  organizacaoId,
  inicial,
  assinaturaAtiva,
}: {
  organizacaoId: string
  inicial: CobrancaDaConta
  /** Já assina pelo Asaas: trocar para por fora não cancela a assinatura sozinho. */
  assinaturaAtiva: boolean
}) {
  const [forma, setForma] = useState<FormaDeCobranca>(inicial.forma)
  const [valor, setValor] = useState(inicial.valor === null ? '' : String(inicial.valor).replace('.', ','))
  const [dia, setDia] = useState(inicial.dia === null ? '' : String(inicial.dia))
  const [nota, setNota] = useState(inicial.nota ?? '')
  const [mensagem, setMensagem] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [rodando, comecar] = useTransition()

  const salvar = () =>
    comecar(async () => {
      const numero = valor.trim() === '' ? null : Number(valor.replace(/\./g, '').replace(',', '.'))
      const r = await acaoAdminSalvarCobranca(organizacaoId, {
        forma,
        valor: numero,
        dia: dia.trim() === '' ? null : Number(dia),
        nota,
      })
      setMensagem(r.ok ? { tom: 'ok', texto: 'Salvo.' } : { tom: 'erro', texto: r.erro ?? 'Não foi possível salvar.' })
    })

  return (
    <section aria-labelledby="titulo-cobranca" className="app-card px-5 py-4">
      <h2 id="titulo-cobranca" className="text-[14px] font-bold">
        Cobrança
      </h2>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">Como a 4YU cobra esta organização. Só a administração vê e muda.</p>

      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(evento) => {
          evento.preventDefault()
          salvar()
        }}
      >
        <div role="radiogroup" aria-label="Forma de cobrança" className="grid gap-2 sm:grid-cols-3">
          {FORMAS.map((f) => {
            const aceso = forma === f.valor
            return (
              <button
                key={f.valor}
                type="button"
                role="radio"
                aria-checked={aceso}
                onClick={() => {
                  setForma(f.valor)
                  setMensagem(null)
                }}
                className={`rounded-[11px] border px-3.5 py-3 text-left transition ${
                  aceso ? 'border-primary bg-primary/[0.06]' : 'border-line hover:border-primary/40'
                }`}
              >
                <span className="block text-[13px] font-semibold text-soft">{f.rotulo}</span>
                <span className="mt-0.5 block text-[11.5px] leading-[1.45] text-dim">{f.descricao}</span>
              </button>
            )
          })}
        </div>

        {forma !== 'asaas' && assinaturaAtiva && (
          <p role="status" className="rounded-[10px] border border-amber-300/30 bg-amber-300/[0.1] px-3.5 py-2.5 text-[12px] leading-5 text-aviso">
            Esta organização já assina pelo Asaas. Mudar aqui não cancela a assinatura: cancele em Faturas, entrando como ela, para não
            cobrar duas vezes.
          </p>
        )}

        {forma === 'por_fora' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-soft">Valor por mês</span>
              <input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Exemplo: 597,00"
                className="app-field w-36 px-3 py-2 text-[13px] tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-soft">Dia do pagamento</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                placeholder="Exemplo: 10"
                className="app-field w-28 px-3 py-2 text-[13px] tabular-nums"
              />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-soft">Anotação interna</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={
              forma === 'cortesia' ? 'Exemplo: cliente de teste até a demonstração de dezembro' : 'Exemplo: Pix para a chave da 4YU, comprovante pelo WhatsApp'
            }
            className="app-field px-3 py-2 text-[13px]"
          />
        </label>

        <div className="flex items-center gap-3">
          <Botao type="submit" variante="secundario" disabled={rodando}>
            {rodando ? 'Salvando…' : 'Salvar'}
          </Botao>
          {mensagem && (
            <span role="status" className={`text-[12px] ${mensagem.tom === 'erro' ? 'text-perigo' : 'text-muted'}`}>
              {mensagem.texto}
            </span>
          )}
        </div>
      </form>
    </section>
  )
}
