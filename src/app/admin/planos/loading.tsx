import { EsqueletoDeTabela } from '@/components/admin/partes'

export default function Carregando() {
  return (
    <EsqueletoDeTabela
      titulo="Planos"
      descricao="Preço, limite de conversas, excedente, números e o que cada plano libera. A troca de plano de uma organização é na aba Plano dela, ou em Pedidos de plano."
      acoes={['w-28']}
      colunas={6}
      linhas={3}
    />
  )
}
