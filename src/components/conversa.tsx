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
  clienteId,
  contextoNegocio = '',
  iaHabilitada = false,
  aoMudarSessao,
}: {
  fluxo: Fluxo
  /** De quem é o fluxo. Sem isto o bloco de API não alcança as credenciais. */
  clienteId?: string
  /** O que o cliente escreveu sobre o negócio: é o que fecha o escopo da IA. */
  contextoNegocio?: string
  /** Espelha o plano da automação. Sem isto, o bloco de IA não chama modelo. */
  iaHabilitada?: boolean
  aoMudarSessao?: (sessao: Sessao) => void
}) {
  const [itens, setItens] = useState<Item[]>([])
  const [pendentes, setPendentes] = useState<Pendentes | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [status, setStatus] = useState<Sessao['status']>('ativa')
  const [desatualizada, setDesatualizada] = useState(false)

  const sessaoRef = useRef<Sessao>(sessaoNova())
  // Espelho dos itens para montar o histórico sem depender do fechamento do
  // render em que `enviar` foi criada.
  const itensRef = useRef<Item[]>([])
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
        body: JSON.stringify({
          fluxo,
          sessao: sessaoRef.current,
          entrada,
          clienteId,
          contextoNegocio,
          iaHabilitada,
          // O que já foi dito, para a IA não repetir pergunta respondida.
          historico: itensRef.current
            .filter((i) => i.de !== 'sistema')
            .map((i) => ({ de: i.de === 'pessoa' ? 'pessoa' : 'bot', texto: i.texto })),
        }),
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
    } catch {
      // Sem isto a falha some: a requisição pode morrer por rede, ou por a rota
      // estourar o tempo esperando uma API lenta. Ficar girando em silêncio é
      // pior do que dizer o que houve.
      setItens((atual) => [
        ...atual,
        { chave: novaChave(), de: 'sistema', texto: 'a requisição não completou', alerta: true },
      ])
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
        case 'chamar_http':
          // O caminho normal é o resolvedor já ter trocado isto pelos
          // `salvar_campo` que vieram da resposta. Chegar aqui significa que
          // ninguém executou — mostrar é melhor do que sumir com o evento.
          novos.push({
            chave,
            de: 'sistema',
            texto: `a chamada para ${acao.url} não foi executada`,
            alerta: true,
          })
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
    itensRef.current = itens
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' })
  }, [itens])

  const viva = status === 'ativa' || status === 'aguardando_ia' || status === 'aguardando_http'
  const temApi = fluxo.nodes.some((n) => n.type === 'http')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {temApi && (
        <p className="mx-3.5 mt-3.5 rounded-[11px] border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-cyan-300">
          Este fluxo chama uma API. O teste dispara <strong>de verdade</strong> — testar cinco vezes
          grava cinco vezes no sistema do cliente.
        </p>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3.5">
        {itens.map((item) => (
          <Bolha key={item.chave} item={item} pendentes={pendentes} ocupado={ocupado} aoEscolher={enviar} />
        ))}
        {ocupado && (
          <div className="flex w-fit gap-1 rounded-[13px_13px_13px_4px] border border-white/[0.08] bg-white/[0.055] px-3.5 py-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 rounded-full bg-muted"
                style={{ animation: `blink 1.1s ${i * 0.18}s infinite` }}
              />
            ))}
          </div>
        )}
        <div ref={fimDaLista} />
      </div>

      {desatualizada && (
        <p className="mx-3.5 mb-2 rounded-[11px] border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2.5 text-[11.5px] text-amber-200">
          O fluxo mudou desde que esta conversa começou.{' '}
          <button onClick={recomecar} className="font-bold underline underline-offset-2">
            recomeçar para testar
          </button>
        </p>
      )}

      <div className="border-t border-white/[0.06] p-3">
        {viva ? (
          <form onSubmit={submeter} className="flex gap-2">
            <input
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              disabled={ocupado}
              placeholder={
                status === 'aguardando_ia' ? 'o que a IA responderia?' : 'escreva como o cliente…'
              }
              className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
            />
            <button
              type="button"
              onClick={() => void enviar({ tipo: 'midia', formato: 'audio' }, '🎤 (áudio)')}
              disabled={ocupado || status === 'aguardando_ia'}
              title="Testar o que acontece quando a pessoa manda áudio"
              className="app-secondary-button flex size-9 shrink-0 items-center justify-center px-0 text-sm disabled:opacity-40"
            >
              🎤
            </button>
            <button
              type="submit"
              disabled={ocupado || rascunho.trim() === ''}
              className="app-primary-button flex size-9 shrink-0 items-center justify-center px-0 text-lg disabled:opacity-40"
            >
              ›
            </button>
          </form>
        ) : (
          <p className="px-1 py-2 text-[12.5px] leading-5 text-muted">
            {status === 'humano'
              ? 'O bot saiu de cena — daqui em diante quem responde é uma pessoa.'
              : 'A conversa terminou.'}{' '}
            <button onClick={recomecar} className="font-bold text-accent underline underline-offset-2">
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
        className={`mx-auto w-fit rounded-full border border-dashed px-3 py-1 text-center font-mono text-[9.5px] ${
          item.alerta ? 'border-amber-300/25 text-amber-200' : 'border-white/[0.14] text-[#6b7689]'
        }`}
      >
        {item.texto}
      </p>
    )
  }

  if (item.de === 'pessoa') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-[13px_13px_4px_13px] border border-accent/[0.24] bg-accent/[0.14] px-3 py-2 text-[12.5px] leading-[1.5] text-ink">
          {item.texto}
        </p>
      </div>
    )
  }

  const ativo = pendentes?.chave === item.chave && !ocupado

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="max-w-[88%] rounded-[13px_13px_13px_4px] border border-white/[0.08] bg-white/[0.055] px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-wrap">
        {item.texto}
      </p>

      {item.opcoes && item.opcoes.length > 0 && (
        <div
          className={
            item.formato === 'botoes'
              ? 'flex max-w-[88%] flex-wrap gap-1.5'
              : 'flex w-full max-w-[88%] flex-col overflow-hidden rounded-xl border border-white/[0.1]'
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
                  ? 'rounded-lg border border-accent/[0.28] bg-accent/[0.07] px-3 py-1.5 text-xs font-semibold text-accent transition enabled:hover:bg-accent/[0.14] disabled:opacity-40'
                  : 'border-b border-white/[0.08] px-3 py-2 text-left text-xs text-soft transition last:border-0 enabled:hover:bg-white/[0.05] disabled:opacity-40'
              }
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      )}

      {item.opcoes && (
        <span className="font-mono text-[9.5px] text-dim">
          no WhatsApp isto vira {item.formato === 'botoes' ? 'botões' : 'uma lista'}
        </span>
      )}
    </div>
  )
}
