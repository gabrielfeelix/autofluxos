/**
 * A agenda humana (0081, T5.3).
 *
 * ---------------------------------------------------------------------------
 * A regra que este arquivo existe para sustentar: lembrete não é envio
 * ---------------------------------------------------------------------------
 *
 * RB-33, inteira: "criar atividade não agenda WhatsApp". Três coisas que a
 * tela de hoje confunde, e que aqui têm nomes diferentes:
 *
 *   - **atividade**: alguém faz alguma coisa. Ninguém recebe nada.
 *   - **adiamento da conversa** (`contacts.adiada_ate`): a conversa sai da
 *     fila do atendimento por um tempo. O cliente não é avisado.
 *   - **mensagem agendada** (`mensagens_agendadas`, 0057): o sistema manda
 *     texto para o cliente numa hora marcada.
 *
 * Não há função neste arquivo que produza mensagem, e isso é deliberado: a
 * separação vale mais escrita no schema e no tipo do que num comentário de
 * tela, que alguém apaga.
 *
 * Puro e sem rede. Quem grava é `server/repos/atividades.ts`.
 */

export const TIPOS_DE_ATIVIDADE = ['tarefa', 'ligacao', 'reuniao', 'visita', 'proposta'] as const

export type TipoDeAtividade = (typeof TIPOS_DE_ATIVIDADE)[number]

export function ehTipoDeAtividade(valor: unknown): valor is TipoDeAtividade {
  return typeof valor === 'string' && (TIPOS_DE_ATIVIDADE as readonly string[]).includes(valor)
}

/** Como cada tipo se chama na tela. Minúsculo: é rótulo, não título. */
export const NOME_DO_TIPO: Record<TipoDeAtividade, string> = {
  tarefa: 'tarefa',
  ligacao: 'ligação',
  reuniao: 'reunião',
  visita: 'visita',
  proposta: 'proposta',
}

/**
 * O que cada tipo pede de diferente na tela.
 *
 * O seletor de tipo era decorativo: os cinco davam o mesmo formulário, e o link
 * de uma reunião acabava espremido no título. Aqui cada tipo diz o que precisa,
 * e a tela monta os campos a partir disto em vez de espalhar `if` por JSX.
 *
 * `onde` é um campo só para link, endereço e telefone porque nenhuma atividade
 * tem dois desses. `null` em `onde` é o caso da tarefa, que não acontece em
 * lugar nenhum: ela é só uma coisa a fazer.
 */
export type FormatoDoTipo = {
  /** O que pedir no campo do título. */
  placeholder: string
  /** Rótulo e dica do campo `onde`. `null` quando o tipo não usa. */
  onde: { rotulo: string; placeholder: string } | null
  /** `true` quando a hora importa: ligação e reunião acontecem numa hora. */
  pedeHora: boolean
}

export const FORMATO_DO_TIPO: Record<TipoDeAtividade, FormatoDoTipo> = {
  tarefa: {
    placeholder: 'o que precisa ser feito',
    onde: null,
    pedeHora: false,
  },
  ligacao: {
    placeholder: 'sobre o que é a ligação',
    onde: { rotulo: 'Telefone', placeholder: 'se for diferente do WhatsApp' },
    pedeHora: true,
  },
  reuniao: {
    placeholder: 'assunto da reunião',
    onde: { rotulo: 'Link ou lugar', placeholder: 'meet.google.com/… ou o endereço' },
    pedeHora: true,
  },
  visita: {
    placeholder: 'objetivo da visita',
    onde: { rotulo: 'Endereço', placeholder: 'onde ir' },
    pedeHora: true,
  },
  proposta: {
    placeholder: 'o que propor',
    onde: null,
    pedeHora: false,
  },
}

export const SITUACOES = ['aberta', 'concluida', 'cancelada'] as const

export type SituacaoDaAtividade = (typeof SITUACOES)[number]

export type Atividade = {
  id: string
  contatoId: string
  /** A oportunidade, quando houver. `null` = atividade solta do contato. */
  cartaoId: string | null
  tipo: TipoDeAtividade
  titulo: string
  nota: string | null
  /**
   * Onde a atividade acontece: o link da reunião, o endereço da visita, o
   * telefone da ligação. Um campo só porque nenhuma atividade tem dois desses,
   * e `null` na tarefa, que não acontece em lugar nenhum.
   */
  onde: string | null
  /**
   * `true` quando o prazo tem hora combinada.
   *
   * `prazo` é um instante e **sempre** carrega uma hora, mesmo quando ninguém
   * escolheu nenhuma, então só este campo distingue "ligar às 14h" de
   * "proposta para o dia 22". Sem ele a tela mostraria 12:00 para todo mundo.
   */
  horaMarcada: boolean
  /** `null` é "algum dia", e é resposta legítima. */
  prazo: string | null
  responsavelId: string | null
  responsavelNome: string | null
  situacao: SituacaoDaAtividade
  concluidaEm: string | null
  motivoDoCancelamento: string | null
  criadoEm: string
}

export const LIMITE_DO_TITULO = 120

export type Conferencia = { ok: true; titulo: string } | { ok: false; motivo: string }

export function conferirTitulo(bruto: string): Conferencia {
  const titulo = bruto.trim()
  if (titulo === '') return { ok: false, motivo: 'escreva o que precisa ser feito' }
  if (titulo.length > LIMITE_DO_TITULO) {
    return { ok: false, motivo: `o título cabe em ${LIMITE_DO_TITULO} caracteres` }
  }
  return { ok: true, titulo }
}

// ---------------------------------------------------------------------------
// Vencida, hoje, futura: a régua da agenda
// ---------------------------------------------------------------------------

export type Urgencia = 'vencida' | 'hoje' | 'futura' | 'sem-prazo'

/**
 * Quão urgente é esta atividade.
 *
 * **Sem prazo não é vencida.** Parece óbvio e é o erro fácil: tratar `null`
 * como "vencida desde sempre" encheria a agenda de vermelho no primeiro dia e
 * ensinaria todo mundo a ignorar o vermelho. "Algum dia" é uma escolha, e a
 * tela precisa respeitá-la.
 *
 * A comparação é por **dia**, e não por instante: uma atividade marcada para
 * hoje às 9h não fica vermelha às 9h01. Quem marcou para hoje quis dizer hoje.
 */
export function urgenciaDe(
  atividade: Pick<Atividade, 'prazo' | 'situacao'>,
  agora: number = Date.now(),
): Urgencia {
  if (atividade.situacao !== 'aberta') return 'futura'
  if (!atividade.prazo) return 'sem-prazo'

  const prazo = new Date(atividade.prazo)
  if (Number.isNaN(prazo.getTime())) return 'sem-prazo'

  const hoje = new Date(agora)
  const diaDoPrazo = Date.UTC(prazo.getUTCFullYear(), prazo.getUTCMonth(), prazo.getUTCDate())
  const diaDeHoje = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())

  if (diaDoPrazo < diaDeHoje) return 'vencida'
  if (diaDoPrazo === diaDeHoje) return 'hoje'
  return 'futura'
}

/**
 * A próxima ação de um contato, para a ficha e para o cartão.
 *
 * Só atividades **abertas** concorrem, e sem prazo perde para com prazo: a
 * pergunta que a ficha responde é "o que está marcado", e um "algum dia"
 * aparecendo como próxima ação esconderia a reunião de amanhã.
 */
export function proximaAcao(atividades: readonly Atividade[]): Atividade | null {
  const abertas = atividades.filter((a) => a.situacao === 'aberta')
  if (abertas.length === 0) return null

  const comPrazo = abertas.filter((a) => a.prazo)
  if (comPrazo.length === 0) return abertas[0] ?? null

  return comPrazo.reduce((maisCedo, atual) =>
    (atual.prazo ?? '') < (maisCedo.prazo ?? '') ? atual : maisCedo,
  )
}

/**
 * O que fazer com as atividades abertas ao fechar uma oportunidade (RB-28).
 *
 * As três escolhas são oferecidas, e **nenhuma é automática**: marcar todas
 * como feitas ao ganhar inventaria trabalho que ninguém fez, e cancelá-las em
 * silêncio apagaria compromisso assumido com o cliente. Se mantidas, continuam
 * aparecendo na agenda, o que é o comportamento certo para a visita que
 * continua marcada mesmo depois da venda fechada.
 */
export const DESTINOS_AO_FECHAR = ['manter', 'concluir', 'cancelar'] as const

export type DestinoAoFechar = (typeof DESTINOS_AO_FECHAR)[number]

export function ehDestinoAoFechar(valor: unknown): valor is DestinoAoFechar {
  return typeof valor === 'string' && (DESTINOS_AO_FECHAR as readonly string[]).includes(valor)
}
