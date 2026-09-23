'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { AVISO_AO_DESLIGAR } from '@/core/entrada'
import { acaoAlternarFluxoAtivo } from '@/server/acoes'

/**
 * Liga e desliga uma automação inteira.
 *
 * **É o gesto que faltava entre publicar e apagar.** Quem queria parar um fluxo
 * por uns dias, a campanha acabou, o desenho vai ser trocado, o cliente pediu
 * para segurar, só tinha dois caminhos, e os dois erravam: apagar leva o
 * histórico junto, e desligar o número cala também o que devia continuar
 * falando.
 *
 * Desligado quer dizer **não abre conversa nova**. Quem já está conversando
 * termina o fluxo: cortar no meio de uma pergunta deixaria a pessoa falando
 * sozinha no WhatsApp, e quem desligou queria parar de captar, não abandonar.
 *
 * Componente de cliente porque a ação devolve motivo de recusa, e um `<form>`
 * cru jogaria isso fora, o clique pareceria não ter funcionado.
 */
export function InterruptorDeFluxo({
  clienteId,
  fluxoId,
  ativo,
  nome,
  emAndamento = 0,
  semVersao = false,
}: {
  clienteId: string
  fluxoId: string
  ativo: boolean
  nome: string
  /**
   * Quantas conversas estão rodando este fluxo agora (RB-44).
   *
   * O padrão é zero, que quer dizer "não perguntei" **e** "nenhuma", e aqui as
   * duas levam ao mesmo texto: sem número, a frase não menciona conversa. É
   * melhor ficar calado do que dizer "0 conversas serão afetadas" quando a
   * leitura não aconteceu.
   */
  emAndamento?: number
  /**
   * Nunca foi publicada (A05). Desligada, não liga: abriria conversa para um
   * fluxo que não responde. Ligada (de antes da regra), fica âmbar, porque verde
   * diria que atende. O servidor recusa do mesmo jeito.
   */
  semVersao?: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()
  /*
   * Desligar diz o efeito na hora (A03): a linha só troca "Entrada ligada" por
   * "desligada", e o que importa, quem está no meio continua, não cabe nela.
   * Flutua no rodapé para não empurrar a linha, e some sozinho.
   */
  const [desligouAgora, setDesligouAgora] = useState(false)
  useEffect(() => {
    if (!desligouAgora) return
    const t = setTimeout(() => setDesligouAgora(false), 8000)
    return () => clearTimeout(t)
  }, [desligouAgora])

  /*
   * A frase diz o que acontece com quem **já está** conversando, e é a RB-44:
   * "pausar impede novas sessões e, por padrão, permite concluir as ativas".
   *
   * Dizer o número muda a decisão de quem lê. "Para de abrir conversa nova" é
   * abstrato; "as 3 conversas em andamento terminam o roteiro" responde a
   * pergunta que a pessoa tem na mão, que é se ela vai deixar alguém falando
   * sozinho no WhatsApp.
   */
  const conversas =
    emAndamento === 1 ? '1 conversa em andamento termina' : `as ${emAndamento} conversas em andamento terminam`

  const explicacao = ativo
    ? `Desligar “${nome}”: para de abrir conversa nova. ${
        emAndamento > 0 ? `${conversas} o roteiro normalmente` : 'Quem já está conversando termina'
      }, e a versão no ar continua publicada.`
    : `Ligar “${nome}”: volta a abrir conversa na próxima mensagem. Não precisa publicar de novo.`
  const bloqueio = semVersao
    ? ativo
      ? `“${nome}” está ligada, mas nunca foi publicada: ninguém recebe resposta até publicar.`
      : `Publique “${nome}” antes de ligar, senão ninguém recebe resposta.`
    : null

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={ativo ? `Desligar a automação ${nome}` : `Ligar a automação ${nome}`}
        disabled={rodando || (!ativo && semVersao)}
        title={bloqueio ?? explicacao}
        onClick={() => {
          setErro(null)
          comecar(async () => {
            const r = await acaoAlternarFluxoAtivo(clienteId, fluxoId, !ativo)
            if (!r.ok) setErro(r.erro ?? 'não deu para ligar/desligar')
            else setDesligouAgora(ativo)
          })
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
          ativo && semVersao
            ? 'border-amber-300/40 bg-amber-300/20'
            : ativo
              ? 'border-emerald-400/40 bg-emerald-400/25'
              : 'border-line bg-surface-strong'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            ativo ? `left-[15px] ${semVersao ? 'bg-amber-300' : 'bg-emerald-300'}` : 'left-[2px] bg-dim'
          }`}
        />
      </button>

      {/* Sempre montada: região viva que nasce junto do texto não é lida. */}
      <span role="status" className="sr-only">
        {desligouAgora ? `“${nome}” desligada. ${AVISO_AO_DESLIGAR}` : ''}
      </span>
      {/*
        O cartão visível vai para o `body`: dentro da lista, algum ancestral
        prende o `fixed` e no celular o aviso nascia abaixo da tela. Só existe
        depois de um clique, então nunca roda no servidor.
      */}
      {desligouAgora &&
        createPortal(
          <div
            aria-hidden
            className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl border border-line bg-panel px-4 py-3 text-[12.5px] leading-5 text-ink shadow-lg"
          >
            <strong className="font-semibold">“{nome}” desligada.</strong> {AVISO_AO_DESLIGAR}
          </div>,
          document.body,
        )}

      {erro && (
        <span role="alert" className="max-w-[220px] text-right text-[10.5px] leading-4 text-perigo">
          {erro}
        </span>
      )}
    </span>
  )
}
