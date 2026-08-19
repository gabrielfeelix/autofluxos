import { partesDaMensagem } from '../flow/mensagem'
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
 * O que o motor precisa saber sobre **o mundo em volta** para transferir bem.
 *
 * Entra por parâmetro, e não por relógio lido aqui dentro, porque o motor é
 * puro: o simulador e a produção rodam exatamente o mesmo código, e um teste
 * que dependesse de dar meia-noite não seria teste. Quem lê a hora é o
 * servidor, com o fuso da conta (ver `core/horario.ts`).
 *
 * O padrão — aberto, sem previsão — é o comportamento que o produto sempre
 * teve, então nenhum chamador antigo muda.
 */
export type ContextoDoAtendimento = {
  /** Tem gente para atender agora? */
  atendimentoAberto: boolean
  /** Quando abre de novo, em palavras: "amanhã a partir das 08:00". */
  proximaAbertura: string | null
}

export const ATENDIMENTO_SEMPRE_ABERTO: ContextoDoAtendimento = {
  atendimentoAberto: true,
  proximaAbertura: null,
}

/**
 * O que a pessoa ouve quando o bot desiste fora do expediente.
 *
 * **É a frase que salva a conversa.** Sem ela o handoff acontece às 3h da
 * manhã, o bot cala, e quem escreveu fica olhando para uma conversa parada sem
 * saber se alguém vem. "Estamos fechados" sozinho não resolve: não diz até
 * quando, e quem não sabe até quando vai embora.
 */
export function avisoDeForaDoHorario(contexto: ContextoDoAtendimento): string | null {
  if (contexto.atendimentoAberto) return null

  return contexto.proximaAbertura
    ? `Nosso atendimento está fechado agora — voltamos ${contexto.proximaAbertura}. Deixe sua mensagem que a gente responde por aqui assim que abrir. 🙌`
    : 'Nosso atendimento está fechado agora. Deixe sua mensagem que a gente responde por aqui assim que abrir. 🙌'
}

/**
 * O coração do produto: dado um fluxo, o estado da conversa e o que a pessoa
 * mandou, devolve o que fazer e o novo estado.
 *
 * É uma função pura de propósito. Não fala com banco, não fala com o WhatsApp,
 * não chama modelo de IA, não olha o relógio. Tudo que ela precisa entra por
 * parâmetro e tudo que ela decide sai no retorno. É isso que faz o simulador e
 * a produção rodarem exatamente o mesmo código.
 */
export function executar(
  fluxo: Fluxo,
  sessao: Sessao,
  entrada: Entrada,
  contexto: ContextoDoAtendimento = ATENDIMENTO_SEMPRE_ABERTO,
): Resultado {
  const s: Sessao = { ...sessao, vars: { ...sessao.vars } }
  const acoes: Acao[] = []

  // Humano assumiu ou a conversa acabou: o bot fica calado.
  if (s.status === 'humano' || s.status === 'encerrada') {
    return { acoes, sessao: s }
  }

  const porId = indexar(fluxo)

  if (entrada.tipo === 'texto' && pediuAtendente(entrada.texto)) {
    return transferir(s, acoes, 'a pessoa pediu para falar com um atendente', contexto)
  }

  // Regra B: áudio, imagem e documento vão direto para uma pessoa. Quem manda
  // áudio está engajado — responder "não entendi" mata a conversa.
  if (entrada.tipo === 'midia') {
    return transferir(s, acoes, `a pessoa mandou ${entrada.formato} e o bot só lê texto`, contexto)
  }

  if (entrada.tipo === 'inicio') {
    s.tentativas = 0
    return avancar(contexto, fluxo, porId, s, acoes, fluxo.inicio)
  }

  const atual = s.noAtual === null ? undefined : porId.get(s.noAtual)

  // A sessão aponta para um nó que não existe mais. Acontece quando alguém
  // republica um fluxo mexendo numa versão já em uso — recomeça em vez de travar.
  if (!atual) {
    s.tentativas = 0
    return avancar(contexto, fluxo, porId, s, acoes, fluxo.inicio)
  }

  if (atual.type === 'ia') {
    // A pessoa escreveu enquanto o modelo pensava: ignora, a resposta vem.
    if (entrada.tipo !== 'ia_respondeu') return { acoes, sessao: s }

    acoes.push({ tipo: 'enviar_texto', texto: entrada.texto })
    if (atual.data.salvarEm) s.vars[atual.data.salvarEm] = entrada.texto
    s.tentativas = 0
    return avancar(contexto, fluxo, porId, s, acoes, proximo(fluxo, atual.id))
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
    return avancar(contexto, fluxo, porId, s, acoes, proximo(fluxo, atual.id))
  }

  if (atual.type === 'pergunta') {
    return responderPergunta(contexto, fluxo, porId, s, acoes, atual, entrada)
  }

  // O motor nunca deveria ter parado num nó destes. Segue em frente.
  return avancar(contexto, fluxo, porId, s, acoes, proximo(fluxo, atual.id))
}

function responderPergunta(
  contexto: ContextoDoAtendimento,
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
      return avancar(contexto, fluxo, porId, s, acoes, proximo(fluxo, no.id, SAIDA_VAZIO))
    }

    // Resposta livre em texto.
    if (entrada.tipo !== 'texto') return { acoes, sessao: s }
    if (salvarEm) {
      s.vars[salvarEm] = entrada.texto
      acoes.push({ tipo: 'salvar_campo', campo: salvarEm, valor: entrada.texto })
    }
    s.tentativas = 0
    return avancar(contexto, fluxo, porId, s, acoes, proximo(fluxo, no.id))
  }

  const escolhida = escolher(opcoes, entrada)

  if (!escolhida) {
    s.tentativas += 1
    if (s.tentativas >= MAX_TENTATIVAS) {
      return transferir(
        s,
        acoes,
        `o bot não entendeu a resposta ${MAX_TENTATIVAS} vezes seguidas`,
        contexto,
      )
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
    contexto,
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
  contexto: ContextoDoAtendimento,
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
      return transferir(s, acoes, 'o fluxo entrou em loop', contexto)
    }

    const no = porId.get(atual)
    if (!no) break

    switch (no.type) {
      case 'mensagem': {
        /**
         * O bloco virou uma pilha, e cada pedaço vira uma ação.
         *
         * `partesDaMensagem` lê os **dois** formatos — o grafo antigo, com
         * `{ texto }`, e o novo, com `partes`. Nada aqui sabe qual dos dois
         * chegou, e é essa ignorância que mantém viva a conversa presa a uma
         * versão publicada antes desta mudança.
         */
        let esperaMs = 0

        for (const parte of partesDaMensagem(no)) {
          switch (parte.tipo) {
            case 'atraso':
              /**
               * O atraso não é uma ação: ele **atrasa a próxima**.
               *
               * Podia ser uma ação `esperar`, e aí toda camada de entrega —
               * WhatsApp, mock, simulador — precisaria aprender a dormir. Como
               * `atrasoMs` do envio seguinte, o contrato que já existe continua
               * valendo e o formato antigo (`data.atraso`, que sempre foi o
               * atraso *do* envio) produz exatamente as mesmas ações de antes.
               *
               * Somar em vez de substituir: dois atrasos seguidos são a espera
               * que a pessoa desenhou, e o teto de cada um já foi conferido no
               * schema.
               */
              esperaMs += parte.segundos * 1_000
              break

            case 'texto':
              acoes.push({
                tipo: 'enviar_texto',
                texto: interpolar(parte.texto, s.vars),
                ...(esperaMs > 0 ? { atrasoMs: esperaMs } : {}),
              })
              esperaMs = 0
              break

            case 'midia': {
              const legenda = parte.legenda ? interpolar(parte.legenda, s.vars) : ''
              acoes.push({
                tipo: 'enviar_midia',
                midia: parte.midia,
                url: interpolar(parte.url, s.vars),
                // `audio` não aceita legenda — regra do formato, não do canal.
                ...(legenda !== '' && parte.midia !== 'audio' ? { legenda } : {}),
                ...(parte.nomeArquivo && parte.midia === 'documento'
                  ? { nomeArquivo: interpolar(parte.nomeArquivo, s.vars) }
                  : {}),
                ...(esperaMs > 0 ? { atrasoMs: esperaMs } : {}),
              })
              esperaMs = 0
              break
            }

            case 'salvar': {
              const valor = interpolar(parte.valor, s.vars)
              s.vars[parte.campo] = valor
              acoes.push({ tipo: 'salvar_campo', campo: parte.campo, valor })
              break
            }

            case 'auto-off':
              acoes.push({ tipo: 'pausar_automacao' })
              break
          }
        }

        atual = proximo(fluxo, no.id)
        break
      }

      case 'midia': {
        const legenda = no.data.legenda ? interpolar(no.data.legenda, s.vars) : ''
        acoes.push({
          tipo: 'enviar_midia',
          midia: no.data.midia,
          // A URL interpola porque catálogo por variável é o caso real: o nó de
          // API devolve o link do plano escolhido e a mídia manda aquele.
          url: interpolar(no.data.url, s.vars),
          // `audio` não aceita legenda, e a decisão é aqui e não no adaptador:
          // é regra do formato, não do canal. Se o WhatsApp saísse de cena
          // amanhã, áudio com legenda continuaria não existindo.
          ...(legenda !== '' && no.data.midia !== 'audio' ? { legenda } : {}),
          ...(no.data.nomeArquivo && no.data.midia === 'documento'
            ? { nomeArquivo: interpolar(no.data.nomeArquivo, s.vars) }
            : {}),
          ...(no.data.atraso ? { atrasoMs: no.data.atraso * 1_000 } : {}),
        })
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

        // Vale para o handoff desenhado também: o bloco pode dizer "já te
        // passo para o time", e às 3h da manhã isso é uma promessa que ninguém
        // cumpre até de manhã.
        const aviso = avisoDeForaDoHorario(contexto)
        if (aviso) acoes.push({ tipo: 'enviar_texto', texto: aviso })

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

/**
 * Passa a conversa para uma pessoa — dizendo a verdade sobre a hora.
 *
 * **Fora do expediente o aviso substitui a frase padrão, não se soma a ela.**
 * "Vou te passar para um atendente. Só um instante!" seguido de "estamos
 * fechados" são duas mensagens que se contradizem, e a primeira é uma promessa
 * que ninguém cumpre até de manhã. Como a frase padrão é nossa, trocar é de
 * graça.
 *
 * O que **não** é nosso é o texto do bloco de handoff, que o cliente escreveu.
 * Lá o aviso entra como segunda linha (ver o `case 'handoff'`): engolir o que
 * ele escreveu para caber um aviso nosso seria decidir por ele.
 */
function transferir(
  s: Sessao,
  acoes: Acao[],
  motivo: string,
  contexto: ContextoDoAtendimento,
): Resultado {
  const aviso = avisoDeForaDoHorario(contexto)
  acoes.push({ tipo: 'enviar_texto', texto: aviso ?? MENSAGEM_TRANSFERENCIA })
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

/**
 * A pessoa pediu para falar com gente.
 *
 * Exportada porque o escape **tem que ganhar dos gatilhos do cliente** (A6). A
 * decisão de qual fluxo abrir acontece no servidor, antes do motor rodar; se
 * ela não conhecesse esta lista, um gatilho com a palavra "atendente" — ou
 * qualquer frase que apareça dentro de "quero falar com uma pessoa" — engoliria
 * o pedido e mandaria a pessoa para um fluxo em vez de para alguém.
 */
export function pediuAtendente(texto: string): boolean {
  const t = normalizar(texto)
  return PALAVRAS_ESCAPE.some((palavra) => t.includes(palavra))
}

function indexar(fluxo: Fluxo): Map<string, No> {
  return new Map(fluxo.nodes.map((no) => [no.id, no]))
}
