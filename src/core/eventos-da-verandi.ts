/**
 * Os avisos da Verandi como o AutoFluxos os entende (a ponte entre os dois).
 *
 * A Verandi manda `{ evento, eventoId, criadoEm, dados }`, assinado com
 * `instante.corpo`, e é ela quem decide o que vai em `dados`: quem, qual
 * aula, que dia, que horas. Aqui isso vira duas coisas que o fluxo usa:
 * para quem falar (o telefone) e as variáveis da mensagem (`{{aula_hora}}`).
 *
 * Aula cancelada pela casa é um evento com a turma inteira dentro
 * (`dados.alunos`), e vira uma conversa por aluno.
 */

export type EventoDaVerandi = {
  evento: string
  rotulo: string
  descricao: string
}

/** Os que existem hoje, na ordem em que aparecem para escolher. */
export const EVENTOS_DA_VERANDI: readonly EventoDaVerandi[] = [
  {
    evento: 'presenca.falta',
    rotulo: 'Aluno faltou sem avisar',
    descricao: 'A chamada marcou falta. Boa hora para perguntar se está tudo bem e oferecer a reposição.',
  },
  {
    evento: 'sessao.cancelada',
    rotulo: 'Aula cancelada pelo estúdio',
    descricao: 'Avisa cada aluno da turma, com o dia e a hora, antes de ele sair de casa.',
  },
  {
    evento: 'vaga.aberta',
    rotulo: 'Abriu vaga em horário com fila',
    descricao: 'Chama quem estava na espera daquele horário.',
  },
  {
    evento: 'participacao.criada',
    rotulo: 'Aula marcada',
    descricao: 'Confirma a aula na conversa, com o dia, a hora e quem dá.',
  },
  {
    evento: 'participacao.cancelada',
    rotulo: 'Aluno desmarcou',
    descricao: 'A pessoa avisou que não vai. Confirma e diz se ficou reposição.',
  },
]

/** As variáveis que todo aviso de aula leva para o fluxo. */
export const VARIAVEIS_DA_VERANDI = ['aluno_nome', 'aula_dia', 'aula_data', 'aula_hora', 'aula_servico', 'aula_professor'] as const

export function rotuloDoEventoDaVerandi(evento: string): string | null {
  return EVENTOS_DA_VERANDI.find((e) => e.evento === evento)?.rotulo ?? null
}

export type Destinatario = { telefone: string; variaveis: Record<string, string> }

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/** `2026-10-23` vira `23/10` e `sexta`; o resto passa como veio. */
function variaveisDaAula(dados: Record<string, unknown>): Record<string, string> {
  const vars: Record<string, string> = {}
  const data = texto(dados.data)
  if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [a, m, d] = data.split('-').map(Number) as [number, number, number]
    vars.aula_data = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
    vars.aula_dia = DIAS[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]!
  }
  const hora = texto(dados.hora)
  if (hora) vars.aula_hora = hora
  const servico = texto(dados.servico)
  if (servico) vars.aula_servico = servico
  const professor = texto(dados.profissional)
  if (professor) vars.aula_professor = professor
  return vars
}

/**
 * Para quem falar e com que variáveis. Telefone ausente some da lista: não há
 * por onde avisar, e quem decide o que fazer com isso é a Verandi, que tem o
 * cadastro.
 */
export function destinatariosDoEvento(evento: string, dados: Record<string, unknown>): Destinatario[] {
  const aula = variaveisDaAula(dados)
  if (evento === 'sessao.cancelada') {
    const alunos = Array.isArray(dados.alunos) ? (dados.alunos as Record<string, unknown>[]) : []
    return alunos.flatMap((a) => {
      const telefone = texto(a?.telefone)
      if (!telefone) return []
      const nome = texto(a.pessoa)
      return [{ telefone, variaveis: { ...aula, ...(nome ? { aluno_nome: nome } : {}), tem_reposicao: a.reposicao === true ? 'sim' : 'não' } }]
    })
  }
  const telefone = texto(dados.telefone)
  if (!telefone) return []
  const nome = texto(dados.pessoa)
  return [{ telefone, variaveis: { ...aula, ...(nome ? { aluno_nome: nome } : {}) } }]
}
