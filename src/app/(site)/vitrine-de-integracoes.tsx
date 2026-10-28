'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { GLIFO_INSTAGRAM, GLIFO_META, GLIFO_TELEGRAM, GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import v from './vitrine-de-integracoes.module.css'

/*
 * A vitrine de integrações (pedido do Gabriel, 28/out/2026, a partir da página
 * inicial da Colmeia, que mostra tudo com que conversa). Só logo oficial, e só
 * o que existe: o que ainda não tem conector aparece com "Em breve", como na
 * tela de Lojas da conta (`components/loja/conectar-loja.tsx`).
 *
 * Fontes: lojas em `conectar-loja.tsx`; pagamentos em
 * `ajustes/pagamentos/page.tsx`; cardápios no texto de `conectar-loja.tsx`;
 * Lead Ads e Click-to-WhatsApp em `docs/FUNCIONALIDADES.md` §13.
 */

type Grupo = 'lojas' | 'pagamentos' | 'cardapios' | 'canais'
type Item = { nome: string; grupo: Grupo; detalhe: string; marca: ReactNode; emBreve?: boolean }

const GRUPOS: { chave: Grupo | 'todas'; rotulo: string }[] = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'canais', rotulo: 'Canais e anúncios' },
  { chave: 'lojas', rotulo: 'Lojas virtuais' },
  { chave: 'pagamentos', rotulo: 'Pagamentos' },
  { chave: 'cardapios', rotulo: 'Cardápios' },
]

const img = (src: string) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt="" width={30} height={30} />
)
const glifo = (d: string, cor: string) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill={cor} aria-hidden>
    <path d={d} />
  </svg>
)

const ITENS: Item[] = [
  { nome: 'WhatsApp', grupo: 'canais', detalhe: 'API oficial, no seu número', marca: glifo(GLIFO_WHATSAPP, '#25d366') },
  { nome: 'Instagram', grupo: 'canais', detalhe: 'Direct e menções', marca: glifo(GLIFO_INSTAGRAM, '#e4405f') },
  { nome: 'Telegram', grupo: 'canais', detalhe: 'Bot da sua empresa', marca: glifo(GLIFO_TELEGRAM, '#26a5e4') },
  { nome: 'Anúncios da Meta', grupo: 'canais', detalhe: 'Lead Ads e origem da venda', marca: glifo(GLIFO_META, '#0866ff') },
  { nome: 'Chat do site', grupo: 'canais', detalhe: 'Uma linha de código', marca: <IconeSite /> },
  { nome: 'API e webhooks', grupo: 'canais', detalhe: 'Para o seu sistema', marca: <IconeApi /> },

  { nome: 'Magento', grupo: 'lojas', detalhe: 'Estoque, frete e pedido', marca: img('/marcas-de-loja/magento.svg') },
  { nome: 'Nuvemshop', grupo: 'lojas', detalhe: 'Produtos e estoque', marca: img('/marcas-de-loja/nuvemshop.png') },
  { nome: 'Shopify', grupo: 'lojas', detalhe: 'Produtos e pedidos', marca: img('/marcas-de-loja/shopify.png'), emBreve: true },
  { nome: 'VTEX', grupo: 'lojas', detalhe: 'Produtos e pedidos', marca: img('/marcas-de-loja/vtex.png'), emBreve: true },
  { nome: 'WooCommerce', grupo: 'lojas', detalhe: 'Produtos e pedidos', marca: img('/marcas-de-loja/woocommerce.png'), emBreve: true },
  { nome: 'Tray', grupo: 'lojas', detalhe: 'Produtos e pedidos', marca: img('/marcas-de-loja/tray.png'), emBreve: true },
  { nome: 'Loja Integrada', grupo: 'lojas', detalhe: 'Produtos e pedidos', marca: img('/marcas-de-loja/loja_integrada.svg'), emBreve: true },

  { nome: 'Mercado Pago', grupo: 'pagamentos', detalhe: 'Pix, cartão e boleto', marca: img('/logos/marcas/mercadopago.svg') },
  { nome: 'Asaas', grupo: 'pagamentos', detalhe: 'Pix, cartão e boleto', marca: img('/logos/marcas/asaas.png') },
  { nome: 'InfinitePay', grupo: 'pagamentos', detalhe: 'Pix e cartão', marca: img('/logos/marcas/infinitepay.svg') },
  { nome: 'PagBank', grupo: 'pagamentos', detalhe: 'Pix e cartão', marca: img('/logos/marcas/pagbank.png') },
  { nome: 'Efí', grupo: 'pagamentos', detalhe: 'Pix e boleto', marca: img('/logos/marcas/efi.svg') },
  { nome: 'iugu', grupo: 'pagamentos', detalhe: 'Pix, cartão e boleto', marca: img('/logos/marcas/iugu.svg') },
  { nome: 'Pagar.me', grupo: 'pagamentos', detalhe: 'Pix e cartão', marca: img('/logos/marcas/pagarme.png') },
  { nome: 'PagHiper', grupo: 'pagamentos', detalhe: 'Pix e boleto', marca: img('/logos/marcas/paghiper.png') },
  { nome: 'Woovi', grupo: 'pagamentos', detalhe: 'Pix', marca: img('/logos/marcas/woovi.png') },

  { nome: 'Cardápio Web', grupo: 'cardapios', detalhe: 'Pedido entra no quadro', marca: img('/marcas-de-cardapio/cardapio_web.png') },
  { nome: 'Goomer', grupo: 'cardapios', detalhe: 'Pedido entra no quadro', marca: img('/marcas-de-cardapio/goomer.png') },
  { nome: 'OlaClick', grupo: 'cardapios', detalhe: 'Pedido entra no quadro', marca: img('/marcas-de-cardapio/olaclick.svg') },
]

const PRONTAS = ITENS.filter((i) => !i.emBreve).length

export function VitrineDeIntegracoes() {
  const [grupo, setGrupo] = useState<Grupo | 'todas'>('todas')
  // O que já liga vem antes; "Em breve" fecha a lista.
  const visiveis = ITENS.filter((i) => grupo === 'todas' || i.grupo === grupo).sort((a, b) => Number(!!a.emBreve) - Number(!!b.emBreve))

  return (
    <div className={v.vitrine}>
      <div className={v.topo}>
        <div className={v.abas} role="tablist" aria-label="Tipo de integração">
          {GRUPOS.map((g) => (
            <button
              key={g.chave}
              type="button"
              role="tab"
              aria-selected={grupo === g.chave}
              aria-controls="grade-de-integracoes"
              className={v.aba}
              onClick={() => setGrupo(g.chave)}
            >
              {g.rotulo}
            </button>
          ))}
        </div>
        <p className={v.conta}>
          <b>{PRONTAS}</b> prontas para ligar hoje
        </p>
      </div>

      <ul id="grade-de-integracoes" role="tabpanel" className={v.grade} key={grupo}>
        {visiveis.map((item, i) => (
          <li key={item.nome} className={v.item} style={{ '--i': i } as CSSProperties} data-em-breve={item.emBreve ? '' : undefined}>
            <span className={v.marca}>{item.marca}</span>
            <span className={v.texto}>
              <strong>{item.nome}</strong>
              {item.emBreve ? <small className={v.selo}>Em breve</small> : <small>{item.detalhe}</small>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function IconeSite() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3.5" width="19" height="14" rx="2.5" />
      <path d="M2.5 7.5h19M8 21h8" />
    </svg>
  )
}

function IconeApi() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0c1838" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" />
    </svg>
  )
}
