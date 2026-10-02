import { EsqueletoDeTabela } from '@/components/admin/partes'

export default function Carregando() {
  return (
    <EsqueletoDeTabela
      titulo="Usuários"
      descricao="Os logins da plataforma, as organizações de cada um e a função em cada uma. Convite por e-mail ainda não existe: a senha provisória é combinada fora daqui."
      acoes={['w-44']}
      busca="Exemplo: nome, e-mail ou organização"
      colunas={7}
    />
  )
}
