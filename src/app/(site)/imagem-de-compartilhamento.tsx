import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

/*
 * A imagem que aparece quando alguém cola o link do site no WhatsApp, no
 * LinkedIn ou num e-mail: o azul da capa com a trama de fios, a marca e o
 * título da página. Cada rota do site tem um `opengraph-image.tsx` que chama
 * esta função com o seu texto.
 */
export const TAMANHO = { width: 1200, height: 630 }
export const TIPO = 'image/png'

/*
 * Os arquivos ficam em `assets/og/`, fora do `public/`: o que está em
 * `public/` vai para a CDN e pode não estar junto da função no servidor.
 * `fios.svg` é a cópia de `public/fundos/fios-1.svg` (o gerador escreve as
 * duas), e a Outfit é a fonte do site, em woff estático (o gerador de imagem
 * não lê fonte variável).
 */
const arquivo = (nome: string) => readFile(join(process.cwd(), 'assets/og', nome))

export async function imagemDeCompartilhamento({ olho, titulo }: { olho: string; titulo: string }) {
  const [fios, marca, regular, negrito] = await Promise.all([
    arquivo('fios.svg'),
    arquivo('marca.png'),
    arquivo('outfit-400.woff'),
    arquivo('outfit-700.woff'),
  ])
  const fundo = `data:image/svg+xml;base64,${fios.toString('base64')}`
  const logo = `data:image/png;base64,${marca.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '60px 72px',
          background: 'linear-gradient(135deg, #1a3fb8 0%, #1d4ed8 45%, #3a6cf0 100%)',
          color: '#ffffff',
          fontFamily: 'Outfit',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fundo} width={1260} height={788} style={{ position: 'absolute', left: -30, top: -60 }} alt="" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#ffffff',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={48} height={48} alt="" />
          </div>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>Dialogon</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1000 }}>
          <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.78)' }}>{olho}</span>
          <span style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>{titulo}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: 'rgba(255,255,255,0.8)' }}>
          <span>dialogon.com.br</span>
          <span>API oficial do WhatsApp Business</span>
        </div>
      </div>
    ),
    {
      ...TAMANHO,
      fonts: [
        { name: 'Outfit', data: regular, weight: 400, style: 'normal' },
        { name: 'Outfit', data: negrito, weight: 700, style: 'normal' },
      ],
    },
  )
}
