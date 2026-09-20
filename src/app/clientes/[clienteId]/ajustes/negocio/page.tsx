import { notFound } from 'next/navigation'
import { FichaDoCliente } from '@/components/cliente/ficha'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Trilha } from '@/components/design/trilha'
import { acaoRemoverLogo, acaoSalvarCadastro, acaoSalvarLogo } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { FaixasDeNivelDaConta } from '@/components/cliente/faixas-de-nivel'
import { faixasDaConta } from '@/server/repos/relacionamento'
import { FAIXAS_PADRAO } from '@/core/relacionamento'

export const dynamic = 'force-dynamic'

/**
 * Os dados do negócio saíram da primeira tela.
 *
 * Cadastro e logo são configuração: olhados uma vez por trimestre e ocupando o
 * pé da tela mais visitada do produto. As duas frentes chegaram à mesma
 * conclusão por caminhos diferentes — `docs/PLANO-HOMEPAGE.md` §7 e
 * `docs/PLANO-CONFIGURACOES.md` §4 —, e esta rota é o endereço combinado.
 *
 * A página só monta `FichaDoCliente`, que não mudou: o componente já era
 * autônomo, e movê-lo de lugar não era motivo para reescrevê-lo.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, faixas] = await Promise.all([acharCliente(clienteId), faixasDaConta(clienteId)])
  if (!cliente) notFound()

  return (
    <AjustesShell cliente={cliente} ativa="negocio">
      <main className="w-full max-w-[1100px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Dados da empresa' },
          ]}
        />
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Dados da empresa</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          O cadastro e o logo desta conta. Nada daqui vai para o WhatsApp — é o que a
          4YU usa para saber com quem fala.
        </p>

        <FichaDoCliente
          cliente={cliente}
          salvarCadastro={acaoSalvarCadastro.bind(null, cliente.id)}
          salvarLogo={acaoSalvarLogo.bind(null, cliente.id)}
          removerLogo={acaoRemoverLogo.bind(null, cliente.id)}
        />

        {/* O nível do cliente mora aqui, e não numa tela própria: é ajuste de
            uma vez por ano, e item de menu para isso gastaria a posição fixa
            que este produto reserva para trabalho diário. */}
        <div className="mt-5">
          <FaixasDeNivelDaConta clienteId={cliente.id} faixas={faixas ?? FAIXAS_PADRAO} />
        </div>
      </main>
    </AjustesShell>
  )
}
