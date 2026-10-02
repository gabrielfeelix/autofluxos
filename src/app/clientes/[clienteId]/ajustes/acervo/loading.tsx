import { EsqueletoDeAjuste, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/** Arquivos e mídias enquanto vem: o caminho, o título e a frase de verdade, e a lista de arquivos. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Arquivos e mídias"
      descricao="Os arquivos que o bloco de Mídia pode enviar: foto da sala, vídeo do trabalho, PDF do plano. Copie o endereço de um arquivo e cole no bloco."
      largura="larga"
    >
      <EsqueletoDeLinhas linhas={4} />
    </EsqueletoDeAjuste>
  )
}
