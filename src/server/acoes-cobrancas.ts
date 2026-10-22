'use server'

import { dentroDaJanela } from '@/channels/janela'
import { autorDaPessoa } from '@/core/autor-da-mensagem'
import { lerValor } from '@/core/crm'
import { conferirItens, type ItemCobrado, type PedidoDeItem } from '@/core/cobrar-do-catalogo'
import { lojaAtivaDaConta } from './adaptador-da-loja'
import { cancelarCobranca, criarCobranca, HORAS_PARA_VENCER_NO_INBOX } from './cobrancas'
import { mandarCobrancaNaConversa } from './mandar-cobranca'
import { podeResponderAgora } from './distribuir-atendimento'
import { exigirCapacidade, meuAlcance, recusou } from './permissoes'
import { recusaDoPlano } from './recursos-do-plano'
import { cobrancasDaConversa, type CobrancaRegistrada } from './repos/cobrancas'
import { atribuirSeSemDono, contextoDeResposta, definirStatusDaSessao } from './repos/conversas'
import { acharLead } from './repos/leads'
import { sessaoAtual } from './sessao'

/**
 * O botão **Cobrar** do Inbox (cobrança no chat, etapa C).
 *
 * Quem pode: a capacidade `registrar_venda` (decisão 2 do plano). Dono e
 * gerente têm; o atendente só se ela for dada a ele, que é a mesma regra de
 * registrar venda, porque cobrar é fechar venda pela conversa.
 *
 * A ordem protege o dono de cobrança órfã: confere a janela de 24h **antes**
 * de criar no gateway. Fora da janela não há como mandar o Pix, e uma
 * cobrança criada que ninguém recebeu é Pix aberto na conta dele à toa.
 */

export type ResultadoDoCobrar =
  | { ok: true; cobranca: CobrancaRegistrada }
  | { ok: false; erro: string; pedeDocumento?: boolean }

const DESCRICAO_MAXIMA = 200

export async function acaoCobrarNaConversa(
  clienteId: string,
  contatoId: string,
  entrada: { valor?: string; descricao: string; documento?: string; itens?: PedidoDeItem[] },
): Promise<ResultadoDoCobrar> {
  const acesso = await exigirCapacidade(clienteId, 'registrar_venda', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite cobrar. Peça ao dono da conta.' }
  const recusa = await recusaDoPlano(clienteId, 'integracoes')
  if (recusa) return { ok: false, erro: recusa }

  const lead = await acharLead(clienteId, contatoId, await meuAlcance(clienteId))
  if (!lead) return { ok: false, erro: 'Contato não encontrado.' }

  const conferido = entrada.itens?.length ? await valorDosItens(clienteId, entrada.itens, entrada.descricao) : valorLivre(entrada)
  if (!conferido.ok) return conferido
  const { valorCentavos, descricao, itens } = conferido

  const trava = await podeResponderAgora(clienteId, contatoId, acesso.sessao.usuario.id)
  if (!trava.ok) return { ok: false, erro: trava.erro ?? 'Outra pessoa está atendendo esta conversa.' }
  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return { ok: false, erro: 'Esta conversa não tem um canal conectado para responder.' }
  if (!dentroDaJanela(contexto)) {
    return { ok: false, erro: 'Passaram mais de 24h desde a última mensagem da pessoa. A cobrança só sai dentro da janela.' }
  }

  const quem = await sessaoAtual()
  const autor = autorDaPessoa(quem?.usuario)
  const criada = await criarCobranca({
    clienteId,
    contatoId,
    valorCentavos,
    descricao,
    itens,
    venceEm: new Date(Date.now() + HORAS_PARA_VENCER_NO_INBOX * 3_600_000),
    origem: 'inbox',
    criadaPor: quem?.usuario.nome?.trim() || null,
    autorId: quem?.usuario.id ?? null,
    sessaoId: contexto.sessaoId,
    documento: entrada.documento ?? null,
  })
  if (!criada.ok) {
    return {
      ok: false,
      erro: criada.erro,
      pedeDocumento: criada.motivo === 'falta_documento' || criada.motivo === 'documento_invalido',
    }
  }
  const cobranca = criada.cobranca

  const enviada = await mandarCobrancaNaConversa(contatoId, contexto, cobranca, autor)
  if (!enviada.ok) return enviada

  if (contexto.sessaoId) await definirStatusDaSessao(contexto.sessaoId, 'humano')
  if (quem) await atribuirSeSemDono(clienteId, contatoId, quem.usuario.id).catch(() => undefined)
  return { ok: true, cobranca }
}

type ValorConferido = { ok: true; valorCentavos: number; descricao: string; itens: ItemCobrado[] | null } | { ok: false; erro: string }

/** Valor livre: sinal, ajuste, serviço avulso. Sem itens, de propósito. */
function valorLivre(entrada: { valor?: string; descricao: string }): ValorConferido {
  const valor = lerValor(entrada.valor ?? '')
  if (!valor.ok || valor.valor === null || valor.valor <= 0) return { ok: false, erro: 'Digite o valor, por exemplo 109,80.' }
  const valorCentavos = Math.round(valor.valor * 100)
  if (valorCentavos > 100_000_000) return { ok: false, erro: 'Valor acima do permitido para uma cobrança.' }
  const descricao = entrada.descricao.trim()
  if (descricao === '') return { ok: false, erro: 'Diga o que está sendo cobrado.' }
  if (descricao.length > DESCRICAO_MAXIMA) return { ok: false, erro: `A descrição passa de ${DESCRICAO_MAXIMA} caracteres.` }
  return { ok: true, valorCentavos, descricao, itens: null }
}

/**
 * Do catálogo: o preço é relido agora, na mesma loja da busca (catálogo
 * próprio, Magento ou Nuvemshop), e a soma é de `core/cobrar-do-catalogo.ts`.
 */
async function valorDosItens(clienteId: string, pedidos: PedidoDeItem[], descricao: string): Promise<ValorConferido> {
  const loja = await lojaAtivaDaConta(clienteId)
  if (!loja) return { ok: false, erro: 'Esta conta ainda não tem catálogo nem loja ligada.' }
  const ids = [...new Set(pedidos.map((p) => p.produtoId.trim()).filter(Boolean))].slice(0, 25)
  const lidos = await loja.lerPorSku(ids)
  if (!lidos.ok) return { ok: false, erro: 'O catálogo não respondeu agora. Tente de novo.' }
  const r = conferirItens(pedidos, lidos.valor, descricao)
  return r.ok ? { ok: true, valorCentavos: r.totalCentavos, descricao: r.descricao, itens: r.itens } : r
}

export async function acaoCancelarCobranca(
  clienteId: string,
  cobrancaId: string,
): Promise<{ ok: true; status: CobrancaRegistrada['status'] } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'registrar_venda', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite cancelar cobrança.' }
  return cancelarCobranca(clienteId, cobrancaId, acesso.sessao.usuario.nome?.trim() || null)
}

/**
 * O status de agora das cobranças desta conversa, para o cartão da bolha
 * mudar sozinho enquanto espera: pagar avisa pelo gateway, e o Inbox não tem
 * outro sinal disso. Só id e status, nada de valor.
 */
export async function acaoStatusDasCobrancas(
  clienteId: string,
  contatoId: string,
  ids: string[],
): Promise<Record<string, CobrancaRegistrada['status']>> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return {}
  const lead = await acharLead(clienteId, contatoId, await meuAlcance(clienteId))
  if (!lead) return {}
  const lidas = await cobrancasDaConversa(contatoId, ids.slice(0, 20))
  return Object.fromEntries(lidas.filter((c) => c.clienteId === clienteId).map((c) => [c.id, c.status]))
}
