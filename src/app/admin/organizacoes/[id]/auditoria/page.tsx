import { TabelaDeAuditoria } from '@/components/admin/tabela-de-auditoria'
import { lerParametros } from '@/components/admin/partes'
import { listarAtos } from '@/server/repos/auditoria'

export const dynamic = 'force-dynamic'

const TETO = 300

/** O registro só desta organização. */
export default async function AuditoriaDaOrganizacao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, bruto] = await Promise.all([params, searchParams])
  const atos = await listarAtos({ contaId: id, limite: TETO })
  return <TabelaDeAuditoria base={`/admin/organizacoes/${id}/auditoria`} parametros={lerParametros(bruto)} atos={atos} comOrganizacao={false} teto={TETO} />
}
