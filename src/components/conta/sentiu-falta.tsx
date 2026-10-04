'use client'

import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Modal } from '@/components/design/modal'
import { LIMITE_DA_SUGESTAO, conferirSugestao } from '@/core/sugestoes'
import { acaoSugerirMelhoria } from '@/server/acoes-sugestao'

/**
 * "Sentiu falta de algo?": a pessoa escreve o que faltou, de dentro da tela
 * em que sentiu a falta, e a 4YU lê em Administração > Sugestões.
 *
 * Ideia trazida do RD Station em 03/10/2026. O valor está em **onde** ela
 * mora: um e-mail de sugestão exige lembrar depois, e depois ninguém lembra.
 * A tela vai junto (sem o id da conta), para quem lê saber do que se fala.
 *
 * A janela é controlada por quem a abre (`aberta`), porque há duas portas: o
 * botão do cabeçalho e a gaveta de Ajuda.
 */
export function SentiuFalta({
  clienteId,
  aberta,
  aoFechar,
}: {
  clienteId: string
  aberta: boolean
  aoFechar: () => void
}) {
  const caminho = usePathname()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviada, setEnviada] = useState(false)
  const [enviando, comecar] = useTransition()

  function fechar() {
    aoFechar()
    // Depois de enviada, a próxima abertura começa do zero; com rascunho,
    // fechar sem querer não pode custar o que a pessoa escreveu.
    if (enviada) {
      setTexto('')
      setEnviada(false)
    }
    setErro(null)
  }

  function enviar() {
    const conferida = conferirSugestao(texto)
    if (!conferida.ok) {
      setErro(conferida.motivo)
      return
    }
    setErro(null)
    comecar(async () => {
      const r = await acaoSugerirMelhoria(clienteId, conferida.texto, caminho)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setEnviada(true)
    })
  }

  return (
    <Modal
      aberto={aberta}
      aoFechar={fechar}
      titulo={enviada ? 'Recebemos, obrigado' : 'Sentiu falta de algo?'}
      descricao={
        enviada
          ? undefined
          : 'Conte o que você procurou e não achou, ou o que deixaria seu dia mais fácil. A equipe da 4YU lê cada sugestão.'
      }
      largura={460}
    >
      {enviada ? (
        <div className="flex flex-col items-center gap-3 pt-1 pb-1 text-center">
          <span aria-hidden className="grid size-11 place-items-center rounded-full bg-emerald-400/15 text-ok">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <p className="max-w-[340px] text-[13px] leading-5 text-soft">
            Sua sugestão chegou para a equipe da 4YU. Se precisarmos entender melhor, falamos com você.
          </p>
          <button type="button" onClick={fechar} className="botao-primario botao-md mt-1 w-full">
            Fechar
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            enviar()
          }}
          className="flex flex-col gap-2.5"
        >
          <textarea
            autoFocus
            value={texto}
            onChange={(e) => {
              setTexto(e.currentTarget.value)
              setErro(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                enviar()
              }
            }}
            maxLength={LIMITE_DA_SUGESTAO}
            rows={5}
            aria-label="Sua sugestão"
            placeholder="Exemplo: queria ver no funil quantos negócios estão sem próxima atividade."
            className="app-field min-h-[120px] resize-y px-3 py-2.5 text-[13px] leading-5"
          />
          <div className="flex items-center justify-between gap-3 text-[11px] text-dim">
            <span>Vai junto a tela em que você está agora.</span>
            <span className="tabular-nums">
              {texto.length}/{LIMITE_DA_SUGESTAO}
            </span>
          </div>
          {erro && (
            <p role="alert" className="text-[12px] font-semibold text-perigo">
              {erro}
            </p>
          )}
          <button type="submit" disabled={enviando || texto.trim() === ''} className="botao-primario botao-md mt-1 w-full">
            {enviando ? 'Enviando…' : 'Enviar sugestão'}
          </button>
        </form>
      )}
    </Modal>
  )
}

/** O balão com o sinal de mais: "falta uma coisa aqui". */
export function IconeSentiuFalta({ tamanho = 17 }: { tamanho?: number }) {
  return (
    <svg aria-hidden width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M12 6.5v6M9 9.5h6" />
    </svg>
  )
}
