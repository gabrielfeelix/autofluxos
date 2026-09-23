import Link from 'next/link'
import type { EstadoDaTransmissao, Progresso } from '@/server/repos/transmissoes'

/*
 * O que a lista e o detalhe de transmissão mostram igual. Fica fora do
 * arquivo da lista, que é de cliente: o detalhe é de servidor e não consegue
 * ler uma constante exportada de um módulo `'use client'`.
 */

export const ROTULO_DO_ESTADO: Record<EstadoDaTransmissao, { texto: string; cor: string }> = {
  rascunho: { texto: 'Rascunho', cor: 'bg-line text-dim' },
  agendada: { texto: 'Agendada', cor: 'bg-sky-500/15 text-sky-600' },
  enviando: { texto: 'Enviando', cor: 'bg-amber-500/15 text-amber-600' },
  concluida: { texto: 'Concluída', cor: 'bg-emerald-500/15 text-emerald-600' },
  cancelada: { texto: 'Cancelada', cor: 'bg-line text-dim' },
  falhou: { texto: 'Parou', cor: 'bg-red-500/15 text-red-600' },
}

/** O que fazer depois, com o link quando existe tela para resolver. */
export function ProximaAcao({ acao }: { acao: { texto: string; link?: { rotulo: string; href: string } } }) {
  return (
    <p className="mt-2 text-[12px] leading-5 text-dim">
      <strong className="text-ink">E agora:</strong> {acao.texto}
      {acao.link && (
        <>
          {' '}
          <Link href={acao.link.href} className="font-semibold text-primary hover:underline">
            {acao.link.rotulo} ›
          </Link>
        </>
      )}
    </p>
  )
}

/**
 * Os números do progresso.
 *
 * `entregue` e `lida` somam como "chegou": para quem olha o painel, uma
 * mensagem lida obviamente chegou, e mostrar as duas separadas faria a conta
 * não fechar com o total aos olhos de quem soma.
 *
 * **`retida` NÃO soma com nada.** Ela é o estado que a Meta ainda está
 * decidindo, e juntá-la a "chegou" é exatamente o erro que esta tela existe
 * para não cometer.
 */
export function Numeros({ progresso }: { progresso: Progresso }) {
  const chegou = progresso.entregue + progresso.lida

  return (
    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-dim">
      <span>
        <strong className="text-ink">{progresso.total}</strong> no total
      </span>
      {chegou > 0 && (
        <span>
          <strong className="text-ink">{chegou}</strong> chegaram
          {progresso.lida > 0 && ` (${progresso.lida} lidas)`}
        </span>
      )}
      {progresso.aceita > 0 && <span>{progresso.aceita} saíram</span>}
      {progresso.na_fila > 0 && <span>{progresso.na_fila} na fila</span>}
      {progresso.retida > 0 && (
        /*
          A linha mais importante desta tela. "A Meta está avaliando" e não
          "enviado": se o veredito for ruim, estas mensagens são DESCARTADAS.
        */
        <span className="text-amber-600">
          <strong>{progresso.retida}</strong> a Meta está avaliando, ainda podem não sair
        </span>
      )}
      {progresso.falhou > 0 && (
        <span className="text-red-600">
          <strong>{progresso.falhou}</strong> falharam
        </span>
      )}
    </div>
  )
}
