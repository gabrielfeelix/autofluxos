import { EsqueletoDeAjuste, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/** Funis de venda enquanto vem: o caminho, o título e a frase de verdade, e os funis. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Funis de venda"
      descricao="As etapas por onde cada negócio anda, na ordem. O funil padrão recebe sozinho quem chega pela primeira vez; ganhar num funil pode passar o negócio para o seguinte."
      largura="cheia"
    >
      <EsqueletoDeLinhas linhas={3} colunas={4} altura="h-24" rotulo="Carregando os funis…" />
    </EsqueletoDeAjuste>
  )
}
