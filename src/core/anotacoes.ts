/**
 * Uma anotação da equipe sobre um contato (tarefa 5.9).
 *
 * Só a equipe vê: não vai para o WhatsApp nem para a automação. Mora no diário
 * do contato como evento `nota` (ver `repos/eventos.ts`).
 */
export type Anotacao = {
  id: string
  texto: string
  /** Nome de quem escreveu, na hora em que escreveu. `null` em registro antigo. */
  autor: string | null
  criadoEm: string
}
