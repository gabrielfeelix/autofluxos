'use client'

import { useRef, useState, useTransition } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import {
  PRAZOS_DO_LINK,
  PRAZO_PADRAO,
  avisosDoCompartilhamento,
  type AvisoDoCompartilhamento,
} from '@/core/compartilhar'
import { montarArquivoDeFluxo, nomeDoArquivoDeFluxo } from '@/core/arquivo-de-fluxo'
import type { Fluxo } from '@/core/flow/schema'
import {
  acaoCriarLinkDoFluxo,
  acaoListarLinksDoFluxo,
  acaoQrDoLinkDoFluxo,
  acaoRevogarLinkDoFluxo,
} from '@/server/acoes'

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
 * no ar, nunca para o rascunho , e é por isso que o botão fica desabilitado
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
  nome,
  publicada,
}: {
  clienteId: string
  fluxoId: string
  /** O nome do fluxo. Só serve para batizar o arquivo do "Exportar JSON". */
  nome: string
  /** O grafo no ar. `null` = nunca publicado, e aí não há o que compartilhar. */
  publicada: { versao: number; grafo: Fluxo } | null
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [links, setLinks] = useState<LinkNaLista[] | null>(null)
  const [prazo, setPrazo] = useState<string>(PRAZO_PADRAO)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  /** O QR aberto agora, se houver. Um por vez: são grandes. */
  const [qr, setQr] = useState<{ linkId: string; svg: string; endereco: string } | null>(null)
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

  /**
   * O QR do link, para quem está com o celular na mão do lado.
   *
   * Vem do servidor já como SVG, e o endereço dentro dele é montado lá com o
   * host da requisição: ver `acaoQrDoLinkDoFluxo`. A tela só desenha.
   */
  function mostrarQr(linkId: string) {
    if (qr?.linkId === linkId) {
      setQr(null)
      return
    }
    setErro(null)
    comecar(async () => {
      try {
        const r = await acaoQrDoLinkDoFluxo(clienteId, fluxoId, linkId)
        if (!r.ok || !r.svg || !r.endereco) {
          setErro(r.erro ?? 'não deu para gerar o QR')
          return
        }
        setQr({ linkId, svg: r.svg, endereco: r.endereco })
      } catch {
        setErro('não deu para gerar o QR agora')
      }
    })
  }

  /**
   * Baixa o fluxo como arquivo.
   *
   * Não passa pelo servidor: o desenho publicado já está nesta tela, e mandar
   * ele de volta só para receber o mesmo JSON seria uma ida à rede para nada.
   * `montarArquivoDeFluxo` é quem tira a credencial, e é o mesmo `core/` que a
   * importação usa para ler.
   */
  function exportar() {
    if (!publicada) return
    const arquivo = montarArquivoDeFluxo({
      nome,
      grafo: publicada.grafo,
      versaoPublicada: publicada.versao,
    })
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(arquivo, null, 2)], { type: 'application/json' }),
    )
    const ancora = document.createElement('a')
    ancora.href = url
    ancora.download = nomeDoArquivoDeFluxo(nome, publicada.versao)
    ancora.click()
    // Sem isto o blob fica preso na memória da aba até ela fechar, e quem
    // exporta dez versões seguidas segura dez cópias do grafo.
    URL.revokeObjectURL(url)
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
      setErro('não deu para copiar automaticamente, selecione o endereço e copie')
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
            : 'Publique primeiro, o link aponta para uma versão publicada, não para o rascunho'
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
        onClose={() => {
          setCopiado(null)
          setQr(null)
        }}
        className="app-dialog m-auto w-[min(560px,92vw)] rounded-[18px] border border-line bg-panel text-ink shadow-[0_40px_100px_rgba(19,25,34,0.132)]"
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
                <li key={aviso.codigo} className="text-[11.5px] leading-[1.6] text-aviso/90">
                  {aviso.mensagem}
                </li>
              ))}
            </ul>
          )}

          {/*
            O prazo ocupava a linha quase inteira e espremia o botão até ele
            quebrar em três linhas ("Gerar / link e / copiar"). A causa é a
            largura: `.app-field` fixa `width: 100%`, então a classe utilitária
            de 150px não valia e o `<select>` continuava pedindo a linha toda ,
            sobrando ao botão a largura de uma palavra.

            Agora o prazo é o `Dropdown` do próprio sistema (o mesmo do resto do
            painel, em vez de um `<select>` nativo com a seta do sistema
            operacional no meio da tela escura), com largura própria, e o botão
            é `shrink-0` com o texto proibido de quebrar: quem manda na linha é
            a ação, e o que cede é o campo.
          */}
          <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Dropdown
              valor={prazo}
              aoMudar={setPrazo}
              rotuloAcessivel="Prazo do link"
              opcoes={PRAZOS_DO_LINK.map((opcao) => ({
                valor: opcao.valor,
                rotulo: opcao.rotulo,
              }))}
              className="sm:w-[168px]"
            />
            <button
              type="button"
              onClick={criar}
              disabled={rodando}
              className="app-primary-button shrink-0 px-4 py-2.5 text-[12.5px] whitespace-nowrap"
            >
              {rodando ? 'gerando…' : 'Gerar link e copiar'}
            </button>
          </div>

          {erro && (
            <p role="alert" className="mt-3 text-[11.5px] text-perigo">
              {erro}
            </p>
          )}

          <div className="mt-5 border-t border-line pt-4">
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
                      className="rounded-xl border border-line bg-panel p-3"
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
                            onClick={() => mostrarQr(link.id)}
                            disabled={rodando}
                            title="Mostrar um QR para abrir este link no celular"
                            className="app-secondary-button shrink-0 px-2.5 py-1.5 text-[11px]"
                          >
                            {qr?.linkId === link.id ? 'fechar QR' : 'QR'}
                          </button>
                        )}
                        {vivo && (
                          <button
                            type="button"
                            onClick={() => revogar(link.id)}
                            disabled={rodando}
                            title="Fecha o link. A contagem do que ele já fez fica."
                            className="shrink-0 rounded-lg border border-rose-400/25 px-2.5 py-1.5 text-[11px] text-perigo transition hover:bg-rose-400/10"
                          >
                            Revogar
                          </button>
                        )}
                      </div>
                      {qr?.linkId === link.id && (
                        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-3">
                          {/*
                            O SVG vem da nossa própria ação, gerado no servidor
                            a partir do host da requisição: não há texto de
                            usuário dentro dele. É por isso que `dangerously…`
                            aqui não é uma porta aberta.
                          */}
                          <div
                            aria-label="QR do link"
                            className="rounded-lg bg-white p-2 [&>svg]:block"
                            dangerouslySetInnerHTML={{ __html: qr.svg }}
                          />
                          <p className="text-center font-mono text-[10px] break-all text-dim">
                            {qr.endereco}
                          </p>
                        </div>
                      )}

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

          <div className="mt-5 flex items-center justify-between gap-3">
            {/*
              O arquivo fica ao lado do link porque a pergunta é a mesma,
              "como isto sai daqui?", e as respostas são diferentes: o link é
              vivo, tem prazo e se revoga; o arquivo é morto, vai para o backup
              e abre daqui a um ano sem depender de nada nosso estar no ar.
            */}
            <button
              type="button"
              onClick={exportar}
              disabled={!publicada}
              title="Baixar o desenho publicado como arquivo JSON, sem as credenciais"
              className="app-secondary-button px-3.5 py-2 text-[12px]"
            >
              Exportar JSON
            </button>
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
