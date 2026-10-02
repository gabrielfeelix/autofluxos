import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import {
  Esqueleto,
  EsqueletoDeAlternador,
  EsqueletoDeBusca,
  EsqueletoDeLinhas,
  TopoCarregando,
} from '@/components/design/esqueleto'

/**
 * Atividades enquanto vem: topo, os atalhos de prazo em vidro, a barra de
 * busca com os dois alternadores e a tabela. Antes caía na grade de cartões
 * do Início, que não tem nada desta tela.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="toda" className="flex min-h-full flex-col">
        <TopoCarregando
          titulo="Atividades"
          descricao="Lembretes internos da equipe. Nada aqui é enviado ao cliente."
          acoes={['w-36']}
        />
        <div aria-hidden className="mb-3 flex flex-wrap gap-2">
          {['Vencidas', 'Hoje', 'Próximas', 'Sem prazo'].map((rotulo) => (
            <span key={rotulo} className="chip-vidro">
              {rotulo}
              <Esqueleto className="h-3 w-4" />
            </span>
          ))}
        </div>
        <EsqueletoDeBusca placeholder="Buscar por título ou contato" filtros className="mb-4">
          <Esqueleto className="h-9 w-[136px] rounded-[10px]" />
          <EsqueletoDeAlternador opcoes={['Minhas', 'Equipe']} />
          <EsqueletoDeAlternador opcoes={['Lista', 'Agenda']} className="sm:ml-auto" />
        </EsqueletoDeBusca>
        <EsqueletoDeLinhas linhas={7} colunas={5} altura="h-[60px]" rotulo="Carregando as atividades…" />
      </Miolo>
    </MioloCarregando>
  )
}
