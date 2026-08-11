'use client'

import { useEffect, useRef, useState } from 'react'
import { sessaoNova, type Acao, type Entrada, type Resultado, type Sessao } from '@/core/engine/types'
import type { Fluxo, Opcao } from '@/core/flow/schema'
import type { ResultadoValidacao } from '@/core/flow/validar'

type Item =
  | { chave: number; de: 'bot'; texto: string; opcoes?: Opcao[]; formato?: 'botoes' | 'lista' }
  | { chave: number; de: 'pessoa'; texto: string }
  | { chave: number; de: 'sistema'; texto: string; alerta?: boolean }

type Pendentes = { chave: number; opcoes: Opcao[]; formato: 'botoes' | 'lista' }

let sequencia = 0
const novaChave = () => ++sequencia

const ROTULO_STATUS: Record<Sessao['status'], { texto: string; classe: string }> = {
  ativa: { texto: 'conversando', classe: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  aguardando_ia: { texto: 'esperando a IA', classe: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  humano: { texto: 'com o humano', classe: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  encerrada: { texto: 'encerrada', classe: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400' },
}

export function Simulador({ fluxo, validacao }: { fluxo: Fluxo; validacao: ResultadoValidacao }) {
  const [itens, setItens] = useState<Item[]>([])
  const [sessao, setSessao] = useState<Sessao>(sessaoNova)
  const [pendentes, setPendentes] = useState<Pendentes | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const sessaoRef = useRef<Sessao>(sessaoNova())
  const fimDaLista = useRef<HTMLDivElement>(null)
  const jaComecou = useRef(false)

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
          { chave: novaChave(), de: 'sistema', texto: 'o motor recusou a requisição', alerta: true },
        ])
        return
      }

      const { acoes, sessao: nova } = (await resposta.json()) as Resultado
      sessaoRef.current = nova
      setSessao(nova)
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

  function reiniciar() {
    sessaoRef.current = sessaoNova()
    setSessao(sessaoRef.current)
    setItens([])
    setPendentes(null)
    setRascunho('')
    void enviar({ tipo: 'inicio' })
  }

  function submeter(evento: React.FormEvent) {
    evento.preventDefault()
    const texto = rascunho.trim()
    if (texto === '' || ocupado) return
    setRascunho('')

    if (sessao.status === 'aguardando_ia') {
      void enviar({ tipo: 'ia_respondeu', texto }, `(resposta da IA) ${texto}`)
      return
    }
    void enviar({ tipo: 'texto', texto }, texto)
  }

  useEffect(() => {
    if (jaComecou.current) return
    jaComecou.current = true
    void enviar({ tipo: 'inicio' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' })
  }, [itens])

  const conversaViva = sessao.status === 'ativa' || sessao.status === 'aguardando_ia'
  const status = ROTULO_STATUS[sessao.status]

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AutoFluxos — simulador</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Converse como se fosse o cliente. É o mesmo motor que vai rodar no WhatsApp — não uma
            imitação dele.
          </p>
        </div>
        <button
          type="button"
          onClick={reiniciar}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium transition hover:bg-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Recomeçar conversa
        </button>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {itens.map((item) => (
              <Bolha key={item.chave} item={item} pendentes={pendentes} ocupado={ocupado} aoEscolher={enviar} />
            ))}
            {ocupado && <p className="text-xs text-zinc-400">digitando…</p>}
            <div ref={fimDaLista} />
          </div>

          <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
            {conversaViva ? (
              <form onSubmit={submeter} className="flex gap-2">
                <input
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  disabled={ocupado}
                  placeholder={
                    sessao.status === 'aguardando_ia'
                      ? 'o que a IA responderia?'
                      : 'escreva como se fosse o cliente…'
                  }
                  className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:opacity-50 dark:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => void enviar({ tipo: 'midia', formato: 'audio' }, '🎤 (áudio)')}
                  disabled={ocupado || sessao.status === 'aguardando_ia'}
                  title="Testar o que acontece quando a pessoa manda áudio"
                  className="rounded-lg border border-zinc-300 px-3 text-sm transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  🎤
                </button>
                <button
                  type="submit"
                  disabled={ocupado || rascunho.trim() === ''}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  Enviar
                </button>
              </form>
            ) : (
              <p className="px-1 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                {sessao.status === 'humano'
                  ? 'O bot saiu de cena — daqui em diante quem responde é uma pessoa.'
                  : 'A conversa terminou.'}{' '}
                <button onClick={reiniciar} className="font-medium text-emerald-600 underline">
                  recomeçar
                </button>
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-4 text-sm">
          <Cartao titulo="Estado da conversa">
            <dl className="space-y-2">
              <Linha rotulo="status">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.classe}`}>
                  {status.texto}
                </span>
              </Linha>
              <Linha rotulo="nó atual">
                <code className="text-xs">{sessao.noAtual ?? '—'}</code>
              </Linha>
              <Linha rotulo="tentativas">
                <code className="text-xs">{sessao.tentativas}</code>
              </Linha>
            </dl>
          </Cartao>

          <Cartao titulo="O que já foi coletado">
            {Object.keys(sessao.vars).length === 0 ? (
              <p className="text-xs text-zinc-500">nada ainda</p>
            ) : (
              <dl className="space-y-1.5">
                {Object.entries(sessao.vars).map(([chave, valor]) => (
                  <Linha key={chave} rotulo={chave}>
                    <span className="text-right text-xs">{valor}</span>
                  </Linha>
                ))}
              </dl>
            )}
            <p className="mt-3 border-t border-zinc-200 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
              É isto que vira a linha do lead na tela do cliente.
            </p>
          </Cartao>

          <Cartao titulo="Validação do fluxo">
            {validacao.ok ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ pode ir ao ar — tem caminho até um humano
              </p>
            ) : (
              <ul className="space-y-1 text-xs text-red-600 dark:text-red-400">
                {validacao.erros.map((erro, i) => (
                  <li key={i}>✗ {erro.mensagem}</li>
                ))}
              </ul>
            )}
            {validacao.avisos.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-amber-600 dark:text-amber-400">
                {validacao.avisos.map((aviso, i) => (
                  <li key={i}>! {aviso.mensagem}</li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao titulo="Experimente">
            <ul className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <li>Escreva “quero falar com um atendente” a qualquer momento.</li>
              <li>Clique no 🎤 para ver o que acontece com áudio.</li>
              <li>Responda “2” em vez de clicar no botão.</li>
              <li>Digite besteira três vezes seguidas.</li>
            </ul>
          </Cartao>
        </aside>
      </div>
    </main>
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
        <p className="max-w-[75%] rounded-2xl rounded-br-sm bg-emerald-600 px-3 py-2 text-sm text-white">
          {item.texto}
        </p>
      </div>
    )
  }

  const ativo = pendentes?.chave === item.chave && !ocupado

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="max-w-[75%] rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-sm whitespace-pre-wrap dark:bg-zinc-800">
        {item.texto}
      </p>

      {item.opcoes && item.opcoes.length > 0 && (
        <div
          className={
            item.formato === 'botoes'
              ? 'flex max-w-[75%] flex-wrap gap-2'
              : 'flex w-full max-w-[75%] flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700'
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

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {titulo}
      </h2>
      {children}
    </div>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  )
}
