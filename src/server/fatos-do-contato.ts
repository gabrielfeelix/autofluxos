import 'server-only'
import type { ContextoDoAtendimento } from '@/core/engine/executar'
import { db } from './db'

/**
 * O que a condição pode perguntar sobre o contato sem ninguém ter guardado
 * nada (06/nov/2026): as etiquetas, as etapas de quadro em que ele está e o
 * canal da conversa.
 *
 * Duas leituras pequenas por execução, em paralelo. **Falhar aqui não derruba
 * a conversa**: sem os fatos, a regra de etiqueta responde "não tem" e o fluxo
 * segue pela saída falsa, que é o desfecho menos ruim de um banco lento.
 */
export async function comFatosDoContato(
  atendimento: ContextoDoAtendimento,
  contatoId: string | undefined,
): Promise<ContextoDoAtendimento> {
  if (!contatoId) return atendimento
  try {
    const [etiquetas, cartoes, contato] = await Promise.all([
      db().from('contato_etiquetas').select('etiqueta_id').eq('contato_id', contatoId),
      // Cartão fechado (ganho, perdido) não é "está na etapa": é história.
      db().from('quadro_cartoes').select('coluna_id').eq('contact_id', contatoId).is('fechado_em', null),
      db().from('contacts').select('canal').eq('id', contatoId).maybeSingle(),
    ])
    return {
      ...atendimento,
      etiquetas: (etiquetas.data ?? []).map((l) => l.etiqueta_id as string),
      colunas: (cartoes.data ?? []).map((l) => l.coluna_id as string),
      // Contato de antes da 0166 não tem canal gravado, e antes dela só
      // existia o WhatsApp.
      canal: (contato.data?.canal as string | null) ?? 'whatsapp',
    }
  } catch (erro) {
    console.error('[fatos-do-contato] não foi possível ler', contatoId, erro)
    return atendimento
  }
}
