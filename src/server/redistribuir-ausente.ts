import 'server-only'
import { alertar } from './alertar'
import { bancoDoLogin } from './auth'
import { db, ehIdInvalido } from './db'
import { distribuirSeSemDono } from './distribuir-atendimento'
import { atribuirContato } from './repos/conversas'
import { ajustesDaConta } from './repos/distribuicao'
import { anotar } from './repos/eventos'
import { membrosDaConta } from './repos/usuarios'

/**
 * Quem ficou ausente não segura conversa esperando resposta
 * (docs/PLANO-9-DA-COLMEIA.md, item 9).
 *
 * Na distribuição automática, a conversa é de quem o rodízio escolheu. Se
 * essa pessoa sai para o almoço e marca "ausente", o rodízio já para de mandar
 * conversa nova para ela, mas as que **já estavam com ela e esperam resposta**
 * ficavam paradas até ela voltar. É o lead que esfria com a equipe inteira
 * disponível.
 *
 * Aqui, ao ficar ausente, cada conversa aberta dela cuja última mensagem é do
 * cliente volta ao rodízio e vai para quem pode receber agora. Sem ninguém
 * apto, fica sem dono, no "Sem dono" da fila, que é melhor que presa com
 * quem não está. Cada passagem fica escrita na ficha.
 *
 * Só nas contas com distribuição automática: na manual, quem distribui é
 * gente, e mexer no que ela decidiu seria surpresa.
 *
 * Nunca lança: o interruptor de presença não pode falhar por causa disto.
 */

const POR_CONTA = 200

export async function redistribuirAoFicarAusente(usuarioId: string): Promise<number> {
  let movidas = 0
  try {
    const { rows } = await bancoDoLogin().query(
      'select m."organizationId" as conta from public.af_membros m where m."userId" = $1',
      [usuarioId],
    )
    for (const { conta } of rows as { conta: string }[]) {
      movidas += await redistribuirNaConta(conta, usuarioId)
    }
  } catch (erro) {
    await alertar('não foi possível redistribuir as conversas de quem ficou ausente', erro, { usuario: usuarioId })
  }
  return movidas
}

async function redistribuirNaConta(clienteId: string, usuarioId: string): Promise<number> {
  const ajustes = await ajustesDaConta(clienteId)
  if (ajustes.distribuicao === 'manual') return 0

  const { data, error } = await db()
    .from('leads')
    .select('contact_id')
    .eq('client_id', clienteId)
    .eq('atribuido_a', usuarioId)
    .eq('estado_efetivo', 'aberta')
    .eq('ultima_direcao', 'entrada')
    .limit(POR_CONTA)
  if (ehIdInvalido(error)) return 0
  if (error) throw new Error(`não foi possível ler as conversas esperando resposta: ${error.message}`)

  const contatos = (data as { contact_id: string }[]).map((l) => l.contact_id)
  if (contatos.length === 0) return 0

  const nomes = new Map((await membrosDaConta(clienteId)).map((m) => [m.id, m.nome]))
  let movidas = 0
  for (const contatoId of contatos) {
    // Solta primeiro: `distribuirSeSemDono` só escolhe para conversa sem dono.
    if (!(await atribuirContato(clienteId, contatoId, null))) continue
    const novo = await distribuirSeSemDono(clienteId, contatoId)
    // O rodízio pode devolver a própria pessoa se a presença ainda não
    // tiver sido lida como ausente; aí a conversa fica com ela, como estava.
    if (novo === usuarioId) continue
    movidas += 1
    await anotar(clienteId, contatoId, 'redistribuida', {
      de: nomes.get(usuarioId) ?? null,
      para: novo ? (nomes.get(novo) ?? null) : null,
    })
  }
  return movidas
}
