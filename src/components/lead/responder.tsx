'use client'

import { useRef, useState, useTransition } from 'react'

/**
 * A caixa de responder do painel.
 *
 * Ela existe porque o handoff era um beco: o bot calava e não havia de onde
 * responder. O número roda na Cloud API, então o celular do cliente não é
 * caixa de entrada.
 *
 * Duas coisas que a tela faz de propósito:
 *
 * - **Não limpa o campo antes de a mensagem sair.** Erro de envio com o texto
 *   apagado faz a pessoa reescrever um parágrafo que ela acabou de pensar.
 * - **Diz quanto falta da janela de 24h antes de alguém digitar**, em vez de
 *   deixar descobrir no erro. Fora da janela o campo nem abre.
 *
 * A recusa de verdade é a do servidor (`acaoResponderLead`); isto aqui é
 * conveniência, como o botão desabilitado de publicar.
 */
export function CaixaDeResposta({
  acao,
  restaDaJanela,
  nome,
}: {
  acao: (formData: FormData) => Promise<{ ok: boolean; erro?: string }>
  /** `null` = fora da janela, ou a pessoa nunca escreveu. */
  restaDaJanela: string | null
  nome: string
}) {
  const campo = useRef<HTMLTextAreaElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, comecar] = useTransition()

  if (restaDaJanela === null) {
    return (
      <div className="border-t border-white/[0.06] px-[18px] py-3.5">
        <p className="text-[11.5px] leading-5 text-dim">
          <strong className="text-muted">Não dá para responder por aqui agora.</strong> O WhatsApp
          só aceita texto livre até 24h depois da última mensagem de {nome}. Passado isso, retomar
          exige um modelo aprovado pela Meta — que este produto ainda não manda.
        </p>
      </div>
    )
  }

  function enviar(dados: FormData) {
    setErro(null)
    comecar(async () => {
      const r = await acao(dados)
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para enviar')
        return
      }
      // Só depois de sair. O texto fica onde está enquanto houver erro.
      if (campo.current) campo.current.value = ''
    })
  }

  return (
    <form action={enviar} className="border-t border-white/[0.06] px-[18px] py-3.5">
      <textarea
        ref={campo}
        name="texto"
        rows={2}
        maxLength={4096}
        disabled={enviando}
        placeholder={`Responder ${nome} pelo WhatsApp…`}
        className="w-full resize-y rounded-[11px] border border-white/[0.09] bg-white/[0.03] px-3 py-2.5 text-[12.5px] leading-[1.45] outline-none transition placeholder:text-dim focus:border-accent/40 disabled:opacity-50"
        onKeyDown={(evento) => {
          // Enter manda, Shift+Enter quebra linha — o hábito de todo mundo que
          // usa WhatsApp. `requestSubmit` para o `action` do form valer.
          if (evento.key === 'Enter' && !evento.shiftKey) {
            evento.preventDefault()
            evento.currentTarget.form?.requestSubmit()
          }
        }}
      />

      {erro && (
        <p className="mt-2 rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[11.5px] leading-5 text-rose-200">
          {erro}
        </p>
      )}

      <div className="mt-2 flex items-center gap-3">
        <span className="flex-1 text-[10.5px] leading-4 text-dim">
          Responder daqui assume a conversa: o bot para de falar com {nome} até você clicar em
          &ldquo;Já atendi&rdquo;. Janela do WhatsApp fecha em {restaDaJanela}.
        </span>
        <button
          type="submit"
          disabled={enviando}
          className="app-primary-button shrink-0 px-4 py-2 text-[12px] disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </form>
  )
}
