import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeAlternador, EsqueletoDeLinhas, TopoCarregando } from '@/components/design/esqueleto'

/** As transmissões enquanto vêm: o mesmo topo e alternador da espera da página. */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="cheia">
        <TopoCarregando
          titulo="Transmissões"
          descricao="Mandar mensagem para uma lista de contatos, com modelo aprovado pela Meta."
          acoes={['w-32']}
        />
        <EsqueletoDeAlternador opcoes={['Modelos aprovados', 'Transmissões']} className="mb-5" />
        <EsqueletoDeLinhas linhas={4} rotulo="Carregando as transmissões…" />
      </Miolo>
    </MioloCarregando>
  )
}
