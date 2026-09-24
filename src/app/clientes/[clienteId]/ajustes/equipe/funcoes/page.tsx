import { notFound } from 'next/navigation'
import { MatrizDeFuncoes } from '@/components/admin/matriz-de-funcoes'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Trilha } from '@/components/design/trilha'
import { FUNCOES } from '@/core/funcoes'
import { acharCliente } from '@/server/repos/clientes'
import { funcoesVigentes } from '@/server/repos/funcoes'

export const dynamic = 'force-dynamic'

/**
 * Configurações > Pessoas > Funções: o que cada função pode, só leitura.
 * Quem define as funções é a plataforma; a organização escolhe a função de
 * cada pessoa e, se precisar, ajusta o acesso de uma pessoa só.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, funcoes] = await Promise.all([acharCliente(clienteId), funcoesVigentes()])
  if (!cliente) notFound()

  return (
    <AjustesShell cliente={cliente} ativa="equipe">
      <main className="w-full px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Pessoas', href: `/clientes/${cliente.id}/ajustes/equipe` },
            { rotulo: 'Funções' },
          ]}
        />
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Funções</h1>
        <p className="mt-1.5 mb-6 max-w-[680px] text-[13px] leading-6 text-dim">
          O que cada função pode fazer nesta organização. Quem está acima vê e muda quem está abaixo. Para dar a alguém um acesso diferente da função, use Ajustar acesso na tela Pessoas.
        </p>
        <MatrizDeFuncoes funcoes={FUNCOES.map((id) => funcoes.porId[id]).map(({ id, nome, nivel, descricao, capacidades }) => ({ id, nome, nivel, descricao, capacidades }))} />
      </main>
    </AjustesShell>
  )
}
