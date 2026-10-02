import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto, EsqueletoDeBotao, EsqueletoDeBusca, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/**
 * Os contatos enquanto vêm: topo com contagem e as três ações, a barra de
 * busca e a tabela com rosto. O título é osso porque muda com o ramo
 * ("Alunos" no estúdio), e escrever "Contatos" para trocar depois piscaria.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="toda" className="flex min-h-full flex-col">
        <CabecalhoDaTela
          className="mb-4"
          titulo={<Esqueleto className="my-1 h-[26px] w-32 rounded-lg" />}
          contagem={<Esqueleto className="h-6 w-24 rounded-full" />}
          acoes={
            <>
              <EsqueletoDeBotao largura="w-24" />
              <EsqueletoDeBotao largura="w-36" />
              <EsqueletoDeBotao largura="w-24" />
            </>
          }
        />
        <EsqueletoDeBusca placeholder="Buscar por nome ou telefone" filtros className="mb-3">
          <Esqueleto className="h-9 w-28 rounded-[9px]" />
        </EsqueletoDeBusca>
        <EsqueletoDeLinhas linhas={8} comRosto colunas={6} altura="h-[52px]" rotulo="Carregando os contatos…" />
      </Miolo>
    </MioloCarregando>
  )
}
