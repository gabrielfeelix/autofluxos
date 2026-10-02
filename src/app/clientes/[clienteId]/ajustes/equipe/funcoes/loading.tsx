import { EsqueletoDeAjuste, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/** Funções enquanto vem: o caminho, o título e a frase de verdade, e a matriz. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Funções"
      descricao="O que cada função pode fazer nesta organização. Quem está acima vê e muda quem está abaixo. Para dar a alguém um acesso diferente da função, use Ajustar acesso na tela Pessoas."
      trilha={['Configurações', 'Pessoas']}
      largura="cheia"
    >
      <EsqueletoDeLinhas linhas={8} colunas={5} altura="h-[60px]" rotulo="Carregando as funções…" />
    </EsqueletoDeAjuste>
  )
}
