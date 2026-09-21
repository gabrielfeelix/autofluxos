'use client'

import { useState, useTransition } from 'react'
import { AjudaDoCampo } from '@/components/design/ajuda-do-campo'
import { CLASSE_DO_NIVEL, type FaixasDeNivel } from '@/core/relacionamento'
import { comoDinheiro } from '@/core/crm'
import { acaoDefinirFaixas } from '@/server/acoes-crm'

/**
 * O que é ouro, o que é prata, nesta conta.
 *
 * **Por que isto é ajuste e não constante do produto.** Um estúdio de pilates e
 * uma consultoria não têm o mesmo "cliente grande", e um número fixo erraria
 * para os dois. É também o que substitui o quintil: em vez de o sistema decidir
 * pelo formato da base — onde o topo de trinta pessoas vira "ouro" gastando
 * trezentos reais —, quem decide é quem conhece o próprio negócio.
 *
 * Só dois números, e não uma tabela de cinco faixas: ouro, prata e bronze é o
 * vocabulário que o dono já usa, e cada faixa a mais é uma decisão que ele
 * precisa tomar antes de a tela servir para alguma coisa.
 */
export function FaixasDeNivelDaConta({
  clienteId,
  faixas,
}: {
  clienteId: string
  faixas: FaixasDeNivel
}) {
  const [ouro, setOuro] = useState(String(faixas.ouro))
  const [prata, setPrata] = useState(String(faixas.prata))
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [rodando, comecar] = useTransition()

  return (
    <section className="app-card overflow-hidden">
      <h2 className="flex items-center border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        Quando um cliente é ouro
        <AjudaDoCampo
          titulo="Quando um cliente é ouro"
          secao="duvidas"
          texto="Pelo total que a pessoa já comprou. Define a coluna “Cliente” na lista de contatos."
          detalhes={
            <p>
              O nível sai do <strong>total que a pessoa já comprou</strong>, somado. Vale para a
              coluna “Cliente” na lista de contatos e para as réguas que falam só com um nível —
              uma mensagem de agradecimento que só faz sentido para quem já gastou bastante, por
              exemplo.
            </p>
          }
        />
      </h2>

      <div className="px-[18px] py-4">

        <div className="flex flex-wrap gap-3">
          <Campo
            nivel="ouro"
            rotulo="Ouro a partir de"
            valor={ouro}
            aoMudar={(v) => {
              setOuro(v)
              setSalvo(false)
            }}
          />
          <Campo
            nivel="prata"
            rotulo="Prata a partir de"
            valor={prata}
            aoMudar={(v) => {
              setPrata(v)
              setSalvo(false)
            }}
          />
        </div>

        {/* Quem fica de fora precisa aparecer, senão "bronze" some do
            vocabulário da tela e o dono não sabe onde caiu o resto. */}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-dim">
          <span aria-hidden className={`size-2 rounded-full ${CLASSE_DO_NIVEL.bronze}`} />
          Quem comprou menos de {comoDinheiro(Number(prata) || 0) || 'R$ 0,00'} é bronze. Quem nunca
          comprou fica fora dos três.
        </p>

        {erro && (
          <p role="alert" className="mt-3 text-[11.5px] leading-5 text-perigo">
            {erro}
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={rodando}
            onClick={salvar}
            className="app-primary-button px-4 py-2 text-[12.5px]"
          >
            {rodando ? 'salvando…' : 'Salvar'}
          </button>
          {salvo && <span className="text-[11.5px] font-semibold text-ok">Salvo</span>}
        </div>
      </div>
    </section>
  )

  function salvar() {
    setErro(null)
    setSalvo(false)
    comecar(async () => {
      try {
        const r = await acaoDefinirFaixas(clienteId, ouro, prata)
        if (!r.ok) {
          setErro(r.erro ?? 'não deu para salvar')
          return
        }
        setSalvo(true)
      } catch {
        setErro('não deu para salvar agora')
      }
    })
  }
}

function Campo({
  nivel,
  rotulo,
  valor,
  aoMudar,
}: {
  nivel: 'ouro' | 'prata'
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
}) {
  return (
    <label className="min-w-[160px] flex-1">
      <span className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-soft">
        <span aria-hidden className={`size-2 rounded-full ${CLASSE_DO_NIVEL[nivel]}`} />
        {rotulo}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-[12.5px] text-dim">R$</span>
        <input
          value={valor}
          onChange={(e) => aoMudar(e.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          aria-label={rotulo}
          className="app-field w-full px-3 py-2 text-[12.5px]"
        />
      </span>
    </label>
  )
}
