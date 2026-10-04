import { EsqueletoDeTabela } from '@/components/admin/partes'

export default function Carregando() {
  return (
    <EsqueletoDeTabela
      titulo="Sugestões"
      descricao="O que os clientes pediram pelo “Sentiu falta de algo?”, com a tela em que estavam. Quem escreveu está a um clique: a organização abre aqui mesmo."
      busca="Exemplo: funil, atividade, nome da organização"
      colunas={3}
    />
  )
}
