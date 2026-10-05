import type { Evento } from '@/core/crm'
import { LinhaDoTempo, agruparEventos } from './linha-do-tempo'
import { VazioDoCartao } from './vazio-do-cartao'
import { IlustracaoSequencias } from '@/components/design/ilustracoes'

/**
 * A linha do tempo do contato, na aba Histórico.
 *
 * É a mesma lista do painel do negócio, com o mesmo desenho por tipo de fato
 * (`linha-do-tempo.tsx`), e de propósito: quem aprende a ler o histórico num
 * lugar não pode ter que reaprender no outro. Aqui ela vem inteira.
 *
 * A conversa **não entra aqui**. Ela já é a outra aba, e repetir cada mensagem
 * como evento transformaria o histórico numa segunda cópia do WhatsApp, onde o
 * que importa (mudou de etapa, alguém assumiu, ganhou, perdeu) ficaria enterrado.
 */
export function Historico({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) {
    return (
      <VazioDoCartao className="" ilustracao={<IlustracaoSequencias />}>
        Nada registrado ainda. A partir de agora, mudança de etapa, quem assumiu e o que foi ganho
        ou perdido aparecem aqui.
      </VazioDoCartao>
    )
  }
  return <LinhaDoTempo grupos={agruparEventos(eventos)} />
}
