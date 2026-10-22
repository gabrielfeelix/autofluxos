import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { destinatariosDoEvento } from '@/core/eventos-da-verandi'
import { alertar } from '@/server/alertar'
import { consumirLimite } from '@/server/limite'
import { tratarEvento } from '@/server/receber-evento'
import { marcarChamada, marcarRecusa, segredosAtivos } from '@/server/repos/webhooks-de-entrada'

/**
 * Onde chegam os avisos da Verandi (a ponte entre os dois produtos).
 *
 * Fala o formato da Verandi, e não o do webhook genérico: ela assina
 * `instante.corpo` com HMAC-SHA256 em hex (`Verandi-Signature`,
 * `Verandi-Timestamp`) e manda `{ evento, eventoId, criadoEm, dados }`, com o
 * telefone dentro de `dados`. O webhook genérico espera outra assinatura e o
 * telefone no topo, e por isso o aviso da Verandi nunca entrava por lá.
 *
 * O segredo é o do webhook de entrada que o botão "Receber os avisos" criou,
 * e o mesmo valor foi mandado para a Verandi na hora (`server/ponte-verandi.ts`).
 *
 * A ordem das defesas é a da rota genérica: teto de corpo, limite por conta,
 * assinatura, e só depois o banco. Responde 200 assim que confere, e o
 * resto acontece depois: a Verandi tenta de novo quando não recebe 2xx, e
 * tentar de novo um aviso que já saiu mandaria a mensagem duas vezes.
 */

const LIMITE_DO_CORPO_EM_BYTES = 64 * 1024
const JANELA_DA_ASSINATURA_EM_SEGUNDOS = 300

export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params

  const tamanhoDeclarado = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > LIMITE_DO_CORPO_EM_BYTES) {
    return Response.json({ erro: 'corpo excede 64 KB' }, { status: 413 })
  }
  if (!(await consumirLimite(`verandi:${clienteId}`, 300, 60))) {
    return Response.json({ erro: 'muitas chamadas' }, { status: 429 })
  }

  let corpo: string
  try {
    corpo = await req.text()
  } catch {
    return Response.json({ erro: 'não foi possível ler o corpo' }, { status: 400 })
  }
  if (new TextEncoder().encode(corpo).byteLength > LIMITE_DO_CORPO_EM_BYTES) {
    return Response.json({ erro: 'corpo excede 64 KB' }, { status: 413 })
  }

  // O instante entra na assinatura: aviso guardado e repetido amanhã não passa.
  const instante = Number(req.headers.get('verandi-timestamp'))
  if (!Number.isFinite(instante) || Math.abs(Date.now() / 1000 - instante) > JANELA_DA_ASSINATURA_EM_SEGUNDOS) {
    return Response.json({ erro: 'assinatura inválida' }, { status: 401 })
  }
  const webhookId = await quemAssinou(clienteId, `${instante}.${corpo}`, req.headers.get('verandi-signature'))
  if (!webhookId) {
    after(() => marcarRecusa(clienteId))
    return Response.json({ erro: 'assinatura inválida' }, { status: 401 })
  }

  let aviso: { evento?: unknown; dados?: unknown }
  try {
    aviso = JSON.parse(corpo) as typeof aviso
  } catch {
    return Response.json({ erro: 'corpo não é JSON válido' }, { status: 400 })
  }
  const evento = typeof aviso.evento === 'string' ? aviso.evento.trim().slice(0, 120) : ''
  const dados = aviso.dados && typeof aviso.dados === 'object' ? (aviso.dados as Record<string, unknown>) : {}
  if (!evento) return Response.json({ erro: 'corpo sem evento' }, { status: 400 })

  after(async () => {
    try {
      await marcarChamada(webhookId)
      for (const d of destinatariosDoEvento(evento, dados)) {
        await tratarEvento({ clienteId, evento, telefone: d.telefone, dados, variaveis: d.variaveis })
      }
    } catch (erro) {
      console.error('[verandi] falhou ao processar o aviso', erro)
      await alertar('o aviso da Verandi não foi processado', erro, { cliente: clienteId, evento })
    }
  })
  return Response.json({ ok: true }, { status: 200 })
}

/** Qual webhook desta conta assinou, em tempo constante. Cofre fora do ar fecha a porta. */
async function quemAssinou(clienteId: string, assinado: string, cabecalho: string | null): Promise<string | null> {
  if (!cabecalho || !/^[0-9a-f]{64}$/i.test(cabecalho)) return null
  const recebida = Buffer.from(cabecalho, 'hex')
  let webhooks: { id: string; segredo: string }[]
  try {
    webhooks = await segredosAtivos(clienteId)
  } catch (erro) {
    console.error('[verandi] não foi possível ler os segredos', erro)
    return null
  }
  for (const w of webhooks) {
    if (timingSafeEqual(createHmac('sha256', w.segredo).update(assinado).digest(), recebida)) return w.id
  }
  return null
}
