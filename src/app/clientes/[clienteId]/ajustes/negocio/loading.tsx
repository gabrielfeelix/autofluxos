import { EsqueletoDaFicha, EsqueletoDeAjuste, EsqueletoDeFormulario } from '@/components/design/esqueleto'

/** Dados da organização enquanto vem: o caminho, o título e a frase de verdade, a ficha em leitura e o cartão de faixas. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Dados da organização"
      descricao="O cadastro e o logo desta organização, e a partir de quanto um cliente de vocês é ouro ou prata."
    >
      <EsqueletoDaFicha />
      <EsqueletoDeFormulario cartoes={[1]} />
    </EsqueletoDeAjuste>
  )
}
