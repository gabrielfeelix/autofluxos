import 'server-only'
import { ATENDIMENTO_SEMPRE_ABERTO, avisoDeForaDoHorario, executar } from '@/core/engine/executar'
import type { ContextoDoAtendimento } from '@/core/engine/executar'
import type { Acao, Entrada, Resultado, Sessao } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import type { Modelo, Turno } from '../ia/types'
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

    const resposta = await modelo.responder({
      contextoNegocio: opcoes.contextoNegocio,
      instrucao: chamadaIa.instrucao,
      pergunta,
      historico: opcoes.historico,
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
