'use client'

import { useAcaoOtimista } from '@/components/design/acao-otimista'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { origemEmPalavras, recebePromocoes, type EstadoDoMarketing } from '@/core/consentimento'
import { dataCurta } from '@/lib/quando'
import { acaoMarcarPromocoes } from '@/server/acoes-consentimento'

/**
 * Se a pessoa recebe promoções pelo WhatsApp, e desde quando.
 *
 * **A frase de baixo é a prova, não enfeite.** "Pediu pela conversa em 21 de
 * out." é o que a equipe precisa dizer quando a pessoa reclamar de uma
 * campanha, e o que impede alguém de religar sem saber que ela tinha pedido
 * para sair.
 *
 * Sem registro nenhum, recebe: é o comportamento que o produto sempre teve, e
 * a frase diz isso em vez de inventar um aceite que ninguém deu.
 */
export function PromocoesDoContato({
  clienteId,
  contatoId,
  estado,
}: {
  clienteId: string
  contatoId: string
  estado: EstadoDoMarketing
}) {
  const otimista = useAcaoOtimista<boolean>(recebePromocoes(estado))
  // A frase acompanha o último registro do servidor; depois de um clique, o
  // registro novo é da equipe, e é isso que ela passa a dizer.
  const mudouAgora = otimista.valor !== recebePromocoes(estado)

  const descricao = mudouAgora
    ? 'Marcado agora pela equipe.'
    : estado === null
      ? 'Sem registro de aceite. Recebe até pedir para sair.'
      : `${primeiraMaiuscula(origemEmPalavras(estado.origem))} em ${dataCurta(estado.em)}.`

  const pediuParaSair = !otimista.valor && !mudouAgora && estado !== null && estado.origem !== 'manual'

  return (
    <div className="flex flex-col gap-2">
      <LinhaLigaDesliga
        titulo={otimista.valor ? 'Recebe promoções' : 'Não recebe promoções'}
        descricao={descricao}
        marcada={otimista.valor}
        desabilitada={otimista.pendente}
        aoMudar={(novo) => otimista.agir(novo, () => acaoMarcarPromocoes(clienteId, contatoId, novo))}
      />
      {pediuParaSair && (
        <p className="text-[11px] leading-4 text-dim">
          Fica fora das transmissões de marketing. Religue só se a pessoa pedir para voltar.
        </p>
      )}
      {otimista.erro && (
        <p role="alert" className="text-[11px] text-perigo">
          {otimista.erro}
        </p>
      )}
    </div>
  )
}

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
