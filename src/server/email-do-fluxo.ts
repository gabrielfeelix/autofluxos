import 'server-only'
import { alertar } from './alertar'
import { db, ehIdInvalido } from './db'
import { enviarEmailDoFluxo } from './email'
import { acharCliente } from './repos/clientes'
import { anotar } from './repos/eventos'

/**
 * O bloco Enviar e-mail, do lado do servidor (docs/PLANO-9-DA-COLMEIA.md, 6).
 *
 * O motor entrega o endereço, o assunto e o texto já interpolados. Aqui fica
 * o que o motor não sabe: se o endereço é de verdade, se a conta ainda tem
 * e-mail no dia e quem assina.
 *
 * **O teto do dia protege o domínio de envio, não a conta.** Todo e-mail de
 * fluxo sai de `mail.dialogon.com.br`, e um fluxo com defeito em laço
 * mandando mil e-mails por hora derrubaria a reputação do domínio para todas
 * as contas, inclusive o "esqueci a senha". 300 por conta em 24h cobre
 * confirmação e aviso à equipe com folga.
 *
 * Nunca lança: e-mail que não saiu vira registro e alerta, e a conversa segue.
 */

export const TETO_DE_EMAILS_POR_DIA = 300

const FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function enviarEmailDoBloco(
  contato: { id: string; clienteId: string },
  acao: { para: string; assunto: string; texto: string; paraAEquipe: boolean },
): Promise<void> {
  const para = acao.para.trim().toLowerCase()
  // `{{email}}` de quem nunca informou o e-mail chega vazio ou com a chave
  // literal: não é erro do fluxo, é contato sem e-mail.
  if (!FORMATO.test(para)) return

  try {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await db()
      .from('eventos_do_contato')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', contato.clienteId)
      .eq('tipo', 'email-enviado')
      .gte('criado_em', desde)
    if (error && !ehIdInvalido(error)) throw error
    if ((count ?? 0) >= TETO_DE_EMAILS_POR_DIA) {
      await alertar('teto diário de e-mail de fluxo atingido', new Error(`${TETO_DE_EMAILS_POR_DIA} em 24h`), {
        cliente: contato.clienteId,
      })
      return
    }

    const cliente = await acharCliente(contato.clienteId)
    if (!cliente) return
    const responderPara = cliente.email && FORMATO.test(cliente.email) ? cliente.email : null

    const saiu = await enviarEmailDoFluxo({
      para,
      assunto: acao.assunto.slice(0, 200),
      texto: acao.texto,
      empresa: cliente.nome,
      responderPara,
    })
    if (!saiu) return

    await anotar(contato.clienteId, contato.id, 'email-enviado', {
      assunto: acao.assunto.slice(0, 200),
      // O endereço fica fora do histórico: o da equipe não é dado do contato,
      // e o do contato já está na ficha.
      ...(acao.paraAEquipe ? { equipe: true } : {}),
    })
  } catch (erro) {
    await alertar('não foi possível enviar o e-mail do fluxo', erro, { contato: contato.id })
  }
}
