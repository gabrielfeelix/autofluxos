import { abrirPorta, preflight, responder } from '@/server/api-do-site'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ chave: string }> }

/**
 * A aparência do balão: o que o script precisa para se desenhar.
 *
 * Só o que é público por natureza (título, cor, saudação). Os domínios não
 * voltam: quem está pedindo já está num deles, e a lista inteira contaria a um
 * curioso onde mais a loja roda.
 */
export async function GET(req: Request, { params }: Contexto) {
  const { chave } = await params
  const porta = await abrirPorta(req, chave, 'leitura')
  if (!porta.ok) return porta.resposta

  const { titulo, cor, saudacao, pedirContato } = porta.canal.config
  return responder(porta.origem, { titulo, cor, saudacao, pedirContato })
}

export async function OPTIONS(req: Request, { params }: Contexto) {
  return preflight(req, (await params).chave)
}
