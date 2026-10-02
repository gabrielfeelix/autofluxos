import { EsqueletoDeAjuste, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/** Credenciais de sistemas enquanto vem: o caminho, o título e a frase de verdade, e a lista de chaves. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Credenciais de sistemas"
      descricao="As chaves que os blocos de API usam para falar com os sistemas deste cliente. O valor é guardado num cofre e nunca volta para esta tela: para trocar, grave de novo."
      largura="larga"
      acoes={['w-32']}
    >
      <EsqueletoDeLinhas linhas={3} />
    </EsqueletoDeAjuste>
  )
}
