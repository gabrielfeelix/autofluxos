'use client'

import { useState } from 'react'
import { GRUPOS_DE_PRESET, NOME_DO_GRUPO, PRESETS, acharPreset, presetDoBloco } from '@/core/presets'

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
  bloco,
}: {
  aoAplicar: (dados: Record<string, unknown>) => void
  /**
   * O que o bloco já tem, só para a gaveta fechada saber o que dizer.
   *
   * Não é usado para aplicar nada — o preset continua sendo resolvido e
   * esquecido. É informação de tela, e por isso opcional.
   */
  bloco?: {
    metodo: string
    url: string
    mapear: { variavel: string }[]
    temCredencial: boolean
  }
}) {
  const [aberto, setAberto] = useState(false)
  const [escolhido, setEscolhido] = useState<string | null>(null)

  const preset = escolhido ? acharPreset(escolhido) : undefined

  /*
   * O que a gaveta fechada mostra.
   *
   * Quem monta fluxo relatou que **com a tela minimizada não dá para saber se
   * a integração está funcional** — a gaveta fechada dizia a mesma coisa num
   * bloco vazio e num bloco já ligado à agenda, e as duas pedem gestos opostos:
   * num, escolher um preset; no outro, não mexer.
   *
   * São três estados, e o terceiro é o que evita a promessa falsa: um bloco que
   * casa com um preset **que exige credencial** e ainda não tem nenhuma
   * escolhida está preenchido e não roda. Dizer "pronto" ali seria repetir o
   * defeito que a conferência da chave veio consertar em Conexões.
   */
  const emUso = bloco ? presetDoBloco(bloco) : undefined
  const faltaCredencial =
    emUso !== undefined && emUso.credencial !== 'nenhuma' && bloco?.temCredencial === false

  return (
    <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.02] p-3">
      <button
        type="button"
        onClick={() => setAberto((estava) => !estava)}
        aria-expanded={aberto}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            {emUso ? 'Integração pronta em uso' : 'Começar de uma integração pronta'}
          </span>

          {!aberto && emUso && (
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span
                className={`inline-block size-1.5 shrink-0 rounded-full ${
                  faltaCredencial ? 'bg-amber-300' : 'bg-emerald-400'
                }`}
                aria-hidden
              />
              <span className="text-[11.5px] font-semibold text-soft">{emUso.nome}</span>
              {faltaCredencial && (
                <span className="text-[11px] text-amber-200/90">
                  — falta escolher a credencial abaixo
                </span>
              )}
            </span>
          )}

          {!aberto && !emUso && (
            <span className="mt-1 block text-[11px] leading-4 text-dim">
              Este bloco está montado à mão. Abra para partir de uma pronta.
            </span>
          )}
        </span>
        <span className="mt-0.5 shrink-0 text-[11px] text-dim">{aberto ? '−' : '+'}</span>
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
