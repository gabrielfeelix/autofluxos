import 'server-only'
import { z } from 'zod'
import { canalCloudApi } from '@/channels/cloud-api'
import type { Canal } from '@/channels/types'
import { executar } from '@/core/engine/executar'
import { sessaoNova, type Acao, type Entrada } from '@/core/engine/types'
import { acharFluxo, acharVersao } from './repos/fluxos'
import {
  acharCanalPorNumero,
  acharOuCriarContato,
  criarSessao,
  guardarCampo,
  guardarSessao,
  registrarEntrada,
  registrarHandoff,
  registrarSaida,
  ultimaSessao,
  vincularSessaoNaMensagem,
  type CanalSalvo,
  type Contato,
} from './repos/conversas'

/**
 * O caminho de uma mensagem do WhatsApp até a resposta.
 *
 * Repare no que NÃO acontece aqui: nenhuma decisão de conversa. Quem decide é
 * `executar()`, a mesma função que o simulador chama. Este arquivo só traduz
 * mundo real para o motor e o retorno do motor de volta para o mundo real.
 */

const mensagemSchema = z.object({
  id: z.string(),
  from: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({
      button_reply: z.object({ id: z.string(), title: z.string().optional() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string().optional() }).optional(),
    })
    .optional(),
})

export const webhookSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z.object({
                metadata: z.object({ phone_number_id: z.string() }).optional(),
                contacts: z
                  .array(
                    z.object({
                      wa_id: z.string(),
                      profile: z.object({ name: z.string().optional() }).optional(),
                    }),
                  )
                  .optional(),
                messages: z.array(mensagemSchema).optional(),
              }),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
})

type Mensagem = z.infer<typeof mensagemSchema>

/** Como o canal é montado. Injetável para os testes rodarem sem rede. */
export type FabricaDeCanal = (canal: CanalSalvo) => Canal

function canalPadrao(canal: CanalSalvo): Canal {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) throw new Error('falta WHATSAPP_TOKEN no ambiente')
  return canalCloudApi({ phoneNumberId: canal.phoneNumberId, token })
}

export async function receberMensagem(
  payload: unknown,
  fabricaDeCanal: FabricaDeCanal = canalPadrao,
): Promise<void> {
  const analise = webhookSchema.safeParse(payload)
  if (!analise.success) return

  for (const entrada of analise.data.entry) {
    for (const mudanca of entrada.changes) {
      const valor = mudanca.value
      const numero = valor.metadata?.phone_number_id

      // Sem `messages` é evento de status (entregue, lido). Não nos interessa.
      if (!numero || !valor.messages?.length) continue

      const canalSalvo = await acharCanalPorNumero(numero)
      if (!canalSalvo || canalSalvo.status !== 'ativo') continue

      for (const mensagem of valor.messages) {
        const perfil = valor.contacts?.find((c) => c.wa_id === mensagem.from)
        await tratarUma(canalSalvo, mensagem, perfil?.profile?.name ?? null, fabricaDeCanal)
      }
    }
  }
}

async function tratarUma(
  canalSalvo: CanalSalvo,
  mensagem: Mensagem,
  nomeDoPerfil: string | null,
  fabricaDeCanal: FabricaDeCanal,
): Promise<void> {
  const { entrada, texto } = paraEntrada(mensagem)
  const contato = await acharOuCriarContato(canalSalvo.clienteId, mensagem.from, nomeDoPerfil)

  const inedita = await registrarEntrada({
    contatoId: contato.id,
    sessaoId: null,
    waMessageId: mensagem.id,
    texto,
    payload: mensagem,
  })
  // A Meta reenviou algo que já processamos. Sair aqui é o que impede a
  // conversa de andar duas vezes.
  if (!inedita) return

  let salva = await ultimaSessao(contato.id, canalSalvo.id)

  // O humano assumiu. O bot fica calado — a mensagem fica registrada, e quem
  // responde é a pessoa, do celular dela.
  if (salva && salva.sessao.status === 'humano') {
    await vincularSessaoNaMensagem(mensagem.id, salva.id)
    return
  }

  const conversaNova = !salva || salva.sessao.status === 'encerrada'
  let grafoId: string

  if (conversaNova) {
    if (!canalSalvo.flowId) return

    const fluxo = await acharFluxo(canalSalvo.flowId)
    // Nada publicado: o bot não fala. Melhor silêncio do que responder com um
    // rascunho que ninguém revisou.
    if (!fluxo?.versaoPublicadaId) return

    grafoId = fluxo.versaoPublicadaId
    salva = await criarSessao(contato.id, canalSalvo.id, grafoId, sessaoNova())
  } else {
    grafoId = salva!.flowVersionId
  }

  const versao = await acharVersao(grafoId)
  if (!versao || !salva) return

  await vincularSessaoNaMensagem(mensagem.id, salva.id)

  // Conversa nova começa pelo início do fluxo. A primeira mensagem da pessoa
  // é o gatilho, não uma resposta — ela ainda não foi perguntada nada.
  const resultado = executar(versao.grafo, salva.sessao, conversaNova ? { tipo: 'inicio' } : entrada)

  await guardarSessao(salva.id, resultado.sessao)
  await aplicar(fabricaDeCanal(canalSalvo), contato, salva.id, resultado.acoes)
}

async function aplicar(
  canal: Canal,
  contato: Contato,
  sessaoId: string,
  acoes: Acao[],
): Promise<void> {
  const campos = { ...contato.campos }
  let mexeuNosCampos = false

  for (const acao of acoes) {
    switch (acao.tipo) {
      case 'enviar_texto':
        await canal.enviarTexto(contato.waId, acao.texto)
        await registrarSaida({ contatoId: contato.id, sessaoId, texto: acao.texto })
        break

      case 'enviar_opcoes':
        await canal.enviarOpcoes(contato.waId, acao.texto, acao.opcoes, acao.formato)
        await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          texto: acao.texto,
          payload: { opcoes: acao.opcoes, formato: acao.formato },
        })
        break

      case 'salvar_campo':
        campos[acao.campo] = acao.valor
        mexeuNosCampos = true
        break

      case 'transferir_humano':
        await registrarHandoff(sessaoId, acao.motivo)
        break

      case 'chamar_ia': {
        // A IA é a Etapa 2 e ainda não existe. Um fluxo publicado com nó de IA
        // travaria a conversa esperando uma resposta que nunca vem — então ela
        // vai para uma pessoa. Nunca deixar alguém pendurado.
        const aviso = 'Vou te passar para um atendente. Só um instante!'
        await canal.enviarTexto(contato.waId, aviso)
        await registrarSaida({ contatoId: contato.id, sessaoId, texto: aviso })
        await registrarHandoff(sessaoId, 'fluxo pediu IA, que ainda é da Etapa 2')
        await guardarSessao(sessaoId, {
          noAtual: null,
          vars: campos,
          tentativas: 0,
          status: 'humano',
        })
        break
      }

      case 'encerrar':
        break
    }
  }

  if (mexeuNosCampos) await guardarCampo(contato.id, campos)
}

/** Traduz o que o WhatsApp mandou para o que o motor entende. */
function paraEntrada(mensagem: Mensagem): { entrada: Entrada; texto: string | null } {
  if (mensagem.type === 'text' && mensagem.text) {
    return { entrada: { tipo: 'texto', texto: mensagem.text.body }, texto: mensagem.text.body }
  }

  const resposta = mensagem.interactive?.button_reply ?? mensagem.interactive?.list_reply
  if (resposta) {
    return {
      entrada: { tipo: 'opcao', opcaoId: resposta.id },
      texto: resposta.title ?? resposta.id,
    }
  }

  // Áudio, imagem, documento, figurinha, localização... (Regra B: vai para uma
  // pessoa, nunca "não entendi").
  return { entrada: { tipo: 'midia', formato: mensagem.type }, texto: null }
}
