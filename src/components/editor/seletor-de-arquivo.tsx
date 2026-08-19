'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { TipoDeMidia } from '@/core/flow/schema'
import {
  acaoConfirmarEnvio,
  acaoListarAcervo,
  acaoPrepararEnvioDeArquivo,
  type ArquivoDoEditor,
} from '@/server/acoes'

/**
 * Como um arquivo entra num bloco de Mídia.
 *
 * **Antes era um campo pedindo `https://…`**, e isso é o nosso problema
 * empurrado para quem usa: a pessoa que desenha o fluxo do estúdio tem a foto
 * da sala no computador, não um servidor onde hospedá-la. O Acervo existia
 * desde a 0017 e resolvia só metade — obrigava a sair do editor, subir lá,
 * copiar o endereço e voltar. Quatro passos para "manda essa foto".
 *
 * Agora são três caminhos, nesta ordem de destaque:
 *
 * 1. **arrastar ou escolher** o arquivo aqui mesmo (o caso comum);
 * 2. **reusar** um que já está no acervo (a foto da sala é a mesma em cinco
 *    fluxos);
 * 3. **colar um endereço**, que continua existindo — é o caminho de quem
 *    hospeda fora e o único jeito de usar `{{variavel}}` no lugar da URL, que é
 *    o catálogo por variável que o bloco de API alimenta.
 *
 * O tipo (imagem, vídeo, documento, áudio) deixa de ser pergunta: ele sai do
 * arquivo. Escolher "Documento" e subir um PNG é um erro que a Meta recusa na
 * hora da entrega, e não faz sentido deixar alguém cometê-lo.
 */

const LIMITE_MB = 16

const ROTULO_DA_MIDIA: Record<TipoDeMidia, string> = {
  imagem: 'Imagem',
  video: 'Vídeo',
  documento: 'Documento',
  audio: 'Áudio',
}

const ACEITOS = 'image/png,image/jpeg,image/webp,video/mp4,audio/mpeg,audio/ogg,application/pdf'

export function SeletorDeArquivo({
  clienteId,
  url,
  midia,
  aoEscolher,
  registrarCampo,
}: {
  clienteId: string
  url: string
  midia: TipoDeMidia
  /** O tipo vem junto porque ele sai do arquivo, e não de um seletor à parte. */
  aoEscolher: (escolha: { url: string; midia: TipoDeMidia; nomeArquivo?: string }) => void
  registrarCampo?: (
    elemento: HTMLInputElement | HTMLTextAreaElement,
    aoMudar: (valor: string) => void,
  ) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, comecar] = useTransition()

  const [acervo, setAcervo] = useState<ArquivoDoEditor[] | null>(null)
  const [mostrandoAcervo, setMostrandoAcervo] = useState(false)
  const [colando, setColando] = useState(false)

  // O acervo é lido só quando alguém pede: o editor abre muitas vezes por
  // sessão e a maioria delas não encosta num bloco de mídia.
  useEffect(() => {
    if (!mostrandoAcervo || acervo !== null) return
    let vivo = true
    // `.catch` obrigatório: promessa rejeitada dentro de um efeito derruba a
    // árvore. Lista vazia é degradação; página de erro não é.
    void acaoListarAcervo(clienteId)
      .then((r) => {
        if (vivo) setAcervo(r.arquivos)
      })
      .catch(() => {
        if (vivo) setAcervo([])
      })
    return () => {
      vivo = false
    }
  }, [mostrandoAcervo, acervo, clienteId])

  /**
   * Enviar é em dois tempos, e o arquivo **não passa pelo nosso servidor**.
   *
   * 1. o servidor confere quem é você e devolve uma URL assinada, válida para
   *    um caminho só dentro da pasta deste cliente;
   * 2. o navegador manda os bytes direto para o Storage.
   *
   * Fazia em um tempo só, com o arquivo dentro de uma Server Action — e Server
   * Action tem teto de 1 MB no Next. Um PDF de 3 MB virava 413 antes de
   * qualquer código nosso rodar, e a tela mostrava a página de erro genérica em
   * vez de dizer o que houve.
   */
  function enviar(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)

    // A conferência que vale é a do bucket; esta existe para o erro aparecer
    // **antes** de dezesseis megabytes subirem por uma conexão de celular.
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      setErro(`Este arquivo tem ${Math.round(arquivo.size / 1024 / 1024)} MB. O teto é ${LIMITE_MB} MB.`)
      return
    }

    comecar(async () => {
      /**
       * **Tudo dentro de um `try`.** Uma promessa rejeitada aqui dentro sobe
       * para a fronteira de erro do React e derruba a tela inteira — que foi
       * exatamente o que aconteceu com o 413. Falha de upload é um recado numa
       * linha, nunca uma página em branco.
       */
      try {
        const preparo = await acaoPrepararEnvioDeArquivo(clienteId, {
          nome: arquivo.name,
          // Navegador que não reconhece a extensão manda tipo vazio; o servidor
          // recusa com a lista do que o WhatsApp aceita, que é a resposta útil.
          tipo: arquivo.type,
          bytes: arquivo.size,
        })

        if (!preparo.ok || !preparo.envio) {
          setErro(preparo.erro ?? 'não deu para preparar o envio')
          return
        }

        const resposta = await fetch(preparo.envio.url, {
          method: 'PUT',
          headers: { 'content-type': arquivo.type },
          body: arquivo,
        })

        if (!resposta.ok) {
          // O bucket recusa por tipo e por tamanho (0017). É a única checagem
          // que ninguém contorna, e a mensagem dela é a que vale.
          setErro(
            resposta.status === 413
              ? `O arquivo passa do teto de ${LIMITE_MB} MB.`
              : `O envio falhou (${resposta.status}). Tente de novo.`,
          )
          return
        }

        // O upload aconteceu fora do servidor, então nada foi revalidado: sem
        // isto, a tela de Configurações mostraria a lista de antes.
        await acaoConfirmarEnvio(clienteId)

        // A lista em memória fica velha depois de um upload. Zerar faz a
        // próxima abertura reler, em vez de esconder o que acabou de subir.
        setAcervo(null)
        aplicar({
          url: preparo.envio.urlPublica,
          nome: preparo.envio.nome,
          midia: preparo.envio.midia,
          bytes: arquivo.size,
        })
      } catch (erro) {
        setErro(erro instanceof Error ? erro.message : 'não deu para enviar')
      }
    })
  }

  function aplicar(arquivo: ArquivoDoEditor) {
    setMostrandoAcervo(false)
    setColando(false)
    aoEscolher({
      url: arquivo.url,
      midia: arquivo.midia,
      // O nome só vira campo em documento — é o que a pessoa lê antes de
      // baixar. Nos outros a Meta não mostra nada, e mandar o nome seria dado
      // guardado à toa no grafo.
      ...(arquivo.midia === 'documento' ? { nomeArquivo: arquivo.nome } : {}),
    })
  }

  const escolhido = url.trim() !== ''
  const nomeVisivel = escolhido ? nomeDaUrl(url) : ''

  return (
    <div className="space-y-2">
      {escolhido ? (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-white/[0.09] bg-white/[0.03] p-2">
          {midia === 'imagem' && !url.includes('{{') ? (
            /* O otimizador do Next exige domínio declarado, e aqui o endereço
               é o Storage do cliente **ou** qualquer host de fora — não há
               lista para declarar. É uma miniatura de 40px num painel de
               edição; otimizar não é o ponto. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              className="size-10 shrink-0 rounded-md object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[15px]">
              {midia === 'video' ? '🎬' : midia === 'audio' ? '🎤' : '📄'}
            </span>
          )}

          <span className="min-w-0 flex-1">
            <strong className="block truncate text-[12px] font-semibold text-soft">
              {nomeVisivel}
            </strong>
            <span className="block text-[10.5px] text-dim">{ROTULO_DA_MIDIA[midia]}</span>
          </span>

          <button
            type="button"
            onClick={() => aoEscolher({ url: '', midia })}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-dim transition hover:bg-white/[0.06] hover:text-rose-300"
          >
            Trocar
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastando(false)
            enviar(e.dataTransfer.files[0])
          }}
          className={`rounded-[10px] border border-dashed px-3 py-5 text-center transition ${
            arrastando ? 'border-accent/60 bg-accent/[0.08]' : 'border-white/[0.14] bg-white/[0.02]'
          }`}
        >
          <p className="text-[12px] font-semibold text-soft">
            {enviando ? 'Enviando…' : 'Arraste o arquivo aqui'}
          </p>
          <button
            type="button"
            disabled={enviando}
            onClick={() => entrada.current?.click()}
            className="app-secondary-button mt-2 px-3 py-1.5 text-[11.5px] disabled:opacity-50"
          >
            escolher do computador
          </button>
          <p className="mt-2 text-[10.5px] leading-4 text-dim">
            PNG, JPG, WebP, MP4, MP3, OGG ou PDF · até {LIMITE_MB} MB
            <br />o teto é do próprio WhatsApp, não nosso
          </p>
        </div>
      )}

      <input
        ref={entrada}
        type="file"
        accept={ACEITOS}
        className="hidden"
        onChange={(e) => {
          enviar(e.target.files?.[0])
          // Zerar deixa escolher o **mesmo** arquivo de novo depois de um erro;
          // sem isso o `change` não dispara na segunda vez.
          e.target.value = ''
        }}
      />

      <div className="flex flex-wrap gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => {
            setMostrandoAcervo((aberto) => !aberto)
            setColando(false)
          }}
          className="font-semibold text-accent transition hover:underline"
        >
          {mostrandoAcervo ? 'fechar o acervo' : 'usar do acervo'}
        </button>
        <span className="text-dim">·</span>
        <button
          type="button"
          onClick={() => {
            setColando((aberto) => !aberto)
            setMostrandoAcervo(false)
          }}
          className="font-semibold text-muted transition hover:text-accent hover:underline"
        >
          {colando ? 'fechar' : 'colar um endereço'}
        </button>
      </div>

      {mostrandoAcervo && (
        <div className="max-h-[190px] overflow-y-auto rounded-[10px] border border-white/[0.09] p-1.5">
          {acervo === null ? (
            <p className="px-2 py-3 text-center text-[11px] text-dim">carregando…</p>
          ) : acervo.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] leading-4 text-dim">
              Nenhum arquivo ainda. O que você enviar aqui fica guardado e aparece
              nesta lista nos outros fluxos.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {acervo.map((arquivo) => (
                <li key={arquivo.url}>
                  <button
                    type="button"
                    onClick={() => aplicar(arquivo)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
                  >
                    <span className="text-[13px]">
                      {arquivo.midia === 'imagem'
                        ? '🖼'
                        : arquivo.midia === 'video'
                          ? '🎬'
                          : arquivo.midia === 'audio'
                            ? '🎤'
                            : '📄'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-soft">
                      {arquivo.nome}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-dim">
                      {emMegabytes(arquivo.bytes)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {colando && (
        <div>
          <input
            value={url}
            placeholder="https://… ou {{variavel}}"
            onChange={(e) => aoEscolher({ url: e.target.value, midia })}
            onFocus={(e) =>
              registrarCampo?.(e.currentTarget, (novo) => aoEscolher({ url: novo, midia }))
            }
            onSelect={(e) =>
              registrarCampo?.(e.currentTarget, (novo) => aoEscolher({ url: novo, midia }))
            }
            className="app-field px-3 py-2.5 font-mono text-[12px]"
          />
          <p className="mt-1 text-[10.5px] leading-4 text-dim">
            Colando um endereço, o tipo continua sendo escolhido por você — não
            temos como saber o que há do outro lado sem baixar.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(Object.keys(ROTULO_DA_MIDIA) as TipoDeMidia[]).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => aoEscolher({ url, midia: tipo })}
                className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                  midia === tipo
                    ? 'border-accent/40 bg-accent/[0.14] text-accent'
                    : 'border-white/[0.08] text-dim hover:border-white/20 hover:text-muted'
                }`}
              >
                {ROTULO_DA_MIDIA[tipo]}
              </button>
            ))}
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-[11px] leading-4 text-rose-300">
          {erro}
        </p>
      )}
    </div>
  )
}

function emMegabytes(bytes: number): string {
  if (bytes <= 0) return ''
  const mb = bytes / 1024 / 1024
  return mb < 0.1 ? `${Math.round(bytes / 1024)} kB` : `${mb.toFixed(1)} MB`
}

/** O último pedaço da URL, sem query — é o que dá para chamar de nome. */
function nomeDaUrl(url: string): string {
  const limpo = url.trim()
  if (limpo.includes('{{')) return limpo
  const semQuery = limpo.split(/[?#]/)[0] ?? limpo
  return decodeURIComponent(semQuery.slice(semQuery.lastIndexOf('/') + 1)) || limpo
}
