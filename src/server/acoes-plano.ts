'use server'

import { revalidatePath } from 'next/cache'
import type { IdDoPlano } from '@/core/planos'
import { planoVigente } from './repos/planos'
import { registrar } from './repos/auditoria'
import { planoDaConta } from './repos/plano'
import { exigirAcessoAoCliente, podeAdministrarConta } from './sessao'

/**
 * O pedido de mudança de plano.
 *
 * **Isto registra uma intenção, e não cobra nem troca nada.** O gateway de
 * pagamento é decisão comercial e ainda não foi contratado (item 4 do handoff de
 * 16/set), e o desenho combinado é explícito: o botão existe antes do gateway.
 * Uma tela de plano sem botão não é metade da solução, é uma tela que não faz
 * nada.
 *
 * Por que o cliente não troca o próprio plano direto: trocar de plano é mudar o
 * que ele paga, e não existe ninguém cobrando. Um botão que mudasse
 * `clients.plano` sozinho faria a conta subir de faixa sem fatura nenhuma atrás,
 * e a primeira pessoa a descobrir isso seria quem quisesse descer de volta no
 * fim do mês. Quando o gateway chegar, a troca passa a ser efeito do webhook
 * dele, e `definirPlano` continua sendo onde ela acontece.
 *
 * O pedido vai para a auditoria, e não para uma tabela nova, por duas razões: é
 * append-only no banco desde a 0021, então ninguém apaga o pedido de um cliente
 * por engano; e ela já é a tela que alguém da 4YU abre para ver o que aconteceu.
 *
 * Exige administrar a conta, no molde de `acoes-chave-de-ia.ts`: quem atende no
 * Inbox não deveria poder pedir mudança de faixa sem querer.
 */
export async function acaoPedirTrocaDePlano(
  clienteId: string,
  desejado: IdDoPlano,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirAcessoAoCliente(clienteId)
  if (!podeAdministrarConta(acesso)) {
    return { ok: false, erro: 'só quem administra a conta pode pedir mudança de plano' }
  }

  if (desejado !== 'essencial' && desejado !== 'operacao' && desejado !== 'escala') {
    return { ok: false, erro: 'esse plano não existe' }
  }

  const atual = await planoDaConta(clienteId)
  if (atual === desejado) {
    return { ok: false, erro: 'a conta já está neste plano' }
  }

  /*
   * A auditoria nunca estoura, de propósito (ver `repos/auditoria.ts`). Aqui
   * isso significa que um pedido pode se perder em silêncio, e é por isso que a
   * tela diz que alguém vai entrar em contato em vez de dizer que o pedido foi
   * registrado: prometer registro é prometer o que esta chamada não garante.
   */
  await registrar({
    acao: 'pediu_troca_de_plano',
    autorId: acesso.sessao.usuario.id,
    autorEmail: acesso.sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'plano',
    alvoNome: (await planoVigente(desejado)).nome,
    detalhes: { de: atual, para: desejado },
  })

  revalidatePath(`/clientes/${clienteId}/ajustes/plano`)
  return { ok: true }
}
