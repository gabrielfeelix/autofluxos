'use server'

import { dentroDaJanela } from '@/channels/janela'
import { autorDaPessoa } from '@/core/autor-da-mensagem'
import { lerValor } from '@/core/crm'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { cancelarCobranca, criarCobranca, HORAS_PARA_VENCER_NO_INBOX, textoDaCobranca } from './cobrancas'
import { podeResponderAgora } from './distribuir-atendimento'
import { exigirCapacidade, meuAlcance, recusou } from './permissoes'
import { recusaDoPlano } from './recursos-do-plano'
import type { CobrancaRegistrada } from './repos/cobrancas'
import { atribuirSeSemDono, confirmarEntrega, contextoDeResposta, definirStatusDaSessao, registrarSaida } from './repos/conversas'
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
  entrada: { valor: string; descricao: string; documento?: string },
): Promise<ResultadoDoCobrar> {
  const acesso = await exigirCapacidade(clienteId, 'registrar_venda', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite cobrar. Peça ao dono da conta.' }
  const recusa = await recusaDoPlano(clienteId, 'integracoes')
  if (recusa) return { ok: false, erro: recusa }

  const lead = await acharLead(clienteId, contatoId, await meuAlcance(clienteId))
  if (!lead) return { ok: false, erro: 'Contato não encontrado.' }

  const valor = lerValor(entrada.valor)
  if (!valor.ok || valor.valor === null || valor.valor <= 0) return { ok: false, erro: 'Digite o valor, por exemplo 109,80.' }
  const valorCentavos = Math.round(valor.valor * 100)
  if (valorCentavos > 100_000_000) return { ok: false, erro: 'Valor acima do permitido para uma cobrança.' }
  const descricao = entrada.descricao.trim()
  if (descricao === '') return { ok: false, erro: 'Diga o que está sendo cobrado.' }
  if (descricao.length > DESCRICAO_MAXIMA) return { ok: false, erro: `A descrição passa de ${DESCRICAO_MAXIMA} caracteres.` }

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

  let canal
  try {
    canal = await adaptadorDoCanal(contexto.canal)
  } catch {
    return { ok: false, erro: 'A cobrança foi criada, mas o canal não respondeu. Copie o Pix pela tela Cobranças.' }
  }

  // 1. O resumo, com o botão do link quando o canal tem botão.
  const texto = textoDaCobranca(cobranca)
  const comBotao = cobranca.link ? canal.enviarBotaoDeLink?.bind(canal) : undefined
  const textoSemBotao = cobranca.link && !comBotao ? `${texto}\n${cobranca.link}` : texto
  const resumo = await registrarSaida({
    contatoId,
    sessaoId: contexto.sessaoId,
    texto: textoSemBotao,
    payload: {
      cobranca: cobranca.id,
      ...(comBotao ? { botao: { rotulo: 'Pagar', url: cobranca.link! } } : {}),
    },
    autor,
  })
  try {
    const id = comBotao
      ? await comBotao(contexto.waId, texto, 'Pagar', cobranca.link!)
      : await canal.enviarTexto(contexto.waId, textoSemBotao)
    await confirmarEntrega(resumo, id)
  } catch {
    return { ok: false, erro: 'A cobrança foi criada, mas a mensagem não saiu. Copie o Pix pela tela Cobranças.' }
  }

  // 2. O Pix copia e cola sozinho: no celular, tocar e segurar copia a mensagem inteira.
  if (cobranca.pixCopiaCola) {
    const pix = await registrarSaida({
      contatoId,
      sessaoId: contexto.sessaoId,
      texto: cobranca.pixCopiaCola,
      payload: { cobranca: cobranca.id, pix: true },
      autor,
    })
    try {
      await confirmarEntrega(pix, await canal.enviarTexto(contexto.waId, cobranca.pixCopiaCola))
    } catch {
      return { ok: false, erro: 'O resumo saiu, mas o código Pix não. Copie o Pix pela tela Cobranças.' }
    }
  }

  if (contexto.sessaoId) await definirStatusDaSessao(contexto.sessaoId, 'humano')
  if (quem) await atribuirSeSemDono(clienteId, contatoId, quem.usuario.id).catch(() => undefined)
  return { ok: true, cobranca }
}

export async function acaoCancelarCobranca(
  clienteId: string,
  cobrancaId: string,
): Promise<{ ok: true; status: CobrancaRegistrada['status'] } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'registrar_venda', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite cancelar cobrança.' }
  return cancelarCobranca(clienteId, cobrancaId, acesso.sessao.usuario.nome?.trim() || null)
}
