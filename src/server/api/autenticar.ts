import 'server-only'
import { after } from 'next/server'
import { lerChave, tokenDoCabecalho, type EscopoDaApi } from '@/core/api/chaves'
import { consumirLimite } from '../limite'
import { recusaDoPlano } from '../recursos-do-plano'
import { conferirChaveDeApi, registrarUsoDaChave } from '../repos/chaves-de-api'

/**
 * A porta da API pública (`/api/v1`). Toda rota começa por `autenticarChave`.
 *
 * A ordem é da defesa mais barata para a mais cara, como no webhook de entrada:
 *
 * 1. **tamanho** do corpo declarado, sem ler nada;
 * 2. **limite** por chave, chaveado pelo `publico`, que sai do cabeçalho sem ir
 *    ao banco. Chave sem a forma de uma chave nossa morre antes, em 401;
 * 3. **chave**: hash conferido em tempo constante, revogada não passa;
 * 4. **escopo**: a chave só faz o que foi marcado na criação;
 * 5. **plano**: a organização precisa ter o recurso `api`.
 *
 * O `clienteId` sai **sempre da chave**. Nenhuma rota lê conta do corpo nem do
 * caminho: é isso que impede uma chave de uma conta de alcançar outra.
 *
 * A chave nunca vai para log, alerta nem mensagem de erro. Só o `publico`.
 */

export const LIMITE_DO_CORPO_EM_BYTES = 64 * 1024
export const TETO_POR_MINUTO = 120
const JANELA_EM_SEGUNDOS = 60

export type CodigoDeErro =
  | 'nao_autenticado'
  | 'escopo_insuficiente'
  | 'plano_sem_api'
  | 'limite_excedido'
  | 'corpo_grande'
  | 'json_invalido'
  | 'corpo_invalido'
  | 'telefone_invalido'
  | 'contato_nao_encontrado'
  | 'fluxo_nao_encontrado'
  | 'janela_fechada'
  | 'sem_conversa'
  | 'automacao_pausada'
  | 'atendimento_humano'
  | 'ocupado'
  | 'idempotencia_obrigatoria'
  | 'idempotencia_conflito'
  | 'requisicao_em_andamento'
  | 'template_nao_encontrado'
  | 'template_nao_aprovado'
  | 'template_com_midia'
  | 'idioma_obrigatorio'
  | 'valores_incompletos'
  | 'teto_diario'
  | 'sem_numero'
  | 'meta_recusou'
  | 'erro_interno'

/** O formato de erro de toda a API: `codigo` estável, `mensagem` para gente. */
export function erroDaApi(
  status: number,
  codigo: CodigoDeErro,
  mensagem: string,
  cabecalhos: Record<string, string> = {},
): Response {
  return Response.json({ erro: { codigo, mensagem } }, { status, headers: cabecalhos })
}

export type Autenticado = { clienteId: string; chaveId: string; publico: string }

export async function autenticarChave(request: Request, escopo: EscopoDaApi): Promise<Autenticado | Response> {
  const declarado = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declarado) && declarado > LIMITE_DO_CORPO_EM_BYTES) {
    return erroDaApi(413, 'corpo_grande', 'O corpo passa de 64 KB.')
  }

  const token = tokenDoCabecalho(request.headers.get('authorization'))
  const lida = token ? lerChave(token) : null
  if (!lida) {
    return erroDaApi(401, 'nao_autenticado', 'Envie a chave no cabeçalho Authorization: Bearer af_live_...')
  }

  if (!(await consumirLimite(`api:${lida.publico}`, TETO_POR_MINUTO, JANELA_EM_SEGUNDOS))) {
    return erroDaApi(429, 'limite_excedido', `Limite de ${TETO_POR_MINUTO} chamadas por minuto por chave.`, {
      'Retry-After': String(JANELA_EM_SEGUNDOS),
    })
  }

  let conferida
  try {
    conferida = await conferirChaveDeApi(lida.publico, lida.segredo)
  } catch (erro) {
    // Banco fora do ar fecha a porta. O motivo vai para o log, a chave não.
    console.error(`[api] não deu para conferir a chave ${lida.publico}:`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para conferir a chave agora. Tente de novo.')
  }
  if (!conferida) {
    // A mesma resposta para chave inexistente, errada e revogada: separar os
    // três diria a quem testa chaves qual delas já existiu.
    return erroDaApi(401, 'nao_autenticado', 'Chave inválida ou revogada.')
  }

  if (!conferida.escopos.includes(escopo)) {
    return erroDaApi(403, 'escopo_insuficiente', `Esta chave não tem o escopo ${escopo}.`)
  }

  const recusa = await recusaDoPlano(conferida.clienteId, 'api')
  if (recusa) return erroDaApi(403, 'plano_sem_api', recusa)

  after(() => registrarUsoDaChave(conferida.chaveId))
  return { clienteId: conferida.clienteId, chaveId: conferida.chaveId, publico: conferida.publico }
}

/**
 * O corpo como JSON, conferindo o tamanho de verdade (o `content-length` pode
 * mentir ou faltar).
 */
export async function lerCorpo(request: Request): Promise<{ ok: true; corpo: unknown } | { ok: false; resposta: Response }> {
  let texto: string
  try {
    texto = await request.text()
  } catch {
    return { ok: false, resposta: erroDaApi(400, 'json_invalido', 'Não foi possível ler o corpo.') }
  }
  if (new TextEncoder().encode(texto).byteLength > LIMITE_DO_CORPO_EM_BYTES) {
    return { ok: false, resposta: erroDaApi(413, 'corpo_grande', 'O corpo passa de 64 KB.') }
  }
  try {
    return { ok: true, corpo: JSON.parse(texto) }
  } catch {
    return { ok: false, resposta: erroDaApi(400, 'json_invalido', 'O corpo não é JSON válido.') }
  }
}

/** A primeira falha do zod, numa frase. */
export function frasesDoZod(issues: { path: PropertyKey[]; message: string }[]): string {
  const primeira = issues[0]
  if (!primeira) return 'Corpo inválido.'
  const caminho = primeira.path.map(String).join('.')
  return caminho ? `${caminho}: ${primeira.message}` : primeira.message
}
