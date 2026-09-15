'use client'

import { useState, useTransition } from 'react'
import { acaoReagir } from '@/server/acoes-reacao'

/**
 * Reagir e citar, na mensagem.
 *
 * ---------------------------------------------------------------------------
 * Por que só seis emojis
 * ---------------------------------------------------------------------------
 *
 * São os mesmos do WhatsApp, e a lista curta é o recurso — não uma versão
 * reduzida dele. Reagir compete com responder: se escolher o emoji custa mais
 * que digitar "ok", ninguém reage. O seletor completo entra na caixa de texto
 * (camada 5), onde a pessoa está escrevendo de qualquer jeito; aqui ele
 * transformaria um clique em dois mais uma busca.
 *
 * ---------------------------------------------------------------------------
 * O prazo de 30 dias esconde o botão de reagir, e só ele
 * ---------------------------------------------------------------------------
 *
 * Mensagem velha continua podendo ser **citada** — esse recurso não tem prazo.
 * Some só o reagir, que é o que a Meta recusa. Esconder os dois juntos seria
 * tirar da pessoa algo que funciona.
 *
 * O servidor confere o prazo de novo. A tela é conveniência: entre carregar a
 * conversa e clicar pode passar tempo.
 */

/** Os seis do WhatsApp, na ordem dele. */
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

export function AcoesDaMensagem({
  clienteId,
  contatoId,
  waMessageId,
  podeReagir,
  minhaReacao,
  aoCitar,
  nossa,
}: {
  clienteId: string
  contatoId: string
  waMessageId: string
  /** `false` = passou dos 30 dias. Só o reagir some; citar continua. */
  podeReagir: boolean
  /**
   * O emoji com que **nós** já reagimos, se já reagimos.
   *
   * Serve para dois desenhos: marcar o escolhido, e fazer clicar nele de novo
   * **remover** — que é como o WhatsApp funciona e o que a pessoa vai tentar.
   */
  minhaReacao?: string
  /** Põe esta mensagem como citada na caixa de resposta. */
  aoCitar: () => void
  nossa: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, comecar] = useTransition()

  function reagir(emoji: string) {
    setErro(null)
    setAberto(false)

    comecar(async () => {
      /*
       * Clicar no emoji que já está lá **remove** — string vazia é como a Meta
       * desfaz uma reação. Sem isto, reagir de novo com o mesmo emoji seria uma
       * ação sem efeito visível, e não haveria caminho nenhum para tirar.
       */
      const escolhido = emoji === minhaReacao ? '' : emoji
      const r = await acaoReagir(clienteId, contatoId, { waMessageId, emoji: escolhido })
      if (!r.ok) setErro(r.erro ?? 'não deu para reagir')
    })
  }

  return (
    <span
      className={`relative flex items-center gap-1 ${nossa ? 'flex-row-reverse' : ''}`}
      /*
       * `opacity` no grupo, e não `hidden`: a barra aparece ao passar o mouse
       * sobre a mensagem, como no WhatsApp, mas continua no fluxo — assim ela
       * não empurra a conversa quando aparece. `focus-within` é o que mantém
       * isso alcançável por teclado, já que quem navega por Tab nunca dispara
       * o hover.
       */
    >
      <button
        type="button"
        onClick={aoCitar}
        disabled={enviando}
        title="Responder citando"
        aria-label="Responder citando esta mensagem"
        className="rounded-full border border-white/[0.09] bg-white/[0.04] px-1.5 py-0.5 text-[10px] leading-none text-muted transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
      >
        ↩
      </button>

      {podeReagir && (
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          disabled={enviando}
          title="Reagir"
          aria-label="Reagir a esta mensagem"
          aria-expanded={aberto}
          className="rounded-full border border-white/[0.09] bg-white/[0.04] px-1.5 py-0.5 text-[10px] leading-none text-muted transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
        >
          {enviando ? '…' : '☺'}
        </button>
      )}

      {aberto && (
        <span
          role="menu"
          className={`absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-full border border-white/[0.1] bg-[#161b26] px-1.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.45)] ${nossa ? 'right-0' : 'left-0'}`}
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              onClick={() => reagir(emoji)}
              title={emoji === minhaReacao ? 'Tirar a reação' : `Reagir com ${emoji}`}
              className={`rounded-full px-1 py-0.5 text-[14px] leading-none transition hover:scale-125 ${emoji === minhaReacao ? 'bg-accent/25' : ''}`}
            >
              {emoji}
            </button>
          ))}
        </span>
      )}

      {erro && (
        <span className="max-w-[220px] text-[10px] leading-4 text-rose-200" role="alert">
          {erro}
        </span>
      )}
    </span>
  )
}
