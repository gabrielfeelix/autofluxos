import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { acharCliente } from '@/server/repos/clientes'
import { listarConexoes } from '@/server/repos/conexoes'
import { listarCanais } from '@/server/repos/conversas'

export const dynamic = 'force-dynamic'

/**
 * O índice da configuração.
 *
 * Cada linha mostra **o estado atual** antes de mandar para a tela. Isso é o
 * que separa um índice de um menu: conferir se o contexto está preenchido ou
 * quantas credenciais existem deixa de exigir abrir as três telas e voltar.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [conexoes, canais] = await Promise.all([
    listarConexoes(cliente.id),
    listarCanais(cliente.id),
  ])
  const semContexto = cliente.contextoNegocio.trim() === ''

  return (
    <main className="max-w-[720px] px-[42px] pt-[26px] pb-[42px]">
      <ul className="app-card divide-y divide-white/[0.045] overflow-hidden">
        <Linha
          href={`/clientes/${cliente.id}/contexto`}
          titulo="Contexto do negócio"
          descricao="A única coisa que o bloco de IA pode dizer. Sem isto, ele responde “não sei” a tudo."
          estado={
            semContexto ? (
              <Selo tom="alerta">vazio</Selo>
            ) : (
              <Selo tom="ok">{`${cliente.contextoNegocio.trim().split(/\s+/).length} palavras`}</Selo>
            )
          }
        />
        <Linha
          href={`/clientes/${cliente.id}/conexoes`}
          titulo="Credenciais"
          descricao="As chaves que os blocos de API usam para falar com os sistemas deste cliente."
          estado={
            <Selo tom={conexoes.length === 0 ? 'neutro' : 'ok'}>
              {conexoes.length === 0
                ? 'nenhuma'
                : `${conexoes.length} ${conexoes.length === 1 ? 'chave' : 'chaves'}`}
            </Selo>
          }
        />
        <Linha
          href={`/clientes/${cliente.id}/numero`}
          titulo="Número do WhatsApp"
          descricao="Qual número atende, qual fluxo ele executa, e o endereço para o painel da Meta."
          estado={
            <Selo tom={canais.length === 0 ? 'alerta' : 'ok'}>
              {canais.length === 0
                ? 'nenhum'
                : `${canais.length} ${canais.length === 1 ? 'número' : 'números'}`}
            </Selo>
          }
        />
      </ul>
    </main>
  )
}

function Linha({
  href,
  titulo,
  descricao,
  estado,
}: {
  href: string
  titulo: string
  descricao: string
  estado: ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-4 px-6 py-[18px] transition hover:bg-white/[0.03]"
      >
        <span className="min-w-0 flex-1">
          <strong className="block text-[13.5px] font-bold">{titulo}</strong>
          <span className="mt-0.5 block text-[12px] leading-5 text-dim">
            {descricao}
          </span>
        </span>
        {estado}
        <span aria-hidden className="text-[15px] text-muted">
          ›
        </span>
      </Link>
    </li>
  )
}

function Selo({
  children,
  tom,
}: {
  children: ReactNode
  tom: 'ok' | 'alerta' | 'neutro'
}) {
  const cor = {
    ok: 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300',
    alerta: 'border-amber-300/30 bg-amber-300/[0.1] text-amber-200',
    neutro: 'border-white/10 bg-white/[0.04] text-muted',
  }[tom]

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${cor}`}
    >
      {children}
    </span>
  )
}
