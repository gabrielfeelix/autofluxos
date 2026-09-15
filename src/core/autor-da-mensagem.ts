import { nomeCurto } from './atendente'

/**
 * Quem produziu a mensagem que saiu.
 *
 * ---------------------------------------------------------------------------
 * Por que dentro do `payload`, e não numa coluna
 * ---------------------------------------------------------------------------
 *
 * Coluna seria mais limpa, e um dia será. Hoje ela custa uma migration no banco
 * de **produção compartilhado com a Verandi** (ver `docs/BANCO-COMPARTILHADO.md`)
 * para resolver um rótulo de dez pixels — e migration lá não se aplica sem
 * autorização explícita do dono, o que transformaria uma melhoria de tela numa
 * espera.
 *
 * O `payload` já é nosso e já guarda o que a bolha precisa para se desenhar
 * (`midia`, `url`, `local`, `cartoes`). O autor é a mesma categoria de coisa:
 * informação de como desenhar aquela linha. Quando o agendamento pedir a
 * `0057` de qualquer jeito, isto aqui vira coluna e a leitura continua sendo
 * por esta função — que é o motivo de a leitura morar num lugar só.
 *
 * ---------------------------------------------------------------------------
 * O que "ausente" significa, e por que ele não vira "atendimento"
 * ---------------------------------------------------------------------------
 *
 * Mensagem sem autor é de antes disto existir, ou é o eco do que o dono mandou
 * pelo celular — e nesses dois casos **ninguém sabe** quem escreveu. A bolha
 * então não diz nada e mostra só a hora.
 *
 * O rótulo que estava lá era "atendimento", em toda mensagem que saía, do bot
 * ou de gente. Ele não dizia nada e parecia dizer: o dono leu a tela e
 * perguntou o que aquela palavra significava. Rótulo que precisa ser explicado
 * é pior do que rótulo nenhum.
 */
export type AutorDaSaida =
  | { tipo: 'pessoa'; id: string | null; nome: string }
  | { tipo: 'automacao' }

/** O bot. Constante porque não há nada para variar, e para não escrever a string em cinco lugares. */
export const AUTOR_AUTOMACAO: AutorDaSaida = { tipo: 'automacao' }

/** Quem atende, a partir da sessão. `null` quando a sessão não tem usuário (entrada por senha única). */
export function autorDaPessoa(
  usuario: { id?: string | null; nome?: string | null } | null | undefined,
): AutorDaSaida | null {
  const nome = (usuario?.nome ?? '').trim()
  if (nome === '') return null
  return { tipo: 'pessoa', id: usuario?.id ?? null, nome }
}

/** O que está gravado, de volta ao formato — ou `null` se não há nada confiável ali. */
export function autorDoPayload(payload: unknown): AutorDaSaida | null {
  if (!payload || typeof payload !== 'object') return null
  const bruto = (payload as { autor?: unknown }).autor
  if (!bruto || typeof bruto !== 'object') return null

  const autor = bruto as Record<string, unknown>
  if (autor.tipo === 'automacao') return AUTOR_AUTOMACAO
  if (autor.tipo === 'pessoa' && typeof autor.nome === 'string' && autor.nome.trim() !== '') {
    return {
      tipo: 'pessoa',
      id: typeof autor.id === 'string' ? autor.id : null,
      nome: autor.nome,
    }
  }
  return null
}

/**
 * O rótulo embaixo da bolha. `null` = não escreva nada.
 *
 * "automação" em minúscula e sem enfeite: é um estado, não um nome próprio, e
 * ele divide a linha com a hora.
 */
export function comoChamarOAutor(autor: AutorDaSaida | null): string | null {
  if (!autor) return null
  if (autor.tipo === 'automacao') return 'automação'
  return nomeCurto(autor.nome) || null
}
