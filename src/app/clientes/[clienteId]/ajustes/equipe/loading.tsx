import { EsqueletoDeAjuste, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/** Pessoas enquanto vem: o caminho, o título e a frase de verdade, e a tabela. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Pessoas"
      descricao="Quem trabalha nesta organização e com qual função. Você vê e muda só quem está abaixo de você. Só quem está aqui aparece para assumir conversa no Inbox."
      largura="toda"
      contagem
      acoes={['w-24', 'w-32']}
    >
      <EsqueletoDeLinhas linhas={5} comRosto colunas={6} rotulo="Carregando as pessoas…" />
    </EsqueletoDeAjuste>
  )
}
