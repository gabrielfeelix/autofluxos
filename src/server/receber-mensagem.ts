import 'server-only'
import { motivoDoNaoSuportado, tipoDoNaoSuportado } from '@/core/payload-da-mensagem'
import { db } from './db'
import { encaminhamentoEmTexto, telefoneLegivel } from '@/core/encaminhar'
import { z } from 'zod'
import { distribuirSeSemDono } from './distribuir-atendimento'
import type { Canal } from '@/channels/types'
import { canalDoWhatsApp } from './canal-do-whatsapp'
import { AUTOR_AUTOMACAO } from '@/core/autor-da-mensagem'
import { sessaoNova, type Acao, type Entrada } from '@/core/engine/types'
import { varsIniciais } from '@/core/contatos/vars-iniciais'
import { comoMandarProduto, pedidoDoBotao, textoDoCard } from '@/core/loja'
import { alertar, type ContextoDoAlerta } from './alertar'
import { criarCobranca, tentarPedidoNativo, textoDaCobranca } from './cobrancas'
import { pedidoDoFluxo } from './pedidos'
import { ultimaCobrancaDoFluxo, type CobrancaRegistrada } from './repos/cobrancas'
import { formularioDoCanal } from './repos/formularios-do-whatsapp'
import { criarTokenDoFormulario, lerTokenDoFormulario, type DadosDoToken } from './formularios-do-whatsapp/token'
import { lerMarcacao, type MarcacaoDoFormulario } from '@/core/formulario-de-agendamento'
import { avisarHandoff } from './avisar-handoff'
import { executarComEfeitos, type OpcoesDeEfeitos } from './efeitos/resolver'
import { guardarMidiaRecebida } from './guardar-midia-recebida'
import { comoTextoDaImagem, lerImagemRecebida } from './ler-imagem'
import { escolherModelo } from './ia/modelo'
import { comLinkRastreado } from './link-de-produto'
import { juntarFraseAosCards, juntarTextosSeguidos } from '@/core/juntar-cards'
import type { Turno } from '@/server/ia/types'
import { guardarComentario, guardarNota } from './repos/avaliacoes'
import { acharCliente, horarioDoCliente, retomadaDoCliente } from './repos/clientes'
import { MINUTOS_DE_RETOMADA_PADRAO } from '@/core/retomada'
import { acharFluxo, acharVersao, type VersaoPublicada } from './repos/fluxos'
import { acrescentarNota, definirEstadoDaConversa, lerConversa } from './repos/leads'
import {
  ATENDIMENTO_SEMPRE_ABERTO,
  avisoDeForaDoHorario,
  pediuAtendente,
  pediuInicioDoAtendimento,
  saidaDaIaSemCaminho,
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
  donoFalouPeloCelularDesde,
  aberturaDaConversaAtual,
  ultimaFalaDaEquipe,
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
  ultimaEntradaDeTexto,
  chegouEntradaDepois,
  encaminhouHaPouco,
  encerrarAtendimento,
  type CanalSalvo,
  type Contato,
  type IdentidadeDoWhatsApp,
  type SessaoSalva,
  revisaoDoControle,
} from './repos/conversas'
import { ESPERA_DA_MENSAGEM_MS, travarContato } from './repos/travas'
import { JANELA_DA_RAJADA_MS, textoDaRajada } from '@/core/rajada'
import { comCitacao } from '@/core/citacao-para-ia'
import { recortarConversaAtual, semDecisoesAntigas, TETO_DA_CONVERSA_ATUAL } from '@/core/conversa-atual'
import { inscreverNoEvento, sairPelaEtiqueta, sairPorEvento } from './sequencias'
import { marcarContatos } from './repos/etiquetas'
import { porContatoNaEtapa } from './repos/quadros'
import { porNoQuadroPadrao } from './quadro-de-entrada'
import { aplicarFato, marcarUltimaMensagem } from './repos/crm'
import { anotar, religadoEm } from './repos/eventos'
import { registrarPassagem } from './repos/passagens'
import { enviarEmailDoBloco } from './email-do-fluxo'
import { ehPedidoDeSaida } from '@/core/consentimento'
import { atenderPedidoDeSaida } from './consentimento'

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
  /*
   * O botão de resposta rápida de um **modelo** (`type: 'button'`), que não é
   * o `interactive` das mensagens comuns. É por ele que chega o "Parar
   * promoções" que a Meta põe nos modelos de marketing.
   */
  button: z.object({ text: z.string().optional(), payload: z.string().optional() }).optional(),
  interactive: z
    .object({
      button_reply: z.object({ id: z.string(), title: z.string().optional() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string().optional() }).optional(),
      /** O "Concluir" do formulário nativo (WhatsApp Flows): o JSON vem como texto. */
      nfm_reply: z.object({ response_json: z.string().optional(), name: z.string().optional() }).optional(),
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
  /*
   * `id` opcional: a mensagem **encaminhada** chega com `context: { forwarded:
   * true }` e sem `id`. Com o `id` obrigatório o webhook inteiro falhava no
   * parse e era descartado calado, e o áudio encaminhado nunca chegava ao
   * painel (4YU Tech, 13/out/2026).
   */
  context: z.object({ id: z.string().optional() }).optional(),
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
  /*
   * A pessoa editou ou apagou uma mensagem que já mandou.
   *
   * Os dois trazem `original_message_id`, o `wa_message_id` da mensagem
   * mexida, e a edição traz a mensagem nova inteira em `edit.message`. Antes
   * eles não estavam no schema, o parse os jogava fora, e a edição do Hugo
   * (PCYES, 06/out) virou uma bolha "(áudio, imagem ou documento)" que ainda
   * acordou o bot. Guardados soltos: quem interpreta é `correcaoDoPayload`.
   */
  edit: z
    .object({
      original_message_id: z.string().optional(),
      message: z
        .object({
          type: z.string().optional(),
          text: z.object({ body: z.string() }).optional(),
          image: anexoSchema.optional(),
          video: anexoSchema.optional(),
          document: anexoSchema.optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .optional(),
  revoke: z.object({ original_message_id: z.string().optional() }).passthrough().optional(),
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
  if (!analise.success) {
    // Descartar calado foi o que escondeu o áudio encaminhado: um campo novo
    // da Meta derrubava o evento inteiro e ninguém ficava sabendo.
    await alertar('webhook do WhatsApp recusado na leitura', analise.error, {
      problemas: analise.error.issues.slice(0, 5).map((p) => `${p.path.join('.')}: ${p.message}`).join(' | '),
    })
    return
  }

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
    await alertar('não foi possível trocar o BSUID do contato', detalhe, { canal: canal.id })
  }
}

async function guardarTelefoneDoCanal(canal: CanalSalvo, telefone: string | undefined) {
  if (!telefone || canal.displayPhoneNumber) return

  try {
    await salvarTelefoneDoCanal(canal.id, telefone)
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('não foi possível gravar o telefone do canal', detalhe, { canal: canal.id })
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
    await anotar(canalSalvo.clienteId, contato.id, 'chegou', { origem: canalSalvo.provider === 'instagram' ? 'Instagram' : canalSalvo.provider === 'site' ? 'Site' : canalSalvo.provider === 'telegram' ? 'Telegram' : 'WhatsApp' })
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
    ...(mensagem.context?.id ? { cita: mensagem.context.id } : {}),
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
        '[midia] não foi possível montar o canal para baixar a mídia',
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

  /*
   * Apagar "para todos" também não é a pessoa falando. Chegava ao motor como
   * mídia, e o bot respondia o apagar com o menu de boas-vindas (MGM, 05/out).
   * A linha já está gravada acima, e a tela a mostra como apagada.
   */
  if (mensagem.type === 'revoke') return

  /*
   * Editar também não. A pessoa corrigiu o que já disse, e o bot respondia a
   * correção como se fosse fala nova (Hugo, PCYES, 06/out: o "fora do
   * horário" saiu de novo). A tela troca o texto da original e marca
   * "Editada".
   */
  if (mensagem.type === 'edit') return

  /*
   * O "Concluir" do formulário de agendamento. Normalmente a conversa já
   * seguiu: o endpoint do formulário acorda o bloco Agendar no instante em que
   * a agenda grava. Aqui é a rede de segurança, e não é fala da pessoa: como
   * mensagem, cairia no bloco seguinte como resposta inválida.
   */
  if (mensagem.interactive?.nfm_reply) {
    await concluirFormulario(canalSalvo.clienteId, mensagem.interactive.nfm_reply.response_json)
    return
  }

  /*
   * A mensagem que a Meta avisa e não entrega (erro 131051: enquete, evento,
   * visualização única, tipo novo do WhatsApp). O conteúdo não chega por API
   * nenhuma, e o bot respondia "Não entendi 😅" com o menu, como se a pessoa
   * tivesse escrito errado (4YU Tech, 13/out/2026). O certo é dizer o que
   * aconteceu e pedir de novo num formato que chega, sem acordar o motor.
   */
  // Contato novo, sem conversa ainda, segue para as boas-vindas normalmente.
  if (mensagem.type === 'unsupported') {
    /*
     * Álbum é só o envelope: cada foto chega em seguida como mensagem própria.
     * Pedir "outro formato" aqui diria que não recebemos fotos que chegaram.
     */
    if (tipoDoNaoSuportado(mensagem) === 'album') return
    if (await pedirOutroFormato(canalSalvo, contato, mensagemId, motivoDoNaoSuportado(mensagem), fabricaDeCanal)) return
  }

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

  /*
   * "SAIR" sozinho tira a pessoa das promoções, e o bot não responde por cima
   * (ver `core/consentimento.ts`). Depois de `sairPorEvento` de propósito: quem
   * pede para sair também sai das sequências. Só no WhatsApp, que é por onde
   * sai marketing; "sair" no chat do site é a pessoa fechando a conversa.
   */
  if (canalSalvo.provider === 'cloud-api' && texto && ehPedidoDeSaida(texto)) {
    await atenderPedidoDeSaida(() => fabricaDeCanal(canalSalvo), contato, texto)
    return
  }

  /*
   * A rajada, ver `core/rajada.ts`: texto espera um pouco antes de acordar o
   * bot, e se outro texto da mesma pessoa chegou nesse meio tempo, quem
   * responde é ele. A mensagem já está gravada acima, então desistir aqui não
   * perde nada: a IA de quem responde lê a rajada inteira.
   *
   * Antes da trava de propósito: esperar segurando a vez faria a mensagem
   * seguinte ficar na fila da trava em vez de gravar e esperar a sua janela.
   */
  if (entrada.tipo === 'texto' && !process.env.VITEST) {
    await new Promise((resolver) => setTimeout(resolver, JANELA_DA_RAJADA_MS))
    const ultima = await ultimaEntradaDeTexto(contato.id)
    if (ultima !== null && ultima !== mensagemId) return
  }

  // Daqui para baixo a conversa avança, e duas mensagens da mesma pessoa não
  // podem avançar juntas, ver `repos/travas.ts` e a migration 0007.
  const destravar = await travarContato(contato.id, ESPERA_DA_MENSAGEM_MS)
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
    await avancarConversa(canalSalvo, contatoComOrigem, mensagem, mensagemId, entrada, texto, fabricaDeCanal)
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
      await alertar('não foi possível registrar a passagem pelo anúncio', detalhe, {
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
 * Esperar mais que a validade da trava (`ESPERA_DA_MENSAGEM_MS`) significa que alguma coisa está presa, não que há
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

/**
 * Tocou numa opção de um menu anterior, no meio de outro assunto?
 *
 * O menu continua na tela depois que a pessoa escolhe, e tocar em outra opção
 * dele é o jeito natural de mudar de assunto. Só que o toque chegava como
 * resposta da pergunta atual, e dentro da IA virava texto para ela: a PCYES viu
 * a conversa presa em "drivers" com o cliente tocando "Quero comprar".
 *
 * Duas condições, as duas necessárias: a opção **não** é da parada atual (se
 * for, é resposta normal) e **é** de uma pergunta do fluxo principal do número.
 * A segunda protege os botões que pertencem à conversa corrente, como o
 * "Pedir" dos cards de produto, que precisam continuar chegando à IA.
 */
async function trocouDeAssunto(canalSalvo: CanalSalvo, viva: SessaoSalva, opcaoId: string): Promise<boolean> {
  if (!canalSalvo.flowId) return false
  const temOpcao = (grafo: unknown, so?: string) =>
    ((grafo as { nodes?: { id: string; type: string; data?: { opcoes?: { id: string }[] } }[] } | null)?.nodes ?? []).some(
      (n) => n.type === 'pergunta' && (so === undefined || n.id === so) && (n.data?.opcoes ?? []).some((o) => o.id === opcaoId),
    )

  const atual = await acharVersao(viva.flowVersionId)
  if (atual && viva.sessao.noAtual && temOpcao(atual.grafo, viva.sessao.noAtual)) return false

  const principal = await acharFluxo(canalSalvo.flowId)
  if (!principal?.versaoPublicadaId || !principal.ativo) return false
  const versao = await acharVersao(principal.versaoPublicadaId)
  return Boolean(versao && temOpcao(versao.grafo))
}

/** "Voltar" numa IA sem ligação depois dela: recomeça pelo menu. Ver `saidaDaIaSemCaminho`. */
async function voltouDaIaSemCaminho(viva: SessaoSalva, texto: string): Promise<boolean> {
  if (viva.sessao.status !== 'ativa') return false
  const versao = await acharVersao(viva.flowVersionId)
  return Boolean(versao && saidaDaIaSemCaminho(versao.grafo, viva.sessao.noAtual, texto))
}

async function avancarConversa(
  canalSalvo: CanalSalvo,
  contato: Contato,
  mensagem: Mensagem,
  /** A linha desta mensagem em `messages`; `mensagem.id` é o id do WhatsApp. */
  mensagemId: string,
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

  /*
   * O dono respondeu pelo celular há pouco, e não havia bot conversando.
   *
   * O eco cala a sessão viva (`calarBotNaConversa`), mas sem sessão viva não há
   * o que calar, e a mensagem seguinte da pessoa abria a saudação no meio da
   * conversa dele. MGM, 05/out/2026: o Daniel respondeu o Marcelo às 08:15, o
   * Marcelo agradeceu às 08:47 e recebeu "Bem-vindo(a) à MGM Pilates".
   *
   * O prazo é o mesmo da retomada da conta: é o tempo que ela escolheu para o
   * bot esperar depois da equipe, e conta da última mensagem do dono, então
   * enquanto ele conversa o bot não volta. Vale contra gatilho, pelo mesmo
   * motivo da sessão em `humano` acima.
   */
  if (!viva) {
    const conta = await retomadaDoCliente(canalSalvo.clienteId)
    const minutos = conta?.minutos ?? MINUTOS_DE_RETOMADA_PADRAO
    if (await donoFalouPeloCelularDesde(contato.id, new Date(Date.now() - minutos * 60_000))) {
      // Religar o bot depois da fala libera o que veio antes: quem religou
      // quer o bot de volta agora, não daqui a duas horas. Só conta a fala do
      // celular **depois** do religar. Lido só aqui, quando o prazo calaria.
      const religado = await religadoEm(contato.id)
      if (!religado || (await donoFalouPeloCelularDesde(contato.id, religado))) return
    }
  }

  // "Início" recomeça pelo fluxo principal do número, e não pelo começo do
  // fluxo em que a conversa está (ver `pediuInicioDoAtendimento`): tratar a
  // conversa viva como se não existisse faz o principal abrir, e a viva morrer
  // encerrada logo abaixo, como em qualquer abertura.
  const recomecar =
    Boolean(viva) &&
    ((entrada.tipo === 'texto' && pediuInicioDoAtendimento(entrada.texto)) ||
      (entrada.tipo === 'texto' && viva !== null && (await voltouDaIaSemCaminho(viva, entrada.texto))) ||
      (entrada.tipo === 'opcao' && viva !== null && (await trocouDeAssunto(canalSalvo, viva, entrada.opcaoId))))
  const abertura = await escolherAbertura(
    canalSalvo,
    { temSessaoViva: Boolean(viva) && !recomecar, primeiraVez: anterior === null },
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
    //
    // A fala da equipe também conta como "acabou de ser atendida": sem sessão
    // anterior nenhuma, a conversa que o dono começou pelo celular abria o
    // menu com "Bem-vindo" na mensagem seguinte da pessoa (Luiz, PCYES,
    // 19/out/2026). Só é lida quando pode mudar a resposta.
    const podeSerRetomada = !anterior || anterior.sessao.status === 'encerrada'
    const equipeFalouEm = podeSerRetomada ? await ultimaFalaDaEquipe(contato.id) : null
    const retomada = ehRetomada(anterior, entrada, abertura, Date.now(), equipeFalouEm)
    const versaoDaAbertura = retomada ? await acharVersao(abertura.versaoId) : null
    const iniciais = varsIniciais(contato)
    salva = await criarSessao(contato.id, canalSalvo.id, abertura.versaoId, {
      ...sessaoNova(),
      vars: retomada
        ? {
            // Continuação da conversa, sem as decisões dela: ver `semDecisoesAntigas`.
            ...(versaoDaAbertura ? semDecisoesAntigas(iniciais, versaoDaAbertura.grafo) : iniciais),
            [VARIAVEL_DE_RETOMADA]: 'sim',
          }
        : iniciais,
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
    /*
     * A conversa nova já nasce com responsável, pela distribuição da conta.
     *
     * Até 30/set/2026 só o handoff distribuía, e toda conversa que o bot
     * atendia ficava "sem responsável" na Inbox, inclusive as que a equipe ia
     * acompanhar. Conta sem distribuição (ou sem ninguém disponível) segue sem
     * dono, como antes. Quem já tem dono não muda.
     */
    await distribuirSeSemDono(canalSalvo.clienteId, contato.id)
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
    /*
     * Foto na conversa com a IA: lida antes de o motor rodar.
     *
     * O motor não faz rede, então a leitura acontece aqui e chega a ele como
     * `lida`; a mesma leitura vira o texto da pergunta para a IA. Só quando a
     * conversa está parada num bloco de IA conversando: num menu ou numa
     * pergunta comum a foto segue a Regra B de sempre, e ler ali seria gastar
     * uma chamada que ninguém vai usar. Ver `ler-imagem.ts`.
     */
    let entradaDoMotor = entrada
    let textoDaPessoa = texto
    if (
      !conversaNova &&
      entrada.tipo === 'midia' &&
      entrada.formato === 'image' &&
      (paradaNaConversaComIa(versao.grafo, salva.sessao) || paradaNumaPerguntaAberta(versao.grafo, salva.sessao))
    ) {
      const lida = await lerImagemRecebida(canalSalvo.clienteId, contato.id, mensagemId)
      if (lida) {
        entradaDoMotor = { ...entrada, lida }
        textoDaPessoa = comoTextoDaImagem(lida, entrada.legenda)
      }
    }

    const [opcoesDeIa, horarioGuardado] = await Promise.all([
      prepararIa(canalSalvo, contato.id, versao, textoDaPessoa),
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
    // é o gatilho, não uma resposta: ela ainda não foi perguntada nada. A
    // exceção é o menu que entende texto, que recebe a frase como assunto (ver
    // o ramo `inicio` do motor); mídia nunca é consumida assim.
    const resultado = await executarComEfeitos(
      versao.grafo,
      salva.sessao,
      conversaNova
        ? {
            tipo: 'inicio',
            ...(entrada.tipo === 'opcao' ? { opcaoId: entrada.opcaoId } : {}),
            ...(entrada.tipo === 'texto' ? { texto: entrada.texto } : {}),
            ...(entrada.tipo === 'midia' && entrada.legenda ? { texto: entrada.legenda } : {}),
          }
        : entradaDoMotor,
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
        antesDaIa: async (envios) => {
          await aplicar(
            fabricaDeCanal(canalSalvo),
            contato,
            salva.id,
            mensagem.id,
            envios,
            revisaoAutorizada,
          )
        },
      },
    )

    /*
     * Alguém assumiu enquanto o modelo pensava? Então nada desta execução vale:
     * nem gravar a sessão, que devolveria ao bot uma conversa que a pessoa
     * acabou de tomar (PCYES, 30/set/2026), nem enviar, que `aplicar` já recusa.
     */
    if (revisaoAutorizada !== null) {
      const agora = await revisaoDoControle(canalSalvo.clienteId, contato.id)
      if (!aindaAutorizada({ conducao: 'bot', responsavelId: null, revisao: agora ?? -1 }, revisaoAutorizada)) {
        await alertar(
          'a resposta do bot foi descartada: alguém assumiu a conversa no meio',
          `revisão autorizada ${revisaoAutorizada}, atual ${agora ?? 'desconhecida'}`,
          { contato: contato.id, sessao: salva.id },
        )
        return
      }
    }

    /*
     * A pessoa mandou outra coisa enquanto o bot pensava: esta resposta já
     * nasceu velha. Evandro (PCYES, 01/out/2026) escreveu "ainda estou com o
     * mesmo problema" e, nove segundos depois, tocou em "Quero comprar". A
     * triagem levou dez segundos e respondeu sobre o pedido; o toque respondeu
     * sobre a compra. Duas respostas que se contradizem, as duas cobradas.
     * Sem gravar nem enviar, a mensagem nova, que espera a vez, responde a
     * partir do mesmo ponto e com a rajada inteira na mão.
     */
    if (!process.env.VITEST) {
      if (await chegouEntradaDepois(contato.id, mensagemId)) {
        console.warn('[rajada] resposta descartada: chegou mensagem nova enquanto o bot pensava', contato.id)
        return
      }
    }

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
    const saiuTudo = await aplicar(
      fabricaDeCanal(canalSalvo),
      contato,
      salva.id,
      mensagem.id,
      resultado.acoes,
      revisaoAutorizada,
    )

    /*
     * O bot encaminhou a pessoa para outro time e a automação terminou ali:
     * daqui não há mais nada a fazer, e a conversa sai da fila de "Sem
     * responsável". Na PCYES, em 30/set, três conversas levadas ao Suporte
     * ficaram abertas sem dono como se alguém devesse responder. Se a pessoa
     * escrever de novo, a própria mensagem reabre (0049).
     */
    if (
      saiuTudo === true &&
      resultado.sessao.status === 'encerrada' &&
      resultado.acoes.some((a) => a.tipo === 'encaminhar_contato')
    ) {
      try {
        await definirEstadoDaConversa(canalSalvo.clienteId, contato.id, 'resolvida')
      } catch (erro) {
        console.error('[encaminhar] não foi possível resolver a conversa encaminhada', erro)
      }
    }
  } finally {
    digitando.parar()
  }
}

/**
 * Quanto a pessoa espera, depois do handoff, antes de ouvir que alguém vem.
 *
 * Menos que isso e o aviso repete a frase do handoff que ela acabou de ler.
 */
/** Dentro disto, o mesmo encaminhamento não sai de novo para a mesma pessoa. */
const JANELA_DO_ENCAMINHAMENTO_REPETIDO_MS = 10 * 60_000

const ESPERA_ANTES_DO_AVISO_MS = 2 * 60_000

/** O que a pessoa lê quando escreve de novo e ninguém do time respondeu. */
export const AVISO_DE_ESPERA = 'Nossa equipe já foi avisada e responde por aqui em instantes.'

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
/** Uma vez a cada 10 minutos: duas enquetes seguidas não pedem dois avisos. */
const INTERVALO_DO_PEDIDO_DE_FORMATO_MS = 10 * 60_000

const PEDIDO_DE_OUTRO_FORMATO =
  'Recebemos sua mensagem, mas este formato não pode ser aberto por aqui. Poderia enviar novamente como texto, foto, vídeo ou áudio?'

/**
 * Pede de novo o que a Meta não entregou, dizendo o tipo quando ela conta.
 *
 * Melhor-esforço como o aviso de espera: falhar aqui não pode impedir a
 * mensagem de ficar registrada, e a bolha "veja no celular" continua avisando
 * quem atende.
 */
async function pedirOutroFormato(
  canalSalvo: CanalSalvo,
  contato: Contato,
  mensagemId: string,
  motivo: string | null,
  fabricaDeCanal: FabricaDeCanal,
): Promise<boolean> {
  try {
    const salva = await ultimaSessao(contato.id, canalSalvo.id)
    if (!salva) return false
    // Automação desligada ou conversa com uma pessoa: o bot não fala. A
    // mensagem já está no histórico e quem atende vê o aviso na bolha.
    if (!contato.automacaoAtiva || salva.sessao.status === 'humano') return true
    const desde = new Date(Date.now() - INTERVALO_DO_PEDIDO_DE_FORMATO_MS).toISOString()
    const { data: recente } = await db()
      .from('messages')
      .select('id')
      .eq('contact_id', contato.id)
      .eq('direcao', 'saida')
      .like('texto', 'Recebemos sua mensagem, mas %')
      .gte('ts', desde)
      .limit(1)
    if (recente && recente.length > 0) return true

    const texto = motivo
      ? `Recebemos sua mensagem (${motivo}), mas este formato não pode ser aberto por aqui. Poderia enviar novamente como texto, foto, vídeo ou áudio?`
      : PEDIDO_DE_OUTRO_FORMATO
    await aplicar(fabricaDeCanal(canalSalvo), contato, salva.id, mensagemId, [{ tipo: 'enviar_texto', texto }], null)
    return true
  } catch (erro) {
    await alertar('não foi possível pedir outro formato da mensagem', erro, { contato: contato.id })
    return true
  }
}

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
    await alertar('não foi possível avisar a pessoa que a equipe já vem', erro, {
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
 * A cobrança do bloco Cobrar teve desfecho (cobrança no chat, etapa D).
 *
 * Chamada pelo aviso do gateway (pagou) e pelo relógio do vencimento
 * (venceu), nunca por mensagem, e com as mesmas travas do prazo da pergunta:
 * só age se a conversa ainda está ativa, parada num bloco Cobrar, e se esta é
 * a cobrança mais nova que o fluxo criou nela. Uma cobrança da semana passada
 * paga hoje não empurra a conversa que já está em outro lugar.
 */
export async function acordarFluxoDaCobranca(
  cobranca: Pick<CobrancaRegistrada, 'id' | 'clienteId' | 'contatoId' | 'sessaoId' | 'origem'>,
  desfecho: 'pagou' | 'venceu',
  fabricaDeCanal: FabricaDeCanal = canalPadrao,
): Promise<'feita' | 'ignorada'> {
  const { sessaoId, contatoId } = cobranca
  if (cobranca.origem !== 'fluxo' || !sessaoId || !contatoId) return 'ignorada'

  const parada = async () => {
    const salva = await acharSessao(sessaoId)
    if (!salva || salva.sessao.status !== 'ativa' || !salva.sessao.noAtual) return null
    const versao = await acharVersao(salva.flowVersionId)
    const no = versao?.grafo.nodes.find((n) => n.id === salva.sessao.noAtual)
    return versao && no?.type === 'cobrar' ? { salva, versao } : null
  }

  const antes = await parada()
  if (!antes) return 'ignorada'
  const ultima = await ultimaCobrancaDoFluxo(cobranca.clienteId, sessaoId)
  if (ultima?.id !== cobranca.id) return 'ignorada'

  const [contato, canal] = await Promise.all([acharContato(contatoId), acharCanal(antes.salva.canalId)])
  if (!contato || !canal || canal.clienteId !== cobranca.clienteId) return 'ignorada'
  if (!contato.automacaoAtiva) return 'ignorada'

  // A mensagem que está chegando agora ganha, como no prazo da pergunta.
  const destravar = await travarContato(contatoId)
  if (!destravar) return 'ignorada'

  try {
    const agora = await parada()
    if (!agora || agora.salva.sessao.noAtual !== antes.salva.sessao.noAtual) return 'ignorada'
    const { salva, versao } = agora

    const [opcoesDeIa, horario] = await Promise.all([
      prepararIa(canal, contatoId, versao, null),
      horarioDoCliente(canal.clienteId),
    ])
    const revisaoAutorizada = await revisaoDoControle(canal.clienteId, contatoId)

    const resultado = await executarComEfeitos(versao.grafo, salva.sessao, { tipo: 'cobranca', desfecho }, {
      ...opcoesDeIa,
      atendimento: contextoDeAtendimento(horario),
      hoje: hojeNaConta(horario?.fuso ?? SEMPRE_ABERTO.fuso),
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

function jsonOuNulo(texto: string | undefined): unknown {
  if (!texto) return null
  try {
    return JSON.parse(texto) as unknown
  } catch {
    return null
  }
}

/** A chave da tarefa que desiste do formulário: uma por bloco esperando. */
function chaveDaDesistencia(sessaoId: string, noId: string): string {
  return `formulario:${sessaoId}:${noId}`
}

async function concluirFormulario(clienteId: string, respostaJson: string | undefined): Promise<void> {
  const resposta = jsonOuNulo(respostaJson) as Record<string, unknown> | null
  const token = lerTokenDoFormulario(resposta?.flow_token)
  const marcacao = lerMarcacao(resposta)
  if (!token.ok || !marcacao) return
  await acordarFluxoDoFormulario(clienteId, token.dados, marcacao)
}

/**
 * O bloco Agendar teve desfecho (formulário de agendamento, frente 5).
 *
 * `marcou` vem do endpoint do formulário (no `after()`, assim que a agenda
 * grava) ou do `nfm_reply`, o que chegar primeiro; o segundo encontra a
 * conversa já em outro bloco e não faz nada. `nao_marcou` vem do relógio.
 * Mesmas travas do Cobrar: só age com a conversa ativa e parada **naquele**
 * bloco Agendar.
 */
export async function acordarFluxoDoFormulario(
  clienteId: string,
  token: Pick<DadosDoToken, 'contatoId' | 'sessaoId' | 'noId'>,
  marcacao: MarcacaoDoFormulario | null,
  fabricaDeCanal: FabricaDeCanal = canalPadrao,
): Promise<'feita' | 'ignorada'> {
  const { sessaoId, contatoId, noId } = token
  if (!sessaoId || !noId) return 'ignorada'

  const parada = async () => {
    const salva = await acharSessao(sessaoId)
    if (!salva || salva.sessao.status !== 'ativa' || salva.sessao.noAtual !== noId) return null
    const versao = await acharVersao(salva.flowVersionId)
    const no = versao?.grafo.nodes.find((n) => n.id === noId)
    return versao && no?.type === 'agendar' ? { salva, versao } : null
  }

  const antes = await parada()
  if (!antes) return 'ignorada'
  const [contato, canal] = await Promise.all([acharContato(contatoId), acharCanal(antes.salva.canalId)])
  if (!contato || !canal || canal.clienteId !== clienteId) return 'ignorada'
  if (!contato.automacaoAtiva) return 'ignorada'

  const destravar = await travarContato(contatoId)
  if (!destravar) return 'ignorada'

  try {
    const agora = await parada()
    if (!agora) return 'ignorada'
    const { salva, versao } = agora
    if (marcacao) await cancelarPorChave(chaveDaDesistencia(sessaoId, noId))

    const [opcoesDeIa, horario] = await Promise.all([
      prepararIa(canal, contatoId, versao, null),
      horarioDoCliente(canal.clienteId),
    ])
    const revisaoAutorizada = await revisaoDoControle(canal.clienteId, contatoId)

    const entrada: Entrada = marcacao
      ? { tipo: 'formulario', desfecho: 'marcou', marcacao }
      : { tipo: 'formulario', desfecho: 'nao_marcou' }
    const resultado = await executarComEfeitos(versao.grafo, salva.sessao, entrada, {
      ...opcoesDeIa,
      atendimento: contextoDeAtendimento(horario),
      hoje: hojeNaConta(horario?.fuso ?? SEMPRE_ABERTO.fuso),
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

/** O prazo do bloco Agendar passou sem marcar (tarefa `desistencia_do_formulario`). */
export async function rodarDesistenciaDoFormulario(
  clienteId: string,
  dados: Record<string, unknown>,
  fabricaDeCanal: FabricaDeCanal = canalPadrao,
): Promise<'feita' | 'ignorada'> {
  const texto = (v: unknown) => (typeof v === 'string' ? v : null)
  const contatoId = texto(dados.contatoId)
  if (!contatoId) return 'ignorada'
  return acordarFluxoDoFormulario(clienteId, { contatoId, sessaoId: texto(dados.sessaoId), noId: texto(dados.noId) }, null, fabricaDeCanal)
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
    console.error('[pos-atendimento] não foi possível rodar o fluxo', detalhe)
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
  /** Variáveis que o evento traz (`{{aula_hora}}` da Verandi), por cima das do contato. */
  varsDoEvento: Record<string, string> = {},
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
      vars: { ...varsIniciais(contato), ...varsDoEvento },
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

/** O que aconteceu ao devolver a conversa ao bot. Ver `devolverAoBot`. */
export type DevolucaoAoBot =
  | 'respondeu'
  | 'aguardando'
  | 'sem_contexto'
  | 'janela_fechada'
  | 'sem_fluxo'
  | 'ocupado'

/**
 * "Devolver para o bot": a equipe tira a conversa da fila e o bot **continua de
 * onde ela está**, sem esperar a pessoa escrever de novo.
 *
 * Pedido do Gabriel em 15/out/2026, olhando a Renata (PCYES): ela tinha caído
 * em atendente pelo erro 500 da Meta, a Maria respondeu, e o "Quero comprar"
 * dela às 14:00 ficou sem resposta, porque com gente na conversa o bot cala.
 * Pausar o bot ali não fazia sentido: ele já estava calado.
 *
 * A conversa reabre no fluxo principal como **retomada** (a mesma variável de
 * quem volta a escrever logo depois de um atendimento), e é isso que faz a
 * PCYES cair na triagem, que lê a conversa inteira, em vez do "Bem-vindo" com o
 * menu. A IA recebe o histórico com o que a equipe escreveu.
 *
 * Só responde agora quando a última mensagem é da pessoa. Se quem falou por
 * último foi a equipe, não há pergunta esperando: o bot fica pronto e responde
 * a próxima mensagem dela, como no "Finalizar atendimento".
 */
export async function devolverAoBot(
  clienteId: string,
  contatoId: string,
  fabricaDeCanal: FabricaDeCanal = canalPadrao,
): Promise<DevolucaoAoBot> {
  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return 'sem_contexto'

  const contato = await acharContato(contatoId)
  if (!contato) return 'sem_contexto'

  const destravar = await travarContato(contatoId)
  if (!destravar) return 'ocupado'

  try {
    // Sai da fila primeiro: é a parte que não pode deixar de acontecer, mesmo
    // que o bot não tenha o que dizer agora.
    await encerrarAtendimento(clienteId, contatoId)
    if (!contato.automacaoAtiva) await alterarAutomacaoDoContato(clienteId, contatoId, true)

    const anterior = await ultimaSessao(contatoId, contexto.canal.id)
    if (anterior && anterior.sessao.status !== 'encerrada') {
      await definirStatusDaSessao(anterior.id, 'encerrada')
    }

    const { mensagens } = await lerConversa(contatoId, 10)
    const ultima = mensagens.at(-1)
    if (!ultima || ultima.direcao !== 'entrada') return 'aguardando'
    if (!dentroDaJanela(contexto)) return 'janela_fechada'

    const fluxoId = contexto.canal.flowId
    const fluxo = fluxoId ? await acharFluxo(fluxoId) : null
    if (!fluxo || fluxo.clienteId !== clienteId || !fluxo.versaoPublicadaId || !fluxo.ativo) return 'sem_fluxo'
    const versao = await acharVersao(fluxo.versaoPublicadaId)
    if (!versao) return 'sem_fluxo'

    const texto = textoDaEntrada(ultima)
    // Sem as decisões da conversa anterior: o `assunto` do botão tocado meia
    // hora antes fazia o fluxo de vendas abrir de novo com a pergunta genérica
    // (Sueli, PCYES, 19/out/2026). Ver `semDecisoesAntigas`.
    const salva = await criarSessao(contatoId, contexto.canal.id, versao.id, {
      ...sessaoNova(),
      vars: { ...semDecisoesAntigas(varsIniciais(contato), versao.grafo), [VARIAVEL_DE_RETOMADA]: 'sim' },
    })

    const [opcoesDeIa, horario] = await Promise.all([
      prepararIa(contexto.canal, contatoId, versao, texto),
      horarioDoCliente(clienteId),
    ])

    const resultado = await executarComEfeitos(versao.grafo, salva.sessao, { tipo: 'inicio', texto }, {
      ...opcoesDeIa,
      atendimento: contextoDeAtendimento(horario),
      hoje: hojeNaConta(horario?.fuso ?? SEMPRE_ABERTO.fuso),
      datas: varsDeData(horario?.fuso ?? SEMPRE_ABERTO.fuso),
      carregarFluxo: carregadorDeFluxo(clienteId),
    })

    if (resultado.destino) await trocarVersaoDaSessao(salva.id, resultado.destino.versaoId)

    await guardarSessao(salva.id, resultado.sessao)
    // `null` pelo mesmo motivo de `abrirFluxoParaContato`: foi alguém da
    // equipe que pediu, agora, e não há execução de bot a invalidar.
    await aplicar(fabricaDeCanal(contexto.canal), contato, salva.id, contexto.ultimaEntradaWaId, resultado.acoes, null)
    return 'respondeu'
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
/**
 * Lê a foto da rajada que ficou sem leitura.
 *
 * Foto e texto juntos ("Queiro esseeee" logo depois do print): o texto pega a
 * vez, a foto desiste na trava e nunca é lida, e a IA recebia "(áudio ou
 * imagem)" no lugar do produto. Miguel, PCYES, 25/out/2026: mandou o print do
 * teclado de novo e ganhou de novo o card do teclado que tinha recusado. Só as
 * fotos depois da última fala do bot: as de antes já foram respondidas.
 */
async function comImagensLidas<M extends { id: string; direcao: string; arquivo?: unknown; transcricao?: string | null }>(
  clienteId: string,
  contatoId: string,
  mensagens: M[],
): Promise<M[]> {
  const ultimaDoBot = mensagens.map((m) => m.direcao !== 'entrada').lastIndexOf(true)
  const pendentes = mensagens
    .slice(ultimaDoBot + 1)
    .filter((m) => !m.transcricao && (m.arquivo as { midia?: unknown } | null | undefined)?.midia === 'imagem')
  if (pendentes.length === 0) return mensagens
  const lidas = new Map(
    await Promise.all(pendentes.map(async (m) => [m.id, await lerImagemRecebida(clienteId, contatoId, m.id)] as const)),
  )
  return mensagens.map((m) => (lidas.get(m.id) ? { ...m, transcricao: lidas.get(m.id) } : m))
}

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
  // A conversa de agora inteira, até o teto, e nada da anterior: as últimas 10
  // cortavam a pergunta pendente numa conversa movimentada e traziam a de dois
  // anos atrás num contato que voltou. Ver `core/conversa-atual.ts`.
  const [fluxo, cliente, lida, abertaEm] = await Promise.all([
    acharFluxo(versao.fluxoId),
    acharCliente(canalSalvo.clienteId),
    lerConversa(contatoId, TETO_DA_CONVERSA_ATUAL),
    aberturaDaConversaAtual(contatoId),
  ])
  const conversa = { ...lida, mensagens: await comImagensLidas(canalSalvo.clienteId, contatoId, recortarConversaAtual(lida.mensagens, abertaEm)) }

  // O plano é lido do fluxo **agora**, e não da versão publicada: contrato não
  // congela junto com o desenho. Desligar a IA tem que valer na próxima
  // mensagem, não na próxima publicação.
  const { modelo } = await escolherModelo({
    iaHabilitada: fluxo?.iaHabilitada ?? false,
    clienteId: canalSalvo.clienteId,
  })
  const mensagensComCitacao = conversa.mensagens.map((m) => {
    // A foto lida e o áudio transcrito entram como o que dizem: é a leitura
    // que faz a IA responder "gostaria desses" com os produtos do print.
    const lida = m.direcao === 'entrada' && m.transcricao ? { ...m, texto: textoDaEntrada(m) } : m
    return lida.direcao === 'entrada' && lida.cita ? { ...lida, texto: comCitacao(lida.texto, lida.cita) } : lida
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
    ...(canalSalvo.displayPhoneNumber ? { numeroDoCanal: canalSalvo.displayPhoneNumber } : {}),
    // A rajada inteira, não só o último envio: quem mandou "Olá", "Tudo bem"
    // e "?" fez uma pergunta só, e a IA responde uma vez.
    // A resposta em cima de uma mensagem anterior leva a citada junto: "."
    // citando um link é uma pergunta sobre aquele produto.
    perguntaDaPessoa: perguntaDaPessoa
      ? (textoDaRajada(mensagensComCitacao) ?? perguntaDaPessoa)
      : undefined,
    historico: mensagensComCitacao.flatMap((m): Turno[] => {
      if (m.direcao === 'entrada') return [{ de: 'pessoa', texto: textoDaEntrada(m) }]
      if (!m.produtos?.length) return [{ de: 'bot', texto: m.texto ?? '(áudio ou imagem)' }]
      /*
       * O card gravado como texto (nome, preço, link) ensinava o modelo a
       * escrever o card na frase: em 01/out/2026 saiu "[Card: Placa de Vídeo
       * ... - R$ 1.509,00]" para um cliente da PCYES. A frase fica como fala
       * do bot; o card vira dado do que foi mostrado.
       */
      const doCard = new Set(m.produtos.flatMap((p) => [p.titulo, p.detalhe, p.link ?? ''].map((l) => l.trim())))
      const frase = (m.texto ?? '').split('\n').filter((l) => !doCard.has(l.trim())).join('\n').replace(/\n{3,}/g, '\n\n').trim()
      const mostrados = {
        de: 'ferramenta' as const,
        nome: 'loja_mostrar',
        texto: JSON.stringify({ ja_mostrado_em_card: m.produtos.map((p) => ({ nome: p.titulo, detalhe: p.detalhe })) }),
      }
      return frase ? [{ de: 'bot', texto: frase }, mostrados] : [mostrados]
    }),
  }
}

/** A conversa está parada num bloco de IA conversando, esperando a pessoa. */
function paradaNaConversaComIa(grafo: Fluxo, sessao: Sessao): boolean {
  if (sessao.status !== 'ativa' || sessao.noAtual === null) return false
  const no = grafo.nodes.find((n) => n.id === sessao.noAtual)
  return no?.type === 'ia' && Boolean(no.data.conversar)
}

/**
 * Parada numa pergunta de resposta escrita, sem opções. A foto ali é lida
 * também (06/out/2026): "Qual é o produto?" respondido com a foto da caixa do
 * fone Nebulla ia para a equipe, quando o nome estava escrito na caixa.
 */
function paradaNumaPerguntaAberta(grafo: Fluxo, sessao: Sessao): boolean {
  if (sessao.status !== 'ativa' || sessao.noAtual === null) return false
  const no = grafo.nodes.find((n) => n.id === sessao.noAtual)
  return no?.type === 'pergunta' && (no.data.opcoes?.length ?? 0) === 0
}

/** O que uma mensagem recebida diz, para o histórico que a IA lê. */
function textoDaEntrada(m: { texto: string | null; transcricao?: string | null; arquivo?: unknown }): string {
  if (m.transcricao) {
    // A legenda da foto fica em `texto`, e vai junto da leitura: "gostaria
    // desses" sem o que está no print não diz quais.
    const midia = (m.arquivo as { midia?: string } | null)?.midia
    if (midia === 'imagem') return comoTextoDaImagem(m.transcricao, m.texto)
    if (m.texto == null) return `[Áudio transcrito] ${m.transcricao}`
  }
  return m.texto ?? '(áudio ou imagem)'
}

/** O texto padrão antes de uma pessoa assumir. */
const AVISO_DE_HANDOFF = 'Vou te passar para um atendente. Só um instante!'

type Entrega =
  | { ok: true; waMessageId: string | null; semConfirmacao?: true }
  | { ok: false; motivo: string }

/**
 * Erro interno da Meta (5xx, o `#131000 Something went wrong`) **não diz que a
 * mensagem não saiu**.
 *
 * Em 15/out/2026 três conversas da PCYES tomaram 500 no menu de boas-vindas, e
 * duas das pessoas responderam tocando numa opção daquele mesmo menu: chegou. O
 * motor tratava como recusa, passava a conversa para gente e ignorava o toque;
 * Samara escolheu "Garantia e devolução", escreveu "Falar com humano" e ficou
 * nove minutos sem resposta nenhuma.
 *
 * Repetir também não serve, pela mesma razão: na maioria das vezes a pessoa
 * receberia duas. O registro honesto é "não confirmada", e a conversa segue no
 * fluxo. Se a mensagem de fato não chegou, a pessoa escreve e o próprio fluxo
 * pergunta de novo.
 */
function entregaIncerta(detalhe: string): boolean {
  return /^Cloud API respondeu 5\d\d\b/.test(detalhe)
}

/** Confirma a linha gravada, menos quando a Meta não disse se entregou. */
async function confirmarSeEntregue(registro: string, entrega: { waMessageId: string | null; semConfirmacao?: true }) {
  if (entrega.semConfirmacao) return
  await confirmarEntrega(registro, entrega.waMessageId)
}

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
    console.error('[whatsapp] não foi possível entregar a mensagem', detalhe)
    // O handoff cobre a pessoa, mas token expirado e número bloqueado derrubam
    // *todas* as conversas do cliente ao mesmo tempo, é o tipo de falha que
    // precisa chegar em alguém antes de virar um dia inteiro de leads perdidos.
    if (entregaIncerta(detalhe)) {
      await alertar('a Cloud API deu erro interno, a mensagem pode ter saído', detalhe, contexto)
      return { ok: true, waMessageId: null, semConfirmacao: true }
    }
    await alertar('a Cloud API recusou a entrega', detalhe, contexto)
    return { ok: false, motivo: `não foi possível entregar a mensagem, ${detalhe.slice(0, 200)}` }
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
): Promise<boolean | void> {
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
        canal: canal.origem,
        avisarUsuarioId,
      })
    } catch (erro) {
      await alertar('não foi possível avisar a equipe do handoff', erro, alvo)
    }
  }

  const jeitoDoCanal = {
    temCard: Boolean(canal.enviarProdutos),
    cardSemFoto: canal.cardSemFoto,
    temPedir: Boolean(canal.enviarProdutoComBotao),
  }
  // Uma bolha em vez de várias: cada mensagem é cobrada pela Meta desde
  // 01/out/2026. Primeiro os textos entre si, depois a frase com os cards.
  const juntados = juntarTextosSeguidos(acoes)
  const aEnviar = canal.enviarProdutosComTexto
    ? juntarFraseAosCards(juntados, (p) => comoMandarProduto(p, jeitoDoCanal) === 'card' && Boolean(p.foto))
    : juntados

  for (const acao of aEnviar) {
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

        await confirmarSeEntregue(registro, entrega)
        break
      }

      case 'encaminhar_contato': {
        /*
         * Duas mensagens onde o canal sabe (botão que abre a conversa com o
         * time, depois o cartão para salvar) e uma só onde não sabe (texto
         * com o link e o número escritos). O histórico guarda o texto que a
         * pessoa leu e, no cartão, o nome e o número, para o Inbox mostrar
         * para onde ela foi mandada.
         */
        // O mesmo encaminhamento não sai duas vezes seguidas (ver `encaminhouHaPouco`).
        if (await encaminhouHaPouco(contato.id, acao.link, JANELA_DO_ENCAMINHAMENTO_REPETIDO_MS)) {
          console.warn('[encaminhar] repetido em menos de 10 min, não saiu de novo', contato.id)
          break
        }

        const enviarBotao = canal.enviarBotaoDeLink?.bind(canal)
        const enviarCartao = canal.enviarContato?.bind(canal)
        const texto = enviarBotao ? acao.texto : encaminhamentoEmTexto(acao)

        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          autor: AUTOR_AUTOMACAO,
          texto,
          payload: {
            encaminhamento: { nome: acao.nome, telefone: acao.telefone, link: acao.link },
            ...(enviarBotao ? { botao: { rotulo: acao.rotulo, url: acao.link } } : {}),
          },
        })
        const entrega = await entregar(
          () => (enviarBotao ? enviarBotao(contato.waId, acao.texto, acao.rotulo, acao.link) : canal.enviarTexto(contato.waId, texto)),
          alvo,
        )
        if (!entrega.ok) return pararNoHumano(entrega.motivo)
        await confirmarSeEntregue(registro, entrega)

        if (enviarCartao && acao.cartao) {
          const cartao = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto: `${acao.nome}: ${telefoneLegivel(acao.telefone)}`,
          })
          const envio = await entregar(() => enviarCartao(contato.waId, { nome: acao.nome, telefone: acao.telefone }), alvo)
          // O botão já chegou com o link: o cartão é conveniência, e sem ele a
          // pessoa ainda tem como falar com o time. Falha aqui não para a
          // conversa na mão de alguém.
          if (envio.ok) await confirmarSeEntregue(cartao, envio)
        }
        break
      }

      case 'enviar_link': {
        if (acao.atrasoMs && mensagemId) {
          await canal.aguardarResposta({ mensagemId, contato: contato.waId }, acao.atrasoMs)
        }

        /*
         * Foto, texto e botão numa mensagem só onde o canal tem `cta_url`. Nos
         * outros, a foto sai antes e o link vai escrito no fim do texto: a
         * pessoa chega na página do mesmo jeito.
         */
        const enviarBotao = canal.enviarBotaoDeLink?.bind(canal)
        if (acao.imagem && !enviarBotao) {
          const foto = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto: '',
            payload: { midia: 'imagem', url: acao.imagem },
          })
          const envio = await entregar(() => canal.enviarMidia(contato.waId, { midia: 'imagem', url: acao.imagem! }), alvo)
          if (!envio.ok) return pararNoHumano(envio.motivo)
          await confirmarSeEntregue(foto, envio)
        }

        const texto = enviarBotao ? acao.texto : `${acao.texto}\n\n${acao.url}`
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          autor: AUTOR_AUTOMACAO,
          texto,
          // O Inbox desenha foto, texto e botão na mesma bolha, como o celular viu.
          ...(enviarBotao
            ? { payload: { botao: { rotulo: acao.rotulo, url: acao.url }, ...(acao.imagem ? { midia: 'imagem', url: acao.imagem } : {}) } }
            : {}),
        })
        const entrega = await entregar(
          () =>
            enviarBotao
              ? enviarBotao(contato.waId, acao.texto, acao.rotulo, acao.url, acao.imagem)
              : canal.enviarTexto(contato.waId, texto),
          alvo,
        )
        if (!entrega.ok) return pararNoHumano(entrega.motivo)
        await confirmarSeEntregue(registro, entrega)
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

        await confirmarSeEntregue(registro, entrega)
        break
      }

      case 'enviar_opcoes': {
        // O menu é o que mais aparece numa triagem, e era o único envio que
        // esperava calado: a pausa parecia o bot travado em vez de alguém
        // escrevendo do outro lado.
        if (acao.atrasoMs && mensagemId) {
          await canal.aguardarResposta({ mensagemId, contato: contato.waId }, acao.atrasoMs)
        }

        // Foto em cima dos botões numa mensagem só, quando o canal desenha isso.
        // Senão (lista, Telegram, Instagram) a foto sai antes, sozinha.
        const juntos = Boolean(acao.imagem && acao.formato === 'botoes' && canal.botoesComImagem)
        if (acao.imagem && !juntos) {
          const foto = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto: '',
            payload: { midia: 'imagem', url: acao.imagem },
          })
          const envio = await entregar(() => canal.enviarMidia(contato.waId, { midia: 'imagem', url: acao.imagem! }), alvo)
          if (!envio.ok) return pararNoHumano(envio.motivo)
          await confirmarSeEntregue(foto, envio)
        }

        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          // Saiu daqui: é o motor de fluxo falando, não gente.
          autor: AUTOR_AUTOMACAO,
          texto: acao.texto,
          payload: {
            opcoes: acao.opcoes,
            formato: acao.formato,
            // O Inbox desenha a foto e os botões na mesma bolha, como o celular viu.
            ...(juntos ? { midia: 'imagem', url: acao.imagem } : {}),
          },
        })
        const entrega = await entregar(
          () => canal.enviarOpcoes(contato.waId, acao.texto, acao.opcoes, acao.formato, juntos ? acao.imagem : undefined),
          alvo,
        )
        if (!entrega.ok) return pararNoHumano(entrega.motivo)

        await confirmarSeEntregue(registro, entrega)
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

        // A frase e os cards numa mensagem só: `juntarFraseAosCards` só junta
        // quando todo produto sai como card com foto.
        const juntos = canal.enviarProdutosComTexto?.bind(canal)
        if (acao.texto && juntos) {
          const texto = acao.texto
          const registro = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto: [texto, ...produtos.map(textoDoCard)].join('\n\n'),
            payload: { produtos },
          })
          const entrega = await entregar(() => juntos(contato.waId, texto, produtos), alvo)
          if (!entrega.ok) return pararNoHumano(entrega.motivo)
          await confirmarSeEntregue(registro, entrega)
          break
        }
        const enviarComBotao = canal.enviarProdutoComBotao?.bind(canal)
        const jeito = (p: (typeof produtos)[number]) =>
          comoMandarProduto(p, { temCard: Boolean(enviarCards), cardSemFoto: canal.cardSemFoto, temPedir: Boolean(enviarComBotao) })
        const comFoto = produtos.filter((p) => jeito(p) === 'card')
        const comBotao = produtos.filter((p) => jeito(p) === 'pedir')
        const soFoto = produtos.filter((p) => jeito(p) === 'imagem')
        const semFoto = produtos.filter((p) => jeito(p) === 'texto')

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
          await confirmarSeEntregue(registro, entrega)
        }

        // Foto sem link, com botão de pedir: um por mensagem, em ordem, cada um
        // esperando o anterior sair, para as fotos chegarem na ordem da lista.
        for (const produto of comBotao) {
          const legenda = textoDoCard(produto)
          const registro = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto: legenda,
            payload: { midia: 'imagem', url: produto.foto },
          })
          const entrega = await entregar(() => enviarComBotao!(contato.waId, produto), alvo)
          if (!entrega.ok) return pararNoHumano(entrega.motivo)
          await confirmarSeEntregue(registro, entrega)
        }

        // Foto sem link: a foto com o texto do card na legenda, sem botão.
        for (const produto of soFoto) {
          const legenda = textoDoCard(produto)
          const registro = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto: legenda,
            payload: { midia: 'imagem', url: produto.foto },
          })
          const entrega = await entregar(
            () => canal.enviarMidia(contato.waId, { midia: 'imagem', url: produto.foto!, legenda }),
            alvo,
          )
          if (!entrega.ok) return pararNoHumano(entrega.motivo)
          await confirmarSeEntregue(registro, entrega)
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
          await confirmarSeEntregue(registro, entrega)
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
        // Tirar não mexe em sequência: é o assunto que deixou de valer, e não
        // um evento novo da pessoa. Quem não tem a etiqueta segue igual.
        if (acao.tirar) {
          const tirou = await marcarContatos(contato.clienteId, acao.etiquetaId, [contato.id], false)
          if (!tirou.ok) console.error('[etiquetas] a etiqueta do fluxo não existe mais', acao.etiquetaId)
          break
        }
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

      case 'enviar_email':
        // O bloco Enviar e-mail. Nunca lança, e a Brevo tem 10s de prazo:
        // e-mail que falhou vira alerta, e a conversa segue.
        await enviarEmailDoBloco(contato, acao)
        break

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
          await alertar('não foi possível escrever a anotação do fluxo', erro, {
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
        if (entrega.ok) await confirmarSeEntregue(registro, entrega)

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
        if (entrega.ok) await confirmarSeEntregue(registro, entrega)

        return pararNoHumano(
          entrega.ok
            ? 'a integração não chegou a ser executada'
            : `a integração não chegou a ser executada, e ${entrega.motivo}`,
        )
      }

      case 'enviar_formulario': {
        /*
         * O bloco Agendar. A conversa já está gravada parada nele; aqui o
         * formulário sai, com o token assinado que diz de quem é e qual bloco
         * espera, e o relógio da desistência é marcado. Sem formulário
         * publicado no número, vai para uma pessoa: esperar um formulário que
         * não saiu seria esperar para sempre.
         */
        await salvarCampos()
        const contexto = await contextoDeResposta(contato.clienteId, contato.id)
        const formulario = contexto ? await formularioDoCanal(contato.clienteId, contexto.canal.id) : null
        const enviarFormulario = canal.enviarFormulario?.bind(canal)
        if (!formulario?.flowId || !enviarFormulario || !sessaoId) {
          return pararNoHumano('o número não tem o formulário de agendamento ativado')
        }
        const flowId = formulario.flowId
        const token = criarTokenDoFormulario(
          { formularioId: formulario.id, contatoId: contato.id, sessaoId, noId: acao.noId },
          new Date(),
          acao.horasParaDesistir,
        )
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          autor: AUTOR_AUTOMACAO,
          texto: acao.texto,
          payload: { formulario: formulario.id, rotulo: acao.botao },
        })
        const entrega = await entregar(() => enviarFormulario(contato.waId, { texto: acao.texto, botao: acao.botao, flowId, token, rascunho: formulario.status !== 'publicado' }), alvo)
        if (!entrega.ok) return pararNoHumano(entrega.motivo)
        await confirmarSeEntregue(registro, entrega)
        await agendar({
          clienteId: contato.clienteId,
          tipo: 'desistencia_do_formulario',
          quando: new Date(Date.now() + acao.horasParaDesistir * 3_600_000),
          dados: { contatoId: contato.id, sessaoId, noId: acao.noId },
          chave: chaveDaDesistencia(sessaoId, acao.noId),
        })
        break
      }

      case 'criar_cobranca': {
        /*
         * O bloco Cobrar. A conversa já está gravada parada nele, esperando o
         * gateway; aqui a cobrança nasce e o Pix sai. Não saiu (sem conexão,
         * gateway recusou, Asaas sem CPF): vai para uma pessoa, que cobra pelo
         * Inbox. Um fluxo esperando um pagamento que não existe esperaria
         * para sempre.
         */
        await salvarCampos()
        const criada = await criarCobranca({
          clienteId: contato.clienteId,
          contatoId: contato.id,
          valorCentavos: acao.valorCentavos,
          descricao: acao.descricao,
          venceEm: new Date(Date.now() + acao.horasParaVencer * 3_600_000),
          origem: 'fluxo',
          criadaPor: null,
          sessaoId,
        })
        if (!criada.ok) return pararNoHumano(`a cobrança do fluxo não saiu: ${criada.erro}`)
        const { cobranca } = criada
        // Nos ramos com Pedidos, a cobrança do bloco também entra na tela Pedidos.
        await pedidoDoFluxo(cobranca)

        // O pedido nativo do WhatsApp quando dá (etapa E); senão, texto e Pix.
        const nativo = await tentarPedidoNativo(canal, contato.waId, cobranca)
        if (nativo) {
          const pedido = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto: nativo.texto,
            payload: { cobranca: cobranca.id, pedido: true },
          })
          await confirmarEntrega(pedido, nativo.id)
          break
        }

        const texto = textoDaCobranca(cobranca)
        const enviarBotao = cobranca.link ? canal.enviarBotaoDeLink?.bind(canal) : undefined
        const resumo = enviarBotao || !cobranca.link ? texto : `${texto}\n${cobranca.link}`
        const registro = await registrarSaida({
          contatoId: contato.id,
          sessaoId,
          autor: AUTOR_AUTOMACAO,
          texto: resumo,
          payload: { cobranca: cobranca.id, ...(enviarBotao ? { botao: { rotulo: 'Pagar', url: cobranca.link! } } : {}) },
        })
        const entrega = await entregar(
          () => (enviarBotao ? enviarBotao(contato.waId, texto, 'Pagar', cobranca.link!) : canal.enviarTexto(contato.waId, resumo)),
          alvo,
        )
        if (!entrega.ok) return pararNoHumano(entrega.motivo)
        await confirmarSeEntregue(registro, entrega)

        // O Pix sozinho: no celular, tocar e segurar copia a mensagem inteira.
        if (cobranca.pixCopiaCola) {
          const pix = await registrarSaida({
            contatoId: contato.id,
            sessaoId,
            autor: AUTOR_AUTOMACAO,
            texto: cobranca.pixCopiaCola,
            payload: { cobranca: cobranca.id, pix: true },
          })
          const envio = await entregar(() => canal.enviarTexto(contato.waId, cobranca.pixCopiaCola!), alvo)
          if (!envio.ok) return pararNoHumano(envio.motivo)
          await confirmarSeEntregue(pix, envio)
        }
        break
      }

      case 'encerrar':
        break
    }
  }

  await salvarCampos()
  // Tudo saiu. Quem chama usa isto para saber que pode dar a conversa por
  // resolvida; qualquer `return` antes daqui é falha ou descarte.
  return true
}

/** Traduz o que o WhatsApp mandou para o que o motor entende. */
function paraEntrada(mensagem: Mensagem): { entrada: Entrada; texto: string | null } {
  if (mensagem.type === 'text' && mensagem.text) {
    return { entrada: { tipo: 'texto', texto: mensagem.text.body }, texto: mensagem.text.body }
  }

  /*
   * O botão de resposta rápida de um modelo ("Foi ótima" no template da
   * pesquisa da PCYES) chega como `type: 'button'`, e não como `interactive`.
   * Caía no fim desta função como mídia, e mídia numa pergunta vai para uma
   * pessoa: quem tocava no botão de um modelo nunca seguia o fluxo. É o que a
   * pessoa diria, então entra como texto, e a pergunta casa pelo rótulo.
   */
  if (mensagem.type === 'button' && mensagem.button?.text) {
    return { entrada: { tipo: 'texto', texto: mensagem.button.text }, texto: mensagem.button.text }
  }

  const resposta = mensagem.interactive?.button_reply ?? mensagem.interactive?.list_reply
  // O botão "Pedir" embaixo da foto de um produto: vira o que a pessoa diria.
  const pedido = resposta ? pedidoDoBotao(resposta.id) : null
  if (pedido) return { entrada: { tipo: 'texto', texto: pedido }, texto: pedido }
  // O "Concluir" do formulário: para antes do motor (ver `tratarUma`); aqui
  // só o texto que a conversa mostra.
  if (mensagem.interactive?.nfm_reply) {
    const marcacao = lerMarcacao(jsonOuNulo(mensagem.interactive.nfm_reply.response_json))
    return {
      entrada: { tipo: 'midia', formato: 'formulario' },
      texto: marcacao?.resumo ? `Marcou pelo formulário: ${marcacao.resumo}` : 'Enviou o formulário',
    }
  }

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
   * A edição: o `texto` é o que a mensagem diz agora, para a coluna e para a
   * prévia da fila. Como na reação, quem chama para antes do motor, e a
   * `Entrada` só existe porque o tipo de retorno a exige.
   */
  if (mensagem.type === 'edit') {
    const nova = mensagem.edit?.message
    const legenda = nova?.image?.caption ?? nova?.video?.caption ?? nova?.document?.caption
    return { entrada: { tipo: 'midia', formato: 'edit' }, texto: nova?.text?.body ?? legenda ?? null }
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
    // O botão do modelo entra como texto da linha, para a conversa mostrar o
    // que a pessoa tocou; o motor segue tratando como antes.
    texto: anexo?.caption ?? mensagem.button?.text ?? null,
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

/**
 * A variável que diz "esta pessoa acabou de ser atendida e escreveu de novo".
 *
 * O fluxo principal decide o que fazer com ela; na PCYES, uma condição no
 * começo do menu manda a mensagem direto para a triagem em vez de abrir com
 * "Olá, fulano! Bem-vindo" de novo (30/set/2026: quem recebia o botão do
 * Suporte e escrevia "obrigado" ganhava a saudação e o menu inteiros, e cada
 * um é uma mensagem cobrada).
 */
export const VARIAVEL_DE_RETOMADA = 'retomada'

/** Até quanto depois do fim da conversa anterior conta como retomada. */
const JANELA_DE_RETOMADA_MS = 2 * 60 * 60 * 1000

/**
 * A conversa nova é continuação da que acabou de terminar?
 *
 * Só por texto e só no fluxo principal: toque num botão antigo tem caminho
 * próprio, gatilho e campanha abrem o fluxo deles, e INICIO pede o menu com
 * todas as letras.
 */
export function ehRetomada(
  anterior: { sessao: { status: string }; atualizadoEm?: string } | null,
  entrada: Entrada,
  abertura: { gatilhoId?: string | null; campanhaId?: string | null },
  agora: number,
  equipeFalouEm: Date | null = null,
): boolean {
  if (anterior && anterior.sessao.status !== 'encerrada') return false
  if (entrada.tipo !== 'texto' || pediuInicioDoAtendimento(entrada.texto)) return false
  if (abertura.gatilhoId || abertura.campanhaId) return false
  // O fim da conversa do bot ou a última fala da equipe, o que tiver acontecido
  // dentro da janela: os dois são "acabou de ser atendida".
  const marcos = [anterior?.atualizadoEm ? Date.parse(anterior.atualizadoEm) : NaN, equipeFalouEm?.getTime() ?? NaN]
  return marcos.some((t) => Number.isFinite(t) && agora - t >= 0 && agora - t <= JANELA_DE_RETOMADA_MS)
}
