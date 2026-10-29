'use server'

import {
  lerResumo,
  limparTexto,
  produtosRelevantes,
  promptDoCopiloto,
  type FalaDaConversa,
  type Resumo,
  type TarefaDoCopiloto,
} from './ia/copiloto'
import { escolherModelo } from './ia/modelo'
import { alcancaContato, exigirCapacidade, recusou } from './permissoes'
import { acharCliente } from './repos/clientes'
import { cotaDeIaDaConta, registrarUsoDoCopiloto } from './repos/ia-chamadas'
import { contatosDaConta, lerConversa, type MensagemDoLead } from './repos/leads'
import { listarProdutos } from './repos/produtos'

/**
 * Os três gestos da IA do atendente no Inbox (docs/HANDOFF-29-OUT).
 *
 * **Nenhum deles envia nada.** Cada ação devolve texto para a tela, que o
 * mostra num cartão; entrar na caixa de resposta é um clique do atendente, e
 * sair para o cliente é outro. Ver `ia/copiloto.ts`.
 *
 * A cota é a das respostas de IA do plano. Quando acaba, a ação recusa com a
 * frase que a tela mostra, e responder à mão segue igual: nada aqui fica no
 * caminho do envio.
 */

export type RespostaDoCopiloto = { ok: true; texto: string } | { ok: false; erro: string }
export type ResumoDoCopiloto = { ok: true; resumo: Resumo | null; texto: string } | { ok: false; erro: string }

const SEM_COTA =
  'As respostas de IA do plano acabaram nestes 30 dias. Responder à mão continua funcionando normalmente.'

/** O que cada mensagem diz, para a IA. Arquivo sem texto vira a marca do arquivo. */
function fala(m: MensagemDoLead): FalaDaConversa | null {
  const texto = m.texto?.trim() || m.transcricao?.trim() || (m.anexo ? '[enviou um arquivo]' : '')
  if (!texto || m.apagada) return null
  return { de: m.direcao === 'entrada' ? 'cliente' : 'empresa', texto }
}

async function executar(
  clienteId: string,
  contatoId: string,
  tarefa: TarefaDoCopiloto,
  texto?: string,
): Promise<RespostaDoCopiloto> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem permissão para atender esta conversa' }
  const [daConta, alcanca] = await Promise.all([
    contatosDaConta(clienteId, [contatoId]),
    alcancaContato(clienteId, contatoId, acesso),
  ])
  if (daConta.length === 0 || !alcanca) return { ok: false, erro: 'esta conversa não é desta conta' }

  const escolhido = await escolherModelo({ iaHabilitada: true, clienteId })
  if (!escolhido.modelo) return { ok: false, erro: `A IA não está disponível: ${escolhido.motivo ?? 'sem modelo'}.` }

  // Na nossa chave, conta no teto do plano; na do cliente, a conta é dele.
  const naNossaChave = escolhido.dono === '4yu'
  if (naNossaChave) {
    const cota = await cotaDeIaDaConta(clienteId)
    if (cota.teto !== null && cota.usadas >= cota.teto) return { ok: false, erro: SEM_COTA }
  }

  const [cliente, conversa, produtos] = await Promise.all([
    acharCliente(clienteId),
    lerConversa(contatoId, 40),
    tarefa === 'sugerir' ? listarProdutos(clienteId).catch(() => []) : Promise.resolve([]),
  ])
  const falas = conversa.mensagens.flatMap((m) => fala(m) ?? [])
  if (tarefa !== 'corrigir' && tarefa !== 'formal' && tarefa !== 'curto' && falas.length === 0) {
    return { ok: false, erro: 'Ainda não há mensagens nesta conversa.' }
  }

  const ativos = produtos
    .filter((p) => p.arquivadoEm === null)
    .map((p) => ({ nome: p.nome, preco: p.preco, descricao: p.descricao }))

  const resposta = await escolhido.modelo.responder({
    contextoNegocio: '',
    instrucao: '',
    pergunta: '',
    pronto: promptDoCopiloto({
      tarefa,
      empresa: cliente?.nome ?? '',
      contexto: cliente?.contextoNegocio ?? '',
      falas,
      produtos: produtosRelevantes(ativos, falas),
      texto,
    }),
  })

  if (resposta.tipo !== 'texto') {
    console.error('[copiloto] sem texto', tarefa, resposta.tipo === 'nao_sei' ? resposta.motivo : resposta.tipo)
    return { ok: false, erro: 'A IA não conseguiu responder agora. Tente de novo em instantes.' }
  }
  if (naNossaChave) await registrarUsoDoCopiloto(clienteId, contatoId, tarefa)

  const limpo = limparTexto(resposta.texto)
  if (limpo === '') return { ok: false, erro: 'A IA não conseguiu responder agora. Tente de novo em instantes.' }
  return { ok: true, texto: limpo }
}

/** Um rascunho de resposta, a partir da conversa, do negócio e do catálogo. */
export async function acaoSugerirResposta(clienteId: string, contatoId: string): Promise<RespostaDoCopiloto> {
  return executar(clienteId, contatoId, 'sugerir')
}

/** O texto do atendente corrigido, mais formal ou mais curto. */
export async function acaoAjustarTexto(
  clienteId: string,
  contatoId: string,
  modo: 'corrigir' | 'formal' | 'curto',
  texto: string,
): Promise<RespostaDoCopiloto> {
  const limpo = texto.trim()
  if (limpo === '') return { ok: false, erro: 'Escreva o texto antes de pedir o ajuste.' }
  if (limpo.length > 4096) return { ok: false, erro: 'O texto passou do limite do WhatsApp, 4.096 caracteres.' }
  if (modo !== 'corrigir' && modo !== 'formal' && modo !== 'curto') return { ok: false, erro: 'ajuste desconhecido' }
  return executar(clienteId, contatoId, modo, limpo)
}

/** Três linhas para quem assume no meio: o que quer, o que foi feito, o que falta. */
export async function acaoResumirConversa(clienteId: string, contatoId: string): Promise<ResumoDoCopiloto> {
  const r = await executar(clienteId, contatoId, 'resumir')
  if (!r.ok) return r
  return { ok: true, resumo: lerResumo(r.texto), texto: r.texto }
}
