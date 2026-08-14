import { acaoAlternarAutomacaoDoLead } from '@/server/acoes'

/** Controle explícito para o caso em que uma pessoa vai conduzir a conversa. */
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
  const proximoEstado = !automacaoAtiva
  const texto = automacaoAtiva ? 'Pausar bot' : 'Religar bot'
  const explicacao = automacaoAtiva
    ? 'As próximas mensagens serão registradas, mas não receberão resposta automática.'
    : 'O bot volta a responder a partir da próxima mensagem.'

  return (
    <form
      action={async () => {
        await acaoAlternarAutomacaoDoLead(clienteId, contatoId, proximoEstado)
      }}
    >
      {!compacto && <p className="mt-1 text-[11px] leading-4 text-muted">{explicacao}</p>}
      <button
        type="submit"
        title={explicacao}
        className={`mt-2.5 w-full rounded-[8px] border px-2.5 py-2 text-[11px] font-bold transition ${
          automacaoAtiva
            ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100 hover:bg-amber-300/[0.15]'
            : 'border-emerald-400/30 bg-emerald-400/[0.1] text-emerald-200 hover:bg-emerald-400/[0.18]'
        }`}
      >
        {texto}
      </button>
    </form>
  )
}
