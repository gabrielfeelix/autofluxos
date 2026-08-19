import Link from 'next/link'
import type { ReactNode } from 'react'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { NotificacoesDaFila } from '@/components/inbox/notificacoes-da-fila'
import { acaoDefinirPresenca, acaoSair } from '@/server/acoes-conta'
import type { Cliente } from '@/server/repos/clientes'
import { presencaDoUsuario } from '@/server/repos/usuarios'
import { contasDoUsuario, ehAdminDaPlataforma, exigirAcessoAoCliente } from '@/server/sessao'
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
 * sete, e dois deles — Campanhas e Integrações — são Etapa B. A regra escrita
 * no próprio plano, a propósito de Quadros, vale para eles: *item de menu para
 * tela que não existe é promessa que a interface faz e o produto não cumpre*.
 * Cada um entra junto com a frente que o constrói.
 *
 * **Continua sendo componente e não `layout.tsx`.** Como layout ele envolveria
 * também o editor de fluxo, que é tela cheia por natureza — e layout no Next
 * não se desliga num filho. O custo é passar `ativa` na mão, e é esse mesmo
 * custo que permite `contexto`, `numero` e `conexoes` acenderem "Configurações".
 */
export type AbaDoCliente = 'inicio' | 'fluxos' | 'leads' | 'quadros' | 'inbox' | 'ajustes'

/**
 * As chaves são as antigas de propósito.
 *
 * `fluxos` acende "Automações" e `leads` acende "Contatos" — o rótulo mudou, a
 * chave não. Renomear as duas obrigaria a tocar as doze telas que passam
 * `ativa`, para arrumar uma palavra que só aparece aqui. É a mesma decisão que
 * manteve a rota `/leads` quando a aba virou "Contatos".
 */
const ITENS: {
  chave: AbaDoCliente
  rotulo: string
  href: string
  icone: ReactNode
}[] = [
  { chave: 'inicio', rotulo: 'Painel', href: '', icone: <IconePainel /> },
  { chave: 'inbox', rotulo: 'Inbox', href: '/inbox', icone: <IconeInbox /> },
  { chave: 'leads', rotulo: 'Contatos', href: '/leads', icone: <IconeContatos /> },
  // Quadros entra ao lado de Contatos, e não no fim, porque é a mesma gente
  // olhada de outro jeito: a lista responde "quem existe", o quadro responde
  // "em que ponto cada um está".
  { chave: 'quadros', rotulo: 'Quadros', href: '/quadros', icone: <IconeQuadros /> },
  { chave: 'fluxos', rotulo: 'Automações', href: '/fluxos', icone: <IconeAutomacoes /> },
  { chave: 'ajustes', rotulo: 'Configurações', href: '/ajustes', icone: <IconeConfiguracoes /> },
]

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

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col border-white/[0.06] bg-white/[0.014] md:w-[226px] md:border-r md:px-3.5 md:pt-5 md:pb-4">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 md:mb-5 md:block md:border-0 md:px-2 md:py-0">
          <Marca />
          {/* No celular a barra vira faixa e a identidade da conta perde o
              rodapé: sem isto, nada na tela diz de quem é a conta aberta. */}
          <span className="ml-auto flex items-center gap-2 md:hidden">
            <LogoDoCliente cliente={cliente} tamanho={26} />
            <span className="max-w-[130px] truncate text-[12px] font-semibold">{cliente.nome}</span>
          </span>
        </div>

        {podeVerTodosOsClientes && (
          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-dim transition hover:text-accent md:mb-1.5 md:flex"
          >
            <span aria-hidden>‹</span> Todos os clientes
          </Link>
        )}

        {/* Rola na horizontal no celular: nenhum item some, e a página não
            passa a rolar de lado por causa da navegação. */}
        <nav
          aria-label="Seções do cliente"
          className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2 md:flex-col md:gap-0.5 md:overflow-visible md:border-0 md:p-0"
        >
          {ITENS.map((item) => {
            const acesa = item.chave === ativa
            return (
              <Link
                key={item.chave}
                href={`/clientes/${cliente.id}${item.href}`}
                aria-current={acesa ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-semibold transition ${
                  acesa
                    ? 'bg-accent/[0.12] text-white hover:bg-accent/[0.16]'
                    : 'text-muted hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <span className={acesa ? 'text-accent' : 'text-dim'}>{item.icone}</span>
                {item.rotulo}
              </Link>
            )
          })}
        </nav>

        <div className="hidden flex-1 md:block" />

        <div className="hidden border-t border-white/[0.06] pt-3 md:block">
          <SeletorDeConta
            cliente={cliente}
            outrasContas={contas.length}
            papel={acesso.papel}
          />

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
              className="rounded-[7px] px-1.5 py-1 text-[11.5px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

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
        <div className="app-page-enter flex min-h-full flex-col">{children}</div>
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
        className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 transition hover:bg-white/[0.04]"
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
        className="flex w-full items-center gap-2 rounded-[10px] px-1.5 py-1.5 text-left transition hover:bg-white/[0.04]"
      >
        {/* Ponto **e** palavra: quem não distingue as duas cores lê o estado
            do mesmo jeito (WCAG 1.4.1). */}
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${disponivel ? 'bg-emerald-400' : 'bg-white/25'}`}
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

function IconePainel() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.6" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.6" opacity=".45" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.6" opacity=".45" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.6" opacity=".45" />
    </svg>
  )
}

function IconeInbox() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.2" y="2.4" width="12.6" height="10.2" rx="2" />
      <path d="M1.6 4.2 7.5 8.4l5.9-4.2" />
    </svg>
  )
}

function IconeContatos() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="6" cy="5" r="2.6" />
      <path d="M1.4 13c0-2.4 2.1-4 4.6-4s4.6 1.6 4.6 4" />
      <path d="M10.6 3.1a2.4 2.4 0 0 1 0 4.4M11.6 9.3c1.3.5 2.1 1.6 2.1 3.1" opacity=".5" />
    </svg>
  )
}

function IconeQuadros() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.4" y="2" width="3.4" height="11" rx="1" />
      <rect x="5.8" y="2" width="3.4" height="7.4" rx="1" />
      <rect x="10.2" y="2" width="3.4" height="9.2" rx="1" opacity=".6" />
    </svg>
  )
}

function IconeAutomacoes() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="3.4" cy="3.4" r="2" />
      <circle cx="11.6" cy="3.4" r="2" />
      <circle cx="7.5" cy="11.8" r="2" />
      <path d="M3.4 5.4v1.4a1.6 1.6 0 0 0 1.6 1.6h5a1.6 1.6 0 0 0 1.6-1.6V5.4M7.5 8.4v1.4" />
    </svg>
  )
}

function IconeConfiguracoes() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7.5" cy="7.5" r="2.3" />
      <path d="M7.5 1.2v1.6M7.5 12.2v1.6M1.2 7.5h1.6M12.2 7.5h1.6M3 3l1.2 1.2M10.8 10.8 12 12M12 3l-1.2 1.2M4.2 10.8 3 12" />
    </svg>
  )
}
