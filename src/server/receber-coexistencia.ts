import 'server-only'
import { z } from 'zod'
import { alertar } from './alertar'
import {
  acharCanalPorNumero,
  acharOuCriarContato,
  calarBotNaConversa,
  type CanalSalvo,
} from './repos/conversas'
import {
  anotarProgressoDoSync,
  apagarContatosDaAgenda,
  guardarContatosDaAgenda,
  marcarDesembarque,
  nomeNaAgenda,
  registrarMensagemDeCoexistencia,
  type ContatoDaAgenda,
  existeCanalComWaba,
} from './repos/coexistencia'

/**
 * Coexistência: o cliente atende pelo celular, a gente atende pela Cloud API,
 * e os dois lados enxergam a mesma conversa.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe
 * ---------------------------------------------------------------------------
 *
 * Mesma razão de `receber-do-instagram.ts`: o que muda é o **formato** do que
 * chega, não o que acontece depois. Três campos novos do tópico
 * `whatsapp_business_account` chegam no mesmo envelope de sempre
 * (`entry[].changes[]`), mas cada um com um `value` de forma própria:
 *
 * | campo                 | o que traz                                        |
 * |-----------------------|---------------------------------------------------|
 * | `history`             | conversas passadas, na adesão                     |
 * | `smb_app_state_sync`  | os contatos da agenda do celular dele              |
 * | `smb_message_echoes`  | o que ele mandar pelo celular, dali em diante      |
 *
 * O `messages` de sempre continua onde estava. Este arquivo trata só os três,
 * e não encosta no caminho quente da mensagem que chega de um cliente.
 *
 * ---------------------------------------------------------------------------
 * O campo que decide, e por que ele não existia até agora
 * ---------------------------------------------------------------------------
 *
 * `changes[].field` sempre esteve no payload da Meta e o `webhookSchema` nunca
 * o leu — não precisava, porque só `messages` era assinado. Com três campos
 * novos no mesmo envelope, ler o `field` deixa de ser detalhe e vira a única
 * forma de saber o que se está olhando: os quatro `value` têm formatos
 * diferentes e nenhum jeito confiável de se distinguir pelo conteúdo.
 *
 * ---------------------------------------------------------------------------
 * As armadilhas, todas documentadas antes de doerem
 * ---------------------------------------------------------------------------
 *
 * 1. **`smb_message_echoes` é o humano falando.** Não é a nossa mensagem
 *    voltando (isso é `is_echo` do Instagram) — é o dono do negócio digitando
 *    no celular dele. Tratar como entrada faria o bot responder ao próprio
 *    cliente; ignorar faria o bot atropelar uma conversa que já estava
 *    acontecendo. As duas estão erradas: o certo é **calar o bot**, que é o
 *    que um handoff já significa neste produto.
 * 2. **Mídia velha no histórico nunca chega.** Mensagem com anexo vem como
 *    `type: "media_placeholder"`, sem conteúdo. O conteúdo vem num `history`
 *    posterior — **só se for das últimas duas semanas**. Mais velho que isso, o
 *    placeholder é tudo que vai existir, para sempre.
 * 3. **`remove` vem sem nome.** No `smb_app_state_sync`, a ação `add` traz
 *    `full_name` e `first_name`; a `remove` traz só o telefone. Ler o nome sem
 *    checar a ação grava `undefined` por cima de um contato bom.
 * 4. **Recusar histórico não é falha.** Se o cliente não quis compartilhar,
 *    chega um `history` com erro **2593109**. É resposta normal — tratar como
 *    erro encheria a tela de alerta de uma escolha legítima dele.
 */

/* -------------------------------------------------------------------------- */
/* O envelope                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Uma mensagem dentro de `history` ou `smb_message_echoes`.
 *
 * Deliberadamente frouxo: é o payload do WhatsApp de sempre, e o que interessa
 * aqui é identificar, datar e saber a direção. O resto vai cru para
 * `messages.payload`, que é onde ele tem valor — campo novo da Meta não pode
 * derrubar o parse de um lote inteiro de histórico.
 */
const mensagemDoHistoricoSchema = z
  .object({
    id: z.string(),
    from: z.string().optional(),
    to: z.string().optional(),
    type: z.string().optional(),
    timestamp: z.string().optional(),
    text: z.object({ body: z.string() }).optional(),
  })
  .passthrough()

/** Um contato da agenda do celular dele. Ver armadilha 3. */
const contatoDaAgendaSchema = z.object({
  phone_number: z.string(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  /** `add` traz os nomes; `remove` traz só o telefone. */
  action: z.enum(['add', 'remove']).optional(),
})

/**
 * O erro que a Meta manda dentro de um `history`.
 *
 * O código 2593109 é o cliente ter recusado compartilhar — ver armadilha 4.
 */
const erroSchema = z
  .object({
    code: z.number().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough()

const valorSchema = z
  .object({
    metadata: z.object({ phone_number_id: z.string() }).optional(),
    contacts: z
      .array(
        z.object({
          wa_id: z.string(),
          profile: z.object({ name: z.string().optional() }).optional(),
        }),
      )
      .optional(),
    messages: z.array(mensagemDoHistoricoSchema).optional(),
    errors: z.array(erroSchema).optional(),

    /* `history` — os lotes vêm fatiados e a ordem importa. */
    history: z
      .array(
        z.object({
          metadata: z
            .object({
              /** `0` = dia 0 a 1 · `1` = dia 1 a 90 · `2` = dia 90 a 180. */
              phase: z.number().optional(),
              /** Ordene os lotes por ele. */
              chunk_order: z.number().optional(),
              progress: z.number().optional(),
            })
            .optional(),
          threads: z
            .array(
              z.object({
                id: z.string().optional(),
                messages: z.array(mensagemDoHistoricoSchema).default([]),
              }),
            )
            .default([]),
          errors: z.array(erroSchema).optional(),
        }),
      )
      .optional(),

    /*
     * **`smb_message_echoes` chega em `message_echoes`, não em `messages`.**
     *
     * Custou o Inbox de um cliente inteiro: `tratarEcos` lia `valor.messages`,
     * que neste campo **nunca vem preenchido**. O echo entrava, o schema
     * aceitava por causa do `.passthrough()`, o laço não achava nada para
     * iterar e a função terminava com sucesso sem gravar nada.
     *
     * O pior tipo de defeito: 200 na resposta, zero alerta, zero log. Do lado
     * de fora é idêntico a "a Meta não mandou" — e foi exatamente essa a
     * conclusão errada a que chegamos por horas, até simular o payload real da
     * doc e ver que ele sumia.
     */
    message_echoes: z.array(mensagemDoHistoricoSchema).optional(),

    /* `smb_app_state_sync` — a agenda do celular. */
    state_sync: z
      .array(
        z.object({
          type: z.string().optional(),
          contact: contatoDaAgendaSchema.optional(),
          metadata: z.object({ progress: z.number().optional() }).optional(),
        }),
      )
      .optional(),
  })
  .passthrough()

export const webhookDeCoexistenciaSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z
              .object({
                /** O que decide tudo. Ver o cabeçalho. */
                field: z.string().optional(),
                value: valorSchema,
              })
              /*
               * Mesma lição do `messaging` do Instagram: uma mudança que não
               * encaixa vira `null` em vez de derrubar o lote inteiro. O mesmo
               * corpo carrega `messages` junto de `history`, e um formato novo
               * da Meta num deles não pode fazer o outro ser descartado em
               * silêncio.
               */
              .nullable()
              .catch(null),
          )
          .default([]),
      }),
    )
    .default([]),
})

/** Os três campos que este arquivo trata. `messages` continua no outro. */
export const CAMPOS_DE_COEXISTENCIA = [
  'history',
  'smb_app_state_sync',
  'smb_message_echoes',
] as const

export type CampoDeCoexistencia = (typeof CAMPOS_DE_COEXISTENCIA)[number]

export function ehCampoDeCoexistencia(campo: string | undefined): campo is CampoDeCoexistencia {
  return CAMPOS_DE_COEXISTENCIA.includes(campo as CampoDeCoexistencia)
}

/** O código que a Meta usa para "o cliente não quis compartilhar o histórico". */
export const HISTORICO_RECUSADO = 2593109

/* -------------------------------------------------------------------------- */
/* A direção de uma mensagem                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Quem falou: o negócio ou a pessoa.
 *
 * **É a decisão que o handoff de `HANDOFF-COEXISTENCE.md` deixou em aberto**, e
 * ela tem uma regra só: `from` igual ao número do negócio significa saída. O
 * echo ainda traz `to`, então quando `from` falta, um `to` diferente do número
 * do negócio também é saída.
 *
 * Errar aqui inverte a conversa inteira na tela — o que o cliente disse aparece
 * como resposta nossa e vice-versa —, e como o histórico é importado uma vez
 * só, não há segunda chance de corrigir sem reimportar.
 */
export function direcaoDaMensagem(
  mensagem: { from?: string; to?: string },
  numeroDoNegocio: string | null,
): 'entrada' | 'saida' {
  if (!numeroDoNegocio) return 'entrada'
  if (mensagem.from) return mensagem.from === numeroDoNegocio ? 'saida' : 'entrada'
  // Sem `from`: um `to` que não é o número do negócio significa que ele mandou.
  if (mensagem.to) return mensagem.to === numeroDoNegocio ? 'entrada' : 'saida'
  return 'entrada'
}

/**
 * O telefone da pessoa do outro lado, seja qual for a direção.
 *
 * A conversa é **do contato**, não de quem digitou: uma mensagem que o dono
 * mandou pelo celular pertence à ficha de quem a recebeu. Pendurar pelo `from`
 * cru criaria um contato com o número do próprio negócio, e todo o histórico de
 * saída cairia nele.
 */
export function contatoDaMensagem(
  mensagem: { from?: string; to?: string },
  numeroDoNegocio: string | null,
): string | null {
  const direcao = direcaoDaMensagem(mensagem, numeroDoNegocio)
  const outro = direcao === 'saida' ? mensagem.to : mensagem.from
  return outro ?? null
}

/* -------------------------------------------------------------------------- */
/* Os handlers                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * O ponto de entrada: um payload que pode trazer qualquer um dos três campos.
 *
 * Chamado por `receberMensagem` **depois** de ele tratar o que é `messages`. Os
 * dois olham o mesmo corpo e cada um pega a sua parte, porque o mesmo POST da
 * Meta pode trazer `messages` e `history` juntos.
 *
 * **Nada aqui estoura.** Quem chama já respondeu 200 para a Meta (a rota
 * responde antes do `after()`), então uma exceção daqui seria um erro sem dono.
 * Cada campo é tratado isolado: um `history` malformado não pode fazer o
 * `smb_message_echoes` do mesmo corpo — que é o que cala o bot — ser perdido.
 *
 * **Não recebe `FabricaDeCanal`, diferente de `receberMensagem`.** Nada aqui
 * responde nada: os três campos ou gravam dado (agenda, histórico) ou calam o
 * bot (echo). Aceitar uma fábrica sugeriria que um destes caminhos pode mandar
 * mensagem — e mandar mensagem ao importar histórico seria disparar seis meses
 * de conversa de novo, na cara do cliente.
 */
export async function receberCoexistencia(payload: unknown): Promise<void> {
  const analise = webhookDeCoexistenciaSchema.safeParse(payload)
  if (!analise.success) return

  for (const entrada of analise.data.entry) {
    for (const mudanca of entrada.changes) {
      // `null` é a mudança que não encaixou no schema. O laço segue.
      if (!mudanca) continue
      if (!ehCampoDeCoexistencia(mudanca.field)) continue

      const numero = mudanca.value.metadata?.phone_number_id
      if (!numero) continue

      const canal = await acharCanalPorNumero(numero)
      /*
       * Número que a Meta conhece e nós não.
       *
       * Diferente do `continue` mudo que custou uma tarde no Instagram: aqui o
       * silêncio seria pior ainda, porque `history` chega **uma vez só**. Um
       * canal não encontrado significa histórico perdido para sempre, e sem
       * alerta ninguém descobriria antes de o cliente reclamar que a conversa
       * antiga sumiu.
       */
      if (!canal) {
        await alertar(
          'coexistência chegou para um número que não está ligado a nenhum cliente',
          new Error(`phone_number_id ${numero} não casa com nenhum channels.phone_number_id`),
          { numero, campo: mudanca.field },
        )
        continue
      }

      if (canal.status !== 'ativo') continue

      try {
        await tratarCampo(canal, mudanca.field, mudanca.value)
      } catch (erro) {
        await alertar('o campo de coexistência falhou', erro, {
          cliente: canal.clienteId,
          numero,
          campo: mudanca.field,
        })
      }
    }
  }
}

async function tratarCampo(
  canal: CanalSalvo,
  campo: CampoDeCoexistencia,
  valor: z.infer<typeof valorSchema>,
): Promise<void> {
  switch (campo) {
    case 'smb_app_state_sync':
      return tratarAgenda(canal, valor)
    case 'history':
      return tratarHistorico(canal, valor)
    case 'smb_message_echoes':
      return tratarEcos(canal, valor)
  }
}

/* -------------------------------------------------------------------------- */
/* 1. A agenda do celular                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `smb_app_state_sync`: os contatos da agenda dele.
 *
 * **Vão para `contatos_da_agenda`, não para `contacts`** — ver o cabeçalho da
 * 0047. É a agenda do aparelho (o dentista dele, a mãe dele), não gente que
 * escreveu para o negócio. Misturar encheria a tela de leads de gente que nunca
 * falou com ninguém, e cada uma contaria como lead na métrica.
 *
 * As duas ações vão por caminhos separados por causa da armadilha 3: `remove`
 * chega **sem os nomes**, e passá-la pelo mesmo `upsert` gravaria vazio por
 * cima de um nome bom.
 */
async function tratarAgenda(
  canal: CanalSalvo,
  valor: z.infer<typeof valorSchema>,
): Promise<void> {
  const itens = valor.state_sync ?? []
  if (itens.length === 0) return

  const aGravar: ContatoDaAgenda[] = []
  const aApagar: string[] = []

  for (const item of itens) {
    const contato = item.contact
    if (!contato) continue

    if (contato.action === 'remove') {
      aApagar.push(contato.phone_number)
      continue
    }

    aGravar.push({
      phoneNumber: contato.phone_number,
      ...(contato.full_name === undefined ? {} : { fullName: contato.full_name }),
      ...(contato.first_name === undefined ? {} : { firstName: contato.first_name }),
    })
  }

  await guardarContatosDaAgenda(canal.clienteId, canal.id, aGravar)
  await apagarContatosDaAgenda(canal.clienteId, aApagar)

  await anotar(canal, 'contatos', ultimoProgresso(itens.map((i) => i.metadata?.progress)))
}

/**
 * O último progresso informado no lote, se algum veio.
 *
 * `undefined` quando nenhum item trouxe o campo — que é diferente de `0`, o
 * progresso legítimo de uma sincronização que acabou de começar.
 */
function ultimoProgresso(valores: (number | undefined)[]): number | undefined {
  for (let i = valores.length - 1; i >= 0; i -= 1) {
    const valor = valores[i]
    if (typeof valor === 'number') return valor
  }
  return undefined
}

/**
 * Anota o progresso sem deixar isso derrubar a importação.
 *
 * **Melhor-esforço de propósito.** O lote que chegou junto já foi gravado; uma
 * falha ao anotar o andamento não pode desfazer isso nem impedir o próximo
 * lote. O progresso serve para a tela saber que a coisa anda — perder um ponto
 * dele é bem menos grave que perder um pedaço do histórico, que não volta.
 */
async function anotar(
  canal: CanalSalvo,
  tipo: 'contatos' | 'historico',
  progresso: number | undefined,
): Promise<void> {
  if (progresso === undefined) return

  try {
    await anotarProgressoDoSync(canal.id, tipo, progresso)
  } catch (erro) {
    await alertar('não deu para anotar o progresso da sincronização', erro, {
      cliente: canal.clienteId,
      sync: tipo,
    })
  }
}

/* -------------------------------------------------------------------------- */
/* 2. O histórico                                                              */
/* -------------------------------------------------------------------------- */

/**
 * `history`: as conversas que já existiam no celular dele.
 *
 * Quatro coisas que este handler tem que acertar, e todas custam caro se
 * erradas:
 *
 * 1. **A recusa não é erro.** Código 2593109 = o cliente não quis compartilhar.
 *    É escolha legítima; vira um `return` silencioso, não alerta.
 * 2. **A ordem é por `chunk_order`.** Os lotes chegam fatiados e fora de ordem;
 *    gravar na ordem de chegada deixaria a conversa embaralhada na tela.
 * 3. **A data é a da mensagem, não a de agora.** `messages.ts` tem
 *    `default now()`, que carimbaria seis meses de conversa com o instante da
 *    importação. O `timestamp` da Meta vem em **segundos**, não milissegundos.
 * 4. **O `wa_message_id` unique é quem deduplica.** Inclusive entre o histórico
 *    e um echo da mesma mensagem, que é o caso que acontece de verdade: uma
 *    mensagem recente aparece nos dois. Não há checagem prévia — quem garante é
 *    o banco, como em `registrarEntrada`.
 */
async function tratarHistorico(
  canal: CanalSalvo,
  valor: z.infer<typeof valorSchema>,
): Promise<void> {
  // Armadilha 4: a recusa chega como erro e não é falha.
  const recusou = [...(valor.errors ?? []), ...(valor.history ?? []).flatMap((h) => h.errors ?? [])]
  if (recusou.some((e) => e.code === HISTORICO_RECUSADO)) return

  const lotes = [...(valor.history ?? [])].sort(
    (a, b) => (a.metadata?.chunk_order ?? 0) - (b.metadata?.chunk_order ?? 0),
  )

  for (const lote of lotes) {
    for (const thread of lote.threads) {
      for (const mensagem of thread.messages) {
        await gravarMensagemImportada(canal, mensagem, true)
      }
    }
  }

  /*
   * O progresso vem do último lote **na ordem de `chunk_order`**, não na de
   * chegada — os lotes chegam fora de ordem, e o progresso do que chegou por
   * último não é necessariamente o mais adiantado.
   */
  await anotar(canal, 'historico', ultimoProgresso(lotes.map((l) => l.metadata?.progress)))
}

/**
 * Uma mensagem do histórico ou de um echo, na ficha da pessoa certa.
 *
 * O contato é **o outro lado da conversa**, nunca quem digitou: uma mensagem
 * que o dono mandou pelo celular pertence à ficha de quem a recebeu. Pendurar
 * pelo `from` cru criaria um contato com o número do próprio negócio, e todo o
 * histórico de saída cairia nele.
 */
async function gravarMensagemImportada(
  canal: CanalSalvo,
  mensagem: z.infer<typeof mensagemDoHistoricoSchema>,
  historico: boolean,
): Promise<void> {
  const waId = contatoDaMensagem(mensagem, canal.phoneNumberId)
  if (!waId) return

  const direcao = direcaoDaMensagem(mensagem, canal.phoneNumberId)

  /*
   * O nome vem da agenda dele quando existe.
   *
   * É o pagamento do `smb_app_state_sync`: quem estava na agenda do cliente
   * entra com nome em vez de aparecer como número cru na tela.
   */
  const nome = await nomeNaAgenda(canal.clienteId, waId)
  const contato = await acharOuCriarContato(canal.clienteId, waId, nome)

  await registrarMensagemDeCoexistencia({
    contatoId: contato.id,
    waMessageId: mensagem.id,
    direcao,
    texto: mensagem.text?.body ?? null,
    payload: mensagem,
    // Armadilha 3 do histórico: o `timestamp` da Meta vem em **segundos**.
    ts: carimboDaMeta(mensagem.timestamp),
    historico,
  })
}

/**
 * O `timestamp` da Meta em ISO, ou `null` para "use o `now()` do banco".
 *
 * Ela manda **segundos** desde a época, como string. Tratar como milissegundos
 * põe a conversa em 1970 — e como o histórico é importado uma vez só, não há
 * segunda chance de corrigir sem reimportar.
 */
export function carimboDaMeta(timestamp: string | undefined): string | null {
  if (!timestamp) return null
  const segundos = Number(timestamp)
  if (!Number.isFinite(segundos) || segundos <= 0) return null
  return new Date(segundos * 1_000).toISOString()
}

/* -------------------------------------------------------------------------- */
/* 3. Os ecos — o humano falando pelo celular                                  */
/* -------------------------------------------------------------------------- */

/**
 * `smb_message_echoes`: o dono do negócio respondeu pelo celular.
 *
 * **É o campo mais importante dos três para o produto**, e o único que muda o
 * comportamento do bot em vez de só gravar dado.
 *
 * Uma mensagem daqui é **um humano atendendo**. Se o bot continuar respondendo,
 * ele atropela uma conversa que já está acontecendo — a pessoa recebe duas
 * respostas, uma delas automática, por cima de alguém que já estava falando com
 * ela. É exatamente o defeito que a coexistência existe para evitar.
 *
 * A resposta é a que o produto já tem: **calar o bot naquela conversa**, o mesmo
 * que um handoff. `calarBotNaConversa` é reusada de propósito — ela já sabe não
 * promover sessão `encerrada` a `humano`, que reescreveria o histórico e faria a
 * taxa de "resolvidas pelo bot" cair por uma conversa que ele resolveu.
 */
async function tratarEcos(
  canal: CanalSalvo,
  valor: z.infer<typeof valorSchema>,
): Promise<void> {
  /*
   * `message_echoes` é onde a Meta põe o echo (doc de `smb_message_echoes`).
   * `messages` fica de reserva porque payloads antigos chegavam assim, e ler os
   * dois não custa nada — deixar de ler um custou o Inbox de um cliente.
   */
  for (const mensagem of valor.message_echoes ?? valor.messages ?? []) {
    const waId = contatoDaMensagem(mensagem, canal.phoneNumberId)
    if (!waId) continue

    await gravarMensagemImportada(canal, mensagem, false)

    /*
     * Só o que o **negócio** mandou cala o bot.
     *
     * Um echo de entrada é a mensagem da pessoa chegando por outro caminho — o
     * `messages` de sempre já a trata, e calar o bot por causa dela desligaria a
     * automação a cada mensagem recebida, que é o oposto do produto.
     */
    if (direcaoDaMensagem(mensagem, canal.phoneNumberId) !== 'saida') continue

    const contato = await acharOuCriarContato(canal.clienteId, waId, null)
    await calarBotNaConversa(contato.id)
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Desembarque e reconexão                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `ACCOUNT_OFFBOARDED` / `ACCOUNT_RECONNECTED`, do campo `account_update`.
 *
 * O cliente trocou de celular ou reinstalou o WhatsApp Business, e o companion
 * da Cloud API foi desembarcado **sozinho** — sem ação nossa e sem ação dele.
 * Normalmente reconecta em minutos.
 *
 * Enquanto não reconecta, **todo envio daquele número falha**. Sem tratar os
 * dois eventos, a troca de aparelho de um cliente vira uma fila de envios
 * falhando em silêncio — o tipo de defeito que ninguém percebe até alguém
 * ligar reclamando.
 *
 * `account_update` **já está assinado** hoje, então isto começa a valer no
 * mesmo deploy, sem depender de painel nenhum.
 */
export async function tratarAtualizacaoDaConta(payload: unknown): Promise<void> {
  const analise = webhookDeCoexistenciaSchema.safeParse(payload)
  if (!analise.success) return

  for (const entrada of analise.data.entry) {
    for (const mudanca of entrada.changes) {
      if (!mudanca || mudanca.field !== 'account_update') continue

      const evento = (mudanca.value as Record<string, unknown>).event

      /*
       * **`PARTNER_ADDED` é a prova de que o cliente terminou o Embedded
       * Signup, e ela chega mesmo quando o navegador dele não volta.**
       *
       * A doc da Meta é literal: *"You must be subscribed to the
       * `account_update` webhook, as this webhook is triggered whenever a
       * customer successfully completes the Embedded Signup flow"*.
       *
       * Isso importa porque o retorno pelo navegador é frágil de um jeito que
       * não depende do nosso código: se o `redirect_uri` não estiver na lista
       * de *Valid OAuth redirect URIs* do painel, a Meta conclui a conexão e
       * **para na tela dela** — o cliente vê "pronto", e nós não ficamos
       * sabendo de nada. Aconteceu duas vezes em 13/set/2026 antes de alguém
       * entender o que estava havendo.
       *
       * O que este evento traz é `waba_info.waba_id`. O que ele **não** traz é
       * o `phone_number_id` nem um token — o token só sai da troca do `code`,
       * e o `code` só existe no retorno pelo navegador. Então aqui não dá para
       * completar o onboarding sozinho; dá para **registrar que ele aconteceu**
       * e dizer isso a alguém, que é muito melhor que silêncio.
       */
      if (evento === 'PARTNER_ADDED') {
        await registrarOnboardingPelaMeta(mudanca.value as Record<string, unknown>)
        continue
      }

      if (evento !== 'ACCOUNT_OFFBOARDED' && evento !== 'ACCOUNT_RECONNECTED') continue

      const numero = mudanca.value.metadata?.phone_number_id
      if (!numero) continue

      const canal = await acharCanalPorNumero(numero)
      if (!canal) continue

      try {
        await marcarDesembarque(canal.id, evento === 'ACCOUNT_OFFBOARDED')
      } catch (erro) {
        await alertar('não deu para marcar o desembarque do número', erro, {
          cliente: canal.clienteId,
          numero,
          evento,
        })
      }
    }
  }
}

/**
 * O `PARTNER_ADDED` chegou: alguém terminou o Embedded Signup.
 *
 * **Não conclui o onboarding, e não finge que conclui.** Faltam duas coisas que
 * este webhook não carrega: o token do cliente (que só sai da troca do `code`,
 * e o `code` só existe no retorno pelo navegador) e o `phone_number_id`.
 *
 * O que dá para fazer, e é o que importa, é **não perder o evento**. Se a WABA
 * já é de um canal nosso, a conexão se completou pelos dois caminhos e não há o
 * que fazer. Se não é, alguém conectou e o retorno não chegou — e aí o alerta
 * carrega o `waba_id`, que é exatamente o que falta para terminar à mão.
 *
 * O alerta é deliberadamente específico sobre a causa provável, porque quem for
 * lê-lo daqui a seis meses não vai ter o contexto de hoje.
 */
async function registrarOnboardingPelaMeta(valor: Record<string, unknown>): Promise<void> {
  const info = (valor.waba_info ?? {}) as Record<string, unknown>
  const wabaId = typeof info.waba_id === 'string' ? info.waba_id : null
  if (!wabaId) return

  // Já conhecemos esta WABA? Então o retorno pelo navegador funcionou e o
  // canal existe. Nada a fazer — o evento é só confirmação.
  if (await existeCanalComWaba(wabaId)) return

  await alertar(
    'um cliente terminou o Embedded Signup e o retorno não chegou até nós',
    new Error(
      `A Meta avisou por webhook (PARTNER_ADDED) que a WABA ${wabaId} foi conectada, mas nenhum canal nosso tem essa WABA — ou seja, o navegador do cliente não voltou para /api/whatsapp/retorno e o onboarding não foi concluído deste lado. Causa mais provável: o redirect_uri https://autofluxos.4yu.com.br/api/whatsapp/retorno não está em "Valid OAuth redirect URIs" no painel da Meta (Facebook Login for Business → Settings). Sem ele a Meta conclui a conexão e para na tela dela. A janela de 24h para sincronizar contatos e histórico **já está correndo**.`,
    ),
    { waba: wabaId },
  )
}
