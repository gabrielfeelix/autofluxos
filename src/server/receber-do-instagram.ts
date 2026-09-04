import 'server-only'
import { z } from 'zod'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { nomeDoPerfil } from './instagram/conexao'
import {
  type CanalSalvo,
  acharCanalPorContaDoInstagram,
  lerTokenDoCanal,
} from './repos/conversas'
import { type FabricaDeCanal, type Mensagem, tratarUma } from './receber-mensagem'
import { alertar } from './alertar'

/**
 * O caminho de um direct do Instagram até a resposta.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe, em vez de mais um `if` no do WhatsApp
 * ---------------------------------------------------------------------------
 *
 * O que difere entre os dois canais é só o **formato do webhook**. O WhatsApp
 * manda `entry[].changes[].value.messages[]` com `metadata.phone_number_id`; o
 * Instagram manda `entry[].messaging[]` com `sender`/`recipient` e um
 * `message` de forma completamente outra.
 *
 * O que acontece depois é idêntico — deduplicar, achar o contato, pegar a
 * trava da conversa, rodar o motor, gravar, entregar. É por isso que a
 * tradução mora aqui e `tratarUma` mora lá, exportada: um `if (canal ===
 * 'instagram')` dentro daquele arquivo espalharia a diferença por todo o
 * caminho, e é exatamente assim que dedupe e handoff ganham duas versões que
 * discordam entre si.
 *
 * ---------------------------------------------------------------------------
 * As três armadilhas deste webhook, todas pagas por outra gente antes
 * ---------------------------------------------------------------------------
 *
 * 1. **`is_echo`.** A Meta devolve as **nossas próprias** mensagens no mesmo
 *    webhook, marcadas com essa bandeira. Sem descartar, o bot lê o que ele
 *    mesmo escreveu, responde a si mesmo, e a conversa entra em laço. É o
 *    primeiro erro que todo mundo comete aqui.
 * 2. **`quick_reply` vem dentro de `message`, junto do `text`.** A pessoa que
 *    tocou num botão manda as duas coisas: o rótulo como texto e o `payload`
 *    como resposta. Ler o texto primeiro transformaria toda escolha de menu
 *    numa resposta escrita, e o motor perderia a saída certa.
 * 3. **`recipient.id` é a conta do cliente, `sender.id` é quem escreveu.** No
 *    WhatsApp o par é `metadata.phone_number_id` e `from`. Trocar os dois faz o
 *    produto procurar um canal com o id do contato — e não achar nada, em
 *    silêncio, para sempre.
 */

/** O que a Meta manda de anexo. Só o tipo e a url interessam por enquanto. */
const anexoSchema = z.object({
  type: z.string(),
  payload: z.object({ url: z.string().optional() }).optional(),
})

const mensagemDoInstagramSchema = z.object({
  mid: z.string(),
  text: z.string().optional(),
  /** A resposta de um botão. `payload` é o id da opção que mandamos. */
  quick_reply: z.object({ payload: z.string() }).optional(),
  attachments: z.array(anexoSchema).optional(),
  /** Nossa própria mensagem, devolvida pela Meta. Ver a armadilha 1. */
  is_echo: z.boolean().optional(),
})

/**
 * Um evento de mensagem: quem mandou, para quem, e o quê.
 *
 * Vale só para os eventos que **têm** remetente e destinatário. O mesmo array
 * `messaging` carrega outros — ver abaixo por que isso importa.
 */
const eventoDeMensagemSchema = z.object({
  sender: z.object({ id: z.string() }),
  recipient: z.object({ id: z.string() }),
  message: mensagemDoInstagramSchema.optional(),
})

export const webhookDoInstagramSchema = z.object({
  object: z.string().optional(),
  entry: z
    .array(
      z.object({
        /*
         * **Cada evento é validado sozinho, e um que não encaixa vira `null` em
         * vez de derrubar o lote.** Esta linha é a diferença entre o Direct
         * funcionar e não funcionar.
         *
         * O array `messaging` mistura coisas: a mensagem em si, e também
         * `read`, `seen`, `reaction` e outros avisos que não trazem `sender`
         * nem `recipient`. Com um `z.array(objeto)` comum, o zod reprova o
         * **payload inteiro** quando qualquer item não encaixa — então um aviso
         * de leitura chegando no mesmo lote fazia a mensagem de verdade ser
         * descartada junto, sem erro visível em lugar nenhum.
         *
         * `.nullable().catch(null)` faz o item inválido virar `null`; o laço
         * pula os nulos e trata os que sobraram.
         */
        messaging: z.array(eventoDeMensagemSchema.nullable().catch(null)).default([]),
      }),
    )
    .default([]),
})

/**
 * O tipo do nosso lado para um anexo do Instagram.
 *
 * A Meta usa `image`, `video`, `audio`, `file`, `share`, `story_mention`,
 * `ig_reel`. `paraEntrada` do lado do WhatsApp guarda o `type` cru em
 * `formato`, e é isso que o desenho vê na saída "mandou arquivo" — então
 * traduzir para o vocabulário do WhatsApp é o que faz o mesmo fluxo se
 * comportar igual nos dois canais.
 */
const TIPO_DO_ANEXO: Record<string, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  file: 'document',
  // Figurinha, reel compartilhado, menção em story: não são arquivo que o
  // fluxo saiba tratar, mas também não podem virar texto vazio. Caem no mesmo
  // caminho de mídia, que leva a conversa para uma pessoa quando o desenho
  // não trata — o comportamento certo para "chegou algo que não sei ler".
  share: 'sticker',
  story_mention: 'sticker',
  ig_reel: 'video',
}

/**
 * Traduz uma mensagem do Instagram para a forma interna.
 *
 * Exportada para o teste: é aqui que as três armadilhas do cabeçalho viram
 * código, e testar isso pelo webhook inteiro esconderia qual delas quebrou.
 */
export function paraMensagemInterna(
  de: string,
  mensagem: z.infer<typeof mensagemDoInstagramSchema>,
): Mensagem | null {
  // Armadilha 1: nossa própria mensagem voltando. Descartar aqui é o que
  // impede o bot de conversar consigo mesmo.
  if (mensagem.is_echo) return null

  const base = { id: mensagem.mid, from: de }

  // Armadilha 2: o botão vem antes do texto. Quem tocou numa opção manda as
  // duas coisas, e só o `payload` diz qual saída seguir.
  if (mensagem.quick_reply) {
    return {
      ...base,
      type: 'interactive',
      interactive: {
        button_reply: {
          id: mensagem.quick_reply.payload,
          // O rótulo que a pessoa viu é o texto que veio junto. É o que fica no
          // histórico — "Agendar aula" em vez de `agendar`.
          ...(mensagem.text ? { title: mensagem.text } : {}),
        },
      },
    }
  }

  const anexo = mensagem.attachments?.[0]
  if (anexo) {
    const tipo = TIPO_DO_ANEXO[anexo.type] ?? 'sticker'
    return {
      ...base,
      type: tipo,
      /*
       * O Instagram manda a **url** do anexo, e o WhatsApp manda um **id** para
       * baixar depois. O campo interno se chama `id` porque nasceu do WhatsApp,
       * e guardar a url nele é honesto: os dois são "a referência para pegar o
       * arquivo", e é assim que o nó de API a recebe.
       */
      [tipo === 'document' ? 'document' : tipo]: {
        ...(anexo.payload?.url ? { id: anexo.payload.url } : {}),
      },
    }
  }

  if (typeof mensagem.text === 'string') {
    return { ...base, type: 'text', text: { body: mensagem.text } }
  }

  // Reação, entrega, leitura — eventos que não são mensagem. Ignorar é a
  // resposta certa, e ignorar em silêncio também: eles chegam o tempo todo.
  return null
}

/**
 * Monta o adaptador de saída de um canal, lendo o token do cofre.
 *
 * **É `async`, e `FabricaDeCanal` não é** — de propósito nos dois lados. A
 * fábrica é chamada de dentro do laço de ações, onde um `await` a mais por
 * mensagem entraria no orçamento do webhook; ler o Vault é uma ida ao banco.
 * Resolver aqui, uma vez por conversa, e devolver a função já pronta concilia
 * as duas coisas.
 *
 * Diferente do WhatsApp, não existe fallback para o ambiente: o token é da
 * conta que autorizou, e uma variável global aqui seria uma conta falando pela
 * outra. Ver o cabeçalho da 0040.
 */
export async function fabricaDoInstagram(canal: CanalSalvo): Promise<FabricaDeCanal> {
  const adaptador = await adaptadorDoCanal(canal)
  return () => adaptador
}

/**
 * Quem já se apresentou nesta instância, para não perguntar de novo.
 *
 * **O nome custa uma consulta e não muda quase nunca.** Pedir a cada mensagem
 * gastaria uma ida à Meta dentro do orçamento do webhook para reconfirmar o que
 * já se sabe; guardar aqui faz o custo ser uma vez por pessoa por instância
 * quente, e uma instância fria só refaz o que já estava certo.
 *
 * Memória de processo, e de propósito: é enfeite do Inbox, não estado do
 * produto. O estado mora em `contacts.nome`, e é ele que sobrevive ao deploy.
 */
const NOMES_VISTOS = new Map<string, string | null>()

/** Acima disso, esquece tudo. Um Map sem teto num processo longo é vazamento. */
const TETO_DE_NOMES = 500

/**
 * Como se chama quem mandou, quando dá para saber.
 *
 * O webhook do Instagram não traz o nome junto da mensagem — ao contrário do
 * WhatsApp, que manda de graça. Sem esta consulta o Inbox mostra uma fileira de
 * números de 17 dígitos, e quem atende não reconhece ninguém.
 *
 * Falhar devolve `null`, e `acharOuCriarContato` trata nulo como "não sei
 * agora", não como "apague o que sabia". Nome é enfeite; a mensagem não pode se
 * perder junto com ele.
 */
async function nomeDeQuemMandou(canal: CanalSalvo, igsid: string): Promise<string | null> {
  const chave = `${canal.id}:${igsid}`
  const guardado = NOMES_VISTOS.get(chave)
  if (guardado !== undefined) return guardado

  let nome: string | null = null
  try {
    nome = await nomeDoPerfil({ igsid, token: await lerTokenDoCanal(canal) })
  } catch (erro) {
    console.warn('[instagram] não deu para ler o nome de quem mandou', erro)
  }

  if (NOMES_VISTOS.size >= TETO_DE_NOMES) NOMES_VISTOS.clear()
  NOMES_VISTOS.set(chave, nome)
  return nome
}

export async function receberDoInstagram(
  payload: unknown,
  fabricaDeCanal?: FabricaDeCanal,
): Promise<void> {
  const analise = webhookDoInstagramSchema.safeParse(payload)

  /*
   * Corpo que não encaixa no formato também vira alerta, e não silêncio.
   *
   * A Meta manda no mesmo endereço eventos que não são mensagem, e a maioria
   * deles não interessa. O problema é que "não interessa" e "chegou uma
   * mensagem que não soubemos ler" saíam iguais daqui: `return`, sem rastro. Um
   * resumo do corpo é o suficiente para diferenciar os dois na próxima vez, e é
   * barato porque só é gravado quando o corpo não encaixa.
   */
  if (!analise.success) {
    await alertar(
      'o Instagram mandou um corpo que não encaixa no formato de mensagem',
      new Error(analise.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')),
      { corpo: JSON.stringify(payload).slice(0, 800) },
    )
    return
  }

  /*
   * Quantas mensagens este corpo produziu.
   *
   * Zero é normal e frequente — leitura, reação e entrega chegam no mesmo
   * endereço e não viram nada. O que não é normal é a conta receber direct e
   * nunca produzir mensagem, e nesse caso o corpo cru no log é a única forma de
   * descobrir que evento a Meta está mandando no lugar de `messages`.
   */
  let tratadas = 0

  for (const entrada of analise.data.entry) {
    for (const evento of entrada.messaging) {
      // `null` é o aviso que não é mensagem — leitura, reação, entrega.
      if (!evento?.message) continue

      // Armadilha 3: `recipient` é a conta do cliente; `sender` é quem
      // escreveu. Invertidos, a busca nunca acha canal nenhum e o produto fica
      // mudo sem nenhum erro para investigar.
      const canalSalvo = await acharCanalPorContaDoInstagram(evento.recipient.id)

      /*
       * Não achar canal era um `continue` mudo, e isso custou uma tarde.
       *
       * A conta aparecia conectada, o webhook chegava, e a mensagem sumia aqui
       * sem deixar rastro em lugar nenhum — nem log, nem alerta, nem linha no
       * banco. O identificador que a Meta manda em `recipient.id` precisa ser o
       * mesmo que foi gravado em `channels.ig_user_id` na conexão, e quando não
       * é, a única forma de descobrir qual ele é de verdade é esta: dizer.
       */
      if (!canalSalvo) {
        await alertar(
          'o Instagram mandou mensagem para uma conta que não está ligada a nenhum cliente',
          new Error(`recipient.id ${evento.recipient.id} não casa com nenhum channels.ig_user_id`),
          { recipiente: evento.recipient.id, remetente: evento.sender.id },
        )
        continue
      }

      if (canalSalvo.status !== 'ativo') continue

      const mensagem = paraMensagemInterna(evento.sender.id, evento.message)
      if (!mensagem) continue

      // Injetável para os testes rodarem sem rede e sem cofre, como no
      // WhatsApp. Fora do teste, o token vem do Vault.
      const fabrica = fabricaDeCanal ?? (await fabricaDoInstagram(canalSalvo))

      // O nome não vem no webhook, vem de uma consulta — e ela é feita uma vez
      // por pessoa, não uma por mensagem. Ver `nomeDeQuemMandou`.
      const nome = await nomeDeQuemMandou(canalSalvo, evento.sender.id)

      await tratarUma(canalSalvo, mensagem, nome, fabrica)
      tratadas += 1
    }
  }

  if (tratadas === 0) {
    console.error('[webhook instagram] corpo sem mensagem tratada', JSON.stringify(payload))
  }
}
