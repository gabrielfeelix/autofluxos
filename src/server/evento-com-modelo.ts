import 'server-only'
import {
  campoDosEnvios,
  podeReceber,
  valorDoCampo,
  valoresDoAviso,
  variaveisDoAviso,
  type ModeloDoEvento,
} from '@/core/evento-com-modelo'
import { sessaoNova } from '@/core/engine/types'
import { telefoneCanonico } from '@/core/contatos/telefone'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { alertar } from './alertar'
import { modeloComClique } from './link-do-clique'
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
import { contarDisparoDeEvento, type GatilhoDeEvento } from './repos/webhooks-de-entrada'

/**
 * O evento que começa pelo modelo (0152): o aviso chega, a pessoa recebe pelo
 * WhatsApp o modelo aprovado que já é a primeira pergunta do fluxo, e o toque
 * no botão do modelo chega como resposta dela (`paraEntrada`, `type: 'button'`).
 * A regra mora na configuração do gatilho (`core/evento-com-modelo.ts`).
 *
 * Nasceu fixo no código para a pesquisa pós-compra da PCYES (o Magento avisa
 * `pedido.processando`), ver `docs/HANDOFF-26-OUT-NPS-PCYES.md`.
 *
 * **Por que não o caminho comum do evento** (`receber-evento.ts`): ele só fala
 * com quem já é contato e, fora das 24h, manda um aviso solto que não leva a
 * conversa para o fluxo. Quem compra no site quase nunca escreveu para a loja
 * no WhatsApp. Aqui o contato pode nascer do aviso, e a conversa do fluxo é
 * aberta **parada na primeira pergunta**.
 *
 * **Contato a partir do aviso é exceção consciente** à regra de não criar
 * contato por evento: o aviso vem assinado pelo sistema do cliente, e a
 * configuração só aceita criar contato com campo de aceite. Sem aceite, nada.
 */

export type ResultadoDoModelo = 'enviada' | 'sem_aceite' | 'ja_enviada' | 'nao_enviada'

export async function iniciarPorModelo(
  gatilho: GatilhoDeEvento & { modelo: ModeloDoEvento },
  entrada: { clienteId: string; telefone: string; dados?: Record<string, unknown> },
  fabricaDeCanal?: FabricaDeCanal,
): Promise<ResultadoDoModelo> {
  const { clienteId } = entrada
  const config = gatilho.modelo
  const dados = entrada.dados ?? {}

  const chave = config.umaVezPor ? valorDoCampo(dados, config.umaVezPor) : ''
  const waId = telefoneCanonico(entrada.telefone)
  const falhou = async (motivo: string) => {
    await alertar('o modelo do evento não saiu', motivo, { cliente: clienteId, evento: gatilho.evento, chave })
    return 'nao_enviada' as const
  }
  if (config.umaVezPor && !/^[\w.-]{1,40}$/.test(chave)) {
    return falhou(`o aviso veio sem ${config.umaVezPor}, que identifica o envio`)
  }
  if (!waId) return falhou(`telefone que não dá para normalizar: ${entrada.telefone}`)

  // Quem não aceitou não recebe. Não é falha: é a regra.
  if (!podeReceber(config, dados, waId)) return 'sem_aceite'

  const valores = valoresDoAviso(config, dados)
  if (!valores.ok) return falhou(`o aviso veio sem ${valores.faltou}, que vai no modelo`)

  const canal = (await listarCanais(clienteId)).find((c) => c.provider === 'cloud-api' && c.status === 'ativo')
  if (!canal) return falhou('a conta não tem número de WhatsApp ativo')

  const aprovados = await listarTemplatesAprovados(clienteId)
  const modelo = config.modelos.map((nome) => aprovados.find((t) => t.nome === nome)).find(Boolean)
  if (!modelo) return falhou(`nenhum dos modelos ${config.modelos.join(', ')} está aprovado`)
  // Sem a imagem, a Meta entrega o modelo sem o cabeçalho aprovado: melhor não sair.
  if (modelo.componentes.cabecalho?.tipo === 'imagem' && !config.imagem) {
    return falhou(`o modelo ${modelo.nome} tem imagem no cabeçalho e o gatilho não tem a imagem configurada`)
  }

  const fluxo = await acharFluxo(gatilho.fluxoId)
  if (!fluxo || fluxo.clienteId !== clienteId || !fluxo.ativo || !fluxo.versaoPublicadaId) {
    return falhou('o fluxo do evento não está publicado ou está desligado')
  }
  const versao = await acharVersao(fluxo.versaoPublicadaId)
  const primeira = versao?.grafo.nodes.find((n) => n.id === versao.grafo.inicio)
  if (!versao || primeira?.type !== 'pergunta') {
    return falhou('o fluxo precisa começar por uma pergunta com as opções do modelo')
  }

  const variaveis = { ...variaveisDoAviso(dados), telefone: waId }
  const nome = valorDoCampo(dados, 'nome') || 'cliente'
  let contatoId = await acharContatoPeloTelefone(clienteId, waId)
  if (!contatoId) {
    if (!config.criarContato) return falhou(`o telefone ${waId} não é contato desta conta`)
    const criado = await criarContato(clienteId, { nome, telefone: waId })
    if (!criado.ok) return falhou(`não foi possível criar o contato: ${criado.motivo}`)
    contatoId = criado.contatoId
  }

  // O sistema do outro lado pode avisar duas vezes a mesma coisa, inclusive ao mesmo tempo.
  const destravar = await travarContato(contatoId)
  if (!destravar) return falhou('a conversa estava ocupada')
  try {
    const campo = campoDosEnvios(gatilho.evento)
    const campos = await camposDoContato(clienteId, contatoId)
    const jaEnviados = (campos?.[campo]?.valor ?? '').split(',').filter(Boolean)
    if (chave && jaEnviados.includes(chave)) return 'ja_enviada'

    // Atendimento em curso ganha do modelo, como em `abrirFluxoParaContato`.
    const anterior = await ultimaSessao(contatoId, canal.id)
    if (anterior?.sessao.status === 'humano') return 'nao_enviada'
    if (anterior && anterior.sessao.status !== 'encerrada') await definirStatusDaSessao(anterior.id, 'encerrada')

    const salva = await criarSessao(contatoId, canal.id, versao.id, {
      ...sessaoNova(),
      noAtual: primeira.id,
      vars: variaveis,
    })

    const corpo = valores.valores.reduce((t, v, i) => t.replace(`{{${i + 1}}}`, v), modelo.componentes.corpo)
    const saida = await registrarSaida({
      contatoId,
      sessaoId: salva.id,
      texto: corpo,
      payload: {
        evento: gatilho.evento,
        modelo: modelo.nome,
        ...(chave ? { chave } : {}),
        // O Inbox desenha o que o cliente viu: a imagem do cabeçalho e os botões.
        ...(modelo.componentes.cabecalho?.tipo === 'imagem' && config.imagem ? { midia: 'imagem', url: config.imagem } : {}),
        ...((modelo.componentes.botoes ?? []).some((b) => b.tipo === 'QUICK_REPLY')
          ? {
              opcoes: (modelo.componentes.botoes ?? [])
                .filter((b) => b.tipo === 'QUICK_REPLY')
                .map((b, i) => ({ id: `botao-${i}`, rotulo: b.texto })),
              formato: 'botoes',
            }
          : {}),
      },
      autor: null,
    })
    const adaptador = fabricaDeCanal ? fabricaDeCanal(canal) : await adaptadorDoCanal(canal)
    if (!adaptador.enviarTemplate) return falhou('o canal não manda modelo')
    const envio = await adaptador.enviarTemplate(
      waId,
      modeloComClique(
        {
          nome: modelo.nome,
          idioma: modelo.idioma,
          valores: {
            corpo: valores.valores,
            ...(modelo.componentes.cabecalho?.tipo === 'imagem' && config.imagem ? { cabecalhoImagem: config.imagem } : {}),
          },
        },
        modelo,
      ),
    )
    if (envio.situacao === 'falhou') return falhou('a Meta recusou o envio do modelo')
    await confirmarEntrega(saida, envio.wamid)

    if (chave) {
      await gravarCampos(clienteId, contatoId, {
        [campo]: {
          valor: [...jaEnviados, chave].slice(-50).join(','),
          origem: 'automacao',
          autorId: null,
          em: new Date().toISOString(),
        },
      })
    }
    await contarDisparoDeEvento(gatilho.id)
    return 'enviada'
  } finally {
    await destravar()
  }
}
