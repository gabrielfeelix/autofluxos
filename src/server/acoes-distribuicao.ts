'use server'

import {
  definirAjustesDaConta,
  definirAtendente,
  type ModoDeDistribuicao,
} from './repos/distribuicao'
import { exigirAcessoAoCliente, podeAdministrarConta } from './sessao'

/**
 * Quem mexe na distribuição é quem administra a conta.
 *
 * Não é frescura de papel: ligar "só quem assumiu responde" muda o que o colega
 * ao lado consegue fazer, e quem tem o poder de mudar o trabalho dos outros é
 * quem já tem o poder de tirá-los da conta.
 */
async function exigirAdministracao(clienteId: string) {
  const acesso = await exigirAcessoAoCliente(clienteId)
  if (!podeAdministrarConta(acesso)) {
    return { acesso, erro: 'só quem administra a conta muda a distribuição' }
  }
  return { acesso, erro: null }
}

export async function acaoDefinirDistribuicao(
  clienteId: string,
  ajustes: { distribuicao?: ModoDeDistribuicao; exigeAssumir?: boolean },
): Promise<{ ok: boolean; erro?: string }> {
  const { erro } = await exigirAdministracao(clienteId)
  if (erro) return { ok: false, erro }

  if (ajustes.distribuicao && !['manual', 'balanceado'].includes(ajustes.distribuicao)) {
    return { ok: false, erro: 'modo de distribuição que não existe' }
  }

  const r = await definirAjustesDaConta(clienteId, ajustes)
  return r
}

export async function acaoDefinirAtendente(
  clienteId: string,
  usuarioId: string,
  ajuste: { entraNoRodizio: boolean; tetoSimultaneo: number },
): Promise<{ ok: boolean; erro?: string }> {
  const { erro } = await exigirAdministracao(clienteId)
  if (erro) return { ok: false, erro }

  const id = usuarioId?.trim() ?? ''
  if (id === '') return { ok: false, erro: 'não deu para saber de quem é o ajuste' }

  /*
   * O teto é preso entre 0 e 200 aqui, e não só na tela.
   *
   * Zero é sem teto, e o valor vem de um campo de número que aceita o que a
   * pessoa digitar. Um teto negativo tiraria todo mundo do rodízio em silêncio,
   * e um teto de dez mil é a mesma coisa que zero com cara de regra.
   */
  const teto = Math.min(200, Math.max(0, Math.trunc(Number(ajuste.tetoSimultaneo) || 0)))

  const r = await definirAtendente(clienteId, id, {
    entraNoRodizio: ajuste.entraNoRodizio === true,
    tetoSimultaneo: teto,
  })
  return r
}

/*
 * Sem `revalidatePath` desde 25/set. Ele redesenhava a tela da equipe, que já
 * mudou no clique (`conta/distribuicao.tsx`), e o Inbox, com a intenção de
 * avisar "uma aba aberta noutro monitor": isso ele nunca fez, porque só age na
 * aba que chamou a ação. O Inbox lê a trava do banco ao carregar, e o servidor
 * recusa a resposta de quem não assumiu (`podeResponderAgora`) de todo jeito.
 */
