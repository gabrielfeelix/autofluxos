import { mensagensDoHandoff, partesDaMensagem } from '../flow/mensagem'
import { PEDIDO_PADRAO, conferirResposta } from '../flow/resposta'
import {
  LIMITE_BOTOES,
  LIMITE_LISTA,
  LIMITE_ROTULO,
  SAIDA_ESCOLHEU,
  SAIDA_FALSO,
  SAIDA_MIDIA,
  SAIDA_TIMEOUT,
  SAIDA_VAZIO,
  SAIDA_VERDADEIRO,
  itensDaLista,
  perguntaEhDinamica,
  timeoutDaPergunta,
  type Fluxo,
  type No,
  type NoPergunta,
  type Opcao,
} from '../flow/schema'
import { cortarCaracteres } from '../flow/texto'
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

  /*
   * Regra B: áudio, imagem e documento vão para uma pessoa — **a não ser que o
   * desenho diga o que fazer com eles**.
   *
   * O padrão continua o mesmo, e por isso todo fluxo já publicado se comporta
   * igual: sem a saída `midia` ligada na pergunta em que a conversa parou, a
   * transferência acontece como sempre aconteceu. O que mudou é que agora
   * existe como dizer "aqui a foto É a resposta" — a receita da farmácia, a
   * planta do imóvel, a foto do pet.
   */
  if (entrada.tipo === 'midia') {
    const parada = s.noAtual === null ? undefined : porId.get(s.noAtual)
    const tratada =
      parada?.type === 'pergunta' ? proximo(fluxo, parada.id, SAIDA_MIDIA) : null

    if (parada?.type === 'pergunta' && tratada !== null) {
      const { salvarMidiaEm } = parada.data
      if (salvarMidiaEm) {
        // Sem id (simulador, canal que não manda) guarda o formato: é melhor
        // que vazio para quem escreveu "recebi seu {{comprovante}}".
        const valor = entrada.midiaId ?? entrada.formato
        s.vars[salvarMidiaEm] = valor
        acoes.push({ tipo: 'salvar_campo', campo: salvarMidiaEm, valor })
      }

      // A legenda da foto é resposta escrita, e quem desenhou pediu para
      // guardar a resposta: jogá-la fora obrigaria a perguntar de novo o que a
      // pessoa já escreveu.
      const legenda = (entrada.legenda ?? '').trim()
      if (legenda !== '' && parada.data.salvarEm) {
        s.vars[parada.data.salvarEm] = legenda
        acoes.push({ tipo: 'salvar_campo', campo: parada.data.salvarEm, valor: legenda })
      }

      s.tentativas = 0
      return avancar(contexto, fluxo, porId, s, acoes, tratada)
    }

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
    // Timeout de uma conversa cujo nó sumiu não recomeça o fluxo: acordar
    // alguém com a saudação do zero, sozinho, é pior do que não acordar.
    if (entrada.tipo === 'timeout') return { acoes, sessao: s }
    s.tentativas = 0
    return avancar(contexto, fluxo, porId, s, acoes, fluxo.inicio)
  }

  /**
   * O prazo acabou.
   *
   * **Sem saída desenhada, vai para uma pessoa.** Quem parou de responder no
   * meio de uma triagem é o lead que mais vale a pena resgatar, e encerrar
   * calado seria sumir com ele. Encerrar só acontece se o cliente tiver
   * desenhado a saída `timeout` para uma despedida.
   *
   * Só vale parado numa pergunta: o agendador não agenda timeout para outra
   * coisa, e uma tarefa velha chegando depois de a conversa ter andado não
   * pode empurrar ninguém.
   */
  if (entrada.tipo === 'timeout') {
    if (atual.type !== 'pergunta' || timeoutDaPergunta(atual) === null) {
      return { acoes, sessao: s }
    }

    const saida = proximo(fluxo, atual.id, SAIDA_TIMEOUT)
    if (saida === null) {
      return transferir(s, acoes, 'ninguém respondeu dentro do prazo da pergunta', contexto)
    }

    s.tentativas = 0
    return avancar(contexto, fluxo, porId, s, acoes, saida)
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

    /*
     * A resposta cabe no formato pedido?
     *
     * **Antes disto, "me manda a data" aceitava "amanhã".** O valor ia para a
     * variável, o fluxo seguia, e o bloco de API mandava aquilo para o sistema
     * do cliente — que responde erro, ou pior, aceita. Recusar aqui é conversa,
     * não falha: o bot diz o que espera e continua parado na mesma pergunta.
     *
     * A régua de desistir é a mesma do menu que ninguém acerta: três tentativas
     * e a conversa vai para uma pessoa. Insistir para sempre com quem não
     * consegue responder é a definição de bot ruim.
     */
    const conferida = conferirResposta(no.data.formato, entrada.texto)
    if (!conferida.ok) {
      s.tentativas += 1
      if (s.tentativas >= MAX_TENTATIVAS) {
        return transferir(
          s,
          acoes,
          `o bot não entendeu a resposta ${MAX_TENTATIVAS} vezes seguidas`,
          contexto,
        )
      }
      // A frase do cliente vence a nossa, e interpola como qualquer mensagem —
      // "{{nome}}, pode escrever a data assim: 21/08/2026?" é o uso real.
      acoes.push({
        tipo: 'enviar_texto',
        texto: interpolar(mensagemDeRecusa(no), s.vars),
      })
      return { acoes, sessao: s }
    }

    if (salvarEm) {
      s.vars[salvarEm] = conferida.valor
      acoes.push({ tipo: 'salvar_campo', campo: salvarEm, valor: conferida.valor })
    }
    // O padronizado é o que o bloco seguinte manda para a API: `2026-08-21` de
    // um `21/08/2026`. Só existe quando quem desenhou pediu por ele.
    const { salvarPadraoEm } = no.data
    if (salvarPadraoEm) {
      s.vars[salvarPadraoEm] = conferida.padrao
      acoes.push({ tipo: 'salvar_campo', campo: salvarPadraoEm, valor: conferida.padrao })
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

  // O valor da escolha, quando a lista veio pareada. É o que o `POST` seguinte
  // manda para o sistema do cliente.
  const { salvarValorEm } = no.data
  if (salvarValorEm) {
    const valor = valorDaOpcao(no, s.vars, escolhida) ?? ''
    s.vars[salvarValorEm] = valor
    acoes.push({ tipo: 'salvar_campo', campo: salvarValorEm, valor })
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

      case 'etapa': {
        // Sem quadro ou sem etapa escolhidos o bloco não faz nada e a conversa
        // segue. O `validar()` recusa publicar assim; aqui a defesa é para o
        // grafo que já estava no ar quando a etapa foi apagada — e nesse caso
        // seguir é o único desfecho aceitável, porque a alternativa é a
        // conversa de alguém morrer por causa de uma arrumação no quadro.
        if (no.data.quadroId && no.data.colunaId) {
          acoes.push({
            tipo: 'mover_etapa',
            quadroId: no.data.quadroId,
            colunaId: no.data.colunaId,
          })
        }
        atual = proximo(fluxo, no.id)
        break
      }

      /*
       * Voltar para um ponto anterior da mesma conversa.
       *
       * **Não é uma ação, é um desvio** — o motor simplesmente continua a
       * partir de outro nó, do mesmo jeito que continuaria por uma seta. Por
       * isso não há nada para o servidor resolver depois, e nada que possa
       * falhar: o destino ou existe no grafo, ou o bloco não faz nada.
       *
       * `MAX_PASSOS` é a rede embaixo disto. Um "voltar" que aponta para
       * depois de si mesmo é um ciclo sem nenhuma pergunta no meio, e ele
       * gira até o teto e vira handoff — que é o desfecho certo para um
       * desenho que prende alguém.
       */
      case 'voltar': {
        const destino = no.data.destino || fluxo.inicio

        /*
         * Destino que não existe mais **segue em frente**, e não trava.
         *
         * `validar()` recusa publicar assim, então isto só alcança grafo que
         * já estava no ar quando o bloco de destino foi apagado. É a mesma
         * defesa do bloco de etapa e do de ir-fluxo, e pelo mesmo motivo:
         * uma conversa viva não pode morrer por causa de uma edição.
         */
        if (!porId.has(destino)) {
          atual = proximo(fluxo, no.id)
          break
        }

        atual = destino
        break
      }

      case 'ir-fluxo': {
        // Sem destino escolhido o bloco não faz nada e a conversa segue — a
        // mesma defesa do bloco de etapa, e pelo mesmo motivo: `validar()`
        // recusa publicar assim, então isto só alcança grafo que já estava no
        // ar quando o destino sumiu. Seguir é melhor do que travar alguém.
        if (!no.data.fluxoId) {
          atual = proximo(fluxo, no.id)
          break
        }

        acoes.push({ tipo: 'ir_para_fluxo', fluxoId: no.data.fluxoId })
        // Fica parado neste nó: quem resolve o salto é o servidor, e se ele não
        // conseguir (destino desligado, despublicado, apagado) a conversa
        // precisa estar num lugar conhecido para ir a uma pessoa.
        s.noAtual = no.id
        s.status = 'ativa'
        return { acoes, sessao: s }
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
        // Todas as mensagens do bloco, em ordem, antes de a conversa mudar de
        // mão: é onde cabe a despedida do bot (o obrigado, o pedido de nota)
        // sem competir com o aviso de que um humano assume. Vazia não vira
        // mensagem — o WhatsApp recusa texto vazio, e o validador já barra
        // publicar assim.
        for (const mensagem of mensagensDoHandoff(no)) {
          if (mensagem.trim() === '') continue
          acoes.push({ tipo: 'enviar_texto', texto: interpolar(mensagem, s.vars) })
        }

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

  return itensDaLista(vars[no.data.opcoesDe as string] ?? '')
    .slice(0, LIMITE_LISTA)
    .map((rotulo, i) => ({ id: `d${i + 1}`, rotulo: cortarCaracteres(rotulo, LIMITE_ROTULO) }))
}

/**
 * O valor por trás da opção escolhida numa pergunta dinâmica.
 *
 * **O rótulo é o que a pessoa lê; o valor é o que o sistema do cliente
 * entende.** O produto tratava os dois como a mesma coisa, e o efeito era um
 * beco: o menu de horários guardava `"07:00"` e o `POST` seguinte precisava do
 * `sessaoId`, que não estava em lugar nenhum da conversa.
 *
 * A correspondência é **por posição**, e por isso as duas listas têm que sair do
 * mesmo `[]` da mesma resposta. Quando a de valores é mais curta, o que falta
 * vira vazio — inventar um id seria pior do que não ter um, porque o pedido
 * seguinte iria para o registro errado de alguém.
 *
 * Não vale para pergunta desenhada: ali a opção já tem id próprio e uma aresta
 * saindo dela, que é a ramificação inteira.
 */
export function valorDaOpcao(
  no: NoPergunta,
  vars: Record<string, string>,
  opcao: Opcao,
): string | null {
  /*
   * Opção desenhada à mão: o valor está nela mesma. Sem `valor` preenchido,
   * devolve `null` e quem chamou guarda o rótulo — que é o que sempre houve.
   */
  if (!perguntaEhDinamica(no)) {
    const escrito = (opcao.valor ?? '').trim()
    return escrito === '' ? null : escrito
  }

  const de = (no.data.valoresDe ?? '').trim()
  if (de === '') return null

  // Os ids das opções dinâmicas são `d1`, `d2`, … — a posição é o próprio id.
  const posicao = Number(opcao.id.slice(1))
  if (!Number.isInteger(posicao) || posicao < 1) return null

  return itensDaLista(vars[de] ?? '')[posicao - 1] ?? ''
}

/**
 * A frase de quando o bot não entende a resposta livre.
 *
 * A do cliente vence a nossa. As nossas dizem o que falta **e dão um exemplo**,
 * porque "formato inválido" não ensina ninguém a responder certo — e quem não
 * sabe o que fazer com o erro manda a mesma coisa de novo até o bot desistir.
 */
export function mensagemDeRecusa(no: NoPergunta): string {
  const escrita = (no.data.mensagemDeErro ?? '').trim()
  if (escrita !== '') return escrita
  return no.data.formato ? PEDIDO_PADRAO[no.data.formato] : MENSAGEM_NAO_ENTENDI
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
  /*
   * O valor comparado **interpola**.
   *
   * Sem isto, a condição só sabia comparar uma variável contra texto fixo, e
   * comparar duas coisas da conversa — o orçamento da pessoa contra o preço que
   * a API devolveu — era impossível. O texto fixo continua funcionando igual:
   * frase sem `{{ }}` atravessa `interpolar` sem mudar.
   */
  const esperado = normalizar(interpolar(valorEsperado, vars))

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
    case 'maior':
    case 'menor': {
      const a = comoNumero(atual)
      const b = comoNumero(esperado)
      // Um dos lados não é número: falso, e não uma ordem inventada. Comparar
      // "amanhã" com 3 não tem resposta certa — tem resposta que engana.
      if (a === null || b === null) return false
      return operador === 'maior' ? a > b : a < b
    }
    default:
      return false
  }
}

/**
 * O texto como número, ou `null` quando ele não é um.
 *
 * Aceita a vírgula decimal porque é o que se digita em português, e ignora
 * espaço em volta. Não aceita `1.234,56`: separador de milhar é ambíguo entre
 * as duas convenções, e adivinhar errado muda o valor por mil.
 */
function comoNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (limpo === '') return null
  const numero = Number(limpo)
  return Number.isFinite(numero) ? numero : null
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

/**
 * Para onde a conversa vai a partir deste nó.
 *
 * **A saída sem nome nunca é a de timeout.** Sem esta exclusão, uma pergunta de
 * resposta livre com prazo desenhado mandaria quem *respondeu* para o caminho
 * de quem *não respondeu* — porque a aresta de timeout seria a primeira da
 * lista. É o tipo de erro que não estoura em lugar nenhum: a conversa segue,
 * segue pelo lado errado, e o desenho na tela parece certo.
 */
function proximo(fluxo: Fluxo, noId: string, saida?: string): string | null {
  const saidas = fluxo.edges.filter((a) => a.source === noId)
  if (saida !== undefined) {
    return saidas.find((a) => a.sourceHandle === saida)?.target ?? null
  }
  return (
    saidas.find((a) => a.sourceHandle !== SAIDA_TIMEOUT && a.sourceHandle !== SAIDA_MIDIA)
      ?.target ?? null
  )
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
