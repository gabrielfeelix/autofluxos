'use client'

import { useRef, useState } from 'react'
import { compararGrafos, resumoDaComparacao } from '@/core/flow/comparar'
import type { Fluxo } from '@/core/flow/schema'
import { acaoGrafoDaVersao } from '@/server/acoes'
import { GrafoDeLeitura } from './grafo-de-leitura'

export type VersaoNaLista = {
  id: string
  versao: number
  /** Já formatado no servidor, data calculada aqui divergiria na hidratação. */
  quando: string
}

/**
 * O histórico de publicações da automação.
 *
 * As versões já eram imutáveis no banco desde o começo e **nenhuma tela as
 * mostrava**: publicar errado só tinha saída redesenhando, com o desenho ruim no
 * ar enquanto isso. Esta lista é a rede de segurança que faltava para publicar
 * sem medo.
 *
 * Voltar exige confirmar na própria linha, e não num `confirm()` do navegador:
 * a frase precisa dizer *qual* versão vai ao ar, e o diálogo nativo não deixa
 * escrever isso sem virar texto genérico que ninguém lê.
 *
 * Desde a A12, cada versão tem "Ver" (o desenho dela, só leitura, com o que
 * mudou pintado) e a confirmação diz o que muda em relação ao rascunho atual:
 * voltar sem saber o que se perde era voltar no escuro.
 */
export function Versoes({
  versoes,
  publicadaId,
  voltando,
  aoVoltar,
  clienteId,
  fluxoId,
  rascunho,
}: {
  versoes: VersaoNaLista[]
  publicadaId: string | null
  voltando: string | null
  aoVoltar: (versaoId: string) => Promise<boolean>
  clienteId: string
  fluxoId: string
  /** O desenho que está na tela agora, o ponto de partida da comparação. */
  rascunho: Fluxo
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [vendo, setVendo] = useState<string | null>(null)
  const [grafos, setGrafos] = useState<Record<string, Fluxo>>({})
  const [carregando, setCarregando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const proxima = Math.max(0, ...versoes.map((v) => v.versao)) + 1

  function fechar() {
    setConfirmando(null)
    setVendo(null)
    dialogo.current?.close()
  }

  async function carregar(versaoId: string): Promise<boolean> {
    if (grafos[versaoId]) return true
    setErro(null)
    setCarregando(versaoId)
    try {
      const r = await acaoGrafoDaVersao(clienteId, fluxoId, versaoId)
      if (!r.ok) {
        setErro(r.erro)
        return false
      }
      setGrafos((atuais) => ({ ...atuais, [versaoId]: r.grafo }))
      return true
    } catch {
      setErro('não deu para abrir esta versão agora')
      return false
    } finally {
      setCarregando(null)
    }
  }

  async function ver(versaoId: string) {
    if (await carregar(versaoId)) {
      setConfirmando(null)
      setVendo(versaoId)
    }
  }

  async function pedirConfirmacao(versaoId: string) {
    setConfirmando(versaoId)
    await carregar(versaoId)
  }

  async function voltar(versaoId: string) {
    const deuCerto = await aoVoltar(versaoId)
    if (deuCerto) fechar()
    else setConfirmando(null)
  }

  const aberta = vendo ? versoes.find((v) => v.id === vendo) : undefined
  const grafoAberto = vendo ? grafos[vendo] : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        title="Ver o histórico de publicações desta automação"
        className="app-secondary-button px-3 py-1.5 text-[11.5px]"
      >
        Histórico
      </button>

      <dialog
        ref={dialogo}
        aria-label="Histórico de publicações"
        onClick={(evento) => {
          if (evento.target === dialogo.current) fechar()
        }}
        onClose={() => {
          setConfirmando(null)
          setVendo(null)
        }}
        className={`app-dialog m-auto rounded-[18px] border border-line bg-panel p-[26px] text-ink shadow-[0_40px_100px_rgba(19,25,34,0.132)] ${
          aberta ? 'w-[min(1080px,94vw)]' : 'w-[min(440px,94vw)]'
        }`}
      >
        {aberta && grafoAberto ? (
          <>
            <button
              type="button"
              onClick={() => setVendo(null)}
              className="mb-2 text-[12px] font-semibold text-primary hover:underline"
            >
              ‹ Histórico
            </button>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[17px] font-bold">v{aberta.versao}</h2>
              <span className="text-[12px] text-dim">{aberta.quando}</span>
              {aberta.id === publicadaId && (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-0.5 text-[11px] text-ok">
                  No ar
                </span>
              )}
              <span className="flex-1" />
              <span className="flex items-center gap-3 text-[11px] text-dim">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm ring-2 ring-emerald-400" /> volta
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm ring-2 ring-amber-400" /> muda
                </span>
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              Só leitura. Pintado o que é diferente do rascunho que está na tela agora.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_260px]">
              <div className="h-[min(460px,55vh)] overflow-hidden rounded-[12px] border border-line bg-surface">
                <GrafoDeLeitura fluxo={grafoAberto} comparacao={compararGrafos(rascunho, grafoAberto)} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.04em] text-soft uppercase">
                  Se voltar para esta
                </p>
                <ResumoDoQueMuda
                  linhas={resumoDaComparacao(compararGrafos(rascunho, grafoAberto), rascunho, grafoAberto)}
                />
                {aberta.id !== publicadaId &&
                  (confirmando === aberta.id ? (
                    <Confirmacao
                      v={aberta}
                      proxima={proxima}
                      rascunho={rascunho}
                      grafo={undefined}
                      carregando={carregando === aberta.id}
                      republicando={voltando === aberta.id}
                      aoCancelar={() => setConfirmando(null)}
                      aoConfirmar={() => voltar(aberta.id)}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={voltando !== null}
                      onClick={() => setConfirmando(aberta.id)}
                      className="app-secondary-button mt-3 w-full px-3 py-1.5 text-[11.5px]"
                    >
                      Voltar para esta
                    </button>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[17px] font-bold">Histórico de publicações</h2>
            <p className="mt-1 mb-5 text-[12.5px] leading-6 text-muted">
              Cada publicação vira uma versão que não muda mais. Voltar para uma antiga publica o
              desenho dela como uma versão nova, o histórico só cresce.
            </p>

            {versoes.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-strong px-3 py-4 text-center text-[12px] text-muted">
                Esta automação ainda não foi publicada nenhuma vez.
              </p>
            ) : (
              <ul className="max-h-[min(60vh,520px)] space-y-2 overflow-y-auto">
                {versoes.map((v) => {
                  const noAr = v.id === publicadaId
                  const emConfirmacao = confirmando === v.id

                  return (
                    <li key={v.id} className="rounded-[12px] border border-line bg-panel px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold">v{v.versao}</span>
                        <span className="text-[11.5px] text-dim">{v.quando}</span>
                        <span className="flex-1" />
                        {noAr && (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-0.5 text-[11px] text-ok">
                            No ar
                          </span>
                        )}
                        {!emConfirmacao && (
                          <button
                            type="button"
                            disabled={carregando !== null}
                            onClick={() => ver(v.id)}
                            title="Abrir o desenho desta versão, só para ler"
                            className="app-secondary-button px-2.5 py-1 text-[11px]"
                          >
                            {carregando === v.id ? 'abrindo…' : 'Ver'}
                          </button>
                        )}
                        {!noAr && !emConfirmacao && (
                          <button
                            type="button"
                            disabled={voltando !== null}
                            onClick={() => pedirConfirmacao(v.id)}
                            className="app-secondary-button px-2.5 py-1 text-[11px]"
                          >
                            Voltar para esta
                          </button>
                        )}
                      </div>

                      {emConfirmacao && (
                        <Confirmacao
                          v={v}
                          proxima={proxima}
                          rascunho={rascunho}
                          grafo={grafos[v.id]}
                          carregando={carregando === v.id}
                          republicando={voltando === v.id}
                          aoCancelar={() => setConfirmando(null)}
                          aoConfirmar={() => voltar(v.id)}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {erro && (
              <p role="alert" className="mt-3 text-[11.5px] text-perigo">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={fechar}
              className="app-secondary-button mt-5 w-full px-4 py-2.5 text-[13px]"
            >
              Fechar
            </button>
          </>
        )}
      </dialog>
    </>
  )
}

/** O que muda no rascunho ao voltar para esta versão, e a frase de confirmação. */
function Confirmacao({
  v,
  proxima,
  rascunho,
  grafo,
  carregando,
  republicando,
  aoCancelar,
  aoConfirmar,
}: {
  v: VersaoNaLista
  proxima: number
  rascunho: Fluxo
  grafo: Fluxo | undefined
  carregando: boolean
  republicando: boolean
  aoCancelar: () => void
  aoConfirmar: () => void
}) {
  return (
    <div className="mt-2.5 border-t border-line pt-2.5">
      <p className="text-[12px] leading-5 text-muted">
        A v{v.versao} vira a <strong className="text-ink">versão v{proxima}</strong>: só as
        conversas que começarem a partir de agora usam. Quem já estava conversando termina na
        versão em que começou. O desenho na tela passa a ser o dela.
      </p>
      {grafo ? (
        <ResumoDoQueMuda linhas={resumoDaComparacao(compararGrafos(rascunho, grafo), rascunho, grafo)} />
      ) : (
        carregando && <p className="mt-2 text-[11.5px] text-dim">conferindo o que muda…</p>
      )}
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={aoCancelar}
          disabled={republicando}
          className="app-secondary-button flex-1 px-3 py-1.5 text-[11.5px]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={republicando}
          className="app-primary-button flex-[1.35] px-3 py-1.5 text-[11.5px]"
        >
          {republicando ? 'publicando…' : `Publicar como v${proxima}`}
        </button>
      </div>
    </div>
  )
}

function ResumoDoQueMuda({ linhas }: { linhas: string[] }) {
  if (linhas.length === 0) {
    return (
      <p className="mt-2 text-[11.5px] leading-5 text-dim">
        Igual ao rascunho atual: nada muda no desenho.
      </p>
    )
  }
  return (
    <ul className="mt-2 max-h-[180px] space-y-1 overflow-y-auto">
      {linhas.map((linha, i) => (
        <li key={i} className="truncate text-[11.5px] leading-5 text-muted" title={linha}>
          {linha}
        </li>
      ))}
    </ul>
  )
}
