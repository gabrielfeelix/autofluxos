import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/**
 * A rede de baixo das telas de Conversas (Canais e Respostas rápidas têm o
 * seu): topo em osso e a lista em cartão, que é o formato das duas.
 * Sem `params`: loading não recebe parâmetro nenhum (ver `ajustes/loading.tsx`).
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="cheia">
        <CabecalhoDaTela
          titulo={<Esqueleto className="my-1 h-[26px] w-40 rounded-lg" />}
          descricao={<Esqueleto className="mt-1.5 h-3 w-full max-w-[460px]" />}
        />
        <EsqueletoDeLinhas linhas={5} />
      </Miolo>
    </MioloCarregando>
  )
}
