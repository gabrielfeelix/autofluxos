import { redirect } from 'next/navigation'
import { AtivarEContinuar } from '@/components/conta/ativar-e-continuar'
import { Portico } from '@/components/design/portico'
import { exigirUsuario, temPapelDeAdmin } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * A porta obrigatória do administrador da plataforma.
 *
 * O admin entra em qualquer conta de cliente, então a senha sozinha não basta:
 * sem a verificação em duas etapas, `exigirAdminDaPlataforma` manda para cá, e
 * a administração só abre depois de ligar.
 */
export default async function AtivarDuasEtapas() {
  const sessao = await exigirUsuario()
  if (!temPapelDeAdmin(sessao)) redirect('/painel')
  if (sessao.usuario.duasEtapas) redirect('/admin')

  return (
    <Portico
      titulo="Ligue a verificação em duas etapas"
      descricao="Quem administra a plataforma entra em todas as contas de cliente. Por isso, além da senha, o acesso pede um código do seu celular."
    >
      <AtivarEContinuar />
    </Portico>
  )
}
