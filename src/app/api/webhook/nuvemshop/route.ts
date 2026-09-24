import { alertar } from '@/server/alertar'
import { assinaturaValida } from '@/server/nuvemshop/conexao'
import { apagarConexao } from '@/server/repos/conexoes'
import { soltarLojaNuvemshop } from '@/server/repos/lojas'

export const dynamic = 'force-dynamic'

/**
 * Os avisos da Nuvemshop (F4). Quem chama é o servidor dela, sem sessão:
 * a defesa é a assinatura `x-linkedstore-hmac-sha256` do corpo cru com o
 * segredo do app, conferida **antes** de ler o JSON.
 *
 * - `app/uninstalled`: o lojista removeu o app lá. Desliga a loja, solta o
 *   número e apaga o token do cofre, que já não vale.
 * - Os três de LGPD (`store/redact`, `customers/redact`,
 *   `customers/data_request`), cadastrados no portal do parceiro: nesta fase
 *   o AutoFluxos não guarda dado de cliente vindo da Nuvemshop (o bot só
 *   consulta produto), então não há o que apagar nem relatar; responde 200.
 *   Quando a F5 gravar pedido, estes passam a ter trabalho.
 *
 * A Nuvemshop espera 2xx em até 3 s e reenvia por 48 h: tudo aqui é curto, e
 * falha nossa responde 500 para ela tentar de novo.
 */
export async function POST(req: Request) {
  const corpo = await req.text()
  if (!assinaturaValida(corpo, req.headers.get('x-linkedstore-hmac-sha256'))) {
    return new Response('assinatura inválida', { status: 401 })
  }

  let aviso: { event?: unknown; store_id?: unknown }
  try {
    aviso = JSON.parse(corpo) as typeof aviso
  } catch {
    return new Response('corpo inválido', { status: 400 })
  }

  const storeId = String(aviso.store_id ?? '')
  if (aviso.event === 'app/uninstalled' && /^[0-9]{1,20}$/.test(storeId)) {
    try {
      const solta = await soltarLojaNuvemshop({ storeId })
      if (solta?.conexaoId) await apagarConexao(solta.conexaoId, solta.clienteId)
    } catch (erro) {
      await alertar('o aviso de desinstalação da Nuvemshop falhou', erro, { loja: storeId })
      return new Response('falhou', { status: 500 })
    }
  }

  return new Response(null, { status: 200 })
}
