import { EsqueletoDeTabela } from '@/components/admin/partes'

export default function Carregando() {
  return (
    <EsqueletoDeTabela
      titulo="Organizações"
      descricao="Quem usa o Dialogon: plano, quem tem acesso, quem espera e o uso do mês. Clique numa linha para abrir o detalhe."
      acoes={['w-44']}
      busca="Exemplo: nome, responsável ou e-mail"
      colunas={8}
    />
  )
}
