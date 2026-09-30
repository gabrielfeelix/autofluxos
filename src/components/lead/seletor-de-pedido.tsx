'use client'

import { useEffect, useRef, useState } from 'react'
import { Dica } from '@/components/design/dica'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { IconeLocalizacao } from '@/components/lead/icones-da-barra'
import {
  acaoBuscarPedidoDoInbox,
  acaoEnviarPedidoDoInbox,
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

  async function buscar() {
    if (numero.trim() === '' || buscando) return
    setBuscando(true)
    setErro(null)
    setAchado(null)
    try {
      const r = await acaoBuscarPedidoDoInbox(clienteId, contatoId, numero)
      if (r.ok) setAchado(r)
      else setErro(r.erro)
    } catch {
      setErro('não deu para buscar agora, tente de novo')
    } finally {
      setBuscando(false)
    }
  }

  async function enviar() {
    if (!achado || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await acaoEnviarPedidoDoInbox(clienteId, contatoId, achado.pedido.numero)
      if (r.ok) {
        setAberto(false)
        setNumero('')
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
          onClick={() => setAberto((a) => !a)}
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
                setAchado(null)
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
              disabled={buscando || numero.trim() === ''}
              className="shrink-0 rounded-[9px] border border-line px-2.5 text-[12px] font-semibold text-soft transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
          </form>

          {erro && <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-perigo">{erro}</p>}

          {!achado && !erro && !buscando && (
            <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-dim">
              Busca na loja e na transportadora. Você confere antes de mandar.
            </p>
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
                  Ver meus pedidos
                </p>
              </div>
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={enviando}
                className="mt-2 w-full rounded-[9px] bg-primary px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
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

/** A prévia sem os asteriscos do WhatsApp: aqui o negrito seria ruído. */
function semMarcacao(texto: string): string {
  return texto.replace(/\*([^*\n]+)\*/g, '$1')
}
