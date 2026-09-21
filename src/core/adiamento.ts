/**
 * Os prazos que a tela oferece para adiar uma conversa (0049).
 *
 * **Mora em `core/` e não em `acoes.ts` por imposição do Next**: um arquivo
 * `'use server'` só pode exportar função assíncrona, e exportar esta tabela de
 * lá quebra o build inteiro com "A 'use server' file can only export async
 * functions, found object", um erro que aponta para páginas que não têm nada
 * a ver com o problema.
 *
 * Quatro escolhas, nenhuma exigindo pensar em data. Data livre é o que se
 * acrescenta quando alguém sentir falta, não o que se começa oferecendo.
 */
export const PRAZOS_DE_ADIAMENTO = {
  '3h': { rotulo: 'Em 3 horas', horas: 3 },
  amanha: { rotulo: 'Amanhã', horas: 24 },
  '3d': { rotulo: 'Em 3 dias', horas: 72 },
  semana: { rotulo: 'Em 1 semana', horas: 168 },
} as const

export type PrazoDeAdiamento = keyof typeof PRAZOS_DE_ADIAMENTO
