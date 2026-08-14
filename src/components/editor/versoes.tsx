'use client'

import { useRef, useState } from 'react'

export type VersaoNaLista = {
  id: string
  versao: number
  /** Já formatado no servidor — data calculada aqui divergiria na hidratação. */
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
 */
export function Versoes({
  versoes,
  publicadaId,
  voltando,
  aoVoltar,
}: {
  versoes: VersaoNaLista[]
  publicadaId: string | null
  /** Id da versão sendo republicada agora, ou `null`. */
  voltando: string | null
  /** Devolve `true` quando a volta deu certo — aí o diálogo fecha sozinho. */
  aoVoltar: (versaoId: string) => Promise<boolean>
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  function fechar() {
    setConfirmando(null)
    dialogo.current?.close()
  }

  async function voltar(versaoId: string) {
    const deuCerto = await aoVoltar(versaoId)
    if (deuCerto) fechar()
    else setConfirmando(null)
  }

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
        onClose={() => setConfirmando(null)}
        className="app-dialog m-auto w-[440px] rounded-[18px] border border-white/10 bg-panel p-[26px] text-ink shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
      >
        <h2 className="text-[17px] font-bold">Histórico de publicações</h2>
        <p className="mt-1 mb-5 text-[12.5px] leading-6 text-muted">
          Cada publicação vira uma versão que não muda mais. Voltar para uma antiga publica o
          desenho dela como uma versão nova — o histórico só cresce.
        </p>

        {versoes.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-white/[0.15] px-3 py-4 text-center text-[12px] text-muted">
            Esta automação ainda não foi publicada nenhuma vez.
          </p>
        ) : (
          <ul className="max-h-[320px] space-y-2 overflow-y-auto">
            {versoes.map((v) => {
              const noAr = v.id === publicadaId
              const emConfirmacao = confirmando === v.id
              const republicando = voltando === v.id

              return (
                <li
                  key={v.id}
                  className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13px] font-bold">v{v.versao}</span>
                    <span className="text-[11.5px] text-dim">{v.quando}</span>
                    <span className="flex-1" />
                    {noAr ? (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-0.5 text-[11px] text-emerald-300">
                        No ar
                      </span>
                    ) : (
                      !emConfirmacao && (
                        <button
                          type="button"
                          disabled={voltando !== null}
                          onClick={() => setConfirmando(v.id)}
                          className="app-secondary-button px-2.5 py-1 text-[11px]"
                        >
                          Voltar para esta
                        </button>
                      )
                    )}
                  </div>

                  {emConfirmacao && (
                    <div className="mt-2.5 border-t border-white/[0.07] pt-2.5">
                      <p className="text-[12px] leading-5 text-muted">
                        A v{v.versao} vai ao ar como versão nova e passa a atender as conversas que
                        começarem a partir de agora. Quem já estava conversando termina na versão em
                        que começou.
                      </p>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmando(null)}
                          disabled={republicando}
                          className="app-secondary-button flex-1 px-3 py-1.5 text-[11.5px]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => voltar(v.id)}
                          disabled={republicando}
                          className="app-primary-button flex-[1.35] px-3 py-1.5 text-[11.5px]"
                        >
                          {republicando ? 'publicando…' : `Publicar a v${v.versao} de novo`}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={fechar}
          className="app-secondary-button mt-5 w-full px-4 py-2.5 text-[13px]"
        >
          Fechar
        </button>
      </dialog>
    </>
  )
}
