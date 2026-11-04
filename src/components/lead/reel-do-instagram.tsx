'use client'

import { useEffect, useState } from 'react'

/**
 * O vídeo de um reel compartilhado, recortado do player oficial do Instagram.
 *
 * ---------------------------------------------------------------------------
 * A conta do recorte (medida em 04/nov/2026)
 * ---------------------------------------------------------------------------
 *
 * O `/embed/` do Instagram desenha um cabeçalho de 54px e, abaixo, uma caixa de
 * mídia com altura `1,25 × largura − 1` (proporção 4:5). O reel é 9:16, então
 * ocupa só o meio dessa caixa e sobra faixa preta dos lados. A janela aqui
 * mostra exatamente a faixa do vídeo: sobe o player 54px e o puxa para a
 * esquerda pela largura de uma das faixas. Curtir, comentar e rolagem ficam de
 * fora da janela.
 *
 * Post (`/p/`) é 4:5 e enche a caixa: recorta só o cabeçalho.
 */
const CABECALHO = 54

function janela(larguraDoPlayer: number, reel: boolean) {
  const altura = Math.round(larguraDoPlayer * 1.25) - 1
  if (!reel) return { altura, largura: larguraDoPlayer, esquerda: 0 }
  const video = (altura * 9) / 16
  const faixa = (larguraDoPlayer - video) / 2
  // Um pixel a menos de cada lado: o arredondamento do player não pode deixar
  // um fio preto na borda.
  return { altura, largura: Math.floor(video) - 2, esquerda: Math.ceil(faixa) + 1 }
}

function Player({ src, titulo, larguraDoPlayer, reel }: { src: string; titulo: string; larguraDoPlayer: number; reel: boolean }) {
  const j = janela(larguraDoPlayer, reel)
  return (
    <span className="relative block overflow-hidden rounded-lg bg-black" style={{ width: j.largura, height: j.altura }}>
      <iframe
        src={src}
        title={titulo}
        loading="lazy"
        scrolling="no"
        width={larguraDoPlayer}
        height={j.altura + CABECALHO + 80}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="block max-w-none border-0"
        style={{ marginTop: -CABECALHO, marginLeft: -j.esquerda }}
      />
    </span>
  )
}

export function ReelDoInstagram({
  embed,
  url,
  titulo,
  reel,
}: {
  embed: string
  url: string
  titulo: string
  reel: boolean
}) {
  const [aberto, setAberto] = useState(false)
  // A altura do visor vem da janela: o player é medido em pixels, não escala.
  const [alturaDaTela, setAlturaDaTela] = useState(800)

  useEffect(() => {
    if (!aberto) return
    setAlturaDaTela(window.innerHeight)
    const noTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', noTeclado)
    const rolagemAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', noTeclado)
      document.body.style.overflow = rolagemAnterior
    }
  }, [aberto])

  const alturaGrande = Math.min(alturaDaTela - 120, 860)
  const larguraGrande = Math.floor((alturaGrande + 1) / 1.25)

  return (
    <>
      <span className="relative block w-fit">
        <Player src={embed} titulo={titulo} larguraDoPlayer={reel ? 290 : 260} reel={reel} />
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Expandir o vídeo"
          title="Expandir"
          className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
        >
          <svg aria-hidden viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </span>

      {aberto && (
        // `span` e não `div`: a bolha da conversa é um `<p>`, e `div` dentro
        // de `p` quebra a hidratação.
        <span
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 backdrop-blur-sm"
        >
          <span onClick={(e) => e.stopPropagation()} className="block">
            <Player src={embed} titulo={titulo} larguraDoPlayer={larguraGrande} reel={reel} />
          </span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[13px] text-white/80 underline hover:text-white"
          >
            Abrir no Instagram
          </a>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            className="absolute top-4 right-4 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-[13.5px] text-white transition hover:border-white/50"
          >
            ✕
          </button>
        </span>
      )}
    </>
  )
}
