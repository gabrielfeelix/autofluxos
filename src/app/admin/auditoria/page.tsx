import { lerParametros, TelaDaAdministracao } from '@/components/admin/partes'
import { TabelaDeAuditoria } from '@/components/admin/tabela-de-auditoria'
import { listarAtos } from '@/server/repos/auditoria'

export const dynamic = 'force-dynamic'

const TETO = 500

/**
 * O registro da plataforma inteira, do mais novo para o mais velho. A mesma
 * tabela da aba Auditoria de cada organização, com a coluna Organização.
 */
export default async function Auditoria({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = lerParametros(await searchParams)
  const atos = await listarAtos({ limite: TETO })

  return (
    <TelaDaAdministracao titulo="Auditoria" descricao="O que aconteceu na plataforma, do mais novo para o mais velho. O que foi feito de dentro de um “entrar como” aparece marcado.">
      <TabelaDeAuditoria base="/admin/auditoria" parametros={parametros} atos={atos} comOrganizacao teto={TETO} />
    </TelaDaAdministracao>
  )
}
