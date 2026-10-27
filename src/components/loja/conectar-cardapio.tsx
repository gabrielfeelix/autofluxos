'use client'

import Link from 'next/link'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { FICHAS_DE_CARDAPIO, PLATAFORMAS_DE_CARDAPIO, type PlataformaDeCardapio } from '@/core/plataformas-de-cardapio'
import { Grupo, Rende, SolicitarIntegracao } from './conectar-loja'

type Resposta = { ok: true } | { ok: false; motivo: string }

/**
 * Comércio > Integrações > Cardápio e delivery (docs/PLANO-INTEGRACOES-CARDAPIO.md).
 *
 * Em cima, o que conecta hoje (e o link do entregador, que não depende de
 * plataforma); embaixo, cada cardápio ainda sem conector, com "Solicitar
 * integração". Os dois em cartões iguais, com o logo oficial
 * (`public/marcas-de-cardapio/`). Quando um conector fica pronto, a ficha
 * ganha `href` e o cartão sobe para "Disponível agora".
 */
export function ConectarCardapio({
  clienteId,
  solicitadas,
  conectadas,
  solicitar,
}: {
  clienteId: string
  solicitadas: PlataformaDeCardapio[]
  conectadas: PlataformaDeCardapio[]
  solicitar: (plataforma: PlataformaDeCardapio) => Promise<Resposta>
}) {
  const disponiveis = PLATAFORMAS_DE_CARDAPIO.filter((id) => FICHAS_DE_CARDAPIO[id].href)
  const emBreve = PLATAFORMAS_DE_CARDAPIO.filter((id) => !FICHAS_DE_CARDAPIO[id].href)

  return (
    <Miolo largura="cheia">
      <CabecalhoDaTela
        trilha={[{ rotulo: 'Integrações', href: `/clientes/${clienteId}/loja` }, { rotulo: 'Cardápio e delivery' }]}
        titulo="Cardápio e delivery"
        descricao="Conecte o cardápio digital ou o sistema de delivery e cada pedido entra no quadro de Pedidos. O cliente recebe no WhatsApp cada etapa: em preparo, saiu para entrega, pronto para retirada."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Grupo titulo="Disponível agora">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {disponiveis.map((id) => {
                const ficha = FICHAS_DE_CARDAPIO[id]
                const conectada = conectadas.includes(id)
                return (
                  <Cartao
                    key={id}
                    marca={<Marca arquivo={ficha.arquivoDaMarca} />}
                    selo={<Pilula tom={conectada ? 'ok' : 'destaque'}>{conectada ? 'Conectado' : 'Disponível'}</Pilula>}
                    nome={ficha.nome}
                    resumo={ficha.resumo}
                  >
                    <Link
                      href={`/clientes/${clienteId}${ficha.href}`}
                      className={`botao-md self-start ${conectada ? 'botao-secundario' : 'botao-primario'}`}
                    >
                      {conectada ? 'Abrir a conexão' : 'Conectar'}
                      <span aria-hidden>›</span>
                    </Link>
                  </Cartao>
                )
              })}
              <Cartao
                marca={
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-[12px] bg-primary-weak text-primary">
                    <IconeEntregador />
                  </span>
                }
                selo={<Pilula tom="ok">Incluído</Pilula>}
                nome="Link do entregador"
                resumo="Para motoboy próprio: o entregador toca em Saí para entregar e em Entreguei, sem login, e o cliente é avisado na hora."
              >
                <Link href={`/clientes/${clienteId}/loja/pedidos`} className="botao-md botao-secundario self-start">
                  Abrir Pedidos
                  <span aria-hidden>›</span>
                </Link>
              </Cartao>
            </div>
          </Grupo>

          <Grupo titulo="Em breve" nota="Solicite a integração da sua plataforma e ela ganha prioridade.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {emBreve.map((id) => {
                const ficha = FICHAS_DE_CARDAPIO[id]
                return (
                  <Cartao key={id} marca={<Marca arquivo={ficha.arquivoDaMarca} />} nome={ficha.nome} resumo={ficha.resumo}>
                    <SolicitarIntegracao plataforma={id} jaPedida={solicitadas.includes(id)} solicitar={solicitar} />
                  </Cartao>
                )
              })}
            </div>
          </Grupo>

          <p className="text-[12px] leading-5 text-dim">
            O seu sistema não está na lista? Fale com o suporte. iFood, 99Food e outros marketplaces ficam de fora: lá o
            cliente acompanha o pedido pelo próprio aplicativo.
          </p>
        </div>

        <aside className="app-card p-5 lg:sticky lg:top-6">
          <h2 className="text-[14.5px] font-bold">O que a conexão traz</h2>
          <ul className="mt-4 flex flex-col gap-4">
            <Rende
              icone={<IconeEntregador />}
              titulo="Cliente avisado de cada etapa"
              texto="Em preparo, saiu para entrega e cancelado chegam no WhatsApp, mesmo para quem nunca abriu conversa."
            />
            <Rende
              icone={<IconeQuadro />}
              titulo="Todos os pedidos num quadro só"
              texto="Os pedidos do cardápio entram ao lado dos pedidos da conversa, com o número da plataforma."
              breve
            />
            <Rende
              icone={<IconeCatalogo />}
              titulo="Catálogo importado sozinho"
              texto="Fotos, descrições e preços vêm da plataforma, e o bot de vendas responde com eles."
              breve
            />
          </ul>
        </aside>
      </div>
    </Miolo>
  )
}

/** O cartão de cada plataforma, igual em "Disponível agora" e "Em breve": muda só o selo e a ação. */
function Cartao({
  marca,
  selo,
  nome,
  resumo,
  children,
}: {
  marca: React.ReactNode
  selo?: React.ReactNode
  nome: string
  resumo: string
  children: React.ReactNode
}) {
  return (
    <article className="app-card flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        {marca}
        {selo}
      </div>
      <h3 className="text-[15px] font-bold tracking-[-0.01em]">{nome}</h3>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">{resumo}</p>
      <span className="min-h-5 flex-1" />
      {children}
    </article>
  )
}

function Marca({ arquivo }: { arquivo: string }) {
  return (
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white p-1.5">
      {/* Arquivo estático nosso, de tamanho fixo: `next/image` não acrescenta nada. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/marcas-de-cardapio/${arquivo}`} alt="" className="size-full object-contain" />
    </span>
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

function IconeEntregador() {
  return (
    <svg {...TRACO}>
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="18" cy="17" r="2.5" />
      <path d="M8.5 17h7M14 6h2.5l2 5.5M4 11h7l2.5 6M16 11.5l-2.5 5.5" />
    </svg>
  )
}

function IconeQuadro() {
  return (
    <svg {...TRACO}>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M9.5 4v16M15 4v16" />
    </svg>
  )
}

function IconeCatalogo() {
  return (
    <svg {...TRACO}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13z" />
    </svg>
  )
}
