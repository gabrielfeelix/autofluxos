'use client'

import { AcoesDaMensagem } from '@/components/lead/acoes-da-mensagem'
import { useCitacao } from '@/components/lead/citacao'

/**
 * A ponte entre a bolha (servidor) e a citação (cliente).
 *
 * `AcoesDaMensagem` precisa de uma função para "citar esta mensagem", e essa
 * função mora no contexto — que só existe no cliente. Este componente é a casca
 * fina que busca o contexto e repassa; sem ele, a página teria de virar Client
 * Component inteira para passar um `onClick` adiante.
 *
 * Fora do provedor ele **não some**: reagir continua valendo, e só o botão de
 * citar deixa de aparecer. É o caso da tela da Ficha, que não monta a caixa com
 * citação — e onde esconder o reagir junto seria tirar um recurso por causa de
 * outro.
 */
export function BarraDaMensagem({
  clienteId,
  contatoId,
  waMessageId,
  podeReagir,
  minhaReacao,
  texto,
  deQuem,
  nossa,
}: {
  clienteId: string
  contatoId: string
  waMessageId: string
  podeReagir: boolean
  minhaReacao?: string
  texto: string | null
  /** Como nomear o autor na prévia da citação: "atendimento" ou o nome dela. */
  deQuem: string
  nossa: boolean
}) {
  const citacao = useCitacao()
  if (!citacao) return null

  return (
    <AcoesDaMensagem
      clienteId={clienteId}
      contatoId={contatoId}
      waMessageId={waMessageId}
      podeReagir={podeReagir}
      {...(minhaReacao ? { minhaReacao } : {})}
      nossa={nossa}
      aoCitar={() => citacao.citar({ waMessageId, texto, deQuem })}
    />
  )
}
