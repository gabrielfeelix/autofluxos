import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { EsqueletoDeAbas, EsqueletoDeLista } from '@/components/design/esqueleto'
import { ListaDeTemplates } from '@/components/transmissoes/lista-de-templates'
import { ListaDeTransmissoes } from '@/components/transmissoes/lista-de-transmissoes'
import { acharCliente, type Cliente } from '@/server/repos/clientes'
import { listarTemplates } from '@/server/repos/templates'
import {
  enviadasHojePelaConta,
  listarTransmissoes,
  progressoDas,
} from '@/server/repos/transmissoes'

export const dynamic = 'force-dynamic'

/**
 * Modelos aprovados e transmissões.
 *
 * ---------------------------------------------------------------------------
 * Por que é uma tela nova, e não uma aba de Automações
 * ---------------------------------------------------------------------------
 *
 * Automações já tem uma aba chamada "Templates", e ela é **outra coisa**:
 * desenhos prontos de fluxo. Pôr o modelo da Meta ali faria duas coisas
 * diferentes com o mesmo nome na mesma tela, e a que importa aqui é a que tem
 * aprovação externa, prazo de revisão e recusa em inglês.
 *
 * A ordem das abas não é alfabética: **modelos vêm antes** porque sem um
 * aprovado não existe transmissão nenhuma. Quem chega aqui pela primeira vez
 * tem que ver a porta de entrada, não a tela vazia do passo seguinte.
 */

type Aba = 'transmissoes' | 'modelos'

const ABAS = [
  { chave: 'modelos', rotulo: 'Modelos aprovados' },
  { chave: 'transmissoes', rotulo: 'Transmissões' },
] as const satisfies readonly { chave: Aba; rotulo: string }[]

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const { clienteId } = await params
  const { aba: pedida } = await searchParams

  // Aba desconhecida cai em modelos, e não em tela em branco: o valor vem da
  // URL, e link velho não pode virar nada.
  const aba: Aba = pedida === 'transmissoes' ? 'transmissoes' : 'modelos'

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="transmissoes">
      <main className="w-full max-w-[1440px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <h1 className="mb-1 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Transmissões
        </h1>
        <p className="mb-5 text-[12.5px] leading-5 text-dim">
          Mandar mensagem para uma lista de contatos, com modelo aprovado pela Meta.
        </p>

        {/*
          Mesma fronteira da tela de Automações: título e abas aparecem no ato,
          o miolo chega depois. A `key` é a aba porque é ela que muda sem trocar
          de rota, sem a chave, o React segura o conteúdo velho na tela.
        */}
        <Suspense key={aba} fallback={<Espera aba={aba} />}>
          <Conteudo cliente={cliente} aba={aba} />
        </Suspense>
      </main>
    </ClienteShell>
  )
}

function Espera({ aba }: { aba: Aba }) {
  return (
    <>
      <EsqueletoDeAbas abas={ABAS} ativa={aba} />
      <EsqueletoDeLista
        linhas={4}
        rotulo={aba === 'modelos' ? 'Carregando os modelos…' : 'Carregando as transmissões…'}
      />
    </>
  )
}

async function Conteudo({ cliente, aba }: { cliente: Cliente; aba: Aba }) {
  const [templates, transmissoes, enviadasHoje] = await Promise.all([
    listarTemplates(cliente.id),
    listarTransmissoes(cliente.id),
    enviadasHojePelaConta(cliente.id),
  ])

  /*
   * O progresso de todas numa consulta só, contada no banco (0096). A lista
   * mostra "3 de 400 entregues", e sem o número a linha não diz nada.
   */
  const progressos = Object.fromEntries(await progressoDas(transmissoes.map((t) => t.id)))

  return (
    <>
      <nav className="mb-5 flex gap-1 border-b border-line" aria-label="Seções">
        {ABAS.map((item) => (
          <a
            key={item.chave}
            href={`/clientes/${cliente.id}/transmissoes?aba=${item.chave}`}
            aria-current={item.chave === aba ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold ${
              item.chave === aba
                ? 'border-accent text-ink'
                : 'border-transparent text-dim hover:text-ink'
            }`}
          >
            {item.rotulo}
          </a>
        ))}
      </nav>

      {aba === 'modelos' ? (
        <ListaDeTemplates clienteId={cliente.id} templates={templates} />
      ) : (
        <ListaDeTransmissoes
          clienteId={cliente.id}
          transmissoes={transmissoes}
          progressos={progressos}
          templates={templates}
          enviadasHoje={enviadasHoje}
        />
      )}
    </>
  )
}
