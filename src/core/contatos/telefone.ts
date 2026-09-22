/**
 * Casar o telefone da planilha do cliente com o `wa_id` que a Meta manda.
 *
 * Isto parece função de formatação e é o núcleo da conciliação. O WhatsApp
 * identifica a pessoa por um número; a planilha do cliente tem o mesmo número
 * escrito de seis jeitos diferentes, às vezes sem DDI, às vezes com máscara,
 * e, no Brasil, **às vezes com o nono dígito e às vezes sem**.
 *
 * O nono dígito é o caso que quebra tudo se for ignorado. Celulares brasileiros
 * ganharam um `9` na frente do número, mas o `wa_id` de contas antigas continua
 * vindo sem ele. O mesmo aparelho aparece como `5511987654321` numa conversa e
 * `551187654321` na planilha, e uma comparação literal diria que são duas
 * pessoas.
 *
 * Este módulo mora em `core/` porque é regra, não infraestrutura: não faz rede,
 * não conhece banco e é testável sozinho.
 */

/** Só os dígitos. Tira `+`, parênteses, hífen, espaço e o que mais vier. */
export function digitos(bruto: string): string {
  return bruto.replace(/\D+/g, '')
}

const DDI_BRASIL = '55'

/**
 * As formas em que este telefone pode estar gravado, para casar contra `wa_id`.
 *
 * Devolve **lista**, não um valor único, e é essa a decisão que resolve o nono
 * dígito: em vez de eleger uma forma canônica e torcer para o outro lado ter
 * escolhido a mesma, geramos todas as que significam o mesmo aparelho e
 * procuramos por qualquer uma.
 *
 * Lista vazia = não dá para casar com segurança. É o caso do número sem DDD:
 * `98765-4321` pode ser de onze estados, e chutar o DDD do cliente casaria a
 * conversa de uma pessoa com o cadastro de outra. Vazio vira "pendente", que é
 * uma resposta honesta; um palpite errado é indistinguível de acerto.
 */
export function chavesDoTelefone(bruto: string): string[] {
  const so = digitos(bruto)
  if (so === '') return []

  // `+55 (11) 98765-4321` chega como 5511987654321. Sem DDI, 11987654321.
  const semDdi = so.startsWith(DDI_BRASIL) && (so.length === 12 || so.length === 13)
    ? so.slice(2)
    : so

  // 10 = DDD + 8 dígitos (fixo, ou celular antigo). 11 = DDD + 9 (celular).
  // Fora disso não é telefone brasileiro completo.
  if (semDdi.length !== 10 && semDdi.length !== 11) {
    // Pode ser número estrangeiro já com DDI, 12+ dígitos que não começam com
    // 55. Aí não há nono dígito para resolver e a única chave é ele mesmo.
    if (!so.startsWith(DDI_BRASIL) && so.length >= 11) return [so]
    return []
  }

  const ddd = semDdi.slice(0, 2)
  const numero = semDdi.slice(2)
  const variantes = new Set<string>([`${DDI_BRASIL}${ddd}${numero}`])

  if (numero.length === 9 && numero.startsWith('9')) {
    // Com o nono: gera também a forma antiga, sem ele.
    variantes.add(`${DDI_BRASIL}${ddd}${numero.slice(1)}`)
  } else if (numero.length === 8 && /^[6-9]/.test(numero)) {
    // Sem o nono, e o primeiro dígito diz que é celular (6 a 9). Fixo começa
    // com 2 a 5 e nunca ganhou nono dígito, inventar um para ele criaria uma
    // chave que não existe em lugar nenhum.
    variantes.add(`${DDI_BRASIL}${ddd}9${numero}`)
  }

  return [...variantes]
}

/**
 * A forma preferida para mostrar e guardar: DDI + DDD + número, sem máscara.
 *
 * `null` quando não dá para normalizar, mesmo critério de `chavesDoTelefone`.
 * Quando há duas variantes, a com nono dígito ganha: é a forma válida hoje, e
 * é a que um número novo terá.
 */
export function telefoneCanonico(bruto: string): string | null {
  const chaves = chavesDoTelefone(bruto)
  if (chaves.length === 0) return null
  return chaves.reduce((maior, atual) => (atual.length > maior.length ? atual : maior))
}

/**
 * `+55 (11) 98765-4321`, para ler na tela. Devolve o cru se não reconhecer.
 *
 * **Só põe `+55` em quem já tem `55`.** Um `wa_id` americano como
 * `12025550123` tem os mesmos onze dígitos de um celular brasileiro com DDD, e
 * a versão anterior o formatava como `+55 (12) 02555-0123`: inventava um país,
 * um DDD que é a ponta do código dos Estados Unidos, e um zero inicial que não
 * existe em celular nenhum. Aparecia em oito telas de contato, e passou a
 * importar mais quando `telefone_br` levou esta função para dentro de frases
 * que o cliente lê.
 *
 * Onze dígitos sem DDI podem ser brasileiros (é como a planilha do cliente
 * escreve) e continuam ganhando máscara. O que muda é o número que **já traz
 * DDI de outro país**: ele atravessa inteiro, que é a resposta honesta.
 */
export function telefoneLegivel(bruto: string): string {
  const so = digitos(bruto)
  const temDdiBrasil = so.startsWith(DDI_BRASIL) && (so.length === 12 || so.length === 13)
  const semDdi = temDdiBrasil ? so.slice(2) : so

  if (semDdi.length !== 10 && semDdi.length !== 11) return bruto

  /*
   * **Sem DDI, o número precisa ter forma de telefone brasileiro.**
   *
   * Um `wa_id` americano como `12025550123` tem os mesmos onze dígitos de um
   * celular brasileiro sem DDI, e a versão anterior o formatava como
   * `+55 (12) 02555-0123`: inventava o país, tirava o DDD da ponta do código
   * dos EUA e deixava um zero inicial que celular nenhum tem. Aparecia em oito
   * telas de contato, e passou a importar mais quando `telefone_br` levou esta
   * função para dentro de frases que o cliente lê.
   *
   * O comprimento não separa os dois, e o DDD também não (`12` é DDD de São
   * José dos Campos). O que separa é a **forma**, e são as mesmas regras que
   * `chavesDoTelefone` já usa logo acima:
   *
   * - DDD vai de 11 a 99: nenhum começa com 0.
   * - Onze dígitos = celular, e celular brasileiro tem `9` depois do DDD.
   * - Dez dígitos = fixo, que começa de 2 a 5, ou celular antigo, de 6 a 9.
   *
   * `12025550123` cai na segunda: depois do `12` vem `0`, e não `9`.
   *
   * Não vale para quem já trouxe `55`, onde o DDI é explícito: ali um número
   * fora do padrão é cadastro errado, e mostrá-lo mascarado é o que deixa
   * enxergar que está errado.
   */
  if (!temDdiBrasil) {
    const ddd = semDdi.slice(0, 2)
    const numero = semDdi.slice(2)
    const pareceBrasileiro =
      /^[1-9][1-9]$/.test(ddd) &&
      (numero.length === 9 ? numero.startsWith('9') : /^[2-9]/.test(numero))
    if (!pareceBrasileiro) return bruto
  }

  const ddd = semDdi.slice(0, 2)
  const numero = semDdi.slice(2)
  const corte = numero.length === 9 ? 5 : 4
  return `+55 (${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`
}

/**
 * A máscara **enquanto se digita**: `(44) 90000-0000`, montada dígito a dígito.
 *
 * É prima de `telefoneLegivel` e não a mesma função, e a diferença é o estado em
 * que o número chega. Aquela formata um telefone **pronto** e devolve o cru
 * quando não reconhece, comportamento certo para exibir o que já está gravado,
 * e péssimo para um campo em uso: quem digitou três dígitos ainda não tem um
 * telefone válido, e receber o texto de volta sem máscara faria os parênteses
 * aparecerem só no fim, pulando na frente de quem está escrevendo.
 *
 * Aqui cada estado incompleto tem a sua forma, então a pontuação nasce embaixo
 * do dedo: `4` → `(4`, `44` → `(44) `, e o hífen entra quando há o que separar.
 *
 * **O corte do hífen depende do tamanho**, e é por isso que ele só aparece
 * depois do DDD completo: celular é `(44) 90000-0000` (5 antes do traço) e fixo
 * é `(44) 3000-0000` (4). Cortar sempre em 4 poria o traço no lugar errado de
 * todo celular; cortar sempre em 5 quebraria todo fixo. Como não dá para saber
 * qual é antes de o número terminar, o traço segue o que já foi digitado: até
 * dez dígitos ele formata como fixo, no décimo primeiro vira celular.
 *
 * O DDI fica de fora de propósito. Ele é constante para todo mundo que usa isto
 * hoje, e um `+55` fixo no começo do campo é um pedaço que a pessoa apaga sem
 * querer e depois não sabe repor.
 */
export function mascaraDeTelefone(bruto: string): string {
  // Onze é o teto do celular brasileiro com DDD. Cortar aqui é o que impede o
  // campo de aceitar um décimo segundo dígito que não caberia em máscara
  // nenhuma, e é mais honesto que aceitar e recusar depois.
  const so = digitos(bruto).slice(0, 11)
  if (so === '') return ''

  // Menos de dois dígitos é DDD incompleto: abre o parêntese e espera. No
  // segundo ele fecha sozinho, e o espaço depois evita que o próximo dígito
  // pareça grudado no DDD.
  if (so.length < 2) return `(${so}`

  const ddd = so.slice(0, 2)
  const numero = so.slice(2)
  if (numero.length <= 4) return `(${ddd}) ${numero}`

  const corte = numero.length > 8 ? 5 : 4
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`
}

/**
 * O telefone digitado está completo o bastante para ser aceito?
 *
 * Vazio **é válido**: o campo é opcional, e tratar "não quis informar" como erro
 * seria transformar a escolha num obstáculo. O que não vale é meio telefone ,
 * dez ou onze dígitos, nada entre.
 */
export function telefoneCompleto(bruto: string): boolean {
  const so = digitos(bruto)
  return so.length === 0 || so.length === 10 || so.length === 11
}
