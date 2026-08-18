'use client'

import { useState } from 'react'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import type { ArquivoDoAcervo } from '@/server/repos/acervo'

/**
 * O acervo de arquivos do cliente.
 *
 * A ação que importa aqui é **copiar o endereço** — é ele que vai no bloco de
 * Mídia. Por isso o botão de copiar é o principal de cada cartão, e não um
 * ícone escondido: sem ele, a tela seria um álbum bonito e inútil.
 */
export function GerenciadorDoAcervo({
  arquivos,
  subir,
  apagar,
}: {
  arquivos: ArquivoDoAcervo[]
  subir: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
  apagar: (caminho: string) => Promise<{ ok: boolean; erro?: string }>
}) {
  return (
    <div className="space-y-6">
      <section className="app-card p-6">
        <h2 className="text-[14.5px] font-bold">Enviar arquivo</h2>
        <p className="mt-1 text-[12px] leading-5 text-dim">
          Imagem (PNG, JPG, WebP), vídeo MP4, áudio MP3 ou OGG, e PDF. Até 16 MB — é o teto do
          próprio WhatsApp, não nosso.
        </p>

        <FormularioSalvar
          action={subir}
          rotulo="Enviar"
          dica="O arquivo fica disponível para todos os fluxos deste cliente."
        >
          <input
            type="file"
            name="arquivo"
            required
            accept="image/png,image/jpeg,image/webp,video/mp4,audio/mpeg,audio/ogg,application/pdf"
            className="app-field mt-5 px-3 py-2.5 text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-soft"
          />
        </FormularioSalvar>
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
