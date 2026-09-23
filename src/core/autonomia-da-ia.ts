/**
 * O que a IA faz antes de gravar, dito na tela do editor (A11).
 *
 * A política mora em `server/ia/politica.ts` (por conta e por ferramenta, só
 * para o que grava). Este arquivo só traduz o valor para o que o contato vê,
 * e fica em `core/` porque o painel do editor, que é `'use client'`, precisa
 * dele sem importar o servidor.
 */
export type PoliticaDaIa = 'automatico' | 'confirmar' | 'humano'

/** O padrão de escrita, igual ao `PADRAO_DE_ESCRITA` do servidor. */
export const POLITICA_PADRAO_DE_ESCRITA: PoliticaDaIa = 'confirmar'

/**
 * O efeito, e não o nome da política.
 *
 * `humano` sai com o mesmo texto de `confirmar` de propósito: hoje o motor
 * trata qualquer política que não seja `automatico` como "pergunta ao contato
 * antes" (`resolver.ts`, no `politicaDe(...) !== 'automatico'`). A aprovação
 * por alguém da equipe ainda não existe, e a tela não pode prometer o que a
 * conversa não faz.
 */
export function efeitoDaPolitica(politica: PoliticaDaIa): { selo: string; frase: string } {
  if (politica === 'automatico') {
    return { selo: 'grava sem perguntar', frase: 'grava sozinha, sem perguntar ao contato' }
  }
  return { selo: 'pede confirmação', frase: 'pergunta “posso?” ao contato e só grava com o sim' }
}

export function politicaDaFerramenta(
  nome: string,
  politicas: Record<string, PoliticaDaIa>,
): PoliticaDaIa {
  return politicas[nome] ?? POLITICA_PADRAO_DE_ESCRITA
}
