import { z } from 'zod'
import { ehArquivoGuardado } from '@/core/midia-recebida'
import { db } from '@/server/db'
import { acharLead } from '@/server/repos/leads'
import { lerParaServir } from '@/server/repos/midia-recebida'
import { alcanceDeConversas, exigirCapacidade, recusou } from '@/server/permissoes'

export const dynamic = 'force-dynamic'

/** Vídeo de 16 MB numa conexão lenta ainda cabe; acima disso o navegador pede por partes. */
export const maxDuration = 60

const paramsSchema = z.object({
  clienteId: z.string().uuid(),
  mensagemId: z.string().uuid(),
})

/**
 * Trinta dias no navegador de quem atende, e só nele.
 *
 * O arquivo de uma mensagem não muda: o caminho é derivado do id dela. Então o
 * navegador pode guardar a cópia sem perguntar de novo, e é isso que tira do
 * egress do Supabase o mesmo arquivo baixado várias vezes por dia. `private`
 * mantém CDN e proxy de fora: a cópia fica na máquina de quem tinha acesso.
 */
const CACHE_DO_NAVEGADOR = 'private, max-age=2592000, immutable'

/** Cabeçalhos do Storage que o navegador precisa para tocar, avançar e revalidar. */
const REPASSADOS = ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']

/**
 * O que pode abrir **dentro** do navegador. O resto só baixa.
 *
 * Servir arquivo do contato pelo nosso domínio muda o risco: com a URL do
 * Supabase, um HTML ou SVG mandado no WhatsApp abria noutra origem; aqui ele
 * rodaria com a sessão do painel. Por isso o tipo vem desta lista, nunca do
 * arquivo, e qualquer outro vira `attachment` com `octet-stream`.
 */
const ABRE_NO_NAVEGADOR = /^(image\/(jpeg|png|webp|gif)|audio\/[\w.+-]+|video\/[\w.+-]+|application\/pdf)$/

/**
 * A mídia que o cliente mandou, servida por nós.
 *
 * Substitui a URL assinada de cinco minutos (ver `enderecoDaMidia`). A porta
 * continua sendo uma só: quem não atende a conversa recebe 404, como nas rotas
 * vizinhas, e o bucket segue sem política nenhuma para `anon`/`authenticated`.
 */
export async function GET(
  req: Request,
  contexto: RouteContext<'/api/clientes/[clienteId]/midia/[mensagemId]'>,
) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'mídia inválida' }, { status: 400 })
  const { clienteId, mensagemId } = params.data

  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return Response.json({ erro: 'não encontrado' }, { status: 404 })

  const { data } = await db()
    .from('messages')
    .select('contact_id, arquivo')
    .eq('id', mensagemId)
    .maybeSingle()
  const linha = data as { contact_id: string; arquivo: unknown } | null
  if (!linha || !ehArquivoGuardado(linha.arquivo)) {
    return Response.json({ erro: 'não encontrado' }, { status: 404 })
  }

  /*
   * O contato precisa ser deste cliente **e** estar no alcance de quem pede.
   * O caminho começa pelo id do cliente, e conferir os dois impede que um id
   * de mensagem de outra conta, trocado na URL, abra o arquivo dela.
   */
  const lead = await acharLead(clienteId, linha.contact_id, await alcanceDeConversas(clienteId, acesso))
  if (!lead || !linha.arquivo.caminho.startsWith(`${clienteId}/`)) {
    return Response.json({ erro: 'não encontrado' }, { status: 404 })
  }

  const arquivo = await lerParaServir(linha.arquivo.caminho, req.headers.get('range'))
  if (!arquivo) return Response.json({ erro: 'indisponível' }, { status: 502 })

  const mime = linha.arquivo.mime.toLowerCase()
  const abre = ABRE_NO_NAVEGADOR.test(mime)
  const cabecalhos = new Headers({
    'cache-control': CACHE_DO_NAVEGADOR,
    'content-type': abre ? mime : 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  })
  for (const nome of REPASSADOS) {
    const valor = arquivo.headers.get(nome)
    if (valor) cabecalhos.set(nome, valor)
  }
  if (linha.arquivo.midia === 'documento' || !abre) {
    const nome = (linha.arquivo.nomeArquivo ?? 'arquivo').replace(/["\\\r\n]/g, '')
    cabecalhos.set('content-disposition', `${abre ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(nome)}`)
  }

  return new Response(arquivo.body, { status: arquivo.status, headers: cabecalhos })
}
