'use client'

import { useEffect, useRef, useState } from 'react'
import type { Conversa, Mensagem } from './previa-whatsapp'
import { logoDoNegocio } from './logos-de-exemplo'
import w from './previa-whatsapp.module.css'

const HORAS = ['10:41', '10:41', '10:42', '10:42']

// Uma mensagem a cada 0,9 s, como uma conversa de verdade chegando.
const TEMPO_POR_MENSAGEM = 900

/**
 * A conversa chega uma mensagem por vez, começando da primeira, e a tela desce
 * junto, como o WhatsApp aberto (pedido do Gabriel, 29/out: "sem cortar, vai
 * abaixando"). O botão que a pessoa tocou fica verde. Sem movimento, tudo de
 * uma vez, rolado até o fim.
 */
export function PreviaWhatsApp({ conversa }: { conversa: Conversa }) {
  const total = conversa.mensagens.length
  const logo = logoDoNegocio(conversa.negocio)
  const [vistas, setVistas] = useState(1)
  const corpo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = window.setTimeout(() => setVistas(total), 0)
      return () => window.clearTimeout(t)
    }
    const t = window.setInterval(() => setVistas((n) => (n >= total ? n : n + 1)), TEMPO_POR_MENSAGEM)
    return () => window.clearInterval(t)
  }, [total])

  useEffect(() => {
    const el = corpo.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: vistas === 1 ? 'auto' : 'smooth' })
  }, [vistas])

  return (
    <div className={w.tela}>
      <div className={w.topo}>
        <span className={w.avatar} style={{ background: conversa.cor }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" width={32} height={32} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            conversa.negocio[0]
          )}
        </span>
        <span>
          <strong>{conversa.negocio}</strong>
          <small>online</small>
        </span>
      </div>
      <div ref={corpo} className={w.corpo}>
        {conversa.mensagens.slice(0, vistas).map((msg, i) => {
          // O botão tocado: a mensagem seguinte é da pessoa e repete o texto dele.
          const seguinte = i + 1 < vistas ? conversa.mensagens[i + 1] : undefined
          const escolhido = seguinte?.de === 'cliente' ? seguinte.texto : undefined
          return (
            <div key={i} className={w.linha} data-lado={msg.de === 'cliente' || msg.de === 'audio' ? 'cliente' : 'negocio'}>
              <Balao msg={msg} hora={HORAS[i] ?? '10:43'} escolhido={escolhido} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Balao({ msg, hora, escolhido }: { msg: Mensagem; hora: string; escolhido?: string }) {
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
        <span key={b} className={w.botao} data-escolhido={b === escolhido || undefined}>
          {b === escolhido && <Lido />}
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
