import { EsqueletoDeTabela } from '@/components/admin/partes'

export default function Carregando() {
  return (
    <EsqueletoDeTabela
      titulo="Pedidos de plano"
      descricao="As trocas de plano que as organizações pediram em Configurações > Plano. Atender troca o plano na hora; recusar só fecha o pedido."
      busca="Exemplo: nome da organização ou e-mail"
      colunas={5}
    />
  )
}
