'use server'

import { mudarMarketing } from './consentimento'
import { alcancaContato, exigirCapacidade, recusou } from './permissoes'
import { sessaoAtual } from './sessao'

/**
 * A equipe marca, na ficha, se a pessoa recebe promoções.
 *
 * Para os dois casos que a conversa não resolve sozinha: a pessoa pediu por
 * telefone ou no balcão, e a pessoa que tinha saído pediu para voltar. Grava
 * com origem `manual` e o nome de quem marcou na linha do tempo, porque é a
 * palavra da equipe, e não a da pessoa, que sustenta este registro.
 *
 * Sem `revalidatePath`: a ficha muda na hora pelo interruptor otimista.
 */
export async function acaoMarcarPromocoes(
  clienteId: string,
  contatoId: string,
  aceito: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso
  if (!(await alcancaContato(clienteId, contatoId, acesso))) {
    return { ok: false, erro: 'este contato não é deste cliente' }
  }

  const quemFez = await sessaoAtual()
  await mudarMarketing({
    clienteId,
    contatoId,
    aceito,
    origem: 'manual',
    textoExibido: null,
    autor: quemFez?.usuario.nome ?? null,
  })
  return { ok: true }
}
