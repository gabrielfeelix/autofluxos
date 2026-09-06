import { atendimentoAberto, type HorarioDeAtendimento } from './horario'

/**
 * Quem é avisado quando o bot passa uma conversa para uma pessoa.
 *
 * **O elo mais fraco do produto**, nas palavras do `PLANO-SISTEMA` §3.10.1, e
 * ele continua verdade até esta rodada: `NotificacoesDaFila` consulta a cada
 * 30s e avisa **quem está com o painel aberto**. Fora disso o bot transfere,
 * ninguém percebe, e o cliente descobre pelo lead reclamando.
 *
 * Este módulo é só a decisão — puro, sem banco e sem rede. O envio mora em
 * `server/avisar-handoff.ts`. Estão separados porque a decisão é a parte que
 * erra caro e em silêncio: avisar às 3h da manhã é a forma mais rápida de
 * fazer alguém desligar o aviso para sempre, e aí o produto volta a ter o
 * buraco que esta rodada fecha — só que agora sem ninguém saber.
 */

/** Um membro da conta, do ponto de vista de quem decide o aviso. */
export type CandidatoAoAviso = {
  usuarioId: string
  email: string
  nome: string | null
  /** `dono`, `admin`, `atendente`... Ver `repos/usuarios`. */
  papel: string | null
  /** `disponivel` ou `ausente`. `null` = nunca marcou. */
  presenca: string | null
}

/**
 * Os papéis que atendem — que hoje são **todos** os que existem.
 *
 * Os três valores vêm do plugin de organização do Better Auth e são em inglês:
 * `owner`, `admin`, `member` (ver `acoes-conta.ts:403`). Escrevê-los em
 * português aqui teria filtrado a conta inteira: em produção, os quatro
 * membros existentes são `owner`, e nenhum deles receberia aviso nenhum. O
 * defeito passaria nos testes e apareceria como conversa sem resposta.
 *
 * A lista existe mesmo assim — e não um `return true` — porque um papel que
 * não atende (só leitura, faturamento) é o tipo de coisa que nasce depois, e
 * quando nascer o lugar de decidir isto já está escrito.
 *
 * `null` entra pelo mesmo motivo: papel desconhecido avisa. Errar avisando
 * alguém a mais é ruído; errar calando é a conversa que ninguém atendeu.
 */
const PAPEIS_QUE_ATENDEM = new Set(['owner', 'admin', 'member'])

export type DecisaoDoAviso =
  | { avisar: false; motivo: 'fora-do-horario' | 'ninguem-disponivel' | 'conta-sem-membro' }
  | { avisar: true; destinatarios: CandidatoAoAviso[] }

export function quemAvisar(
  candidatos: CandidatoAoAviso[],
  horario: HorarioDeAtendimento,
  agora: Date = new Date(),
): DecisaoDoAviso {
  /*
   * O horário vem primeiro, e é uma decisão sobre a conta inteira.
   *
   * Alguém que esqueceu o navegador aberto marcado como `disponivel` às 3h da
   * manhã não é motivo para o telefone dele tocar: o horário de atendimento é
   * o que a conta declarou sobre quando existe gente para atender, e é mais
   * confiável do que um estado de presença que ninguém lembrou de trocar.
   */
  if (!atendimentoAberto(horario, agora)) return { avisar: false, motivo: 'fora-do-horario' }

  const daEquipe = candidatos.filter((c) => c.papel === null || PAPEIS_QUE_ATENDEM.has(c.papel))
  if (daEquipe.length === 0) return { avisar: false, motivo: 'conta-sem-membro' }

  /*
   * Presença: `ausente` é escolha explícita e vale. `null` **não** é ausência.
   *
   * Quem nunca abriu o seletor de presença tem `null`, que é a maioria das
   * contas hoje. Tratar isso como ausente entregaria a rodada inteira sem
   * avisar ninguém, e o teste passaria: é o tipo de bug que só aparece em
   * produção, como conversa que ninguém atendeu.
   */
  const disponiveis = daEquipe.filter((c) => c.presenca !== 'ausente')
  if (disponiveis.length === 0) return { avisar: false, motivo: 'ninguem-disponivel' }

  return { avisar: true, destinatarios: disponiveis }
}

/**
 * O texto do aviso.
 *
 * Curto de propósito: ele é lido numa tira de notificação de celular, onde o
 * sistema corta o resto. O nome de quem está esperando vem primeiro porque é o
 * que decide se a pessoa larga o que está fazendo.
 *
 * **Não leva o conteúdo da conversa.** A notificação atravessa o servidor de
 * push do fabricante do navegador; o motivo do handoff é nosso, a mensagem do
 * lead é dele.
 */
export function textoDoAviso(nome: string | null, motivo: string) {
  const quem = (nome ?? '').trim() || 'Um contato'
  return {
    titulo: `${quem} está esperando atendimento`,
    corpo: motivo.trim() || 'o bot passou a conversa para uma pessoa',
  }
}
