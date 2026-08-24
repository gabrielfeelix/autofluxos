/**
 * A formatação do WhatsApp, lida.
 *
 * O produto sempre soube **escrever** `*negrito*` — a barra de formatação do
 * editor põe as marcas, e o WhatsApp as renderiza no celular de quem recebe.
 * O que faltava era **ler**: a aba Testar mostrava o texto cru, com os
 * asteriscos à mostra, e quem estava usando concluiu — corretamente, pelo que
 * via — que "negrito não funciona, ele só coloca * na escrita *".
 *
 * O teste é onde se decide se a mensagem está boa. Se ele mostra uma coisa e o
 * WhatsApp mostra outra, o teste não serve para a única pergunta que ele
 * responde.
 *
 * **Nada aqui muda o que é gravado.** O fluxo continua guardando `*negrito*`,
 * que é exatamente o que sai para a Meta; isto é a leitura, e mora em `core/`
 * porque é regra pura e testável — sem React, sem DOM, sem rede.
 *
 * As regras são as que a Meta documenta:
 *
 * | Marca | Vira |
 * |---|---|
 * | `*texto*` | negrito |
 * | `_texto_` | itálico |
 * | `~texto~` | riscado |
 * | ` ```texto``` ` | monoespaçado |
 *
 * E as duas que ninguém documenta mas todo mundo depende:
 *
 * - **marca colada em espaço não vale.** `2 * 3 * 4` é uma conta, não um
 *   negrito, e é assim que o WhatsApp trata;
 * - **dentro do monoespaçado nada mais vale.** É onde se cola código, e código
 *   tem asterisco.
 */

export type MarcaDeTexto = 'negrito' | 'italico' | 'riscado' | 'mono'

export type Trecho =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'marca'; marca: MarcaDeTexto; filhos: Trecho[] }

const SIMPLES: { simbolo: string; marca: MarcaDeTexto }[] = [
  { simbolo: '*', marca: 'negrito' },
  { simbolo: '_', marca: 'italico' },
  { simbolo: '~', marca: 'riscado' },
]

const MONO = '```'

/**
 * Quebra o texto em trechos formatados.
 *
 * Texto sem marca nenhuma devolve um único trecho — o caminho de longe mais
 * comum, e o que não deve pagar nada.
 */
export function interpretarMarcacao(texto: string): Trecho[] {
  const trechos: Trecho[] = []
  let solto = ''

  const despejar = () => {
    if (solto !== '') {
      trechos.push({ tipo: 'texto', texto: solto })
      solto = ''
    }
  }

  let i = 0
  while (i < texto.length) {
    if (texto.startsWith(MONO, i)) {
      const fim = texto.indexOf(MONO, i + MONO.length)
      if (fim !== -1 && fim > i + MONO.length) {
        despejar()
        // Sem recursão: dentro do monoespaçado, asterisco é asterisco.
        trechos.push({
          tipo: 'marca',
          marca: 'mono',
          filhos: [{ tipo: 'texto', texto: texto.slice(i + MONO.length, fim) }],
        })
        i = fim + MONO.length
        continue
      }
    }

    const simples = SIMPLES.find((s) => texto[i] === s.simbolo)
    if (simples) {
      const fim = fecharEm(texto, i, simples.simbolo)
      if (fim !== -1) {
        despejar()
        trechos.push({
          tipo: 'marca',
          marca: simples.marca,
          filhos: interpretarMarcacao(texto.slice(i + 1, fim)),
        })
        i = fim + 1
        continue
      }
    }

    solto += texto[i]
    i += 1
  }

  despejar()
  return trechos
}

/**
 * Onde a marca aberta em `abre` fecha, ou `-1`.
 *
 * As duas condições são o que separa `*negrito*` de uma multiplicação: o
 * conteúdo não pode começar nem terminar com espaço, e não pode ser vazio.
 */
function fecharEm(texto: string, abre: number, simbolo: string): number {
  const depoisDaAbertura = texto[abre + 1]
  if (depoisDaAbertura === undefined || /\s/.test(depoisDaAbertura)) return -1

  for (let i = abre + 2; i < texto.length; i++) {
    if (texto[i] !== simbolo) continue
    const antesDoFecho = texto[i - 1]
    if (antesDoFecho !== undefined && !/\s/.test(antesDoFecho)) return i
  }
  return -1
}

/** O texto sem as marcas. Serve para contar, medir e comparar. */
export function semMarcacao(texto: string): string {
  return interpretarMarcacao(texto)
    .map(function achatar(trecho): string {
      return trecho.tipo === 'texto' ? trecho.texto : trecho.filhos.map(achatar).join('')
    })
    .join('')
}
