/**
 * Quem recebe o próximo lead sem dono.
 *
 * ---------------------------------------------------------------------------
 * Por que a regra mora em `core/` e não numa consulta SQL
 * ---------------------------------------------------------------------------
 *
 * "Quem tem menos conversa aberta" dá para escrever num `order by` com um
 * `left join`, e sairia mais curto. Sairia também impossível de testar sem
 * banco, e esta é a regra que mais vai mudar de forma: teto, presença, papel e
 * pausa são quatro eixos que o dono ainda vai querer mexer depois de ver o
 * primeiro mês funcionando.
 *
 * Aqui ela é uma função pura sobre uma lista pequena, do tamanho da equipe.
 *
 * ---------------------------------------------------------------------------
 * Balanceado, e não rodízio por ordem fixa
 * ---------------------------------------------------------------------------
 *
 * Rodízio puro ignora carga: o vendedor com onze conversas abertas recebe a
 * décima segunda porque "era a vez dele". Balanceado responde a pergunta que
 * importa para quem espera do outro lado, que é quem tem mão livre agora.
 */

/** Uma pessoa da equipe, com tudo o que decide se ela recebe a próxima. */
export type Candidato = {
  usuarioId: string
  /** `owner` | `admin` | `member`, como o `af_membros` guarda. */
  papel: string
  /** `disponivel` | `ausente`, de `af_usuarios`. */
  presenca: string
  /** Conversas abertas que já são dela nesta conta. */
  abertas: number
  /** O que a conta configurou, ou `null` quando ninguém configurou nada. */
  entraNoRodizio: boolean | null
  /** Máximo de conversas simultâneas; `0` e `null` querem dizer sem teto. */
  tetoSimultaneo: number | null
}

/**
 * O padrão de quem nunca foi configurado: gestor acompanha, quem atende atende.
 *
 * Existe para a tabela `af_atendentes` poder nascer vazia e a distribuição já
 * funcionar. Conta que precisa ser configurada antes de funcionar é conta que
 * fica com a distribuição desligada para sempre, porque ninguém sabe que existe
 * uma tela a visitar.
 *
 * `owner` e `admin` ficam de fora por padrão e entram marcando na tela: em conta
 * pequena o dono também vende, e essa é a exceção que se declara, não a regra.
 */
export function entraPorPadrao(papel: string): boolean {
  return papel !== 'owner' && papel !== 'admin'
}

/** A pessoa está apta a receber agora? */
export function podeReceber(candidato: Candidato): boolean {
  /*
   * Ausente sai do rodízio e **mantém o que já era dela**. Redistribuir o que a
   * pessoa já atendia ao marcar pausa transformaria pausa em abandono, e quem
   * percebe primeiro é o cliente do outro lado.
   */
  if (candidato.presenca !== 'disponivel') return false

  const entra = candidato.entraNoRodizio ?? entraPorPadrao(candidato.papel)
  if (!entra) return false

  const teto = candidato.tetoSimultaneo ?? 0
  if (teto > 0 && candidato.abertas >= teto) return false

  return true
}

/**
 * Quem recebe, ou `null` quando ninguém pode.
 *
 * `null` é resposta legítima e comum: todo mundo ausente de madrugada, todo
 * mundo no teto numa terça de campanha. Quem chama trata isso deixando a
 * conversa sem dono, que é o estado de hoje e o que faz a fila "Sem dono"
 * continuar sendo a rede de segurança.
 *
 * **O empate resolve pelo id, e não por sorteio.** Sorteio faria o mesmo estado
 * de entrada produzir saídas diferentes: impossível de testar, e pior de
 * explicar para quem perguntar por que a conversa foi para fulano.
 */
export function escolherAtendente(candidatos: Candidato[]): string | null {
  const aptos = candidatos.filter(podeReceber)
  if (aptos.length === 0) return null

  return aptos.reduce((melhor, atual) => {
    if (atual.abertas !== melhor.abertas) return atual.abertas < melhor.abertas ? atual : melhor
    return atual.usuarioId < melhor.usuarioId ? atual : melhor
  }).usuarioId
}
