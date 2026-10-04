/**
 * "Sentiu falta de algo?": o pedido de melhoria que o cliente manda de dentro
 * do sistema (03/10/2026, ideia trazida do RD Station pelo Eduardo).
 *
 * **Mora na auditoria, sem tabela nova**, como o pedido de plano: a 0021 já é
 * append-only, então ninguém apaga a sugestão de um cliente por engano, e a
 * administração já sabe ler dali. O ato é `sugeriu_melhoria`; o texto e a
 * tela onde a pessoa estava vão em `detalhes`.
 *
 * Puro e sem rede. Quem grava é `server/acoes-sugestao.ts`.
 */

export const ATO_DA_SUGESTAO = 'sugeriu_melhoria'

export const LIMITE_DA_SUGESTAO = 2000

/** Menos que isso não é sugestão, é tecla escapada. */
const MINIMO_DA_SUGESTAO = 4

/** O caminho da tela, para a 4YU saber de onde veio. Endereço maior que isso é lixo. */
const LIMITE_DA_TELA = 300

export type ConferenciaDaSugestao = { ok: true; texto: string } | { ok: false; motivo: string }

export function conferirSugestao(bruto: string): ConferenciaDaSugestao {
  const texto = bruto.trim()
  if (texto.length < MINIMO_DA_SUGESTAO) return { ok: false, motivo: 'conte em poucas palavras o que faltou' }
  if (texto.length > LIMITE_DA_SUGESTAO) {
    return { ok: false, motivo: `a sugestão cabe em ${LIMITE_DA_SUGESTAO} caracteres` }
  }
  return { ok: true, texto }
}

/**
 * A tela, sem o id da conta: `/clientes/<id>/quadros` vira `/quadros`.
 *
 * O id não diz nada a quem lê a sugestão (a organização já está na linha) e
 * deixa a lista ilegível. A busca (`?q=...`) sai junto: pode carregar nome de
 * contato digitado num filtro, e a 4YU não precisa disso para entender o pedido.
 */
export function telaDaSugestao(caminho: string): string {
  const semBusca = caminho.split(/[?#]/)[0] ?? ''
  const semConta = semBusca.replace(/^\/clientes\/[^/]+/, '')
  return (semConta || '/').slice(0, LIMITE_DA_TELA)
}
