'use client'

import { useEffect, useRef, useState } from 'react'
import { Dica } from '@/components/design/dica'
import { IconeCarinha } from '@/components/lead/icones-da-barra'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { buscarEmojis, emojiDoItem, GRUPOS_DE_EMOJI } from '@/core/emojis'

/**
 * A telinha de escolher emoji, ao lado do clipe de anexo.
 *
 * ---------------------------------------------------------------------------
 * Por que ela é diferente dos seis da reação
 * ---------------------------------------------------------------------------
 *
 * Reagir compete com responder: se escolher o emoji custar mais que digitar
 * "ok", ninguém reage — por isso ali são seis e acabou. Aqui a pessoa já está
 * escrevendo, e o emoji entra no meio de uma frase que ela pensou. O custo de
 * procurar já foi pago; o que não pode é **não achar**.
 *
 * ---------------------------------------------------------------------------
 * Emoji nunca foi recurso de API
 * ---------------------------------------------------------------------------
 *
 * O WhatsApp trata emoji como texto: digitar 👍 no campo sempre funcionou, e
 * continua funcionando sem esta tela. O que faltava era **achar** o emoji sem
 * sair do navegador — e é só isso que este componente resolve.
 *
 * O emoji entra no cursor, e não no fim: quem escreveu "ótimo, combinado" e
 * quer o 👍 antes da vírgula não deveria ter que recortar a frase.
 */
export function SeletorDeEmoji({
  aoEscolher,
  desabilitado = false,
}: {
  aoEscolher: (emoji: string) => void
  desabilitado?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [grupo, setGrupo] = useState(0)
  const [busca, setBusca] = useState('')
  const caixa = useRef<HTMLDivElement>(null)

  /*
   * Fechar clicando fora e no Esc.
   *
   * Sem isso a telinha fica por cima da conversa até alguém acertar de novo o
   * botão — e no meio de uma resposta ela tapa justamente a mensagem que a
   * pessoa está respondendo. O `Esc` existe pelo mesmo motivo do `Enter` que
   * envia: é o que a mão já faz sozinha.
   */
  useEffect(() => {
    if (!aberto) return

    function foraDaqui(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    function noEsc(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', foraDaqui)
    document.addEventListener('keydown', noEsc)
    return () => {
      document.removeEventListener('mousedown', foraDaqui)
      document.removeEventListener('keydown', noEsc)
    }
  }, [aberto])

  const procurando = busca.trim() !== ''
  const emojis = procurando
    ? buscarEmojis(busca)
    : (GRUPOS_DE_EMOJI[grupo]?.itens ?? []).map(emojiDoItem)

  return (
    <div className="relative shrink-0" ref={caixa}>
      <Dica texto="Emoji" lado="cima">
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => setAberto((a) => !a)}
          aria-label="Escolher emoji"
          aria-expanded={aberto}
          className={BOTAO_DA_BARRA}
        >
          <IconeCarinha />
        </button>
      </Dica>

      {aberto && (
        <div
          role="dialog"
          aria-label="Emojis"
          /*
           * Abre para cima porque o campo de resposta mora no rodapé da tela:
           * para baixo, a telinha nasceria fora da janela.
           */
          className="absolute bottom-full left-0 z-30 mb-2 w-[286px] rounded-[12px] border border-line bg-panel p-2 shadow-[0_10px_30px_rgba(19,25,34,0.11)]"
        >
          <input
            type="search"
            value={busca}
            autoFocus
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(evento) => {
              /*
               * **Enter aqui não pode enviar a mensagem.**
               *
               * Esta telinha abre de dentro do `<form>` da resposta, e um
               * `Enter` em campo de formulário dispara o `submit` — quem
               * digitasse "festa" e apertasse Enter para buscar mandaria a
               * resposta pela metade para o cliente. O Enter escolhe o
               * primeiro resultado, que é o que a mão esperava.
               */
              if (evento.key !== 'Enter') return
              evento.preventDefault()
              const primeiro = buscarEmojis(busca)[0]
              if (primeiro) aoEscolher(primeiro)
            }}
            placeholder="Procurar: festa, obrigado, foto…"
            className="mb-2 w-full rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[11.5px] outline-none placeholder:text-dim focus:border-primary/40"
          />

          {!procurando && (
            <div className="mb-1.5 flex gap-0.5" role="tablist" aria-label="Categorias">
              {GRUPOS_DE_EMOJI.map((g, i) => (
                <button
                  key={g.nome}
                  type="button"
                  role="tab"
                  aria-selected={i === grupo}
                  title={g.nome}
                  onClick={() => setGrupo(i)}
                  className={`flex-1 rounded-[8px] py-1 text-[14px] leading-none transition ${
                    i === grupo ? 'bg-primary/20' : 'hover:bg-surface-strong'
                  }`}
                >
                  {g.aba}
                </button>
              ))}
            </div>
          )}

          <div className="grid max-h-[190px] grid-cols-8 gap-0.5 overflow-y-auto">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  aoEscolher(emoji)
                  /*
                   * A telinha **fica aberta**: mandar três emojis seguidos é
                   * caso normal, e fechar a cada clique obrigaria a reabrir
                   * três vezes. Quem terminou clica fora, ou aperta Esc.
                   */
                }}
                title={emoji}
                className="rounded-[7px] py-1 text-[18px] leading-none transition hover:bg-surface-strong"
              >
                {emoji}
              </button>
            ))}
            {emojis.length === 0 && (
              <p className="col-span-8 px-1 py-4 text-center text-[11px] text-dim">
                Nada com esse nome. Tente uma palavra só — &ldquo;festa&rdquo;,
                &ldquo;obrigado&rdquo;, &ldquo;dinheiro&rdquo;.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
