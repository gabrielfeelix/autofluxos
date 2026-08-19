'use client'

import { useRef, useState, useTransition } from 'react'
import {
  PRAZOS_DO_LINK,
  PRAZO_PADRAO,
  avisosDoCompartilhamento,
  type AvisoDoCompartilhamento,
} from '@/core/compartilhar'
import type { Fluxo } from '@/core/flow/schema'
import { acaoCriarLinkDoFluxo, acaoListarLinksDoFluxo, acaoRevogarLinkDoFluxo } from '@/server/acoes'

export type LinkNaLista = {
  id: string
  token: string
  expiraEm: string | null
  aberturas: number
  importacoes: number
  estado: 'valido' | 'revogado' | 'expirado'
}

/**
 * Compartilhar o fluxo por link.
 *
 * Mora ao lado de "Histórico", e não numa tela própria, porque é a mesma
 * matéria: as duas falam de **versões publicadas**. O link aponta para a versão
 * no ar — nunca para o rascunho —, e é por isso que o botão fica desabilitado
 * enquanto nada foi publicado, dizendo o motivo em vez de sumir.
 *
 * **Os avisos aparecem antes de o link existir, e não depois.** Compartilhar
 * manda para fora da conta o texto de todas as mensagens; descobrir isso depois
 * de mandar o link para um grupo é tarde. É a única coisa nesta tela que não
 * dá para reverter clicando em revogar.
 */
export function Compartilhar({
  clienteId,
  fluxoId,
  publicada,
}: {
  clienteId: string
  fluxoId: string
  /** O grafo no ar. `null` = nunca publicado, e aí não há o que compartilhar. */
  publicada: { versao: number; grafo: Fluxo } | null
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [links, setLinks] = useState<LinkNaLista[] | null>(null)
  const [prazo, setPrazo] = useState<string>(PRAZO_PADRAO)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const avisos: AvisoDoCompartilhamento[] = publicada
    ? avisosDoCompartilhamento(publicada.grafo)
    : []

  async function abrir() {
    dialogo.current?.showModal()
    setErro(null)
    try {
      const r = await acaoListarLinksDoFluxo(clienteId, fluxoId)
      setLinks((r.links ?? []) as LinkNaLista[])
    } catch {
      setErro('não deu para carregar os links')
      setLinks([])
    }
  }

  function criar() {
    setErro(null)
    comecar(async () => {
      try {
        const r = await acaoCriarLinkDoFluxo(clienteId, fluxoId, prazo)
        if (!r.ok || !r.link) {
          setErro(r.erro ?? 'não deu para criar o link')
          return
        }
        setLinks((atuais) => [r.link as LinkNaLista, ...(atuais ?? [])])
        await copiar(r.link.token)
      } catch {
        setErro('não deu para criar o link agora')
      }
    })
  }

  function revogar(linkId: string) {
    setErro(null)
    comecar(async () => {
      try {
        const r = await acaoRevogarLinkDoFluxo(clienteId, fluxoId, linkId)
        if (!r.ok) {
          setErro(r.erro ?? 'não deu para revogar')
          return
        }
        setLinks((atuais) =>
          (atuais ?? []).map((link) =>
            link.id === linkId ? { ...link, estado: 'revogado' as const } : link,
          ),
        )
      } catch {
        setErro('não deu para revogar agora')
      }
    })
  }

  async function copiar(token: string) {
    const endereco = `${window.location.origin}/f/${token}`
    try {
      await navigator.clipboard.writeText(endereco)
      setCopiado(token)
      // A confirmação some sozinha: um "copiado!" permanente vira parte do
      // layout e para de significar que alguma coisa acabou de acontecer.
      window.setTimeout(() => setCopiado((atual) => (atual === token ? null : atual)), 2000)
    } catch {
      // Área de transferência bloqueada (http, permissão negada). O endereço
      // continua visível no campo ao lado, então isto não é um beco sem saída.
      setErro('não deu para copiar automaticamente — selecione o endereço e copie')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={!publicada}
        title={
          publicada
            ? 'Gerar um link de leitura desta automação'
            : 'Publique primeiro — o link aponta para uma versão publicada, não para o rascunho'
        }
        className="app-secondary-button px-3 py-1.5 text-[11.5px] disabled:opacity-40"
      >
        Compartilhar
      </button>

      <dialog
        ref={dialogo}
        aria-label="Compartilhar por link"
        onClick={(evento) => {
          if (evento.target === dialogo.current) dialogo.current?.close()
        }}
        onClose={() => setCopiado(null)}
        className="app-dialog m-auto w-[min(560px,92vw)] rounded-[18px] border border-white/10 bg-panel text-ink shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
      >
        <div className="p-[26px]">
          <h2 className="text-[15px] font-bold">Compartilhar por link</h2>
          <p className="mt-1 text-[12px] leading-[1.6] text-dim">
            Quem abrir o link lê o desenho da versão{' '}
            <strong className="font-semibold text-muted">v{publicada?.versao}</strong> e pode trazê-la
            para uma conta dele. O que ele leva nasce rascunho, sem IA e sem as suas credenciais.
          </p>

          {avisos.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3.5">
              {avisos.map((aviso) => (
                <li key={aviso.codigo} className="text-[11.5px] leading-[1.6] text-amber-100/90">
                  {aviso.mensagem}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <select
              value={prazo}
              aria-label="Prazo do link"
              onChange={(e) => setPrazo(e.target.value)}
              className="app-field px-3 py-2.5 text-[12.5px] sm:w-[150px]"
            >
              {PRAZOS_DO_LINK.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={criar}
              disabled={rodando}
              className="app-primary-button flex-1 px-4 py-2.5 text-[12.5px]"
            >
              {rodando ? 'gerando…' : 'Gerar link e copiar'}
            </button>
          </div>

          {erro && (
            <p role="alert" className="mt-3 text-[11.5px] text-rose-300">
              {erro}
            </p>
          )}

          <div className="mt-5 border-t border-white/[0.06] pt-4">
            {links === null ? (
              <p className="text-[11.5px] text-dim">carregando…</p>
            ) : links.length === 0 ? (
              <p className="text-[11.5px] leading-[1.6] text-dim">
                Nenhum link ainda. Enquanto não houver, este fluxo não é alcançável de fora do
                painel.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => {
                  const vivo = link.estado === 'valido'
                  return (
                    <li
                      key={link.id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={`/f/${link.token}`}
                          aria-label="Endereço do link"
                          onFocus={(e) => e.currentTarget.select()}
                          className={`app-field min-w-0 flex-1 px-2.5 py-1.5 font-mono text-[11px] ${vivo ? '' : 'text-dim line-through'}`}
                        />
                        {vivo && (
                          <button
                            type="button"
                            onClick={() => copiar(link.token)}
                            className="app-secondary-button shrink-0 px-2.5 py-1.5 text-[11px]"
                          >
                            {copiado === link.token ? 'copiado!' : 'copiar'}
                          </button>
                        )}
                        {vivo && (
                          <button
                            type="button"
                            onClick={() => revogar(link.id)}
                            disabled={rodando}
                            title="Fecha o link. A contagem do que ele já fez fica."
                            className="shrink-0 rounded-lg border border-rose-400/25 px-2.5 py-1.5 text-[11px] text-rose-300 transition hover:bg-rose-400/10"
                          >
                            revogar
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-[10.5px] text-dim">
                        {link.estado === 'revogado'
                          ? 'fechado'
                          : link.estado === 'expirado'
                            ? 'prazo vencido'
                            : link.expiraEm
                              ? `vale até ${new Date(link.expiraEm).toLocaleDateString('pt-BR')}`
                              : 'sem prazo'}{' '}
                        · {link.aberturas} abertura(s) · {link.importacoes} importação(ões)
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="app-secondary-button px-4 py-2 text-[12px]"
            >
              Fechar
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
