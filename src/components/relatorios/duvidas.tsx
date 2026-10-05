'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { chaveDaPergunta, type ResolvidaPor } from '@/core/duvidas'
import { quando } from '@/lib/quando'
import { acaoEnsinarResposta, acaoRenomearTema } from '@/server/acoes-duvidas'
import { CaixaDoBloco, Vazio } from './graficos'

/*
 * Os dois cards de dúvidas do relatório de atendimento.
 *
 * "Principais dúvidas" responde o que os clientes perguntam e onde a IA perde;
 * "Perguntas que a IA não soube" é a mesma resposta virada em tarefa: cada
 * linha tem o botão que fecha a lacuna. É o ciclo do Fin (Intercom) e do
 * Gorgias: lacuna vista no relatório, ensinada dali mesmo.
 */

type Contagem = Record<ResolvidaPor, number>

const COR: Record<ResolvidaPor, string> = {
  ia: 'bg-primary',
  equipe: 'bg-[var(--serie-3)]',
  ninguem: 'bg-amber-400',
}

/** A barra de quem respondeu: as três partes somam a dúvida inteira, sem "%" solto. */
function BarraDeQuemResolveu({ contagem, total, largura }: { contagem: Contagem; total: number; largura: number }) {
  return (
    <span className="flex h-1.5 overflow-hidden rounded-full bg-surface" style={{ width: `${Math.max(largura * 100, 6)}%` }}>
      {(['ia', 'equipe', 'ninguem'] as const).map((quem) =>
        contagem[quem] > 0 ? (
          <span key={quem} className={COR[quem]} style={{ width: `${(contagem[quem] / total) * 100}%` }} />
        ) : null,
      )}
    </span>
  )
}

function Legenda({ contagem }: { contagem: Contagem }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-dim">
      <span>
        <i aria-hidden className={`mr-1 inline-block size-1.5 rounded-full align-middle ${COR.ia}`} />
        IA {contagem.ia}
      </span>
      <span>
        <i aria-hidden className={`mr-1 inline-block size-1.5 rounded-full align-middle ${COR.equipe}`} />
        Equipe {contagem.equipe}
      </span>
      {contagem.ninguem > 0 && (
        <span className="font-semibold text-aviso">
          <i aria-hidden className={`mr-1 inline-block size-1.5 rounded-full align-middle ${COR.ninguem}`} />
          Sem resposta {contagem.ninguem}
        </span>
      )}
    </span>
  )
}

const vazia = (): Contagem => ({ ia: 0, equipe: 0, ninguem: 0 })

// ---------------------------------------------------------------------------
// Principais dúvidas
// ---------------------------------------------------------------------------

export type DuvidaParaTela = {
  categoria: string
  tema: string
  pergunta: string
  resolvidaPor: ResolvidaPor
  contatoId: string
  em: string
}

type Tema = { tema: string; n: number; contagem: Contagem; exemplos: { pergunta: string; contatoId: string }[] }
type Categoria = { categoria: string; n: number; contagem: Contagem; temas: Tema[] }

function agrupar(duvidas: readonly DuvidaParaTela[], renomeados: Map<string, string>): Categoria[] {
  const porCategoria = new Map<string, Map<string, Tema>>()
  for (const d of duvidas) {
    const tema = renomeados.get(`${d.categoria}|${d.tema}`) ?? d.tema
    const temas = porCategoria.get(d.categoria) ?? new Map<string, Tema>()
    porCategoria.set(d.categoria, temas)
    const t = temas.get(tema) ?? { tema, n: 0, contagem: vazia(), exemplos: [] }
    t.n += 1
    t.contagem[d.resolvidaPor] += 1
    if (t.exemplos.length < 3 && !t.exemplos.some((e) => chaveDaPergunta(e.pergunta) === chaveDaPergunta(d.pergunta))) {
      t.exemplos.push({ pergunta: d.pergunta, contatoId: d.contatoId })
    }
    temas.set(tema, t)
  }
  return [...porCategoria]
    .map(([categoria, temas]) => {
      const lista = [...temas.values()].sort((a, b) => b.n - a.n)
      const contagem = vazia()
      for (const t of lista) for (const q of ['ia', 'equipe', 'ninguem'] as const) contagem[q] += t.contagem[q]
      return { categoria, n: lista.reduce((s, t) => s + t.n, 0), contagem, temas: lista }
    })
    .sort((a, b) => b.n - a.n)
}

export function PrincipaisDuvidas({
  clienteId,
  duvidas,
  podeEditar,
}: {
  clienteId: string
  duvidas: DuvidaParaTela[]
  podeEditar: boolean
}) {
  // Renomear aparece na hora, sem recarregar a página (ação otimista).
  const [renomeados, setRenomeados] = useState(() => new Map<string, string>())
  const categorias = useMemo(() => agrupar(duvidas, renomeados), [duvidas, renomeados])
  const [aberta, setAberta] = useState<string | null>(null)
  const maior = Math.max(1, ...categorias.map((c) => c.n))
  const total = categorias.reduce((s, c) => s + c.n, 0)

  return (
    <CaixaDoBloco
      titulo="Principais dúvidas"
      subtitulo={
        total > 0
          ? `${total} ${total === 1 ? 'dúvida' : 'dúvidas'} no período, por categoria. Clique numa categoria para ver os temas.`
          : 'O que os clientes perguntam, por categoria, e quem respondeu.'
      }
    >
      {total === 0 ? (
        <Vazio desenho="motivos">
          As dúvidas aparecem aqui depois da passada noturna, que lê as conversas encerradas, inclusive as dos
          últimos 90 dias.
        </Vazio>
      ) : (
        <ul className="-mx-5 mt-1 flex flex-col">
          {categorias.map((c) => {
            const expandida = aberta === c.categoria
            return (
              <li key={c.categoria} className="border-t border-line-soft first:border-t-0">
                <button
                  type="button"
                  aria-expanded={expandida}
                  onClick={() => setAberta(expandida ? null : c.categoria)}
                  className="flex w-full flex-col gap-1.5 px-5 py-2.5 text-left transition hover:bg-surface"
                >
                  <span className="flex w-full items-baseline gap-2">
                    <span
                      aria-hidden
                      className={`text-[10px] text-dim transition ${expandida ? 'rotate-90' : ''}`}
                    >
                      ▶
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{c.categoria}</span>
                    <span className="text-[13px] font-bold tabular-nums">{c.n}</span>
                  </span>
                  <span className="pl-4">
                    <BarraDeQuemResolveu contagem={c.contagem} total={c.n} largura={c.n / maior} />
                  </span>
                </button>
                {expandida && (
                  <ul className="flex flex-col gap-1 bg-surface/50 px-5 pt-1 pb-3">
                    {c.temas.map((t) => (
                      <LinhaDoTema
                        key={t.tema}
                        clienteId={clienteId}
                        categoria={c.categoria}
                        tema={t}
                        outros={c.temas.filter((o) => o.tema !== t.tema).map((o) => o.tema)}
                        podeEditar={podeEditar}
                        aoRenomear={(para) =>
                          setRenomeados((antes) => {
                            const novo = new Map(antes)
                            // Quem já apontava para o nome velho segue o novo.
                            for (const [chave, valor] of novo) if (valor === t.tema && chave.startsWith(`${c.categoria}|`)) novo.set(chave, para)
                            novo.set(`${c.categoria}|${t.tema}`, para)
                            return novo
                          })
                        }
                      />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </CaixaDoBloco>
  )
}

function LinhaDoTema({
  clienteId,
  categoria,
  tema,
  outros,
  podeEditar,
  aoRenomear,
}: {
  clienteId: string
  categoria: string
  tema: Tema
  outros: string[]
  podeEditar: boolean
  aoRenomear: (para: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(tema.tema)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, comecar] = useTransition()
  const lista = `temas-${categoria}`

  const salvar = () => {
    const para = nome.trim().toLowerCase()
    if (!para || para === tema.tema) return setEditando(false)
    setErro(null)
    aoRenomear(para)
    setEditando(false)
    comecar(async () => {
      const r = await acaoRenomearTema(clienteId, categoria, tema.tema, para).catch(() => ({ erro: 'sem conexão' }))
      if (r.erro) setErro(r.erro)
    })
  }

  return (
    <li className="rounded-[10px] bg-panel px-3 py-2.5">
      <div className="flex items-center gap-2">
        {editando ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <input
              autoFocus
              list={lista}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvar()
                if (e.key === 'Escape') setEditando(false)
              }}
              aria-label="Novo nome do tema"
              className="app-field min-w-0 flex-1 px-2 py-1 text-[12px]"
            />
            <datalist id={lista}>
              {outros.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
            <button type="button" onClick={salvar} disabled={salvando} className="botao-secundario botao-sm">
              Salvar
            </button>
            <button
              type="button"
              aria-label="Cancelar"
              onClick={() => {
                setNome(tema.tema)
                setEditando(false)
              }}
              className="grid size-[28px] place-items-center rounded-lg text-[15px] text-dim hover:bg-surface hover:text-ink"
            >
              ×
            </button>
          </span>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-[12.5px] font-semibold first-letter:uppercase">{tema.tema}</span>
            {podeEditar && (
              <button
                type="button"
                onClick={() => setEditando(true)}
                title="Renomear, ou escolher outro tema para juntar os dois"
                className="text-[11px] font-semibold text-dim hover:text-primary"
              >
                Renomear
              </button>
            )}
            <span className="text-[12.5px] font-bold tabular-nums">{tema.n}</span>
          </>
        )}
      </div>
      <div className="mt-1.5">
        <Legenda contagem={tema.contagem} />
      </div>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {tema.exemplos.map((e) => (
          <li key={e.pergunta} className="flex items-baseline gap-2 text-[11.5px] leading-5 text-muted">
            <span className="min-w-0 flex-1">“{e.pergunta}”</span>
            <Link
              href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(e.contatoId)}`}
              className="shrink-0 text-[11px] font-semibold text-primary hover:underline"
            >
              conversa
            </Link>
          </li>
        ))}
      </ul>
      {erro && (
        <p role="alert" className="mt-1 text-[11px] text-perigo">
          {erro}
        </p>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Perguntas que a IA não respondeu
// ---------------------------------------------------------------------------

export type PerguntaParaTela = {
  contatoId: string
  pergunta: string
  respostaDaEquipe: string | null
  em: string
}

type Lacuna = PerguntaParaTela & { chave: string; vezes: number }

const NA_PRIMEIRA_TELA = 6

export function PerguntasSemResposta({
  clienteId,
  perguntas,
  podeEditar,
}: {
  clienteId: string
  perguntas: PerguntaParaTela[]
  podeEditar: boolean
}) {
  // A mesma pergunta escrita quase igual vira uma linha com "×3". A lista
  // chega da mais nova para a mais antiga, então a primeira de cada grupo é a
  // mais recente; a resposta da equipe é a primeira que existir no grupo.
  const lacunas = useMemo(() => {
    const porChave = new Map<string, Lacuna>()
    for (const p of perguntas) {
      const chave = chaveDaPergunta(p.pergunta)
      const ja = porChave.get(chave)
      if (ja) {
        ja.vezes += 1
        ja.respostaDaEquipe ??= p.respostaDaEquipe
      } else porChave.set(chave, { ...p, chave, vezes: 1 })
    }
    return [...porChave.values()].sort((a, b) => b.vezes - a.vezes || b.em.localeCompare(a.em))
  }, [perguntas])
  const [todas, setTodas] = useState(false)
  const [ensinadas, setEnsinadas] = useState<Set<string>>(() => new Set())
  const visiveis = todas ? lacunas : lacunas.slice(0, NA_PRIMEIRA_TELA)

  return (
    <CaixaDoBloco
      titulo="Perguntas que a IA não respondeu"
      subtitulo="Ficaram com a equipe ou sem resposta. Ensine a resposta e a IA passa a responder sozinha na próxima conversa."
    >
      {lacunas.length === 0 ? (
        <Vazio desenho="nps">Nenhuma pergunta ficou sem resposta da IA neste período.</Vazio>
      ) : (
        <>
          <ul className="-mx-5 mt-1 flex flex-col">
            {visiveis.map((l) => (
              <LinhaDaLacuna
                key={l.chave}
                clienteId={clienteId}
                lacuna={l}
                podeEditar={podeEditar}
                ensinada={ensinadas.has(l.chave)}
                aoEnsinar={() => setEnsinadas((antes) => new Set(antes).add(l.chave))}
              />
            ))}
          </ul>
          {lacunas.length > NA_PRIMEIRA_TELA && (
            <button type="button" onClick={() => setTodas((v) => !v)} className="crm-edit mt-3 self-start">
              {todas ? 'Mostrar menos' : `Ver todas as ${lacunas.length}`}
            </button>
          )}
        </>
      )}
    </CaixaDoBloco>
  )
}

function LinhaDaLacuna({
  clienteId,
  lacuna,
  podeEditar,
  ensinada,
  aoEnsinar,
}: {
  clienteId: string
  lacuna: Lacuna
  podeEditar: boolean
  ensinada: boolean
  aoEnsinar: () => void
}) {
  const [aberta, setAberta] = useState(false)
  const [pergunta, setPergunta] = useState(lacuna.pergunta)
  const [resposta, setResposta] = useState(lacuna.respostaDaEquipe ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, comecar] = useTransition()

  return (
    <li className="border-t border-line-soft px-5 py-2.5 first:border-t-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12.5px] leading-5 text-soft">“{lacuna.pergunta}”</p>
          <p className="mt-0.5 text-[11px] text-dim">
            {lacuna.vezes > 1 && <strong className="text-aviso">{lacuna.vezes} vezes · </strong>}
            {quando(lacuna.em)} ·{' '}
            <Link
              href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(lacuna.contatoId)}`}
              className="font-semibold text-primary hover:underline"
            >
              ver conversa
            </Link>
          </p>
        </div>
        {ensinada ? (
          <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-ok">
            ✓ ensinada
          </span>
        ) : (
          podeEditar &&
          !aberta && (
            <button type="button" onClick={() => setAberta(true)} className="botao-secundario botao-sm shrink-0">
              Ensinar a resposta
            </button>
          )
        )}
      </div>

      {aberta && !ensinada && (
        <form
          className="mt-2.5 flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault()
            setErro(null)
            comecar(async () => {
              const r = await acaoEnsinarResposta(clienteId, pergunta, resposta).catch(() => ({ erro: 'sem conexão' }))
              if (r.erro) setErro(r.erro)
              else {
                aoEnsinar()
                setAberta(false)
              }
            })
          }}
        >
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
            Pergunta
            <input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              className="app-field px-2.5 py-1.5 text-[12.5px] font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
            Resposta que a IA vai usar
            <textarea
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={3}
              placeholder="Exemplo: Abrimos aos sábados das 9h às 12h."
              className="app-field resize-y px-2.5 py-1.5 text-[12.5px] leading-5 font-normal"
            />
          </label>
          {lacuna.respostaDaEquipe && (
            <p className="text-[10.5px] leading-4 text-dim">Preenchida com o que a equipe respondeu nesta conversa. Revise antes de salvar.</p>
          )}
          {erro && (
            <p role="alert" className="text-[11px] text-perigo">
              {erro}
            </p>
          )}
          <span className="flex justify-end gap-2">
            <button type="button" onClick={() => setAberta(false)} className="botao-secundario botao-sm">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="botao-primario botao-sm">
              {salvando ? 'Salvando…' : 'Salvar no conhecimento'}
            </button>
          </span>
        </form>
      )}
    </li>
  )
}
