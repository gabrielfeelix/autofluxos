/**
 * O que a resposta livre precisa ser, e o que dizer quando não é.
 *
 * **A pergunta de resposta livre aceitava qualquer coisa.** "Me manda a data"
 * seguido de "amanhã", "sei lá" ou um áudio transcrito virava o valor de
 * `{{data}}`, o fluxo seguia, e o bloco de API mandava aquilo para o sistema do
 * cliente. Quem estava usando pediu exatamente o conserto: *"você coloca config.
 * citando que se não for escrito daquela forma eu consigo retornar a informação:
 * 'Desculpe, pode escrever novamente citando dia / mês / Ano, exemplo:
 * 21/08/2026'"*.
 *
 * Duas decisões que valem para todos os formatos:
 *
 * **Recusar é conversa, não erro.** Não entender uma data não interrompe nada:
 * o bot diz o que espera, com exemplo, e continua parado na mesma pergunta. Só
 * depois de três tentativas a conversa vai para uma pessoa — a mesma régua que
 * já vale para menu que ninguém acerta.
 *
 * **O valor padronizado é opcional e explícito.** `21/08/2026` é o que a pessoa
 * escreve e o que ela quer ler de volta; `2026-08-21` é o que uma API aceita. Os
 * dois são úteis e não são o mesmo, então cada um vai para a variável que quem
 * desenhou escolher — em vez de o motor decidir e surpreender metade dos casos.
 *
 * Puro e sem relógio, como todo `core/`: ano de dois dígitos não vira "este
 * século" por adivinhação, e "amanhã" não é data. Quem lê a hora é o servidor.
 */

export const FORMATOS_DE_RESPOSTA = [
  'data',
  'hora',
  'numero',
  'email',
  'telefone',
  'cpf',
] as const

export type FormatoDeResposta = (typeof FORMATOS_DE_RESPOSTA)[number]

/** O nome do formato na tela de quem desenha. */
export const NOME_DO_FORMATO: Record<FormatoDeResposta, string> = {
  data: 'Data',
  hora: 'Hora',
  numero: 'Número',
  email: 'E-mail',
  telefone: 'Telefone',
  cpf: 'CPF',
}

/** Como fica o valor padronizado. É o que a tela promete e o que o motor grava. */
export const EXEMPLO_PADRONIZADO: Record<FormatoDeResposta, string> = {
  data: '2026-08-21',
  hora: '07:00',
  numero: '1250.5',
  email: 'nome@dominio.com',
  telefone: '5544998887766',
  cpf: '12345678901',
}

/**
 * O que o bot diz quando não entende.
 *
 * São frases nossas e por isso podem ser trocadas por quem desenha o fluxo — o
 * campo "mensagem quando não entender" vence esta lista. O que **não** muda é a
 * forma: dizer o que falta e dar um exemplo. "Formato inválido" não ensina
 * ninguém a responder certo.
 */
export const PEDIDO_PADRAO: Record<FormatoDeResposta, string> = {
  data: 'Desculpe, não entendi a data. Pode escrever de novo com dia, mês e ano? Por exemplo: 21/08/2026.',
  hora: 'Desculpe, não entendi o horário. Pode escrever de novo assim: 07:00.',
  numero: 'Desculpe, não entendi o número. Pode escrever só o valor? Por exemplo: 1250.',
  email: 'Desculpe, esse e-mail não parece completo. Pode escrever de novo? Por exemplo: nome@dominio.com.',
  telefone:
    'Desculpe, não entendi o telefone. Pode mandar com DDD? Por exemplo: (44) 99888-7766.',
  cpf: 'Desculpe, não entendi o CPF. Pode escrever os 11 números? Por exemplo: 123.456.789-01.',
}

export type Conferida =
  /** `valor` é o que a pessoa escreveu, limpo; `padrao` é a forma canônica. */
  | { ok: true; valor: string; padrao: string }
  | { ok: false }

/**
 * A resposta cabe no formato pedido?
 *
 * Sem formato, tudo cabe — é o comportamento que a pergunta livre sempre teve, e
 * há conversa em produção rodando um grafo publicado antes deste campo existir.
 */
export function conferirResposta(
  formato: FormatoDeResposta | undefined,
  texto: string,
): Conferida {
  const valor = texto.trim()
  if (formato === undefined) return { ok: true, valor, padrao: valor }
  if (valor === '') return { ok: false }

  const padrao = padronizar(formato, valor)
  return padrao === null ? { ok: false } : { ok: true, valor, padrao }
}

function padronizar(formato: FormatoDeResposta, valor: string): string | null {
  switch (formato) {
    case 'data':
      return comoData(valor)
    case 'hora':
      return comoHora(valor)
    case 'numero':
      return comoNumero(valor)
    case 'email':
      return comoEmail(valor)
    case 'telefone':
      return comoTelefone(valor)
    case 'cpf':
      return comoCpf(valor)
  }
}

/**
 * `21/08/2026`, `21-08-2026`, `21.08.2026` e `2026-08-21` viram `2026-08-21`.
 *
 * **Ano de quatro dígitos, obrigatório.** Aceitar `21/08` obrigaria a adivinhar
 * o ano a partir do relógio, e `core/` não tem relógio — mas o motivo de fundo é
 * outro: quem está remarcando aula em dezembro e escreve "05/01" quer janeiro do
 * ano que vem, e o palpite acerta metade das vezes. Pedir o ano é uma frase a
 * mais na conversa e zero agendamento no mês errado.
 *
 * O dia é conferido contra o mês: `31/02` casa com o padrão e não existe.
 */
function comoData(valor: string): string | null {
  const isoLike = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(valor)
  const brLike = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(valor)

  const [ano, mes, dia] = isoLike
    ? [Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3])]
    : brLike
      ? [Number(brLike[3]), Number(brLike[2]), Number(brLike[1])]
      : [0, 0, 0]

  if (ano === 0) return null
  if (mes < 1 || mes > 12) return null
  if (dia < 1 || dia > diasDoMes(ano, mes)) return null

  return `${ano}-${dois(mes)}-${dois(dia)}`
}

function diasDoMes(ano: number, mes: number): number {
  if (mes === 2) return bissexto(ano) ? 29 : 28
  return [4, 6, 9, 11].includes(mes) ? 30 : 31
}

const bissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0

/** `7h`, `7h00`, `07:00`, `7 00` e `19h30` viram `07:00` e `19:30`. */
function comoHora(valor: string): string | null {
  const achado = /^(\d{1,2})\s*(?:[:h.]\s*(\d{1,2}))?\s*(?:h|hs|horas?)?$/i.exec(valor)
  if (!achado) return null

  const hora = Number(achado[1])
  const minuto = achado[2] === undefined ? 0 : Number(achado[2])
  if (hora > 23 || minuto > 59) return null

  return `${dois(hora)}:${dois(minuto)}`
}

/**
 * `1.250,50`, `1250.5` e `R$ 1.250` viram `1250.5`.
 *
 * A vírgula decimal é o que se digita no Brasil, e o ponto é o que um JSON
 * aceita. Traduzir aqui evita a variável chegar num corpo de requisição como
 * `1.250,50`, que qualquer API lê como texto ou recusa.
 */
function comoNumero(valor: string): string | null {
  const limpo = valor.replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!/^-?[\d.,]+$/.test(limpo)) return null

  // Só o último separador é decimal; os anteriores são de milhar.
  const ultimo = Math.max(limpo.lastIndexOf(','), limpo.lastIndexOf('.'))
  const inteiro = (ultimo === -1 ? limpo : limpo.slice(0, ultimo)).replace(/[.,]/g, '')
  const decimal = ultimo === -1 ? '' : limpo.slice(ultimo + 1)

  if (decimal.includes(',') || decimal.includes('.')) return null
  // Três casas depois do último separador é milhar, não decimal: `1.250` é mil
  // duzentos e cinquenta, e ninguém escreve preço com três casas.
  if (decimal.length === 3) return String(Number(inteiro + decimal))
  if (!/^-?\d+$/.test(inteiro)) return null
  if (decimal !== '' && !/^\d+$/.test(decimal)) return null

  return decimal === '' ? String(Number(inteiro)) : String(Number(`${inteiro}.${decimal}`))
}

/**
 * E-mail, na régua que vale numa conversa de WhatsApp.
 *
 * Não é a RFC — validar e-mail pela RFC aceita coisas que nenhum provedor
 * entrega e recusa nada que a pessoa vai digitar errado. O que pega o erro real
 * é exigir arroba, um domínio com ponto, e nenhum espaço.
 */
function comoEmail(valor: string): string | null {
  const limpo = valor.trim().toLowerCase()
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(limpo) ? limpo : null
}

/**
 * Telefone brasileiro, com DDD, no formato que a Cloud API usa.
 *
 * Dez ou onze dígitos viram `55` + o número. Doze ou treze já vêm com o país.
 * Não inventa DDD: número sem ele não disca, e um telefone que não disca é um
 * contato que ninguém alcança — melhor pedir de novo do que guardar inútil.
 */
function comoTelefone(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')

  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos
  return null
}

/** Onze dígitos, com o dígito verificador conferido de verdade. */
function comoCpf(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length !== 11) return null
  // `111.111.111-11` passa em qualquer conta de verificador, e é o erro de
  // digitação mais comum de todos.
  if (/^(\d)\1{10}$/.test(digitos)) return null

  for (const [ate, peso] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(digitos[i]) * (peso - i)
    const resto = (soma * 10) % 11
    if ((resto === 10 ? 0 : resto) !== Number(digitos[ate])) return null
  }

  return digitos
}

const dois = (n: number) => String(n).padStart(2, '0')
