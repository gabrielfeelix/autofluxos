'use client'

import { useRef, useState, useTransition } from 'react'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { acaoConfirmarEnvio, acaoPrepararEnvioDeArquivo } from '@/server/acoes'
import type { ArquivoDoAcervo } from '@/server/repos/acervo'

/** O mesmo teto do bucket e da Cloud API (0017). */
const LIMITE_MB = 16
const ACEITOS = 'image/png,image/jpeg,image/webp,video/mp4,audio/mpeg,audio/ogg,application/pdf'

/**
 * O acervo de arquivos do cliente.
 *
 * A ação que importa aqui é **copiar o endereço** — é ele que vai no bloco de
 * Mídia. Por isso o botão de copiar é o principal de cada cartão, e não um
 * ícone escondido: sem ele, a tela seria um álbum bonito e inútil.
 */
export function GerenciadorDoAcervo({
  arquivos,
  clienteId,
  apagar,
}: {
  arquivos: ArquivoDoAcervo[]
  clienteId: string
  apagar: (caminho: string) => Promise<{ ok: boolean; erro?: string }>
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState<string | null>(null)
  const [enviando, comecar] = useTransition()

  /**
   * Enviar é em dois tempos, e o arquivo **não passa pelo nosso servidor**.
   *
   * Passava, como corpo de uma Server Action — e Server Action tem teto de 1 MB
   * no Next. Esta tela anunciava 16 MB desde a 0017 e falhava calada em
   * qualquer coisa acima de um mega: o formulário devolvia a página de erro do
   * framework, não um recado. Agora o servidor só assina o caminho e o
   * navegador manda os bytes direto para o Storage, onde o teto real é o do
   * bucket.
   */
  function enviar(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    setEnviado(null)

    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      setErro(`Este arquivo tem ${Math.round(arquivo.size / 1024 / 1024)} MB. O teto é ${LIMITE_MB} MB.`)
      return
    }

    comecar(async () => {
      // Tudo dentro de um `try`: promessa rejeitada aqui sobe para a fronteira
      // de erro do React e derruba a tela inteira.
      try {
        const preparo = await acaoPrepararEnvioDeArquivo(clienteId, {
          nome: arquivo.name,
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
          setErro(
            resposta.status === 413
              ? `O arquivo passa do teto de ${LIMITE_MB} MB.`
              : `O envio falhou (${resposta.status}). Tente de novo.`,
          )
          return
        }

        await acaoConfirmarEnvio(clienteId)
        setEnviado(preparo.envio.nome)
      } catch (erro) {
        setErro(erro instanceof Error ? erro.message : 'não deu para enviar')
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="app-card p-6">
        <h2 className="text-[14.5px] font-bold">Enviar arquivo</h2>
        <p className="mt-1 text-[12px] leading-5 text-dim">
          Imagem (PNG, JPG, WebP), vídeo MP4, áudio MP3 ou OGG, e PDF. Até {LIMITE_MB} MB — é o
          teto do próprio WhatsApp, não nosso.
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            enviar(e.dataTransfer.files[0])
          }}
          className="mt-5 rounded-[11px] border border-dashed border-white/[0.14] bg-white/[0.02] px-4 py-6 text-center"
        >
          <p className="text-[12.5px] font-semibold text-soft">
            {enviando ? 'Enviando…' : 'Arraste o arquivo aqui'}
          </p>
          <button
            type="button"
            disabled={enviando}
            onClick={() => entrada.current?.click()}
            className="app-secondary-button mt-2.5 px-3.5 py-1.5 text-[12px] disabled:opacity-50"
          >
            escolher do computador
          </button>
          <p className="mt-2 text-[11px] text-dim">
            O arquivo fica disponível para todos os fluxos deste cliente.
          </p>
        </div>

        <input
          ref={entrada}
          type="file"
          accept={ACEITOS}
          className="hidden"
          onChange={(e) => {
            enviar(e.target.files?.[0])
            // Zerar deixa escolher o mesmo arquivo de novo depois de um erro.
            e.target.value = ''
          }}
        />

        {enviado && (
          <p role="status" className="mt-2.5 text-[12px] font-semibold text-emerald-300">
            {enviado} entrou no acervo.
          </p>
        )}
        {erro && (
          <p role="alert" className="mt-2.5 text-[12px] font-semibold text-rose-300">
            {erro}
          </p>
        )}
      </section>

      <section className="app-card overflow-hidden">
        <header className="border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-[14.5px] font-bold">Arquivos</h2>
          <p className="mt-0.5 text-[12px] text-dim">
            {arquivos.length === 0
              ? 'Nenhum ainda.'
              : `${arquivos.length} ${arquivos.length === 1 ? 'arquivo' : 'arquivos'} neste cliente.`}
          </p>
        </header>

        {arquivos.length === 0 ? (
          <p className="px-6 py-10 text-center text-[12.5px] text-dim">
            Envie a foto da sala, o vídeo do trabalho ou o PDF do plano — o que o bot precisa
            mostrar antes de alguém perguntar o preço.
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(210px,100%),1fr))] gap-3.5 p-5">
            {arquivos.map((arquivo) => (
              <li key={arquivo.caminho}>
                <Cartao arquivo={arquivo} apagar={apagar} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const ROTULO: Record<ArquivoDoAcervo['midia'], string> = {
  imagem: 'Imagem',
  video: 'Vídeo',
  documento: 'Documento',
  audio: 'Áudio',
}

function Cartao({
  arquivo,
  apagar,
}: {
  arquivo: ArquivoDoAcervo
  apagar: (caminho: string) => Promise<{ ok: boolean; erro?: string }>
}) {
  const [copiado, setCopiado] = useState(false)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[12px] border border-white/[0.08] bg-white/[0.02]">
      <div className="flex h-[118px] items-center justify-center bg-black/25">
        {arquivo.midia === 'imagem' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={arquivo.url} alt={arquivo.nome} className="size-full object-cover" />
        ) : (
          <span aria-hidden className="text-[26px] opacity-60">
            {arquivo.midia === 'video' ? '▶' : arquivo.midia === 'audio' ? '♪' : '📄'}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold" title={arquivo.nome}>
            {arquivo.nome}
          </p>
          <p className="mt-0.5 text-[10.5px] text-dim">
            {ROTULO[arquivo.midia]} · {emKb(arquivo.bytes)}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(arquivo.url)
              setCopiado(true)
              // Volta sozinho: um "copiado!" fixo deixa de ser confirmação e
              // passa a ser rótulo do botão.
              setTimeout(() => setCopiado(false), 1600)
            }}
            className="flex-1 rounded-lg border border-accent/30 bg-accent/[0.08] px-2 py-1.5 text-[11px] font-semibold text-accent transition hover:bg-accent/[0.15]"
          >
            {copiado ? 'copiado!' : 'Copiar endereço'}
          </button>
          <BotaoPerigo
            acao={apagar.bind(null, arquivo.caminho)}
            rotulo="✕"
            titulo="Apagar do acervo"
            pergunta={`Apagar "${arquivo.nome}"? Um fluxo publicado que aponte para ele para de entregar o arquivo.`}
          />
        </div>
      </div>
    </div>
  )
}

function emKb(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
