import 'server-only'
import { ATENDIMENTO_SEMPRE_ABERTO, avisoDeForaDoHorario, executar } from '@/core/engine/executar'
import type { ContextoDoAtendimento } from '@/core/engine/executar'
import type { Acao, Entrada, Resultado, Sessao } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import { ferramentasPermitidas, idsVistos, projetar } from '@/core/ferramentas'
import {
  assinatura,
  camposInjetadosTentados,
  conferirPedido,
  novaMemoria,
} from '../ia/ferramentas-do-pedido'
import type { Modelo, Resposta, Turno } from '../ia/types'
import { alertar } from '../alertar'
import { chamarHttp } from './http'
import { lerCredencial } from '../repos/conexoes'

/**
 * O motor, com os efeitos externos resolvidos.
 *
 * O `executar()` é puro e continua puro: quando a conversa chega num bloco que
 * precisa do mundo lá fora — a IA ou uma API — ele **descreve** o que precisa
 * (`chamar_ia`, `chamar_http`) e para. Alguém de fora tem que executar e
 * reentrar com o resultado.
 *
 * Esse alguém é este arquivo, e é **um só**, usado pelo simulador e pelo
 * WhatsApp. É isso que impede duas implementações se comportando diferente e
 * mata a frase "no simulador funcionava".
 */

/** Mensagem padrão antes de passar para uma pessoa. */
const AVISO_DE_HANDOFF = 'Vou te passar para um atendente. Só um instante!'

/**
 * Trava contra fluxo que encadeia efeitos externos sem fim.
 *
 * Era 3, calibrado para IA, onde encadear é sinal de fluxo errado. Com API é
 * diferente: consultar o CEP, gravar no CRM e avisar no Slack na mesma passada
 * são três chamadas de um fluxo perfeitamente sensato. A trava continua
 * existindo para matar ciclo, não para limitar desenho — por isso sobe, e não
 * some.
 */
export const MAX_EFEITOS = 10

/**
 * Quantas automações uma conversa pode atravessar numa mensagem só.
 *
 * Existe pelo mesmo motivo de `MAX_EFEITOS`: matar ciclo, não limitar desenho.
 * Três saltos já é uma triagem que distribui para uma especialidade que
 * distribui para outra — acima disso é laço, e laço aqui é infinito de verdade,
 * porque cada salto recomeça o fluxo de destino do início.
 */
export const MAX_SALTOS = 5

export type OpcoesDeEfeitos = {
  /** `null` = não há modelo disponível (sem plano, sem chave). */
  modelo: Modelo | null
  /** O que o cliente escreveu sobre o próprio negócio. Fecha o escopo. */
  contextoNegocio: string
  /** A conversa até aqui, para a IA não repetir o que já foi dito. */
  historico?: Turno[]
  /**
   * Que dia é hoje, em `AAAA-MM-DD`, no fuso da conta (`core/horario.ts`).
   *
   * Sem isto a IA não tem relógio e não avisa que não tem: ela chuta o ano ao
   * traduzir "amanhã", e o chute errado é um agendamento meses fora.
   */
  hoje?: string
  /** A última mensagem da pessoa, quando não veio como texto na entrada. */
  perguntaDaPessoa?: string
  /**
   * De onde veio a conversa. O simulador marca os disparos de API com um
   * cabeçalho, para o sistema do cliente conseguir filtrar tráfego de teste.
   *
   * O padrão é `whatsapp` porque errar para o outro lado é pior: marcar
   * conversa real como teste faria o cliente descartar lead de verdade.
   */
  origem?: 'simulador' | 'whatsapp'
  /**
   * De quem é a conversa. Sem isto o nó de API não consegue usar credencial:
   * ela é lida com o id do cliente junto, para o fluxo de um nunca alcançar o
   * cofre de outro.
   */
  clienteId?: string
  /**
   * Tem gente para atender agora, e quando volta.
   *
   * Vai para o motor, que decide o que dizer no handoff. O padrão é "sempre
   * aberto" porque é como o produto se comportou até aqui — e porque conta sem
   * horário configurado não pode emudecer sozinha.
   */
  atendimento?: ContextoDoAtendimento
  /**
   * Como carregar a automação de destino de um salto — o bloco "Ir para outra
   * automação".
   *
   * Entra por parâmetro, e não como import de repositório, pelo mesmo motivo do
   * `modelo`: quem chama decide o que o salto alcança. O webhook passa um
   * carregador amarrado ao cliente da conversa, e é isso que impede um fluxo de
   * um cliente saltar para o de outro — o id do destino vem do grafo, e grafo é
   * coisa que gente edita.
   *
   * `null` significa "este destino não serve agora": não existe, não é deste
   * cliente, está desligado ou nunca foi publicado. O salto vira handoff, com o
   * motivo escrito.
   */
  carregarFluxo?: (
    fluxoId: string,
  ) => Promise<{ versaoId: string; grafo: Fluxo; iaHabilitada: boolean } | null>
}

/**
 * O que o resolvedor devolve a mais que o motor: onde a conversa **terminou**.
 *
 * `destino` só vem preenchido quando houve salto, e quem chamou precisa dele
 * para duas coisas que o motor não tem como fazer: gravar na sessão qual versão
 * ela executa agora, e agendar o timeout lendo o grafo certo. Sem isso o salto
 * duraria uma mensagem — a próxima carregaria a versão antiga de novo.
 */
export type ResultadoComEfeitos = Resultado & {
  destino?: { versaoId: string; grafo: Fluxo }
}

export async function executarComEfeitos(
  fluxo: Fluxo,
  sessao: Sessao,
  entrada: Entrada,
  opcoes: OpcoesDeEfeitos,
): Promise<ResultadoComEfeitos> {
  const atendimento = opcoes.atendimento ?? ATENDIMENTO_SEMPRE_ABERTO
  let resultado = executar(fluxo, sessao, entrada, atendimento)

  /**
   * O fluxo pode trocar no meio da rodada, e a partir daí é ele que vale.
   *
   * Tudo abaixo reentra no motor com `fluxoAtual`, nunca com o `fluxo` que
   * chegou por parâmetro: depois de um salto, reentrar no antigo executaria o
   * nó errado — e o erro seria silencioso, porque os dois grafos são válidos.
   */
  let fluxoAtual = fluxo
  let destino: { versaoId: string; grafo: Fluxo } | undefined
  /**
   * O contrato de IA é **do fluxo**, não da conversa (ver `flows.ia_habilitada`).
   * Saltar para uma automação sem Etapa 2 contratada não pode ganhar o modelo
   * de carona só porque a conversa começou numa que tem.
   */
  let modelo = opcoes.modelo
  let saltos = 0

  const pergunta =
    opcoes.perguntaDaPessoa ??
    (entrada.tipo === 'texto' ? entrada.texto : (ultimaDaPessoa(opcoes.historico) ?? ''))

  for (let volta = 0; volta < MAX_EFEITOS; volta++) {
    const chamadaHttp = resultado.acoes.find((a) => a.tipo === 'chamar_http')

    if (chamadaHttp?.tipo === 'chamar_http') {
      // A credencial é buscada aqui, fora do motor, e vive só o tempo desta
      // chamada. Ela não entra na sessão, não é serializada, e portanto não
      // tem como chegar ao navegador pelo simulador.
      // Banco fora do ar ou cofre recusando não pode estourar daqui: a exceção
      // subiria até o `after()` do webhook, a sessão nunca seria salva, e a
      // mensagem já foi deduplicada — a pessoa ficaria sem resposta nenhuma.
      // Sem credencial, o bloco cai no caminho de handoff logo abaixo.
      let credencial = null
      if (chamadaHttp.conexaoId && opcoes.clienteId) {
        try {
          credencial = await lerCredencial(chamadaHttp.conexaoId, opcoes.clienteId)
        } catch (erro) {
          credencial = null
          // Cofre recusando é falha de infraestrutura, não erro de desenho: o
          // fluxo continua certo e todas as conversas que passam por ele caem em
          // handoff ao mesmo tempo. Quem vê isso pela tela do lead acha que é
          // problema de um contato só.
          await alertar('não deu para ler a credencial do cofre', erro, {
            conexao: chamadaHttp.conexaoId,
            cliente: opcoes.clienteId,
          })
        }
      }

      // Bloco que pede credencial e não recebe não pode sair chamando sem ela:
      // uma API que responde 401 vira handoff com motivo confuso, e uma que
      // aceita anônimo faria coisa errada em nome do cliente.
      if (chamadaHttp.conexaoId && !credencial) {
        return {
          acoes: [
            ...semEfeito(resultado.acoes, 'chamar_http'),
            { tipo: 'enviar_texto', texto: AVISO_DE_HANDOFF },
            {
              tipo: 'transferir_humano',
              motivo: 'a integração falhou — a credencial configurada não está mais disponível',
            },
          ],
          sessao: { ...resultado.sessao, status: 'humano' },
          ...(destino ? { destino } : {}),
        }
      }

      const resposta = await chamarHttp(chamadaHttp, {
        deTeste: opcoes.origem === 'simulador',
        credencial,
      })

      if (!resposta.ok && chamadaHttp.aoFalhar === 'humano') {
        return {
          acoes: [
            ...semEfeito(resultado.acoes, 'chamar_http'),
            { tipo: 'enviar_texto', texto: AVISO_DE_HANDOFF },
            { tipo: 'transferir_humano', motivo: `a integração falhou — ${resposta.motivo}` },
          ],
          sessao: { ...resultado.sessao, status: 'humano' },
          ...(destino ? { destino } : {}),
        }
      }

      // `aoFalhar: 'seguir'`: a conversa continua e as variáveis mapeadas ficam
      // vazias, que é como o produto já trata variável ausente em qualquer
      // texto. Zerar explicitamente importa — sem isso, uma segunda chamada que
      // falha deixaria o valor da primeira em pé, e a mensagem para o cliente
      // mostraria dado velho como se fosse fresco.
      const seguinte = executar(
        fluxoAtual,
        resultado.sessao,
        {
          tipo: 'http_respondeu',
          valores: resposta.ok
            ? resposta.valores
            : Object.fromEntries(chamadaHttp.mapear.map((m) => [m.variavel, ''])),
        },
        atendimento,
      )

      resultado = {
        acoes: [...semEfeito(resultado.acoes, 'chamar_http'), ...seguinte.acoes],
        sessao: seguinte.sessao,
      }
      continue
    }

    const salto = resultado.acoes.find((a) => a.tipo === 'ir_para_fluxo')
    if (salto?.tipo === 'ir_para_fluxo') {
      const carregado = saltos++ < MAX_SALTOS ? await carregar(opcoes, salto.fluxoId) : null

      // Destino que não serve não pode virar silêncio: a conversa está parada
      // num bloco que só sabe saltar, e sem saída desenhada ela ficaria muda
      // até alguém reparar. Uma pessoa assume, com o motivo escrito.
      if (!carregado) {
        return {
          acoes: [
            ...semEfeito(resultado.acoes, 'ir_para_fluxo'),
            { tipo: 'enviar_texto', texto: avisoDeForaDoHorario(atendimento) ?? AVISO_DE_HANDOFF },
            {
              tipo: 'transferir_humano',
              motivo:
                saltos > MAX_SALTOS
                  ? `o fluxo saltou entre mais de ${MAX_SALTOS} automações seguidas — provavelmente há um ciclo no desenho`
                  : 'a automação de destino não está disponível — ela foi apagada, desligada ou nunca publicada',
            },
          ],
          sessao: { ...resultado.sessao, status: 'humano' },
          ...(destino ? { destino } : {}),
        }
      }

      fluxoAtual = carregado.grafo
      destino = { versaoId: carregado.versaoId, grafo: carregado.grafo }
      modelo = carregado.iaHabilitada ? opcoes.modelo : null

      // Começa do início do fluxo novo e com as variáveis intactas: é a mesma
      // conversa, e o nome que a pessoa deu na triagem não pode sumir porque o
      // desenho mudou de arquivo. `tentativas` zera — o que o bot não entendeu
      // lá atrás não conta contra as perguntas de cá.
      const seguinte = executar(
        fluxoAtual,
        { ...resultado.sessao, noAtual: null, tentativas: 0, status: 'ativa' },
        { tipo: 'inicio' },
        atendimento,
      )

      resultado = {
        acoes: [...semEfeito(resultado.acoes, 'ir_para_fluxo'), ...seguinte.acoes],
        sessao: seguinte.sessao,
      }
      continue
    }

    const chamadaIa = resultado.acoes.find((a) => a.tipo === 'chamar_ia')
    if (chamadaIa?.tipo !== 'chamar_ia') return { ...resultado, ...(destino ? { destino } : {}) }

    // Sem modelo, `chamar_ia` continua na lista e quem chamou decide o que
    // fazer — hoje, mandar para uma pessoa. Nunca fingir que respondeu.
    if (!modelo) return { ...resultado, ...(destino ? { destino } : {}) }

    const resposta = await responderComFerramentas({
      modelo,
      chamada: chamadaIa,
      pergunta,
      opcoes,
      vars: resultado.sessao.vars,
    })

    if (resposta.tipo === 'nao_sei') {
      // A saída de emergência do §6. Entre calar e inventar, uma pessoa assume.
      //
      // O aviso de fora do expediente vale aqui também, e substitui a frase
      // padrão pelo mesmo motivo do motor: "só um instante" às 3h da manhã é
      // uma promessa que ninguém cumpre até de manhã.
      return {
        acoes: [
          ...semEfeito(resultado.acoes, 'chamar_ia'),
          {
            tipo: 'enviar_texto',
            texto: avisoDeForaDoHorario(atendimento) ?? AVISO_DE_HANDOFF,
          },
          { tipo: 'transferir_humano', motivo: `a IA não soube responder — ${resposta.motivo}` },
        ],
        sessao: { ...resultado.sessao, status: 'humano' },
        ...(destino ? { destino } : {}),
      }
    }

    const seguinte = executar(
      fluxoAtual,
      resultado.sessao,
      { tipo: 'ia_respondeu', texto: resposta.texto },
      atendimento,
    )

    resultado = {
      acoes: [...semEfeito(resultado.acoes, 'chamar_ia'), ...seguinte.acoes],
      sessao: seguinte.sessao,
    }
  }

  /**
   * A trava estourou: o fluxo encadeou mais de `MAX_EFEITOS` chamadas externas
   * sem chegar a lugar nenhum, quase sempre porque tem ciclo.
   *
   * Antes daqui, o pedido não atendido sobrava na lista e ia parar em
   * `aplicar()`, que passava a conversa para uma pessoa dizendo "a integração
   * não chegou a ser executada" — verdade pela metade, e que manda quem for
   * investigar procurar defeito na integração em vez de ciclo no desenho.
   * Falhar com o motivo certo é o que faz a diferença entre trinta segundos e
   * uma tarde.
   */
  const pendente = resultado.acoes.find((a) => a.tipo === 'chamar_ia' || a.tipo === 'chamar_http')
  if (pendente) {
    return {
      acoes: [
        ...resultado.acoes.filter((a) => a.tipo !== 'chamar_ia' && a.tipo !== 'chamar_http'),
        { tipo: 'enviar_texto', texto: AVISO_DE_HANDOFF },
        {
          tipo: 'transferir_humano',
          motivo: `o fluxo encadeou mais de ${MAX_EFEITOS} chamadas externas seguidas — provavelmente há um ciclo no desenho`,
        },
      ],
      sessao: { ...resultado.sessao, status: 'humano' },
      ...(destino ? { destino } : {}),
    }
  }

  return { ...resultado, ...(destino ? { destino } : {}) }
}

/**
 * Carrega o destino do salto, e devolve `null` quando ele não serve.
 *
 * Sem carregador configurado o salto também não acontece: é o caso de quem
 * chama o resolvedor sem saber de que cliente é a conversa, e nesse caso pular
 * para um fluxo escolhido por id seria justamente o que não pode.
 */
async function carregar(opcoes: OpcoesDeEfeitos, fluxoId: string) {
  if (!opcoes.carregarFluxo) return null
  try {
    return await opcoes.carregarFluxo(fluxoId)
  } catch (erro) {
    // Banco fora do ar no meio de um salto não pode estourar daqui: a exceção
    // subiria até o `after()` do webhook, a sessão nunca seria salva e a
    // mensagem já foi deduplicada — a pessoa ficaria sem resposta nenhuma.
    await alertar('não deu para carregar a automação de destino', erro, { fluxo: fluxoId })
    return null
  }
}

/**
 * Tira o pedido de efeito da lista depois de atendido.
 *
 * Se ficasse, quem aplica as ações veria um pedido já respondido e mandaria a
 * conversa para um humano em cima de algo que deu certo.
 */
function semEfeito(acoes: Acao[], tipo: 'chamar_ia' | 'chamar_http' | 'ir_para_fluxo'): Acao[] {
  return acoes.filter((a) => a.tipo !== tipo)
}

function ultimaDaPessoa(historico: Turno[] | undefined): string | undefined {
  return [...(historico ?? [])].reverse().find((t) => t.de === 'pessoa')?.texto
}

/**
 * Quantas consultas a IA pode fazer antes de responder.
 *
 * **Dois, e o número tem origem.** A prática assentada em tool calling é uma a
 * duas voltas: cada volta melhora a cobertura e cobra em latência e token, e a
 * terceira quase nunca acrescenta. Do lado de cá o custo é concreto — três
 * chamadas ao modelo e duas à API do cliente já somam dezenas de segundos com
 * alguém olhando o WhatsApp.
 *
 * Dois também é o que a conversa real pede: `agenda_catalogo` para achar o id
 * da modalidade, `agenda_horarios` para ver o que tem. Quem precisar de mais
 * está desenhando fluxo com IA em vez de desenhar fluxo.
 */
export const MAX_VOLTAS_DE_FERRAMENTA = 2

/**
 * O que o resolvedor devolve: texto ou desistência, nunca um pedido pendente.
 *
 * Quem executa consulta é este arquivo, então um `usar_ferramenta` saindo daqui
 * seria um pedido que ninguém vai atender — e a conversa terminaria em
 * silêncio, que é o único desfecho que este produto não aceita.
 */
type RespostaFinal = Exclude<Resposta, { tipo: 'usar_ferramenta' }>

/**
 * Pedido de consulta onde nenhuma foi oferecida vira desistência.
 *
 * O modelo não deveria conseguir — sem `tools` no corpo não há função para
 * chamar. Mas "não deveria" não é uma garantia que se possa dar a partir do
 * comportamento de um modelo, e a alternativa é uma resposta vazia chegando ao
 * WhatsApp de alguém.
 */
function semPedido(resposta: Resposta): RespostaFinal {
  if (resposta.tipo === 'usar_ferramenta') {
    return { tipo: 'nao_sei', motivo: 'o modelo pediu uma consulta que este bloco não oferece' }
  }
  return resposta
}

/**
 * A IA respondendo, com as consultas que este nó autorizou.
 *
 * Sem ferramenta, é exatamente a chamada única de sempre — nenhum fluxo
 * publicado muda de comportamento.
 *
 * Com ferramenta, o laço é curto e todas as saídas terminam em resposta ou em
 * `nao_sei`. Nunca em exceção: uma exceção subindo daqui cairia dentro do
 * `after()` do webhook, a sessão não seria salva e a pessoa ficaria esperando
 * uma resposta que não vem.
 */
async function responderComFerramentas({
  modelo,
  chamada,
  pergunta,
  opcoes,
  vars,
}: {
  modelo: Modelo
  chamada: Extract<Acao, { tipo: 'chamar_ia' }>
  pergunta: string
  opcoes: OpcoesDeEfeitos
  vars: Record<string, string>
}): Promise<RespostaFinal> {
  const permitidas = ferramentasPermitidas(chamada.ferramentas)

  const base = {
    contextoNegocio: opcoes.contextoNegocio,
    instrucao: chamada.instrucao,
    pergunta,
    hoje: opcoes.hoje,
  }

  if (permitidas.length === 0) {
    return semPedido(await modelo.responder({ ...base, historico: opcoes.historico }))
  }

  /*
   * A credencial é lida uma vez, fora do laço, e vive só o tempo desta
   * resposta. Ela não entra na sessão, não é serializada e portanto não tem
   * como chegar ao navegador pelo simulador — a mesma regra do nó de API.
   */
  let credencial = null
  if (chamada.conexaoId && opcoes.clienteId) {
    try {
      credencial = await lerCredencial(chamada.conexaoId, opcoes.clienteId)
    } catch (erro) {
      await alertar('não deu para ler a credencial do cofre para a IA', erro, {
        conexao: chamada.conexaoId,
        cliente: opcoes.clienteId,
      })
    }
  }

  if (!credencial) {
    // Consultar sem credencial volta 401 em toda conversa, e a IA diria "não
    // sei" para tudo sem ninguém entender por quê. Melhor dizer o motivo.
    return { tipo: 'nao_sei', motivo: 'a credencial das consultas não pôde ser lida' }
  }

  const deTeste = opcoes.origem === 'simulador'
  const memoria = novaMemoria()
  const conversa: Turno[] = [...(opcoes.historico ?? [])]

  for (let volta = 0; volta <= MAX_VOLTAS_DE_FERRAMENTA; volta++) {
    const resposta = await modelo.responder({
      ...base,
      historico: conversa,
      // Na última volta o catálogo sai: o modelo tem que responder com o que
      // já tem. Deixá-lo pedir de novo produziria um pedido que ninguém vai
      // executar, e a conversa terminaria em silêncio.
      ferramentas: volta === MAX_VOLTAS_DE_FERRAMENTA ? [] : permitidas,
    })

    if (resposta.tipo !== 'usar_ferramenta') return resposta

    const conferida = conferirPedido({
      nome: resposta.nome,
      argumentos: resposta.argumentos,
      permitidas,
      injetados: vars,
      memoria,
    })

    if (!conferida.ok) {
      /*
       * Pedido recusado vira handoff, e não uma segunda chance.
       *
       * Devolver o erro para o modelo tentar de novo é o desenho tentador e é
       * o errado aqui: cada tentativa é uma volta a mais com alguém esperando,
       * e as recusas que existem não são erro de digitação — são id inventado,
       * ferramenta não autorizada e argumento faltando. Nenhuma delas melhora
       * na segunda tentativa, e a primeira é sinal de que alguém está testando
       * o limite.
       */
      console.warn(`[ia] consulta recusada: ${conferida.motivo}`)
      return { tipo: 'nao_sei', motivo: conferida.motivo }
    }

    const { ferramenta, url, corpo } = conferida.chamada

    /*
     * Na aba Testar, consulta que grava não grava.
     *
     * O `X-AutoFluxos-Teste` avisa o outro lado, mas ele depende de o cliente
     * filtrar. Com a IA escolhendo sozinha a chamada, isso deixa de ser
     * aceitável: testar um fluxo marcaria aula de verdade na agenda de alguém.
     * Ler continua real, porque uma lista falsa não testa nada.
     */
    if (deTeste && ferramenta.escreve) {
      conversa.push({
        de: 'ferramenta',
        nome: ferramenta.nome,
        texto: '{"simulado":true,"aviso":"Estamos em teste; nada foi gravado de verdade."}',
      })
      memoria.jaPedidos.add(assinatura(resposta.nome, resposta.argumentos))
      continue
    }

    const tentouInjetado = camposInjetadosTentados(ferramenta, resposta.argumentos)
    if (tentouInjetado.length > 0) {
      // O valor já foi descartado pela conferência. O registro fica porque
      // tentativa de escolher a identidade de quem sofre a ação é sinal, e
      // sinal que ninguém conta é sinal que ninguém vê.
      console.warn(
        `[ia] o modelo tentou preencher ${tentouInjetado.join(', ')} em ${ferramenta.nome}`,
      )
    }

    const bruta = await chamarHttp(
      {
        tipo: 'chamar_http',
        metodo: ferramenta.chamada.metodo,
        url,
        cabecalhos: ferramenta.chamada.cabecalhos,
        corpo,
        mapear: [],
        aoFalhar: 'humano',
        ...(chamada.conexaoId ? { conexaoId: chamada.conexaoId } : {}),
      },
      { deTeste, credencial, comJson: true },
    )

    memoria.jaPedidos.add(assinatura(resposta.nome, resposta.argumentos))

    if (!bruta.ok) {
      // Falha de consulta é handoff pelo mesmo motivo do nó de API com
      // `aoFalhar: humano`: responder sem o dado é responder chutando.
      return { tipo: 'nao_sei', motivo: `a consulta ${ferramenta.nome} falhou — ${bruta.motivo}` }
    }

    const recorte = projetar(bruta.json, ferramenta.projecao)
    idsVistos(recorte, memoria.ids)

    conversa.push({ de: 'ferramenta', nome: ferramenta.nome, texto: JSON.stringify(recorte) })
  }

  /* istanbul ignore next -- o laço sempre sai por `return` acima. */
  return { tipo: 'nao_sei', motivo: 'a IA consultou demais sem chegar a uma resposta' }
}
