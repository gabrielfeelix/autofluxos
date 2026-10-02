import { EsqueletoDeAjuste, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/** Etiquetas enquanto vem: o caminho, o título e a frase de verdade, e a tabela. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Etiquetas"
      descricao="As etiquetas que a equipe cria e aplica, como “cliente antigo”, “orçamento enviado” ou “não insistir”. Elas viram filtro em Contatos: clique no número para ver quem tem cada uma."
      largura="cheia"
    >
      <EsqueletoDeLinhas linhas={5} colunas={4} altura="h-12" rotulo="Carregando as etiquetas…" />
    </EsqueletoDeAjuste>
  )
}
