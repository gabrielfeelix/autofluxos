'use client'

import { useRef, useState } from 'react'
import type { ErroDaLinha } from '@/core/importar-produtos'
import { acaoImportarProdutos, acaoPreverImportacao, type Previa } from '@/server/acoes-importar-produtos'

type Etapa =
  | { tipo: 'escolher' }
  | { tipo: 'previa'; previa: Previa }
  | {
      tipo: 'feito'
      criados: number
      atualizados: number
      erros: ErroDaLinha[]
    }

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

/**
 * Importar o catálogo de uma planilha, em três passos: escolher o arquivo, ver
 * a prévia (o que entra, o que atualiza, que linha tem erro e por quê) e
 * confirmar. Nada é gravado antes da confirmação.
 *
 * O arquivo fica guardado aqui entre a prévia e a confirmação e vai de novo
 * para o servidor, que lê outra vez em vez de confiar na prévia (ver
 * `server/acoes-importar-produtos.ts`).
 */
export function ImportarPlanilha({ clienteId }: { clienteId: string }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'escolher' })
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  // `dragenter`/`dragleave` disparam a cada filho cruzado; a conta de
  // profundidade evita o destaque piscar ao passar por cima do texto.
  const profundidade = useRef(0)

  function abrir() {
    setArquivo(null)
    setEtapa({ tipo: 'escolher' })
    setErro(null)
    dialogo.current?.showModal()
  }

  function fechar() {
    if (pendente) return
    dialogo.current?.close()
  }

  function dados(): FormData {
    const f = new FormData()
    if (arquivo) f.set('arquivo', arquivo)
    return f
  }

  async function prever(escolhido: File) {
    setArquivo(escolhido)
    // O servidor recusa acima de 3 MB, mas o Next corta antes, em 4 MB, com
    // erro que não chega aqui como frase.
    if (escolhido.size > 3 * 1024 * 1024) {
      setErro('o arquivo passa de 3 MB; divida em partes')
      return
    }
    setErro(null)
    setPendente(true)
    try {
      const f = new FormData()
      f.set('arquivo', escolhido)
      const r = await acaoPreverImportacao(clienteId, f)
      if (r.ok) setEtapa({ tipo: 'previa', previa: r.previa })
      else setErro(r.erro)
    } catch {
      setErro('não deu para ler o arquivo agora, tente de novo')
    } finally {
      setPendente(false)
    }
  }

  async function importar() {
    setErro(null)
    setPendente(true)
    try {
      const r = await acaoImportarProdutos(clienteId, dados())
      if (r.ok)
        setEtapa({
          tipo: 'feito',
          criados: r.criados,
          atualizados: r.atualizados,
          erros: r.erros,
        })
      else setErro(r.erro)
    } catch {
      setErro('não deu para importar agora; nada foi perdido, tente de novo')
    } finally {
      setPendente(false)
    }
  }

  const nada = etapa.tipo === 'previa' && etapa.previa.criar + etapa.previa.atualizar === 0

  return (
    <>
      <button type="button" onClick={abrir} className="app-secondary-button px-3 py-1.5 text-[11.5px]">
        Importar
      </button>
      <dialog
        ref={dialogo}
        aria-label="Importar planilha"
        onCancel={(evento) => {
          evento.preventDefault()
          fechar()
        }}
        onClick={(evento) => {
          if (evento.target === dialogo.current) fechar()
        }}
        onDragEnter={(e) => {
          if (!ehArrastoDeArquivo(e) || etapa.tipo !== 'escolher') return
          e.preventDefault()
          profundidade.current += 1
          setArrastando(true)
        }}
        onDragOver={(e) => {
          // Sem cancelar o `dragover` o navegador recusa o soltar e abre o
          // arquivo numa aba nova por cima do painel.
          if (!ehArrastoDeArquivo(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = etapa.tipo === 'escolher' ? 'copy' : 'none'
        }}
        onDragLeave={(e) => {
          if (!ehArrastoDeArquivo(e)) return
          profundidade.current = Math.max(0, profundidade.current - 1)
          if (profundidade.current === 0) setArrastando(false)
        }}
        onDrop={(e) => {
          if (!ehArrastoDeArquivo(e)) return
          e.preventDefault()
          profundidade.current = 0
          setArrastando(false)
          const solto = e.dataTransfer.files[0]
          if (solto && etapa.tipo === 'escolher' && !pendente) void prever(solto)
        }}
        className="app-dialog m-auto w-[min(520px,92vw)] rounded-[18px] border border-line bg-panel p-[26px] text-ink shadow-[0_40px_100px_rgba(19,25,34,0.132)]"
      >
        <h2 className="text-[17px] font-bold">Importar planilha</h2>

        {etapa.tipo === 'escolher' && (
          <>
            <p className="mt-1 mb-5 text-[12.5px] leading-6 text-muted">
              Uma linha por item, só o nome é obrigatório. Item que já existe (mesmo SKU ou nome) é
              atualizado, e célula em branco não apaga nada.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-dim">Modelo para preencher:</span>
              <a
                href="/api/modelos/produtos?formato=xlsx"
                className="app-secondary-button px-3 py-1.5 text-[11.5px]"
              >
                Excel (.xlsx)
              </a>
              <a
                href="/api/modelos/produtos?formato=csv"
                className="app-secondary-button px-3 py-1.5 text-[11.5px]"
              >
                CSV
              </a>
            </div>
            <label
              className={
                arrastando
                  ? 'flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/[0.06] px-4 py-9 text-center'
                  : 'flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line px-4 py-9 text-center transition hover:border-primary/40 hover:bg-primary/[0.03]'
              }
            >
              <span className="text-2xl leading-none" aria-hidden>
                📄
              </span>
              <span className="text-[13.5px] font-semibold text-ink">
                {pendente
                  ? 'Lendo a planilha…'
                  : arrastando
                    ? 'Solte para ler a planilha'
                    : 'Arraste a planilha para cá'}
              </span>
              <span className="text-[12px] text-dim">
                {arquivo && !arrastando ? arquivo.name : 'ou clique para escolher, .xlsx ou .csv'}
              </span>
              <input
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={pendente}
                onChange={(e) => {
                  const escolhido = e.target.files?.[0]
                  e.target.value = ''
                  if (escolhido) void prever(escolhido)
                }}
              />
            </label>
            <p className="mt-2 text-[11px] leading-5 text-dim">
              Preço aceita 1.299,90 ou 1299.90. Foto e link precisam começar com https://.
            </p>
          </>
        )}

        {etapa.tipo === 'previa' && (
          <>
            <p className="mt-1 mb-4 text-[12.5px] leading-6 text-muted">
              {arquivo?.name}. Nada foi gravado ainda.
            </p>
            <ul className="mb-4 space-y-2 text-[13px]">
              <li>
                <strong>{plural(etapa.previa.criar, 'item novo', 'itens novos')}</strong>
                {etapa.previa.exemplosCriar.length > 0 && (
                  <span className="text-dim">
                    {' '}
                    ({etapa.previa.exemplosCriar.join(', ')}
                    {etapa.previa.criar > 5 ? '…' : ''})
                  </span>
                )}
              </li>
              <li>
                <strong>{plural(etapa.previa.atualizar, 'item atualizado', 'itens atualizados')}</strong>
                {etapa.previa.exemplosAtualizar.length > 0 && (
                  <span className="text-dim">
                    {' '}
                    ({etapa.previa.exemplosAtualizar.join(', ')}
                    {etapa.previa.atualizar > 5 ? '…' : ''})
                  </span>
                )}
              </li>
              <li className={etapa.previa.erros.length > 0 ? 'text-perigo' : ''}>
                <strong>{plural(etapa.previa.erros.length, 'linha com erro', 'linhas com erro')}</strong>
                {etapa.previa.erros.length > 0 && <span> (ficam de fora, o resto entra)</span>}
              </li>
            </ul>
            <ListaDeErros erros={etapa.previa.erros} />
          </>
        )}

        {etapa.tipo === 'feito' && (
          <>
            <p className="mt-1 mb-4 text-[13px] leading-6">
              Pronto: {plural(etapa.criados, 'item criado', 'itens criados')} e{' '}
              {plural(etapa.atualizados, 'atualizado', 'atualizados')}.
            </p>
            <ListaDeErros erros={etapa.erros} />
          </>
        )}

        {erro && (
          <p
            role="alert"
            className="mt-4 rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2.5 text-[12px] leading-5 text-perigo"
          >
            {erro}
          </p>
        )}

        <div className="flex gap-2.5 pt-5">
          {etapa.tipo === 'previa' ? (
            <>
              <button
                type="button"
                disabled={pendente}
                onClick={() => {
                  setArquivo(null)
                  setEtapa({ tipo: 'escolher' })
                }}
                className="app-secondary-button flex-1 py-2.5 text-[13px]"
              >
                Outro arquivo
              </button>
              <button
                type="button"
                disabled={pendente || nada}
                onClick={() => void importar()}
                className="app-primary-button flex-1 py-2.5 text-[13px] disabled:opacity-50"
              >
                {pendente ? 'Importando…' : 'Importar'}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pendente}
              onClick={fechar}
              className="app-secondary-button flex-1 py-2.5 text-[13px]"
            >
              {etapa.tipo === 'feito' ? 'Fechar' : 'Cancelar'}
            </button>
          )}
        </div>
      </dialog>
    </>
  )
}

function ListaDeErros({ erros }: { erros: ErroDaLinha[] }) {
  if (erros.length === 0) return null
  return (
    <ul className="max-h-[220px] overflow-y-auto rounded-[12px] border border-line text-[12px] leading-5">
      {erros.map((e) => (
        <li
          key={`${e.linha}-${e.motivo}`}
          className="flex gap-3 border-b border-line px-3 py-2 last:border-0"
        >
          <span className="shrink-0 tabular-nums text-dim">linha {e.linha}</span>
          <span>{e.motivo}</span>
        </li>
      ))}
    </ul>
  )
}

function ehArrastoDeArquivo(evento: React.DragEvent) {
  return Array.from(evento.dataTransfer?.types ?? []).includes('Files')
}
