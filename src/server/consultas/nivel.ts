import 'server-only'
import { condicoesDoNivel } from '@/core/segmentos'
import type { Nivel } from '@/core/relacionamento'
import { consultarContatos } from './contatos'

/**
 * Quem está nesta faixa de valor, **na conta inteira** (T6.1, RB-37).
 *
 * ---------------------------------------------------------------------------
 * Por que esta função existe, e por que ela é compartilhada
 * ---------------------------------------------------------------------------
 *
 * O filtro de nível tinha duas implementações e nenhuma delas era do servidor:
 *
 *   - a tela fazia `leads.filter(...)` sobre a página já carregada. A
 *     contagem ao lado dizia "3 de 50" — 3 daquela página, não da base — e ir
 *     para a página 2 trazia outro conjunto de "Ouro";
 *   - o CSV **não tinha** o filtro. Quem filtrava por Ouro na tela e clicava
 *     em exportar recebia a base inteira, sem aviso nenhum.
 *
 * Agora as duas chamam isto, que chama `consultarContatos`, que aplica a
 * condição no Postgres antes de paginar. Uma definição, três superfícies.
 *
 * ---------------------------------------------------------------------------
 * O teto, e por que ele é honesto
 * ---------------------------------------------------------------------------
 *
 * A função devolve **ids**, para restringir a consulta de leads. Isso tem
 * limite, e o limite é declarado: acima de `TETO` a resposta seria uma lista
 * de ids grande demais para viajar num `in (...)`. O caminho definitivo é a
 * consulta de leads passar a ler direto de `contatos_comerciais`, e isso é
 * trabalho da T6.2 em diante — está no handoff.
 *
 * O teto foi escolhido acima do que a produção tem (27 contatos medidos em
 * setembro de 2026) com folga de duas ordens de grandeza.
 */
const TETO = 5000

export async function contatosDoNivel(
  clienteId: string,
  nivel: Nivel,
  faixas: { ouro: number; prata: number },
): Promise<string[]> {
  const r = await consultarContatos({
    clienteId,
    segmento: { juncao: 'todas', condicoes: condicoesDoNivel(nivel, faixas) },
    // O escopo desta tela já foi conferido por quem a abriu; a restrição por
    // responsável entra na consulta de leads, que é quem a conhece.
    escopo: { tipo: 'tudo' },
    porPagina: TETO,
  })

  return r.contatos.map((contato) => contato.contatoId)
}
