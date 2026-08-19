'use client'

import { useState } from 'react'
import { LogoDoCanal } from '@/components/design/selo-do-canal'
import { CANAIS, CANAL_PADRAO, DEFINICAO_DO_CANAL, type CanalId } from '@/core/canais'

/**
 * Onde esta automação vai atender — a primeira escolha do fluxo.
 *
 * **Aqui, e não depois.** Os limites que o editor cobra são os do canal, então
 * escolher no fim seria desenhar sem saber por que o validador recusa uma
 * pergunta de oito opções. É a mesma decisão do ManyChat e do Chatfuel: fluxo é
 * de um canal, e quem quer o mesmo atendimento em dois desenha dois.
 *
 * **Os canais sem adaptador aparecem, e não dá para escolher.** Esconder a
 * possibilidade é como se descobre tarde demais que ela nunca foi pensada; mas
 * deixar criar uma automação de Instagram hoje seria vender uma coisa que não
 * entrega mensagem nenhuma. O cartão desligado diz o que falta — em vez de
 * "em breve", que não é informação.
 */
export function EscolherCanal({ nome = 'canal' }: { nome?: string }) {
  const [escolhido, setEscolhido] = useState<CanalId>(CANAL_PADRAO)

  return (
    <div>
      {/* O valor real vai num campo escondido: os cartões são botões, e botão
          dentro de `<form>` com Server Action não carrega valor sozinho. */}
      <input type="hidden" name={nome} value={escolhido} />

      <div className="grid grid-cols-3 gap-2">
        {CANAIS.map((id) => {
          const canal = DEFINICAO_DO_CANAL[id]
          const ativo = escolhido === id

          return (
            <button
              key={id}
              type="button"
              disabled={!canal.disponivel}
              onClick={() => setEscolhido(id)}
              title={
                canal.disponivel
                  ? canal.resumo
                  : `${canal.nome} ainda não atende: falta ${canal.falta}.`
              }
              style={
                ativo
                  ? {
                      borderColor: `color-mix(in oklab, ${canal.cor} 55%, transparent)`,
                      background: `color-mix(in oklab, ${canal.cor} 12%, transparent)`,
                    }
                  : undefined
              }
              className={`flex flex-col items-center justify-center gap-1.5 rounded-[12px] border px-2 py-3 text-center transition ${
                ativo ? '' : 'border-white/[0.09] bg-white/[0.02] hover:border-white/20'
              } ${canal.disponivel ? '' : 'cursor-not-allowed opacity-45'}`}
            >
              <span style={{ color: canal.cor }} className="flex items-center justify-center">
                <LogoDoCanal canal={id} tamanho={20} />
              </span>
              <span className="text-[12px] font-semibold text-soft">{canal.nome}</span>
              {!canal.disponivel && (
                <span className="text-[9.5px] leading-[1.2] text-dim">ainda não atende</span>
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-1.5 text-[10.5px] leading-4 text-dim">
        {DEFINICAO_DO_CANAL[escolhido].resumo} O canal não muda depois: os limites do desenho são
        os dele.
      </p>
    </div>
  )
}
