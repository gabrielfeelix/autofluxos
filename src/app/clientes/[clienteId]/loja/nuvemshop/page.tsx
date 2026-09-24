import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Trilha } from '@/components/design/trilha'
import { LojaNuvemshop } from '@/components/loja/loja-nuvemshop'
import {
  acaoConectarNuvemshop,
  acaoDesconectarNuvemshop,
  acaoLigarNuvemshop,
  acaoTestarNuvemshop,
} from '@/server/acoes-loja'
import { nuvemshopConfigurado } from '@/server/nuvemshop/conexao'
import { acharCliente } from '@/server/repos/clientes'
import { lojaNuvemshopDaConta } from '@/server/repos/lojas'

export const dynamic = 'force-dynamic'

/**
 * A loja Nuvemshop da conta (F4 do plano de navegação). Conecta por OAuth do
 * app de parceiro; o bot só lê. Fontes em
 * `docs/INTEGRACAO-MAGENTO-23-SET.md`, seção Nuvemshop.
 */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ resultado?: string }>
}) {
  const [{ clienteId }, { resultado }] = await Promise.all([params, searchParams])
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const loja = await lojaNuvemshopDaConta(cliente.id)
  const conectada = Boolean(loja?.storeId && loja.conexaoId)

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <main className="w-full max-w-[1100px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha caminho={[{ rotulo: 'Conectar loja', href: `/clientes/${cliente.id}/loja` }, { rotulo: 'Nuvemshop' }]} />
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Loja Nuvemshop</h1>
        <p className="mt-1 mb-6 max-w-[620px] text-[13px] leading-6 text-muted">
          O bot consulta a loja <strong className="text-soft">na hora da conversa</strong>: diz se tem, quanto custa,
          quanto há em estoque e manda o link do produto. Ele só lê. Nada é criado, alterado ou apagado na loja, e
          quem fecha a compra é o site.
        </p>

        <LojaNuvemshop
          liberada={nuvemshopConfigurado()}
          resultado={resultado ?? null}
          inicial={conectada && loja ? { endereco: loja.endereco, ativa: loja.ativa } : null}
          catalogoHref={`/clientes/${cliente.id}/loja/catalogo`}
          conectar={acaoConectarNuvemshop.bind(null, cliente.id)}
          testar={acaoTestarNuvemshop.bind(null, cliente.id)}
          ligar={acaoLigarNuvemshop.bind(null, cliente.id)}
          desconectar={acaoDesconectarNuvemshop.bind(null, cliente.id)}
        />
      </main>
    </ClienteShell>
  )
}
