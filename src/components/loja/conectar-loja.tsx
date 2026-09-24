'use client'

import Link from 'next/link'
import { useState, useTransition, type ReactNode } from 'react'
import type { EstadoDaPlataforma, FichaDaPlataforma, PlataformaDeLoja } from '@/core/plataformas-de-loja'

export type CartaoDePlataforma = {
  ficha: FichaDaPlataforma
  estado: EstadoDaPlataforma
  /** A conta já deu "Quero esta" nesta plataforma. */
  pedida: boolean
}

type Resposta = { ok: true } | { ok: false; motivo: string }

/**
 * A tela Loja > Conectar loja (plano de navegação e CRM, 5.6).
 *
 * Grade de cartões à esquerda, o que a conexão rende à direita. **Todo cartão
 * leva a um próximo passo**: conectar, abrir a conexão, religar, ou o "Quero
 * esta", que grava o pedido da conta e muda o cartão na hora (otimista, sem
 * recarregar a rota).
 */
export function ConectarLoja({
  clienteId,
  cartoes,
  queroEsta,
  guiaDoMagento,
}: {
  clienteId: string
  cartoes: CartaoDePlataforma[]
  queroEsta: (plataforma: PlataformaDeLoja) => Promise<Resposta>
  guiaDoMagento: string
}) {
  const nenhumaConectada = !cartoes.some((c) => c.estado === 'conectada')
  const agora = cartoes.filter((c) => c.estado !== 'em_breve')
  const emBreve = cartoes.filter((c) => c.estado === 'em_breve')

  return (
    <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
      <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Conectar loja</h1>
      <p className="mt-1.5 mb-6 max-w-[680px] text-[13px] leading-6 text-dim">
        Ligue a sua loja on-line e o bot passa a responder com o que está nela: o produto certo, o preço, o estoque e o
        link para comprar. Ele só lê a loja; quem fecha a compra é o site.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {nenhumaConectada && <SemLojaAinda clienteId={clienteId} />}

          {agora.length > 0 && (
            <Grupo titulo="Disponível agora">
              <div className="flex flex-col gap-3">
                {agora.map((cartao) => (
                  <CartaoLargo
                    key={cartao.ficha.id}
                    clienteId={clienteId}
                    cartao={cartao}
                    guia={cartao.ficha.id === 'magento' ? guiaDoMagento : null}
                  />
                ))}
              </div>
            </Grupo>
          )}

          {emBreve.length > 0 && (
            <Grupo titulo="Em breve" nota="Brasil primeiro. Clique em Quero esta na sua e ela sobe na fila.">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {emBreve.map((cartao) => (
                  <Cartao key={cartao.ficha.id} cartao={cartao} queroEsta={queroEsta} />
                ))}
              </div>
            </Grupo>
          )}

          <p className="text-[12px] leading-5 text-dim">
            A sua não está na lista? Fale com a gente pelo suporte. Cada &quot;Quero esta&quot; conta um pedido da sua
            conta, e a plataforma mais pedida é a próxima a chegar.
          </p>
        </div>

        <OQueRende />
      </div>
    </main>
  )
}

/** Estado vazio que ensina e tem botão: sem loja conectada, o catálogo já serve. */
function SemLojaAinda({ clienteId }: { clienteId: string }) {
  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-primary/20 bg-primary-weak p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="text-[14.5px] font-bold">Nenhuma loja conectada ainda</h2>
        <p className="mt-1 max-w-[560px] text-[12.5px] leading-5 text-muted">
          Escolha a sua plataforma abaixo. Se ela ainda não chegou, monte o catálogo à mão enquanto isso: o bot já
          responde com os produtos que estiverem lá.
        </p>
      </div>
      <Link
        href={`/clientes/${clienteId}/loja/catalogo`}
        className="app-primary-button inline-flex shrink-0 items-center justify-center gap-1.5 px-4 py-2.5 text-[12.5px]"
      >
        Montar o catálogo
        <span aria-hidden>›</span>
      </Link>
    </section>
  )
}

function Grupo({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[13px] font-bold tracking-[0.01em] text-soft">{titulo}</h2>
        {nota && <p className="text-[12px] text-dim">{nota}</p>}
      </div>
      {children}
    </section>
  )
}

/** A plataforma que já conecta: cartão largo, com o botão à mão. */
function CartaoLargo({
  clienteId,
  cartao,
  guia,
}: {
  clienteId: string
  cartao: CartaoDePlataforma
  guia: string | null
}) {
  const { ficha, estado } = cartao

  return (
    <article className="app-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <Marca id={ficha.id} nome={ficha.nome} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-bold tracking-[-0.01em]">{ficha.nome}</h3>
          <SeloDoEstado estado={estado} />
        </div>
        <p className="mt-1 text-[12.5px] leading-5 text-muted">{ficha.resumo}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        {guia && (
          <a href={guia} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-muted underline-offset-2 hover:underline">
            Ver guia
          </a>
        )}
        <Link
          href={`/clientes/${clienteId}${ficha.href}`}
          className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-[12.5px] font-bold transition ${
            estado === 'conectada'
              ? 'border border-line text-ink hover:bg-surface'
              : 'bg-primary text-white hover:bg-primary-strong'
          }`}
        >
          {estado === 'conectada' ? 'Abrir a conexão' : estado === 'configurada' ? 'Ligar de novo' : 'Conectar'}
          <span aria-hidden>›</span>
        </Link>
      </div>
    </article>
  )
}

/** A plataforma "Em breve": o próximo passo é o "Quero esta". */
function Cartao({
  cartao,
  queroEsta,
}: {
  cartao: CartaoDePlataforma
  queroEsta: (plataforma: PlataformaDeLoja) => Promise<Resposta>
}) {
  const { ficha } = cartao

  return (
    <article className="app-card flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <Marca id={ficha.id} nome={ficha.nome} />
        {ficha.brasileira && (
          <span className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] font-bold text-muted">
            Brasil
          </span>
        )}
      </div>
      <h3 className="text-[15px] font-bold tracking-[-0.01em]">{ficha.nome}</h3>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">{ficha.resumo}</p>

      <span className="min-h-5 flex-1" />

      <QueroEsta plataforma={ficha.id} jaPedida={cartao.pedida} queroEsta={queroEsta} />
    </article>
  )
}

/**
 * O "Quero esta": marca na hora e desfaz se o servidor recusar. Uma vez por
 * conta; depois de gravado o botão vira a confirmação e não volta a aparecer.
 */
function QueroEsta({
  plataforma,
  jaPedida,
  queroEsta,
}: {
  plataforma: PlataformaDeLoja
  jaPedida: boolean
  queroEsta: (plataforma: PlataformaDeLoja) => Promise<Resposta>
}) {
  const [pedida, setPedida] = useState(jaPedida)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()

  function pedir() {
    setPedida(true)
    setErro(null)
    comecar(async () => {
      const r = await queroEsta(plataforma)
      if (!r.ok) {
        setPedida(false)
        setErro(r.motivo)
      }
    })
  }

  if (pedida) {
    return (
      <p role="status" className="flex flex-col rounded-[10px] bg-emerald-400/[0.09] px-3 py-2 text-[12px] leading-5">
        <span className="font-bold text-ok">✓ Pedido anotado</span>
        <span className="text-muted">Conta a favor dela na fila das próximas.</span>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={pedir}
        className="inline-flex items-center justify-center self-start rounded-[10px] border border-line px-3.5 py-2 text-[12.5px] font-bold text-ink transition hover:bg-surface"
      >
        Quero esta
      </button>
      {erro && (
        <p role="alert" className="text-[11.5px] leading-4 text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}

function SeloDoEstado({ estado }: { estado: EstadoDaPlataforma }) {
  const [texto, cor] = {
    conectada: ['Conectada', 'border-emerald-400/25 bg-emerald-400/[0.08] text-ok'],
    configurada: ['Desligada', 'border-amber-300/30 bg-amber-300/[0.1] text-aviso'],
    disponivel: ['Disponível', 'border-primary/25 bg-primary-weak text-primary'],
    em_breve: ['Em breve', 'border-line bg-surface text-muted'],
  }[estado]
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${cor}`}>{texto}</span>
}

/**
 * A marca da plataforma: a inicial sobre a cor dela (`--marca-<id>` em
 * `globals.css`). Sem logo desenhada: sete silhuetas de marca alheia para uma
 * grade de escolha seria custo sem ganho, e a cor mais o nome já identificam.
 */
function Marca({ id, nome }: { id: PlataformaDeLoja; nome: string }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-[12px] text-[17px] font-extrabold text-white"
      style={{ backgroundColor: `var(--marca-${id})` }}
    >
      {nome.charAt(0)}
    </span>
  )
}

/** À direita: o que a conexão rende, com o que já funciona separado do que vem. */
function OQueRende() {
  return (
    <aside className="app-card p-5 lg:sticky lg:top-6">
      <h2 className="text-[14.5px] font-bold">O que a conexão rende</h2>
      <ul className="mt-4 flex flex-col gap-4">
        <Rende
          icone={<IconeConversa />}
          titulo="O bot responde com o produto certo"
          texto="Na hora da conversa ele busca na loja: diz se tem, quanto custa, quanto há em estoque e manda o link."
        />
        <Rende
          icone={<IconeCarrinho />}
          titulo="Carrinho abandonado vira mensagem"
          texto="Quem largou a compra no meio recebe um lembrete no WhatsApp, com o que deixou no carrinho."
          breve
        />
        <Rende
          icone={<IconeTrofeu />}
          titulo="Pedido pago vira negócio ganho"
          texto="A compra fecha o negócio sozinha no CRM, com o valor do pedido, sem ninguém marcar à mão."
          breve
        />
      </ul>
    </aside>
  )
}

function Rende({ icone, titulo, texto, breve }: { icone: ReactNode; titulo: string; texto: string; breve?: boolean }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary-weak text-primary">{icone}</span>
      <div className="min-w-0">
        {breve && <p className="mb-0.5 text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase">Em breve</p>}
        <p className="text-[13px] leading-5 font-bold">{titulo}</p>
        <p className="mt-0.5 text-[12px] leading-5 text-muted">{texto}</p>
      </div>
    </li>
  )
}

const TRACO = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function IconeConversa() {
  return (
    <svg {...TRACO}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  )
}

function IconeCarrinho() {
  return (
    <svg {...TRACO}>
      <path d="M3 4h2l2.4 11h10.2L20 8H6.2" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="16.5" cy="19.5" r="1.3" />
    </svg>
  )
}

function IconeTrofeu() {
  return (
    <svg {...TRACO}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6" />
    </svg>
  )
}
