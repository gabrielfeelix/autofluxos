/**
 * O que a tela de Transmissões decide sem banco: o recorte da lista e a
 * próxima ação de cada transmissão (tarefa 6.3, C11 e T02).
 *
 * Os tipos são estruturais, e não os do repositório: `core` não importa de
 * `server`, e só estes campos importam aqui.
 */

type TransmissaoNaTela = {
  nome: string
  estado: string
  criadaEm: string
  quando: string | null
  erro: string | null
}

type ProgressoNaTela = { retida: number; falhou: number; na_fila: number }

export const FILTROS_DE_ESTADO = [
  'agendada',
  'enviando',
  'concluida',
  'falhou',
  'cancelada',
  'com_retidas',
  'com_falhas',
] as const
export type FiltroDeEstado = (typeof FILTROS_DE_ESTADO)[number]

export const ROTULO_DO_FILTRO: Record<FiltroDeEstado, string> = {
  agendada: 'Agendadas',
  enviando: 'Enviando',
  concluida: 'Concluídas',
  falhou: 'Pararam',
  cancelada: 'Canceladas',
  com_retidas: 'Com mensagem retida',
  com_falhas: 'Com falha',
}

export const PERIODOS = { '7d': 7, '30d': 30, '90d': 90 } as const
export type Periodo = keyof typeof PERIODOS

export const ROTULO_DO_PERIODO: Record<Periodo, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * O recorte da lista pelo que está no endereço.
 *
 * O período conta pela data da transmissão: a marcada para quando saiu, a sem
 * horário pela criação. Valor desconhecido no endereço (link velho) não
 * filtra nada, em vez de esvaziar a lista.
 */
export function filtrarTransmissoes<T extends TransmissaoNaTela>(
  lista: T[],
  progressoDe: (t: T) => ProgressoNaTela | undefined,
  filtro: { q?: string; estado?: string; periodo?: string },
  agora: Date = new Date(),
): T[] {
  const busca = semAcento((filtro.q ?? '').trim())
  const estado = FILTROS_DE_ESTADO.find((e) => e === filtro.estado)
  const dias = filtro.periodo && filtro.periodo in PERIODOS ? PERIODOS[filtro.periodo as Periodo] : null
  const desde = dias === null ? null : agora.getTime() - dias * 86_400_000

  return lista.filter((t) => {
    if (busca && !semAcento(t.nome).includes(busca)) return false
    if (desde !== null && new Date(t.quando ?? t.criadaEm).getTime() < desde) return false
    if (!estado) return true
    const progresso = progressoDe(t)
    if (estado === 'com_retidas') return (progresso?.retida ?? 0) > 0
    if (estado === 'com_falhas') return (progresso?.falhou ?? 0) > 0
    return t.estado === estado
  })
}

export type ProximaAcao = {
  texto: string
  /** Para onde ir resolver, quando existe tela para isso. */
  link?: { rotulo: string; href: string }
}

/**
 * O que fazer depois, lido do motivo gravado quando a transmissão parou e dos
 * números de agora (T02).
 *
 * "Parou" sozinho pode ser modelo pausado, número desconectado ou falha que
 * não volta; cada um pede uma coisa diferente. Os motivos são os textos que
 * `disparar-transmissao.ts` e `decidir` gravam.
 */
export function proximaAcaoDaTransmissao(
  t: TransmissaoNaTela,
  progresso: ProgressoNaTela | undefined,
  clienteId: string,
): ProximaAcao | null {
  const erro = (t.erro ?? '').toLowerCase()
  const retidas = progresso?.retida ?? 0
  const falhas = progresso?.falhou ?? 0
  const modelos = { rotulo: 'Ver os modelos', href: `/clientes/${clienteId}/transmissoes?aba=modelos` }

  if (t.estado === 'falhou') {
    if (erro.includes('modelo') && (erro.includes('pausado') || erro.includes('reprovado') || erro.includes('na meta'))) {
      return {
        texto:
          retidas > 0
            ? `A Meta pausou ou recusou o modelo. As ${retidas} retidas não foram entregues e não saem mais. Revise o modelo e crie uma transmissão nova para quem não recebeu.`
            : 'A Meta pausou ou recusou o modelo. Revise o modelo e crie uma transmissão nova para quem não recebeu.',
        link: modelos,
      }
    }
    if (erro.includes('não bate com o modelo')) {
      return {
        texto: 'O texto enviado não bate com o modelo aprovado. Confira os campos do modelo.',
        link: modelos,
      }
    }
    if (erro.includes('número de whatsapp') || erro.includes('canal conectado')) {
      return {
        texto: 'Sem um número de WhatsApp que mande modelo, nada sai. Conecte o número e crie a transmissão de novo.',
        link: { rotulo: 'Conectar o WhatsApp', href: `/clientes/${clienteId}/ajustes/whatsapp` },
      }
    }
    return {
      texto: 'Não há nova tentativa automática. Para quem não recebeu, crie uma transmissão nova.',
    }
  }

  if (retidas > 0) {
    return {
      texto: `A Meta está avaliando ${retidas} mensagens. Se ela reprovar, o modelo é pausado e elas não saem. Não há o que fazer agora além de esperar.`,
    }
  }

  if (falhas > 0 && t.estado !== 'enviando' && t.estado !== 'agendada') {
    return {
      texto: `${falhas} não receberam, e não há nova tentativa automática. O motivo de cada uma está na lista de destinatários.`,
    }
  }

  return null
}
