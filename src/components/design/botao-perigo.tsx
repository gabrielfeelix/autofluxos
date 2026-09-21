'use client'

import { useConfirmar } from './confirmar'

/**
 * Um botão que apaga alguma coisa.
 *
 * Três coisas que ele faz e um `<form action={...}>` cru não fazia:
 *
 * 1. **Pede confirmação**, com o nome do que vai sumir escrito na pergunta. A
 *    pergunta abre no modal do produto: era um `confirm()`, a janela do sistema
 *    operacional, que aparece ancorada no alto do navegador com o nome do
 *    domínio em cima e não se parece com nada do resto da tela.
 * 2. **Mostra o motivo da recusa.** Apagar aqui pode ser negado por regra de
 *    negócio, automação no ar, número com conversa, e sem lugar para o motivo
 *    aparecer o clique parecia não ter funcionado.
 * 3. **Desabilita enquanto roda**, para o clique nervoso não disparar duas vezes.
 */
export function BotaoPerigo({
  acao,
  rotulo = 'Apagar',
  pergunta,
  titulo,
}: {
  acao: () => Promise<{ ok: boolean; erro?: string }>
  rotulo?: string
  /** O que aparece na confirmação. Escreva o nome do alvo aqui. */
  pergunta: string
  titulo?: string
}) {
  const { confirmar, dialogo, rodando } = useConfirmar()

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={rodando}
        title={titulo}
        onClick={() =>
          confirmar({
            titulo: rotulo.endsWith('?') ? rotulo : `${rotulo}?`,
            descricao: pergunta,
            rotulo,
            aoConfirmar: acao,
          })
        }
        className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-rose-400/40 hover:bg-rose-400/[0.09] hover:text-perigo disabled:opacity-50"
      >
        {rodando ? '…' : rotulo}
      </button>

      {dialogo}
    </span>
  )
}
