import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto, EsqueletoDeAlternador, EsqueletoDeBotao, EsqueletoDeLinhas } from '@/components/design/esqueleto'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'

/**
 * Produtos enquanto vem: topo com Grade | Lista e os botões, e a lista no
 * cartão. O título é osso porque muda com o ramo ("Cardápio", "Serviços"),
 * e escrever "Produtos" para trocar por outra palavra seria pior.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="cheia">
        <CabecalhoDaTela
          titulo={<Esqueleto className="my-1 h-[26px] w-36 rounded-lg" />}
          contagem={<Esqueleto className="h-6 w-24 rounded-full" />}
          descricao="O que a empresa vende, com preço, foto e link. O bot usa esta lista para dizer quanto custa e mandar o card do produto na conversa, e a equipe manda o mesmo card pelo Inbox."
          acoes={
            <>
              <EsqueletoDeAlternador opcoes={['Grade', 'Lista']} ativa={1} />
              <EsqueletoDeBotao largura="w-24" />
              <EsqueletoDeBotao largura="w-28" />
            </>
          }
        />
        <EsqueletoDeLinhas linhas={5} rotulo="Carregando o catálogo…" />
      </Miolo>
    </MioloCarregando>
  )
}
