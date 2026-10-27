'use client'

import Link from 'next/link'
import { useState, useTransition, type ReactNode } from 'react'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import type { EstadoDaPlataforma, FichaDaPlataforma, PlataformaDeLoja } from '@/core/plataformas-de-loja'

export type CartaoDePlataforma = {
  ficha: FichaDaPlataforma
  estado: EstadoDaPlataforma
  /** A conta já solicitou a integração desta plataforma. */
  pedida: boolean
}

type Resposta = { ok: true } | { ok: false; motivo: string }

/**
 * A tela Comércio > Integrações (plano de navegação e CRM, 5.6).
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
    <Miolo largura="cheia">
      <CabecalhoDaTela
        titulo="Integrações"
        descricao="Ligue a sua loja on-line e o bot passa a responder com o que está nela: o produto certo, o preço, o estoque e o link para comprar. Ele só lê a loja; quem fecha a compra é o site."
      />

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

          <Grupo titulo="Cardápio e delivery">
            <article className="app-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <span aria-hidden className="flex shrink-0 -space-x-2">
                {['cardapio_web.png', 'goomer.png', 'olaclick.svg'].map((arquivo) => (
                  <span
                    key={arquivo}
                    className="flex size-10 items-center justify-center rounded-full border-2 border-panel bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/marcas-de-cardapio/${arquivo}`} alt="" className="size-full object-contain" />
                  </span>
                ))}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-bold tracking-[-0.01em]">Cardápio digital e delivery próprio</h3>
                <p className="mt-1 text-[12.5px] leading-5 text-muted">
                  Cardápio Web, Goomer, OlaClick e outros: o pedido entra no quadro de Pedidos e o cliente é avisado
                  de cada etapa no WhatsApp.
                </p>
              </div>
              <Link href={`/clientes/${clienteId}/loja/cardapios`} className="botao-md botao-secundario shrink-0">
                Ver plataformas
                <span aria-hidden>›</span>
              </Link>
            </article>
          </Grupo>

          {emBreve.length > 0 && (
            <Grupo titulo="Em breve" nota="Brasil primeiro. Solicite a integração da sua plataforma e ela ganha prioridade.">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {emBreve.map((cartao) => (
                  <Cartao key={cartao.ficha.id} cartao={cartao} queroEsta={queroEsta} />
                ))}
              </div>
            </Grupo>
          )}

          <p className="text-[12px] leading-5 text-dim">
            A sua não está na lista? Fale com o suporte. Cada solicitação conta a favor da plataforma, e a
            mais solicitada é a próxima a chegar.
          </p>
        </div>

        <OQueRende />
      </div>
    </Miolo>
  )
}

/** Estado vazio que ensina e tem botão: sem loja conectada, os produtos cadastrados já servem. */
function SemLojaAinda({ clienteId }: { clienteId: string }) {
  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-primary/20 bg-primary-weak p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="text-[14.5px] font-bold">Nenhuma loja conectada ainda</h2>
        <p className="mt-1 max-w-[560px] text-[12.5px] leading-5 text-muted">
          Escolha a sua plataforma abaixo. Se ela ainda não chegou, cadastre os produtos à mão enquanto isso: o bot
          já responde com eles.
        </p>
      </div>
      <Link
        href={`/clientes/${clienteId}/loja/catalogo`}
        className="botao-primario botao-md shrink-0 gap-1.5"
      >
        Cadastrar produtos
        <span aria-hidden>›</span>
      </Link>
    </section>
  )
}

export function Grupo({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
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
      <Marca id={ficha.id} grande />
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
          className={`botao-md ${estado === 'conectada' ? 'botao-secundario' : 'botao-primario'}`}
        >
          {estado === 'conectada' ? 'Abrir a conexão' : estado === 'configurada' ? 'Ligar de novo' : 'Conectar'}
          <span aria-hidden>›</span>
        </Link>
      </div>
    </article>
  )
}

/** A plataforma "Em breve": o próximo passo é solicitar a integração. */
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
        <Marca id={ficha.id} />
        {ficha.brasileira && (
          <Pilula>Brasil</Pilula>
        )}
      </div>
      <h3 className="text-[15px] font-bold tracking-[-0.01em]">{ficha.nome}</h3>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">{ficha.resumo}</p>

      <span className="min-h-5 flex-1" />

      <SolicitarIntegracao plataforma={ficha.id} jaPedida={cartao.pedida} solicitar={queroEsta} />
    </article>
  )
}

/**
 * "Solicitar integração": marca na hora e desfaz se o servidor recusar. Uma
 * vez por conta; depois de gravado o botão vira a confirmação e não volta a
 * aparecer. Serve à loja on-line e ao cardápio digital.
 */
export function SolicitarIntegracao<P extends string>({
  plataforma,
  jaPedida,
  solicitar,
}: {
  plataforma: P
  jaPedida: boolean
  solicitar: (plataforma: P) => Promise<Resposta>
}) {
  const [pedida, setPedida] = useState(jaPedida)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()

  function pedir() {
    setPedida(true)
    setErro(null)
    comecar(async () => {
      const r = await solicitar(plataforma)
      if (!r.ok) {
        setPedida(false)
        setErro(r.motivo)
      }
    })
  }

  if (pedida) {
    return (
      <p role="status" className="flex flex-col rounded-[10px] bg-emerald-400/[0.09] px-3 py-2 text-[12px] leading-5">
        <span className="font-bold text-ok">✓ Solicitação registrada</span>
        <span className="text-muted">Ela conta a favor desta plataforma na fila das próximas integrações.</span>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={pedir}
        className="botao-secundario botao-md self-start"
      >
        Solicitar integração
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
  const [texto, tom] = (
    {
      conectada: ['Conectada', 'ok'],
      configurada: ['Desligada', 'aviso'],
      disponivel: ['Disponível', 'destaque'],
      em_breve: ['Em breve', 'neutro'],
    } as const
  )[estado]
  return <Pilula tom={tom}>{texto}</Pilula>
}

/**
 * O símbolo oficial de cada plataforma, servido de `public/marcas-de-loja/`.
 *
 * Baixado uma vez do site de cada uma (ou do SVG oficial), e **servido
 * daqui**, pela regra de `logos-de-marca.tsx`: uma tela que busca imagem no
 * servidor de outra empresa quebra quando ele cai e conta para fora quem
 * abriu a página. O uso é nominativo: identificar a integração.
 */
const ARQUIVO_DA_MARCA: Record<PlataformaDeLoja, string> = {
  nuvemshop: 'nuvemshop.png',
  tray: 'tray.png',
  loja_integrada: 'loja_integrada.svg',
  vtex: 'vtex.png',
  woocommerce: 'woocommerce.png',
  shopify: 'shopify.png',
  magento: 'magento.svg',
}

export function Marca({ id, grande = false }: { id: PlataformaDeLoja; grande?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-[12px] border border-line bg-white ${grande ? 'size-12 p-2' : 'size-10 p-1.5'}`}
    >
      {/* Arquivo estático nosso, de tamanho fixo: `next/image` não acrescenta nada. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/marcas-de-loja/${ARQUIVO_DA_MARCA[id]}`} alt="" className="size-full object-contain" />
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

export function Rende({ icone, titulo, texto, breve }: { icone: ReactNode; titulo: string; texto: string; breve?: boolean }) {
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
