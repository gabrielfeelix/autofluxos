import { notFound } from 'next/navigation'
import { TabelaDeSegmentos } from '@/components/contatos/tabela-de-segmentos'
import { ClienteShell } from '@/components/design/cliente-shell'
import { SemAcesso } from '@/components/design/sem-acesso'
import { Trilha } from '@/components/design/trilha'
import { consultarContatos } from '@/server/consultas/contatos'
import { capacidadeNaPagina, filtroDoAcesso } from '@/server/permissoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarSegmentos } from '@/server/repos/segmentos'

export const dynamic = 'force-dynamic'

/**
 * CRM > Segmentos (UI-14, T6.2), como tabela no desenho de Etiquetas.
 *
 * **A capacidade é `exportar`**: um segmento compartilhado é o que alimenta uma
 * transmissão, e quem monta o público de um disparo está a um clique de
 * alcançar a base inteira. É o mesmo poder do CSV, por outra porta.
 *
 * Editar um segmento não muda transmissão nenhuma já confirmada: a lista
 * daquele envio foi congelada, e é isso que a RB-38 protege.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'exportar', 'todos')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="leads">
        <SemAcesso clienteId={clienteId} oQue="Segmentos" />
      </ClienteShell>
    )
  }
  const escopo = filtroDoAcesso(acesso, 'exportar')
  const segmentos = await listarSegmentos(clienteId)
  // Quantos casam agora, no escopo de quem olha: uma contagem por segmento.
  // Regra que o banco recusa (salva antes de a validação pegá-la) fica sem
  // número em vez de derrubar a tela: a pessoa precisa dela aberta para editar.
  const totais = await Promise.all(
    segmentos.map((s) =>
      consultarContatos({ clienteId, segmento: s.regra, escopo, porPagina: 1 }).then(
        (r) => r.total,
        (erro: unknown) => {
          console.error(`segmento ${s.id} não contou:`, erro)
          return null
        },
      ),
    ),
  )

  return (
    <ClienteShell cliente={cliente} ativa="leads">
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha caminho={[{ rotulo: 'CRM' }, { rotulo: 'Segmentos' }]} />
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Segmentos</h1>
        <p className="mt-1.5 mb-6 max-w-[680px] text-[13px] leading-6 text-dim">
          Um segmento é uma <strong className="text-soft">regra</strong>, não uma lista: “clientes sem comprar há 90
          dias” responde uma coisa hoje e outra no mês que vem, porque a regra é a mesma e as pessoas mudaram. Estar no
          segmento não autoriza mensagem: quem pode receber é conferido de novo no instante do envio.
        </p>

        <TabelaDeSegmentos
          clienteId={cliente.id}
          inicial={segmentos.map((s, i) => ({
            id: s.id,
            nome: s.nome,
            regra: s.regra,
            contatos: totais[i] ?? null,
            criadoPor: s.criadoPor,
            criadoEm: s.criadoEm,
          }))}
        />
      </main>
    </ClienteShell>
  )
}
