'use client'

import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react'
import type { ReactNode } from 'react'
import {
  LIMITE_BOTOES,
  SAIDA_ESCOLHEU,
  SAIDA_FALSO,
  SAIDA_VAZIO,
  SAIDA_VERDADEIRO,
  type Opcao,
} from '@/core/flow/schema'

/**
 * O visual de cada tipo de bloco.
 *
 * O detalhe que faz o editor funcionar está nas alças (`Handle`): o `id` de cada
 * alça de saída é exatamente o `sourceHandle` que o motor lê. Numa pergunta, a
 * alça de uma opção tem o id da opção. Ou seja, **a setinha que você arrasta já
 * é a ramificação** — não existe tela de configurar branch em lugar nenhum.
 */

const CORES = {
  mensagem: 'border-sky-400/30',
  pergunta: 'border-emerald-400/30',
  condicao: 'border-violet-400/30',
  'salvar-campo': 'border-amber-300/30',
  ia: 'border-fuchsia-400/30',
  handoff: 'border-rose-400/30',
  http: 'border-cyan-400/30',
} as const

export const ICONES = {
  mensagem: '↗',
  pergunta: '?',
  condicao: '⑂',
  'salvar-campo': '↓',
  ia: '✦',
  handoff: '♙',
  http: '⇄',
} as const

export const NOMES = {
  mensagem: 'Mensagem',
  pergunta: 'Pergunta',
  condicao: 'Condição',
  'salvar-campo': 'Guardar',
  ia: 'IA',
  handoff: 'Falar com humano',
  http: 'API',
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
      className={`w-[248px] overflow-hidden rounded-xl border bg-[#0b1018] text-xs shadow-[0_14px_34px_rgba(0,0,0,0.35)] transition ${CORES[tipo]} ${
        selecionado ? '!border-accent ring-1 ring-accent/30' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!left-[-6px] !size-[13px] !border-2 !border-white/30 !bg-[#0b1018]" />
      <p className="flex h-[38px] items-center gap-2 border-b border-white/[0.06] px-3 text-[10px] font-bold tracking-[0.06em] text-[#97a2b4] uppercase">
        <span aria-hidden className="flex size-6 items-center justify-center rounded-[7px] bg-white/[0.05] text-[13px] text-soft">
          {ICONES[tipo]}
        </span>
        {NOMES[tipo]}
      </p>
      <div className="px-3 py-2.5">{children}</div>
      {saidaUnica && (
        <Handle type="source" position={Position.Right} className="!right-[-6px] !size-[11px] !border-2 !border-[#0b1018] !bg-accent" />
      )}
    </div>
  )
}

/** Uma linha com a própria alça de saída à direita. */
function Saida({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="relative mt-1.5 rounded-[7px] border border-white/[0.07] bg-white/[0.035] px-2 py-1.5 pr-5 text-[#b9c2d0]">
      {children}
      <Handle
        type="source"
        id={id}
        position={Position.Right}
        className="!right-[-6px] !size-[11px] !border-2 !border-[#0b1018] !bg-accent"
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
      <p className="line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-5 text-soft">
        {vazio(d.texto, '(sem texto)')}
      </p>
    </Caixa>
  )
}

function NoPergunta({ data, selected }: NodeProps) {
  const d = data as { texto: string; salvarEm?: string; opcoes: Opcao[]; opcoesDe?: string }
  const dinamica = (d.opcoesDe ?? '').trim() !== ''

  return (
    <Caixa
      tipo="pergunta"
      selecionado={!!selected}
      saidaUnica={!dinamica && d.opcoes.length === 0}
    >
      <p className="line-clamp-2 text-[12.5px] leading-5 text-soft">{vazio(d.texto, '(sem texto)')}</p>
      {d.salvarEm && <p className="mt-1 font-mono text-[10px] text-dim">guarda em {d.salvarEm}</p>}

      {dinamica ? (
        <>
          <p className="mt-1 text-[10px] text-dim">
            opções de <code className="font-mono text-[#8de2fa]">{d.opcoesDe}</code>
          </p>
          <Saida id={SAIDA_ESCOLHEU}>
            <span className="text-[11px] text-emerald-300">escolheu</span>
          </Saida>
          <Saida id={SAIDA_VAZIO}>
            <span className="text-[11px] text-muted">veio vazia</span>
          </Saida>
        </>
      ) : (
        <>
          {d.opcoes.map((opcao) => (
            <Saida key={opcao.id} id={opcao.id}>
              <span className="text-[11px]">{vazio(opcao.rotulo, '(sem rótulo)')}</span>
            </Saida>
          ))}

          {d.opcoes.length > 0 && (
            <p className="mt-1.5 text-[10px] text-dim">
              {d.opcoes.length <= LIMITE_BOTOES ? 'vira botões' : 'vira lista'}
            </p>
          )}
          {d.opcoes.length === 0 && (
            <p className="mt-1 text-[10px] text-dim">resposta livre em texto</p>
          )}
        </>
      )}
    </Caixa>
  )
}

function NoCondicao({ data, selected }: NodeProps) {
  const d = data as { variavel: string; operador: string; valor: string }
  return (
    <Caixa tipo="condicao" selecionado={!!selected} saidaUnica={false}>
      <p className="text-soft">
        <code className="font-mono text-[11px] text-[#8de2fa]">{d.variavel}</code>{' '}
        <span className="text-muted">{d.operador}</span>{' '}
        {d.valor && <code className="font-mono text-[11px]">{d.valor}</code>}
      </p>
      <Saida id={SAIDA_VERDADEIRO}>
        <span className="text-[11px] text-emerald-300">verdadeiro</span>
      </Saida>
      <Saida id={SAIDA_FALSO}>
        <span className="text-[11px] text-muted">falso</span>
      </Saida>
    </Caixa>
  )
}

function NoSalvarCampo({ data, selected }: NodeProps) {
  const d = data as { campo: string; valor: string }
  return (
    <Caixa tipo="salvar-campo" selecionado={!!selected}>
      <p className="text-soft">
        <code className="font-mono text-[11px] text-[#8de2fa]">{d.campo}</code> = {vazio(d.valor, '(vazio)')}
      </p>
    </Caixa>
  )
}

function NoIa({ data, selected }: NodeProps) {
  const d = data as { instrucao: string; salvarEm?: string }
  return (
    <Caixa tipo="ia" selecionado={!!selected}>
      <p className="line-clamp-3 text-[12.5px] leading-5 text-soft">
        {vazio(d.instrucao, '(sem instrução)')}
      </p>
    </Caixa>
  )
}

function NoHandoff({ data, selected }: NodeProps) {
  const d = data as { motivo: string; mensagem: string }
  return (
    <Caixa tipo="handoff" selecionado={!!selected} saidaUnica={false}>
      <p className="line-clamp-2 text-[12.5px] leading-5 text-soft">{d.mensagem}</p>
      <p className="mt-1 text-[10px] text-dim">motivo: {d.motivo}</p>
    </Caixa>
  )
}

function NoHttp({ data, selected }: NodeProps) {
  const d = data as { metodo: string; url: string; mapear: { variavel: string }[] }
  return (
    <Caixa tipo="http" selecionado={!!selected}>
      <p className="truncate text-[12.5px] leading-5 text-soft">
        <span className="font-mono text-[10px] text-[#8de2fa]">{d.metodo}</span>{' '}
        {vazio(d.url, '(sem endereço)')}
      </p>
      {d.mapear.length > 0 && (
        <p className="mt-1 truncate font-mono text-[10px] text-dim">
          guarda {d.mapear.map((m) => m.variavel || '?').join(', ')}
        </p>
      )}
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
  http: NoHttp,
}
