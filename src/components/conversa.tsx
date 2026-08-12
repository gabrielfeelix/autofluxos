'use client'

import { useEffect, useRef, useState } from 'react'
import { sessaoNova, type Acao, type Entrada, type Resultado, type Sessao } from '@/core/engine/types'
import type { Fluxo, Opcao } from '@/core/flow/schema'

type Item =
  | { chave: number; de: 'bot'; texto: string; opcoes?: Opcao[]; formato?: 'botoes' | 'lista' }
  | { chave: number; de: 'pessoa'; texto: string }
  | { chave: number; de: 'sistema'; texto: string; alerta?: boolean }

type Pendentes = { chave: number; opcoes: Opcao[]; formato: 'botoes' | 'lista' }

let sequencia = 0
const novaChave = () => ++sequencia

/**
 * O chat de teste. Não imita o motor — chama o motor, pela mesma rota que o
 * webhook do WhatsApp vai chamar.
 *
 * Recebe o fluxo em memória, então dá para testar mudança que ainda nem foi
 * salva. É esse laço de segundos entre mexer e ver que faz o editor valer.
 */
export function Conversa({
  fluxo,
  aoMudarSessao,
}: {
  fluxo: Fluxo
  aoMudarSessao?: (sessao: Sessao) => void
}) {
  const [itens, setItens] = useState<Item[]>([])
  const [pendentes, setPendentes] = useState<Pendentes | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [status, setStatus] = useState<Sessao['status']>('ativa')
  const [desatualizada, setDesatualizada] = useState(false)

  const sessaoRef = useRef<Sessao>(sessaoNova())
  const fimDaLista = useRef<HTMLDivElement>(null)
  const jaComecou = useRef(false)
  const assinaturaDoInicio = useRef('')

  const assinatura = JSON.stringify(fluxo)

  async function enviar(entrada: Entrada, eco?: string) {
    setOcupado(true)
    setPendentes(null)
    if (eco !== undefined) {
      setItens((atual) => [...atual, { chave: novaChave(), de: 'pessoa', texto: eco }])
    }

    try {
      const resposta = await fetch('/api/simular', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fluxo, sessao: sessaoRef.current, entrada }),
      })

      if (!resposta.ok) {
        setItens((atual) => [
          ...atual,
          { chave: novaChave(), de: 'sistema', texto: 'o motor recusou este fluxo', alerta: true },
        ])
        return
      }

      const { acoes, sessao: nova } = (await resposta.json()) as Resultado
      sessaoRef.current = nova
      setStatus(nova.status)
      aoMudarSessao?.(nova)
      aplicar(acoes, nova)
    } finally {
      setOcupado(false)
    }
  }

  function aplicar(acoes: Acao[], nova: Sessao) {
    const novos: Item[] = []
    let ultimas: Pendentes | null = null

    for (const acao of acoes) {
      const chave = novaChave()
      switch (acao.tipo) {
        case 'enviar_texto':
          novos.push({ chave, de: 'bot', texto: acao.texto })
          break
        case 'enviar_opcoes':
          novos.push({ chave, de: 'bot', texto: acao.texto, opcoes: acao.opcoes, formato: acao.formato })
          ultimas = { chave, opcoes: acao.opcoes, formato: acao.formato }
          break
        case 'salvar_campo':
          novos.push({ chave, de: 'sistema', texto: `guardou ${acao.campo} = "${acao.valor}"` })
          break
        case 'chamar_ia':
          novos.push({ chave, de: 'sistema', texto: `chamaria a IA — "${acao.instrucao}"` })
          break
        case 'transferir_humano':
          novos.push({ chave, de: 'sistema', texto: `passou para um humano — ${acao.motivo}`, alerta: true })
          break
        case 'encerrar':
          novos.push({ chave, de: 'sistema', texto: 'conversa encerrada' })
          break
      }
    }

    setItens((atual) => [...atual, ...novos])
    if (nova.status === 'ativa' && ultimas) setPendentes(ultimas)
  }

  function recomecar() {
    sessaoRef.current = sessaoNova()
    assinaturaDoInicio.current = assinatura
    setDesatualizada(false)
    setStatus('ativa')
    setItens([])
    setPendentes(null)
    setRascunho('')
    aoMudarSessao?.(sessaoRef.current)
    void enviar({ tipo: 'inicio' })
  }

  function submeter(evento: React.FormEvent) {
    evento.preventDefault()
    const texto = rascunho.trim()
    if (texto === '' || ocupado) return
    setRascunho('')

    if (status === 'aguardando_ia') {
      void enviar({ tipo: 'ia_respondeu', texto }, `(resposta da IA) ${texto}`)
      return
    }
    void enviar({ tipo: 'texto', texto }, texto)
  }

  useEffect(() => {
    if (jaComecou.current) return
    jaComecou.current = true
    assinaturaDoInicio.current = assinatura
    void enviar({ tipo: 'inicio' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // O fluxo mudou desde que esta conversa começou. Não reinicia sozinho — seria
  // irritante no meio de um teste —, só avisa que o que está na tela é velho.
  useEffect(() => {
    if (jaComecou.current && assinatura !== assinaturaDoInicio.current) setDesatualizada(true)
  }, [assinatura])

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' })
  }, [itens])

  const viva = status === 'ativa' || status === 'aguardando_ia'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {itens.map((item) => (
          <Bolha key={item.chave} item={item} pendentes={pendentes} ocupado={ocupado} aoEscolher={enviar} />
        ))}
        {ocupado && <p className="text-xs text-zinc-400">digitando…</p>}
        <div ref={fimDaLista} />
      </div>

      {desatualizada && (
        <p className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          O fluxo mudou desde que esta conversa começou.{' '}
          <button onClick={recomecar} className="font-medium underline">
            recomeçar para testar
          </button>
        </p>
      )}

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {viva ? (
          <form onSubmit={submeter} className="flex gap-2">
            <input
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              disabled={ocupado}
              placeholder={
                status === 'aguardando_ia' ? 'o que a IA responderia?' : 'escreva como o cliente…'
              }
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:opacity-50 dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={() => void enviar({ tipo: 'midia', formato: 'audio' }, '🎤 (áudio)')}
              disabled={ocupado || status === 'aguardando_ia'}
              title="Testar o que acontece quando a pessoa manda áudio"
              className="rounded-lg border border-zinc-300 px-3 text-sm transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              🎤
            </button>
            <button
              type="submit"
              disabled={ocupado || rascunho.trim() === ''}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
        ) : (
          <p className="px-1 py-2 text-sm text-zinc-500 dark:text-zinc-400">
            {status === 'humano'
              ? 'O bot saiu de cena — daqui em diante quem responde é uma pessoa.'
              : 'A conversa terminou.'}{' '}
            <button onClick={recomecar} className="font-medium text-emerald-600 underline">
              recomeçar
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

function Bolha({
  item,
  pendentes,
  ocupado,
  aoEscolher,
}: {
  item: Item
  pendentes: Pendentes | null
  ocupado: boolean
  aoEscolher: (entrada: Entrada, eco?: string) => void
}) {
  if (item.de === 'sistema') {
    return (
      <p
        className={`text-center text-[11px] tracking-wide ${
          item.alerta ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-500'
        }`}
      >
        {item.texto}
      </p>
    )
  }

  if (item.de === 'pessoa') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-600 px-3 py-2 text-sm text-white">
          {item.texto}
        </p>
      </div>
    )
  }

  const ativo = pendentes?.chave === item.chave && !ocupado

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-sm whitespace-pre-wrap dark:bg-zinc-800">
        {item.texto}
      </p>

      {item.opcoes && item.opcoes.length > 0 && (
        <div
          className={
            item.formato === 'botoes'
              ? 'flex max-w-[85%] flex-wrap gap-2'
              : 'flex w-full max-w-[85%] flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700'
          }
        >
          {item.opcoes.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              disabled={!ativo}
              onClick={() => aoEscolher({ tipo: 'opcao', opcaoId: opcao.id }, opcao.rotulo)}
              className={
                item.formato === 'botoes'
                  ? 'rounded-full border border-emerald-600/40 px-3 py-1.5 text-xs font-medium text-emerald-700 transition enabled:hover:bg-emerald-600 enabled:hover:text-white disabled:opacity-40 dark:text-emerald-400'
                  : 'border-b border-zinc-200 px-3 py-2 text-left text-xs transition last:border-0 enabled:hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:enabled:hover:bg-zinc-800'
              }
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      )}

      {item.opcoes && (
        <span className="text-[10px] text-zinc-400">
          no WhatsApp isto vira {item.formato === 'botoes' ? 'botões' : 'uma lista'}
        </span>
      )}
    </div>
  )
}
