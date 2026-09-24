import { TelaDaAdministracao } from '@/components/admin/partes'
import { MatrizDeFuncoes } from '@/components/admin/matriz-de-funcoes'
import { FUNCOES } from '@/core/funcoes'
import { funcoesVigentes } from '@/server/repos/funcoes'

export const dynamic = 'force-dynamic'

/**
 * O que cada função pode fazer, em todas as organizações (A7).
 *
 * Sem a tabela `funcoes` (migration 0100 ainda não aplicada), a matriz mostra
 * as funções do código e não edita: são os papéis e modelos de hoje.
 */
export default async function Funcoes() {
  const funcoes = await funcoesVigentes()
  return (
    <TelaDaAdministracao
      titulo="Funções"
      descricao="Proprietário, Administrador, Gestor e Atendente, do nível mais alto ao mais baixo. Quem está acima vê e muda quem está abaixo. Mudar uma célula vale na hora para todo mundo com aquela função; exceções por pessoa continuam valendo por cima."
    >
      {!funcoes.daTabela && (
        <p className="mb-3 rounded-[12px] border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-[12.5px] leading-5 text-aviso">
          Estas são as funções escritas no código. A edição liga quando a migration de funções (0100) for aplicada neste banco.
        </p>
      )}
      <MatrizDeFuncoes editavel={funcoes.daTabela} funcoes={FUNCOES.map((id) => funcoes.porId[id]).map(({ id, nome, nivel, descricao, capacidades }) => ({ id, nome, nivel, descricao, capacidades }))} />
      <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {FUNCOES.map((id) => (
          <li key={id} className="app-card px-4 py-3">
            <p className="text-[13px] font-bold">{funcoes.porId[id].nome}</p>
            <p className="mt-0.5 text-[12px] leading-5 text-muted">{funcoes.porId[id].descricao}</p>
          </li>
        ))}
      </ul>
    </TelaDaAdministracao>
  )
}
