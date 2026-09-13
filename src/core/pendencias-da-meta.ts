/**
 * O que falta o cliente fazer na Meta para as mensagens andarem.
 *
 * ---------------------------------------------------------------------------
 * Por que isto existe
 * ---------------------------------------------------------------------------
 *
 * Em 13/set/2026 um cliente conectou o WhatsApp, tudo ficou verde do nosso lado
 * (número `CONNECTED`, WABA inscrita, webhook respondendo 200) e **nenhuma
 * mensagem chegou**. Sem erro, sem alerta, sem log. A conta dele estava
 * `BLOCKED` na Meta por falta de cartão, e a Cloud API simplesmente não
 * movimenta conversa nesse estado.
 *
 * Levou horas para descobrir porque o silêncio é indistinguível de "ninguém
 * mandou mensagem ainda". Quem usa o painel não tem como fazer essa
 * investigação, então a tela precisa fazer por ele.
 *
 * Puro de propósito: traduzir código da Meta em tarefa que uma pessoa entende é
 * decisão de produto, e testá-la por tela renderizada esconderia qual código
 * caiu em qual texto.
 */

/** O que a Meta responde em `health_status`, no pedaço que nos interessa. */
export type SaudeDaMeta = {
  podeEnviar?: string | null
  /** Códigos de erro achatados de todas as entidades (WABA, negócio, app). */
  codigos: number[]
  /**
   * Os ids que completam os links. Sem eles a Meta abre um seletor de contas
   * em vez da tela que resolve, e a pessoa se perde antes de chegar lá.
   */
  negocioId?: string | null
  wabaId?: string | null
}

export type Pendencia = {
  /** Estável, para teste e para `key` de lista. */
  id: 'pagamento' | 'fuso' | 'verificacao'
  titulo: string
  /** O que acontece enquanto isto não for feito. Sem jargão. */
  efeito: string
  /** Onde resolver, em palavras de quem vai clicar. */
  onde: string
  /** O texto do link. Verbo no começo: a pessoa está procurando o que fazer. */
  rotuloDoLink: string
  /** Montado com os ids da conta. `null` = sem id, a tela mostra só o texto. */
  link?: string | null
  /**
   * `true` = sozinho já impede as mensagens. É o que decide a cor e a ordem:
   * mandar alguém verificar o negócio antes de pôr o cartão é fazer a pessoa
   * gastar dias numa fila que não era o problema.
   */
  bloqueia: boolean
}

/**
 * Os códigos que sabemos traduzir.
 *
 * Ficam aqui, e não espalhados na tela, porque a Meta acrescenta códigos novos
 * e o que não conhecemos **não pode virar tela em branco**: `pendenciasDaMeta`
 * ignora o que não está aqui e o resto da tela segue funcionando.
 */
const CATALOGO: Record<number, Pendencia> = {
  141006: {
    id: 'pagamento',
    titulo: 'Cadastrar um cartão na conta do WhatsApp',
    efeito:
      'Sem cartão a Meta bloqueia a conta, e nenhuma mensagem entra nem sai. É o que precisa ser resolvido primeiro.',
    onde: 'Abre no Gerenciador de Negócios da Meta, em Cobrança e pagamentos.',
    rotuloDoLink: 'Cadastrar cartão na Meta',
    bloqueia: true,
  },
  141007: {
    id: 'fuso',
    titulo: 'Definir o fuso horário da conta',
    efeito:
      'A Meta exige o fuso antes de liberar os envios. É rápido, some com dois cliques.',
    onde: 'Abre as configurações da conta do WhatsApp no Gerenciador da Meta.',
    rotuloDoLink: 'Definir o fuso horário',
    bloqueia: true,
  },
  141010: {
    id: 'verificacao',
    titulo: 'Verificar o negócio na Meta',
    efeito:
      'Sem verificação a conta funciona, mas com limite baixo de conversas por dia. Dá para deixar por último.',
    onde: 'Abre a Central de Segurança da Meta, onde a verificação é feita.',
    rotuloDoLink: 'Verificar o negócio',
    bloqueia: false,
  },
}

/**
 * As pendências que a Meta está apontando, na ordem de quem resolve primeiro.
 *
 * O que bloqueia vem antes do que só limita, e código repetido entre entidades
 * (a mesma queixa aparece na WABA e no negócio) aparece uma vez só.
 */
export function pendenciasDaMeta(saude: SaudeDaMeta | null | undefined): Pendencia[] {
  if (!saude) return []

  const vistos = new Set<string>()
  const achadas: Pendencia[] = []

  for (const codigo of saude.codigos) {
    const pendencia = CATALOGO[codigo]
    if (!pendencia || vistos.has(pendencia.id)) continue
    vistos.add(pendencia.id)
    achadas.push(pendencia)
  }

  return achadas
    .sort((a, b) => Number(b.bloqueia) - Number(a.bloqueia))
    .map((pendencia) => ({ ...pendencia, link: linkDa(pendencia.id, saude) }))
}

/**
 * O endereço que abre **a tela que resolve**, e não a porta da frente da Meta.
 *
 * O Gerenciador de Negócios pede `business_id` na URL; sem ele quem tem mais de
 * um negócio cai num seletor, e quem tem um só cai numa visão geral onde a
 * opção certa está a três cliques. Mandar a pessoa para "o site da Meta" é o
 * mesmo que não mandar link nenhum.
 *
 * `null` quando falta o id: aí a tela mostra só o texto de onde ir, que é
 * melhor que um link que abre no lugar errado e faz a pessoa achar que errou.
 */
function linkDa(id: Pendencia['id'], saude: SaudeDaMeta): string | null {
  const negocio = saude.negocioId
  const waba = saude.wabaId

  if (id === 'pagamento') {
    return negocio
      ? `https://business.facebook.com/billing_hub/payment_settings?business_id=${negocio}`
      : null
  }

  if (id === 'verificacao') {
    return negocio
      ? `https://business.facebook.com/settings/security?business_id=${negocio}`
      : null
  }

  // O fuso mora na própria conta do WhatsApp, então a URL leva a WABA junto.
  if (!negocio || !waba) return null
  return `https://business.facebook.com/settings/whatsapp-business-accounts/${waba}?business_id=${negocio}`
}

/**
 * As mensagens estão travadas agora?
 *
 * **Só `BLOCKED` conta.** `LIMITED` é conta que entrega com teto menor, e tratar
 * as duas igual faria a tela gritar "nada funciona" para quem está funcionando.
 * Estado que não conhecemos não vira alarme: na dúvida, a tela cala.
 */
export function estaBloqueado(saude: SaudeDaMeta | null | undefined): boolean {
  return saude?.podeEnviar === 'BLOCKED'
}
