import { redirect } from 'next/navigation'

/** O endereço antigo de Organizações. Continua valendo para link salvo. */
export default function Contas() {
  redirect('/admin/organizacoes')
}
