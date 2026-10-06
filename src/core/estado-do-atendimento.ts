/**
 * O estado do atendimento de um contato, num lugar só (tarefa 8.1, X03).
 *
 * O Inbox e a ficha liam pedaços diferentes do mesmo estado: o cabeçalho
 * dizia "robô pausado" só porque havia responsável, e a coluna ao lado dizia
 * "BOT RESPONDENDO" lendo o interruptor de automação. As duas coisas na mesma
 * tela, sobre a mesma conversa. Aqui as quatro fontes viram uma resposta, com
 * dono, efeito no bot e a próxima ação.
 *
 * O que cala o bot, na ordem em que o servidor decide (`receber-mensagem`):
 *
 *  1. pedido de pessoa em aberto (handoff);
 *  2. pausa do contato (`automacao_ativa = false`), que só volta religando;
 *  3. sessão com uma pessoa (`status = 'humano'`: alguém assumiu ou
 *     respondeu), que volta quando alguém finaliza o atendimento.
 *
 * **Ter responsável não cala o bot.** Responsável é de quem a conversa é;
 * quem fala é decidido pela sessão. Por isso o cabeçalho não pode mais dizer
 * "robô pausado" só por haver um nome.
 */

export type EstadoDoAtendimento = 'bot' | 'aguardando_humano' | 'com_humano' | 'expirada' | 'encerrado'

export type AcaoDoAtendimento = 'assumir' | 'finalizar' | 'religar_bot'

export type Atendimento = {
  estado: EstadoDoAtendimento
  /** O selo, curto: "Bot respondendo", "Aguardando pessoa"... */
  rotulo: string
  /** Quem é o dono da conversa. `null` = ninguém. */
  donoId: string | null
  /** O que acontece com o bot, em uma frase. */
  efeito: string
  /** O bot está calado agora. */
  botCalado: boolean
  /** A ação que muda este estado. `null` quando não há o que fazer. */
  proximaAcao: AcaoDoAtendimento | null
  /**
   * O que entrou em `janelaFechada`, devolvido para a tela recalcular no
   * clique (finalizar, assumir) sem precisar saber de janela.
   */
  janelaFechada: boolean
}

export type EntradaDoAtendimento = {
  automacaoAtiva: boolean
  aguardando: { motivo: string; desde: string } | null
  atribuidoA: string | null
  /** A última sessão do contato está com uma pessoa (`status = 'humano'`). */
  sessaoComPessoa: boolean
  estado: 'aberta' | 'adiada' | 'resolvida'
  /** A conta tem fluxo ligado a um número ou gatilho ativo. */
  temAutomacao: boolean
  /** Quem está olhando a tela. */
  usuarioId: string | null
  /**
   * A janela de 24h do cliente fechou: ele escreveu por aqui e já passou um
   * dia. Ausente ou `false` quando ainda está aberta, quando não há janela
   * (chat do site) ou quando ele nunca escreveu.
   */
  janelaFechada?: boolean
}

const VOLTA_NA_PROXIMA = 'Depois de finalizar, o bot volta a responder na próxima mensagem.'

export function estadoDoAtendimento(e: EntradaDoAtendimento): Atendimento {
  return { ...decidir(e), janelaFechada: e.janelaFechada ?? false }
}

function decidir(e: EntradaDoAtendimento): Omit<Atendimento, 'janelaFechada'> {
  const donoId = e.atribuidoA
  const souDono = Boolean(e.usuarioId) && donoId === e.usuarioId

  /*
   * Esperando uma pessoa, mas o cliente já não pode receber resposta: a
   * janela de 24h fechou. "Aguardando atendente" ali era uma promessa que
   * ninguém consegue cumprir por texto (06/out). O que resta é retomar com
   * modelo aprovado ou encerrar, e o selo diz isso.
   *
   * Só quando havia gente no meio: conversa com o bot que expira não pede
   * ação de ninguém.
   */
  if (e.janelaFechada && (e.aguardando || e.sessaoComPessoa) && e.estado !== 'resolvida') {
    return {
      estado: 'expirada',
      rotulo: 'Conversa expirada',
      donoId,
      efeito:
        'O cliente não escreve há mais de 24h, e o WhatsApp só aceita retomar com um modelo aprovado. Sem o que retomar, finalize.',
      botCalado: true,
      proximaAcao: 'finalizar',
    }
  }

  if (e.aguardando) {
    return {
      estado: 'aguardando_humano',
      rotulo: 'Aguardando atendente',
      donoId,
      efeito: `O bot está pausado: o cliente pediu atendimento. ${VOLTA_NA_PROXIMA}`,
      botCalado: true,
      proximaAcao: souDono ? 'finalizar' : 'assumir',
    }
  }

  if (!e.automacaoAtiva && e.temAutomacao) {
    return {
      estado: 'com_humano',
      rotulo: 'Bot pausado',
      donoId,
      efeito: 'O bot não responde este contato até alguém religar.',
      botCalado: true,
      proximaAcao: 'religar_bot',
    }
  }

  if (e.sessaoComPessoa) {
    return {
      estado: 'com_humano',
      rotulo: 'Em atendimento',
      donoId,
      efeito: e.temAutomacao
        ? `O bot está calado enquanto a equipe atende. ${VOLTA_NA_PROXIMA}`
        : 'A equipe está atendendo.',
      botCalado: true,
      proximaAcao: donoId && !souDono ? 'assumir' : 'finalizar',
    }
  }

  if (e.estado === 'resolvida') {
    return {
      estado: 'encerrado',
      rotulo: 'Atendimento encerrado',
      donoId,
      efeito: e.temAutomacao
        ? 'Na próxima mensagem o bot volta a responder.'
        : 'Na próxima mensagem a conversa volta para a fila.',
      botCalado: false,
      proximaAcao: null,
    }
  }

  if (!e.temAutomacao) {
    return {
      estado: 'com_humano',
      rotulo: 'Atendimento manual',
      donoId,
      efeito: 'Esta conta não tem automação ligada: quem responde é a equipe.',
      botCalado: true,
      proximaAcao: donoId ? null : 'assumir',
    }
  }

  return {
    estado: 'bot',
    rotulo: 'Bot respondendo',
    donoId,
    efeito: 'O bot responde as próximas mensagens. Assumir cala o bot.',
    botCalado: false,
    proximaAcao: souDono ? null : 'assumir',
  }
}
