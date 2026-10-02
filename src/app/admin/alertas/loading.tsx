import { EsqueletoDeTabela } from '@/components/admin/partes'

export default function Carregando() {
  return (
    <EsqueletoDeTabela
      titulo="Alertas"
      descricao="Falhas que o produto registrou sozinho: webhook que não processou, entrega recusada pela Meta, credencial que o cofre não devolveu. Somem depois de 90 dias."
      busca="Buscar por webhook, número ou erro"
      colunas={4}
    />
  )
}
