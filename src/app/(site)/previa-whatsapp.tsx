import type { CSSProperties } from 'react'
import w from './previa-whatsapp.module.css'

/*
 * A conversa de cada segmento como aparece no WhatsApp do cliente, no painel
 * Segmentos do menu (pedido do Gabriel, 28/out/2026: "com foto dos produtos,
 * como ficam as opções, tudo completinho"). Cada uma mostra a peça que mais
 * representa o segmento: cartão de produto, horários em botão, foto da aula,
 * cardápio com Pix, áudio transcrito, rastreio.
 *
 * Os negócios e nomes são inventados. As fotos são do Unsplash (uso comercial
 * livre), em `public/fotos-do-site/`.
 */

type Mensagem =
  | { de: 'cliente'; texto: string }
  | { de: 'audio'; duracao: string; transcricao: string }
  | { de: 'bot'; texto?: string; foto?: string; produto?: { nome: string; preco: string; detalhe: string }; botoes?: string[] }
  | { de: 'cardapio'; texto: string; itens: { foto: string; nome: string; preco: string }[] }
  | { de: 'pix'; itens: [string, string][]; total: string }
  | { de: 'rastreio'; pedido: string; etapas: string[]; feitas: number; previsao: string }

export type Conversa = { negocio: string; cor: string; mensagens: Mensagem[] }

export const CONVERSAS: Conversa[] = [
  {
    negocio: 'Ponto Som',
    cor: '#1f6feb',
    mensagens: [
      { de: 'cliente', texto: 'Tem esse fone na cor preta?' },
      {
        de: 'bot',
        foto: '/fotos-do-site/fone.webp',
        produto: { nome: 'Fone Over-ear Bluetooth', preco: 'R$ 249,90', detalhe: 'Preto · 7 em estoque' },
      },
      {
        de: 'bot',
        texto: 'Para o seu CEP o frete fica R$ 18,90, com entrega na quinta.',
        botoes: ['Comprar agora', 'Ver outras cores'],
      },
    ],
  },
  {
    negocio: 'Clínica Bem Viver',
    cor: '#0f9d76',
    mensagens: [
      { de: 'cliente', texto: 'Consigo consulta amanhã cedo?' },
      { de: 'bot', texto: 'Tenho estes horários com a Dra. Ana Lima, clínica geral:', botoes: ['8h30', '9h15', '10h00'] },
      { de: 'cliente', texto: '9h15' },
      { de: 'bot', texto: 'Confirmado para amanhã às 9h15. Envio um lembrete duas horas antes.' },
    ],
  },
  {
    negocio: 'Studio Movimento',
    cor: '#c2410c',
    mensagens: [
      { de: 'cliente', texto: 'Vocês têm aula experimental?' },
      {
        de: 'bot',
        foto: '/fotos-do-site/aula.webp',
        texto: 'Temos. A primeira aula de pilates é por nossa conta. Qual horário fica melhor?',
        botoes: ['Terça, 19h', 'Quinta, 7h'],
      },
      { de: 'cliente', texto: 'Terça, 19h' },
      { de: 'bot', texto: 'Reservado. Venha com roupa confortável e chegue 10 minutos antes.' },
    ],
  },
  {
    negocio: 'Forno da Vila',
    cor: '#b91c1c',
    mensagens: [
      { de: 'cliente', texto: 'Ainda dá para pedir?' },
      {
        de: 'cardapio',
        texto: 'Dá sim, a cozinha fecha às 23h. Os mais pedidos de hoje:',
        itens: [
          { foto: '/fotos-do-site/pizza.webp', nome: 'Pizza margherita', preco: 'R$ 54,00' },
          { foto: '/fotos-do-site/hamburguer.webp', nome: 'Burger da casa', preco: 'R$ 38,00' },
        ],
      },
      { de: 'cliente', texto: 'Uma margherita para entrega' },
      { de: 'pix', itens: [['Pizza margherita', 'R$ 54,00'], ['Entrega', 'R$ 6,00']], total: 'R$ 60,00' },
    ],
  },
  {
    negocio: 'Clima Instalações',
    cor: '#0e7490',
    mensagens: [
      { de: 'audio', duracao: '0:38', transcricao: 'Quanto fica para instalar um ar de 12 mil BTUs no quarto?' },
      {
        de: 'bot',
        texto: 'Para 12.000 BTUs a instalação fica a partir de R$ 180, com até 3 metros de tubulação.',
        botoes: ['Marcar visita', 'Falar com técnico'],
      },
    ],
  },
  {
    negocio: 'Casa Bela Decor',
    cor: '#7c3aed',
    mensagens: [
      { de: 'cliente', texto: 'Meu pedido já saiu?' },
      {
        de: 'rastreio',
        pedido: '#4821',
        etapas: ['Pago', 'Separado', 'Enviado', 'Entregue'],
        feitas: 3,
        previsao: 'Chega na quinta, até as 18h.',
      },
      { de: 'bot', texto: 'Quer receber um aviso quando sair para entrega?', botoes: ['Sim, me avise'] },
    ],
  },
]

const HORAS = ['10:41', '10:41', '10:42', '10:42']

export function PreviaWhatsApp({ conversa }: { conversa: Conversa }) {
  return (
    <div className={w.tela}>
      <div className={w.topo}>
        <span className={w.avatar} style={{ background: conversa.cor }}>
          {conversa.negocio[0]}
        </span>
        <span>
          <strong>{conversa.negocio}</strong>
          <small>online</small>
        </span>
      </div>
      <div className={w.corpo}>
        {conversa.mensagens.map((msg, i) => (
          <div key={i} className={w.linha} style={{ '--i': i } as CSSProperties} data-lado={msg.de === 'cliente' || msg.de === 'audio' ? 'cliente' : 'negocio'}>
            <Balao msg={msg} hora={HORAS[i] ?? '10:43'} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Balao({ msg, hora }: { msg: Mensagem; hora: string }) {
  // É o celular do cliente: as mensagens dele saem em verde, com o visto azul.
  const doCliente = msg.de === 'cliente' || msg.de === 'audio'
  const rodape = (
    <span className={w.hora}>
      {hora}
      {doCliente && <Lido />}
    </span>
  )

  if (msg.de === 'cliente')
    return (
      <div className={w.balao}>
        {msg.texto}
        {rodape}
      </div>
    )

  if (msg.de === 'audio')
    return (
      <div className={w.balao}>
        <span className={w.audio}>
          <Play />
          <span className={w.onda} aria-hidden>
            {ONDA.map((h, i) => (
              <i key={i} style={{ height: h }} />
            ))}
          </span>
          <small>{msg.duracao}</small>
        </span>
        <span className={w.transcricao}>{msg.transcricao}</span>
        {rodape}
      </div>
    )

  if (msg.de === 'cardapio')
    return (
      <div className={w.balao}>
        {msg.texto}
        <span className={w.cardapio}>
          {msg.itens.map((item) => (
            <span key={item.nome}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.foto} alt="" width={160} height={107} />
              <strong>{item.nome}</strong>
              <small>{item.preco}</small>
            </span>
          ))}
        </span>
        {rodape}
      </div>
    )

  if (msg.de === 'pix')
    return (
      <div className={w.pilha}>
        <div className={w.balao}>
          <strong className={w.tituloPix}>Resumo do pedido</strong>
          <span className={w.contas}>
            {msg.itens.map(([nome, valor]) => (
              <span key={nome}>
                {nome}
                <b>{valor}</b>
              </span>
            ))}
            <span className={w.total}>
              Total
              <b>{msg.total}</b>
            </span>
          </span>
          {rodape}
        </div>
        <span className={w.botao}>
          <Copiar /> Copiar código Pix
        </span>
      </div>
    )

  if (msg.de === 'rastreio')
    return (
      <div className={w.balao}>
        <strong className={w.tituloPix}>Pedido {msg.pedido}</strong>
        <span className={w.etapas}>
          {msg.etapas.map((etapa, i) => (
            <span key={etapa} data-feita={i < msg.feitas ? '' : undefined}>
              <i />
              {etapa}
            </span>
          ))}
        </span>
        <span>{msg.previsao}</span>
        {rodape}
      </div>
    )

  return (
    <div className={w.pilha}>
      <div className={`${w.balao} ${msg.foto ? w.comFoto : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {msg.foto && <img className={w.foto} src={msg.foto} alt="" width={320} height={214} />}
        {msg.produto && (
          <span className={w.produto}>
            <strong>{msg.produto.nome}</strong>
            <b>{msg.produto.preco}</b>
            <small>{msg.produto.detalhe}</small>
          </span>
        )}
        {msg.texto && <span className={w.texto}>{msg.texto}</span>}
        {rodape}
      </div>
      {msg.botoes?.map((b) => (
        <span key={b} className={w.botao}>
          {b}
        </span>
      ))}
    </div>
  )
}

const ONDA = ['30%', '55%', '80%', '45%', '95%', '60%', '35%', '70%', '90%', '50%', '30%', '65%', '85%', '40%', '25%', '55%', '75%', '45%', '30%', '20%']

function Lido() {
  return (
    <svg className={w.lido} width="15" height="10" viewBox="0 0 16 11" aria-hidden>
      <path d="M11.07.65 4.4 7.3 1.93 4.83.86 5.9 4.4 9.44l7.74-7.73zM14.07.65 7.4 7.3l-.6-.6-1.07 1.07 1.67 1.67 7.74-7.73z" fill="currentColor" />
    </svg>
  )
}

function Play() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
    </svg>
  )
}

function Copiar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </svg>
  )
}
