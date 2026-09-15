import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AjustesShell } from '@/components/design/ajustes-shell'
import {
  LogoChave,
  LogoInstagram,
  LogoMeta,
  LogoTelegram,
  LogoWhatsApp,
} from '@/components/design/logos-de-marca'
import { saudeDoInstagram, saudeDoWhatsApp, type SaudeDaConexao } from '@/core/saude-da-conexao'
import { acharCliente } from '@/server/repos/clientes'
import { canalDoInstagram } from '@/server/repos/canais-instagram'
import { listarConexoes } from '@/server/repos/conexoes'
import { listarCanais } from '@/server/repos/conversas'
import { paginasDaConta } from '@/server/repos/paginas-de-lead'

export const dynamic = 'force-dynamic'

/**
 * O catálogo: o que dá para ligar nesta conta, e o que já está ligado.
 *
 * ---------------------------------------------------------------------------
 * Por que existe, se o índice de Configurações já lista as mesmas conexões
 * ---------------------------------------------------------------------------
 *
 * Porque responde **outra pergunta**. O índice responde "onde eu mexo nisto"; o
 * catálogo responde "o que existe para ligar" — inclusive o que ainda não
 * existe. Hoje nada no produto diz que o Telegram está desenhado e não
 * implementado: a informação mora num comentário de `core/canais.ts`, que
 * ninguém fora do código lê.
 *
 * A diferença aparece no formato. Aqui a logo da marca é o rótulo: reconhecer o
 * WhatsApp pelo verde é mais rápido do que ler a palavra, e é o que faz isto
 * parecer catálogo em vez de lista de configurações.
 *
 * ---------------------------------------------------------------------------
 * O que a referência tem e esta tela não
 * ---------------------------------------------------------------------------
 *
 * Busca e filtro por categoria. São cinco integrações: quinze categorias para
 * cinco cartões é moldura ocupando espaço — e é exatamente o tipo de coisa que
 * se coloca "porque a referência tem". Entram no dia em que houver catálogo de
 * verdade. Ver `docs/PLANO-UI-CONFIGURACOES.md` §1.6.
 */

type Aba = 'conectadas' | 'disponiveis'

type Integracao = {
  chave: string
  nome: string
  categoria: string
  descricao: string
  logo: ReactNode
  saude: SaudeDaConexao
  /** Para onde o cartão leva. `null` = não há tela: o canal ainda não existe. */
  href: string | null
  /** Quando não dá para ligar, o que falta — escrito para quem não é da casa. */
  emBreve?: string
}

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const { clienteId } = await params
  const { aba: abaPedida } = await searchParams
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [canais, contaDoInstagram, paginasDeLead, conexoes] = await Promise.all([
    listarCanais(cliente.id),
    canalDoInstagram(cliente.id),
    paginasDaConta(cliente.id),
    listarConexoes(cliente.id),
  ])

  const base = `/clientes/${cliente.id}/ajustes`

  const integracoes: Integracao[] = [
    {
      chave: 'whatsapp',
      nome: 'WhatsApp',
      categoria: 'Canal',
      descricao:
        'O número da empresa atendendo pela Cloud API da Meta. É por onde a conversa entra e sai.',
      logo: <LogoWhatsApp />,
      saude: saudeDoWhatsApp(canais),
      href: `${base}/whatsapp`,
    },
    {
      chave: 'instagram',
      nome: 'Instagram',
      categoria: 'Canal',
      descricao:
        'O direct de uma conta profissional chegando no mesmo Inbox do WhatsApp.',
      logo: <LogoInstagram />,
      saude: saudeDoInstagram(contaDoInstagram),
      href: `${base}/instagram`,
    },
    {
      chave: 'anuncios',
      nome: 'Anúncios da Meta',
      categoria: 'Leads',
      descricao:
        'Quem preenche o formulário de um anúncio no Facebook ou no Instagram entra aqui como lead.',
      logo: <LogoMeta />,
      saude: paginasDeLead.length === 0 ? 'nao-ligada' : 'ligada',
      href: `${base}/anuncios`,
    },
    {
      chave: 'chaves',
      nome: 'Chaves de API',
      categoria: 'Sistemas do cliente',
      descricao:
        'As chaves que os blocos de Serviços externos usam para falar com os sistemas deste cliente.',
      logo: <LogoChave />,
      saude: conexoes.length === 0 ? 'nao-ligada' : 'ligada',
      href: `${base}/chaves`,
    },
    {
      chave: 'telegram',
      nome: 'Telegram',
      categoria: 'Canal',
      descricao: 'Atendimento no Telegram, com teclado inline e sem janela de 24 horas.',
      logo: <LogoTelegram />,
      saude: 'nao-ligada',
      href: null,
      emBreve: 'Desenhado, sem adaptador de entrega. Não dá para ligar ainda.',
    },
  ]

  const conectadas = integracoes.filter((i) => i.saude !== 'nao-ligada')
  const disponiveis = integracoes.filter((i) => i.saude === 'nao-ligada')

  /*
   * A aba com nada dentro não pode ser a que abre: conta nova tem zero
   * conectadas, e a primeira coisa que ela veria seria um vazio.
   */
  const aba: Aba =
    abaPedida === 'conectadas' || abaPedida === 'disponiveis'
      ? abaPedida
      : conectadas.length > 0
        ? 'conectadas'
        : 'disponiveis'

  const lista = aba === 'conectadas' ? conectadas : disponiveis

  return (
    <AjustesShell cliente={cliente} ativa="integracoes">
      <main className="w-full max-w-[1100px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] md:text-[28px]">Integrações</h1>
        <p className="mt-1.5 max-w-[640px] text-[13px] leading-6 text-dim">
          Tudo com que esta conta fala — os canais por onde a conversa passa e os sistemas que
          entregam e recebem dado. Cada cartão leva para onde se liga e se confere.
        </p>

        <div className="mt-6 mb-5 flex gap-1 border-b border-line">
          <Tab href={`?aba=conectadas`} ativa={aba === 'conectadas'}>
            Conectadas ({conectadas.length})
          </Tab>
          <Tab href={`?aba=disponiveis`} ativa={aba === 'disponiveis'}>
            Disponíveis ({disponiveis.length})
          </Tab>
        </div>

        {lista.length === 0 ? (
          <p className="app-card px-5 py-8 text-center text-[13px] text-muted">
            Nada aqui — tudo que existe já está ligado nesta conta.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((item) => (
              <Cartao key={item.chave} item={item} />
            ))}
          </div>
        )}
      </main>
    </AjustesShell>
  )
}

function Tab({
  href,
  ativa,
  children,
}: {
  href: string
  ativa: boolean
  children: ReactNode
}) {
  return (
    /*
      Aba é link, e não botão com estado no navegador: assim ela tem endereço
      próprio, volta no histórico e sobrevive a um F5 — e a tela inteira
      continua sendo desenhada no servidor.
    */
    <Link
      href={href}
      aria-current={ativa ? 'page' : undefined}
      className={`-mb-px border-b-2 px-3 pb-2.5 text-[13px] transition ${
        ativa
          ? 'border-primary font-bold text-primary'
          : 'border-transparent font-medium text-muted hover:text-ink'
      }`}
    >
      {children}
    </Link>
  )
}

function Cartao({ item }: { item: Integracao }) {
  const conteudo = (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        {item.logo}
        <SeloDaSaude saude={item.saude} emBreve={Boolean(item.emBreve)} />
      </div>
      <p className="text-[13.5px] font-bold tracking-[-0.01em]">{item.nome}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-dim">{item.categoria}</p>
      <p className="mt-1.5 text-[12px] leading-5 text-muted">{item.descricao}</p>
      {item.emBreve && <p className="mt-2 text-[11px] leading-5 text-dim">{item.emBreve}</p>}
    </>
  )

  if (!item.href) {
    /*
      Sem tela, o cartão **não** é link — nem link que não leva a lugar nenhum,
      nem botão desabilitado. Um cartão apagado e parado já diz o que precisa
      dizer, e o texto embaixo explica o que falta.
    */
    return <div className="app-card flex flex-col p-4 opacity-65">{conteudo}</div>
  }

  return (
    <Link href={item.href} className="app-card app-card-interactive flex flex-col p-4 no-underline">
      {conteudo}
    </Link>
  )
}

function SeloDaSaude({ saude, emBreve }: { saude: SaudeDaConexao; emBreve: boolean }) {
  if (emBreve) return <Selo tom="neutro">em breve</Selo>

  if (saude === 'reconectar') return <Selo tom="perigo">reconectar</Selo>
  if (saude === 'vencendo') return <Selo tom="alerta">vence em breve</Selo>
  if (saude === 'ligada') return <Selo tom="ok">conectada</Selo>
  return <Selo tom="neutro">conectar</Selo>
}

function Selo({
  children,
  tom,
}: {
  children: ReactNode
  tom: 'ok' | 'alerta' | 'perigo' | 'neutro'
}) {
  const cor = {
    ok: 'border-emerald-400/25 bg-emerald-400/[0.08] text-ok',
    alerta: 'border-amber-300/30 bg-amber-300/[0.1] text-aviso',
    perigo: 'border-rose-400/30 bg-rose-400/[0.09] text-perigo',
    neutro: 'border-line bg-surface text-muted',
  }[tom]

  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${cor}`}>
      {children}
    </span>
  )
}
