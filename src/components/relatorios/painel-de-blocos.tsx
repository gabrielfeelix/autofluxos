'use client'

import { useState, type ReactNode } from 'react'
import {
  escreverArranjo,
  moverBloco,
  nomeDoCookie,
  ordenarBlocos,
  type Arranjo,
  type PaginaDeAnalise,
} from '@/core/arranjo-de-blocos'
import './graficos.css'

export type LarguraDoBloco = 'terco' | 'metade' | 'dois-tercos' | 'inteira'

export type Bloco = {
  id: string
  titulo: string
  largura: LarguraDoBloco
  conteudo: ReactNode
}

// Doze colunas no computador; duas no tablet, onde terço e metade dividem a
// linha; uma no celular. `dense` deixa um bloco pequeno subir para o buraco
// que um escondido deixou.
const COLUNAS: Record<LarguraDoBloco, string> = {
  terco: 'lg:col-span-4',
  metade: 'lg:col-span-6',
  'dois-tercos': 'md:col-span-2 lg:col-span-8',
  inteira: 'md:col-span-2 lg:col-span-12',
}

/**
 * Os blocos de uma tela de Análise, com o "Personalizar": esconder, mostrar e
 * mudar a ordem. O conteúdo de cada bloco chega pronto do servidor; aqui só se
 * decide quais aparecem e onde, então mexer é instantâneo, sem ida ao servidor.
 *
 * O arranjo vai para um cookie a cada mudança (ver `core/arranjo-de-blocos.ts`)
 * e o servidor já desenha a próxima visita arrumada.
 */
export function PainelDeBlocos({
  pagina,
  blocos,
  arranjoInicial,
  barra,
}: {
  pagina: PaginaDeAnalise
  blocos: Bloco[]
  arranjoInicial: Arranjo
  barra?: ReactNode
}) {
  const padrao = blocos.map((b) => b.id)
  const [ordem, setOrdem] = useState(() => ordenarBlocos(padrao, arranjoInicial))
  const [ocultos, setOcultos] = useState(() => arranjoInicial.ocultos.filter((id) => padrao.includes(id)))
  const [editando, setEditando] = useState(false)

  const porId = new Map(blocos.map((b) => [b.id, b]))
  // Bloco que só existe para algumas pessoas (valor, equipe) entra e sai da
  // lista sem mexer no arranjo guardado.
  const ordemAtual = ordenarBlocos(padrao, { ordem, ocultos })
  const visiveis = ordemAtual.filter((id) => !ocultos.includes(id))
  const escondidos = ordemAtual.filter((id) => ocultos.includes(id))

  function guardar(novo: Arranjo) {
    setOrdem(novo.ordem)
    setOcultos(novo.ocultos)
    const vazio = novo.ocultos.length === 0 && novo.ordem.join() === padrao.join()
    gravarCookie(nomeDoCookie(pagina), vazio ? null : escreverArranjo(novo))
  }

  const esconder = (id: string) => guardar({ ordem: ordemAtual, ocultos: [...ocultos, id] })
  const mostrar = (id: string) => guardar({ ordem: ordemAtual, ocultos: ocultos.filter((o) => o !== id) })
  const mover = (id: string, direcao: -1 | 1) =>
    guardar({ ordem: moverBloco(ordemAtual, ocultos, id, direcao), ocultos })
  const restaurar = () => guardar({ ordem: padrao, ocultos: [] })

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">{barra}</div>
        <button
          type="button"
          onClick={() => setEditando((e) => !e)}
          aria-pressed={editando}
          className={`inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-lg px-3.5 text-[12.5px] font-semibold transition ${
            editando
              ? 'app-primary-button'
              : 'border border-line bg-panel text-soft shadow-sm hover:border-strong hover:text-ink'
          }`}
        >
          {editando ? <IconeFeito /> : <IconeBlocos />}
          {editando ? 'Pronto' : 'Personalizar'}
        </button>
      </div>

      {editando && (
        <section
          aria-label="Personalizar a tela"
          className="mt-4 rounded-xl border border-primary/25 bg-primary-weak px-4 py-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-[12.5px] leading-5 text-soft">
              <strong className="font-semibold text-ink">Arrume a tela do seu jeito.</strong> Use as setas de cada bloco
              para mudar a ordem e o <span aria-hidden>✕</span> para esconder. Fica guardado neste aparelho.
            </p>
            <button
              type="button"
              onClick={restaurar}
              className="text-[12px] font-semibold text-primary hover:underline"
            >
              Voltar ao padrão
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-semibold text-dim">
              {escondidos.length === 0 ? 'Nenhum bloco escondido.' : 'Escondidos:'}
            </span>
            {escondidos.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => mostrar(id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/45 bg-panel px-3 py-1 text-[12px] font-semibold text-primary transition hover:border-solid hover:bg-primary hover:text-primary-ink"
              >
                <span aria-hidden>+</span> {porId.get(id)?.titulo}
              </button>
            ))}
          </div>
        </section>
      )}

      {visiveis.length === 0 ? (
        <section className="app-card mt-5 px-5 py-14 text-center">
          <p className="text-[14px] font-semibold text-soft">Todos os blocos estão escondidos</p>
          <button type="button" onClick={restaurar} className="app-primary-button mt-4 h-9 px-4 text-[13px]">
            Mostrar todos
          </button>
        </section>
      ) : (
        <div className="mt-5 grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {visiveis.map((id, i) => {
            const bloco = porId.get(id)!
            return (
              <div
                key={id}
                className={`relative min-w-0 rounded-[14px] ${COLUNAS[bloco.largura]} ${editando ? 'bloco-editando' : ''} [&>*]:h-full`}
              >
                {bloco.conteudo}
                {editando && (
                  <div className="absolute inset-0 z-20 flex items-start justify-end rounded-[14px] bg-panel/35 p-2.5">
                    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5 shadow-md">
                      <BotaoDeControle rotulo={`Mover ${bloco.titulo} para antes`} desativado={i === 0} onClick={() => mover(id, -1)}>
                        <path d="M10 3.5 5.5 8l4.5 4.5" />
                      </BotaoDeControle>
                      <BotaoDeControle
                        rotulo={`Mover ${bloco.titulo} para depois`}
                        desativado={i === visiveis.length - 1}
                        onClick={() => mover(id, 1)}
                      >
                        <path d="m6 3.5 4.5 4.5L6 12.5" />
                      </BotaoDeControle>
                      <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />
                      <BotaoDeControle rotulo={`Esconder ${bloco.titulo}`} onClick={() => esconder(id)} perigo>
                        <path d="m4.5 4.5 7 7m0-7-7 7" />
                      </BotaoDeControle>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** `null` apaga: o arranjo padrão não precisa de cookie. */
function gravarCookie(nome: string, valor: string | null) {
  document.cookie = `${nome}=${valor ?? ''};path=/;max-age=${valor === null ? 0 : 31536000};samesite=lax`
}

function BotaoDeControle({
  rotulo,
  onClick,
  desativado,
  perigo,
  children,
}: {
  rotulo: string
  onClick: () => void
  desativado?: boolean
  perigo?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
      disabled={desativado}
      className={`flex size-7 items-center justify-center rounded-md text-soft transition disabled:opacity-30 ${
        perigo ? 'hover:bg-perigo/10 hover:text-perigo' : 'hover:bg-surface-strong hover:text-ink'
      }`}
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}

function IconeBlocos() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1.2" />
      <rect x="9" y="2" width="5" height="3" rx="1" />
      <rect x="9" y="7" width="5" height="7" rx="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
    </svg>
  )
}

function IconeFeito() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  )
}
