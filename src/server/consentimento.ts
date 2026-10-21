import 'server-only'
import type { Canal } from '@/channels/types'
import { AUTOR_AUTOMACAO } from '@/core/autor-da-mensagem'
import { CONFIRMACAO_DA_SAIDA, type OrigemDoConsentimento } from '@/core/consentimento'
import { alertar } from './alertar'
import { db, ehIdInvalido } from './db'
import { marketingDoContato, registrarConsentimento } from './repos/consentimentos'
import { confirmarEntrega, registrarSaida } from './repos/conversas'
import { anotar } from './repos/eventos'

/**
 * Aceite e saída das promoções, com o que cada um significa para o resto do
 * produto: linha do tempo, resposta à pessoa, e nunca duas linhas iguais
 * seguidas. A tabela e o motivo de ela existir estão em
 * `repos/consentimentos.ts` e `core/consentimento.ts`.
 */

/**
 * Grava o novo estado, se ele for **novo**.
 *
 * Mandar "SAIR" três vezes não vira três linhas: a prova é de quando a pessoa
 * mudou de ideia, e repetir o mesmo estado só polui o registro. Devolve se
 * gravou.
 */
export async function mudarMarketing(entrada: {
  clienteId: string
  contatoId: string
  aceito: boolean
  origem: OrigemDoConsentimento
  textoExibido: string | null
  autor?: string | null
}): Promise<boolean> {
  const atual = await marketingDoContato(entrada.clienteId, entrada.contatoId)
  if (atual && atual.aceito === entrada.aceito) return false

  await registrarConsentimento({
    clienteId: entrada.clienteId,
    contatoId: entrada.contatoId,
    aceito: entrada.aceito,
    origem: entrada.origem,
    textoExibido: entrada.textoExibido,
  })
  await anotar(
    entrada.clienteId,
    entrada.contatoId,
    'consentimento',
    { aceito: entrada.aceito ? 'true' : 'false', origem: entrada.origem },
    entrada.autor ?? null,
  )
  return true
}

/**
 * A pessoa mandou "SAIR": grava, responde confirmando, e o bot não acorda.
 *
 * A confirmação sai **sempre que a pessoa pede**, mesmo que ela já tivesse
 * saído: quem manda "SAIR" de novo é porque não viu a primeira, e silêncio ali
 * se lê como pedido ignorado. A mensagem é de serviço, dentro da janela que a
 * própria pessoa acabou de abrir.
 *
 * Nunca estoura: o recebimento segue gravado mesmo se a resposta falhar, e o
 * alerta diz o que faltou.
 */
export async function atenderPedidoDeSaida(
  /** Montado só na hora de responder: a fábrica estoura quando falta token. */
  montarCanal: () => Canal,
  contato: { id: string; clienteId: string; waId: string },
  texto: string,
): Promise<void> {
  try {
    await mudarMarketing({
      clienteId: contato.clienteId,
      contatoId: contato.id,
      aceito: false,
      origem: 'mensagem',
      textoExibido: texto,
    })
  } catch (erro) {
    await alertar('não foi possível gravar o pedido de sair das promoções', erro, { contato: contato.id })
    return
  }

  try {
    // Grava antes de mandar e confirma depois, como toda saída (`registrarSaida`).
    const registro = await registrarSaida({
      contatoId: contato.id,
      sessaoId: null,
      autor: AUTOR_AUTOMACAO,
      texto: CONFIRMACAO_DA_SAIDA,
    })
    const wamid = await montarCanal().enviarTexto(contato.waId, CONFIRMACAO_DA_SAIDA)
    await confirmarEntrega(registro, wamid || null)
  } catch (erro) {
    await alertar('não foi possível confirmar a saída das promoções para a pessoa', erro, { contato: contato.id })
  }
}

/**
 * A Meta recusou um envio porque a pessoa parou as promoções pelo próprio
 * WhatsApp (erro 131050).
 *
 * É a mesma vontade do "SAIR", dita do outro lado, e por isso vira a mesma
 * linha: sem ela, a próxima transmissão tentaria de novo, a Meta recusaria de
 * novo, e a tela mostraria "falhou" sem nunca dizer por quê.
 *
 * O contato vem pelo `wamid`: primeiro a transmissão, que é de onde quase todo
 * marketing sai, e depois a conversa.
 */
export async function saidaPelaMeta(wamid: string): Promise<void> {
  try {
    const dono = await donoDoWamid(wamid)
    if (!dono) return
    await mudarMarketing({ ...dono, aceito: false, origem: 'meta', textoExibido: null })
  } catch (erro) {
    await alertar('não foi possível gravar a saída das promoções avisada pela Meta', erro, { wamid })
  }
}

async function donoDoWamid(wamid: string): Promise<{ clienteId: string; contatoId: string } | null> {
  const { data: destinatario, error } = await db()
    .from('transmissao_destinatarios')
    .select('contato_id, transmissoes (cliente_id)')
    .eq('wamid', wamid)
    .limit(1)
    .maybeSingle()
  if (error && !ehIdInvalido(error)) throw new Error(error.message)
  const linha = destinatario as { contato_id: string; transmissoes: { cliente_id: string } | null } | null
  if (linha?.transmissoes) return { clienteId: linha.transmissoes.cliente_id, contatoId: linha.contato_id }

  const { data: mensagem, error: erro } = await db()
    .from('messages')
    .select('contact_id, contacts (client_id)')
    .eq('wa_message_id', wamid)
    .limit(1)
    .maybeSingle()
  if (erro && !ehIdInvalido(erro)) throw new Error(erro.message)
  const msg = mensagem as { contact_id: string; contacts: { client_id: string } | null } | null
  return msg?.contacts ? { clienteId: msg.contacts.client_id, contatoId: msg.contact_id } : null
}
