'use client'

import { useEffect, useRef, useState } from 'react'
import { Dica } from '@/components/design/dica'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { IconeLocalizacao } from '@/components/lead/icones-da-barra'
import {
  acaoBuscarPedidoDoInbox,
  acaoEnviarPedidoDoInbox,
  acaoListarPedidosDoContato,
  type PedidosDoContato,
  type RespostaDoPedido,
} from '@/server/acoes-pedido-do-inbox'

/**
 * O botão de status do pedido da caixa de resposta: número do pedido, busca na
 * loja, confere e manda. A mensagem que sai é a prévia que aparece aqui, com o
 * botão "Ver meus pedidos" embaixo, como o bot faria.
 *
 * Diferente do seletor de produto, **mandar pede um segundo clique**: status de
 * pedido é dado de uma pessoa, e o número digitado errado mandaria o pedido de
 * outro cliente. A prévia mostra de quem é o pedido e se o telefone confere
 * com o desta conversa antes de sair.
 */
export function SeletorDePedido({
  clienteId,
  contatoId,
  desabilitado = false,
}: {
  clienteId: string
  contatoId: string
  desabilitado?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [numero, setNumero] = useState('')
  const [achado, setAchado] = useState<Extract<RespostaDoPedido, { ok: true }> | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  /*
    Os pedidos de quem está na conversa, lidos uma vez quando o painel abre
    (pelo CPF ou e-mail da ficha, ver `acaoListarPedidosDoContato`). `null` é
    "ainda lendo".
  */
  const [doContato, setDoContato] = useState<PedidosDoContato | null>(null)
  const lido = useRef(false)

  useEffect(() => {
    if (!aberto) return
    function foraDaqui(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    function noEsc(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', foraDaqui)
    document.addEventListener('keydown', noEsc)
    return () => {
      document.removeEventListener('mousedown', foraDaqui)
      document.removeEventListener('keydown', noEsc)
    }
  }, [aberto])

  /*
   * Busca sozinha enquanto digita (02/out/2026: "pq eu tenho que digitar
   * tudo?"). A partir de 3 dígitos, meio segundo depois da última tecla; Enter
   * e o botão continuam buscando na hora. `ultima` descarta a resposta de uma
   * busca que já foi trocada por outra, para "197" não pintar por cima de
   * "1976".
   */
  const ultima = useRef('')
  async function buscar(consulta = numero) {
    const limpo = consulta.replace(/^#/, '').trim()
    if (limpo === '') return
    ultima.current = limpo
    setBuscando(true)
    setErro(null)
    setAchado(null)
    try {
      const r = await acaoBuscarPedidoDoInbox(clienteId, contatoId, limpo)
      if (ultima.current !== limpo) return
      if (r.ok) setAchado(r)
      else setErro(r.erro)
    } catch {
      if (ultima.current === limpo) setErro('não deu para buscar agora, tente de novo')
    } finally {
      if (ultima.current === limpo) setBuscando(false)
    }
  }

  useEffect(() => {
    const limpo = numero.replace(/^#/, '').trim()
    if (!/^\d{3,20}$/.test(limpo) || limpo === ultima.current) return
    const espera = setTimeout(() => void buscar(limpo), 500)
    return () => clearTimeout(espera)
    // `buscar` muda a cada render; quem dispara é o número.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numero])

  async function enviar() {
    if (!achado || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await acaoEnviarPedidoDoInbox(clienteId, contatoId, achado.pedido.numero)
      if (r.ok) {
        setAberto(false)
        setNumero('')
        ultima.current = ''
        setAchado(null)
      } else setErro(r.erro ?? 'não deu para enviar')
    } catch {
      setErro('não deu para enviar agora, tente de novo')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative shrink-0" ref={caixa}>
      <Dica texto="Status do pedido" lado="cima">
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => {
            setAberto((a) => !a)
            if (lido.current) return
            lido.current = true
            acaoListarPedidosDoContato(clienteId, contatoId)
              .then(setDoContato)
              .catch(() => setDoContato({ ok: false, erro: 'não deu para ler os pedidos agora' }))
          }}
          aria-label="Mandar o status de um pedido"
          aria-expanded={aberto}
          className={BOTAO_DA_BARRA}
        >
          <IconeLocalizacao />
        </button>
      </Dica>

      {aberto && (
        <div
          role="dialog"
          aria-label="Status do pedido"
          className="absolute bottom-full left-0 z-30 mb-2 w-[360px] max-w-[88vw] rounded-[12px] border border-line bg-panel p-2 shadow-[0_10px_30px_rgba(19,25,34,0.11)]"
        >
          <form
            className="mb-2 flex gap-1.5"
            onSubmit={(evento) => {
              // Este formulário vive dentro do da resposta: Enter aqui busca,
              // nunca envia a mensagem que está sendo escrita.
              evento.preventDefault()
              evento.stopPropagation()
              void buscar()
            }}
          >
            <input
              type="search"
              inputMode="numeric"
              value={numero}
              autoFocus
              onChange={(e) => {
                setNumero(e.target.value)
                // Voltar ao número que já está na tela não apaga o resultado: a
                // busca automática não roda de novo para o mesmo número, e a
                // caixa ficaria vazia sem motivo.
                if (e.target.value.replace(/^#/, '').trim() !== ultima.current) setAchado(null)
              }}
              onKeyDown={(evento) => {
                if (evento.key !== 'Enter') return
                evento.preventDefault()
                evento.stopPropagation()
                void buscar()
              }}
              placeholder="Número do pedido. Exemplo: 1955"
              className="min-w-0 flex-1 rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-dim focus:border-primary/40"
            />
            <button
              type="button"
              onClick={() => void buscar()}
              disabled={numero.trim() === ''}
              className="shrink-0 rounded-[9px] border border-line px-2.5 text-[12px] font-semibold text-soft transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
          </form>

          {erro && <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-perigo">{erro}</p>}

          {!achado && !erro && !buscando && (
            <PedidosDoContatoNaLista
              resposta={doContato}
              aoEscolher={(numeroDoPedido) => {
                setNumero(numeroDoPedido)
                void buscar(numeroDoPedido)
              }}
            />
          )}

          {achado && (
            <div className="px-0.5">
              <p
                className={`mb-2 rounded-[8px] px-2 py-1.5 text-[11.5px] leading-4 ${
                  achado.confere ? 'bg-ok/10 text-ok' : 'bg-aviso/10 text-aviso'
                }`}
              >
                {achado.confere
                  ? `Pedido de ${achado.pedido.comprador || 'quem está nesta conversa'}: o telefone confere.`
                  : `Pedido de ${achado.pedido.comprador || 'outra pessoa'}, com outro telefone. Confira antes de mandar.`}
              </p>
              <div className="max-h-[min(300px,45vh)] overflow-y-auto rounded-[10px] border border-line bg-surface px-3 py-2.5">
                <p className="whitespace-pre-wrap text-[12.5px] leading-5 text-ink">{semMarcacao(achado.previa)}</p>
                <p className="mt-2 border-t border-line pt-1.5 text-center text-[12px] font-semibold text-primary">
                  {achado.rastreio ? 'Rastrear entrega' : 'Ver meus pedidos'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={enviando}
                className="botao-primario botao-md mt-2 w-full"
              >
                {enviando ? 'Enviando…' : 'Enviar status na conversa'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A lista de pedidos de quem está na conversa, embaixo do campo. Escolher um
 * busca o status completo, como se o número tivesse sido digitado.
 */
function PedidosDoContatoNaLista({
  resposta,
  aoEscolher,
}: {
  resposta: PedidosDoContato | null
  aoEscolher: (numero: string) => void
}) {
  const dica = 'Busca na loja e na transportadora. Você confere antes de mandar.'
  if (resposta === null) return <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-dim">Procurando os pedidos desta pessoa…</p>
  if (!resposta.ok) return <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-dim">{dica}</p>
  if (resposta.pedidos.length === 0)
    return (
      <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-dim">
        {resposta.semChave
          ? 'Sem telefone, CPF ou e-mail para achar os pedidos. Digite o número. '
          : 'Nenhum pedido com o telefone desta conversa nem com o CPF ou e-mail da ficha. Digite o número. '}
        {dica}
      </p>
    )
  return (
    <div className="pb-0.5">
      <p className="px-1.5 pb-1 text-[11px] font-bold tracking-[0.06em] text-ink uppercase">Pedidos desta pessoa</p>
      <ul className="max-h-[min(260px,40vh)] overflow-y-auto">
        {resposta.pedidos.map((pedido) => (
          <li key={pedido.numero}>
            <button
              type="button"
              onClick={() => aoEscolher(pedido.numero)}
              className={`flex w-full items-center gap-2 rounded-[8px] px-1.5 py-2 text-left transition ${
                pedido.entregue ? 'bg-ok/10 hover:bg-ok/15' : 'hover:bg-surface'
              }`}
            >
              {pedido.entregue && (
                <span
                  aria-label="Entregue"
                  className="grid size-5 shrink-0 place-items-center rounded-full bg-ok text-white"
                >
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-ink tabular-nums">#{pedido.numero}</span>
                <span className={`block truncate text-[11.5px] ${pedido.entregue ? 'font-semibold text-ok' : 'text-dim'}`}>
                  {pedido.situacao}
                  {pedido.feitoEm && ` · ${pedido.feitoEm.split('-').reverse().join('/')}`}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[12px] font-semibold text-soft tabular-nums">{pedido.total}</span>
                {!pedido.confere && <span className="block text-[10.5px] text-aviso">outro telefone</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A prévia sem os asteriscos do WhatsApp: aqui o negrito seria ruído. */
function semMarcacao(texto: string): string {
  return texto.replace(/\*([^*\n]+)\*/g, '$1')
}
