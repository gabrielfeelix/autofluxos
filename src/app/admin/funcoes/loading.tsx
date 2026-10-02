import { EsqueletoDeTabela } from '@/components/admin/partes'

export default function Carregando() {
  return (
    <EsqueletoDeTabela
      titulo="Funções"
      descricao="Proprietário, Administrador, Gestor e Atendente, do nível mais alto ao mais baixo. Quem está acima vê e muda quem está abaixo. Mudar uma célula vale na hora para todo mundo com aquela função; exceções por pessoa continuam valendo por cima."
      colunas={5}
    />
  )
}
