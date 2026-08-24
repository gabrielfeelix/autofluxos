'use client'

import { useState } from 'react'
import { GRUPOS_DE_PRESET, NOME_DO_GRUPO, PRESETS, acharPreset } from '@/core/presets'

/**
 * O menu de integrações que os concorrentes têm — feito por cima do bloco que
 * já existe.
 *
 * O nosso bloco de Serviços externos fala com qualquer API, e é por isso que
 * ele é ao mesmo tempo mais poderoso e menos usável: obriga a montar o POST na
 * mão, com endereço, cabeçalho e JSON certos, e os três erram em silêncio.
 *
 * O preset preenche os quatro campos e **sai do caminho**. A partir dali é um
 * bloco `http` comum, editável — e o que vai para o fluxo é o bloco resolvido.
 * Um preset que continuasse sendo referência mudaria por baixo o que uma
 * conversa em andamento chama no dia em que a RD trocasse de endereço.
 *
 * A confirmação existe porque aplicar **sobrescreve** o que estiver escrito, e
 * quem já montou a chamada na mão perderia o trabalho num clique.
 */
export function PresetsDeIntegracao({
  aoAplicar,
}: {
  aoAplicar: (dados: Record<string, unknown>) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [escolhido, setEscolhido] = useState<string | null>(null)

  const preset = escolhido ? acharPreset(escolhido) : undefined

  return (
    <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.02] p-3">
      <button
        type="button"
        onClick={() => setAberto((estava) => !estava)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          Começar de uma integração pronta
        </span>
        <span className="text-[11px] text-dim">{aberto ? '−' : '+'}</span>
      </button>

      {aberto && (
        <div className="mt-2.5 space-y-2.5">
          {/*
            Agrupado porque a agenda trouxe nove de uma vez.

            Uma lista corrida de quatorze itens é uma lista que ninguém lê até o
            fim, e o de baixo some. A gaveta também conta uma história: os nove
            da Verandi estão na ordem da conversa — reconhecer, oferecer, marcar,
            desmarcar, fila — e não são nove integrações soltas.
          */}
          {GRUPOS_DE_PRESET.map((grupo) => {
            const doGrupo = PRESETS.filter((item) => item.grupo === grupo)
            if (doGrupo.length === 0) return null

            return (
              <div key={grupo}>
                <p className="mb-1 px-0.5 text-[9.5px] font-bold tracking-[0.07em] text-dim uppercase">
                  {NOME_DO_GRUPO[grupo]}
                </p>
                <div className="space-y-1.5">
          {doGrupo.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setEscolhido(escolhido === item.id ? null : item.id)}
              aria-pressed={escolhido === item.id}
              className={`block w-full rounded-[9px] border px-3 py-2 text-left transition ${
                escolhido === item.id
                  ? 'border-accent/40 bg-accent/[0.09]'
                  : 'border-white/[0.07] hover:border-white/[0.14]'
              }`}
            >
              <strong className="block text-[12px] font-semibold text-soft">{item.nome}</strong>
              <span className="mt-0.5 block text-[11px] leading-4 text-dim">{item.resumo}</span>
            </button>
                  ))}
                </div>
              </div>
            )
          })}

          {preset && (
            <div className="rounded-[9px] border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2.5">
              <p className="text-[11.5px] leading-4 text-amber-100">
                <strong className="font-semibold">Antes de aplicar:</strong> {preset.exige}
              </p>
              {preset.credencial !== 'nenhuma' && (
                <p className="mt-1.5 text-[11px] leading-4 text-amber-200/80">
                  Depois de aplicar, escolha a credencial no campo abaixo. Ela nunca
                  entra no fluxo — o que fica gravado é só o id dela.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  if (
                    !confirm(
                      `Aplicar “${preset.nome}”? Isso substitui o endereço, o corpo, os cabeçalhos e o mapeamento que estiverem escritos neste bloco.`,
                    )
                  ) {
                    return
                  }
                  aoAplicar({ ...preset.dados })
                  setAberto(false)
                  setEscolhido(null)
                }}
                className="app-primary-button mt-2.5 px-3 py-1.5 text-[11.5px]"
              >
                Aplicar e preencher o bloco
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
