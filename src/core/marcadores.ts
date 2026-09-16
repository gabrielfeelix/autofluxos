/**
 * Quantas conversas uma pessoa pode grudar no topo da fila.
 *
 * O WhatsApp permite três, e o dono pediu "três ou quatro". Cinco é o teto aqui
 * porque o bloco fixado rouba o topo da lista de todo mundo que olha: com dez,
 * a fila deixa de ser "o que chegou" e vira "o que alguém marcou um dia", e
 * quem fixa demais perde o único ganho de fixar, que é o alvo parar de se mexer.
 *
 * **Mora em `core/` e não no repo** pelo mesmo motivo de `TETO_DA_INSIGNIA`: a
 * fila filtra no navegador, e `repos/marcadores.ts` é `server-only`. A tela
 * precisa do número para desabilitar o alfinete antes do clique, em vez de
 * deixar o servidor recusar depois.
 */
export const TETO_DE_FIXADAS = 5
