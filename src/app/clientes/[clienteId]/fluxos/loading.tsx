import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto, EsqueletoDeBotao, EsqueletoDeBusca, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/**
 * As automações enquanto vêm: topo, busca e a lista em cartão. O subitem
 * (Fluxos, Gatilhos, Sequências) vem na busca do endereço, que o loading não
 * lê: título e descrição esperam em osso.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="cheia">
        <CabecalhoDaTela
          titulo={<Esqueleto className="my-1 h-[26px] w-32 rounded-lg" />}
          descricao={<Esqueleto className="mt-1.5 h-3 w-full max-w-[460px]" />}
          acoes={
            <>
              <EsqueletoDeBotao largura="w-28" />
              <EsqueletoDeBotao largura="w-40" />
            </>
          }
        />
        <EsqueletoDeBusca placeholder="Buscar automação pelo nome" filtros />
        <EsqueletoDeLinhas linhas={7} rotulo="Carregando as automações…" />
      </Miolo>
    </MioloCarregando>
  )
}
