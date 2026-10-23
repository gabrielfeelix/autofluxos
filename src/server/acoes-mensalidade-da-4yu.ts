'use server'

import { ErroDoAsaas } from '@/channels/asaas'
import { ehCicloDeCobranca, ehIdDePlano, type CicloDeCobranca, type IdDoPlano } from '@/core/planos'
import { alertar } from './alertar'
import { mensalidadeConfigurada, type DetalheDaFatura } from '@/channels/asaas-da-4yu'
import {
  assinar,
  cancelarMensalidade,
  detalheDaFaturaDaConta,
  mensalidadeLiberada,
  mudarAssinatura,
  origemDoAviso,
} from './mensalidade-da-4yu'
import { exigirCapacidade, recusou } from './permissoes'
import { cobrancaDaConta } from './repos/faturas-da-conta'
import { ehAdminDaPlataforma } from './sessao'

/**
 * O botão Assinar (docs/PLANO-MENSALIDADE-ASAAS.md, fase 2).
 *
 * Devolve o link da página de pagamento do Asaas, e a tela navega para lá. O
 * plano **não** muda aqui: muda quando o aviso de pago chega
 * (`aplicarAvisoDaMensalidade`).
 *
 * A mesma régua do pedido de troca: `configurar_empresa` no escopo `todos`.
 */
export async function acaoAssinar(
  clienteId: string,
  planoId: IdDoPlano,
  cicloPedido: CicloDeCobranca,
  dados: { documento?: string; email?: string } = {},
): Promise<{ ok: true; link: string } | { ok: false; erro: string; falta?: ('documento' | 'email')[] }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'só quem administra a organização pode assinar' }
  if (!mensalidadeLiberada(ehAdminDaPlataforma(acesso.sessao))) return { ok: false, erro: 'a assinatura ainda não está disponível' }
  if (!ehIdDePlano(planoId)) return { ok: false, erro: 'esse plano não existe' }
  if ((await cobrancaDaConta(clienteId)).forma !== 'asaas') {
    return { ok: false, erro: 'a cobrança desta organização é combinada direto com a 4YU' }
  }
  const ciclo: CicloDeCobranca = ehCicloDeCobranca(cicloPedido) ? cicloPedido : 'mensal'

  try {
    const feito = await assinar(clienteId, planoId, ciclo, origemDoAviso(), {
      documento: typeof dados.documento === 'string' ? dados.documento.slice(0, 30) : undefined,
      email: typeof dados.email === 'string' ? dados.email.slice(0, 200) : undefined,
    })
    if (!feito.ok) return feito
    if (!feito.link) return { ok: false, erro: 'a assinatura foi criada, mas o Asaas não devolveu a página de pagamento. Tente de novo.' }
    return { ok: true, link: feito.link }
  } catch (erro) {
    await alertar('não foi possível assinar pelo Asaas', erro, { cliente: clienteId, plano: planoId })
    if (erro instanceof ErroDoAsaas && erro.detalhe.codigo === 'invalid_cpfCnpj') {
      return { ok: false, erro: 'o Asaas recusou o CNPJ ou CPF cadastrado em Configurações, Negócio. Confira o número.' }
    }
    return { ok: false, erro: 'não foi possível abrir o pagamento agora. Tente de novo em instantes.' }
  }
}

/**
 * Mudar de plano com a assinatura já paga (fase 3). Mesma forma do pedido de
 * troca (`acaoPedirTrocaDePlano`), para a tela trocar uma pela outra: subir
 * vale na hora, descer fica agendado para a virada.
 */
export async function acaoMudarAssinatura(
  clienteId: string,
  desejado: IdDoPlano,
  _ciente: boolean,
  cicloPedido: CicloDeCobranca = 'mensal',
): Promise<{ ok: boolean; erro?: string; mensagem?: string; aplicado?: boolean }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'só quem administra a organização pode mudar o plano' }
  if (!mensalidadeLiberada(ehAdminDaPlataforma(acesso.sessao))) return { ok: false, erro: 'a assinatura ainda não está disponível' }
  if (!ehIdDePlano(desejado)) return { ok: false, erro: 'esse plano não existe' }
  const ciclo: CicloDeCobranca = ehCicloDeCobranca(cicloPedido) ? cicloPedido : 'mensal'
  try {
    return await mudarAssinatura(clienteId, desejado, ciclo)
  } catch (erro) {
    await alertar('não foi possível mudar a assinatura no Asaas', erro, { cliente: clienteId, plano: desejado })
    return { ok: false, erro: 'não foi possível mudar o plano agora. Tente de novo em instantes.' }
  }
}

/**
 * O detalhe de uma fatura, lido do Asaas ao abrir o painel lateral. Fatura é
 * dado financeiro da organização: a mesma régua de quem muda o plano.
 */
export async function acaoDetalheDaFatura(
  clienteId: string,
  faturaId: string,
): Promise<{ ok: true; detalhe: DetalheDaFatura } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'só quem administra a organização vê as faturas' }
  if (!mensalidadeConfigurada()) return { ok: false, erro: 'as faturas ainda não estão disponíveis' }
  try {
    const detalhe = await detalheDaFaturaDaConta(clienteId, faturaId)
    return detalhe ? { ok: true, detalhe } : { ok: false, erro: 'fatura não encontrada' }
  } catch (erro) {
    await alertar('não foi possível ler a fatura no Asaas', erro, { cliente: clienteId, fatura: faturaId })
    return { ok: false, erro: 'não foi possível carregar o detalhe agora. Tente de novo em instantes.' }
  }
}

/**
 * Cancelar a assinatura. As cobranças param; o plano fica como está até a 4YU
 * combinar o encerramento, e por isso o cancelamento também vira alerta para
 * alguém daqui procurar o cliente.
 */
export async function acaoCancelarAssinatura(clienteId: string): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'só quem administra a organização pode cancelar a assinatura' }
  try {
    const r = await cancelarMensalidade(clienteId)
    if (r.ok) await alertar('uma organização cancelou a assinatura', `cancelada por ${acesso.sessao.usuario.email}`, { cliente: clienteId })
    return r
  } catch (erro) {
    await alertar('não foi possível cancelar a assinatura no Asaas', erro, { cliente: clienteId })
    return { ok: false, erro: 'não foi possível cancelar agora. Tente de novo em instantes.' }
  }
}
