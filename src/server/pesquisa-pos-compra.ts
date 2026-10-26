import 'server-only'
import { sessaoNova } from '@/core/engine/types'
import { telefoneCanonico } from '@/core/contatos/telefone'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { alertar } from './alertar'
import type { FabricaDeCanal } from './receber-mensagem'
import { camposDoContato, gravarCampos } from './repos/campos'
import { acharContatoPeloTelefone } from './repos/contato-por-telefone'
import {
  confirmarEntrega,
  criarSessao,
  definirStatusDaSessao,
  listarCanais,
  registrarSaida,
  ultimaSessao,
} from './repos/conversas'
import { acharFluxo, acharVersao } from './repos/fluxos'
import { criarContato } from './repos/leads'
import { listarTemplatesAprovados } from './repos/templates'
import { travarContato } from './repos/travas'
import { acharGatilhoDeEvento, contarDisparoDeEvento } from './repos/webhooks-de-entrada'

/**
 * A pesquisa pós-compra: o pedido virou "Processando" na loja e a pessoa
 * recebe, pelo WhatsApp, o modelo que já é a primeira pergunta.
 *
 * Nasceu na PCYES (26/out/2026): o Magento avisa pelo webhook de entrada com
 * `pedido.processando`, e o fluxo do gatilho desse evento é a pesquisa. Ver
 * `docs/HANDOFF-26-OUT-NPS-PCYES.md`.
 *
 * **Por que não o caminho comum do evento** (`receber-evento.ts`): ele só fala
 * com quem já é contato e, fora das 24h, manda um aviso solto que não leva a
 * conversa para o fluxo. Quem compra no site quase nunca escreveu para a loja
 * no WhatsApp. Aqui o contato nasce do pedido, e a conversa do fluxo é aberta
 * **parada na primeira pergunta**: o toque no botão do modelo ("Foi ótima")
 * chega como resposta dela (`paraEntrada`, `type: 'button'`).
 *
 * **Contato a partir do pedido é exceção consciente** à regra de não criar
 * contato por evento: o aviso vem assinado pela loja, o telefone é o do pedido
 * e a pessoa aceitou receber WhatsApp (`aceita_whatsapp`). Sem aceite, nada.
 */

export const EVENTO_DE_PEDIDO = 'pedido.processando'
const MODELO = 'pesquisa_pos_compra'

/**
 * Enquanto o aceite de WhatsApp não existe no site da PCYES (card do Yuri), só
 * o número de teste do Gabriel recebe. DDD 44 é dele.
 */
const TELEFONES_DE_TESTE = ['5544998775978']

/** Os pedidos que já receberam a pesquisa, no campo do contato. Uma vez por pedido. */
const CAMPO_DOS_PEDIDOS = 'pedidos_pesquisados'

export type ResultadoDaPesquisa = 'enviada' | 'sem_gatilho' | 'sem_aceite' | 'ja_enviada' | 'nao_enviada'

export async function iniciarPesquisaPosCompra(
  entrada: { clienteId: string; telefone: string; dados?: Record<string, unknown> },
  fabricaDeCanal?: FabricaDeCanal,
): Promise<ResultadoDaPesquisa> {
  const { clienteId } = entrada
  const dados = entrada.dados ?? {}
  const gatilho = await acharGatilhoDeEvento(clienteId, EVENTO_DE_PEDIDO)
  if (!gatilho) return 'sem_gatilho'

  const pedido = texto(dados.pedido)
  const waId = telefoneCanonico(entrada.telefone)
  const falhou = async (motivo: string) => {
    await alertar('a pesquisa pós-compra não saiu', motivo, { cliente: clienteId, pedido })
    return 'nao_enviada' as const
  }
  if (!pedido || !/^[\w-]{1,40}$/.test(pedido)) return falhou('o aviso veio sem número de pedido')
  if (!waId) return falhou(`telefone que não dá para normalizar: ${entrada.telefone}`)

  // Quem não aceitou não recebe. Não é falha: é a regra.
  if (dados.aceita_whatsapp !== true && !TELEFONES_DE_TESTE.includes(waId)) return 'sem_aceite'

  const canal = (await listarCanais(clienteId)).find((c) => c.provider === 'cloud-api' && c.status === 'ativo')
  if (!canal) return falhou('a conta não tem número de WhatsApp ativo')

  const modelo = (await listarTemplatesAprovados(clienteId)).find((t) => t.nome === MODELO)
  if (!modelo) return falhou(`o modelo ${MODELO} não está aprovado`)

  const fluxo = await acharFluxo(gatilho.fluxoId)
  if (!fluxo || fluxo.clienteId !== clienteId || !fluxo.ativo || !fluxo.versaoPublicadaId) {
    return falhou('o fluxo do gatilho não está publicado ou está desligado')
  }
  const versao = await acharVersao(fluxo.versaoPublicadaId)
  const primeira = versao?.grafo.nodes.find((n) => n.id === versao.grafo.inicio)
  if (!versao || primeira?.type !== 'pergunta') {
    return falhou('o fluxo da pesquisa precisa começar por uma pergunta com as opções do modelo')
  }

  const nome = texto(dados.nome) || 'cliente'
  let contatoId = await acharContatoPeloTelefone(clienteId, waId)
  if (!contatoId) {
    const criado = await criarContato(clienteId, { nome, telefone: waId })
    if (!criado.ok) return falhou(`não foi possível criar o contato: ${criado.motivo}`)
    contatoId = criado.contatoId
  }

  // A loja pode avisar duas vezes o mesmo pedido, inclusive ao mesmo tempo.
  const destravar = await travarContato(contatoId)
  if (!destravar) return falhou('a conversa estava ocupada')
  try {
    const campos = await camposDoContato(clienteId, contatoId)
    const jaEnviados = (campos?.[CAMPO_DOS_PEDIDOS]?.valor ?? '').split(',').filter(Boolean)
    if (jaEnviados.includes(pedido)) return 'ja_enviada'

    // Atendimento em curso ganha da pesquisa, como em `abrirFluxoParaContato`.
    const anterior = await ultimaSessao(contatoId, canal.id)
    if (anterior?.sessao.status === 'humano') return 'nao_enviada'
    if (anterior && anterior.sessao.status !== 'encerrada') await definirStatusDaSessao(anterior.id, 'encerrada')

    const salva = await criarSessao(contatoId, canal.id, versao.id, {
      ...sessaoNova(),
      noAtual: primeira.id,
      vars: {
        nome,
        pedido,
        telefone: waId,
        customer_id: texto(dados.customer_id),
      },
    })

    const valores = [nome, pedido]
    const corpo = valores.reduce((t, v, i) => t.replace(`{{${i + 1}}}`, v), modelo.componentes.corpo)
    const saida = await registrarSaida({
      contatoId,
      sessaoId: salva.id,
      texto: corpo,
      payload: { evento: EVENTO_DE_PEDIDO, modelo: modelo.nome, pedido },
      autor: null,
    })
    const adaptador = fabricaDeCanal ? fabricaDeCanal(canal) : await adaptadorDoCanal(canal)
    if (!adaptador.enviarTemplate) return falhou('o canal não manda modelo')
    const envio = await adaptador.enviarTemplate(waId, { nome: modelo.nome, idioma: modelo.idioma, valores: { corpo: valores } })
    if (envio.situacao === 'falhou') return falhou('a Meta recusou o envio do modelo')
    await confirmarEntrega(saida, envio.wamid)

    await gravarCampos(clienteId, contatoId, {
      [CAMPO_DOS_PEDIDOS]: {
        valor: [...jaEnviados, pedido].slice(-50).join(','),
        origem: 'automacao',
        autorId: null,
        em: new Date().toISOString(),
      },
    })
    await contarDisparoDeEvento(gatilho.id)
    return 'enviada'
  } finally {
    await destravar()
  }
}

function texto(valor: unknown): string {
  return typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim().slice(0, 80) : ''
}
