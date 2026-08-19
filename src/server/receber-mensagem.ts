import 'server-only'
import { z } from 'zod'
import { canalCloudApi } from '@/channels/cloud-api'
import type { Canal } from '@/channels/types'
import { sessaoNova, type Acao, type Entrada } from '@/core/engine/types'
import { alertar, type ContextoDoAlerta } from './alertar'
import { executarComEfeitos, type OpcoesDeEfeitos } from './efeitos/resolver'
import { escolherModelo } from './ia/modelo'
import { acharCliente, horarioDoCliente } from './repos/clientes'
import { acharFluxo, acharVersao, type VersaoPublicada } from './repos/fluxos'
import { lerConversa } from './repos/leads'
import {
  ATENDIMENTO_SEMPRE_ABERTO,
  pediuAtendente,
  type ContextoDoAtendimento,
} from '@/core/engine/executar'
import { casarGatilho } from '@/core/gatilhos'
import { casarCampanha } from '@/core/campanhas'
import { atribuirCampanha, campanhasAtivas, contarDisparoDaCampanha } from './repos/campanhas'
import { chaveDoTimeout, dadosDoTimeoutSchema } from '@/core/tarefas'
import { agendar, cancelarPorChave } from './repos/tarefas'
import { timeoutDaPergunta } from '@/core/flow/schema'
import type { Fluxo } from '@/core/flow/schema'
import type { Sessao } from '@/core/engine/types'
import { dentroDaJanela } from '@/channels/janela'
import { contarDisparo, gatilhosAtivos } from './repos/gatilhos'
import {
  atendimentoAberto,
  proximaAbertura,
  type HorarioDeAtendimento,
} from '@/core/horario'
import {
  acharCanal,
  acharCanalPorNumero,
  acharContato,
  acharSessao,
  acharOuCriarContato,
  contextoDeResposta,
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
  type SessaoSalva,
} from './repos/conversas'
import { travarContato } from './repos/travas'
import { sairPorEvento } from './sequencias'

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

  /**
   * Quem responde sai das sequências (0031).
   *
   * **É a regra que separa acompanhamento de spam**, e ela vale mesmo quando o
   * bot está pausado, mesmo fora do expediente e mesmo que a conversa não vá
   * avançar por nenhum outro motivo — por isso está aqui em cima, e não lá
   * dentro. A pessoa voltou a falar; lembrá-la de falar é o que não pode
   * acontecer.
   *
   * Depois da deduplicação de propósito: reenvio da Meta não é uma resposta
   * nova, e usá-lo para tirar alguém de uma sequência seria deixar a fila de
   * entrega da Meta decidir o acompanhamento do cliente.
   */
  await sairPorEvento(contato.id, 'respondeu')

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

/**
 * Qual fluxo esta mensagem abre — e por quê.
 *
 * `null` significa "não abre nada": ou continua a conversa que já estava
 * andando, ou não há nada publicado para dizer.
 */
type Abertura = {
  versaoId: string
  /** Preenchido só quando quem escolheu foi um gatilho, para contar o disparo. */
  gatilhoId?: string
  /** Preenchido só quando quem escolheu foi uma campanha (B4). */
  campanhaId?: string
}

/**
 * A ordem de decisão da entrada — o coração da A6.
 *
 * Até aqui era uma linha só: conversa nova roda `channels.flow_id`. Agora são
 * quatro papéis e as palavras-chave da conta, e a ordem entre eles **é** a
 * regra do produto:
 *
 * 1. **O escape global ganha de tudo.** Antes de olhar gatilho nenhum: quem
 *    escreveu "quero falar com uma pessoa" pediu uma pessoa, e um gatilho do
 *    cliente com a palavra "falar" não pode sequestrar isso. A lista mora no
 *    motor (`PALAVRAS_ESCAPE`) e é lida de lá, não copiada para cá.
 * 1.5. **Campanha** (B4), antes do gatilho: ela casa com a **mensagem inteira**,
 *    que é um critério estrito, e é a porta de entrada que o cliente está
 *    pagando para manter aberta. Um `contem` do gatilho não pode roubá-la.
 * 2. **Gatilho por palavra-chave**, e ele **interrompe** a conversa em
 *    andamento. Parece agressivo e é o comportamento que já existia: o escape
 *    global sempre funcionou de dentro de qualquer pergunta. Um gatilho é o
 *    escape do cliente — tratá-lo diferente seria duas regras para a mesma
 *    ideia. Só casa em texto digitado: clique em botão nunca é sequestrado.
 * 3. **Fluxo de mídia**, que é o que aposenta a Regra B. Também interrompe,
 *    pelo mesmo motivo — e porque o que ele substitui (handoff imediato)
 *    interrompia ainda mais.
 * 4. **Boas-vindas**, só na primeira conversa deste contato **neste número**.
 * 5. **O principal**, que é a resposta padrão, só quando não há conversa viva
 *    para continuar.
 *
 * Papel apontando para fluxo sem versão publicada cai para o próximo candidato,
 * em vez de emudecer o número. Silêncio já é o preço de não ter nada publicado
 * em lugar nenhum; não precisa ser também o preço de configurar um papel a mais.
 */
async function escolherAbertura(
  canalSalvo: CanalSalvo,
  estado: { temSessaoViva: boolean; primeiraVez: boolean },
  entrada: Entrada,
): Promise<Abertura | null> {
  const candidatos: { fluxoId: string; gatilhoId?: string; campanhaId?: string }[] = []

  if (entrada.tipo === 'texto' && !pediuAtendente(entrada.texto)) {
    // As duas listas juntas: a conta que tem campanha quase sempre tem gatilho,
    // e buscar em série custaria uma viagem a mais em toda mensagem de texto.
    const [campanhas, gatilhos] = await Promise.all([
      campanhasAtivas(canalSalvo.clienteId),
      gatilhosAtivos(canalSalvo.clienteId),
    ])

    const campanha = casarCampanha(campanhas, entrada.texto)
    if (campanha) candidatos.push({ fluxoId: campanha.fluxoId, campanhaId: campanha.id })

    const casado = casarGatilho(gatilhos, entrada.texto)
    if (casado) candidatos.push({ fluxoId: casado.fluxoId, gatilhoId: casado.id })
  }

  if (entrada.tipo === 'midia' && canalSalvo.fluxoMidiaId) {
    candidatos.push({ fluxoId: canalSalvo.fluxoMidiaId })
  }

  if (estado.primeiraVez && canalSalvo.fluxoBoasVindasId) {
    candidatos.push({ fluxoId: canalSalvo.fluxoBoasVindasId })
  }

  if (!estado.temSessaoViva && canalSalvo.flowId) {
    candidatos.push({ fluxoId: canalSalvo.flowId })
  }

  for (const candidato of candidatos) {
    const fluxo = await acharFluxo(candidato.fluxoId)
    // Nada publicado: este candidato não fala. Melhor o próximo — ou o silêncio
    // — do que responder com um rascunho que ninguém revisou.
    if (fluxo?.versaoPublicadaId) {
      return {
        versaoId: fluxo.versaoPublicadaId,
        ...(candidato.gatilhoId ? { gatilhoId: candidato.gatilhoId } : {}),
        ...(candidato.campanhaId ? { campanhaId: candidato.campanhaId } : {}),
      }
    }
  }

  return null
}

async function avancarConversa(
  canalSalvo: CanalSalvo,
  contato: Contato,
  mensagem: Mensagem,
  entrada: Entrada,
  texto: string | null,
  fabricaDeCanal: FabricaDeCanal,
): Promise<void> {
  const anterior = await ultimaSessao(contato.id, canalSalvo.id)

  // O humano assumiu. O bot fica calado — a mensagem fica registrada, e quem
  // responde é a pessoa, do celular dela. Vale inclusive contra gatilho: o
  // cliente cadastrou palavra-chave para o bot, não para atropelar quem já
  // está conversando com a pessoa.
  if (anterior && anterior.sessao.status === 'humano') {
    await vincularSessaoNaMensagem(mensagem.id, anterior.id)
    return
  }

  const viva = anterior && anterior.sessao.status !== 'encerrada' ? anterior : null
  const abertura = await escolherAbertura(
    canalSalvo,
    { temSessaoViva: Boolean(viva), primeiraVez: anterior === null },
    entrada,
  )

  let salva: SessaoSalva
  const conversaNova = abertura !== null

  if (abertura) {
    // A conversa que estava andando morre aqui, e morre **encerrada**: deixar
    // uma sessão `ativa` para trás faria a próxima leitura achar duas vivas no
    // mesmo número, e as métricas contariam uma conversa que ninguém terminou.
    if (viva) await definirStatusDaSessao(viva.id, 'encerrada')

    salva = await criarSessao(contato.id, canalSalvo.id, abertura.versaoId, sessaoNova())
    // Depois de criar a sessão de propósito: o contador é da tela, e nunca pode
    // ficar entre a escolha do fluxo e a conversa existir.
    if (abertura.gatilhoId) await contarDisparo(abertura.gatilhoId)
    if (abertura.campanhaId) {
      await contarDisparoDaCampanha(abertura.campanhaId)
      // Primeiro toque: `atribuirCampanha` só escreve em contato sem campanha.
      await atribuirCampanha(contato.id, abertura.campanhaId)
    }
  } else if (viva) {
    salva = viva
  } else {
    // Nenhum papel deste número tem versão publicada. O bot não fala.
    return
  }

  const versao = await acharVersao(salva.flowVersionId)
  if (!versao) return

  await vincularSessaoNaMensagem(mensagem.id, salva.id)

  /**
   * O expediente vai junto, e as duas buscas correm ao mesmo tempo.
   *
   * O motor precisa saber se tem gente para atender **antes** de rodar, porque
   * é ele que decide o que dizer no handoff. Buscar em série custaria uma
   * viagem a mais no relógio de toda mensagem; em paralelo com o preparo da IA,
   * não custa nada.
   */
  const [opcoesDeIa, horario] = await Promise.all([
    prepararIa(canalSalvo, contato.id, versao, texto),
    horarioDoCliente(canalSalvo.clienteId),
  ])

  // Conversa nova começa pelo início do fluxo. A primeira mensagem da pessoa
  // é o gatilho, não uma resposta — ela ainda não foi perguntada nada. Vale
  // também para gatilho e para mídia: a frase que abriu o fluxo não é para ser
  // consumida como resposta do primeiro bloco dele.
  const resultado = await executarComEfeitos(
    versao.grafo,
    salva.sessao,
    conversaNova ? { tipo: 'inicio' } : entrada,
    { ...opcoesDeIa, atendimento: contextoDeAtendimento(horario) },
  )

  await guardarSessao(salva.id, resultado.sessao)
  await sincronizarTimeout(canalSalvo.clienteId, contato.id, salva.id, versao.grafo, resultado.sessao)
  await aplicar(fabricaDeCanal(canalSalvo), contato, salva.id, mensagem.id, resultado.acoes)
}

/**
 * Acerta o prazo da pergunta depois de cada rodada (B1).
 *
 * Uma chamada só para as duas metades — agendar e cancelar — porque elas são a
 * mesma decisão vista de dois lados: **a conversa parou numa pergunta com
 * prazo, ou não parou.** Separar em duas funções é como se esquece de chamar a
 * segunda, e esquecer o cancelamento é cobrar quem já respondeu.
 *
 * A chave é por sessão, então reagendar substitui: a espera recomeça a cada
 * repergunta, que é o que "prazo para responder" significa.
 */
async function sincronizarTimeout(
  clienteId: string,
  contatoId: string,
  sessaoId: string,
  grafo: Fluxo,
  sessao: Sessao,
): Promise<void> {
  const chave = chaveDoTimeout(sessaoId)

  const parada =
    sessao.status === 'ativa' && sessao.noAtual !== null
      ? grafo.nodes.find((no) => no.id === sessao.noAtual)
      : undefined

  const minutos = parada?.type === 'pergunta' ? timeoutDaPergunta(parada) : null
  if (minutos === null || minutos === undefined) {
    await cancelarPorChave(chave)
    return
  }

  await agendar({
    clienteId,
    tipo: 'timeout_de_pergunta',
    quando: new Date(Date.now() + minutos * 60_000),
    dados: { sessaoId, contatoId, noId: parada!.id },
    chave,
  })
}

/**
 * O prazo de uma pergunta venceu (B1). Chamada pelo agendador, não por mensagem.
 *
 * **Quase tudo aqui é motivo para não fazer nada**, e essa é a parte que
 * importa: a tarefa foi agendada minutos ou horas atrás, e no meio disso a
 * conversa pode ter andado, sido assumida por uma pessoa, encerrada, ou o bot
 * pode ter sido pausado. Agir sobre um estado que mudou é acordar alguém com
 * uma cobrança que não faz mais sentido — e o agendador é justamente a peça em
 * que ninguém está olhando quando ela erra.
 *
 * Devolve o que aconteceu para o cron poder contar, e não para decidir nada.
 */
export async function rodarTimeoutDePergunta(
  dados: unknown,
  fabricaDeCanal: FabricaDeCanal = canalPadrao,
): Promise<'feita' | 'ignorada'> {
  const analise = dadosDoTimeoutSchema.safeParse(dados)
  if (!analise.success) return 'ignorada'

  const { sessaoId, contatoId, noId } = analise.data

  const salva = await acharSessao(sessaoId)
  if (!salva) return 'ignorada'
  // A conversa saiu de `ativa` (assumida, encerrada, esperando IA) ou andou
  // para outro bloco. Nos dois casos o prazo perdeu o dono.
  if (salva.sessao.status !== 'ativa' || salva.sessao.noAtual !== noId) return 'ignorada'

  const [contato, canal, versao] = await Promise.all([
    acharContato(contatoId),
    acharCanal(salva.canalId),
    acharVersao(salva.flowVersionId),
  ])
  if (!contato || !canal || !versao) return 'ignorada'
  if (!contato.automacaoAtiva) return 'ignorada'

  // A mesma trava do webhook. Não conseguir a vez significa que uma mensagem
  // está sendo processada agora — e a mensagem ganha do prazo, sempre.
  const destravar = await travarContato(contatoId)
  if (!destravar) return 'ignorada'

  try {
    // Reler dentro da trava: a mensagem que estava chegando pode ter acabado de
    // mover a conversa entre a leitura de cima e este ponto.
    const agora = await acharSessao(sessaoId)
    if (!agora || agora.sessao.status !== 'ativa' || agora.sessao.noAtual !== noId) {
      return 'ignorada'
    }

    const [opcoesDeIa, horario] = await Promise.all([
      prepararIa(canal, contatoId, versao, null),
      horarioDoCliente(canal.clienteId),
    ])

    const resultado = await executarComEfeitos(versao.grafo, agora.sessao, { tipo: 'timeout' }, {
      ...opcoesDeIa,
      atendimento: contextoDeAtendimento(horario),
    })

    await guardarSessao(sessaoId, resultado.sessao)
    await sincronizarTimeout(canal.clienteId, contatoId, sessaoId, versao.grafo, resultado.sessao)
    await aplicar(fabricaDeCanal(canal), contato, sessaoId, null, resultado.acoes)
    return 'feita'
  } finally {
    await destravar()
  }
}

/**
 * O fluxo de pós-atendimento, disparado por "Já atendi" (A6).
 *
 * É o único dos quatro papéis que **ninguém pediu por mensagem**: o gatilho é
 * uma pessoa da equipe encerrando o atendimento. Isso muda três coisas em
 * relação ao caminho do webhook, e as três estão aqui:
 *
 * - **a janela de 24h é conferida antes de falar.** Nos outros papéis a pessoa
 *   acabou de escrever, então a janela está aberta por definição. Aqui pode
 *   fazer dias — e o WhatsApp recusaria, virando handoff logo depois de alguém
 *   ter marcado a conversa como resolvida;
 * - **a automação pausada é respeitada.** AutoOff cala o bot para aquele
 *   contato, e encerrar um atendimento não é motivo para ele voltar a falar;
 * - **nada aqui pode derrubar o "Já atendi".** Quem chama já resolveu o
 *   handoff; um erro daqui não pode desfazer isso, então tudo é log e alerta.
 */
export async function rodarPosAtendimento(
  clienteId: string,
  contatoId: string,
  fabricaDeCanal: FabricaDeCanal = canalPadrao,
): Promise<void> {
  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto?.canal.fluxoPosAtendimentoId) return

  try {
    await abrirFluxoParaContato(
      clienteId,
      contatoId,
      contexto.canal.fluxoPosAtendimentoId,
      fabricaDeCanal,
    )
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    console.error('[pos-atendimento] não deu para rodar o fluxo', detalhe)
    await alertar('o fluxo de pós-atendimento falhou', detalhe, { contato: contatoId })
  }
}

/**
 * Por que uma abertura por nossa conta não aconteceu.
 *
 * São motivos, e não `false`, porque **quem chama decide coisas diferentes com
 * cada um**. O pós-atendimento só desiste; a sequência precisa saber se para de
 * vez (`janela_fechada`, `automacao_pausada`) ou se tenta o próximo passo
 * (`ocupado`, que é uma mensagem chegando neste exato instante). Um booleano
 * aqui obrigaria a sequência a adivinhar, e adivinhar errado significa ou
 * insistir com quem pediu silêncio, ou abandonar quem só estava ocupado.
 */
export type AberturaPorNossaConta =
  | 'aberto'
  | 'sem_contexto'
  | 'janela_fechada'
  | 'automacao_pausada'
  | 'sem_fluxo'
  | 'ocupado'

/**
 * Abre um fluxo para um contato **sem ninguém ter escrito agora**.
 *
 * É o caminho comum do pós-atendimento (A6) e do passo de sequência (0031), e
 * ele é diferente do webhook em três pontos que valem para os dois:
 *
 * - **a janela de 24h é conferida antes de falar.** No webhook a pessoa acabou
 *   de escrever, então a janela está aberta por definição. Aqui pode fazer
 *   dias — e o WhatsApp recusaria com `(#131047)`, virando handoff logo depois
 *   de alguém ter marcado a conversa como resolvida;
 * - **a automação pausada é respeitada.** AutoOff cala o bot naquele contato, e
 *   nem encerrar um atendimento nem um prazo de sequência é motivo para ele
 *   voltar a falar;
 * - **a conversa que estava viva morre `encerrada`.** É a mesma regra do
 *   gatilho e da campanha: deixar uma sessão `ativa` para trás faria a próxima
 *   leitura achar duas vivas no mesmo número, e as métricas contariam uma
 *   conversa que ninguém terminou.
 */
export async function abrirFluxoParaContato(
  clienteId: string,
  contatoId: string,
  fluxoId: string,
  fabricaDeCanal: FabricaDeCanal = canalPadrao,
): Promise<AberturaPorNossaConta> {
  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return 'sem_contexto'

  if (!dentroDaJanela(contexto.ultimaEntradaEm)) return 'janela_fechada'

  const contato = await acharContato(contatoId)
  if (!contato) return 'sem_contexto'
  if (!contato.automacaoAtiva) return 'automacao_pausada'

  const fluxo = await acharFluxo(fluxoId)
  if (!fluxo || fluxo.clienteId !== clienteId || !fluxo.versaoPublicadaId) return 'sem_fluxo'

  const versao = await acharVersao(fluxo.versaoPublicadaId)
  if (!versao) return 'sem_fluxo'

  // A mesma trava do webhook: uma mensagem chegando neste instante não pode
  // avançar a conversa junto com o que estamos abrindo.
  const destravar = await travarContato(contatoId)
  if (!destravar) return 'ocupado'

  try {
    const anterior = await ultimaSessao(contatoId, contexto.canal.id)
    if (anterior && anterior.sessao.status !== 'encerrada') {
      await definirStatusDaSessao(anterior.id, 'encerrada')
    }

    const salva = await criarSessao(contatoId, contexto.canal.id, versao.id, sessaoNova())

    const [opcoesDeIa, horario] = await Promise.all([
      prepararIa(contexto.canal, contatoId, versao, null),
      horarioDoCliente(clienteId),
    ])

    const resultado = await executarComEfeitos(versao.grafo, salva.sessao, { tipo: 'inicio' }, {
      ...opcoesDeIa,
      atendimento: contextoDeAtendimento(horario),
    })

    await guardarSessao(salva.id, resultado.sessao)
    await aplicar(
      fabricaDeCanal(contexto.canal),
      contato,
      salva.id,
      contexto.ultimaEntradaWaId,
      resultado.acoes,
    )
    return 'aberto'
  } finally {
    await destravar()
  }
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
  versao: VersaoPublicada,
  perguntaDaPessoa: string | null,
): Promise<OpcoesDeEfeitos> {
  const vazio: OpcoesDeEfeitos = {
    modelo: null,
    contextoNegocio: '',
    origem: 'whatsapp',
    clienteId: canalSalvo.clienteId,
  }
  if (!versao.grafo.nodes.some((n) => n.type === 'ia')) return vazio

  // **O fluxo vem da versão que está rodando, não do número.** Eram a mesma
  // coisa enquanto um número executava um fluxo só; com quatro papéis e
  // gatilhos, `channels.flow_id` passou a ser só um dos fluxos possíveis — e
  // ler o contrato de IA dele decidiria pelo fluxo errado justamente no portão
  // que separa quem paga a Etapa 2 de quem não paga.
  const [fluxo, cliente, conversa] = await Promise.all([
    acharFluxo(versao.fluxoId),
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

/**
 * `mensagemId` é o id, na Meta, da entrada que abriu esta rodada. Ele serve ao
 * "digitando" e ao atraso entre blocos, que a Cloud API pendura numa mensagem
 * recebida. O pós-atendimento roda sem ninguém ter escrito agora, e por isso
 * ele pode chegar nulo: o que se perde é o indicador, não o envio.
 */
async function aplicar(
  canal: Canal,
  contato: Contato,
  sessaoId: string,
  mensagemId: string | null,
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
        if (acao.atrasoMs && mensagemId) await canal.aguardarResposta(mensagemId, acao.atrasoMs)

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
        if (acao.atrasoMs && mensagemId) await canal.aguardarResposta(mensagemId, acao.atrasoMs)

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

/**
 * Traduz o expediente da conta no que o motor entende.
 *
 * `null` — conta que nunca configurou — vira "sempre aberto". É o que a coluna
 * vazia significa, e o lado seguro do erro: um produto que emudece sozinho por
 * causa de uma coluna nova é bem pior que um que continua respondendo.
 */
function contextoDeAtendimento(horario: HorarioDeAtendimento | null): ContextoDoAtendimento {
  if (!horario) return ATENDIMENTO_SEMPRE_ABERTO

  return {
    atendimentoAberto: atendimentoAberto(horario),
    proximaAbertura: proximaAbertura(horario),
  }
}
