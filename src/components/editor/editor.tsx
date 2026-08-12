'use client'

import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Conversa } from '@/components/conversa'
import type { Sessao } from '@/core/engine/types'
import { fluxoSchema, type Fluxo, type No, type TipoNo } from '@/core/flow/schema'
import { validar } from '@/core/flow/validar'
import { acaoSalvarRascunho } from '@/server/acoes'
import { ICONES, NOMES, tiposDeNo } from './nos'
import { Painel } from './painel'

const PAUSA_ANTES_DE_SALVAR = 800

const TIPOS: TipoNo[] = ['mensagem', 'pergunta', 'condicao', 'salvar-campo', 'ia', 'handoff']

/** Como cada bloco nasce ao ser arrastado da barra. */
function dadosPadrao(tipo: TipoNo): Record<string, unknown> {
  switch (tipo) {
    case 'mensagem':
      return { texto: 'Escreva a mensagem aqui.' }
    case 'pergunta':
      return { texto: 'O que você quer perguntar?', opcoes: [] }
    case 'condicao':
      return { variavel: 'assunto', operador: 'igual', valor: '' }
    case 'salvar-campo':
      return { campo: 'campo', valor: '' }
    case 'ia':
      return { instrucao: 'Responda a dúvida do cliente usando o contexto do negócio.' }
    case 'handoff':
      return {
        motivo: 'pedido pelo fluxo',
        mensagem: 'Vou te passar para um atendente. Só um instante!',
      }
  }
}

/**
 * Tira do React Flow só o que o motor entende.
 *
 * O React Flow carrega estado de interface junto do nó (`selected`, `dragging`,
 * `measured`). Nada disso pode ir para o banco nem para o motor — o que sai
 * daqui é o mesmo objeto que o webhook do WhatsApp vai executar.
 */
function paraFluxo(inicio: string, nodes: Node[], edges: Edge[]): Fluxo {
  return fluxoSchema.parse({
    inicio,
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
    })),
  })
}

export function Editor({
  fluxoId,
  nome,
  clienteNome,
  voltarHref,
  inicial,
}: {
  fluxoId: string
  nome: string
  clienteNome: string
  voltarHref: string
  inicial: Fluxo
}) {
  const [nodes, setNodes, aoMudarNos] = useNodesState<Node>(
    inicial.nodes.map((n) => ({ ...n, className: n.id === inicial.inicio ? 'no-inicio' : '' })),
  )
  const [edges, setEdges, aoMudarArestas] = useEdgesState<Edge>(inicial.edges as Edge[])
  const [inicio, setInicio] = useState(inicial.inicio)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [aba, setAba] = useState<'bloco' | 'testar'>('bloco')
  const [salvamento, setSalvamento] = useState<'salvo' | 'salvando' | 'pendente' | 'erro'>('salvo')
  const [sessao, setSessao] = useState<Sessao | null>(null)

  const fluxo = useMemo(() => paraFluxo(inicio, nodes, edges), [inicio, nodes, edges])
  const validacao = useMemo(() => validar(fluxo), [fluxo])

  const assinatura = JSON.stringify(fluxo)
  const assinaturaSalva = useRef(assinatura)

  // Salva sozinho depois de uma pausa. Rascunho incompleto pode ser salvo —
  // quem barra a publicação é o validador, não o salvamento.
  useEffect(() => {
    if (assinatura === assinaturaSalva.current) return
    setSalvamento('pendente')

    const relogio = setTimeout(async () => {
      setSalvamento('salvando')
      const congelado = assinatura
      try {
        const r = await acaoSalvarRascunho(fluxoId, JSON.parse(congelado))
        if (r.ok) {
          assinaturaSalva.current = congelado
          setSalvamento(congelado === assinatura ? 'salvo' : 'pendente')
        } else {
          setSalvamento('erro')
        }
      } catch {
        setSalvamento('erro')
      }
    }, PAUSA_ANTES_DE_SALVAR)

    return () => clearTimeout(relogio)
  }, [assinatura, fluxoId])

  // Avisa antes de fechar a aba com coisa por salvar.
  useEffect(() => {
    if (salvamento === 'salvo') return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [salvamento])

  const aoConectar = useCallback(
    (conexao: Connection) => {
      setEdges((atuais) => {
        // Uma saída leva a um lugar só. O motor pega a primeira aresta que
        // encontra, então duas saindo da mesma alça seriam ambiguidade
        // silenciosa — some com a antiga em vez de deixar as duas.
        const limpas = atuais.filter(
          (e) => !(e.source === conexao.source && e.sourceHandle === conexao.sourceHandle),
        )
        return addEdge(conexao, limpas)
      })
    },
    [setEdges],
  )

  function adicionar(tipo: TipoNo) {
    const id = crypto.randomUUID().slice(0, 8)
    setNodes((atuais) => [
      ...atuais,
      {
        id,
        type: tipo,
        position: { x: 80 + atuais.length * 24, y: 80 + atuais.length * 40 },
        data: dadosPadrao(tipo),
      },
    ])
    setSelecionado(id)
    setAba('bloco')
  }

  function mudarDados(dados: Record<string, unknown>) {
    setNodes((atuais) =>
      atuais.map((n) => (n.id === selecionado ? { ...n, data: { ...n.data, ...dados } } : n)),
    )
  }

  function apagar() {
    if (!selecionado) return
    setNodes((atuais) => atuais.filter((n) => n.id !== selecionado))
    setEdges((atuais) => atuais.filter((e) => e.source !== selecionado && e.target !== selecionado))
    setSelecionado(null)
  }

  function definirInicio() {
    if (!selecionado) return
    setInicio(selecionado)
    setNodes((atuais) =>
      atuais.map((n) => ({ ...n, className: n.id === selecionado ? 'no-inicio' : '' })),
    )
  }

  const noSelecionado = fluxo.nodes.find((n) => n.id === selecionado) ?? null
  const variaveis = variaveisDoFluxo(fluxo)

  return (
    <div className="flex h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="min-w-0">
          <Link href={voltarHref} className="text-xs text-zinc-500 hover:underline">
            ← {clienteNome}
          </Link>
          <h1 className="truncate text-sm font-semibold">{nome}</h1>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <EstadoSalvamento estado={salvamento} />
          {validacao.ok ? (
            <span className="rounded bg-emerald-500/15 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-400">
              pode publicar
            </span>
          ) : (
            <span className="rounded bg-red-500/15 px-2 py-1 font-medium text-red-700 dark:text-red-400">
              {validacao.erros.length} impedimento(s)
            </span>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="w-40 shrink-0 space-y-1 overflow-y-auto border-r border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="px-1 pt-1 pb-2 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
            Adicionar
          </p>
          {TIPOS.map((tipo) => (
            <button
              key={tipo}
              onClick={() => adicionar(tipo)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span aria-hidden>{ICONES[tipo]}</span>
              {NOMES[tipo]}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={aoMudarNos}
            onEdgesChange={aoMudarArestas}
            onConnect={aoConectar}
            nodeTypes={tiposDeNo}
            onSelectionChange={({ nodes: sel }) => {
              const id = sel[0]?.id ?? null
              setSelecionado(id)
              if (id) setAba('bloco')
            }}
            fitView
            proOptions={{ hideAttribution: false }}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable className="!hidden lg:!block" />
          </ReactFlow>
        </div>

        <aside className="flex w-96 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex shrink-0 border-b border-zinc-200 text-xs dark:border-zinc-800">
            {(['bloco', 'testar'] as const).map((chave) => (
              <button
                key={chave}
                onClick={() => setAba(chave)}
                className={`flex-1 px-3 py-2 font-medium transition ${
                  aba === chave
                    ? 'border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {chave === 'bloco' ? 'Bloco' : 'Testar'}
              </button>
            ))}
          </div>

          {aba === 'bloco' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Painel
                no={noSelecionado}
                ehInicio={selecionado === inicio}
                variaveis={variaveis}
                aoMudarDados={mudarDados}
                aoDefinirInicio={definirInicio}
                aoApagar={apagar}
              />

              {!validacao.ok && (
                <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="mb-2 text-[10px] font-semibold tracking-wide text-red-600 uppercase">
                    Impede de publicar
                  </p>
                  <ul className="space-y-1.5">
                    {validacao.erros.map((erro, i) => (
                      <li key={i}>
                        <button
                          onClick={() => erro.noId && setSelecionado(erro.noId)}
                          className="text-left text-[11px] text-red-600 hover:underline dark:text-red-400"
                        >
                          {erro.mensagem}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {validacao.avisos.length > 0 && (
                <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="mb-2 text-[10px] font-semibold tracking-wide text-amber-600 uppercase">
                    Vale olhar
                  </p>
                  <ul className="space-y-1.5">
                    {validacao.avisos.map((aviso, i) => (
                      <li key={i}>
                        <button
                          onClick={() => aviso.noId && setSelecionado(aviso.noId)}
                          className="text-left text-[11px] text-amber-600 hover:underline dark:text-amber-400"
                        >
                          {aviso.mensagem}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              <Conversa fluxo={fluxo} aoMudarSessao={setSessao} />
              {sessao && (
                <div className="shrink-0 border-t border-zinc-200 p-3 text-[11px] dark:border-zinc-800">
                  <p className="text-zinc-400">
                    bloco atual: <code>{sessao.noAtual ?? '—'}</code> · {sessao.status}
                  </p>
                  {Object.keys(sessao.vars).length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(sessao.vars).map(([k, v]) => (
                        <span key={k} className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                          {k}: {v}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function EstadoSalvamento({ estado }: { estado: 'salvo' | 'salvando' | 'pendente' | 'erro' }) {
  const texto = {
    salvo: 'salvo',
    salvando: 'salvando…',
    pendente: 'alterações não salvas',
    erro: 'não deu para salvar',
  }[estado]

  return (
    <span className={estado === 'erro' ? 'text-red-600' : 'text-zinc-400'}>{texto}</span>
  )
}

function variaveisDoFluxo(fluxo: Fluxo): string[] {
  const nomes = new Set<string>()
  for (const no of fluxo.nodes as No[]) {
    if (no.type === 'pergunta' && no.data.salvarEm) nomes.add(no.data.salvarEm)
    if (no.type === 'salvar-campo' && no.data.campo) nomes.add(no.data.campo)
    if (no.type === 'ia' && no.data.salvarEm) nomes.add(no.data.salvarEm)
  }
  return [...nomes].sort()
}
