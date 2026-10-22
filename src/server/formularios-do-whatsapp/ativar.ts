import 'server-only'
import { createPublicKey } from 'node:crypto'
import { FLOW_JSON_DE_AGENDAMENTO } from '@/core/formulario-de-agendamento'
import { guardarNoCofre, lerDoCofre } from '../cofre'
import { db } from '../db'
import { enderecoDoPainel } from '../endereco'
import { lerTokenDoCanal, type CanalSalvo } from '../repos/conversas'
import { atualizarFormulario, criarFormulario, formulariosDaConta, type FormularioDoWhatsapp } from '../repos/formularios-do-whatsapp'
import { gerarParDeChaves } from './cripto'
import { chaveDaAgenda } from './agenda'

/**
 * Ativar o formulário de agendamento num número de WhatsApp. Tudo por API,
 * com o token do número (o do Embedded Signup), nada de painel:
 *
 * 1. **par de chaves** RSA 2048: a privada vai para o cofre; a linha da 0143
 *    guarda só a referência;
 * 2. **chave pública no número**: `POST /{phone_number_id}/whatsapp_business_encryption`;
 * 3. **o Flow na WABA** com o JSON de `core/formulario-de-agendamento.ts` e o
 *    nosso endpoint (`/api/webhook/formulario-whatsapp/<id>`);
 * 4. **o app ligado ao Flow** (`application_id`): Flow com endpoint não
 *    publica sem app;
 * 5. **publicar**. A Meta chama o endpoint (ping) antes de aceitar, então só
 *    publica com o endpoint no ar, em produção.
 *
 * Refazer é seguro: cada passo pula o que já foi feito, e o erro do passo que
 * falhou fica na linha, para a tela mostrar.
 */

const VERSAO = process.env.META_GRAPH_VERSION ?? 'v25.0'

type CanalDoNumero = { id: string; clienteId: string; phoneNumberId: string; wabaId: string; tokenRef: string | null }

async function graph(caminho: string, token: string, corpo: Record<string, unknown> | URLSearchParams): Promise<Record<string, unknown>> {
  const comoFormulario = corpo instanceof URLSearchParams
  const resposta = await fetch(`https://graph.facebook.com/${VERSAO}/${caminho}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': comoFormulario ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: comoFormulario ? corpo.toString() : JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  })
  const lido = (await resposta.json().catch(() => ({}))) as Record<string, unknown>
  if (!resposta.ok) {
    const erro = lido.error as { message?: string; error_user_msg?: string; code?: number } | undefined
    throw new Error(`a Meta recusou: ${erro?.error_user_msg ?? erro?.message ?? resposta.status}${erro?.code ? ` [${erro.code}]` : ''}`)
  }
  return lido
}

/** Os erros de validação do Flow JSON, numa frase só. */
function errosDoFlow(resposta: Record<string, unknown>): string | null {
  const erros = resposta.validation_errors
  if (!Array.isArray(erros) || erros.length === 0) return null
  return erros
    .map((e) => (e && typeof e === 'object' ? String((e as { message?: unknown }).message ?? (e as { error?: unknown }).error ?? '') : ''))
    .filter(Boolean)
    .join('; ')
}

/**
 * Os números de WhatsApp da conta que podem ter formulário: Cloud API, ativos,
 * com WABA. Sem token próprio é o número da 4YU, e vale o `WHATSAPP_TOKEN`,
 * como no envio (`adaptador-do-canal.ts`).
 */
export async function numerosParaFormulario(clienteId: string): Promise<(CanalDoNumero & { telefone: string | null })[]> {
  const { data, error } = await db()
    .from('channels')
    .select('id, client_id, phone_number_id, display_phone_number, waba_id, token_ref')
    .eq('client_id', clienteId)
    .eq('provider', 'cloud-api')
    .eq('status', 'ativo')
    .not('waba_id', 'is', null)
    .not('phone_number_id', 'is', null)
  if (error) throw new Error(`não foi possível listar os números: ${error.message}`)
  return (
    data as { id: string; client_id: string; phone_number_id: string; display_phone_number: string | null; waba_id: string; token_ref: string | null }[]
  ).map((l) => ({
    id: l.id,
    clienteId: l.client_id,
    phoneNumberId: l.phone_number_id,
    wabaId: l.waba_id,
    tokenRef: l.token_ref,
    telefone: l.display_phone_number,
  }))
}

export type ResultadoDaAtivacao = { ok: true; formulario: FormularioDoWhatsapp } | { ok: false; erro: string }

export async function ativarFormulario(clienteId: string, canalId: string): Promise<ResultadoDaAtivacao> {
  const numero = (await numerosParaFormulario(clienteId)).find((n) => n.id === canalId)
  if (!numero) return { ok: false, erro: 'Este número não está conectado pela Cloud API. Reconecte o WhatsApp em Canais.' }
  if (!(await chaveDaAgenda(clienteId))) return { ok: false, erro: 'Ligue a Verandi em Ajustes > Chaves antes de ativar o formulário.' }
  const appId = process.env.META_APP_ID
  if (!appId) return { ok: false, erro: 'Falta META_APP_ID no ambiente.' }

  const token = numero.tokenRef ? await lerTokenDoCanal({ tokenRef: numero.tokenRef } as CanalSalvo) : process.env.WHATSAPP_TOKEN
  if (!token) return { ok: false, erro: 'Este número não tem token próprio e falta WHATSAPP_TOKEN no ambiente.' }

  // 1. A linha e a chave: reaproveita a do número, se já existe.
  let formulario = (await formulariosDaConta(clienteId)).find((f) => f.canalId === canalId && f.modelo === 'agendamento')
  let publica: string | null = null
  if (!formulario) {
    const par = gerarParDeChaves()
    const ref = await guardarNoCofre(par.privada, `formulario-whatsapp:${canalId}`)
    formulario = await criarFormulario({ clienteId, canalId, chavePrivadaRef: ref })
    publica = par.publica
  }

  try {
    // 2. A pública sempre sobe de novo: é idempotente, e conserta o número
    // que trocou de chave por fora.
    if (!publica) {
      const privada = await lerDoCofre(formulario.chavePrivadaRef)
      if (!privada) throw new Error('a chave privada sumiu do cofre; apague e ative de novo')
      publica = createPublicKey(privada).export({ type: 'spki', format: 'pem' }).toString()
    }
    await graph(`${numero.phoneNumberId}/whatsapp_business_encryption`, token, new URLSearchParams({ business_public_key: publica }))

    // 3. O Flow, uma vez só.
    let flowId = formulario.flowId
    if (!flowId) {
      const criado = await graph(`${numero.wabaId}/flows`, token, {
        name: `Agendamento AutoFluxos ${formulario.id.slice(0, 8)}`,
        categories: ['APPOINTMENT_BOOKING'],
        flow_json: JSON.stringify(FLOW_JSON_DE_AGENDAMENTO),
        endpoint_uri: `${enderecoDoPainel()}/api/webhook/formulario-whatsapp/${formulario.id}`,
      })
      if (typeof criado.id !== 'string') throw new Error('a Meta não devolveu o id do formulário')
      flowId = criado.id
      await atualizarFormulario(formulario.id, { flowId })
      const invalido = errosDoFlow(criado)
      if (invalido) throw new Error(`o formulário tem erros: ${invalido}`)
    }

    // 4 e 5. O app e a publicação.
    if (formulario.status !== 'publicado') {
      await graph(flowId, token, { application_id: appId })
      await graph(`${flowId}/publish`, token, {})
    }
    await atualizarFormulario(formulario.id, { status: 'publicado', erro: null })
    return { ok: true, formulario: { ...formulario, flowId, status: 'publicado', erro: null } }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    await atualizarFormulario(formulario.id, { status: 'erro', erro: mensagem }).catch(() => undefined)
    return { ok: false, erro: mensagem }
  }
}
