import { EsqueletoDeTabela } from '@/components/admin/partes'

export default function Carregando() {
  return (
    <EsqueletoDeTabela
      titulo="Auditoria"
      descricao="O que aconteceu na plataforma, do mais novo para o mais velho. O que foi feito de dentro de um “entrar como” aparece marcado."
      busca="Exemplo: e-mail, pessoa ou organização"
      colunas={4}
    />
  )
}
