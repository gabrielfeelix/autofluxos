/**
 * A assinatura de quem está atendendo, na mensagem que a pessoa recebe.
 *
 * ---------------------------------------------------------------------------
 * Por que o WhatsApp e não só o painel
 * ---------------------------------------------------------------------------
 *
 * `acaoAssumirAtendimento` dizia o contrário: *"assumir não muda o que a pessoa
 * do outro lado vê"*, e não mandava nada — anunciar a nossa mesa para quem só
 * quer ser respondido parecia exposição sem ganho.
 *
 * O que mudou não foi a regra, foi a pergunta. Sem assinatura, **quem recebe
 * não sabe que virou gente**: as mensagens continuam chegando do mesmo número,
 * com a mesma cara das do bot, e a pessoa segue falando com o robô que ela
 * acha que está lá. Dizer o nome não expõe a mesa — dá conta de quem responde,
 * que é o contrário de esconder atrás de "atendimento".
 *
 * ---------------------------------------------------------------------------
 * Primeiro nome, e só
 * ---------------------------------------------------------------------------
 *
 * "Leinara" e não "Leinara Souza": é como uma pessoa se apresenta no balcão. O
 * cadastro inteiro numa conversa de WhatsApp soa como protocolo.
 */

/** `*Leinara:*` — negrito do WhatsApp, que é `*` e não `**`. */
export function assinar(texto: string, nome: string | null | undefined): string {
  const primeiro = primeiroNome(nome)
  /*
   * Sem nome, vai sem assinatura.
   *
   * A sessão pela senha única não tem usuário, e um `*:*` solto no começo da
   * mensagem seria pior do que assinatura nenhuma: quem lê não tem como saber
   * que aquilo era para ser um nome.
   */
  if (primeiro === '') return texto
  return `*${primeiro}:*\n${texto}`
}

/**
 * "Fulana entrou na conversa", quando alguém assume.
 *
 * Devolve `null` sem nome, pelo mesmo motivo de `assinar`: "entrou na conversa"
 * sem dizer quem entrou não informa nada e ainda gasta uma mensagem.
 */
export function avisoDeEntrada(nome: string | null | undefined): string | null {
  const primeiro = primeiroNome(nome)
  if (primeiro === '') return null
  return `${primeiro} entrou na conversa e vai te atender por aqui. 👋`
}

function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] ?? ''
}
