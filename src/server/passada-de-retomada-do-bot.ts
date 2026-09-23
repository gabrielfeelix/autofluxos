import 'server-only'
import { dentroDaJanela } from '@/channels/janela'
import { AUTOR_AUTOMACAO } from '@/core/autor-da-mensagem'
import { decidirRetomada, mensagemDaRetomada, type ConfigDaConta } from '@/core/retomada'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { anotar } from './repos/eventos'
import { retomadaDoCliente } from './repos/clientes'
import { acharVersao } from './repos/fluxos'
import {
  confirmarEntrega,
  contextoDeResposta,
  definirStatusDaSessao,
  registrarSaida,
  sessoesEmAtendimentoParado,
  ultimaFalaDaEquipe,
  type SessaoParada,
} from './repos/conversas'

/**
 * A conversa parada em atendimento humano volta ao bot (0090).
 *
 * ---------------------------------------------------------------------------
 * O que estava quebrado
 * ---------------------------------------------------------------------------
 *
 * Sessão em `humano` cala o bot naquele contato **para sempre**: o webhook
 * grava a mensagem e retorna sem executar nada (`avancarConversa`). A única
 * saída era alguém clicar em "Religar o bot nesta conversa", e o clique não
 * acontece: em 22/set/2026 havia quatro conversas presas em produção, a mais
 * velha de 03/set, com gente escrevendo do outro lado e nada respondendo.
 *
 * Não dá erro, não entra em alerta, não aparece em tela nenhuma. Some.
 *
 * ---------------------------------------------------------------------------
 * Varredura, e não tarefa agendada
 * ---------------------------------------------------------------------------
 *
 * O motivo está em `sessoesEmAtendimentoParado`, e em uma frase: são cinco
 * portas que levam uma sessão a `humano`, esquecer de agendar em uma delas
 * seria um defeito mudo, e defeito mudo é o que estamos consertando. A
 * varredura lê estado, e estado não tem porta para esquecer.
 *
 * ---------------------------------------------------------------------------
 * Quando ela roda de verdade
 * ---------------------------------------------------------------------------
 *
 * Cron da Vercel uma vez por dia (`vercel.json`), mais carona no webhook, como
 * `rodarTarefas` e `enviarAgendadas`. A carona é **da conta inteira**: qualquer
 * mensagem de qualquer contato faz a passada daquela conta acontecer. Na
 * prática, conta com movimento cumpre o prazo com minutos de atraso; conta
 * parada cumpre na madrugada seguinte.
 *
 * Não pendurar isto no pulso do Inbox: aquela rota é chamada a cada poucos
 * segundos por cada aba aberta e foi feita para ser a mais barata que existe.
 */

/** Quantas conversas uma passada resolve, para uma conta grande não travar as outras. */
export const PARADAS_POR_PASSADA = 50

export type ResumoDaRetomadaDoBot = {
  olhadas: number
  devolvidas: number
  /** Devolvidas sem conseguir avisar: a janela de 24h da Meta estava fechada. */
  semAviso: number
  esperando: number
  desligadas: number
}

export async function passadaDeRetomadaDoBot(): Promise<ResumoDaRetomadaDoBot> {
  const resumo: ResumoDaRetomadaDoBot = {
    olhadas: 0,
    devolvidas: 0,
    semAviso: 0,
    esperando: 0,
    desligadas: 0,
  }

  const paradas = await sessoesEmAtendimentoParado(PARADAS_POR_PASSADA)
  if (paradas.length === 0) return resumo

  /*
   * A configuração é por conta, e uma passada costuma trazer várias conversas
   * da mesma. Sem este cache, uma conta com trinta conversas presas custaria
   * trinta leituras idênticas da mesma linha de `clients`.
   */
  const porConta = new Map<string, ConfigDaConta | null>()

  /*
   * Um aviso por contato por passada.
   *
   * Um contato pode ter mais de uma sessão em `humano` ao mesmo tempo: cada
   * devolução encerra a sessão, a mensagem seguinte abre outra, e outro handoff
   * a deixa em `humano` de novo. Sem esta trava, a passada devolve todas e a
   * pessoa recebe a mesma frase três vezes no mesmo minuto, que foi exatamente
   * o que o teste da MGM mostrou em 22/set/2026.
   *
   * As outras sessões não ficam presas: elas continuam na lista da próxima
   * passada, e a próxima as encerra.
   */
  const jaAvisados = new Set<string>()

  for (const parada of paradas) {
    resumo.olhadas += 1

    try {
      if (jaAvisados.has(parada.contatoId)) {
        resumo.esperando += 1
        continue
      }
      if (!porConta.has(parada.clienteId)) {
        porConta.set(parada.clienteId, await retomadaDoCliente(parada.clienteId))
      }
      const conta = porConta.get(parada.clienteId) ?? null
      if (!conta || !conta.ativo) {
        resumo.desligadas += 1
        continue
      }

      /*
       * **AutoOff vence o prazo, sempre.** "O bot não fala com essa pessoa" é
       * escolha explícita de alguém, e nenhum relógio derruba escolha
       * explícita. Sem isto, a retomada religaria justamente os contatos que
       * alguém desligou de propósito.
       */
      if (!parada.automacaoAtiva) {
        resumo.desligadas += 1
        continue
      }

      const bloco = await escolhaDoBloco(parada)
      if (bloco === 'nunca') {
        resumo.desligadas += 1
        continue
      }

      /*
       * O relógio conta do **mais recente** entre a última fala da equipe e o
       * momento em que a conversa virou `humano`. Quem está respondendo agora
       * nunca é interrompido, e o handoff que ninguém viu é medido desde o
       * handoff.
       *
       * **Era `??`, e isso devolvia na mesma hora.** A última fala da equipe de
       * um contato costuma ser de dias atrás; usada no lugar do handoff de
       * agora, o prazo já nascia vencido. Em 22/set/2026, no teste da MGM, o
       * bot transferiu às 13:49 e mandou "voltei a te atender" às 13:49, e às
       * 14:22 mandou a mesma frase três vezes seguidas, uma por sessão presa.
       * Com duas horas configuradas na conta.
       */
      const daEquipe = await ultimaFalaDaEquipe(parada.contatoId)
      const desde = daEquipe && daEquipe > parada.desde ? daEquipe : parada.desde
      const decisao = decidirRetomada(conta, bloco?.minutos, desde)

      if (decisao.o === 'desligado') {
        resumo.desligadas += 1
        continue
      }
      if (decisao.o === 'esperar') {
        resumo.esperando += 1
        continue
      }

      const avisou = await devolverAoBot(parada, mensagemDaRetomada(conta, bloco?.mensagem))
      jaAvisados.add(parada.contatoId)
      resumo.devolvidas += 1
      if (!avisou) resumo.semAviso += 1
    } catch (erro) {
      // Uma conversa não derruba a passada: é o mesmo `try` por linha de
      // `passada-de-retomada` e `disparar-transmissao`. Um número desconectado
      // numa conta não pode travar a devolução de outra.
      console.error('[retomada-do-bot] conversa', parada.id, erro)
    }
  }

  return resumo
}

/**
 * O que o bloco de handoff escolheu, quando foi um bloco que parou a conversa.
 *
 * Devolve `'nunca'` para o caminho que não pode ser interrompido, `null` quando
 * não há nada de bloco a dizer (e aí vale a conta), e os dois campos quando o
 * bloco escolheu.
 *
 * Boa parte das sessões em `humano` **não** parou num bloco: a transferência
 * por falha do motor, a conversa travada e a resposta da equipe pelo Inbox
 * levam a `humano` sem bloco nenhum. Nesses casos só a conta decide, e é por
 * isso que a configuração de conta é obrigatória e a do bloco é opcional.
 */
async function escolhaDoBloco(
  parada: SessaoParada,
): Promise<{ minutos: number | undefined; mensagem: string | undefined } | 'nunca' | null> {
  if (!parada.noAtual) return null

  const versao = await acharVersao(parada.flowVersionId)
  if (!versao) return null

  const no = versao.grafo.nodes.find((n) => n.id === parada.noAtual)
  if (!no || no.type !== 'handoff') return null

  if (no.data.retomarEmMinutos === 'nunca') return 'nunca'
  return {
    minutos: no.data.retomarEmMinutos,
    mensagem: no.data.mensagemDeRetomada,
  }
}

/**
 * Avisa e encerra. Devolve se o aviso chegou a sair.
 *
 * **A sessão é encerrada mesmo sem o aviso**, e essa é a decisão que mais pesa
 * aqui. Fora da janela de 24h a Meta recusa texto livre (`#131047`), e esperar
 * a janela reabrir seria manter exatamente o defeito que este arquivo conserta:
 * a janela só reabre quando a pessoa escrever de novo, e é justamente essa
 * mensagem que precisa encontrar o bot ligado.
 *
 * A ordem é encerrar por último: se o envio morrer no meio, a conversa fica
 * como estava e a próxima passada tenta de novo. Encerrar primeiro deixaria
 * conversa devolvida sem ninguém ter sido avisado, sem segunda chance.
 */
async function devolverAoBot(parada: SessaoParada, texto: string): Promise<boolean> {
  const contexto = await contextoDeResposta(parada.clienteId, parada.contatoId)

  let avisou = false
  if (contexto && dentroDaJanela(contexto)) {
    const canal = await adaptadorDoCanal(contexto.canal)

    // Grava antes de enviar, como toda saída nossa: mensagem que saiu e não
    // ficou no histórico é pior do que mensagem que não saiu.
    const registro = await registrarSaida({
      contatoId: parada.contatoId,
      sessaoId: parada.id,
      texto,
      // Quem falou foi o bot, e a bolha precisa dizer isso: a frase fala em
      // nome da equipe ("a equipe já foi avisada") e, sem o rótulo, quem abre
      // o Inbox acha que um colega escreveu aquilo.
      autor: AUTOR_AUTOMACAO,
    })

    await confirmarEntrega(registro, await canal.enviarTexto(contexto.waId, texto))
    avisou = true
  }

  await definirStatusDaSessao(parada.id, 'encerrada')

  await anotar(
    parada.clienteId,
    parada.contatoId,
    'automacao',
    {
      o_que: 'a conversa voltou ao bot por inatividade do atendimento',
      avisou: avisou ? 'sim' : 'não, a janela de 24h estava fechada',
    },
    'automação',
  )

  return avisou
}
