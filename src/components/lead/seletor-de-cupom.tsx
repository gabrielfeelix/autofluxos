'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dica } from '@/components/design/dica'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { IconeCupom } from '@/components/lead/icones-da-barra'
import {
  acaoEnviarCupomDoInbox,
  acaoListarCuponsDoInbox,
  type CupomNaTela,
} from '@/server/acoes-cupons-do-inbox'

/**
 * O botão de cupom da caixa de resposta: os cupons ativos da loja, uma busca,
 * e um clique manda. A mensagem é curta ("Cupom 10% off para o site:
 * *BEMVINDO10*") e aparece embaixo de cada cupom antes do clique.
 *
 * A lista vem da loja a cada abertura: cupom vence e esgota, e uma lista
 * guardada mandaria código morto.
 */
export function SeletorDeCupom({
  clienteId,
  contatoId,
  desabilitado = false,
}: {
  clienteId: string
  contatoId: string
  desabilitado?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [cupons, setCupons] = useState<CupomNaTela[] | null>(null)
  const [termo, setTermo] = useState('')
  const [enviando, setEnviando] = useState<string | null>(null)
  const [enviado, setEnviado] = useState<string | null>(null)
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

  async function abrir() {
    if (aberto) {
      setAberto(false)
      return
    }
    setAberto(true)
    setErro(null)
    setEnviado(null)
    setCupons(null)
    try {
      const r = await acaoListarCuponsDoInbox(clienteId)
      if (r.ok) setCupons(r.cupons)
      else setErro(r.erro)
    } catch {
      setErro('não deu para buscar os cupons agora, tente de novo')
    }
  }

  async function enviar(codigo: string) {
    if (enviando) return
    setEnviando(codigo)
    setErro(null)
    try {
      const r = await acaoEnviarCupomDoInbox(clienteId, contatoId, codigo)
      if (r.ok) {
        setEnviado(codigo)
        setTimeout(() => setAberto(false), 900)
      } else setErro(r.erro ?? 'não deu para enviar')
    } catch {
      setErro('não deu para enviar agora, tente de novo')
    } finally {
      setEnviando(null)
    }
  }

  const visiveis = useMemo(() => {
    if (!cupons) return []
    const t = termo.trim().toLocaleLowerCase('pt-BR')
    if (!t) return cupons
    return cupons.filter((c) =>
      [c.codigo, c.nome, c.desconto, c.descricao].some((campo) => campo.toLocaleLowerCase('pt-BR').includes(t)),
    )
  }, [cupons, termo])

  return (
    <div className="relative shrink-0" ref={caixa}>
      <Dica texto="Cupom" lado="cima">
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => void abrir()}
          aria-label="Mandar um cupom da loja"
          aria-expanded={aberto}
          className={BOTAO_DA_BARRA}
        >
          <IconeCupom />
        </button>
      </Dica>

      {aberto && (
        <div
          role="dialog"
          aria-label="Cupons da loja"
          className="absolute bottom-full left-0 z-30 mb-2 w-[360px] max-w-[88vw] rounded-[12px] border border-line bg-panel p-2 shadow-[0_10px_30px_rgba(19,25,34,0.11)]"
        >
          <input
            type="search"
            value={termo}
            autoFocus
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(evento) => {
              // Dentro do formulário da resposta: Enter aqui nunca envia a mensagem.
              if (evento.key === 'Enter') {
                evento.preventDefault()
                evento.stopPropagation()
              }
            }}
            placeholder="Exemplo: BEMVINDO"
            className="mb-2 w-full rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-dim focus:border-primary/40"
          />

          {erro && <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-perigo">{erro}</p>}

          {cupons === null && !erro && <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-dim">Buscando na loja…</p>}

          {cupons !== null && visiveis.length === 0 && !erro && (
            <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-dim">
              {cupons.length === 0 ? 'Nenhum cupom ativo na loja agora.' : 'Nenhum cupom com esse nome.'}
            </p>
          )}

          {visiveis.length > 0 && (
            <ul className="max-h-[min(320px,50vh)] space-y-1 overflow-y-auto">
              {visiveis.map((cupom) => (
                <li key={cupom.codigo}>
                  <button
                    type="button"
                    onClick={() => void enviar(cupom.codigo)}
                    disabled={enviando !== null || enviado !== null}
                    className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-left transition hover:border-primary/40 disabled:opacity-60"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <strong className="font-mono text-[13px] tracking-wide text-ink">{cupom.codigo}</strong>
                      <span className="shrink-0 text-[11.5px] font-semibold text-primary">
                        {enviado === cupom.codigo ? 'Enviado ✓' : enviando === cupom.codigo ? 'Enviando…' : 'Enviar'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-5 text-soft">{cupom.desconto}</span>
                    {cupom.validoAte && (
                      <span className="block text-[11.5px] leading-4 text-dim">
                        até {cupom.validoAte.split('-').reverse().join('/')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
