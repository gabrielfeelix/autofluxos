import 'server-only'
import { z } from 'zod'
import { distribuirSeSemDono } from './distribuir-atendimento'
import type { Canal } from '@/channels/types'
import { canalDoWhatsApp } from './canal-do-whatsapp'
import { AUTOR_AUTOMACAO } from '@/core/autor-da-mensagem'
import { sessaoNova, type Acao, type Entrada } from '@/core/engine/types'
import { varsIniciais } from '@/core/contatos/vars-iniciais'
import { textoDoCard } from '@/core/loja'
import { alertar, type ContextoDoAlerta } from './alertar'
import { avisarHandoff } from './avisar-handoff'
import { executarComEfeitos, type OpcoesDeEfeitos } from './efeitos/resolver'
import { guardarMidiaRecebida } from './guardar-midia-recebida'
import { escolherModelo } from './ia/modelo'
import { comLinkRastreado } from './link-de-produto'
import { guardarComentario, guardarNota } from './repos/avaliacoes'
import { acharCliente, horarioDoCliente } from './repos/clientes'
import { acharFluxo, acharVersao, type VersaoPublicada } from './repos/fluxos'
import { acrescentarNota, lerConversa } from './repos/leads'
import {
  ATENDIMENTO_SEMPRE_ABERTO,
  avisoDeForaDoHorario,
  pediuAtendente,
  type ContextoDoAtendimento,
} from '@/core/engine/executar'
import { tipoDoReferral } from '@/core/regras-de-entrada'
import { aindaAutorizada } from '@/core/controle-da-conversa'
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
import { manterCopiaDoCrm } from './horario-do-crm'
import { varsDeData } from '@/core/datas'
import {
  SEMPRE_ABERTO,
  atendimentoAberto,
  hojeNaConta,
  motivoDeHojeFechado,
  proximaAbertura,
  type HorarioDeAtendimento,
} from '@/core/horario'
import {
  acharCanal,
  acharCanalPorNumero,
  salvarTelefoneDoCanal,
  acharContato,
  acharSessao,
  acharOuCriarContato,
  contextoDeResposta,
  alterarAutomacaoDoContato,
  criarSessao,
  definirStatusDaSessao,
  guardarCampo,
  guardarSessao,
  handoffSemResposta,
  confirmarEntrega,
  registrarEntrada,
  registrarHandoff,
  registrarSaida,
  trocarVersaoDaSessao,
  ultimaSessao,
  vincularSessaoNaMensagem,
  trocarBsuid,
  type CanalSalvo,
  type Contato,
  type IdentidadeDoWhatsApp,
  type SessaoSalva,
  revisaoDoControle,
} from './repos/conversas'
import { travarContato } from './repos/travas'
import { inscreverNoEvento, sairPelaEtiqueta, sairPorEvento } from './sequencias'
import { marcarContatos } from './repos/etiquetas'
import { porContatoNaEtapa } from './repos/quadros'
import { porNoQuadroPadrao } from './quadro-de-entrada'
import { aplicarFato, marcarUltimaMensagem } from './repos/crm'
import { anotar } from './repos/eventos'
import { registrarPassagem } from './repos/passagens'

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

/** O que todo anexo do WhatsApp tem em comum. */
const anexoSchema = z.object({
  id: z.string().optional(),
  caption: z.string().optional(),
})

const mensagemSchema = z.object({
  id: z.string(),
  /*
   * **Opcional desde os nomes de usuário do WhatsApp (2026).** Quem adota um
   * chega sem telefone, a menos que o número da conta tenha falado com ele nos
   * últimos 30 dias, e a Meta **omite** o campo em vez de mandar vazio. Com
   * `from` obrigatório o parse do lote inteiro falhava e a mensagem sumia sem
   * alerta. `from_user_id` (o BSUID) vem sempre. Ver `core/contatos/bsuid.ts`.
   */
  from: z.string().optional(),
  from_user_id: z.string().optional(),
  type: z.string(),
  /*
   * Troca de número ou de BSUID (`user_changed_number`, `user_changed_user_id`).
   * Não é conversa: atualiza a ficha e não passa pelo bot.
   */
  system: z
    .object({
      type: z.string().optional(),
      wa_id: z.string().optional(),
      user_id: z.string().optional(),
      previous_user_id: z.string().optional(),
    })
    .optional(),
  referral: referralSchema.optional(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({
      button_reply: z.object({ id: z.string(), title: z.string().optional() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string().optional() }).optional(),
    })
    .optional(),
  /*
   * O anexo. A Meta manda o objeto com o nome do próprio tipo (`image`,
   * `audio`, `document`, `video`, `sticker`), e todos carregam `id`, a
   * referência que serve para baixar depois, e alguns carregam `caption`.
   *
   * Lidos com `.passthrough()` fora: o que interessa aqui é o id e a legenda,
   * e campo novo da Meta não pode derrubar o parse de uma mensagem inteira.
   */
  image: anexoSchema.optional(),
  audio: anexoSchema.optional(),
  video: anexoSchema.optional(),
  document: anexoSchema.optional(),
  sticker: anexoSchema.optional(),
  /*
   * **A mensagem que esta está citando.** Chega em toda resposta citada, de
   * qualquer tipo, a Meta põe `context` no nível de cima, irmão do `type`.
   *
   * `id` é o `wa_message_id` da citada, e é o que liga uma à outra. Os outros
   * campos que a Meta manda aqui (`from`, `forwarded`, `referred_product`) não
   * são lidos: o schema não é `.strict()`, então eles passam sem derrubar nada
   * e continuam guardados no `payload` cru.
   *
   * Cuidado que vale registrar: `context` também aparece quando alguém responde
   * **um anúncio** e quando a mensagem é encaminhada. Nos dois casos o `id`
   * aponta para algo que não está no nosso histórico, e a tela precisa
   * aguentar isso, ver `citadaDoPayload` em `repos/leads.ts`.
   */
  context: z.object({ id: z.string() }).optional(),
  /*
   * A reação.
   *
   * `emoji` é opcional **porque a remoção o manda vazio ou o omite**, e as
   * duas formas significam a mesma coisa: tirar a reação que estava lá. Quem
   * lê normaliza para string vazia, que é o que distingue "removeu" de "não é
   * reação" no banco (coluna `reacao`, migration 0054).
   */
  reaction: z.object({ message_id: z.string(), emoji: z.string().optional() }).optional(),
  /*
   * O porquê de um `unsupported`, que antes o parse jogava fora.
   *
   * Sem isto o banco guardava só `{id, from, type}`, e a bolha nunca podia
   * dizer se era enquete, mensagem editada ou visualização única. Lidos soltos
   * (`z.unknown()`): quem interpreta é `motivoDoNaoSuportado`, e formato novo
   * da Meta não pode derrubar o parse da mensagem.
   */
  unsupported: z.unknown().optional(),
  errors: z.unknown().optional(),
})

export const webhookSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              /**
               * **Qual campo do webhook chegou. Ler isto não é zelo: é o que
               * impede o bot de responder ao próprio dono do negócio.**
               *
               * `smb_message_echoes`, o eco do que o dono manda pelo celular,
               * traz `metadata.phone_number_id` e um `messages[]` com a mesma
               * forma de uma mensagem recebida. Sem olhar o `field`, ele passa
               * por este schema, o `from` (que é o número **do negócio**) vira
               * um contato novo, a mensagem é gravada como `entrada`, e o motor
               * responde. O dono recebe uma resposta automática do próprio bot,
               * na conversa errada, exatamente o atropelo que a coexistência
               * existe para evitar.
               *
               * `history` não cai nessa porque as mensagens dele moram em
               * `value.history[]`, não em `value.messages`. É só o eco.
               *
               * Opcional porque payload antigo de teste não traz o campo; o
               * filtro no laço trata a ausência como `messages`, que era o
               * único campo quando eles foram escritos.
               */
              field: z.string().optional(),
              value: z.object({
                metadata: z
                  .object({
                    phone_number_id: z.string(),
                    /*
                     * **O telefone de verdade, que a Meta manda em toda
                     * mensagem e a gente jogava fora.**
                     *
                     * Sem ele, a tela de Configurações mostrava
                     * `1301107846409860` como se fosse o número do cliente. Um
                     * cliente olhou a própria lista em 16/set/2026 e disse
                     * "não mostra o número", com razão: aquilo é a
                     * identificação interna da Meta, não um telefone.
                     *
                     * Opcional porque a coexistência e os payloads de teste
                     * nem sempre trazem, e porque um canal que já tem o número
                     * salvo não depende disto.
                     */
                    display_phone_number: z.string().optional(),
                  })
                  .optional(),
                contacts: z
                  .array(
                    z.object({
                      // Os dois como em `messages[].from`: o telefone pode faltar.
                      wa_id: z.string().optional(),
                      user_id: z.string().optional(),
                      profile: z
                        .object({ name: z.string().optional(), username: z.string().optional() })
                        .optional(),
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

/**
 * A forma normalizada de uma mensagem que chegou.
 *
 * O nome vem do WhatsApp porque foi o primeiro canal, e ela virou **a forma
 * interna** quando o Instagram entrou: `receber-do-instagram.ts` traduz o
 * webhook de lá para cá antes de chamar `tratarUma`. Traduzir na entrada é o
 * que impede o motor, o histórico e o handoff de ganharem um `if` por canal.
 */
/**
 * A mensagem com o endereço já resolvido: o telefone, ou o BSUID quando o
 * telefone não veio. O Instagram monta a mesma forma com o IGSID.
 */
export type Mensagem = z.infer<typeof mensagemSchema> & { from: string }
type Referral = z.infer<typeof referralSchema>

/** Como o canal é montado. Injetável para os testes rodarem sem rede. */
export type FabricaDeCanal = (canal: CanalSalvo) => Canal

const canalPadrao = canalDoWhatsApp

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

      /*
       * **Só `messages`.** Ver o comentário do `field` no schema: o eco de
       * coexistência tem a mesma forma de uma mensagem recebida, e quem o trata
       * é `receberCoexistencia`, que sabe que ali o `from` é o negócio.
       *
       * Ausente conta como `messages`: quando estes payloads foram escritos,
       * era o único campo que chegava aqui.
       */
      if (mudanca.field !== undefined && mudanca.field !== 'messages') continue

      // Sem `messages` é evento de status (entregue, lido). Não nos interessa.
      if (!numero || !valor.messages?.length) continue

      const canalSalvo = await acharCanalPorNumero(numero)
      if (!canalSalvo || canalSalvo.status !== 'ativo') continue

      /*
       * **O canal aprende o próprio telefone na primeira mensagem que chega.**
       *
       * Quem conecta pelo embedded signup ganha o número pela coexistência;
       * quem cadastra à mão colando o `phone_number_id` do painel da Meta não
       * ganhava nada, e ficava para sempre identificado por um número de
       * quinze dígitos que não é telefone de ninguém.
       *
       * Não existe tela nova para isto, e é de propósito: pedir para a pessoa
       * digitar um dado que a Meta já nos manda a cada mensagem seria inventar
       * trabalho. Grava uma vez, quando falta, e nunca mais.
       */
      await guardarTelefoneDoCanal(canalSalvo, valor.metadata?.display_phone_number)

      for (const mensagem of valor.messages) {
        if (mensagem.type === 'system') {
          await tratarTrocaDeIdentidade(canalSalvo, mensagem.system)
          continue
        }

        const endereco = mensagem.from ?? mensagem.from_user_id
        if (!endereco) {
          await alertar('mensagem do WhatsApp sem remetente', 'sem from e sem from_user_id', {
            canal: canalSalvo.id,
          })
          continue
        }

        const perfil = valor.contacts?.find(
          (c) =>
            (mensagem.from !== undefined && c.wa_id === mensagem.from) ||
            (mensagem.from_user_id !== undefined && c.user_id === mensagem.from_user_id),
        )
        const username = perfil?.profile?.username ?? null
        const nome = perfil?.profile?.name ?? (username ? `@${username}` : null)
        await tratarUma(canalSalvo, { ...mensagem, from: endereco }, nome, fabricaDeCanal, {
          bsuid: mensagem.from_user_id ?? perfil?.user_id ?? null,
          username,
        })
      }
    }
  }
}

/**
 * O canal aprende o próprio telefone, e nunca ao custo da conversa.
 *
 * Fica fora do caminho de erro de propósito: o telefone é enfeite de tela, e
 * uma falha de escrita aqui não pode virar webhook com erro. A Meta reentrega
 * o que não recebe 200 a tempo, e reentrega vira mensagem duplicada para o
 * lead. Cara demais por um rótulo.
 */
/**
 * A mensagem de sistema de troca de número ou de BSUID. Ver `trocarBsuid`.
 *
 * Falha aqui não pode derrubar o resto do lote: vira alerta, e a próxima
 * mensagem da pessoa, no pior caso, abre uma ficha nova.
 */
async function tratarTrocaDeIdentidade(
  canal: CanalSalvo,
  sistema: z.infer<typeof mensagemSchema>['system'],
): Promise<void> {
  const anterior = sistema?.previous_user_id
  const novo = sistema?.user_id
  if (!anterior || !novo) return

  try {
    await trocarBsuid(canal.clienteId, anterior, novo, sistema?.wa_id ?? null)
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('não deu para trocar o BSUID do contato', detalhe, { canal: canal.id })
  }
}

async function guardarTelefoneDoCanal(canal: CanalSalvo, telefone: string | undefined) {
  if (!telefone || canal.displayPhoneNumber) return

  try {
    await salvarTelefoneDoCanal(canal.id, telefone)
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('não deu para gravar o telefone do canal', detalhe, { canal: canal.id })
  }
}

/**
 * Uma mensagem, do registro até a resposta.
 *
 * Exportada para `receber-do-instagram.ts`: os dois webhooks têm formatos
 * diferentes e o que acontece **depois** da tradução é idêntico. Duplicar isto
 * por canal seria duplicar dedupe, trava de conversa, handoff e histórico.
 */
export async function tratarUma(
  canalSalvo: CanalSalvo,
  mensagem: Mensagem,
  nomeDoPerfil: string | null,
  fabricaDeCanal: FabricaDeCanal,
  identidade: IdentidadeDoWhatsApp = {},
): Promise<void> {
  const { entrada, texto } = paraEntrada(mensagem)
  const contato = await acharOuCriarContato(
    canalSalvo.clienteId,
    mensagem.from,
    nomeDoPerfil,
    identidade,
  )

  if (contato.criadoAgora) await porNoQuadroPadrao(contato)

  /**
   * O CRM toma conhecimento de que essa pessoa falou (0058).
   *
   * Duas escritas, e as duas de propósito fora de `registrarEntrada`: aquela
   * função é o registro da mensagem, e isto é o que a mensagem **significa para
   * o relacionamento**, "de quem estou devendo resposta" e "voltou quem tinha
   * sumido".
   *
   * Nenhuma das duas pode derrubar o atendimento, e por isso nenhuma é
   * esperada com `throw`: `marcarUltimaMensagem` engole o erro, e o fato só é
   * aplicado para quem já existia, contato criado agora nasce em `novo`, e
   * perguntar ao banco o que ele já era seria uma consulta com resposta
   * conhecida.
   */
  await marcarUltimaMensagem(canalSalvo.clienteId, contato.id)
  if (contato.criadoAgora) {
    await anotar(canalSalvo.clienteId, contato.id, 'chegou', { origem: canalSalvo.provider === 'instagram' ? 'Instagram' : canalSalvo.provider === 'site' ? 'Site' : 'WhatsApp' })
  } else {
    await aplicarFato(canalSalvo.clienteId, contato.id, 'voltou-a-falar')
  }

  /*
   * O botão que a pessoa apertou, na linha do tempo.
   *
   * A outra metade da trilha que quem opera pediu: `entrou-no-fluxo` diz por
   * onde a conversa começou, e isto diz por onde ela foi , *"cancelou,
   * reagendou"*.
   *
   * Só a escolha em menu, e não todo texto digitado: texto já está na conversa
   * inteira, e repetir cada frase na linha do tempo faria dela um segundo
   * inbox, pior que o primeiro. O que a conversa **não** mostra é qual ramo do
   * desenho aquele clique tomou, e é isso que fica aqui.
   *
   * Guarda o rótulo que ela viu (`title`), não o `id` do botão: `escolheu
   * op_2b` é log; "escolheu 🔄 Quero remarcar" é história.
   */
  if (entrada.tipo === 'opcao') {
    await anotar(canalSalvo.clienteId, contato.id, 'escolheu-no-fluxo', {
      escolha: texto ?? entrada.opcaoId,
    })
  }

  const mensagemId = await registrarEntrada({
    contatoId: contato.id,
    sessaoId: null,
    waMessageId: mensagem.id,
    texto,
    payload: mensagem,
    /*
     * A reação e a citação viram coluna aqui.
     *
     * `?? ''` na remoção de propósito: a Meta manda `emoji` vazio **ou** omite
     * o campo quando alguém tira a reação, e as duas formas querem dizer a
     * mesma coisa. Normalizar na entrada é o que deixa a coluna significar só
     * duas coisas, `null` não é reação, string vazia é reação removida, em
     * vez de três.
     */
    ...(mensagem.reaction
      ? { reagiuA: mensagem.reaction.message_id, reacao: mensagem.reaction.emoji ?? '' }
      : {}),
    ...(mensagem.context ? { cita: mensagem.context.id } : {}),
  })
  // A Meta reenviou algo que já processamos. Sair aqui é o que impede a
  // conversa de andar duas vezes. Vem **antes** da trava de propósito: reenvio
  // não precisa esperar fila nenhuma para ser descartado.
  if (!mensagemId) return

  /*
   * A cópia do arquivo, antes de o prazo da Meta fechar.
   *
   * Vem **logo depois do dedupe** e antes de tudo o mais de propósito: o `id`
   * da mídia vive 7 dias, a Meta não guarda backup (Cloud API Terms 4.5), e
   * qualquer caminho que adie isto pode não acontecer, a função pode morrer no
   * `maxDuration`, e o arquivo não volta de lugar nenhum.
   *
   * Depois do dedupe porque reenvio da Meta não pode baixar o mesmo arquivo
   * duas vezes, e antes do resto porque perder mídia é irreversível e atrasar a
   * resposta não é. Ver `guardar-midia-recebida.ts` sobre o custo aceito.
   */
  const midiaParaGuardar = entrada.tipo === 'midia' ? entrada.midiaId : undefined
  if (midiaParaGuardar) {
    /*
     * O canal é montado aqui dentro, e não acima, porque `fabricaDeCanal` pode
     * estourar quando falta token no ambiente. Mensagem de texto não precisa de
     * canal nenhum para ser gravada, e montar um por precaução transformaria
     * "falta configurar o token" em conversa que não entra.
     */
    try {
      await guardarMidiaRecebida(
        fabricaDeCanal(canalSalvo),
        canalSalvo.clienteId,
        contato.id,
        mensagemId,
        { tipo: mensagem.type, midiaId: midiaParaGuardar },
      )
    } catch (erro) {
      console.warn(
        '[midia] não deu para montar o canal para baixar a mídia',
        erro instanceof Error ? erro.message : String(erro),
      )
    }
  }

  /**
   * **Reação não faz a conversa andar, e parar aqui é o conserto do bug.**
   *
   * Antes da 0054 a reação caía no ramo de mídia de `paraEntrada` e chegava ao
   * motor como se fosse um arquivo, com `formato: 'reaction'` e sem id nenhum.
   * Numa conversa parada numa pergunta, um "❤️" respondia a pergunta: o motor
   * via entrada de mídia, dava a resposta de "não entendi" ou seguia o ramo
   * errado, e ninguém do lado de cá entendia por quê.
   *
   * A regra que vale é a do WhatsApp, e é a que a pessoa espera: reagir
   * comenta uma mensagem, não manda uma. Ela já está gravada logo acima, a
   * tela a mostra grudada na mensagem reagida , então tudo que falta é não
   * acordar o motor.
   *
   * Vem **depois** do dedupe e **antes** de `sairPorEvento` de propósito: um
   * "👍" não é a pessoa voltando a falar, e tirá-la da sequência de
   * acompanhamento por causa dele seria perder o acompanhamento por um
   * emoji.
   */
  if (mensagem.reaction) return

  /**
   * Quem responde sai das sequências (0031).
   *
   * **É a regra que separa acompanhamento de spam**, e ela vale mesmo quando o
   * bot está pausado, mesmo fora do expediente e mesmo que a conversa não vá
   * avançar por nenhum outro motivo, por isso está aqui em cima, e não lá
   * dentro. A pessoa voltou a falar; lembrá-la de falar é o que não pode
   * acontecer.
   *
   * Depois da deduplicação de propósito: reenvio da Meta não é uma resposta
   * nova, e usá-lo para tirar alguém de uma sequência seria deixar a fila de
   * entrega da Meta decidir o acompanhamento do cliente.
   */
  await sairPorEvento(contato.id, 'respondeu')

  // Daqui para baixo a conversa avança, e duas mensagens da mesma pessoa não
  // podem avançar juntas, ver `repos/travas.ts` e a migration 0007.
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

/**
 * Registra por onde a pessoa chegou, desta vez, e da primeira.
 *
 * ---------------------------------------------------------------------------
 * São duas perguntas, e por isso são dois lugares
 * ---------------------------------------------------------------------------
 *
 * **`campos.origem` é o primeiro toque, e continua congelado de propósito.** É
 * a atribuição no sentido em que a Meta e o mercado usam a palavra: quem trouxe
 * esta pessoa para a base. Reescrever isso a cada anúncio novo faria a campanha
 * de remarketing levar o crédito de uma pessoa que já era nossa, que é
 * exatamente o erro que a regra de primeiro toque existe para evitar.
 *
 * **`passagens` é o histórico, e aceita quantas vierem.** Veio pela campanha de
 * agosto, sumiu, voltou pela de setembro: as duas aconteceram, e quem atende
 * hoje precisa ver as duas para entender por que a pessoa está escrevendo. O
 * contato é a entidade; a campanha é o meio por onde ele chegou, daquela vez.
 *
 * Guardar só o primeiro toque perderia a segunda chegada. Guardar só o
 * histórico faria "de onde veio" depender de ler a lista inteira e escolher.
 * As duas juntas custam uma linha a mais e respondem as duas perguntas.
 */
async function atribuirOrigem(contato: Contato, referral?: Referral): Promise<Contato> {
  /*
   * O histórico vem primeiro, e fora do `if` abaixo: ele registra **toda**
   * chegada por anúncio, inclusive a de quem já tem origem gravada há meses.
   * Era aqui que a informação se perdia.
   */
  const tipoDaChegada = tipoDoReferral(referral)
  if (referral?.source_id && tipoDaChegada) {
    try {
      await registrarPassagem({
        clienteId: contato.clienteId,
        contatoId: contato.id,
        adId: referral.source_id,
        /*
         * O tipo vem do `source_type` que a Meta manda, e **esta** é a chegada
         * que abre a janela gratuita de 72h: a pessoa clicou e caiu na conversa.
         * O formulário grava outro tipo, e é o que a 0074 corrigiu.
         */
        tipo: tipoDaChegada,
        /*
         * O `ctwa_clid` é o id do clique, e chega uma vez só. Como chave
         * externa ele torna a reentrega do webhook idempotente sem depender do
         * índice de minuto da 0050, que é o melhor disponível, e não o certo.
         * Anúncio de Status vem sem ele, e aí cai no de minuto mesmo.
         */
        idExterno: referral.ctwa_clid ?? null,
        titulo: referral.headline ?? '',
        texto: referral.body ?? '',
        url: referral.source_url ?? '',
        clique: referral.ctwa_clid ?? '',
      })
    } catch (erro) {
      /*
       * Histórico não pode custar atendimento. Falhar aqui viraria webhook com
       * erro, reentrega da Meta e mensagem duplicada, preço alto demais por
       * uma linha de contexto.
       */
      const detalhe = erro instanceof Error ? erro.message : String(erro)
      await alertar('não deu para registrar a passagem pelo anúncio', detalhe, {
        contato: contato.id,
      })
    }
  }

  if (Object.hasOwn(contato.campos, 'origem')) return contato

  const campos = {
    ...contato.campos,
    origem: referral ? 'Anúncio' : 'Direto',
    ...(referral?.source_id ? { origem_anuncio: referral.source_id } : {}),
    ...(referral?.headline ? { origem_titulo: referral.headline } : {}),
    /*
     * O resto do `referral`, que o schema já validava e o código jogava fora.
     *
     * **Guardar agora é de graça; não guardar é irreversível.** `campos` é
     * `jsonb`, então nada disto custa migration, e o `referral` chega **uma
     * vez só**, na primeira mensagem da conversa. O que não for gravado aqui
     * não volta: a Meta não reenvia, e depois de 90 dias nem a API dela sabe
     * mais. É o oposto de uma coluna que dá para preencher depois.
     *
     * `ctwa_clid` é o que fecha o laço de atribuição pela Conversions API, é
     * com ele que a Meta credita a venda ao anúncio, e é o único destes que
     * não tem nenhum uso hoje. Está aqui exatamente por isso: o dia em que o
     * produto quiser medir ROAS por anúncio, a conversa que começou hoje ainda
     * vai poder ser contada.
     */
    ...(referral?.body ? { origem_texto: referral.body } : {}),
    ...(referral?.source_url ? { origem_url: referral.source_url } : {}),
    ...(referral?.media_type ? { origem_midia: referral.media_type } : {}),
    ...(referral?.ctwa_clid ? { origem_clique: referral.ctwa_clid } : {}),
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

  // Falha: ninguém desenhou isto. A conversa travou e a mensagem se perdeu.
  await registrarHandoff(
    salva.id,
    'a conversa ficou presa e a mensagem não foi processada',
    'falha',
  )
  await definirStatusDaSessao(salva.id, 'humano')
  await distribuirSeSemDono(contato.clienteId, contato.id)
}

/**
 * Qual fluxo esta mensagem abre, e por quê.
 *
 * `null` significa "não abre nada": ou continua a conversa que já estava
 * andando, ou não há nada publicado para dizer.
 */
type Abertura = {
  versaoId: string
  /**
   * O nome do fluxo que abriu, para a linha do tempo do contato.
   *
   * Vem daqui e não de outra busca porque `acharFluxo` já o trouxe: quem abre
   * a ficha quer ler "entrou no fluxo Agendamento", e uma segunda viagem ao
   * banco só para escrever histórico sairia no caminho quente de toda
   * conversa nova.
   */
  nomeDoFluxo: string
  /** Preenchido só quando quem escolheu foi um gatilho, para contar o disparo. */
  gatilhoId?: string
  /** Preenchido só quando quem escolheu foi uma campanha (B4). */
  campanhaId?: string
}

/**
 * A ordem de decisão da entrada, o coração da A6.
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
 *    escape do cliente, tratá-lo diferente seria duas regras para a mesma
 *    ideia. Só casa em texto digitado: clique em botão nunca é sequestrado.
 * 3. **Fluxo de mídia**, que é o que aposenta a Regra B. Também interrompe,
 *    pelo mesmo motivo, e porque o que ele substitui (handoff imediato)
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
    // Nada publicado: este candidato não fala. Melhor o próximo, ou o silêncio,
    // do que responder com um rascunho que ninguém revisou.
    //
    // Desligado (0036) cai para o próximo pelo mesmo caminho, e de propósito:
    // quem desliga o fluxo de boas-vindas quer que o principal atenda, não que
    // o número emudeça.
    if (fluxo?.versaoPublicadaId && fluxo.ativo) {
      return {
        versaoId: fluxo.versaoPublicadaId,
        nomeDoFluxo: fluxo.nome,
        ...(candidato.gatilhoId ? { gatilhoId: candidato.gatilhoId } : {}),
        ...(candidato.campanhaId ? { campanhaId: candidato.campanhaId } : {}),
      }
    }
  }

  return null
}

/**
 * Como um salto entre automações alcança o destino, e o que ele **não** pode
 * alcançar.
 *
 * O id do destino vem do grafo, e grafo é coisa que gente edita: amarrar o
 * carregador ao cliente da conversa é o que impede o fluxo de um cliente saltar
 * para o de outro. As outras três recusas são as mesmas de `escolherAbertura`:
 * sem versão publicada não há o que executar, desligado não abre conversa, e
 * fluxo apagado não existe. Nos quatro casos o resolvedor manda a conversa para
 * uma pessoa em vez de deixá-la muda.
 */
function carregadorDeFluxo(clienteId: string) {
  return async (fluxoId: string) => {
    const destino = await acharFluxo(fluxoId)
    if (!destino || destino.clienteId !== clienteId) return null
    if (!destino.ativo || !destino.versaoPublicadaId) return null

    const versao = await acharVersao(destino.versaoPublicadaId)
    if (!versao) return null

    return { versaoId: versao.id, grafo: versao.grafo, iaHabilitada: destino.iaHabilitada }
  }
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

  // O humano assumiu. O bot fica calado, a mensagem fica registrada, e quem
  // responde é a pessoa, do celular dela. Vale inclusive contra gatilho: o
  // cliente cadastrou palavra-chave para o bot, não para atropelar quem já
  // está conversando com a pessoa.
  if (anterior && anterior.sessao.status === 'humano') {
    await vincularSessaoNaMensagem(mensagem.id, anterior.id)
    await avisarQueAEquipeVem(canalSalvo, contato, anterior.id, mensagem.id, fabricaDeCanal)
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

    // A sessão nasce sabendo com quem está falando. Sem isto, `{{telefone}}` e
    // `{{nome}}` chegam vazios no primeiro bloco de toda conversa, e quem
    // depende deles falha em silêncio. Ver `core/contatos/vars-iniciais.ts`.
    salva = await criarSessao(contato.id, canalSalvo.id, abertura.versaoId, {
      ...sessaoNova(),
      vars: varsIniciais(contato),
    })
    /*
     * Por onde a conversa entrou, na linha do tempo do contato.
     *
     * Pedido de quem opera: *"Fulano acessou fluxo, agendamento, cancelou,
     * reagendou"*. Sem isto, depurar fluxo é adivinhar , a conversa guarda o
     * que foi dito, não por qual caminho o desenho levou, e caminhos
     * diferentes produzem a mesma frase com frequência.
     *
     * `anotar` engole o próprio erro por decisão do repositório: histórico é
     * dado de apoio e não pode derrubar a conversa que o gerou.
     */
    await anotar(canalSalvo.clienteId, contato.id, 'entrou-no-fluxo', {
      fluxo: abertura.nomeDoFluxo,
    })
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

  // "Digitando" desde já, e não só quando a resposta estiver pronta: com IA a
  // rodada leva de 5 a 40 s, e silêncio nesse tempo parece robô quebrado.
  const digitando = manterDigitando(fabricaDeCanal(canalSalvo), mensagem.id, contato.waId)
  try {

    /**
     * O expediente vai junto, e as duas buscas correm ao mesmo tempo.
     *
     * O motor precisa saber se tem gente para atender **antes** de rodar, porque
     * é ele que decide o que dizer no handoff. Buscar em série custaria uma
     * viagem a mais no relógio de toda mensagem; em paralelo com o preparo da IA,
     * não custa nada.
     */
    const [opcoesDeIa, horarioGuardado] = await Promise.all([
      prepararIa(canalSalvo, contato.id, versao, texto),
      horarioDoCliente(canalSalvo.clienteId),
    ])

    /*
     * Conta que puxa o expediente do CRM refaz a cópia quando ela envelhece.
     *
     * Quase toda mensagem passa reto por aqui: só a primeira depois de seis
     * horas paga a busca, e mesmo ela desiste em 2,5s e segue com a cópia
     * anterior. Ver `horario-do-crm.ts`.
     */
    const horario = await manterCopiaDoCrm(canalSalvo.clienteId, horarioGuardado)

    /*
     * A revisão do controle **antes** de o motor rodar (RB-15).
     *
     * Tem que ser lida aqui, e não depois: ela é a prova de que esta rodada foi
     * autorizada pelo estado que existia quando ela começou. Lida depois, já teria
     * a troca de controle embutida, e a conferência sempre passaria.
     */
    const revisaoAutorizada = await revisaoDoControle(canalSalvo.clienteId, contato.id)

    // Conversa nova começa pelo início do fluxo. A primeira mensagem da pessoa
    // é o gatilho, não uma resposta, ela ainda não foi perguntada nada. Vale
    // também para gatilho e para mídia: a frase que abriu o fluxo não é para ser
    // consumida como resposta do primeiro bloco dele.
    const resultado = await executarComEfeitos(
      versao.grafo,
      salva.sessao,
      conversaNova ? { tipo: 'inicio' } : entrada,
      {
        ...opcoesDeIa,
        atendimento: contextoDeAtendimento(horario),
        // A data vem do fuso da conta, e não do servidor. Em UTC, a partir das
        // 21h em São Paulo, "hoje" já é amanhã, que é exatamente o horário em
        // que gente manda mensagem para marcar aula.
        hoje: hojeNaConta(horario?.fuso ?? SEMPRE_ABERTO.fuso),
        // As mesmas datas que a IA recebe, agora também como `{{variavel}}` para
        // o fluxo desenhado à mão, é o que faz "semana que vem" funcionar sem
        // IA contratada, com um botão em vez de um modelo.
        datas: varsDeData(horario?.fuso ?? SEMPRE_ABERTO.fuso),
        carregarFluxo: carregadorDeFluxo(canalSalvo.clienteId),
        // "Deixa eu procurar" sai antes do modelo, e não junto da resposta.
        antesDaIa: (envios) =>
          aplicar(
            fabricaDeCanal(canalSalvo),
            contato,
            salva.id,
            mensagem.id,
            envios,
            revisaoAutorizada,
          ),
      },
    )

    await guardarSessao(salva.id, resultado.sessao)
    // Saltou de automação: a sessão passa a executar a versão do destino, senão a
    // próxima mensagem voltaria para o fluxo de origem com um nó que não existe
    // lá, e o motor recomeçaria a saudação no meio da conversa.
    if (resultado.destino) await trocarVersaoDaSessao(salva.id, resultado.destino.versaoId)
    await sincronizarTimeout(
      canalSalvo.clienteId,
      contato.id,
      salva.id,
      // O prazo é lido do grafo onde a conversa **parou**, não de onde ela começou.
      resultado.destino?.grafo ?? versao.grafo,
      resultado.sessao,
    )
    await aplicar(
      fabricaDeCanal(canalSalvo),
      contato,
      salva.id,
      mensagem.id,
      resultado.acoes,
      revisaoAutorizada,
    )
  } finally {
    digitando.parar()
  }
}

/**
 * Quanto a pessoa espera, depois do handoff, antes de ouvir que alguém vem.
 *
 * Menos que isso e o aviso repete a frase do handoff que ela acabou de ler.
 */
const ESPERA_ANTES_DO_AVISO_MS = 2 * 60_000

/** O que a pessoa lê quando escreve de novo e ninguém do time respondeu. */
export const AVISO_DE_ESPERA = 'Nosso time já foi avisado e te responde por aqui em instantes 🙂'

/**
 * Um aviso, uma vez por handoff, para quem escreve e ninguém responde.
 *
 * Na PCYES, o "oi" que chegou três minutos depois do handoff ficou sem nada: a
 * sessão estava com gente, o bot calado, e ninguém tinha pegado a conversa. Do
 * outro lado, isso é número morto. Fora do expediente o aviso é o de fechado,
 * que diz quando volta, porque "em instantes" às 22h é promessa quebrada.
 *
 * Melhor-esforço: falhar aqui não pode impedir a mensagem de ficar registrada.
 */
async function avisarQueAEquipeVem(
  canalSalvo: CanalSalvo,
  contato: Contato,
  sessaoId: string,
  mensagemId: string,
  fabricaDeCanal: FabricaDeCanal,
): Promise<void> {
  try {
    const desde = await handoffSemResposta(sessaoId, contato.id)
    if (!desde || Date.now() - new Date(desde).getTime() < ESPERA_ANTES_DO_AVISO_MS) return

    const horario = await horarioDoCliente(canalSalvo.clienteId)
    const texto = avisoDeForaDoHorario(contextoDeAtendimento(horario)) ?? AVISO_DE_ESPERA
    await aplicar(fabricaDeCanal(canalSalvo), contato, sessaoId, mensagemId, [{ tipo: 'enviar_texto', texto }], null)
  } catch (erro) {
    await alertar('não deu para avisar a pessoa que a equipe já vem', erro, {
      contato: contato.id,
      sessao: sessaoId,
    })
  }
}

/**
 * Liga o "digitando" e o renova até `parar()`.
 *
 * A Meta apaga o indicador sozinha em 25 s ou quando a resposta sai. Uma
 * rodada com IA pode passar disso (modelo lento, nova tentativa depois de
 * 503), então ele é renovado a cada 20 s. Melhor-esforço: `aguardarResposta`
 * já engole a falha, e um indicador que não aparece não pode travar a resposta.
 */
function manterDigitando(canal: Canal, mensagemId: string, contato: string): { parar: () => void } {
  const ligar = () => {
    try {
      void Promise.resolve(canal.aguardarResposta({ mensagemId, contato }, 0)).catch(() => {})
    } catch {
      // Canal sem indicador: segue sem ele.
    }
  }
  ligar()
  const renovar = setInterval(ligar, 20_000)
  return { parar: () => clearInterval(renovar) }
}

/**
 * Acerta o prazo da pergunta depois de cada rodada (B1).
 *
 * Uma chamada só para as duas metades, agendar e cancelar, porque elas são a
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
 * uma cobrança que não faz mais sentido, e o agendador é justamente a peça em
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
  // está sendo processada agora, e a mensagem ganha do prazo, sempre.
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

    // Mesma razão de `avancarConversa`: a revisão vem de antes do motor. O
    // timeout roda sozinho, e alguém pode ter assumido a conversa nesse meio.
    const revisaoAutorizada = await revisaoDoControle(canal.clienteId, contatoId)

    const resultado = await executarComEfeitos(versao.grafo, agora.sessao, { tipo: 'timeout' }, {
      ...opcoesDeIa,
      atendimento: contextoDeAtendimento(horario),
      // A data vem do fuso da conta, e não do servidor. Em UTC, a partir das
      // 21h em São Paulo, "hoje" já é amanhã, que é exatamente o horário em
      // que gente manda mensagem para marcar aula.
      hoje: hojeNaConta(horario?.fuso ?? SEMPRE_ABERTO.fuso),
      // As mesmas datas que a IA recebe, agora também como `{{variavel}}` para
      // o fluxo desenhado à mão, é o que faz "semana que vem" funcionar sem
      // IA contratada, com um botão em vez de um modelo.
      datas: varsDeData(horario?.fuso ?? SEMPRE_ABERTO.fuso),
      carregarFluxo: carregadorDeFluxo(canal.clienteId),
    })

    await guardarSessao(sessaoId, resultado.sessao)
    if (resultado.destino) await trocarVersaoDaSessao(sessaoId, resultado.destino.versaoId)
    await sincronizarTimeout(
      canal.clienteId,
      contatoId,
      sessaoId,
      resultado.destino?.grafo ?? versao.grafo,
      resultado.sessao,
    )
    await aplicar(fabricaDeCanal(canal), contato, sessaoId, null, resultado.acoes, revisaoAutorizada)
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
 *   fazer dias, e o WhatsApp recusaria, virando handoff logo depois de alguém
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
   * Alguém da equipe está atendendo esta conversa agora (RB-48, T7.3).
   *
   * Estado próprio, e não `automacao_pausada`: os dois param o envio, e param por
   * razões diferentes que pedem telas diferentes. "A automação está desligada
   * neste contato" é escolha de configuração; "alguém está atendendo" é
   * temporário e some quando o atendimento terminar.
   */
  | 'atendimento_humano'

/**
 * Abre um fluxo para um contato **sem ninguém ter escrito agora**.
 *
 * É o caminho comum do pós-atendimento (A6) e do passo de sequência (0031), e
 * ele é diferente do webhook em três pontos que valem para os dois:
 *
 * - **a janela de 24h é conferida antes de falar.** No webhook a pessoa acabou
 *   de escrever, então a janela está aberta por definição. Aqui pode fazer
 *   dias, e o WhatsApp recusaria com `(#131047)`, virando handoff logo depois
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

  if (!dentroDaJanela(contexto)) return 'janela_fechada'

  const contato = await acharContato(contatoId)
  if (!contato) return 'sem_contexto'
  if (!contato.automacaoAtiva) return 'automacao_pausada'

  /*
   * **Atendimento humano em curso ganha do prazo** (RB-48, T7.3).
   *
   * O defeito que isto corrige: logo abaixo, esta função encerra a sessão
   * anterior **qualquer que fosse o status dela**, inclusive `humano`. Então um
   * passo de sequência que vencesse durante um atendimento derrubava o handoff e
   * punha o bot de volta na conversa, no meio do assunto que uma pessoa estava
   * resolvendo. Não aparecia em log nenhum: a sessão "encerrou" e outra "abriu".
   *
   * A RB-48 é explícita: "durante atendimento humano ou pausa persistente,
   * suspender envios automáticos conflitantes", e "antes de enviar, conferir
   * controle da conversa [...] **inclusive em jobs já enfileirados**". Este é o
   * lugar: a conferência é no instante da abertura, e não no agendamento, porque
   * o atendimento pode ter começado depois de o passo ser agendado.
   *
   * **O pós-atendimento (A6) não é afetado**, e foi conferido: ele roda *depois*
   * de `encerrarAtendimento`, que já levou a sessão de `humano` para `encerrada`.
   * Quem chega aqui com sessão `humano` é quem está atropelando um atendimento
   * vivo.
   */
  const emCurso = await ultimaSessao(contatoId, contexto.canal.id)
  if (emCurso && emCurso.sessao.status === 'humano') return 'atendimento_humano'

  const fluxo = await acharFluxo(fluxoId)
  if (!fluxo || fluxo.clienteId !== clienteId || !fluxo.versaoPublicadaId) return 'sem_fluxo'
  // Desligado não abre conversa nova (0036), nem por sequência, nem por
  // campanha, nem por qualquer outro caminho que passe por aqui.
  if (!fluxo.ativo) return 'sem_fluxo'

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

    const salva = await criarSessao(contatoId, contexto.canal.id, versao.id, {
      ...sessaoNova(),
      vars: varsIniciais(contato),
    })

    const [opcoesDeIa, horario] = await Promise.all([
      prepararIa(contexto.canal, contatoId, versao, null),
      horarioDoCliente(clienteId),
    ])

    const resultado = await executarComEfeitos(versao.grafo, salva.sessao, { tipo: 'inicio' }, {
      ...opcoesDeIa,
      atendimento: contextoDeAtendimento(horario),
      // A data vem do fuso da conta, e não do servidor. Em UTC, a partir das
      // 21h em São Paulo, "hoje" já é amanhã, que é exatamente o horário em
      // que gente manda mensagem para marcar aula.
      hoje: hojeNaConta(horario?.fuso ?? SEMPRE_ABERTO.fuso),
      // As mesmas datas que a IA recebe, agora também como `{{variavel}}` para
      // o fluxo desenhado à mão, é o que faz "semana que vem" funcionar sem
      // IA contratada, com um botão em vez de um modelo.
      datas: varsDeData(horario?.fuso ?? SEMPRE_ABERTO.fuso),
      carregarFluxo: carregadorDeFluxo(clienteId),
    })

    if (resultado.destino) await trocarVersaoDaSessao(salva.id, resultado.destino.versaoId)

    await guardarSessao(salva.id, resultado.sessao)
    await aplicar(
      fabricaDeCanal(contexto.canal),
      contato,
      salva.id,
      contexto.ultimaEntradaWaId,
      resultado.acoes,
      /*
       * `null` de propósito: o pós-atendimento é disparado por alguém do
       * atendimento clicando "Já atendi", **depois** de a conversa ter sido
       * encerrada. Não há execução de bot a invalidar, e conferir a revisão aqui
       * recusaria justamente a ação que a pessoa acabou de pedir.
       */
      null,
    )
    return 'aberto'
  } finally {
    await destravar()
  }
}

/**
 * O que a IA precisa para responder, buscado **só quando o fluxo tem IA**.
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
  // gatilhos, `channels.flow_id` passou a ser só um dos fluxos possíveis, e
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
  const { modelo } = await escolherModelo({
    iaHabilitada: fluxo?.iaHabilitada ?? false,
    clienteId: canalSalvo.clienteId,
  })

  return {
    modelo,
    origem: 'whatsapp',
    clienteId: canalSalvo.clienteId,
    // De quem é a conversa, só para o log de chamadas da IA. Sem isto o
    // registro existe e não responde "quem foi afetado?", que é metade do que
    // o art. 20 cobra.
    contatoId,
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

type Entrega = { ok: true; waMessageId: string | null } | { ok: false; motivo: string }

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
  envio: () => Promise<string | null | void>,
  contexto: ContextoDoAlerta = {},
): Promise<Entrega> {
  try {
    const waMessageId = (await envio()) ?? null
    return { ok: true, waMessageId }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    // Fica no log porque o motivo do handoff aparece na tela do painel e o
    // texto da Meta é longo; a versão inteira é o que resolve a investigação.
    console.error('[whatsapp] não deu para entregar a mensagem', detalhe)
    // O handoff cobre a pessoa, mas token expirado e número bloqueado derrubam
    // *todas* as conversas do cliente ao mesmo tempo, é o tipo de falha que
    // precisa chegar em alguém antes de virar um dia inteiro de leads perdidos.
    await alertar('a Cloud API recusou a entrega', detalhe, contexto)
    return { ok: false, motivo: `não deu para entregar a mensagem, ${detalhe.slice(0, 200)}` }
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
  /**
   * A revisão do controle no instante em que esta rodada foi autorizada (RB-15).
   *
   * Conferida **aqui**, e não no início da rodada, porque o intervalo que
   * importa é entre decidir e enviar: uma resposta de IA leva segundos, e é
   * nesses segundos que o clique de "Assumir" cabe. Conferir no começo provaria
   * que ninguém tinha assumido antes de o modelo ser chamado, que é a pergunta
   * errada.
   *
   * `null` = o chamador não tem revisão a conferir (o pós-atendimento, que roda
   * sem ninguém ter assumido nada). Ele passa `null` explicitamente para a
   * decisão ficar visível em vez de depender de um parâmetro esquecido.
   */
  revisaoAutorizada: number | null,
): Promise<void> {
  /*
   * A execução que ficou para trás para aqui, antes de qualquer envio.
   *
   * O cenário: o bot chama o modelo, leva quatro segundos, e no segundo dois a
   * Ana assume. A resposta que volta foi autorizada por um estado que não
   * existe mais, e mandá-la é o bot falando por cima de quem acabou de pegar a
   * conversa, a empresa dizendo duas coisas ao mesmo tempo para o cliente.
   *
   * Recusar é o lado seguro: uma resposta perdida alguém reenvia.
   */
  if (revisaoAutorizada !== null) {
    const agora = await revisaoDoControle(contato.clienteId, contato.id)
    if (!aindaAutorizada({ conducao: 'bot', responsavelId: null, revisao: agora ?? -1 }, revisaoAutorizada)) {
      await alertar(
        'a resposta do bot foi descartada: alguém assumiu a conversa no meio',
        `revisão autorizada ${revisaoAutorizada}, atual ${agora ?? 'desconhecida'}`,
        { contato: contato.id, sessao: sessaoId },
      )
      return
    }
  }

  const campos = { ...contato.campos }
  let mexeuNosCampos = false

  /** O que o alerta de entrega precisa para achar a conversa no painel. */
  const alvo: ContextoDoAlerta = { contato: contato.id, sessao: sessaoId }

  const salvarCampos = async () => {
    if (mexeuNosCampos) await guardarCampo(contato.id, campos)
    mexeuNosCampos = false
  }

  /**
   * Tira a conversa do bot e deixa registrado por quê.
   *
   * **Sempre `falha`**, e os cinco pontos que chamam isto confirmam: entrega da
   * mensagem que não saiu, fluxo que pediu IA sem modelo disponível, integração
   * que não chegou a executar. Nenhum deles é o produto funcionando, e cada um
   * é um conserto possível. A transferência que alguém desenhou é a do bloco
   * `transferir_humano`, mais abaixo.
   */
  const pararNoHumano = async (motivo: string) => {
    await salvarCampos()
    await registrarHandoff(sessaoId, motivo, 'falha')
    await guardarSessao(sessaoId, {
      noAtual: null,
      vars: campos,
      tentativas: 0,
      status: 'humano',
    })
    /*
     * Dar dono vem **antes** do aviso, e não depois.
     *
     * O aviso é o que faz a equipe olhar a conversa. Avisar primeiro e atribuir
     * depois abre uma janela em que todo mundo vê "alguém precisa de gente" sem
     * dono nenhum ao lado, que é exatamente a corrida que a distribuição existe
     * para evitar.
     */
    await distribuirSeSemDono(contato.clienteId, contato.id)
    await avisarDoHandoff(motivo)
  }

  /*
   * O aviso sai **depois** de o handoff estar registrado, e nunca antes.
   *
   * Quem está esperando tem que aparecer na tela mesmo que push nenhum saia,
   * o aviso é o extra, a fila é a verdade. `avisarHandoff` já engole a própria
   * falha; o `catch` aqui é a segunda rede, para uma exceção nova nunca poder
   * desfazer uma transferência que já aconteceu.
   */
  const avisarDoHandoff = async (motivo: string, avisarUsuarioId?: string) => {
    try {
      await avisarHandoff({
        clienteId: contato.clienteId,
        contatoId: contato.id,
        nomeDoContato: contato.nomeReal ?? contato.nome,
        motivo,
        avisarUsuarioId,
      })
    } catch (erro) {
      await alertar('não deu para avisar a equipe do handoff', erro, alvo)
    }
  }

  for (const acao of acoes) {
    switch (acao.tipo) {
      case 'enviar_texto': {
        if (acao.atrasoMs && mensagemId) {
          await canal.aguardarResposta({ mensagemId, contato: contato.waId }, acao.atrasoMs)
        }

        // Grava antes de mandar e confirma depois, ver `registrarSaida`.
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          // Saiu daqui: é o motor de fluxo falando, não gente.
          autor: AUTOR_AUTOMACAO,
          texto: acao.texto,
        })
        const entrega = await entregar(() => canal.enviarTexto(contato.waId, acao.texto), alvo)
        // Parar em vez de seguir: mandar a terceira mensagem depois da segunda
        // ter falhado entrega uma conversa fora de ordem, e uma conversa fora
        // de ordem é pior do que uma pessoa assumindo. A linha fica gravada
        // como não confirmada, que é o registro honesto do que se tentou.
        if (!entrega.ok) return pararNoHumano(entrega.motivo)

        await confirmarEntrega(registro, entrega.waMessageId)
        break
      }

      case 'enviar_midia': {
        if (acao.atrasoMs && mensagemId) {
          await canal.aguardarResposta({ mensagemId, contato: contato.waId }, acao.atrasoMs)
        }

        // O que fica na conversa é a legenda, e sem legenda o rótulo do tipo.
        // Uma linha em branco no histórico do lead esconderia que algo foi
        // entregue; `payload` guarda o resto para a tela desenhar o anexo.
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          // Saiu daqui: é o motor de fluxo falando, não gente.
          autor: AUTOR_AUTOMACAO,
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

        await confirmarEntrega(registro, entrega.waMessageId)
        break
      }

      case 'enviar_opcoes': {
        // O menu é o que mais aparece numa triagem, e era o único envio que
        // esperava calado: a pausa parecia o bot travado em vez de alguém
        // escrevendo do outro lado.
        if (acao.atrasoMs && mensagemId) {
          await canal.aguardarResposta({ mensagemId, contato: contato.waId }, acao.atrasoMs)
        }

        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          // Saiu daqui: é o motor de fluxo falando, não gente.
          autor: AUTOR_AUTOMACAO,
          texto: acao.texto,
          payload: { opcoes: acao.opcoes, formato: acao.formato },
        })
        const entrega = await entregar(
          () => canal.enviarOpcoes(contato.waId, acao.texto, acao.opcoes, acao.formato),
          alvo,
        )
        if (!entrega.ok) return pararNoHumano(entrega.motivo)

        await confirmarEntrega(registro, entrega.waMessageId)
        break
      }

      case 'enviar_produtos': {
        if (acao.atrasoMs && mensagemId) {
          await canal.aguardarResposta({ mensagemId, contato: contato.waId }, acao.atrasoMs)
        }

        /*
         * Card só com foto real e canal que saiba mostrar. O resto vai como
         * texto com o link, um por produto, e a prévia do link mostra o que a
         * loja tiver: nunca a imagem placeholder do Magento.
         *
         * No histórico fica o texto do card, para o Inbox ler o que a pessoa
         * recebeu sem saber desenhar card; `payload` guarda o produto inteiro.
         */
        const enviarCards = canal.enviarProdutos?.bind(canal)
        // Foto sem link também vira texto: o card sem link não tem botão, o
        // canal pula, e o item sumiria calado.
        // O link passa por nós para o clique virar evento do contato; ver
        // `link-de-produto.ts`. Fica gravado assim também, porque o chat do
        // site desenha o card a partir do histórico.
        const produtos = acao.produtos.map((p) => comLinkRastreado(p, contato, canal.origem))
        const comFoto = enviarCards ? produtos.filter((p) => p.link && (p.foto || canal.cardSemFoto)) : []
        const semFoto = produtos.filter((p) => !comFoto.includes(p))

        if (enviarCards && comFoto.length > 0) {
          const registro = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto: comFoto.map(textoDoCard).join('\n\n'),
            payload: { produtos: comFoto },
          })
          const entrega = await entregar(() => enviarCards(contato.waId, comFoto), alvo)
          if (!entrega.ok) return pararNoHumano(entrega.motivo)
          await confirmarEntrega(registro, entrega.waMessageId)
        }

        for (const produto of semFoto) {
          const texto = textoDoCard(produto)
          const registro = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto,
            payload: { produtos: [produto] },
          })
          const entrega = await entregar(() => canal.enviarTexto(contato.waId, texto), alvo)
          if (!entrega.ok) return pararNoHumano(entrega.motivo)
          await confirmarEntrega(registro, entrega.waMessageId)
        }
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
         * A pausa é do **contato** e não da sessão, sobrevive à próxima
         * conversa, que é o comportamento que a coluna `automacao_ativa`
         * sempre teve quando alguém desliga pela tela. Um AutoOff que valesse
         * só até o fim da conversa não desligaria nada na prática.
         *
         * As ações seguintes continuam saindo: o desenho comum é calar o bot e
         * mandar a última frase, e parar aqui engoliria justamente a despedida.
         */
        await alterarAutomacaoDoContato(contato.clienteId, contato.id, false)
        break

      case 'mover_etapa': {
        /**
         * O bloco de etapa (C1b), e ele é o que faz o quadro se manter sozinho.
         *
         * **Nada aqui pode derrubar a conversa.** A versão publicada é imutável
         * e a etapa é estado vivo: quem arrumou o quadro semana passada não
         * pode fazer a mensagem de alguém falhar hoje. Etapa sumida vira log e
         * a conversa segue, o repo já devolve `false` em vez de estourar.
         */
        const entrou = await porContatoNaEtapa(
          contato.clienteId,
          contato.id,
          acao.quadroId,
          acao.colunaId,
        )
        if (!entrou) {
          console.error('[quadros] a etapa do fluxo não existe mais', acao.colunaId)
          break
        }
        // Chegar numa etapa é um ato deliberado sobre um contato, como aplicar
        // etiqueta, e é o terceiro evento que inscreve em sequência (0034).
        await inscreverNoEvento(contato.clienteId, [contato.id], 'etapa_alcancada', acao.colunaId)
        break
      }

      case 'aplicar_etiqueta': {
        /**
         * O bloco de etiqueta (0044).
         *
         * **Faz exatamente o que o clique no Inbox faz**, inclusive sair da
         * sequência que essa etiqueta encerra e entrar na que ela começa. Se
         * etiquetar pelo fluxo e etiquetar pela mão tivessem efeitos
         * diferentes, o cliente teria dois comportamentos com o mesmo nome, e
         * ninguém descobre esse tipo de divergência até ela doer.
         *
         * **Nada aqui pode derrubar a conversa.** Etiqueta apagada depois da
         * publicação é nada-a-fazer, como a etapa sumida: `marcarContatos`
         * devolve `ok: false` e a conversa segue.
         */
        const marcou = await marcarContatos(
          contato.clienteId,
          acao.etiquetaId,
          [contato.id],
          true,
        )
        if (!marcou.ok) {
          console.error('[etiquetas] a etiqueta do fluxo não existe mais', acao.etiquetaId)
          break
        }
        await sairPelaEtiqueta(contato.clienteId, acao.etiquetaId, marcou.validos)
        await inscreverNoEvento(
          contato.clienteId,
          marcou.validos,
          'etiqueta_aplicada',
          acao.etiquetaId,
        )
        break
      }

      case 'escrever_nota':
        /**
         * O bloco de anotação (0044).
         *
         * O texto já veio interpolado pelo motor. Quem **acrescenta** é o repo,
         * e é lá que está a razão: a anotação da equipe não pode ser apagada
         * pelo bot.
         *
         * Falhar aqui é log e segue. Uma nota que não foi escrita custa um
         * registro; uma exceção custaria a resposta de alguém.
         */
        try {
          await acrescentarNota(contato.clienteId, contato.id, acao.texto)
        } catch (erro) {
          await alertar('não deu para escrever a anotação do fluxo', erro, {
            contato: contato.id,
          })
        }
        break

      /*
       * A nota da pesquisa de satisfação (0060).
       *
       * **Nada aqui pode derrubar a conversa**, como a etiqueta e a nota: o
       * repo engole o próprio erro e devolve `null`. Uma nota perdida custa um
       * número no relatório; uma exceção custaria a próxima mensagem de alguém
       * que acabou de ser atendido, e é justamente a mensagem de agradecimento
       * que viria logo depois.
       *
       * `origem: 'fluxo'` sempre: esta ação só nasce de um bloco num desenho. A
       * pesquisa que sai do botão "resolver" no Inbox também passa por aqui,
       * mas ela **roda um fluxo** (o de pós-atendimento), do ponto de vista do
       * registro, é o bloco que está perguntando.
       */
      case 'guardar_nota':
        await guardarNota(contato.clienteId, contato.id, acao.nota, 'fluxo', { sessaoId })
        break

      case 'guardar_comentario':
        await guardarComentario(contato.clienteId, contato.id, acao.comentario)
        break

      case 'transferir_humano':
        // Prevista: o bloco está no fluxo porque alguém o pôs ali. Um fluxo que
        // termina em "falar com a recepção" é o produto funcionando, e contá-lo
        // como falha faria a operação saudável parecer quebrada.
        await registrarHandoff(sessaoId, acao.motivo, 'prevista')
        await distribuirSeSemDono(contato.clienteId, contato.id)
        // O bloco pode ter endereçado o aviso a alguém; sem isso, a equipe.
        await avisarDoHandoff(acao.motivo, acao.avisarUsuarioId)
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
          // Saiu daqui: é o motor de fluxo falando, não gente.
          autor: AUTOR_AUTOMACAO,
          texto: AVISO_DE_HANDOFF,
        })
        const entrega = await entregar(() => canal.enviarTexto(contato.waId, AVISO_DE_HANDOFF), alvo)
        if (entrega.ok) await confirmarEntrega(registro, entrega.waMessageId)

        return pararNoHumano(
          entrega.ok
            ? 'o fluxo pediu IA e não há modelo disponível'
            : `o fluxo pediu IA e não há modelo disponível, e ${entrega.motivo}`,
        )
      }

      case 'chamar_http': {
        // O resolvedor sempre atende esta ação, inclusive quando a chamada
        // falha, porque `aoFalhar` decide lá. Chegar aqui é defeito nosso, e
        // entre deixar alguém pendurado e passar para uma pessoa, passa.
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          // Saiu daqui: é o motor de fluxo falando, não gente.
          autor: AUTOR_AUTOMACAO,
          texto: AVISO_DE_HANDOFF,
        })
        const entrega = await entregar(() => canal.enviarTexto(contato.waId, AVISO_DE_HANDOFF), alvo)
        if (entrega.ok) await confirmarEntrega(registro, entrega.waMessageId)

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

  /*
   * A reação, cujo `texto` é o próprio emoji.
   *
   * Quem chama já para antes do motor quando `mensagem.reaction` existe
   * (ver `tratarUma`), então a `Entrada` devolvida aqui **não é usada para
   * avançar nada**, ela existe porque o tipo de retorno a exige. O que vale
   * deste ramo é o `texto`: é ele que vai para a coluna e vira a prévia da
   * fila.
   *
   * Sem este ramo, a reação caía no fallback de mídia logo abaixo e gravava
   * `texto: null`, a fila mostrava "mídia ou mensagem sem texto" para um
   * "❤️", e a bolha ficava vazia.
   */
  if (mensagem.reaction) {
    const emoji = mensagem.reaction.emoji ?? ''
    return {
      entrada: { tipo: 'midia', formato: 'reaction' },
      texto: emoji === '' ? null : emoji,
    }
  }

  /*
   * Áudio, imagem, documento, figurinha, localização.
   *
   * A referência e a legenda vão junto: o desenho pode ter dito que ali a foto
   * **é** a resposta (saída "mandou arquivo"), e nesse caso ele precisa do id
   * para mandar ao sistema do cliente. Quando o desenho não trata, nada disso é
   * usado e a conversa vai para uma pessoa como sempre foi.
   */
  const anexo =
    mensagem.image ?? mensagem.audio ?? mensagem.video ?? mensagem.document ?? mensagem.sticker

  return {
    entrada: {
      tipo: 'midia',
      formato: mensagem.type,
      ...(anexo?.id ? { midiaId: anexo.id } : {}),
      ...(anexo?.caption ? { legenda: anexo.caption } : {}),
    },
    texto: anexo?.caption ?? null,
  }
}

/**
 * Traduz o expediente da conta no que o motor entende.
 *
 * `null`, conta que nunca configurou, vira "sempre aberto". É o que a coluna
 * vazia significa, e o lado seguro do erro: um produto que emudece sozinho por
 * causa de uma coluna nova é bem pior que um que continua respondendo.
 */
function contextoDeAtendimento(horario: HorarioDeAtendimento | null): ContextoDoAtendimento {
  /*
   * `hoje` vai nos dois caminhos, inclusive no da conta sem expediente
   * configurado: quem nunca mexeu em horário de atendimento também não pode
   * marcar aula para uma data que já passou.
   *
   * O fuso é o da conta quando existe, e o de São Paulo quando não, o mesmo
   * padrão de `SEMPRE_ABERTO`. Ler o dia em UTC faria o bot recusar "hoje"
   * depois das 21h, que é justamente quando se remarca aula.
   */
  const hoje = hojeNaConta(horario?.fuso ?? SEMPRE_ABERTO.fuso)

  if (!horario) return { ...ATENDIMENTO_SEMPRE_ABERTO, hoje }

  return {
    atendimentoAberto: atendimentoAberto(horario),
    proximaAbertura: proximaAbertura(horario),
    motivoDeFechado: motivoDeHojeFechado(horario),
    hoje,
  }
}
