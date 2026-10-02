import { EsqueletoDeTabela } from '@/components/admin/partes'

export default function Carregando() {
  return (
    <EsqueletoDeTabela
      titulo="Consumo"
      descricao="O que cada organização usou neste mês, contra o que o plano comporta. Conversa é contato que trocou mensagem nos dois sentidos no mês. Disparo que ninguém respondeu não conta."
      busca="Exemplo: Studio Vega"
      numeros={5}
      colunas={6}
    />
  )
}
