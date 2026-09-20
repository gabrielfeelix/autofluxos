/**
 * Quem está conduzindo a conversa, e o que isso autoriza.
 *
 * ---------------------------------------------------------------------------
 * O defeito que este arquivo fecha
 * ---------------------------------------------------------------------------
 *
 * `atribuirContato` é um `update` sem condição: ele grava o responsável novo e
 * responde `true`. Quer dizer que **dois atendentes clicando em "Assumir" ao
 * mesmo tempo os dois recebem sucesso**, e quem gravou por último fica com a
 * conversa. O outro vê a tela dizer que assumiu, começa a digitar, e a resposta
 * sai assinada por ele numa conversa que é de outra pessoa.
 *
 * É a RB-14: "Dois atendentes disputando o mesmo atendimento recebem resultado
 * consistente: apenas um assume a versão atual; o outro vê quem assumiu... Não
 * aceitar alteração baseada em estado antigo."
 *
 * O conserto tem duas metades, e esta é a de cima: **a decisão é pura**, para
 * poder ser testada sem banco, e a de baixo é um `update` condicionado que a
 * aplica atomicamente (`assumirAtendimento`, em `repos/conversas.ts`). Sem a
 * condição no `update`, nenhuma decisão em memória resolve: entre ler e gravar
 * cabe o clique do colega.
 *
 * ---------------------------------------------------------------------------
 * E a segunda pergunta: a execução que estava no ar
 * ---------------------------------------------------------------------------
 *
 * Uma resposta de IA ou uma chamada HTTP leva segundos. Se alguém assumir nesse
 * intervalo, a resposta que volta foi autorizada por um estado que não existe
 * mais, e enviá-la é o bot falando por cima de quem acabou de pegar a conversa.
 *
 * É a RB-15: "Assumir invalida a autorização da execução anterior. Respostas de
 * IA/HTTP que terminarem depois não podem enviar mensagens... sem verificar
 * novamente o controle."
 *
 * A prova é a **revisão**: um número que muda a cada troca de controle. Quem
 * começa uma execução anota a revisão do momento; quem vai enviar confere se
 * ela ainda é a mesma. Não é relógio, de propósito: duas trocas no mesmo
 * milissegundo dariam o mesmo instante, e a comparação passaria.
 */

/** Quem conduz a conversa agora. */
export type Conducao =
  /** O bot está conduzindo. */
  | 'bot'
  /** Ninguém conduz: a conversa espera uma pessoa da equipe. */
  | 'aguardando'
  /** Uma pessoa assumiu e está atendendo. */
  | 'humano'
  /** Encerrada: não há condução ativa. */
  | 'sem_conducao'

export type Controle = {
  conducao: Conducao
  /** Quem assumiu, quando alguém assumiu. */
  responsavelId: string | null
  /**
   * A revisão do controle. Sobe a cada troca.
   *
   * Número e não data: ver o cabeçalho. Duas trocas no mesmo milissegundo
   * dariam o mesmo instante e a comparação passaria batida.
   */
  revisao: number
}

/** O que uma tentativa de assumir respondeu. */
export type ResultadoDaTomada =
  | { ok: true; controle: Controle }
  /**
   * Perdeu a corrida. `responsavelId` é quem ficou com ela, para a tela poder
   * dizer **quem** assumiu em vez de um "não deu" que não ajuda ninguém.
   */
  | { ok: false; motivo: 'ja_assumida'; responsavelId: string }
  | { ok: false; motivo: 'ja_e_sua'; responsavelId: string }

/**
 * Pode esta pessoa assumir este controle?
 *
 * **Devolve objeto, nunca booleano.** A tela precisa de "a Ana assumiu há um
 * minuto", e um `false` não carrega isso. Ver também a armadilha do handoff da
 * F2: `if (!objeto)` é sempre falso e o typecheck não avisa.
 */
export function tentarAssumir(controle: Controle, usuarioId: string): ResultadoDaTomada {
  /*
   * Já é dela: não é erro e não é sucesso silencioso. Dizer "já é sua" é o que
   * impede a tela de piscar um sucesso que não mudou nada — e impede a revisão
   * de subir por um clique repetido, que invalidaria a execução em andamento
   * da própria pessoa sem motivo.
   */
  if (controle.responsavelId === usuarioId && controle.conducao === 'humano') {
    return { ok: false, motivo: 'ja_e_sua', responsavelId: usuarioId }
  }

  /*
   * Alguém já assumiu. Quem chegou depois **não** toma por cima: a saída dele é
   * transferir, que é ação explícita, com motivo, e exige permissão. É a RB-14:
   * "o outro vê quem assumiu e pode solicitar/realizar transferência".
   */
  if (controle.conducao === 'humano' && controle.responsavelId !== null) {
    return { ok: false, motivo: 'ja_assumida', responsavelId: controle.responsavelId }
  }

  return { ok: true, controle: comNovoControle(controle, 'humano', usuarioId) }
}

/**
 * Transferir: a saída de quem perdeu a corrida, e a de quem precisa passar.
 *
 * Diferente de assumir, ela **vence** um responsável existente: é ação
 * deliberada de quem tem permissão, não uma corrida. O bot segue calado, que é
 * o que a tabela de ações da proposta exige ("mantém bot pausado").
 */
export function transferir(controle: Controle, paraUsuarioId: string): Controle {
  return comNovoControle(controle, 'humano', paraUsuarioId)
}

/**
 * Devolver à fila.
 *
 * **Nunca reinicia o bot**, e é a RB-16 literal. A condução vai para
 * `aguardando`, não para `bot`: a conversa perde o dono pessoal e continua
 * esperando gente. Quem quiser o bot de volta usa "Retomar chatbot", que é
 * outra ação, explícita.
 */
export function devolverAFila(controle: Controle): Controle {
  return comNovoControle(controle, 'aguardando', null)
}

/**
 * Retomar o chatbot. Ação explícita, e é o único caminho de volta para `bot`.
 */
export function retomarBot(controle: Controle): Controle {
  return comNovoControle(controle, 'bot', null)
}

/** Encerrar: sem condução ativa, e sem dono. */
export function encerrar(controle: Controle): Controle {
  return comNovoControle(controle, 'sem_conducao', null)
}

function comNovoControle(
  controle: Controle,
  conducao: Conducao,
  responsavelId: string | null,
): Controle {
  return { conducao, responsavelId, revisao: controle.revisao + 1 }
}

/**
 * A execução que começou com esta revisão ainda pode enviar? (RB-15)
 *
 * Chamada **imediatamente antes** do envio, e não no início da execução: o
 * intervalo entre decidir e enviar é exatamente onde o clique do colega cabe.
 *
 * Revisão ausente responde `false`. Uma execução que não anotou a revisão não
 * tem como provar que foi autorizada, e o lado seguro de errar é a mensagem não
 * sair: uma resposta perdida alguém reenvia, uma resposta do bot por cima de um
 * atendente humano é a empresa falando duas coisas ao mesmo tempo com o cliente.
 */
export function aindaAutorizada(controle: Controle, revisaoDaExecucao: number | null | undefined): boolean {
  if (typeof revisaoDaExecucao !== 'number') return false
  return revisaoDaExecucao === controle.revisao
}

/**
 * O que a tela mostra como condução principal.
 *
 * Um indicador só, e é decisão da proposta: "um indicador principal no
 * cabeçalho". Espalhar situação, condução e responsável em três selos faz a
 * pessoa ler três coisas para responder uma pergunta.
 */
export function comoConducao(controle: Controle): string {
  switch (controle.conducao) {
    case 'bot':
      return 'Chatbot'
    case 'aguardando':
      return 'Aguardando equipe'
    case 'humano':
      return 'Em atendimento'
    case 'sem_conducao':
      return 'Sem condução'
  }
}
