/**
 * O que a conversa já sabe antes de perguntar qualquer coisa.
 *
 * **A sessão nascia com `vars` vazio, e isso quebrava em silêncio tudo que
 * depende de saber com quem se está falando.** `{{telefone}}` e `{{nome}}`
 * apareciam escritos nos presets de integração — a RD, a planilha, o webhook —
 * e chegavam vazios no primeiro bloco de toda conversa. O sintoma é o pior
 * possível: a chamada sai, responde 200, e grava um lead sem telefone. Nada
 * estoura, nada aparece no log, e só se descobre olhando o CRM do cliente.
 *
 * Foi tentando reconhecer quem chegou na agenda que a falta ficou impossível de
 * ignorar: `GET /pessoas?telefone={{telefone}}` sem telefone procura por nada,
 * responde "não achei", e o fluxo trata uma aluna de dois anos como pessoa nova.
 *
 * **Isto não é dado de negócio.** A fronteira do ARQUITETURA.md continua valendo
 * — turma, matrícula e presença moram no sistema do cliente. Número e nome de
 * quem está conversando são estado da própria conversa, e nós já os temos na
 * mão: o número é a identidade do canal, e o nome veio no perfil.
 *
 * Puro e sem banco: recebe o retrato do contato e devolve o dicionário.
 */

/** O que se sabe do contato antes de a conversa começar. */
export type RetratoDoContato = {
  /** O identificador do WhatsApp: país, DDD e número, sem máscara. */
  waId: string
  /** O nome do perfil do WhatsApp. Vem em branco com frequência. */
  nome?: string | null
  /** O nome corrigido por quem atende. Vence o do perfil. */
  nomeReal?: string | null
  /** O que conversas anteriores guardaram neste contato. */
  campos?: Record<string, string>
}

/**
 * As que **sempre existem**, antes de qualquer bloco rodar.
 *
 * Exportadas daqui, e não repetidas no validador e no editor, porque as três
 * verdades divergiriam no dia em que uma quarta variável nativa nascesse — e a
 * divergência apareceria como aviso falso, que é o pior tipo: ele treina quem
 * desenha a ignorar o painel de avisos inteiro.
 */
export const VARIAVEIS_NATIVAS = ['nome', 'telefone'] as const

export function varsIniciais(contato: RetratoDoContato): Record<string, string> {
  const vars: Record<string, string> = {}

  const doPerfil = (contato.nome ?? '').trim()
  if (doPerfil !== '') vars.nome = doPerfil

  vars.telefone = contato.waId

  /*
   * O que a conversa coletou vence o que veio de fora.
   *
   * Um fluxo que perguntou "qual seu telefone para contato?" e guardou em
   * `telefone` quis dizer aquilo; sobrescrever com o número do WhatsApp
   * apagaria a resposta de alguém em favor de um valor que o desenho não pediu.
   */
  Object.assign(vars, contato.campos ?? {})

  /*
   * E o nome corrigido vence os dois.
   *
   * `nome_real` é o que alguém do time digitou olhando a conversa, justamente
   * porque o perfil dizia "iPhone de Ana" ou porque a pessoa se apresentou com
   * apelido. É a informação mais confiável que existe sobre quem é aquele
   * contato, e por isso ela é a última a ser escrita.
   */
  const corrigido = (contato.nomeReal ?? '').trim()
  if (corrigido !== '') vars.nome = corrigido

  return vars
}
