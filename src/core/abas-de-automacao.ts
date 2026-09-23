/**
 * As abas de Automações (decisão de 23/09): **Fluxos · Gatilhos · Sequências**.
 *
 * Gatilhos junta o que faz uma automação começar: Palavras-chave, Eventos e
 * Campanhas, cada um uma sub-aba (`?aba=gatilhos&tipo=palavras`).
 *
 * **As URLs antigas continuam valendo.** `?aba=palavras`, `eventos` e
 * `campanhas` estão em link salvo e em endereço colado em conversa: elas abrem
 * a mesma sub-aba. `?aba=templates` abre a galeria de modelos, que saiu da
 * barra (os prontos também estão em "Nova automação"). Aba desconhecida cai em
 * Fluxos: o valor vem da URL, e link velho não pode virar tela em branco.
 */
export const CONTEUDOS = ['fluxos', 'templates', 'palavras', 'eventos', 'campanhas', 'sequencias'] as const
export type Conteudo = (typeof CONTEUDOS)[number]

export const TIPOS_DE_GATILHO = ['palavras', 'eventos', 'campanhas'] as const
export type TipoDeGatilho = (typeof TIPOS_DE_GATILHO)[number]

export type AbaPrincipal = 'fluxos' | 'gatilhos' | 'sequencias'

export function resolverAba(
  aba: string | undefined,
  tipo: string | undefined,
): { conteudo: Conteudo; principal: AbaPrincipal } {
  const ehTipo = (valor: string | undefined): valor is TipoDeGatilho =>
    (TIPOS_DE_GATILHO as readonly string[]).includes(valor ?? '')

  if (aba === 'gatilhos') return { conteudo: ehTipo(tipo) ? tipo : 'palavras', principal: 'gatilhos' }
  if (ehTipo(aba)) return { conteudo: aba, principal: 'gatilhos' }
  if (aba === 'sequencias') return { conteudo: 'sequencias', principal: 'sequencias' }
  if (aba === 'templates') return { conteudo: 'templates', principal: 'fluxos' }
  return { conteudo: 'fluxos', principal: 'fluxos' }
}

/** O endereço (só a query) de cada aba, no formato novo. */
export function consultaDaAba(conteudo: Conteudo): string {
  if ((TIPOS_DE_GATILHO as readonly string[]).includes(conteudo)) return `aba=gatilhos&tipo=${conteudo}`
  return `aba=${conteudo}`
}
