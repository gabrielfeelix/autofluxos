'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * As peças interativas da documentação: código com abas e copiar, abas de
 * conteúdo e o botão de copiar solto.
 *
 * O painel de código é marinho, não preto: é o azul da casca escurecido, para
 * o código parecer parte do produto e não um terminal colado na página.
 */

export type Trecho = { rotulo: string; linguagem: 'shell' | 'json' | 'js' | 'python' | 'texto'; codigo: string }

export function BlocoDeCodigo({ trechos, titulo }: { trechos: Trecho[]; titulo?: string }) {
  const [ativo, setAtivo] = useState(0)
  const trecho = trechos[ativo] ?? trechos[0]
  if (!trecho) return null
  const linhas = trecho.codigo.replace(/\n$/, '').split('\n')

  return (
    <div className="overflow-hidden rounded-2xl border border-[#0b1636] bg-[#0f1b3d] text-[#d6e0ff] shadow-[0_20px_40px_-30px_rgb(8_20_70/0.8)]">
      <div className="flex h-11 items-center gap-1 border-b border-white/[0.08] pr-1.5 pl-3">
        {titulo && <span className="mr-2 text-[12.5px] font-semibold text-white/80">{titulo}</span>}
        {trechos.length > 1 &&
          trechos.map((outro, indice) => (
            <button
              key={outro.rotulo}
              type="button"
              onClick={() => setAtivo(indice)}
              className={`h-7 rounded-md px-2.5 text-[12.5px] font-medium transition ${
                indice === ativo ? 'bg-white/[0.12] text-white' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {outro.rotulo}
            </button>
          ))}
        {trechos.length === 1 && !titulo && <span className="text-[12.5px] font-medium text-white/60">{trecho.rotulo}</span>}
        <BotaoCopiar texto={trecho.codigo} escuro className="ml-auto" />
      </div>
      <pre className="overflow-x-auto py-3.5 font-mono text-[12.5px] leading-[1.7]">
        <code className="grid">
          {linhas.map((linha, indice) => (
            <span key={indice} className="grid grid-cols-[2.6rem_1fr] pr-4">
              <span aria-hidden className="pr-3 text-right text-white/25 select-none">
                {indice + 1}
              </span>
              <span>{colorir(linha, trecho.linguagem)}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

/** Cores do realce. Poucas, e todas tiradas do azul da marca para cá. */
const COR = {
  chave: 'text-[#8fb4ff]',
  texto: 'text-[#b9ecd0]',
  numero: 'text-[#ffd28a]',
  palavra: 'text-[#c9b2ff]',
  comentario: 'text-[#7f8db3]',
  opcao: 'text-[#8fb4ff]',
}

const PALAVRAS = new Set([
  'const', 'let', 'await', 'async', 'function', 'return', 'import', 'from', 'export', 'new',
  'if', 'else', 'true', 'false', 'null', 'def', 'None', 'True', 'False', 'curl', 'fetch',
])

/** Um realce de verdade é uma biblioteca; este cobre o que estas páginas mostram. */
function colorir(linha: string, linguagem: Trecho['linguagem']): ReactNode {
  if (linguagem === 'texto') return linha || ' '
  const partes: ReactNode[] = []
  const padrao =
    /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')(\s*:)?|(\b\d+(?:\.\d+)?\b)|(--?[a-zA-Z][\w-]*)|([A-Za-z_]\w*)/g
  let ultimo = 0
  for (const achado of linha.matchAll(padrao)) {
    const inicio = achado.index ?? 0
    if (inicio > ultimo) partes.push(linha.slice(ultimo, inicio))
    const [inteiro, comentario, texto, doisPontos, numero, opcao, palavra] = achado
    if (comentario && (linguagem === 'shell' || linguagem === 'python' ? comentario.startsWith('#') : comentario.startsWith('//'))) {
      partes.push(<span key={inicio} className={COR.comentario}>{comentario}</span>)
    } else if (texto) {
      partes.push(
        <span key={inicio} className={doisPontos ? COR.chave : COR.texto}>
          {texto}
        </span>,
      )
      if (doisPontos) partes.push(doisPontos)
    } else if (numero) {
      partes.push(<span key={inicio} className={COR.numero}>{numero}</span>)
    } else if (opcao && linguagem === 'shell') {
      partes.push(<span key={inicio} className={COR.opcao}>{opcao}</span>)
    } else if (palavra && PALAVRAS.has(palavra)) {
      partes.push(<span key={inicio} className={COR.palavra}>{palavra}</span>)
    } else {
      partes.push(inteiro)
    }
    ultimo = inicio + inteiro.length
  }
  if (ultimo < linha.length) partes.push(linha.slice(ultimo))
  return partes.length ? partes : ' '
}

export function BotaoCopiar({ texto, escuro, className = '', rotulo }: { texto: string | (() => string); escuro?: boolean; className?: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(typeof texto === 'function' ? texto() : texto)
        setCopiado(true)
        window.setTimeout(() => setCopiado(false), 1600)
      }}
      aria-label={copiado ? 'Copiado' : rotulo ?? 'Copiar'}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition ${
        escuro ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'border border-line bg-panel text-soft hover:border-primary/40 hover:text-ink'
      } ${className}`}
    >
      {copiado ? (
        <svg key="ok" aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="docs-copiado">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <svg key="copiar" aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="8" width="12" height="12" rx="2.5" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      )}
      {rotulo && <span>{copiado ? 'Copiado' : rotulo}</span>}
    </button>
  )
}

/** Abas de conteúdo, com a barra deslizando até a aba escolhida. */
export function Abas({ itens }: { itens: { rotulo: string; conteudo: ReactNode }[] }) {
  const [ativa, setAtiva] = useState(0)
  const botoes = useRef<(HTMLButtonElement | null)[]>([])
  const [marca, setMarca] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const botao = botoes.current[ativa]
    if (botao) setMarca({ left: botao.offsetLeft, width: botao.offsetWidth })
  }, [ativa])

  return (
    <div>
      <div role="tablist" className="relative flex gap-6 border-b border-line">
        {itens.map((item, indice) => (
          <button
            key={item.rotulo}
            ref={(elemento) => {
              botoes.current[indice] = elemento
            }}
            type="button"
            role="tab"
            aria-selected={indice === ativa}
            onClick={() => setAtiva(indice)}
            className={`pb-2.5 text-[14.5px] font-medium transition ${indice === ativa ? 'text-ink' : 'text-dim hover:text-soft'}`}
          >
            {item.rotulo}
          </button>
        ))}
        <span aria-hidden className="docs-abas-marca absolute -bottom-px h-0.5 rounded-full bg-primary" style={marca} />
      </div>
      <div role="tabpanel" className="pt-5">
        {itens[ativa]?.conteudo}
      </div>
    </div>
  )
}
