'use client'

import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react'
import type { ReactNode } from 'react'
import { LIMITE_BOTOES, SAIDA_FALSO, SAIDA_VERDADEIRO, type Opcao } from '@/core/flow/schema'

/**
 * O visual de cada tipo de bloco.
 *
 * O detalhe que faz o editor funcionar está nas alças (`Handle`): o `id` de cada
 * alça de saída é exatamente o `sourceHandle` que o motor lê. Numa pergunta, a
 * alça de uma opção tem o id da opção. Ou seja, **a setinha que você arrasta já
 * é a ramificação** — não existe tela de configurar branch em lugar nenhum.
 */

const CORES = {
  mensagem: 'border-sky-500/40 bg-sky-500/5',
  pergunta: 'border-emerald-500/40 bg-emerald-500/5',
  condicao: 'border-violet-500/40 bg-violet-500/5',
  'salvar-campo': 'border-amber-500/40 bg-amber-500/5',
  ia: 'border-fuchsia-500/40 bg-fuchsia-500/5',
  handoff: 'border-blue-500/40 bg-blue-500/5',
} as const

export const ICONES = {
  mensagem: '💬',
  pergunta: '❓',
  condicao: '⑂',
  'salvar-campo': '💾',
  ia: '✨',
  handoff: '🙋',
} as const

export const NOMES = {
  mensagem: 'Mensagem',
  pergunta: 'Pergunta',
  condicao: 'Condição',
  'salvar-campo': 'Guardar',
  ia: 'IA',
  handoff: 'Falar com humano',
} as const

function Caixa({
  tipo,
  selecionado,
  children,
  saidaUnica = true,
}: {
  tipo: keyof typeof CORES
  selecionado: boolean
  children: ReactNode
  /** `false` quando o bloco desenha as próprias saídas (pergunta, condição). */
  saidaUnica?: boolean
}) {
  return (
    <div
      className={`w-56 rounded-xl border-2 bg-white px-3 py-2 text-xs shadow-sm transition dark:bg-zinc-900 ${CORES[tipo]} ${
        selecionado ? 'ring-2 ring-zinc-900 dark:ring-white' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-zinc-400" />
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
        <span aria-hidden>{ICONES[tipo]}</span>
        {NOMES[tipo]}
      </p>
      {children}
      {saidaUnica && (
        <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-zinc-400" />
      )}
    </div>
  )
}

/** Uma linha com a própria alça de saída à direita. */
function Saida({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="relative mt-1 rounded border border-zinc-200 bg-white px-2 py-1 pr-4 dark:border-zinc-700 dark:bg-zinc-800">
      {children}
      <Handle
        type="source"
        id={id}
        position={Position.Right}
        className="!right-[-5px] !h-2 !w-2 !bg-emerald-500"
        style={{ top: '50%' }}
      />
    </div>
  )
}

const vazio = (t: string, alt: string) => (t.trim() === '' ? alt : t)

function NoMensagem({ data, selected }: NodeProps) {
  const d = data as { texto: string }
  return (
    <Caixa tipo="mensagem" selecionado={!!selected}>
      <p className="line-clamp-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
        {vazio(d.texto, '(sem texto)')}
      </p>
    </Caixa>
  )
}

function NoPergunta({ data, selected }: NodeProps) {
  const d = data as { texto: string; salvarEm?: string; opcoes: Opcao[] }
  return (
    <Caixa tipo="pergunta" selecionado={!!selected} saidaUnica={d.opcoes.length === 0}>
      <p className="line-clamp-2 text-zinc-700 dark:text-zinc-200">{vazio(d.texto, '(sem texto)')}</p>
      {d.salvarEm && <p className="mt-1 text-[10px] text-zinc-400">guarda em {d.salvarEm}</p>}

      {d.opcoes.map((opcao) => (
        <Saida key={opcao.id} id={opcao.id}>
          <span className="text-[11px]">{vazio(opcao.rotulo, '(sem rótulo)')}</span>
        </Saida>
      ))}

      {d.opcoes.length > 0 && (
        <p className="mt-1.5 text-[10px] text-zinc-400">
          {d.opcoes.length <= LIMITE_BOTOES ? 'vira botões' : 'vira lista'}
        </p>
      )}
      {d.opcoes.length === 0 && (
        <p className="mt-1 text-[10px] text-zinc-400">resposta livre em texto</p>
      )}
    </Caixa>
  )
}

function NoCondicao({ data, selected }: NodeProps) {
  const d = data as { variavel: string; operador: string; valor: string }
  return (
    <Caixa tipo="condicao" selecionado={!!selected} saidaUnica={false}>
      <p className="text-zinc-700 dark:text-zinc-200">
        <code className="text-[11px]">{d.variavel}</code>{' '}
        <span className="text-zinc-500">{d.operador}</span>{' '}
        {d.valor && <code className="text-[11px]">{d.valor}</code>}
      </p>
      <Saida id={SAIDA_VERDADEIRO}>
        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">verdadeiro</span>
      </Saida>
      <Saida id={SAIDA_FALSO}>
        <span className="text-[11px] text-zinc-500">falso</span>
      </Saida>
    </Caixa>
  )
}

function NoSalvarCampo({ data, selected }: NodeProps) {
  const d = data as { campo: string; valor: string }
  return (
    <Caixa tipo="salvar-campo" selecionado={!!selected}>
      <p className="text-zinc-700 dark:text-zinc-200">
        <code className="text-[11px]">{d.campo}</code> = {vazio(d.valor, '(vazio)')}
      </p>
    </Caixa>
  )
}

function NoIa({ data, selected }: NodeProps) {
  const d = data as { instrucao: string; salvarEm?: string }
  return (
    <Caixa tipo="ia" selecionado={!!selected}>
      <p className="line-clamp-3 text-zinc-700 dark:text-zinc-200">
        {vazio(d.instrucao, '(sem instrução)')}
      </p>
    </Caixa>
  )
}

function NoHandoff({ data, selected }: NodeProps) {
  const d = data as { motivo: string; mensagem: string }
  return (
    <Caixa tipo="handoff" selecionado={!!selected} saidaUnica={false}>
      <p className="line-clamp-2 text-zinc-700 dark:text-zinc-200">{d.mensagem}</p>
      <p className="mt-1 text-[10px] text-zinc-400">motivo: {d.motivo}</p>
    </Caixa>
  )
}

export const tiposDeNo: NodeTypes = {
  mensagem: NoMensagem,
  pergunta: NoPergunta,
  condicao: NoCondicao,
  'salvar-campo': NoSalvarCampo,
  ia: NoIa,
  handoff: NoHandoff,
}
