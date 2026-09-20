import Link from 'next/link'
import type { ReactNode } from 'react'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { NotificacoesDaFila } from '@/components/inbox/notificacoes-da-fila'
import { acaoDefinirPresenca, acaoSair } from '@/server/acoes-conta'
import type { Cliente } from '@/server/repos/clientes'
import { crmVisivel } from '@/server/repos/recursos'
import { presencaDoUsuario } from '@/server/repos/usuarios'
import { contasDoUsuario, ehAdminDaPlataforma, exigirAcessoAoCliente } from '@/server/sessao'
import { BarraLateral } from './barra-lateral'
import { type AbaDoCliente, secoesVisiveis } from './secoes-do-cliente'
import { LogoDoCliente } from './logo-cliente'
import { Marca } from './marca'

/**
 * A moldura das telas do cliente — **sidebar à esquerda, não abas no topo.**
 *
 * A troca foi pedida pelo dono, e o motivo aparece quando a lista cresce: cinco
 * abas já não cabiam em 390px e rolavam na horizontal; onze (a contagem do
 * produto que serviu de referência) não cabem em lugar nenhum. Barra lateral
 * cresce para baixo, que é a direção em que sobra espaço.
 *
 * **Os itens são os que têm tela.** O desenho da §2.1 do PLANO-SISTEMA lista
 * sete, e um deles — Campanhas — é Etapa B. A regra escrita no próprio plano,
 * a propósito de Quadros, vale para ele: *item de menu para tela que não existe
 * é promessa que a interface faz e o produto não cumpre*. Ele entra junto com a
 * frente que o constrói.
 *
 * **Integrações saiu dessa lista e não volta.** Aquele desenho a previa como
 * sétimo item, e a decisão foi outra: ela é seção de Configurações. O primeiro
 * nível é trabalho diário — Inbox, Contatos, Quadros, Automações —, e ligar um
 * canal é trabalho de uma vez só. Item permanente para tarefa episódica gasta a
 * única coisa escassa aqui, que é a posição fixa na tela de quem usa o produto
 * o dia inteiro. É também o que Intercom, HubSpot e Chatwoot fazem com o mesmo
 * punhado de conexões. O raciocínio está em `docs/PLANO-CONFIGURACOES.md` §1.1.
 *
 * **Continua sendo componente e não `layout.tsx`.** Como layout ele envolveria
 * também o editor de fluxo, que é tela cheia por natureza — e layout no Next
 * não se desliga num filho. O custo é passar `ativa` na mão, e é esse mesmo
 * custo que permite `ajustes/contexto`, `ajustes/whatsapp` e `ajustes/chaves`
 * acenderem "Configurações".
 */

export type { AbaDoCliente } from './secoes-do-cliente'

export async function ClienteShell({
  cliente,
  ativa,
  children,
}: {
  cliente: Cliente
  ativa: AbaDoCliente
  children: ReactNode
}) {
  /**
   * **A conferência de quem pode ver esta conta acontece aqui.**
   *
   * É o único ponto por onde todas as telas do cliente passam, o que a torna
   * difícil de esquecer numa tela nova — e é por isso que ela mora na moldura,
   * e não copiada em cada `page.tsx`. O editor de fluxo, que não usa moldura,
   * chama a mesma função por conta própria.
   */
  const acesso = await exigirAcessoAoCliente(cliente.id)
  const contas = acesso.sessao ? await contasDoUsuario(acesso.sessao.usuario.id) : []
  const presenca = await presencaDoUsuario(acesso.sessao.usuario.id)
  // O administrador da plataforma veio da lista de clientes e precisa do
  // caminho de volta. O dono do negócio, não: para ele não existe "todos os
  // clientes", existe a conta dele.
  const podeVerTodosOsClientes = ehAdminDaPlataforma(acesso.sessao)
  /*
   * O CRM é opcional (§4.2), e quem responde é `crmVisivel`: ele considera o
   * interruptor da conta **e** a existência de funil, para não esconder da noite
   * para o dia a tela de quem já usa quadros.
   */
  const mostraCrm = await crmVisivel(cliente.id)

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
      <BarraLateral
        marca={<Marca />}
        identidadeNoCelular={
          <>
            <LogoDoCliente cliente={cliente} tamanho={26} />
            <span className="max-w-[110px] truncate text-[12px] font-semibold">{cliente.nome}</span>
          </>
        }
        voltar={
          podeVerTodosOsClientes ? (
            <Link
              href="/painel"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-dim transition hover:text-primary md:mb-1.5 md:flex"
            >
              <span aria-hidden>‹</span> Todos os clientes
            </Link>
          ) : null
        }
        itens={secoesVisiveis({ crmVisivel: mostraCrm }).map((item) => ({
          chave: item.chave,
          rotulo: item.rotulo,
          href: `/clientes/${cliente.id}${item.href}`,
          icone: item.icone,
          acesa: item.chave === ativa,
        }))}
        rodape={
          <>
            <SeletorDeConta cliente={cliente} outrasContas={contas.length} papel={acesso.papel} />

            {/*
              O aviso de fila vive **aqui**, e não só no Inbox.

              Era o buraco do §3.10.1: o handoff acontecia e ninguém percebia, a
              não ser que a pessoa estivesse com o Inbox aberto. Quem está
              desenhando um fluxo ou conferindo contatos está no painel do mesmo
              jeito — e é justamente quem dá para avisar de graça.
            */}
            <NotificacoesDaFila clienteId={cliente.id} compacto />

            {presenca && <Presenca atual={presenca} />}

            <form action={acaoSair} className="mt-2 px-1.5">
              <button
                type="submit"
                className="rounded-[7px] px-1.5 py-1 text-[11.5px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-400"
              >
                Sair
              </button>
            </form>
          </>
        }
      />

      <div className="relative min-w-0 flex-1 md:overflow-auto">
        <FaixaDeImpersonacao />

        {/*
          A moldura **não** escreve título de página, e isso é diferente do que
          ela fazia com as abas.
          
          Antes ela punha o nome do cliente como `h1` em toda tela, e metade das
          telas já trazia o próprio — "Credenciais", "Contexto do negócio",
          "Acervo". Dois `h1` por página é ruído para quem navega por leitor de
          tela, e o título específico é sempre melhor que o genérico da seção.
          Quem diz onde você está é o item aceso na barra; quem dá nome à página
          é a página.
        */}
        <div className="app-page-enter flex min-h-full flex-col md:h-full">{children}</div>
      </div>
    </div>
  )
}

/**
 * A conta atual no rodapé da barra — e o caminho para as outras.
 *
 * Vira link para o seletor só quando a pessoa tem mais de uma companhia. Um
 * botão que abre uma lista de um item é atrito puro, e um usuário de conta
 * única é o caso comum.
 */
function SeletorDeConta({
  cliente,
  outrasContas,
  papel,
}: {
  cliente: Cliente
  outrasContas: number
  papel: string | null
}) {
  // Papel nulo só acontece para o administrador da plataforma: quem não é
  // membro nem administrador já foi recusado por `conferirAcessoAoCliente`.
  const legenda = PAPEIS[papel ?? ''] ?? 'administrador 4YU'

  const miolo = (
    <>
      <LogoDoCliente cliente={cliente} tamanho={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold">{cliente.nome}</span>
        <span className="block text-[11px] text-dim">{legenda}</span>
      </span>
      {outrasContas > 1 && (
        <span aria-hidden className="text-dim">
          ›
        </span>
      )}
    </>
  )

  if (outrasContas > 1) {
    return (
      <Link
        href="/contas"
        className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 transition hover:bg-surface"
      >
        {miolo}
      </Link>
    )
  }

  return <div className="flex items-center gap-2.5 px-1.5 py-1.5">{miolo}</div>
}

/**
 * Disponível ou ausente.
 *
 * Fica ao lado da conta, no rodapé, e não escondido num menu de perfil: é um
 * estado que a pessoa precisa **ver sem procurar**. Quem esquece de voltar de
 * "ausente" some da lista de quem pode receber conversa, e some sem erro nenhum
 * aparecer em lugar nenhum.
 */
function Presenca({ atual }: { atual: string }) {
  const disponivel = atual === 'disponivel'

  return (
    <form action={acaoDefinirPresenca.bind(null, disponivel ? 'ausente' : 'disponivel')}>
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-[10px] px-1.5 py-1.5 text-left transition hover:bg-surface"
      >
        {/* Ponto **e** palavra: quem não distingue as duas cores lê o estado
            do mesmo jeito (WCAG 1.4.1). */}
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${disponivel ? 'bg-emerald-400' : 'bg-dim'}`}
        />
        <span className="flex-1 text-[11.5px] text-muted">
          {disponivel ? 'Disponível' : 'Ausente'}
        </span>
        <span className="text-[10.5px] text-dim">trocar</span>
      </button>
    </form>
  )
}

/** O que cada papel do plugin de organização quer dizer em português. */
const PAPEIS: Record<string, string> = {
  owner: 'dono da conta',
  admin: 'administrador',
  member: 'equipe',
}

