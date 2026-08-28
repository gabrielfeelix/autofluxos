import type { Argumento, Ferramenta } from '@/core/ferramentas'
import { limparQueryVazia } from '@/core/ferramentas'

/**
 * O que fazer com o que o modelo pediu — antes de qualquer coisa sair para a
 * rede.
 *
 * **Está separado do resolvedor de propósito, e não por organização.** Este é
 * o pedaço onde moram as travas do §4, e trava que não tem teste é promessa.
 * Aqui não há rede, cofre nem banco: entra o que o modelo mandou, sai uma
 * chamada montada ou uma recusa com motivo. O resolvedor cuida do resto.
 *
 * A postura é a mesma do resto da casa, e vale repetir porque ela decide todo
 * caso duvidoso: **entre calar e inventar, uma pessoa assume**. Toda recusa
 * daqui vira handoff, nunca um chute.
 */

export type ChamadaMontada = {
  ferramenta: Ferramenta
  url: string
  corpo: string
  /**
   * Os argumentos **como saíram**: já conferidos, já com o que o servidor
   * injetou por cima do que o modelo mandou.
   *
   * É o que vai para o log, e a diferença importa: registrar o que o modelo
   * pediu esconderia justamente a coisa que alguém vai querer conferir depois,
   * que é o que de fato chegou à API do cliente.
   */
  valores: Record<string, string>
}

export type Conferencia =
  | { ok: true; chamada: ChamadaMontada }
  | { ok: false; motivo: string }

/**
 * O que a conversa já viu, e que o modelo pode usar.
 *
 * Vive uma mensagem, e não a conversa inteira: os ids de horário mudam a cada
 * consulta, e aceitar um id que apareceu há três mensagens seria aceitar
 * marcar numa vaga que já foi. Quem precisa atravessar mensagens é o fluxo, com
 * variável — que é o mecanismo que já existe para isso.
 */
export type MemoriaDaRodada = {
  /** Ids que apareceram em resultado de ferramenta nesta rodada. */
  ids: Set<string>
  /** `nome(argumentos)` já pedidos, para pegar o modelo repetindo. */
  jaPedidos: Set<string>
}

export function novaMemoria(): MemoriaDaRodada {
  return { ids: new Set(), jaPedidos: new Set() }
}

/** A assinatura de um pedido, para reconhecer repetição. */
export function assinatura(nome: string, argumentos: Record<string, string>): string {
  const pares = Object.entries(argumentos)
    .filter(([, v]) => v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
  return `${nome}(${pares.join('&')})`
}

/**
 * Confere o pedido do modelo e monta a chamada, ou recusa.
 *
 * A ordem das conferências não é arbitrária — vai da mais barata e mais
 * decisiva para a mais específica, para que a recusa cite a primeira coisa
 * errada e não a última.
 */
export function conferirPedido({
  nome,
  argumentos,
  permitidas,
  injetados,
  memoria,
}: {
  nome: string
  argumentos: Record<string, string>
  /** Só as ferramentas que **este nó** autorizou. */
  permitidas: readonly Ferramenta[]
  /** O que o servidor sabe e o modelo não escolhe: `pessoa_id`, etc. */
  injetados: Record<string, string>
  memoria: MemoriaDaRodada
}): Conferencia {
  /*
   * A whitelist é a primeira porta, e é a que importa.
   *
   * Não basta a ferramenta existir no catálogo: ela tem que estar na lista
   * deste nó. Um bloco de IA que só tira dúvida não vira um que desmarca aula
   * porque o modelo conhece o nome de outra ferramenta.
   */
  const ferramenta = permitidas.find((f) => f.nome === nome)
  if (!ferramenta) return { ok: false, motivo: `pediu "${nome}", que este bloco não autoriza` }

  if (memoria.jaPedidos.has(assinatura(nome, argumentos))) {
    /*
     * Repetir o mesmo pedido é o modelo não tendo lido o resultado.
     *
     * Acontece: o resultado volta como texto na conversa, e não pelo protocolo
     * nativo de resposta de função. É uma escolha consciente (ver
     * `gemini.ts`), e este é o preço dela — pago aqui, uma vez, em vez de virar
     * um laço que consome a rodada inteira e termina em silêncio.
     */
    return { ok: false, motivo: `repetiu a consulta "${nome}" sem usar o que já recebeu` }
  }

  const valores: Record<string, string> = {}

  for (const argumento of ferramenta.argumentos) {
    const bruto = argumentos[argumento.nome]
    const valor = typeof bruto === 'string' ? bruto.trim() : ''

    if (valor === '') {
      if (argumento.obrigatorio) {
        return { ok: false, motivo: `chamou "${nome}" sem "${argumento.nome}", que é obrigatório` }
      }
      valores[argumento.nome] = ''
      continue
    }

    const problema = conferirValor(argumento, valor, memoria)
    if (problema) return { ok: false, motivo: `em "${nome}": ${problema}` }

    valores[argumento.nome] = valor
  }

  /*
   * O que o servidor injeta entra por último e **sobrescreve**.
   *
   * Sobrescrever em vez de recusar é de propósito: um modelo mandando
   * `pessoa_id` não é necessariamente ataque, é frequentemente ele sendo
   * prestativo com um id que viu passar. Recusar a conversa por isso seria
   * mandar gente para atendimento humano à toa. O que não pode acontecer é o
   * valor dele valer — e não vale.
   */
  for (const campo of ferramenta.injetados) {
    const valor = injetados[campo]
    if (valor === undefined || valor === '') {
      return { ok: false, motivo: `"${nome}" precisa de ${campo}, e a conversa não tem esse dado` }
    }
    valores[campo] = valor
  }

  return {
    ok: true,
    chamada: {
      ferramenta,
      url: limparQueryVazia(preencher(ferramenta.chamada.url, valores, encodeURIComponent)),
      corpo: preencher(ferramenta.chamada.corpo, valores, escaparJson),
      valores,
    },
  }
}

/** Os campos injetados que o modelo tentou preencher. Para o log. */
export function camposInjetadosTentados(
  ferramenta: Ferramenta,
  argumentos: Record<string, string>,
): string[] {
  return ferramenta.injetados.filter((campo) => campo in argumentos)
}

function conferirValor(
  argumento: Argumento,
  valor: string,
  memoria: MemoriaDaRodada,
): string | null {
  if (argumento.tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    /*
     * Data em outro formato é recusada, e não convertida.
     *
     * Converter exigiria adivinhar se `05/01` é 5 de janeiro ou 1 de maio, e
     * a metade errada do palpite é um agendamento meses fora. É a mesma regra
     * que a pergunta de fluxo já aplica.
     */
    return `"${argumento.nome}" precisa estar em AAAA-MM-DD, e veio "${valor}"`
  }

  if (argumento.soDeResultadoAnterior && !memoria.ids.has(valor)) {
    /*
     * A trava que fecha o buraco que `injetados` sozinho não fecha.
     *
     * `pessoa_id` injetado garante que toda leitura é escopada em quem
     * conversa — logo, todo id que o modelo legitimamente conhece é de quem
     * conversa. Um id que a rodada não viu só pode ter três origens: o modelo
     * alucinou, alguém escreveu no WhatsApp, ou veio de um resultado velho. As
     * três terminam na mesma frase: não se grava por cima disso.
     */
    return `"${argumento.nome}" não é um identificador que apareceu nesta consulta`
  }

  return null
}

/**
 * Preenche `{{campo}}` com escape.
 *
 * O que chega aqui foi escrito por um modelo em cima de texto de um estranho —
 * é entrada de fora, e vale a mesma regra do motor: cada campo escapa do jeito
 * da estrutura em que ele cai. Sem isso, um argumento com `&` reescreve a
 * consulta e um com `"` quebra o JSON do corpo.
 *
 * Marca sem valor vira vazio, e não fica literal: `{{servico}}` sobrando na
 * URL sairia como texto para a API do cliente.
 */
function preencher(
  molde: string,
  valores: Record<string, string>,
  escapar: (v: string) => string,
): string {
  return molde.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, campo: string) =>
    escapar(valores[campo] ?? ''),
  )
}

function escaparJson(valor: string): string {
  // `JSON.stringify` devolve com aspas em volta; o molde já tem as dele.
  const comAspas = JSON.stringify(valor)
  return comAspas.slice(1, -1)
}
