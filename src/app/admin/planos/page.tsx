import { TabelaDePlanos } from '@/components/admin/tabela-de-planos'
import { listarOrganizacoes } from '@/server/repos/organizacoes'
import { planosVigentes, tabelaDePlanosExiste } from '@/server/repos/planos'

export const dynamic = 'force-dynamic'

/**
 * Os planos e o que cada um libera, editáveis (A6).
 *
 * Sem a tabela `planos` no banco (migration 0099 ainda não aplicada), a tela
 * mostra os planos do código e desliga a edição, dizendo por quê.
 */
export default async function Planos() {
  const [planos, editavel, organizacoes] = await Promise.all([planosVigentes(), tabelaDePlanosExiste(), listarOrganizacoes()])
  const quantas = (id: string) => organizacoes.filter((organizacao) => (organizacao.plano || 'essencial') === id).length

  return (
    <TabelaDePlanos
      titulo="Planos"
      descricao="Preço, limite de conversas, excedente, números e o que cada plano libera. A troca de plano de uma organização é na aba Plano dela, ou em Pedidos de plano."
      antes={
        !editavel && (
          <p className="mb-3 rounded-[12px] border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-[12.5px] leading-5 text-aviso">
            Estes são os planos escritos no código. A edição liga quando a migration de planos (0099) for aplicada neste banco.
          </p>
        )
      }
      editavel={editavel}
      planos={planos.map((plano) => ({
        id: plano.id,
        nome: plano.nome,
        preco: plano.preco,
        conversas: plano.conversas,
        numeros: plano.numeros,
        precoExcedente: plano.precoExcedente,
        resumo: plano.resumo,
        itens: plano.itens,
        recursos: plano.recursos,
        ativo: plano.ativo,
        organizacoes: quantas(plano.id),
      }))}
    />
  )
}
