'use server'

import { revalidatePath } from 'next/cache'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import { botoesSemOpcao, conferirModeloDoEvento } from '@/core/evento-com-modelo'
import { variaveisDe } from '@/core/templates'
import { exigirCapacidade, recusou } from './permissoes'
import { acharFluxo, acharVersao } from './repos/fluxos'
import { listarTemplates } from './repos/templates'
import { listarGatilhosDeEvento, salvarModeloDoGatilho } from './repos/webhooks-de-entrada'

/**
 * Grava o "começar pelo modelo" de um evento (0152), ou tira, com o modelo em
 * branco.
 *
 * Confere na hora de salvar o que, na hora do pedido, viraria alerta sem
 * ninguém olhando: o número de campos contra as lacunas do modelo, e os
 * botões do modelo contra as opções da primeira pergunta do fluxo.
 */
export async function acaoSalvarModeloDoEvento(
  clienteId: string,
  gatilhoId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const gatilho = (await listarGatilhosDeEvento(clienteId)).find((g) => g.id === gatilhoId)
  if (!gatilho) return { erro: 'Este evento não existe mais.' }

  const texto = (nome: string) => String(formData.get(nome) ?? '').trim()
  const lista = (nome: string) =>
    texto(nome)
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean)

  const principal = texto('modelo')
  if (!principal) {
    await salvarModeloDoGatilho(clienteId, gatilhoId, null)
    revalidatePath(`/clientes/${clienteId}/fluxos`)
    return { ok: true }
  }

  const reserva = texto('reserva')
  const conferido = conferirModeloDoEvento({
    modelos: reserva && reserva !== principal ? [principal, reserva] : [principal],
    variaveis: lista('variaveis'),
    criarContato: formData.get('criarContato') === 'on',
    campoDeAceite: texto('campoDeAceite'),
    umaVezPor: texto('umaVezPor'),
    telefonesDeTeste: lista('telefonesDeTeste'),
  })
  if (!conferido.ok) return { erro: conferido.erro }
  const config = conferido.modelo

  const templates = await listarTemplates(clienteId)
  const escolhidos = config.modelos.map((nome) => templates.find((t) => t.nome === nome))
  if (escolhidos.some((t) => !t)) return { erro: 'Um dos modelos escolhidos não existe mais nesta conta.' }

  for (const template of escolhidos) {
    const lacunas = variaveisDe(template!.componentes.corpo).length
    if (lacunas !== config.variaveis.length) {
      return {
        erro: `O modelo ${template!.nome} tem ${lacunas} ${lacunas === 1 ? 'lacuna' : 'lacunas'}, e foram informados ${config.variaveis.length} campos.`,
      }
    }
  }

  /*
   * Os botões só são conferidos contra o fluxo publicado. Rascunho pode mudar
   * até a publicação, e a conferência de verdade é a do envio.
   */
  const fluxo = await acharFluxo(gatilho.fluxoId)
  const versao = fluxo?.versaoPublicadaId ? await acharVersao(fluxo.versaoPublicadaId) : null
  if (versao) {
    const primeira = versao.grafo.nodes.find((n) => n.id === versao.grafo.inicio)
    if (primeira?.type !== 'pergunta') {
      return { erro: 'O fluxo deste evento precisa começar por uma pergunta: o modelo é ela.' }
    }
    const opcoes = (primeira.data as { opcoes?: { rotulo: string }[] }).opcoes ?? []
    for (const template of escolhidos) {
      const soltos = botoesSemOpcao(template!.componentes.botoes, opcoes)
      if (soltos.length > 0) {
        return {
          erro: `O botão “${soltos[0]}” do modelo ${template!.nome} não é uma opção da primeira pergunta do fluxo. Use o mesmo texto nos dois.`,
        }
      }
    }
  }

  await salvarModeloDoGatilho(clienteId, gatilhoId, config)
  revalidatePath(`/clientes/${clienteId}/fluxos`)
  return { ok: true }
}
