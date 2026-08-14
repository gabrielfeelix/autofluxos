'use client'

import { useState, useTransition } from 'react'
import { acaoAlternarAutomacaoDoLead } from '@/server/acoes'

/**
 * Controle explícito para o caso em que uma pessoa vai conduzir a conversa.
 *
 * **Era um componente de servidor com um `<form action={async () => …}>`**, e
 * isso derrubava a tela inteira: closure escrito num componente de servidor não
 * é Server Action — precisa de `'use server'` no corpo — então o React recusava
 * a árvore com "Functions cannot be passed directly to Client Components" e a
 * página do lead respondia 500 sempre que o contato **não** estava aguardando
 * pessoa, que é o caso comum.
 *
 * Virou componente de cliente em vez de ganhar um `'use server'` porque a ação
 * já devolve motivo de recusa — "a conversa está ocupada", "conclua o
 * atendimento antes de religar o bot" — e o formulário jogava tudo isso fora. O
 * botão pedia uma coisa, nada acontecia, e não havia onde ler por quê.
 */
export function ControleDeAutomacao({
  clienteId,
  contatoId,
  automacaoAtiva,
  compacto = false,
}: {
  clienteId: string
  contatoId: string
  automacaoAtiva: boolean
  compacto?: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const proximoEstado = !automacaoAtiva
  const texto = automacaoAtiva ? 'Pausar bot' : 'Religar bot'
  const explicacao = automacaoAtiva
    ? 'As próximas mensagens serão registradas, mas não receberão resposta automática.'
    : 'O bot volta a responder a partir da próxima mensagem.'

  return (
    <div>
      {!compacto && <p className="mt-1 text-[11px] leading-4 text-muted">{explicacao}</p>}
      <button
        type="button"
        disabled={rodando}
        title={explicacao}
        onClick={() => {
          setErro(null)
          comecar(async () => {
            const r = await acaoAlternarAutomacaoDoLead(clienteId, contatoId, proximoEstado)
            if (!r.ok) setErro(r.erro ?? 'não deu para mudar a automação')
          })
        }}
        className={`mt-2.5 w-full rounded-[8px] border px-2.5 py-2 text-[11px] font-bold transition disabled:opacity-50 ${
          automacaoAtiva
            ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100 hover:bg-amber-300/[0.15]'
            : 'border-emerald-400/30 bg-emerald-400/[0.1] text-emerald-200 hover:bg-emerald-400/[0.18]'
        }`}
      >
        {rodando ? '…' : texto}
      </button>

      {erro && (
        <p role="alert" className="mt-1.5 text-[10.5px] leading-4 text-rose-300">
          {erro}
        </p>
      )}
    </div>
  )
}
