/**
 * Quando um acompanhamento para, e por quê (RB-47/RB-48, T7.3).
 *
 * ---------------------------------------------------------------------------
 * O defeito medido, e ele estava numa função no banco
 * ---------------------------------------------------------------------------
 *
 * `sair_das_sequencias` (0031) tirava o contato de **todas** as sequências
 * ativas, sempre, porque `sequencia_inscricoes` não tinha `cartao_id`: a
 * inscrição era do contato, ponto, e não havia como escrever outra coisa.
 *
 * Então a cliente que fechava a mensalidade (uma oportunidade, no funil
 * comercial) saía no mesmo instante do acompanhamento de pós-venda que ia
 * oferecer a avaliação física dela (outra oportunidade, outro funil). Ninguém
 * percebia: a sequência não falhava, ela "saía com motivo".
 *
 * A RB-47 é literal: "sempre no vínculo pertinente. **Compra em outra negociação
 * não encerra automaticamente toda sequência do contato.**"
 *
 * ---------------------------------------------------------------------------
 * As duas naturezas de evento, e é a distinção inteira deste arquivo
 * ---------------------------------------------------------------------------
 *
 * **Evento do contato** (respondeu, sumiu, foi atendido): é sobre a pessoa. Ela
 * voltou a falar, ou ela parou de falar. Alcança tudo, porque quem voltou a
 * falar não precisa ser lembrado de falar, qualquer que seja o acompanhamento.
 *
 * **Evento de negociação** (vendeu, perdeu, mudou de etapa): é sobre *aquele*
 * negócio. Alcança a inscrição daquela negociação, e as que são do contato, e
 * **não** as de outras negociações.
 *
 * Por que a inscrição do contato também sai quando a venda é de um cartão: uma
 * régua de recompra é do contato, e quem acabou de comprar não pode receber "faz
 * tempo que você não compra". A que fica de pé é a que fala de **outra**
 * negociação, e é exatamente a que o defeito estava matando.
 *
 * Puro, sem banco e sem React. Quem grava é `repos/sequencias.ts`, e a decisão
 * final é do `sair_das_sequencias` da 0085: este arquivo é quem a explica e a
 * testa sem subir Postgres.
 */

// ---------------------------------------------------------------------------
// 1. Os eventos que encerram
// ---------------------------------------------------------------------------

/**
 * O que pode tirar alguém de um acompanhamento.
 *
 * A lista é fechada e o tipo sai dela, como em `core/permissoes.ts`: evento novo
 * é uma linha aqui, e o TypeScript passa a cobrar quem precisa decidir sobre ele.
 */
export const EVENTOS_DE_SAIDA = [
  /** A pessoa respondeu. O acompanhamento cumpriu o objetivo dele. */
  'respondeu',
  /** Alguém da equipe assumiu a conversa. */
  'atendimento_humano',
  /** A automação foi pausada para este contato (o "AutoOff"). */
  'automacao_pausada',
  /** Vendeu naquela negociação. */
  'vendeu',
  /** Perdeu naquela negociação. */
  'perdeu',
  /** A negociação andou de etapa. */
  'mudou_de_etapa',
] as const

export type EventoDeSaida = (typeof EVENTOS_DE_SAIDA)[number]

/**
 * Este evento é sobre a **pessoa** ou sobre **um negócio**?
 *
 * É a única pergunta que decide o alcance, e está escrita numa função para ter
 * onde ser testada: espalhada em `if` pelos chamadores, ela divergiria no
 * primeiro evento novo.
 */
export function ehDoContato(evento: EventoDeSaida): boolean {
  return evento === 'respondeu' || evento === 'atendimento_humano' || evento === 'automacao_pausada'
}

/** A frase que a ficha mostra. Diz o que aconteceu, não o código do evento. */
export const FRASE_DA_SAIDA: Record<EventoDeSaida, string> = {
  respondeu: 'saiu porque a pessoa respondeu',
  atendimento_humano: 'pausado: alguém da equipe assumiu a conversa',
  automacao_pausada: 'pausado: a automação está desligada para este contato',
  vendeu: 'saiu porque a venda foi registrada',
  perdeu: 'saiu porque a negociação foi marcada como perdida',
  mudou_de_etapa: 'saiu porque a negociação mudou de etapa',
}

// ---------------------------------------------------------------------------
// 2. Quem este evento alcança
// ---------------------------------------------------------------------------

/** Uma inscrição, do pouco que decidir a saída precisa saber dela. */
export type InscricaoParaSaida = {
  id: string
  /** `null` = a inscrição é do contato, e não de negociação nenhuma. */
  cartaoId: string | null
}

/**
 * Esta inscrição sai por causa deste evento?
 *
 * ---------------------------------------------------------------------------
 * A tabela inteira, porque ela é a regra
 * ---------------------------------------------------------------------------
 *
 * ```
 * evento            inscrição do contato   inscrição do cartão X   do cartão Y
 * respondeu             sai                    sai                   sai
 * vendeu (no X)         sai                    sai                   FICA  <- o defeito
 * ```
 *
 * A última célula é o ponto inteiro da tarefa: era `sai`, e cada vez que era
 * `sai` alguém perdeu um acompanhamento que ninguém mandou parar.
 */
export function alcanca(
  evento: EventoDeSaida,
  inscricao: InscricaoParaSaida,
  /** Em qual negociação o evento aconteceu. `null` para evento do contato. */
  cartaoDoEvento: string | null,
): boolean {
  // Evento sobre a pessoa: alcança tudo.
  if (ehDoContato(evento)) return true

  /*
   * Evento de negociação sem negociação identificada.
   *
   * **Alcança tudo**, e é o lado conservador: acontece quando a venda é avulsa
   * (RB-05 abre uma oportunidade mínima, mas o caminho antigo pode não ter
   * cartão) ou quando quem chamou não sabia dizer. Tratar como "não alcança
   * nada" deixaria alguém que acabou de comprar recebendo régua de recompra, que
   * é o erro mais visível dos dois.
   */
  if (cartaoDoEvento === null) return true

  // A inscrição é do contato: sai. Régua de recompra não fala com quem acabou de
  // comprar.
  if (inscricao.cartaoId === null) return true

  // A inscrição é daquela negociação: sai. De outra: fica.
  return inscricao.cartaoId === cartaoDoEvento
}

/** Quais destas inscrições este evento encerra. */
export function inscricoesAlcancadas(
  evento: EventoDeSaida,
  inscricoes: readonly InscricaoParaSaida[],
  cartaoDoEvento: string | null,
): InscricaoParaSaida[] {
  return inscricoes.filter((inscricao) => alcanca(evento, inscricao, cartaoDoEvento))
}

// ---------------------------------------------------------------------------
// 3. A retomada
// ---------------------------------------------------------------------------

/**
 * O prazo do próximo passo ao retomar (RB-48, UI-24).
 *
 * ---------------------------------------------------------------------------
 * O erro que esta função existe para não cometer
 * ---------------------------------------------------------------------------
 *
 * A RB-48: "a retomada autorizada mostra o próximo passo e **recalcula o prazo a
 * partir do momento atual**, sem disparar de uma vez todos os passos vencidos".
 *
 * A conta ingênua é `entrouEm + atraso`, que é o que a sequência usa enquanto
 * ela corre (e está certo lá: recontar a cada passo empurraria a sequência
 * inteira para a frente a cada atraso do agendador). Mas numa inscrição que
 * ficou **pausada três semanas** durante um atendimento, `entrouEm + atraso` já
 * passou para todos os passos de uma vez: retomar dispararia quatro mensagens no
 * mesmo minuto, no WhatsApp de alguém que acabou de ser atendido.
 *
 * Então na retomada o relógio começa **agora**. O acompanhamento perde a
 * cadência original, e é o preço certo: a alternativa é um jorro de mensagens.
 */
export function quandoRetomar(
  /** O atraso do próximo passo, em minutos, como a sequência o declara. */
  atrasoEmMinutos: number,
  agora: Date = new Date(),
): Date {
  const minutos = Number.isFinite(atrasoEmMinutos) ? Math.max(0, atrasoEmMinutos) : 0
  return new Date(agora.getTime() + minutos * 60_000)
}

/**
 * Esta inscrição pode ser retomada?
 *
 * ---------------------------------------------------------------------------
 * Por que `saiu` não volta, e `bloqueada` volta
 * ---------------------------------------------------------------------------
 *
 * Os quatro estados de `sequencia_inscricoes` não são iguais aos olhos da
 * retomada, e a diferença é **quem decidiu parar**:
 *
 *   - `concluida`: a sequência entregou tudo. Não há próximo passo para retomar;
 *   - `saiu`: alguma coisa **aconteceu** e a regra encerrou (a pessoa respondeu,
 *     vendeu, foi atendida). Retomar aqui é reinscrever, e a RB-47 é explícita:
 *     "a pessoa pode ser reinscrita por ação/regra explícita, **nunca por mera
 *     reentrega do evento**". Reinscrever é outro gesto, com outro botão;
 *   - `bloqueada`: a sequência **não entregou** porque a janela de 24h fechou.
 *     É o único estado que significa "falhou", e é o que a retomada serve para
 *     consertar: a janela reabriu, o passo pode sair;
 *   - `ativa`: não precisa de retomada.
 */
export function podeRetomar(estado: string): boolean {
  return estado === 'bloqueada'
}

/** Por que esta inscrição não pode ser retomada. Frase, para a tela. */
export function porQueNaoRetoma(estado: string): string | null {
  if (podeRetomar(estado)) return null
  if (estado === 'ativa') return 'este acompanhamento já está correndo'
  if (estado === 'concluida') return 'este acompanhamento chegou ao fim: não há próximo passo'
  if (estado === 'saiu') {
    return 'este acompanhamento foi encerrado por uma regra. Para falar de novo com esta pessoa, inscreva-a outra vez, de propósito.'
  }
  return 'este acompanhamento não pode ser retomado'
}

// ---------------------------------------------------------------------------
// 4. A prioridade humana
// ---------------------------------------------------------------------------

/**
 * O envio automático pode sair agora? (RB-48)
 *
 * "Durante atendimento humano ou pausa persistente, suspender envios automáticos
 * conflitantes. **Encerrar atendimento não retoma uma sequência sozinho.**"
 *
 * A segunda frase é a que engana: parece gentileza retomar o acompanhamento
 * quando o atendimento termina, e é armadilha. Quem foi atendido por uma pessoa
 * já teve o assunto resolvido ali; o passo que estava na fila foi escrito para
 * quem **não** respondeu, e chegaria contradizendo a conversa que acabou de
 * acontecer.
 *
 * Esta função é conferida **no instante do envio**, e não no agendamento: é a
 * mesma lição de `enviar-agendadas` e a razão de a RB-48 dizer "inclusive em jobs
 * já enfileirados". O relógio corre entre agendar e mandar.
 */
export function podeEnviarAutomatico({
  atendimentoHumano,
  automacaoPausada,
  inscricaoAtiva,
}: {
  atendimentoHumano: boolean
  automacaoPausada: boolean
  inscricaoAtiva: boolean
}): { pode: true } | { pode: false; motivo: string } {
  if (!inscricaoAtiva) {
    return { pode: false, motivo: 'a inscrição não está mais ativa' }
  }
  if (atendimentoHumano) {
    return { pode: false, motivo: 'alguém da equipe está atendendo esta conversa' }
  }
  if (automacaoPausada) {
    return { pode: false, motivo: 'a automação está desligada para este contato' }
  }
  return { pode: true }
}
