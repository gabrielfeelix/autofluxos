import { TEXTO_DO_ACEITE_DO_SITE } from '@/core/consentimento'
import { aberturaDoSite } from '@/server/abertura-do-site'
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

  const { titulo, cor, saudacao, formulario, prazo, ligacao, mascote, tema } = porta.canal.config
  // A caixa de aceite só aparece quando o formulário pede WhatsApp: sem número,
  // não há para onde mandar promoção, e a caixa seria um aceite de nada.
  const aceite = formulario.some((campo) => campo.tipo === 'telefone') ? TEXTO_DO_ACEITE_DO_SITE : null
  // A abertura falhar não pode derrubar o balão: sem ela, ele mostra a saudação.
  const abertura = await aberturaDoSite(porta.canal).catch((erro) => {
    console.error('[site] abertura do fluxo falhou', erro)
    return null
  })
  return responder(porta.origem, { titulo, cor, saudacao, formulario, prazo, ligacao, mascote, tema, aceite, abertura })
}

export async function OPTIONS(req: Request, { params }: Contexto) {
  return preflight(req, (await params).chave)
}
