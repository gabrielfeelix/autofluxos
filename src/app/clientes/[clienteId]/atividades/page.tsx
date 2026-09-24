import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarraDaAgenda } from '@/components/atividades/barra-da-agenda'
import { ListaDaAgenda } from '@/components/atividades/lista-da-agenda'
import { NovaAtividade } from '@/components/atividades/nova-atividade'
import { VistaDaAgenda } from '@/components/atividades/vista-da-agenda'
import { Paginacao } from '@/components/atividades/paginacao'
import { AjudaDaTela, type PassoDaAjuda } from '@/components/design/ajuda-da-tela'
import { SemAcesso } from '@/components/design/sem-acesso'
import { ClienteShell } from '@/components/design/cliente-shell'
import { intervaloDaVista, lerFiltroDaAgenda, paraParametros, POR_PAGINA_DA_AGENDA } from '@/core/atividades'
import { capacidadeNaPagina, filtroDoAcesso } from '@/server/permissoes'
import { responsaveisDoEscopo } from '@/server/repos/relatorios'
import { agendaDoIntervalo, paginaDaAgenda } from '@/server/repos/atividades'
import { acharCliente } from '@/server/repos/clientes'
import { membrosDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * A agenda da equipe como tela de trabalho (plano de UX de 23/09, fase 1).
 *
 * **O escopo é aplicado na consulta**, e não aqui: `filtroDoAcesso` vai para
 * `paginaDaAgenda()`, que o traduz em `where`. Filtrar depois de ler
 * entregaria a agenda inteira ao processo que não devia tê-la.
 *
 * **Nada nesta tela envia mensagem** (RB-33). É uma lista de lembretes para
 * pessoas; o cliente não é notificado por nada daqui.
 */

const PASSOS_DA_AJUDA: PassoDaAjuda[] = [
  {
    titulo: 'O que é uma atividade',
    texto: 'Um lembrete da equipe sobre um contato: ligar, marcar reunião, fazer visita, mandar proposta.',
  },
  {
    titulo: 'Onde ela nasce',
    texto: 'Na ficha do contato, na barra do Inbox ou pelo botão Nova atividade desta tela.',
  },
  {
    titulo: 'Lista ou agenda',
    texto: 'A lista mostra 50 por página, na ordem do prazo. A agenda mostra a semana ou o mês, com os mesmos filtros.',
  },
  {
    titulo: 'Como ela sai daqui',
    texto: 'Concluída ou cancelada (com motivo). As duas ficam guardadas e dá para reabrir.',
  },
]

function agoraDoServidor(): number {
  return Date.now()
}

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'atender', 'proprios')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="atividades">
        <SemAcesso clienteId={clienteId} oQue="Atividades" />
      </ClienteShell>
    )
  }
  const escopo = filtroDoAcesso(acesso, 'atender')
  const podeVerEquipe = escopo.tipo === 'tudo' || escopo.tipo === 'equipes'
  // Criar e escolher responsável seguem a capacidade da ação, não a da tela.
  const escopoDeCriar = filtroDoAcesso(acesso, 'criar_oportunidade')
  const podeCriar = escopoDeCriar.tipo !== 'impossivel'
  const podeCriarParaOutros = escopoDeCriar.tipo === 'tudo' || escopoDeCriar.tipo === 'equipes'

  const lido = lerFiltroDaAgenda(await searchParams)
  // Sem escopo de equipe, "equipe" e responsável de outra pessoa não existem.
  const filtro = podeVerEquipe ? lido : { ...lido, alcance: 'minhas' as const, responsavel: null }

  const agora = agoraDoServidor()
  const noCalendario = filtro.vista === 'agenda'
  const intervalo = intervaloDaVista(filtro.escala, filtro.dia, agora)
  const [pagina, calendario, membros] = await Promise.all([
    noCalendario
      ? null
      : paginaDaAgenda(clienteId, escopo, acesso.sessao.usuario.id, filtro, agora),
    noCalendario
      ? agendaDoIntervalo(clienteId, escopo, acesso.sessao.usuario.id, filtro, agora, intervalo)
      : null,
    podeVerEquipe || podeCriarParaOutros
      ? // O gestor escolhe responsável entre a equipe dele, não entre a conta
        // inteira: a consulta já não mostraria as atividades dos outros.
        Promise.all([membrosDaConta(clienteId), responsaveisDoEscopo(clienteId, escopo)]).then(
          ([membros, alcancados]) =>
            alcancados === null ? membros : membros.filter((membro) => alcancados.includes(membro.id)),
        )
      : Promise.resolve([]),
  ])

  const base = `/clientes/${cliente.id}/atividades`
  const endereco = (novo: Partial<typeof filtro>) => {
    const p = paraParametros({ ...filtro, ...novo }).toString()
    return p ? `${base}?${p}` : base
  }
  const aqui = endereco({})
  const filtrando =
    filtro.busca !== '' || filtro.tipo !== null || filtro.responsavel !== null || filtro.recorte !== null
  const equipe = membros.map((m) => ({ id: m.id, nome: m.nome || m.email }))

  return (
    <ClienteShell cliente={cliente} ativa="atividades">
      <main className="flex min-h-full w-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Atividades</h1>
          <AjudaDaTela
            titulo="Como funciona a agenda"
            resumo="Atividades são lembretes internos da equipe sobre um contato. Nenhuma delas manda mensagem ao cliente."
            passos={PASSOS_DA_AJUDA}
          >
            <p>
              <strong className="text-ink">Atividade não é mensagem agendada.</strong> Para o sistema mandar texto ao
              cliente numa hora marcada, use <em>Agendar mensagem</em> na conversa do Inbox.
            </p>
            <p>
              <strong className="text-ink">Vencida e hoje contam pelo dia, não pela hora.</strong> Marcada para hoje às
              9h continua sendo de hoje às 9h01. Sem prazo é &quot;algum dia&quot; e nunca fica vencida.
            </p>
            <p>
              <strong className="text-ink">O número no menu lateral</strong> soma as vencidas e as de hoje que você
              pode ver.
            </p>
          </AjudaDaTela>
          {podeCriar && (
            <NovaAtividade
              clienteId={cliente.id}
              usuarioId={acesso.sessao.usuario.id}
              equipe={equipe}
              podeAtribuir={podeCriarParaOutros}
              base={base}
              filtro={filtro}
              idsNaTela={(pagina?.itens ?? [...calendario!.itens, ...calendario!.semPrazo]).map((i) => i.id)}
            />
          )}
        </div>
        <p className="mt-1.5 mb-5 text-[13px] leading-6 text-dim">
          Lembretes internos da equipe. Nada aqui é enviado ao cliente.
        </p>

        <BarraDaAgenda
          base={base}
          filtro={filtro}
          contagens={(pagina ?? calendario!).contagens}
          equipe={equipe}
          podeVerEquipe={podeVerEquipe}
        />

        {calendario && (
          <VistaDaAgenda
            itens={calendario.itens}
            semPrazo={calendario.semPrazo}
            totalSemPrazo={calendario.totalSemPrazo}
            cortado={calendario.cortado}
            intervalo={intervalo}
            base={base}
            filtro={filtro}
            agora={agora}
            clienteId={cliente.id}
            volta={aqui}
            equipe={equipe}
            podeAtribuir={podeVerEquipe}
          />
        )}

        {pagina && pagina.itens.length === 0 && (
          <div className="app-card px-5 py-12 text-center">
            {filtrando || filtro.situacao !== 'aberta' ? (
              <>
                <p className="text-[13px] text-muted">Nada com estes filtros.</p>
                <Link
                  href={endereco({ busca: '', tipo: null, responsavel: null, recorte: null, situacao: 'aberta', pagina: 1 })}
                  className="app-secondary-button mt-4 inline-block px-4 py-2 text-[12px]"
                >
                  Limpar filtros
                </Link>
              </>
            ) : (
              <p className="mx-auto max-w-[440px] text-[13px] leading-6 text-muted">
                Nenhuma atividade aberta. Crie uma pela ficha do contato, pelo Inbox ou pelo botão acima.
              </p>
            )}
          </div>
        )}

        {pagina && pagina.itens.length > 0 && (
          <ListaDaAgenda
            itens={pagina.itens}
            agora={agora}
            clienteId={cliente.id}
            volta={aqui}
            equipe={equipe}
            podeAtribuir={podeVerEquipe}
          />
        )}

        {pagina && (
          <Paginacao
            pagina={filtro.pagina}
            porPagina={POR_PAGINA_DA_AGENDA}
            total={pagina.total}
            hrefDaPagina={(n) => endereco({ pagina: n })}
            rotulo="Páginas da agenda"
          />
        )}
      </main>
    </ClienteShell>
  )
}
