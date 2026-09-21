/**
 * O que é uma entrada, e o que cada tipo de entrada autoriza.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe
 * ---------------------------------------------------------------------------
 *
 * O sistema tinha uma tabela de chegadas (`passagens`, da 0050) e **nenhuma
 * coluna de tipo**. Toda linha era tratada como a mesma coisa: o clique num
 * anúncio Click to WhatsApp, o lead preenchido dentro do Facebook, e amanhã a
 * importação de uma planilha antiga.
 *
 * Isso não é falta de metadado, é regra de negócio errada. A view da 0065 lê
 * qualquer linha de `passagens` como `porta_de_entrada_em`, e
 * `channels/janela.ts` usa esse campo para abrir **72h de texto livre**. Quer
 * dizer: um formulário concedia uma janela que a Meta não concedeu, e quem
 * respondesse confiando nela recebia `(#131047) Re-engagement message`.
 *
 * É a RB-09: "formulário não é conversa... não abre janela de conversa do
 * WhatsApp por si só. Importar contato também não simula mensagem recebida".
 *
 * ---------------------------------------------------------------------------
 * O que cada tipo autoriza, e por quê
 * ---------------------------------------------------------------------------
 *
 * Duas perguntas diferentes, e é por isso que são dois campos e não um:
 *
 * **Abre conversa?** Só quem mandou a pessoa para o WhatsApp abre. O clique no
 * anúncio e o clique no botão da Página fazem isso: a pessoa cai na conversa e
 * escreve. O formulário não: ele entrega um telefone preenchido numa tela do
 * Facebook, e a pessoa nunca escreveu para o número.
 *
 * **Vale como mensagem da pessoa?** Só mensagem real vale. Uma importação de
 * histórico acrescenta linhas antigas e **não** pode reabrir a janela de 24h
 * como se a pessoa tivesse acabado de escrever, nem disparar bot.
 *
 * Nenhum tipo é "quase" outro: quem acrescentar um tipo novo precisa responder
 * as duas perguntas na tabela abaixo, de propósito, porque o default seguro é
 * não autorizar nada.
 */

/**
 * De onde a entrada veio. Nome estável: vai para o banco e para o histórico.
 *
 * `anuncio_whatsapp` é o clique em Click to WhatsApp; `botao_pagina` é o botão
 * da Página do Facebook. Os dois abrem a janela gratuita de entrada, e são
 * separados porque a Meta os reporta diferente e um dia o preço pode divergir.
 */
export type TipoDeEntrada =
  | 'anuncio_whatsapp'
  | 'botao_pagina'
  | 'formulario'
  | 'mensagem'
  | 'importacao'
  | 'submissao_manual'

export const TIPOS_DE_ENTRADA: readonly TipoDeEntrada[] = [
  'anuncio_whatsapp',
  'botao_pagina',
  'formulario',
  'mensagem',
  'importacao',
  'submissao_manual',
]

/** O que um tipo de entrada autoriza. */
export type PoderesDaEntrada = {
  /**
   * Abre a janela gratuita de entrada do WhatsApp (as 72h).
   *
   * Só é verdade para quem clicou e caiu na conversa. É este campo que a view
   * consulta para decidir se a linha conta como porta de entrada.
   */
  abrePortaDeEntrada: boolean
  /**
   * Conta como mensagem recebida da pessoa, para efeito da janela de 24h.
   *
   * Separado do acima porque são relógios diferentes: a porta é contada do
   * clique, a janela de atendimento é contada da última mensagem dela.
   */
  valeComoMensagem: boolean
  /**
   * Pode acionar automação (bot, sequência, disparo) por si só.
   *
   * Importação é histórico: `false` aqui é o que impede uma planilha de 400
   * linhas virar 400 mensagens de boas-vindas.
   */
  podeAcionarAutomacao: boolean
}

const PODERES: Record<TipoDeEntrada, PoderesDaEntrada> = {
  // Clique em Click to WhatsApp: a pessoa cai na conversa. Porta aberta.
  anuncio_whatsapp: { abrePortaDeEntrada: true, valeComoMensagem: false, podeAcionarAutomacao: true },
  // Botão da Página: mesmo caminho, mesmo direito.
  botao_pagina: { abrePortaDeEntrada: true, valeComoMensagem: false, podeAcionarAutomacao: true },
  /*
   * Lead Ads. Cria contato e cartão, e não abre janela nenhuma: é a RB-09.
   * `podeAcionarAutomacao` é `true` porque um lead de formulário **pode** ser
   * trabalhado, só que qualquer envio vai depender de modelo aprovado, e é
   * `abrePortaDeEntrada: false` que garante isso.
   */
  formulario: { abrePortaDeEntrada: false, valeComoMensagem: false, podeAcionarAutomacao: true },
  /*
   * Mensagem real. Não abre a porta de 72h por si só, quem abre é o clique,
   * e ele vem numa linha `anuncio_whatsapp` própria.
   */
  mensagem: { abrePortaDeEntrada: false, valeComoMensagem: true, podeAcionarAutomacao: true },
  // Histórico. Nada: nem janela, nem bot.
  importacao: { abrePortaDeEntrada: false, valeComoMensagem: false, podeAcionarAutomacao: false },
  /*
   * Alguém do atendimento cadastrou à mão. Não é conversa e não é histórico:
   * pode ser trabalhado, mas não inventa janela que a pessoa não deu.
   */
  submissao_manual: { abrePortaDeEntrada: false, valeComoMensagem: false, podeAcionarAutomacao: true },
}

/**
 * O que este tipo autoriza.
 *
 * Tipo desconhecido, linha antiga, valor que alguém escreveu na mão no banco ,
 * **não autoriza nada**. Falhar fechado aqui é a tela oferecer modelo aprovado
 * quando poderia ter oferecido texto livre; falhar aberto é a Meta recusar o
 * envio depois de a pessoa escrever o parágrafo.
 */
export function poderesDaEntrada(tipo: string | null | undefined): PoderesDaEntrada {
  const achado = tipo ? PODERES[tipo as TipoDeEntrada] : undefined
  return achado ?? { abrePortaDeEntrada: false, valeComoMensagem: false, podeAcionarAutomacao: false }
}

export function ehTipoDeEntrada(valor: unknown): valor is TipoDeEntrada {
  return typeof valor === 'string' && Object.hasOwn(PODERES, valor)
}

/**
 * O tipo de uma chegada por `referral` do webhook da Meta.
 *
 * A Meta manda `source_type` com `ad` ou `post`. Qualquer outra coisa, e o
 * campo ausente, cai em `botao_pagina` **não**: cai em `anuncio_whatsapp`
 * apenas quando há `source_id`, porque é o `source_id` que prova que houve um
 * criativo clicado. Sem ele não há porta a abrir.
 */
export function tipoDoReferral(referral: { source_type?: string; source_id?: string } | undefined): TipoDeEntrada | null {
  if (!referral?.source_id) return null
  return referral.source_type === 'post' ? 'botao_pagina' : 'anuncio_whatsapp'
}

/**
 * A chave que torna uma entrada repetível sem duplicar.
 *
 * ---------------------------------------------------------------------------
 * Por que a dedupe não pode ser por tempo
 * ---------------------------------------------------------------------------
 *
 * A 0050 deduplica `passagens` por `(contact_id, ad_id, minuto)`. Isso protege
 * o retry do webhook e **quebra a RB-10** no caso legítimo: duas submissões
 * reais de formulário no mesmo minuto são duas entradas, e a Meta manda um
 * `leadgen_id` diferente para cada uma. Deduplicar por minuto joga a segunda
 * fora.
 *
 * A regra é a da RB-10: usar o ID externo estável quando ele existe, e só cair
 * no tempo quando não existe. "Não deduzir que duas entradas são iguais só
 * porque ocorreram no mesmo minuto."
 */
export function chaveDaEntrada(entrada: {
  tipo: TipoDeEntrada
  idExterno?: string | null
  referencia?: string | null
}): string | null {
  const id = entrada.idExterno?.trim()
  if (id) return `${entrada.tipo}:${id}`

  /*
   * Sem ID externo não há chave estável, e inventar uma a partir do relógio
   * seria reintroduzir o defeito acima. `null` quer dizer "deduplique pelo
   * índice de tempo da 0050, que é o melhor disponível para este caso".
   */
  return null
}

/**
 * O que acontece com contato novo: entra no funil, e em qual.
 *
 * ---------------------------------------------------------------------------
 * Por que `mais_antigo` continua existindo
 * ---------------------------------------------------------------------------
 *
 * Porque retirá-lo moveria o destino dos leads de quem depende dele, calado. A
 * 0043 escolheu o quadro mais antigo como fallback por um bom motivo (com cinco
 * quadros e nenhum marcado, lead nenhum entrava em lugar nenhum), e hoje há
 * contas operando assim sem nunca ter marcado nada. Apagar o fallback faria elas
 * pararem de receber lead de um dia para o outro, sem ninguém tocar em nada.
 *
 * Então ele deixa de ser **fallback** e passa a ser **opção**: a 0075 escreveu
 * `mais_antigo` em quem já existia e deixou `nao_criar` como default de conta
 * nova, que é o que a RB-12 manda. A diferença que importa é que agora está
 * escrito no banco, aparece na tela e dá para revisar, em vez de ser uma regra
 * que só quem leu o código conhece.
 */
export type EntradaNoFunil = 'nao_criar' | 'quadro_marcado' | 'mais_antigo'

export const ENTRADAS_NO_FUNIL: readonly EntradaNoFunil[] = [
  'nao_criar',
  'quadro_marcado',
  'mais_antigo',
]

/** O default de conta nova, e o que um valor ilegível vira (RB-12). */
export const ENTRADA_NO_FUNIL_PADRAO: EntradaNoFunil = 'nao_criar'

/**
 * Lê a política gravada, com o default seguro.
 *
 * Valor desconhecido cai em `nao_criar`, e não em `mais_antigo`: o erro de não
 * criar cartão é visível e reversível (alguém reclama, e um clique resolve); o
 * de criar no quadro errado espalha contato por um funil que ninguém escolheu, e
 * desfazer exige achar cada cartão.
 */
export function entradaNoFunil(valor: string | null | undefined): EntradaNoFunil {
  return ENTRADAS_NO_FUNIL.includes(valor as EntradaNoFunil)
    ? (valor as EntradaNoFunil)
    : ENTRADA_NO_FUNIL_PADRAO
}

/**
 * A política permite cair no quadro mais antigo?
 *
 * Existe como função, e não como comparação solta no chamador, porque é a
 * pergunta que a 0043 respondia com `true` para todo mundo. Tê-la num lugar só
 * é o que torna possível responder "quem ainda usa isso" mais tarde.
 */
export function aceitaQuadroMaisAntigo(politica: EntradaNoFunil): boolean {
  return politica === 'mais_antigo'
}

/** A política cria cartão de alguma forma? */
export function criaCartaoSozinho(politica: EntradaNoFunil): boolean {
  return politica !== 'nao_criar'
}
