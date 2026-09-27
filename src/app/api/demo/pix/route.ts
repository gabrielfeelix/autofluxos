import { codigoPix, lerValor, limparNome, reaisDito } from '@/core/pagamento-demo'

/**
 * O Pix "copia e cola" da demonstração, para o bloco de API do fluxo da demo
 * mandar na conversa. Público (sem sessão), como a imagem do QR: quem chama é
 * o nosso próprio motor. Não guarda nada e não consulta banco; a chave é
 * inventada (ver `core/pagamento-demo.ts`).
 */
export function GET(req: Request) {
  const url = new URL(req.url)
  const valor = lerValor(url.searchParams.get('v'))
  if (valor === null) return Response.json({ erro: 'valor inválido' }, { status: 400 })
  const nome = limparNome(url.searchParams.get('n'))
  // Os links já codificados: o nome vem do que o dono digitou na demo ("Burger
  // do Zé"), e espaço cru quebra o link no WhatsApp.
  const q = `v=${encodeURIComponent(url.searchParams.get('v') ?? '')}&n=${encodeURIComponent(nome)}`
  return Response.json({
    codigo: codigoPix(valor, nome),
    valor: reaisDito(valor),
    nome,
    qr: `${url.origin}/api/demo/pix/qr?${q}`,
    link: `${url.origin}/demo/pagar?${q}`,
  })
}
