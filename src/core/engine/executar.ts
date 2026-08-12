import {
  LIMITE_BOTOES,
  LIMITE_LISTA,
  LIMITE_ROTULO,
  SAIDA_ESCOLHEU,
  SAIDA_FALSO,
  SAIDA_VAZIO,
  SAIDA_VERDADEIRO,
  perguntaEhDinamica,
  type Fluxo,
  type No,
  type NoPergunta,
  type Opcao,
} from '../flow/schema'
import { comoCabecalho, comoJson, comoUrl, interpolar, normalizar } from './interpolar'
import type { Acao, Entrada, Resultado, Sessao } from './types'

/** Na terceira vez que o motor não entende, a conversa vai para uma pessoa. */
export const MAX_TENTATIVAS = 3

/** Trava contra ciclo no desenho. Fluxo real não chega perto disso. */
export const MAX_PASSOS = 100

/**
 * Escape global (§9 da arquitetura): funciona de qualquer nó, sem precisar
 * estar desenhado no fluxo. A lista é curta de propósito — cada termo aqui é
 * uma frase que só quem quer falar com gente escreve.
 */
export const PALAVRAS_ESCAPE = [
  'atendente',
  'humano',
  'falar com alguem',
  'falar com uma pessoa',
  'pessoa de verdade',
  'sair do bot',
]

const MENSAGEM_TRANSFERENCIA = 'Vou te passar para um atendente. Só um instante!'
const MENSAGEM_NAO_ENTENDI = 'Desculpa, não entendi. Pode escolher uma das opções abaixo?'

/**
 * O coração do produto: dado um fluxo, o estado da conversa e o que a pessoa
 * mandou, devolve o que fazer e o novo estado.
 *
 * É uma função pura de propósito. Não fala com banco, não fala com o WhatsApp,
 * não chama modelo de IA, não olha o relógio. Tudo que ela precisa entra por
 * parâmetro e tudo que ela decide sai no retorno. É isso que faz o simulador e
 * a produção rodarem exatamente o mesmo código.
 */
export function executar(fluxo: Fluxo, sessao: Sessao, entrada: Entrada): Resultado {
  const s: Sessao = { ...sessao, vars: { ...sessao.vars } }
  const acoes: Acao[] = []

  // Humano assumiu ou a conversa acabou: o bot fica calado.
  if (s.status === 'humano' || s.status === 'encerrada') {
    return { acoes, sessao: s }
  }

  const porId = indexar(fluxo)

  if (entrada.tipo === 'texto' && pediuHumano(entrada.texto)) {
    return transferir(s, acoes, 'a pessoa pediu para falar com um atendente')
  }

  // Regra B: áudio, imagem e documento vão direto para uma pessoa. Quem manda
  // áudio está engajado — responder "não entendi" mata a conversa.
  if (entrada.tipo === 'midia') {
    return transferir(s, acoes, `a pessoa mandou ${entrada.formato} e o bot só lê texto`)
  }

  if (entrada.tipo === 'inicio') {
    s.tentativas = 0
    return avancar(fluxo, porId, s, acoes, fluxo.inicio)
  }

  const atual = s.noAtual === null ? undefined : porId.get(s.noAtual)

  // A sessão aponta para um nó que não existe mais. Acontece quando alguém
  // republica um fluxo mexendo numa versão já em uso — recomeça em vez de travar.
  if (!atual) {
    s.tentativas = 0
    return avancar(fluxo, porId, s, acoes, fluxo.inicio)
  }

  if (atual.type === 'ia') {
    // A pessoa escreveu enquanto o modelo pensava: ignora, a resposta vem.
    if (entrada.tipo !== 'ia_respondeu') return { acoes, sessao: s }

    acoes.push({ tipo: 'enviar_texto', texto: entrada.texto })
    if (atual.data.salvarEm) s.vars[atual.data.salvarEm] = entrada.texto
    s.tentativas = 0
    return avancar(fluxo, porId, s, acoes, proximo(fluxo, atual.id))
  }

  if (atual.type === 'http') {
    // A pessoa escreveu enquanto a chamada rodava: ignora, a resposta vem.
    if (entrada.tipo !== 'http_respondeu') return { acoes, sessao: s }

    for (const [variavel, valor] of Object.entries(entrada.valores)) {
      s.vars[variavel] = valor
      // Emitir `salvar_campo` faz o dado virar coluna na tela de leads sozinho,
      // porque as colunas de lá saem dos dados.
      acoes.push({ tipo: 'salvar_campo', campo: variavel, valor })
    }

    s.tentativas = 0
    return avancar(fluxo, porId, s, acoes, proximo(fluxo, atual.id))
  }

  if (atual.type === 'pergunta') {
    return responderPergunta(fluxo, porId, s, acoes, atual, entrada)
  }

  // O motor nunca deveria ter parado num nó destes. Segue em frente.
  return avancar(fluxo, porId, s, acoes, proximo(fluxo, atual.id))
}

function responderPergunta(
  fluxo: Fluxo,
  porId: Map<string, No>,
  s: Sessao,
  acoes: Acao[],
  no: NoPergunta,
  entrada: Entrada,
): Resultado {
  const { salvarEm } = no.data
  const dinamica = perguntaEhDinamica(no)
  const opcoes = resolverOpcoes(no, s.vars)

  if (opcoes.length === 0) {
    // Dinâmica sem itens não é resposta livre: é a lista que veio vazia. O
    // `avancar()` já desvia antes de parar aqui, então isto é o cinto de
    // segurança para sessão presa num nó que mudou de configuração.
    if (dinamica) {
      s.tentativas = 0
      return avancar(fluxo, porId, s, acoes, proximo(fluxo, no.id, SAIDA_VAZIO))
    }

    // Resposta livre em texto.
    if (entrada.tipo !== 'texto') return { acoes, sessao: s }
    if (salvarEm) {
      s.vars[salvarEm] = entrada.texto
      acoes.push({ tipo: 'salvar_campo', campo: salvarEm, valor: entrada.texto })
    }
    s.tentativas = 0
    return avancar(fluxo, porId, s, acoes, proximo(fluxo, no.id))
  }

  const escolhida = escolher(opcoes, entrada)

  if (!escolhida) {
    s.tentativas += 1
    if (s.tentativas >= MAX_TENTATIVAS) {
      return transferir(s, acoes, `o bot não entendeu a resposta ${MAX_TENTATIVAS} vezes seguidas`)
    }
    acoes.push({ tipo: 'enviar_texto', texto: MENSAGEM_NAO_ENTENDI })
    acoes.push(perguntar(no, s))
    return { acoes, sessao: s }
  }

  if (salvarEm) {
    s.vars[salvarEm] = escolhida.rotulo
    acoes.push({ tipo: 'salvar_campo', campo: salvarEm, valor: escolhida.rotulo })
  }
  s.tentativas = 0
  // Desenhada ramifica por opção; dinâmica sai por uma porta só, porque não
  // existe aresta desenhada para uma opção que nasceu agora.
  return avancar(
    fluxo,
    porId,
    s,
    acoes,
    proximo(fluxo, no.id, dinamica ? SAIDA_ESCOLHEU : escolhida.id),
  )
}

/**
 * Anda no grafo executando tudo que não precisa esperar ninguém, e para no
 * primeiro nó que precisa (uma pergunta, a IA, ou o humano).
 */
function avancar(
  fluxo: Fluxo,
  porId: Map<string, No>,
  s: Sessao,
  acoes: Acao[],
  primeiro: string | null,
): Resultado {
  let atual = primeiro
  let passos = 0

  while (atual !== null) {
    if (passos++ >= MAX_PASSOS) {
      // Ciclo no desenho. Entregar para uma pessoa é sempre melhor do que
      // prender alguém num labirinto.
      return transferir(s, acoes, 'o fluxo entrou em loop')
    }

    const no = porId.get(atual)
    if (!no) break

    switch (no.type) {
      case 'mensagem': {
        acoes.push({ tipo: 'enviar_texto', texto: interpolar(no.data.texto, s.vars) })
        atual = proximo(fluxo, no.id)
        break
      }

      case 'salvar-campo': {
        const valor = interpolar(no.data.valor, s.vars)
        s.vars[no.data.campo] = valor
        acoes.push({ tipo: 'salvar_campo', campo: no.data.campo, valor })
        atual = proximo(fluxo, no.id)
        break
      }

      case 'condicao': {
        const passou = avaliar(no.data.variavel, no.data.operador, no.data.valor, s.vars)
        atual = proximo(fluxo, no.id, passou ? SAIDA_VERDADEIRO : SAIDA_FALSO)
        break
      }

      case 'pergunta': {
        // Lista dinâmica vazia: não há o que perguntar. Parar aqui deixaria a
        // pessoa olhando uma pergunta sem nenhuma resposta possível — é o
        // "esse dia não tem horário livre" saindo pela saída própria.
        if (perguntaEhDinamica(no) && resolverOpcoes(no, s.vars).length === 0) {
          atual = proximo(fluxo, no.id, SAIDA_VAZIO)
          break
        }

        acoes.push(perguntar(no, s))
        s.noAtual = no.id
        s.status = 'ativa'
        s.tentativas = 0
        return { acoes, sessao: s }
      }

      case 'ia': {
        acoes.push({ tipo: 'chamar_ia', instrucao: interpolar(no.data.instrucao, s.vars) })
        s.noAtual = no.id
        s.status = 'aguardando_ia'
        return { acoes, sessao: s }
      }

      case 'http': {
        acoes.push({
          tipo: 'chamar_http',
          metodo: no.data.metodo,
          // Cada campo escapa do jeito da estrutura em que ele cai. O que a
          // pessoa digitou é entrada de fora: sem isso, ela deixa de preencher
          // um campo e passa a escrever a requisição.
          url: interpolar(no.data.url, s.vars, comoUrl),
          cabecalhos: no.data.cabecalhos.map((c) => ({
            chave: c.chave,
            valor: interpolar(c.valor, s.vars, comoCabecalho),
          })),
          corpo: interpolar(no.data.corpo, s.vars, comoJson),
          mapear: no.data.mapear,
          aoFalhar: no.data.aoFalhar,
          conexaoId: no.data.conexaoId,
        })
        s.noAtual = no.id
        s.status = 'aguardando_http'
        return { acoes, sessao: s }
      }

      case 'handoff': {
        acoes.push({ tipo: 'enviar_texto', texto: interpolar(no.data.mensagem, s.vars) })
        // O motivo também interpola: "lead qualificado - {{tipo}}" chega no
        // painel já dizendo qual lead é, sem ninguém precisar abrir a conversa.
        acoes.push({ tipo: 'transferir_humano', motivo: interpolar(no.data.motivo, s.vars) })
        s.noAtual = no.id
        s.status = 'humano'
        return { acoes, sessao: s }
      }
    }
  }

  s.noAtual = null
  s.status = 'encerrada'
  acoes.push({ tipo: 'encerrar' })
  return { acoes, sessao: s }
}

/**
 * As opções que esta pergunta mostra agora.
 *
 * Desenhadas, é a lista do nó. Dinâmicas, saem de uma variável — texto com os
 * itens separados por `;` ou quebra de linha, que é o formato que sobrevive a
 * `vars` ser `Record<string, string>`. Guardar JSON numa string ali mentiria
 * sobre o tipo; separador não mente, só combina.
 *
 * Os dois cortes são limite da Cloud API, não escolha: acima de 10 itens ou 20
 * caracteres de rótulo a Meta recusa a mensagem inteira. Cortar entrega uma
 * conversa a menos; não cortar entrega conversa nenhuma.
 */
export function resolverOpcoes(no: NoPergunta, vars: Record<string, string>): Opcao[] {
  if (!perguntaEhDinamica(no)) return no.data.opcoes

  return (vars[no.data.opcoesDe as string] ?? '')
    .split(/[;\n]/)
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .slice(0, LIMITE_LISTA)
    .map((rotulo, i) => ({ id: `d${i + 1}`, rotulo: rotulo.slice(0, LIMITE_ROTULO) }))
}

function perguntar(no: NoPergunta, s: Sessao): Acao {
  const texto = interpolar(no.data.texto, s.vars)
  const opcoes = resolverOpcoes(no, s.vars)
  if (opcoes.length === 0) return { tipo: 'enviar_texto', texto }

  return {
    tipo: 'enviar_opcoes',
    texto,
    opcoes,
    // Até 3 opções o WhatsApp mostra como botão, que dá muito mais clique.
    // Acima disso vira lista suspensa.
    formato: opcoes.length <= LIMITE_BOTOES ? 'botoes' : 'lista',
  }
}

/** Casa o que chegou com uma das opções. Aceita clique, texto ou número. */
function escolher(opcoes: Opcao[], entrada: Entrada): Opcao | undefined {
  if (entrada.tipo === 'opcao') {
    return opcoes.find((o) => o.id === entrada.opcaoId)
  }

  if (entrada.tipo !== 'texto') return undefined

  const digitado = normalizar(entrada.texto)
  const porRotulo = opcoes.find((o) => normalizar(o.rotulo) === digitado)
  if (porRotulo) return porRotulo

  // Muita gente responde "1" mesmo tendo botão na tela.
  if (/^\d+$/.test(digitado)) {
    return opcoes[Number(digitado) - 1]
  }

  return undefined
}

function avaliar(
  variavel: string,
  operador: string,
  valorEsperado: string,
  vars: Record<string, string>,
): boolean {
  const atual = normalizar(vars[variavel] ?? '')
  const esperado = normalizar(valorEsperado)

  switch (operador) {
    case 'igual':
      return atual === esperado
    case 'diferente':
      return atual !== esperado
    case 'contem':
      return esperado !== '' && atual.includes(esperado)
    case 'vazio':
      return atual === ''
    case 'preenchido':
      return atual !== ''
    default:
      return false
  }
}

function transferir(s: Sessao, acoes: Acao[], motivo: string): Resultado {
  acoes.push({ tipo: 'enviar_texto', texto: MENSAGEM_TRANSFERENCIA })
  acoes.push({ tipo: 'transferir_humano', motivo })
  s.status = 'humano'
  return { acoes, sessao: s }
}

function proximo(fluxo: Fluxo, noId: string, saida?: string): string | null {
  const saidas = fluxo.edges.filter((a) => a.source === noId)
  if (saida !== undefined) {
    return saidas.find((a) => a.sourceHandle === saida)?.target ?? null
  }
  return saidas[0]?.target ?? null
}

function pediuHumano(texto: string): boolean {
  const t = normalizar(texto)
  return PALAVRAS_ESCAPE.some((palavra) => t.includes(palavra))
}

function indexar(fluxo: Fluxo): Map<string, No> {
  return new Map(fluxo.nodes.map((no) => [no.id, no]))
}
