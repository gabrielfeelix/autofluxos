import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * O que cada pessoa já leu (`af_leituras`, 0023 + a função da 0025).
 *
 * **"Não lida" é por pessoa, não por conversa.** Uma coluna no contato diria
 * que a conversa foi lida porque *alguém* abriu — e "alguém leu" é exatamente
 * a informação que não ajuda ninguém a decidir o que abrir agora.
 *
 * Nada aqui existe quando quem entrou foi a senha única do time: sem usuário
 * não há de quem contar. As duas funções tratam `null` devolvendo o vazio, em
 * vez de o chamador ter que lembrar de perguntar antes.
 */

/** Acima disto a tela mostra "99+". Contar mais não muda decisão nenhuma. */
export const TETO_DA_INSIGNIA = 99

export async function naoLidasPorContato(
  usuarioId: string | null,
  contatos: string[],
): Promise<Map<string, number>> {
  const porContato = new Map<string, number>()
  if (!usuarioId || contatos.length === 0) return porContato

  const { data, error } = await db().rpc('nao_lidas_por_contato', {
    p_usuario_id: usuarioId,
    p_contatos: contatos,
  })

  if (ehIdInvalido(error)) return porContato
  if (error) {
    // **Degrada, não derruba.** A insígnia de não lidas é conforto; o Inbox é a
    // tela que alguém deixa aberta o dia inteiro, e ela não pode parar de abrir
    // porque uma contagem falhou.
    console.error('[leituras] não deu para contar as não lidas', error.message)
    return porContato
  }

  for (const linha of data as { contato_id: string; total: number }[]) {
    porContato.set(linha.contato_id, Number(linha.total))
  }
  return porContato
}

/**
 * "Eu abri esta conversa agora."
 *
 * `upsert` porque a primeira vez insere e as seguintes só empurram o relógio.
 * É idempotente de propósito: quem chama é a renderização da tela do Inbox, que
 * pode rodar duas vezes na mesma navegação, e escrever `now()` duas vezes é o
 * mesmo que escrever uma.
 *
 * Falha em silêncio pelo mesmo motivo da contagem: perder uma marcação de
 * leitura mostra uma insígnia a mais; estourar aqui fecha a tela de trabalho.
 */
export async function marcarComoLida(usuarioId: string | null, contatoId: string): Promise<void> {
  if (!usuarioId) return

  const { error } = await db()
    .from('af_leituras')
    .upsert(
      { usuario_id: usuarioId, contato_id: contatoId, lida_em: new Date().toISOString() },
      { onConflict: 'usuario_id,contato_id' },
    )

  if (error) console.error('[leituras] não deu para marcar como lida', error.message)
}
