import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AjustesShell } from '@/components/design/ajustes-shell'
import {
  LogoChave,
  LogoInstagram,
  LogoLoja,
  LogoMeta,
  LogoTelegram,
  LogoWhatsApp,
} from '@/components/design/logos-de-marca'
import { idadeDoEvento, seloDaConexao } from '@/core/conexoes'
import {
  catalogoDeIntegracoes,
  type ChaveDaIntegracao,
  type ItemDoCatalogo,
} from '@/server/catalogo-de-integracoes'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/**
 * O catálogo: o que dá para ligar nesta conta, e o que já está ligado.
 *
 * ---------------------------------------------------------------------------
 * Por que existe, se o índice de Configurações já lista as mesmas conexões
 * ---------------------------------------------------------------------------
 *
 * Porque responde **outra pergunta**. O índice responde "onde eu mexo nisto"; o
 * catálogo responde "o que existe para ligar", inclusive o que ainda não
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
 * cinco cartões é moldura ocupando espaço, e é exatamente o tipo de coisa que
 * se coloca "porque a referência tem". Entram no dia em que houver catálogo de
 * verdade. Ver `docs/PLANO-UI-CONFIGURACOES.md` §1.6.
 */

type Aba = 'conectadas' | 'disponiveis'

const LOGO: Record<ChaveDaIntegracao, ReactNode> = {
  whatsapp: <LogoWhatsApp />,
  instagram: <LogoInstagram />,
  anuncios: <LogoMeta />,
  chaves: <LogoChave />,
  magento: <LogoLoja />,
  telegram: <LogoTelegram />,
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

  /*
   * A lista e o estado de cada uma vêm do mesmo catálogo que conta o "N de M"
   * do índice de Configurações (C02): os dois lados não divergem.
   */
  const integracoes = await catalogoDeIntegracoes(cliente.id)

  const conectadas = integracoes.filter((i) => i.estado.configurado)
  const disponiveis = integracoes.filter((i) => !i.estado.configurado)

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
        <h1 className="text-[22px] font-bold tracking-[-0.02em] md:text-[28px]">Todas as conexões</h1>
        <p className="mt-1.5 max-w-[640px] text-[13px] leading-6 text-dim">
          Tudo com que esta conta fala, os canais por onde a conversa passa e os sistemas que
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
            Nada aqui, tudo que existe já está ligado nesta conta.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((item) => (
              <Cartao key={item.chave} clienteId={cliente.id} item={item} />
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
      próprio, volta no histórico e sobrevive a um F5, e a tela inteira
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

function Cartao({ clienteId, item }: { clienteId: string; item: ItemDoCatalogo }) {
  const { estado } = item
  const selo = item.disponivel ? seloDaConexao(estado) : { texto: 'em breve', tom: 'neutro' as const }
  const conteudo = (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        {LOGO[item.chave]}
        <Selo tom={selo.tom}>{selo.texto}</Selo>
      </div>
      <p className="text-[13.5px] font-bold tracking-[-0.01em]">{item.nome}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-dim">{item.categoria}</p>
      <p className="mt-1.5 text-[12px] leading-5 text-muted">{item.descricao}</p>
      {item.emBreve && <p className="mt-2 text-[11px] leading-5 text-dim">{item.emBreve}</p>}
      {/*
        As camadas que não cabem no selo: a falha conhecida, com o que fazer, e
        a idade do último evento. Canal quieto não é falha: só a data aparece.
      */}
      {estado.configurado && estado.falha && (
        <p className="mt-2 text-[11.5px] leading-5 font-semibold text-perigo">{estado.falha}</p>
      )}
      {estado.configurado && item.rotuloDoEvento && (
        <p className="mt-2 text-[11px] leading-5 text-dim">
          {item.rotuloDoEvento}: {idadeDoEvento(estado.ultimoEvento)}
        </p>
      )}
      {/*
        A ação escrita, e não só o cartão clicável (T04): quem olha sabe o que
        acontece ao clicar. Sem tela, o texto não promete ação nenhuma.
      */}
      <span className="flex-1" />
      <p
        className={`mt-3 text-[12px] font-bold ${
          !item.href ? 'text-dim' : estado.falha ? 'text-perigo' : estado.proximaAcao && estado.configurado ? 'text-aviso' : 'text-primary'
        }`}
      >
        {acaoDoCartao(item)}
      </p>
    </>
  )

  if (!item.href) {
    /*
      Sem tela, o cartão **não** é link, nem link que não leva a lugar nenhum,
      nem botão desabilitado. Um cartão apagado e parado já diz o que precisa
      dizer, e o texto embaixo explica o que falta.
    */
    return <div className="app-card flex flex-col p-4 opacity-65">{conteudo}</div>
  }

  return (
    <Link
      href={`/clientes/${clienteId}${item.href}`}
      className="app-card app-card-interactive flex flex-col p-4 no-underline"
    >
      {conteudo}
    </Link>
  )
}

function acaoDoCartao(item: ItemDoCatalogo): string {
  if (!item.href || !item.disponivel) return 'Em breve'
  if (item.estado.configurado && item.estado.proximaAcao) return `${item.estado.proximaAcao.texto} ›`
  return item.estado.configurado ? 'Configurar ›' : 'Conectar ›'
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
