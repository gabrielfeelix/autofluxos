/**
 * Comparar segredo sem contar o tempo.
 *
 * Sobrou de `painel-auth.ts`, que morreu junto com a senha única do time (a
 * porta `/login`). Ele fica porque as rotas de manutenção comparam o
 * `CRON_SECRET` e a comparação precisa ser das duas coisas: correta, e do mesmo
 * custo para todo par de entradas.
 *
 * `===` em string sai no primeiro caractere diferente, e a diferença de tempo é
 * medível pela rede em requisição repetida — dá para descobrir o segredo letra
 * a letra. `timingSafeEqual` percorre tudo sempre.
 *
 * O tamanho **vaza mesmo assim**, e é aceitável: `timingSafeEqual` estoura com
 * buffers de tamanhos diferentes, então a saída antecipada aqui é obrigatória.
 * Saber o comprimento de um segredo aleatório não ajuda quem tenta adivinhá-lo.
 */
import { timingSafeEqual } from 'node:crypto'

export function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}
