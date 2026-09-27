import { ImageResponse } from 'next/og'
import { toString as qrParaSvg } from 'qrcode'
import { codigoPix, lerValor, limparNome, reaisDito } from '@/core/pagamento-demo'

/**
 * A imagem do Pix da demonstração: o nome da loja, o valor e o QR Code, como
 * a tela de pagamento de um app de delivery. O WhatsApp busca pelo link, então
 * a rota é pública (`proxy.ts`). Sempre com a faixa "demonstração": o valor e
 * o nome vêm da URL e ninguém pode usar isto para parecer uma cobrança real.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const valor = lerValor(url.searchParams.get('v'))
  if (valor === null) return new Response('valor inválido', { status: 400 })
  const nome = limparNome(url.searchParams.get('n'))
  const svg = await qrParaSvg(codigoPix(valor, nome), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  const qr = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#F2F5F4', fontFamily: 'sans-serif' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#32BCAD', color: 'white', padding: '36px 40px 30px' }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>PAGAMENTO VIA PIX</div>
          <div style={{ fontSize: 34, marginTop: 10 }}>{nome}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', borderRadius: 28, marginTop: 36, padding: '34px 40px', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 26, color: '#5B6B68' }}>Valor a pagar</div>
          <div style={{ fontSize: 72, fontWeight: 700, color: '#12302B', marginTop: 4 }}>{reaisDito(valor)}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={420} height={420} style={{ marginTop: 24 }} alt="" />
          <div style={{ fontSize: 24, color: '#5B6B68', marginTop: 24 }}>Abra o app do banco e escaneie, ou use o copia e cola</div>
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', marginBottom: 28, fontSize: 22, color: '#8A9794' }}>Demonstração 4YU Tech · nenhum valor é cobrado</div>
      </div>
    ),
    { width: 720, height: 1040, headers: { 'Cache-Control': 'public, max-age=86400, immutable' } },
  )
}
