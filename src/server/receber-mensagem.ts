import 'server-only'
import { z } from 'zod'
import { canalCloudApi } from '@/channels/cloud-api'
import type { Canal } from '@/channels/types'
import { sessaoNova, type Acao, type Entrada } from '@/core/engine/types'
import { alertar, type ContextoDoAlerta } from './alertar'
import { executarComEfeitos, type OpcoesDeEfeitos } from './efeitos/resolver'
import { escolherModelo } from './ia/modelo'
import { acharCliente } from './repos/clientes'
import { acharFluxo, acharVersao } from './repos/fluxos'
import { lerConversa } from './repos/leads'
import {
  acharCanalPorNumero,
  acharContato,
  acharOuCriarContato,
  alterarAutomacaoDoContato,
  criarSessao,
  definirStatusDaSessao,
  guardarCampo,
  guardarSessao,
  confirmarEntrega,
  registrarEntrada,
  registrarHandoff,
  registrarSaida,
  ultimaSessao,
  vincularSessaoNaMensagem,
  type CanalSalvo,
  type Contato,
} from './repos/conversas'
import { travarContato } from './repos/travas'

/**
 * O caminho de uma mensagem do WhatsApp até a resposta.
 *
 * Repare no que NÃO acontece aqui: nenhuma decisão de conversa. Quem decide é
 * `executar()`, a mesma função que o simulador chama. Este arquivo só traduz
 * mundo real para o motor e o retorno do motor de volta para o mundo real.
 */

const referralSchema = z.object({
  source_url: z.string().optional(),
  source_type: z.string().optional(),
  source_id: z.string().optional(),
  headline: z.string().optional(),
  body: z.string().optional(),
  media_type: z.string().optional(),
  image_url: z.string().optional(),
  video_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  ctwa_clid: z.string().optional(),
})

const mensagemSchema = z.object({
  id: z.string(),
  from: z.string(),
  type: z.string(),
  referral: referralSchema.optional(),
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
type Referral = z.infer<typeof referralSchema>

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
  // conversa de andar duas vezes. Vem **antes** da trava de propósito: reenvio
  // não precisa esperar fila nenhuma para ser descartado.
  if (!inedita) return

  // Daqui para baixo a conversa avança, e duas mensagens da mesma pessoa não
  // podem avançar juntas — ver `repos/travas.ts` e a migration 0007.
  const destravar = await travarContato(contato.id)
  if (!destravar) {
    await desistirDaVez(canalSalvo, contato)
    return
  }

  try {
    const contatoAtual = Object.hasOwn(contato.campos, 'origem')
      ? contato
      : await acharContato(contato.id)
    if (!contatoAtual) return

    // Pausar é uma escolha persistente do contato, não só da sessão atual.
    // A entrada já ficou no histórico acima; daqui para baixo é que o motor
    // poderia avançar ou produzir uma saída, e isso fica proibido enquanto a
    // pessoa responsável não religar a automação no painel.
    if (!contatoAtual.automacaoAtiva) return

    const contatoComOrigem = await atribuirOrigem(contatoAtual, mensagem.referral)
    await avancarConversa(canalSalvo, contatoComOrigem, mensagem, entrada, texto, fabricaDeCanal)
  } finally {
    await destravar()
  }
}

async function atribuirOrigem(contato: Contato, referral?: Referral): Promise<Contato> {
  if (Object.hasOwn(contato.campos, 'origem')) return contato

  const campos = {
    ...contato.campos,
    origem: referral ? 'Anúncio' : 'Direto',
    ...(referral?.source_id ? { origem_anuncio: referral.source_id } : {}),
    ...(referral?.headline ? { origem_titulo: referral.headline } : {}),
  }

  await guardarCampo(contato.id, campos)
  return { ...contato, campos }
}

/**
 * Não conseguiu a vez dentro do prazo.
 *
 * Vinte segundos esperando significa que alguma coisa está presa, não que há
 * fila. A mensagem já foi deduplicada, então a pessoa não pode simplesmente
 * ficar sem resposta e sem aparecer em lugar nenhum: vira handoff, que é o que
 * a tela de leads mostra. Sem sessão para pendurar o handoff, resta o log.
 */
async function desistirDaVez(canalSalvo: CanalSalvo, contato: Contato): Promise<void> {
  console.error('[whatsapp] não consegui a vez do contato', contato.id)

  const salva = await ultimaSessao(contato.id, canalSalvo.id)
  if (!salva) return

  await registrarHandoff(salva.id, 'a conversa ficou presa e a mensagem não foi processada')
  await definirStatusDaSessao(salva.id, 'humano')
}

async function avancarConversa(
  canalSalvo: CanalSalvo,
  contato: Contato,
  mensagem: Mensagem,
  entrada: Entrada,
  texto: string | null,
  fabricaDeCanal: FabricaDeCanal,
): Promise<void> {
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
  const resultado = await executarComEfeitos(
    versao.grafo,
    salva.sessao,
    conversaNova ? { tipo: 'inicio' } : entrada,
    await prepararIa(canalSalvo, contato.id, versao.grafo, texto),
  )

  await guardarSessao(salva.id, resultado.sessao)
  await aplicar(fabricaDeCanal(canalSalvo), contato, salva.id, mensagem.id, resultado.acoes)
}

/**
 * O que a IA precisa para responder — buscado **só quando o fluxo tem IA**.
 *
 * A checagem no grafo evita duas consultas por mensagem em todo cliente que não
 * contratou Etapa 2, que hoje é a maioria. Custo zero para quem não usa.
 */
async function prepararIa(
  canalSalvo: CanalSalvo,
  contatoId: string,
  grafo: { nodes: { type: string }[] },
  perguntaDaPessoa: string | null,
): Promise<OpcoesDeEfeitos> {
  const vazio: OpcoesDeEfeitos = {
    modelo: null,
    contextoNegocio: '',
    origem: 'whatsapp',
    clienteId: canalSalvo.clienteId,
  }
  if (!grafo.nodes.some((n) => n.type === 'ia') || !canalSalvo.flowId) return vazio

  const [fluxo, cliente, conversa] = await Promise.all([
    acharFluxo(canalSalvo.flowId),
    acharCliente(canalSalvo.clienteId),
    lerConversa(contatoId, 10),
  ])

  // O plano é lido do fluxo **agora**, e não da versão publicada: contrato não
  // congela junto com o desenho. Desligar a IA tem que valer na próxima
  // mensagem, não na próxima publicação.
  const { modelo } = escolherModelo({ iaHabilitada: fluxo?.iaHabilitada ?? false })

  return {
    modelo,
    origem: 'whatsapp',
    clienteId: canalSalvo.clienteId,
    contextoNegocio: cliente?.contextoNegocio ?? '',
    perguntaDaPessoa: perguntaDaPessoa ?? undefined,
    historico: conversa.mensagens.map((m) => ({
      de: m.direcao === 'entrada' ? ('pessoa' as const) : ('bot' as const),
      texto: m.texto ?? '(áudio ou imagem)',
    })),
  }
}

/** O texto padrão antes de uma pessoa assumir. */
const AVISO_DE_HANDOFF = 'Vou te passar para um atendente. Só um instante!'

type Entrega = { ok: true } | { ok: false; motivo: string }

/**
 * Manda, e devolve o que aconteceu em vez de estourar.
 *
 * **Falha de entrega não pode virar exceção.** A sessão já foi gravada antes de
 * `aplicar()` e a mensagem que chegou já foi deduplicada em `registrarEntrada`:
 * uma exceção daqui sobe até o `catch` do `after()` no webhook, a Meta não
 * reenvia, e a pessoa fica sem resposta com o fluxo tendo avançado como se
 * tivesse falado. Token expirado, janela de 24h fechada e limite de taxa são
 * todos casos rotineiros que caíam exatamente nisso.
 */
async function entregar(
  envio: () => Promise<void>,
  contexto: ContextoDoAlerta = {},
): Promise<Entrega> {
  try {
    await envio()
    return { ok: true }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    // Fica no log porque o motivo do handoff aparece na tela do painel e o
    // texto da Meta é longo; a versão inteira é o que resolve a investigação.
    console.error('[whatsapp] não deu para entregar a mensagem', detalhe)
    // O handoff cobre a pessoa, mas token expirado e número bloqueado derrubam
    // *todas* as conversas do cliente ao mesmo tempo — é o tipo de falha que
    // precisa chegar em alguém antes de virar um dia inteiro de leads perdidos.
    await alertar('a Cloud API recusou a entrega', detalhe, contexto)
    return { ok: false, motivo: `não deu para entregar a mensagem — ${detalhe.slice(0, 200)}` }
  }
}

async function aplicar(
  canal: Canal,
  contato: Contato,
  sessaoId: string,
  mensagemId: string,
  acoes: Acao[],
): Promise<void> {
  const campos = { ...contato.campos }
  let mexeuNosCampos = false

  /** O que o alerta de entrega precisa para achar a conversa no painel. */
  const alvo: ContextoDoAlerta = { contato: contato.id, sessao: sessaoId }

  const salvarCampos = async () => {
    if (mexeuNosCampos) await guardarCampo(contato.id, campos)
    mexeuNosCampos = false
  }

  /** Tira a conversa do bot e deixa registrado por quê. */
  const pararNoHumano = async (motivo: string) => {
    await salvarCampos()
    await registrarHandoff(sessaoId, motivo)
    await guardarSessao(sessaoId, {
      noAtual: null,
      vars: campos,
      tentativas: 0,
      status: 'humano',
    })
  }

  for (const acao of acoes) {
    switch (acao.tipo) {
      case 'enviar_texto': {
        if (acao.atrasoMs) await canal.aguardarResposta(mensagemId, acao.atrasoMs)

        // Grava antes de mandar e confirma depois — ver `registrarSaida`.
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          texto: acao.texto,
        })
        const entrega = await entregar(() => canal.enviarTexto(contato.waId, acao.texto), alvo)
        // Parar em vez de seguir: mandar a terceira mensagem depois da segunda
        // ter falhado entrega uma conversa fora de ordem, e uma conversa fora
        // de ordem é pior do que uma pessoa assumindo. A linha fica gravada
        // como não confirmada, que é o registro honesto do que se tentou.
        if (!entrega.ok) return pararNoHumano(entrega.motivo)

        await confirmarEntrega(registro)
        break
      }

      case 'enviar_midia': {
        if (acao.atrasoMs) await canal.aguardarResposta(mensagemId, acao.atrasoMs)

        // O que fica na conversa é a legenda, e sem legenda o rótulo do tipo.
        // Uma linha em branco no histórico do lead esconderia que algo foi
        // entregue; `payload` guarda o resto para a tela desenhar o anexo.
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          texto: acao.legenda ?? '',
          payload: {
            midia: acao.midia,
            url: acao.url,
            ...(acao.nomeArquivo ? { nomeArquivo: acao.nomeArquivo } : {}),
          },
        })
        const entrega = await entregar(
          () =>
            canal.enviarMidia(contato.waId, {
              midia: acao.midia,
              url: acao.url,
              ...(acao.legenda ? { legenda: acao.legenda } : {}),
              ...(acao.nomeArquivo ? { nomeArquivo: acao.nomeArquivo } : {}),
            }),
          alvo,
        )
        // Mesma regra do texto: entrega que falha para o resto. Mandar o preço
        // depois de a foto do plano ter falhado entrega a conversa pela metade.
        if (!entrega.ok) return pararNoHumano(entrega.motivo)

        await confirmarEntrega(registro)
        break
      }

      case 'enviar_opcoes': {
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          texto: acao.texto,
          payload: { opcoes: acao.opcoes, formato: acao.formato },
        })
        const entrega = await entregar(
          () => canal.enviarOpcoes(contato.waId, acao.texto, acao.opcoes, acao.formato),
          alvo,
        )
        if (!entrega.ok) return pararNoHumano(entrega.motivo)

        await confirmarEntrega(registro)
        break
      }

      case 'salvar_campo':
        campos[acao.campo] = acao.valor
        mexeuNosCampos = true
        break

      case 'pausar_automacao':
        /**
         * O AutoOff, e ele é diferente do handoff em algo que importa: **não
         * chama ninguém.** Ninguém entra na fila, ninguém é avisado, e o bot
         * simplesmente para de responder para esta pessoa.
         *
         * A pausa é do **contato** e não da sessão — sobrevive à próxima
         * conversa, que é o comportamento que a coluna `automacao_ativa`
         * sempre teve quando alguém desliga pela tela. Um AutoOff que valesse
         * só até o fim da conversa não desligaria nada na prática.
         *
         * As ações seguintes continuam saindo: o desenho comum é calar o bot e
         * mandar a última frase, e parar aqui engoliria justamente a despedida.
         */
        await alterarAutomacaoDoContato(contato.clienteId, contato.id, false)
        break

      case 'transferir_humano':
        await registrarHandoff(sessaoId, acao.motivo)
        break

      case 'chamar_ia': {
        // Só chega aqui quando não há modelo disponível: automação sem o plano
        // de IA contratado, ou sem chave no ambiente. O fluxo publicado pede
        // uma resposta que ninguém pode dar, então a conversa vai para uma
        // pessoa em vez de ficar pendurada esperando o que nunca vem.
        //
        // O aviso pode não sair, e mesmo assim o handoff é registrado: quem
        // está esperando tem que aparecer na tela mesmo quando o canal falhou.
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          texto: AVISO_DE_HANDOFF,
        })
        const entrega = await entregar(() => canal.enviarTexto(contato.waId, AVISO_DE_HANDOFF), alvo)
        if (entrega.ok) await confirmarEntrega(registro)

        return pararNoHumano(
          entrega.ok
            ? 'o fluxo pediu IA e não há modelo disponível'
            : `o fluxo pediu IA e não há modelo disponível, e ${entrega.motivo}`,
        )
      }

      case 'chamar_http': {
        // O resolvedor sempre atende esta ação — inclusive quando a chamada
        // falha, porque `aoFalhar` decide lá. Chegar aqui é defeito nosso, e
        // entre deixar alguém pendurado e passar para uma pessoa, passa.
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          texto: AVISO_DE_HANDOFF,
        })
        const entrega = await entregar(() => canal.enviarTexto(contato.waId, AVISO_DE_HANDOFF), alvo)
        if (entrega.ok) await confirmarEntrega(registro)

        return pararNoHumano(
          entrega.ok
            ? 'a integração não chegou a ser executada'
            : `a integração não chegou a ser executada, e ${entrega.motivo}`,
        )
      }

      case 'encerrar':
        break
    }
  }

  await salvarCampos()
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
