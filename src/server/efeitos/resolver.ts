import 'server-only'
import { legendaDoManual, manualEmPdf, nomeDoArquivoDoManual } from '@/core/manuais'
import { envioDoCardapio } from '@/core/materiais'
import { ATENDIMENTO_SEMPRE_ABERTO, avisoDeForaDoHorario, executar } from '@/core/engine/executar'
import type { ContextoDoAtendimento } from '@/core/engine/executar'
import type { Acao, Entrada, Resultado, Sessao } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import { cepLimpo, type ProdutoDaLoja } from '@/core/loja'
import { VARIAVEIS_DE_DATA } from '@/core/datas'
import { VARIAVEIS_DO_ATENDIMENTO, varsDoAtendimento } from '@/core/vars-do-atendimento'
import {
  acharFerramenta,
  ferramentasPermitidas,
  idsVistos,
  projetar,
  rotulosDeId,
  type Ferramenta,
  type OperacaoDeLoja,
} from '@/core/ferramentas'
import {
  AVISO_DE_DUVIDA,
  AVISO_DE_RECUSA,
  lerConfirmacao,
  perguntaDeConfirmacao,
} from '@/core/confirmacao'
import { lerPoliticas, politicaDe } from '../ia/politica'
import { recursoLiberado } from '../recursos-do-plano'
import {
  cotaDeIaDoContato,
  registrarChamada,
  registrarRespostaDaIa,
  type DecididoPor,
} from '../repos/ia-chamadas'
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
import { consultarPedidoDaConta, lojaAtivaDaConta } from '../adaptador-da-loja'
import { listarMateriais } from '../repos/materiais'

/**
 * O motor, com os efeitos externos resolvidos.
 *
 * O `executar()` é puro e continua puro: quando a conversa chega num bloco que
 * precisa do mundo lá fora, a IA ou uma API, ele **descreve** o que precisa
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
 * O que a pessoa lê quando o contato gastou as respostas de IA do dia
 * (`clients.ia_limite_contato_dia`, 0106).
 *
 * Não fala em limite nem em cota: quem está do outro lado não contratou nada,
 * e "limite atingido" soa como defeito. Diz o que acontece agora, que é uma
 * pessoa assumir.
 */
export const AVISO_DE_LIMITE_DE_IA =
  'Por hoje eu já respondi bastante por aqui. Vou te passar para uma pessoa do time. 🙌'

/**
 * Trava contra fluxo que encadeia efeitos externos sem fim.
 *
 * Era 3, calibrado para IA, onde encadear é sinal de fluxo errado. Com API é
 * diferente: consultar o CEP, gravar no CRM e avisar no Slack na mesma passada
 * são três chamadas de um fluxo perfeitamente sensato. A trava continua
 * existindo para matar ciclo, não para limitar desenho, por isso sobe, e não
 * some.
 */
export const MAX_EFEITOS = 10

/**
 * Quantas automações uma conversa pode atravessar numa mensagem só.
 *
 * Existe pelo mesmo motivo de `MAX_EFEITOS`: matar ciclo, não limitar desenho.
 * Três saltos já é uma triagem que distribui para uma especialidade que
 * distribui para outra, acima disso é laço, e laço aqui é infinito de verdade,
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
  /**
   * As datas prontas do fluxo: `{{hoje}}`, `{{semana_de}}`, e as outras.
   *
   * Entram por parâmetro porque `core/` não tem relógio. Quem calcula é o
   * servidor, no fuso da conta.
   */
  datas?: Record<string, string>
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
   * De quem é a conversa. Só para o log de chamadas da IA.
   *
   * Opcional porque o simulador não tem contato: lá a conversa é de ninguém, e
   * registrar sem contato continua sendo registro útil, diz o que foi testado.
   */
  contatoId?: string
  /**
   * Tem gente para atender agora, e quando volta.
   *
   * Vai para o motor, que decide o que dizer no handoff. O padrão é "sempre
   * aberto" porque é como o produto se comportou até aqui, e porque conta sem
   * horário configurado não pode emudecer sozinha.
   */
  atendimento?: ContextoDoAtendimento
  /**
   * Como carregar a automação de destino de um salto, o bloco "Ir para outra
   * automação".
   *
   * Entra por parâmetro, e não como import de repositório, pelo mesmo motivo do
   * `modelo`: quem chama decide o que o salto alcança. O webhook passa um
   * carregador amarrado ao cliente da conversa, e é isso que impede um fluxo de
   * um cliente saltar para o de outro, o id do destino vem do grafo, e grafo é
   * coisa que gente edita.
   *
   * `null` significa "este destino não serve agora": não existe, não é deste
   * cliente, está desligado ou nunca foi publicado. O salto vira handoff, com o
   * motivo escrito.
   */
  carregarFluxo?: (
    fluxoId: string,
  ) => Promise<{ versaoId: string; grafo: Fluxo; iaHabilitada: boolean } | null>
  /**
   * O bloco de API **não** chama a internet: responde dado de exemplo.
   *
   * Existe para a vitrine do link compartilhado, que roda sem sessão nenhuma.
   * Lá, executar o bloco de verdade seria dar a quem tem o link um jeito de
   * fazer o nosso servidor bater numa URL escolhida por outra pessoa, quantas
   * vezes quisesse, e de disparar o sistema de um cliente que não está na
   * conversa. Quem recebe um link quer ver o desenho conversar, não gravar
   * pedido no CRM de ninguém.
   *
   * O desvio é o menor possível: o motor continua o mesmo, a resposta entra
   * pela porta normal (`http_respondeu`), e as variáveis mapeadas chegam
   * preenchidas com `exemplo`. Um bloco de API mal ligado continua aparecendo
   * errado, porque o erro mora no desenho, não no valor que volta.
   */
  semRede?: boolean
  /**
   * Entrega agora o que o fluxo mandou dizer antes de um nó de IA.
   *
   * Sem isto, "Deixa eu procurar 🔎" chegava no mesmo segundo que a resposta,
   * 23 s depois, porque a rodada inteira só é enviada no fim. O aviso existe
   * justamente para cobrir a espera do modelo, e só cobre se sair antes dela.
   *
   * Recebe só envios; o que sai por aqui não volta na lista final. Opcional:
   * o simulador e a vitrine mostram tudo junto e não precisam disso.
   */
  antesDaIa?: (envios: Acao[]) => Promise<void>
}

/** O que uma chamada de API devolve quando a rede está fechada (`semRede`). */
const VALOR_DE_EXEMPLO = 'exemplo'

/**
 * O que o resolvedor devolve a mais que o motor: onde a conversa **terminou**.
 *
 * `destino` só vem preenchido quando houve salto, e quem chamou precisa dele
 * para duas coisas que o motor não tem como fazer: gravar na sessão qual versão
 * ela executa agora, e agendar o timeout lendo o grafo certo. Sem isso o salto
 * duraria uma mensagem, a próxima carregaria a versão antiga de novo.
 */
export type ResultadoComEfeitos = Resultado & {
  destino?: { versaoId: string; grafo: Fluxo }
}

/**
 * O motor com efeitos, e a garantia de que as datas não vazam para o banco.
 *
 * O invólucro existe para não depender de ninguém lembrar: `rodar()` tem uma
 * dúzia de `return`, e limpar em cada um seria esquecer em um deles um dia. A
 * limpeza acontece no único lugar por onde toda saída passa.
 */
export async function executarComEfeitos(
  fluxo: Fluxo,
  sessaoRecebida: Sessao,
  entrada: Entrada,
  opcoes: OpcoesDeEfeitos,
): Promise<ResultadoComEfeitos> {
  const resultado = await rodar(fluxo, sessaoRecebida, entrada, opcoes)
  return { ...resultado, sessao: semDatas(resultado.sessao) }
}

async function rodar(
  fluxo: Fluxo,
  sessaoRecebida: Sessao,
  entrada: Entrada,
  opcoes: OpcoesDeEfeitos,
): Promise<ResultadoComEfeitos> {
  const atendimento = opcoes.atendimento ?? ATENDIMENTO_SEMPRE_ABERTO

  /*
   * As datas entram na rodada e **saem antes de gravar**.
   *
   * Elas são derivadas do relógio, não coletadas da conversa: uma conversa que
   * atravessa a virada do dia precisa de `{{hoje}}` novo, e um valor guardado
   * seria o de ontem, o erro mais silencioso possível, porque a mensagem sai
   * bonita e com a data errada.
   *
   * Por isso são calculadas a cada mensagem, sobrescrevem o que houver, e a
   * lista exata é retirada de volta em `semDatas()` antes de a sessão ser
   * persistida. Deixá-las gravadas também sujaria a ficha do lead com oito
   * campos que ninguém preencheu.
   */
  /*
   * O horário de atendimento entra pelo mesmo caminho, e pelo mesmo motivo:
   * é derivado do relógio, vale só para esta rodada, e gravado viraria um
   * "sim" que amanhã de madrugada é mentira. Ver `core/vars-do-atendimento`.
   */
  const sessao = comDatas(sessaoRecebida, {
    ...varsDoAtendimento(atendimento),
    ...opcoes.datas,
  })

  /*
   * A confirmação é lida **antes** do motor, e não dentro dele.
   *
   * O motor não conhece ferramenta, e não devia passar a conhecer só para
   * entender um "pode sim". Do ponto de vista dele, a conversa continua parada
   * no nó de IA, o que muda é que, antes de reentrar, o resolvedor gastou a
   * resposta da pessoa decidindo se a gravação sai.
   */
  if (sessao.status === 'aguardando_confirmacao' && sessao.iaPendente) {
    const respondido = await resolverConfirmacao(fluxo, sessao, entrada, opcoes, atendimento)
    if (respondido) return respondido
  }

  let resultado = executar(fluxo, sessao, entrada, atendimento)

  /**
   * O fluxo pode trocar no meio da rodada, e a partir daí é ele que vale.
   *
   * Tudo abaixo reentra no motor com `fluxoAtual`, nunca com o `fluxo` que
   * chegou por parâmetro: depois de um salto, reentrar no antigo executaria o
   * nó errado, e o erro seria silencioso, porque os dois grafos são válidos.
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
  /** A cota de IA do contato, lida uma vez por rodada e só se a IA for chamada. */
  let cota: { limite: number | null; usadas: number } | undefined
  const quemConta = contaNoLimite(opcoes)

  const pergunta =
    opcoes.perguntaDaPessoa ??
    (entrada.tipo === 'texto' ? entrada.texto : (ultimaDaPessoa(opcoes.historico) ?? ''))

  for (let volta = 0; volta < MAX_EFEITOS; volta++) {
    const chamadaHttp = resultado.acoes.find((a) => a.tipo === 'chamar_http' && !a.simulada)

    if (chamadaHttp?.tipo === 'chamar_http') {
      /*
       * Rede fechada: a chamada não sai, e o motor segue como se tivesse saído.
       *
       * Vem antes de tudo, inclusive da busca de credencial, porque na vitrine
       * não há cliente nenhum e ler o cofre por um `conexaoId` vindo do grafo
       * seria exatamente o que não pode. A ação fica na lista, marcada, para a
       * tela dizer "chamaria" em vez de calar um passo do desenho.
       */
      if (opcoes.semRede) {
        const seguinte = executar(
          fluxoAtual,
          resultado.sessao,
          {
            tipo: 'http_respondeu',
            valores: Object.fromEntries(
              chamadaHttp.mapear.map((m) => [m.variavel, VALOR_DE_EXEMPLO]),
            ),
          },
          atendimento,
        )

        resultado = {
          acoes: [
            ...semEfeito(resultado.acoes, 'chamar_http'),
            { ...chamadaHttp, simulada: true },
            ...seguinte.acoes,
          ],
          sessao: seguinte.sessao,
        }
        continue
      }

      // Integração pausada pelo plano (seção 8 do plano da administração): a
      // chamada não sai, e a conversa vai para uma pessoa, pelo mesmo caminho
      // da credencial que sumiu. O fluxo fica como está e religa ao subir.
      if (opcoes.clienteId && opcoes.origem !== 'simulador' && !(await recursoLiberado(opcoes.clienteId, 'integracoes'))) {
        return {
          acoes: [
            ...semEfeito(resultado.acoes, 'chamar_http'),
            { tipo: 'enviar_texto', texto: AVISO_DE_HANDOFF },
            { tipo: 'transferir_humano', motivo: 'a integração está pausada: o plano da organização não inclui conexão com outros sistemas' },
          ],
          sessao: { ...resultado.sessao, status: 'humano' },
          ...(destino ? { destino } : {}),
        }
      }

      // A credencial é buscada aqui, fora do motor, e vive só o tempo desta
      // chamada. Ela não entra na sessão, não é serializada, e portanto não
      // tem como chegar ao navegador pelo simulador.
      // Banco fora do ar ou cofre recusando não pode estourar daqui: a exceção
      // subiria até o `after()` do webhook, a sessão nunca seria salva, e a
      // mensagem já foi deduplicada, a pessoa ficaria sem resposta nenhuma.
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
              motivo: 'a integração falhou, a credencial configurada não está mais disponível',
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
            { tipo: 'transferir_humano', motivo: `a integração falhou, ${resposta.motivo}` },
          ],
          sessao: { ...resultado.sessao, status: 'humano' },
          ...(destino ? { destino } : {}),
        }
      }

      // `aoFalhar: 'seguir'`: a conversa continua e as variáveis mapeadas ficam
      // vazias, que é como o produto já trata variável ausente em qualquer
      // texto. Zerar explicitamente importa, sem isso, uma segunda chamada que
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
                  ? `o fluxo saltou entre mais de ${MAX_SALTOS} automações seguidas, provavelmente há um ciclo no desenho`
                  : 'a automação de destino não está disponível, ela foi apagada, desligada ou nunca publicada',
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
      // desenho mudou de arquivo. `tentativas` zera, o que o bot não entendeu
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
    // fazer, hoje, mandar para uma pessoa. Nunca fingir que respondeu.
    if (!modelo) return { ...resultado, ...(destino ? { destino } : {}) }

    /*
     * O limite de IA por contato (0106), antes de o modelo ser chamado.
     *
     * Existe para a conta de demonstração, aberta a quem ler o QR de um flyer:
     * sem ele, uma pessoa só conversando a noite inteira é custo sem teto. No
     * limite o modelo não é chamado, a pessoa lê que alguém do time assume, e
     * a conversa vai para o mesmo caminho de quando a IA não sabe responder.
     *
     * Vem antes de `antesDaIa` para o "deixa eu procurar" não sair sozinho,
     * prometendo uma busca que não vai acontecer: ele vai junto do aviso.
     */
    if (quemConta) {
      cota ??= await cotaDeIaDoContato(quemConta.clienteId, quemConta.contatoId)
      if (cota.limite !== null && cota.usadas >= cota.limite) {
        const foraDoHorario = avisoDeForaDoHorario(atendimento)
        return {
          acoes: [
            ...semEfeito(resultado.acoes, 'chamar_ia'),
            { tipo: 'enviar_texto', texto: AVISO_DE_LIMITE_DE_IA },
            ...(foraDoHorario ? [{ tipo: 'enviar_texto' as const, texto: foraDoHorario }] : []),
            {
              tipo: 'transferir_humano',
              motivo: `o contato chegou ao limite de ${cota.limite} respostas de IA em 24 h`,
            },
          ],
          sessao: { ...resultado.sessao, status: 'humano' },
          ...(destino ? { destino } : {}),
        }
      }
    }

    if (opcoes.antesDaIa) {
      const envios = resultado.acoes.filter(ehEnvio)
      if (envios.length > 0) {
        await opcoes.antesDaIa(envios)
        resultado = { ...resultado, acoes: resultado.acoes.filter((a) => !ehEnvio(a)) }
      }
    }

    // Só conta quem tem limite: conta sem limite não ganha uma linha a mais
    // por resposta num log que existe para outra coisa. Grava junto com a
    // chamada ao modelo, e não antes, para não somar a espera de um insert.
    let registro: Promise<void> | null = null
    if (quemConta && cota && cota.limite !== null) {
      cota.usadas += 1
      registro = registrarRespostaDaIa(quemConta.clienteId, quemConta.contatoId)
    }

    const resposta = await responderComFerramentas({
      modelo,
      chamada: chamadaIa,
      pergunta,
      opcoes,
      vars: resultado.sessao.vars,
    })
    if (registro) await registro

    if (resposta.tipo === 'confirmar') {
      /*
       * A conversa para aqui, e não é handoff.
       *
       * `enviar_texto` com a pergunta, a gravação guardada na sessão, e
       * `aguardando_confirmacao`. A próxima mensagem cai em
       * `resolverConfirmacao`, antes do motor, que continua achando que a
       * conversa está parada no nó de IA, porque está.
       */
      return {
        acoes: [
          ...semEfeito(resultado.acoes, 'chamar_ia'),
          { tipo: 'enviar_texto', texto: resposta.pergunta },
        ],
        sessao: {
          ...resultado.sessao,
          status: 'aguardando_confirmacao',
          iaPendente: resposta.pendente,
        },
        ...(destino ? { destino } : {}),
      }
    }

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
          { tipo: 'transferir_humano', motivo: `a IA não soube responder, ${resposta.motivo}` },
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
      acoes: [
        ...semEfeito(resultado.acoes, 'chamar_ia'),
        ...comCards(seguinte.acoes, resposta.texto, resposta.produtos ?? [], resposta.anexos ?? []),
      ],
      sessao: seguinte.sessao,
    }
  }

  /**
   * A trava estourou: o fluxo encadeou mais de `MAX_EFEITOS` chamadas externas
   * sem chegar a lugar nenhum, quase sempre porque tem ciclo.
   *
   * Antes daqui, o pedido não atendido sobrava na lista e ia parar em
   * `aplicar()`, que passava a conversa para uma pessoa dizendo "a integração
   * não chegou a ser executada", verdade pela metade, e que manda quem for
   * investigar procurar defeito na integração em vez de ciclo no desenho.
   * Falhar com o motivo certo é o que faz a diferença entre trinta segundos e
   * uma tarde.
   */
  const pendente = resultado.acoes.find(
    (a) => a.tipo === 'chamar_ia' || (a.tipo === 'chamar_http' && !a.simulada),
  )
  if (pendente) {
    return {
      acoes: [
        // A chamada marcada como `simulada` fica: ela já foi atendida, e é o
        // único registro na tela de que o bloco de API rodou.
        ...resultado.acoes.filter(
          (a) => a.tipo !== 'chamar_ia' && (a.tipo !== 'chamar_http' || a.simulada),
        ),
        { tipo: 'enviar_texto', texto: AVISO_DE_HANDOFF },
        {
          tipo: 'transferir_humano',
          motivo: `o fluxo encadeou mais de ${MAX_EFEITOS} chamadas externas seguidas, provavelmente há um ciclo no desenho`,
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
    // mensagem já foi deduplicada, a pessoa ficaria sem resposta nenhuma.
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
/**
 * Tira da lista o pedido que acabou de ser atendido.
 *
 * A exceção é a chamada **já simulada** (`semRede`): ela não é pedido nenhum, é
 * o registro de um bloco de API que rodou. Sem esta linha, um fluxo com duas
 * chamadas apagaria o registro da primeira ao atender a segunda, e a vitrine
 * mostraria metade do que aconteceu.
 */
function semEfeito(acoes: Acao[], tipo: 'chamar_ia' | 'chamar_http' | 'ir_para_fluxo'): Acao[] {
  return acoes.filter((a) => a.tipo !== tipo || (a.tipo === 'chamar_http' && a.simulada))
}

/**
 * De quem é a conversa que gasta o limite de IA, ou `null` quando ela não gasta.
 *
 * O simulador e a vitrine não contam nem são limitados: são o dono testando o
 * próprio desenho, ou alguém vendo um link, e nenhum dos dois é um contato. Na
 * prática o simulador já não manda `contatoId`; a origem conferida aqui é o
 * cinto de segurança para o dia em que mandar.
 */
function contaNoLimite(opcoes: OpcoesDeEfeitos): { clienteId: string; contatoId: string } | null {
  if (opcoes.origem === 'simulador' || opcoes.semRede) return null
  if (!opcoes.clienteId || !opcoes.contatoId) return null
  return { clienteId: opcoes.clienteId, contatoId: opcoes.contatoId }
}

function ultimaDaPessoa(historico: Turno[] | undefined): string | undefined {
  return [...(historico ?? [])].reverse().find((t) => t.de === 'pessoa')?.texto
}

/**
 * Quantas consultas a IA pode fazer antes de responder.
 *
 * **Dois, e o número tem origem.** A prática assentada em tool calling é uma a
 * duas voltas: cada volta melhora a cobertura e cobra em latência e token, e a
 * terceira quase nunca acrescenta. Do lado de cá o custo é concreto, três
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
 * seria um pedido que ninguém vai atender, e a conversa terminaria em
 * silêncio, que é o único desfecho que este produto não aceita.
 */
type RespostaFinal =
  | Exclude<Resposta, { tipo: 'usar_ferramenta' | 'texto' }>
  /**
   * `produtos` são os cards que `loja_mostrar` separou nesta rodada. Viajam
   * com o texto, e não como ação à parte, porque só saem se a resposta sair:
   * uma rodada que termina em `nao_sei` não manda card nenhum.
   */
  | (Extract<Resposta, { tipo: 'texto' }> & { produtos?: ProdutoDaLoja[]; anexos?: AnexoDaIa[] })
  /**
   * A IA quer gravar e a política deste cliente manda perguntar antes.
   *
   * Não é `nao_sei` e não é `texto`: é uma terceira coisa, e espremê-la num dos
   * dois esconderia justamente o que ela tem de diferente, a conversa não
   * acabou, e existe uma gravação guardada esperando um sim.
   */
  | {
      tipo: 'confirmar'
      pendente: { ferramenta: string; argumentos: Record<string, string>; resumo: string }
      pergunta: string
    }

/**
 * Pedido de consulta onde nenhuma foi oferecida vira desistência.
 *
 * O modelo não deveria conseguir, sem `tools` no corpo não há função para
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
 * Sem ferramenta, é exatamente a chamada única de sempre, nenhum fluxo
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
   * como chegar ao navegador pelo simulador, a mesma regra do nó de API.
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

  /*
   * Só ferramenta HTTP autenticada precisa da Conexão do nó. As de loja falam
   * com a loja da conta pelo adaptador, e a busca pública não tem credencial:
   * exigir uma aqui faria o bloco com só `loja_buscar` responder "não sei"
   * para tudo.
   */
  const precisaDeCredencial = permitidas.some(
    (f) => f.chamada.tipo === 'http' && f.credencial !== 'nenhuma',
  )
  if (precisaDeCredencial && !credencial) {
    // Consultar sem credencial volta 401 em toda conversa, e a IA diria "não
    // sei" para tudo sem ninguém entender por quê. Melhor dizer o motivo.
    return { tipo: 'nao_sei', motivo: 'a credencial das consultas não pôde ser lida' }
  }

  const deTeste = opcoes.origem === 'simulador'
  const memoria = novaMemoria()
  const conversa: Turno[] = [...(opcoes.historico ?? [])]

  /*
   * As políticas vêm numa leitura só, antes do laço.
   *
   * Dentro dele seriam três idas ao banco por resposta, e a resposta já é a
   * parte lenta da conversa. Elas também não mudam no meio de uma mensagem: se
   * alguém trocar a política enquanto a pessoa digita, vale na próxima.
   */
  const politicas = opcoes.clienteId ? await lerPoliticas(opcoes.clienteId) : new Map()

  /** Como cada id apareceu em palavras. Alimenta a pergunta de confirmação. */
  const rotulos = new Map<string, string>()

  /** O que `loja_mostrar` separou para sair como card junto da resposta. */
  const cards: ProdutoDaLoja[] = []
  /**
   * Os arquivos que `loja_enviar_manual` e `enviar_cardapio` separaram, pelo
   * mesmo caminho dos cards.
   */
  const anexos: AnexoDaIa[] = []

  for (let volta = 0; volta <= MAX_VOLTAS_DE_FERRAMENTA; volta++) {
    const resposta = await modelo.responder({
      ...base,
      historico: conversa,
      // Na última volta o catálogo sai: o modelo tem que responder com o que
      // já tem. Deixá-lo pedir de novo produziria um pedido que ninguém vai
      // executar, e a conversa terminaria em silêncio.
      ferramentas: volta === MAX_VOLTAS_DE_FERRAMENTA ? [] : permitidas,
    })

    if (resposta.tipo === 'texto' && (cards.length > 0 || anexos.length > 0)) {
      return { ...resposta, produtos: cards, anexos }
    }
    /*
     * Os cards já escolhidos não se perdem por causa da frase.
     *
     * 25/set/2026, PCYES: a IA buscou três categorias, escolheu três cards, e
     * a última chamada, a que só escreve a frase em volta, caiu por cota (o
     * Groq grátis dá 8 mil tokens por minuto e a rodada gastou três chamadas).
     * A conversa foi para um atendente com a vitrine pronta. Falha de
     * transporte com card na mão vira a vitrine com uma frase curta; recusa de
     * escopo (`nao_sei` sem `falhou`) continua sendo recusa.
     */
    if (resposta.tipo === 'nao_sei' && resposta.falhou && cards.length > 0) {
      console.warn(`[ia] a frase final falhou (${resposta.motivo}); os cards saem mesmo assim`)
      return { tipo: 'texto', texto: 'Separei essas opções pra você 👇', produtos: cards, anexos }
    }
    if (resposta.tipo === 'nao_sei' && resposta.falhou && anexos.length > 0) {
      return { tipo: 'texto', texto: 'Aqui está 👇', anexos }
    }
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
       * e as recusas que existem não são erro de digitação, são id inventado,
       * ferramenta não autorizada e argumento faltando. Nenhuma delas melhora
       * na segunda tentativa, e a primeira é sinal de que alguém está testando
       * o limite.
       */
      console.warn(`[ia] consulta recusada: ${conferida.motivo}`)
      return { tipo: 'nao_sei', motivo: conferida.motivo }
    }

    const { ferramenta } = conferida.chamada
    memoria.jaPedidos.add(assinatura(resposta.nome, resposta.argumentos))

    const tentouInjetado = camposInjetadosTentados(ferramenta, resposta.argumentos)
    if (tentouInjetado.length > 0) {
      // O valor já foi descartado pela conferência. O registro fica porque
      // tentativa de escolher a identidade de quem sofre a ação é sinal, e
      // sinal que ninguém conta é sinal que ninguém vê.
      console.warn(
        `[ia] o modelo tentou preencher ${tentouInjetado.join(', ')} em ${ferramenta.nome}`,
      )
    }

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
      continue
    }

    /*
     * A política manda perguntar antes. A resposta para aqui e volta depois.
     *
     * O laço termina **sem gravar nada**: o que sai é uma pergunta, e a
     * gravação fica guardada na sessão até a pessoa responder. É o que torna a
     * decisão não-unicamente-automatizada, no sentido do art. 20 da LGPD, e é
     * o que impede o modelo de pular a etapa, pedir no prompt que ele
     * confirme (regra 10) é pedir, não é garantir.
     */
    if (politicaDe(ferramenta, politicas) !== 'automatico') {
      const resumo = rotulos.get(alvoDe(ferramenta, conferida.chamada.valores)) ?? ''
      return {
        tipo: 'confirmar',
        pendente: {
          ferramenta: ferramenta.nome,
          argumentos: conferida.chamada.valores,
          resumo,
        },
        pergunta: perguntaDeConfirmacao(ferramenta.acao ?? 'fazer isso', resumo),
      }
    }

    const disparo = await dispararFerramenta({
      ferramenta,
      argumentos: resposta.argumentos,
      vars,
      conexaoId: chamada.conexaoId,
      opcoes,
      decididoPor: 'ia',
      idsConhecidos: memoria.ids,
    })

    if (!disparo.ok) {
      // Falha de consulta é handoff pelo mesmo motivo do nó de API com
      // `aoFalhar: humano`: responder sem o dado é responder chutando.
      return { tipo: 'nao_sei', motivo: `a consulta ${ferramenta.nome} falhou, ${disparo.motivo}` }
    }

    if (ferramenta.chamada.tipo === 'loja' && ferramenta.chamada.operacao === 'mostrar') {
      cards.push(...produtosDe(disparo.json))
    }
    if (
      ferramenta.chamada.tipo === 'loja' &&
      (ferramenta.chamada.operacao === 'manual' || ferramenta.chamada.operacao === 'cardapio')
    ) {
      // Um arquivo por rodada: pedir o mesmo duas vezes não manda dois PDFs.
      for (const anexo of anexosDe(disparo.json)) {
        if (!anexos.some((a) => a.url === anexo.url)) anexos.push(anexo)
      }
    }

    const recorte = projetar(disparo.json, ferramenta.projecao)
    idsVistos(recorte, memoria.ids)
    rotulosDeId(recorte, rotulos)

    conversa.push({ de: 'ferramenta', nome: ferramenta.nome, texto: JSON.stringify(recorte) })
  }

  /* istanbul ignore next -- o laço sempre sai por `return` acima. */
  return { tipo: 'nao_sei', motivo: 'a IA consultou demais sem chegar a uma resposta' }
}

/**
 * A pessoa respondeu à pergunta de confirmação. E agora?
 *
 * Três saídas, e elas são três de propósito. **Sim** dispara a gravação e
 * devolve a conversa ao modelo com o resultado. **Não** cancela, não grava
 * nada, e devolve a conversa ao modelo dizendo isso, para ele seguir
 * atendendo, e não encerrar. **Qualquer outra coisa** repete a pergunta: quem
 * escreveu "quanto custa?" não recusou nada, e tratar isso como recusa
 * encerraria um assunto que a pessoa nem abordou.
 *
 * Devolve `null` quando não há o que fazer aqui, aí o motor toca normalmente.
 */
async function resolverConfirmacao(
  fluxo: Fluxo,
  sessao: Sessao,
  entrada: Entrada,
  opcoes: OpcoesDeEfeitos,
  atendimento: ContextoDoAtendimento,
): Promise<ResultadoComEfeitos | null> {
  const pendente = sessao.iaPendente
  if (!pendente) return null

  // Só texto responde uma confirmação. Foto, áudio e timeout não são sim nem
  // não, e adivinhar qualquer um dos dois grava ou cancela por conta própria.
  const dito = entrada.tipo === 'texto' ? entrada.texto : ''
  const resposta = dito === '' ? 'nao_entendi' : lerConfirmacao(dito)

  if (resposta === 'nao_entendi') {
    return {
      acoes: [{ tipo: 'enviar_texto', texto: AVISO_DE_DUVIDA }],
      sessao,
    }
  }

  const ferramenta = acharFerramenta(pendente.ferramenta)
  const limpa: Sessao = { ...sessao, iaPendente: null, status: 'aguardando_ia' }

  if (resposta === 'nao' || !ferramenta) {
    /*
     * Recusa também vira linha no log, e isso não é excesso.
     *
     * "A IA não fez nada porque a pessoa disse não" é exatamente o tipo de coisa
     * que alguém vai querer provar depois, inclusive para responder a um
     * pedido de revisão do art. 20, onde a resposta certa é "não houve decisão
     * automatizada nenhuma".
     */
    if (opcoes.clienteId) {
      await registrarChamada({
        clienteId: opcoes.clienteId,
        ...(opcoes.contatoId ? { contatoId: opcoes.contatoId } : {}),
        ferramenta: pendente.ferramenta,
        argumentos: pendente.argumentos,
        decididoPor: 'pessoa_recusou',
        resumo: pendente.resumo,
        ok: false,
      })
    }

    // Volta ao modelo pela porta normal do motor: a conversa continua, e quem
    // escreve a próxima frase é ele, não uma mensagem fixa nossa.
    return comEfeitosDaIa(
      fluxo,
      limpa,
      { tipo: 'ia_respondeu', texto: AVISO_DE_RECUSA },
      opcoes,
      atendimento,
    )
  }

  const disparo = await dispararFerramenta({
    ferramenta,
    argumentos: pendente.argumentos,
    vars: sessao.vars,
    conexaoId: conexaoDoNoDeIa(fluxo, sessao.noAtual),
    opcoes,
    decididoPor: 'pessoa_confirmou',
    resumo: pendente.resumo,
    /*
     * Os ids guardados já passaram pela conferência na hora de suspender.
     * Reconferir contra uma rodada nova seria impossível, a rodada que os viu
     * terminou quando a pergunta foi feita, e recusaria toda confirmação.
     */
    idsConhecidos: new Set(Object.values(pendente.argumentos)),
  })

  if (!disparo.ok) {
    return {
      acoes: [
        { tipo: 'enviar_texto', texto: avisoDeForaDoHorario(atendimento) ?? AVISO_DE_HANDOFF },
        { tipo: 'transferir_humano', motivo: `a consulta ${ferramenta.nome} falhou, ${disparo.motivo}` },
      ],
      sessao: { ...limpa, status: 'humano' },
    }
  }

  return comEfeitosDaIa(
    fluxo,
    limpa,
    { tipo: 'ia_respondeu', texto: `Pronto: ${pendente.resumo || 'feito'}.` },
    opcoes,
    atendimento,
  )
}

/** Reentra no motor com o que a IA "respondeu", sem repetir o laço inteiro. */
function comEfeitosDaIa(
  fluxo: Fluxo,
  sessao: Sessao,
  entrada: Entrada,
  _opcoes: OpcoesDeEfeitos,
  atendimento: ContextoDoAtendimento,
): ResultadoComEfeitos {
  return executar(fluxo, sessao, entrada, atendimento)
}

/**
 * Dispara uma ferramenta e registra o que aconteceu.
 *
 * **Um caminho só**, usado pelo laço da IA e pela retomada da confirmação. Dois
 * caminhos divergiriam, e o que divergiria primeiro é o log, que é justamente
 * a parte que ninguém percebe faltando até precisar dela.
 */
async function dispararFerramenta({
  ferramenta,
  argumentos,
  vars,
  conexaoId,
  opcoes,
  decididoPor,
  resumo,
  idsConhecidos,
}: {
  ferramenta: Ferramenta
  argumentos: Record<string, string>
  /** As variáveis da conversa, de onde saem os campos injetados. */
  vars: Record<string, string>
  conexaoId: string | undefined
  opcoes: OpcoesDeEfeitos
  decididoPor: DecididoPor
  resumo?: string
  /** Ids que a rodada já viu. Ver a trava `soDeResultadoAnterior`. */
  idsConhecidos: Set<string>
}): Promise<{ ok: true; json: unknown } | { ok: false; motivo: string }> {
  const conferida = conferirPedido({
    nome: ferramenta.nome,
    argumentos,
    permitidas: [ferramenta],
    injetados: vars,
    memoria: { ids: idsConhecidos, jaPedidos: new Set() },
  })

  if (!conferida.ok) {
    await logar({ opcoes, ferramenta, argumentos, decididoPor: 'recusado_pela_trava', ok: false, detalhe: conferida.motivo, resumo })
    return { ok: false, motivo: conferida.motivo }
  }

  if (ferramenta.chamada.tipo === 'loja') {
    const r = await executarNaLoja(ferramenta.chamada.operacao, conferida.chamada.valores, opcoes)
    await logar({
      opcoes,
      ferramenta,
      argumentos: conferida.chamada.valores,
      decididoPor,
      ok: r.ok,
      ...(r.ok ? {} : { detalhe: r.motivo }),
      resumo,
    })
    return r
  }

  const chamadaHttp = ferramenta.chamada

  let credencial = null
  if (conexaoId && opcoes.clienteId) {
    try {
      credencial = await lerCredencial(conexaoId, opcoes.clienteId)
    } catch (erro) {
      await alertar('não deu para ler a credencial do cofre para a IA', erro, {
        conexao: conexaoId,
        cliente: opcoes.clienteId,
      })
    }
  }

  if (!credencial) {
    await logar({ opcoes, ferramenta, argumentos: conferida.chamada.valores, decididoPor, ok: false, detalhe: 'sem credencial', resumo })
    return { ok: false, motivo: 'a credencial das consultas não pôde ser lida' }
  }

  const bruta = await chamarHttp(
    {
      tipo: 'chamar_http',
      metodo: chamadaHttp.metodo,
      url: conferida.chamada.url,
      cabecalhos: chamadaHttp.cabecalhos,
      corpo: conferida.chamada.corpo,
      mapear: [],
      aoFalhar: 'humano',
      ...(conexaoId ? { conexaoId } : {}),
    },
    { deTeste: opcoes.origem === 'simulador', credencial, comJson: true },
  )

  await logar({
    opcoes,
    ferramenta,
    argumentos: conferida.chamada.valores,
    decididoPor,
    ok: bruta.ok,
    ...(bruta.ok ? {} : { detalhe: bruta.motivo }),
    resumo,
  })

  return bruta.ok ? { ok: true, json: bruta.json } : { ok: false, motivo: bruta.motivo }
}

/**
 * Ferramenta de loja: a conta é a da conversa, nunca um argumento do modelo.
 *
 * Loja desligada ou ausente é falha com motivo, e não lista vazia: "não temos
 * esse produto" dito por causa de uma integração desligada é frase falsa e
 * venda perdida. Falhando, a conversa vai para uma pessoa.
 */
async function executarNaLoja(
  operacao: OperacaoDeLoja,
  valores: Record<string, string>,
  opcoes: OpcoesDeEfeitos,
): Promise<{ ok: true; json: unknown } | { ok: false; motivo: string }> {
  if (!opcoes.clienteId) return { ok: false, motivo: 'a consulta à loja só funciona numa conta' }

  if (operacao === 'cardapio') {
    /*
     * O cardápio é da conta, não da loja: vem antes de escolher o adaptador,
     * e uma conta com Magento ligada também manda o PDF que subiu. Sem
     * material é resposta, e não falha: "não temos cardápio em arquivo" é
     * verdade, e a conversa não precisa ir para uma pessoa por isso.
     */
    const envio = envioDoCardapio(await listarMateriais(opcoes.clienteId))
    return {
      ok: true,
      json:
        envio.length > 0
          ? { enviado: true, anexos: envio }
          : { enviado: false, aviso: 'esta empresa não cadastrou cardápio em arquivo' },
    }
  }

  // Só o catálogo próprio filtra por categoria; as lojas on-line ignoram.
  const filtro = valores.categoria ? { categoria: valores.categoria } : undefined

  if (operacao === 'pedido') {
    const r = await consultarPedidoDaConta(opcoes.clienteId, {
      numero: valores.numero ?? '',
      telefone: valores.telefone ?? '',
      ...(valores.documento ? { documento: valores.documento } : {}),
    })
    return r.ok ? { ok: true, json: r.valor } : r
  }
  const loja = await lojaAtivaDaConta(opcoes.clienteId)
  if (!loja) return { ok: false, motivo: 'a loja desta conta não está ligada' }

  if (operacao === 'mostrar') {
    // Relê na loja em vez de reusar o que a busca trouxe: o card é a última
    // palavra sobre preço antes do clique, e ela tem que ser a de agora.
    const skus = [valores.produtoId, valores.produtoId2, valores.produtoId3].filter((s): s is string => Boolean(s))
    const r = await loja.lerPorSku(skus, filtro)
    return r.ok ? { ok: true, json: { mostrados: r.valor } } : r
  }

  if (operacao === 'manuais') {
    if (!loja.manuais) return { ok: false, motivo: 'esta loja não tem página de drivers e manuais' }
    const r = await loja.manuais(valores.termo ?? '')
    if (!r.ok) return r
    const { itens, busca } = r.valor
    // Vazio leva a página da busca, como `buscaNaLoja`: o nome que a pessoa
    // escreveu pode não bater com o cadastro, e ela procura por lá.
    return { ok: true, json: { itens, ...(itens.length === 0 ? { buscaDeDownloads: busca } : {}) } }
  }

  if (operacao === 'manual') {
    if (!loja.downloads) return { ok: false, motivo: 'esta loja não tem página de drivers e manuais' }
    const r = await loja.downloads(valores.manualId ?? '')
    if (!r.ok) return r
    if (!r.valor) return { ok: true, json: { enviado: false, motivo: 'produto não encontrado na página de downloads' } }
    const { nome, pagina, arquivos } = r.valor
    const pdf = manualEmPdf(arquivos)
    const temDriver = arquivos.some((a) => a.secao === 'driver')
    return {
      ok: true,
      json: {
        enviado: pdf !== null,
        produto: nome,
        temDriver,
        paginaDeDownloads: pagina,
        ...(pdf
          ? {
              anexo: {
                tipo: 'enviar_midia',
                midia: 'documento',
                url: pdf.url,
                nomeArquivo: nomeDoArquivoDoManual(nome),
                legenda: legendaDoManual(nome, pagina, temDriver),
              } satisfies AnexoDaIa,
            }
          : {}),
      },
    }
  }

  if (operacao === 'frete') {
    const cep = cepLimpo(valores.cep ?? '')
    if (!cep) return { ok: true, json: { opcoes: [], aviso: 'CEP inválido: peça o CEP com 8 dígitos' } }
    if (!loja.frete) return { ok: false, motivo: 'esta loja não calcula frete por aqui' }
    const r = await loja.frete(valores.produtoId ?? '', cep)
    return r.ok ? { ok: true, json: { opcoes: r.valor } } : r
  }

  if (operacao === 'ficha') {
    const sku = valores.produtoId ?? ''
    if (loja.ficha) {
      const r = await loja.ficha(sku)
      if (!r.ok) return r
      return r.valor ? { ok: true, json: { produto: r.valor } } : { ok: false, motivo: 'o produto não está mais na loja' }
    }
    // Loja sem página de produto (catálogo próprio, Nuvemshop): a descrição
    // que existe é a do item, e é ela que vai.
    const r = await loja.lerPorSku([sku])
    if (!r.ok) return r
    const p = r.valor[0]
    if (!p) return { ok: false, motivo: 'o produto não está mais na loja' }
    return { ok: true, json: { produto: { produtoId: p.produtoId, nome: p.nome, descricao: p.descricao ?? '' } } }
  }

  if (operacao === 'buscar') {
    const termos = [valores.termo, valores.termo2, valores.termo3]
      .map((t) => (t ?? '').trim())
      .filter((t, i, todos) => t !== '' && todos.indexOf(t) === i)
    if (termos.length <= 1) {
      const termo = termos[0] ?? ''
      const r = await loja.buscar(termo, filtro)
      if (!r.ok) return r
      // Vazio vem com a página de busca da loja: ver `linkDaBusca`. O catálogo
      // próprio não tem página de busca, e aí vai só a lista vazia.
      if (r.valor.length > 0) return { ok: true, json: { produtos: r.valor } }
      const buscaNaLoja = loja.linkDaBusca(termo)
      return { ok: true, json: buscaNaLoja ? { produtos: [], buscaNaLoja } : { produtos: [] } }
    }

    /*
     * Vários tipos de produto numa mensagem: uma busca por termo, em paralelo,
     * três de cada. Uma loja recusando um termo não derruba os outros; só
     * falha se todos falharem, porque aí o problema é a loja e não o termo.
     */
    const resultados = await Promise.all(termos.map((t) => loja.buscar(t, filtro)))
    if (resultados.every((r) => !r.ok)) return resultados[0] as { ok: false; motivo: string }
    const vistos = new Set<string>()
    const produtos: ProdutoDaLoja[] = []
    const naoAchados: string[] = []
    resultados.forEach((r, i) => {
      const achados = r.ok ? r.valor.filter((p) => !vistos.has(p.produtoId)).slice(0, 3) : []
      if (achados.length === 0) naoAchados.push(termos[i]!)
      for (const p of achados) {
        vistos.add(p.produtoId)
        produtos.push(p)
      }
    })
    const primeiroSemNada = naoAchados[0]
    const buscaNaLoja = primeiroSemNada ? loja.linkDaBusca(primeiroSemNada) : ''
    return {
      ok: true,
      json: {
        produtos,
        ...(naoAchados.length > 0 ? { naoAchados } : {}),
        ...(buscaNaLoja ? { buscaNaLoja } : {}),
      },
    }
  }

  const r = await loja.combinaCom(valores.produtoId ?? '')
  return r.ok ? { ok: true, json: { produtos: r.valor } } : r
}

/**
 * Os arquivos que `executarNaLoja('manual')` (um, em `anexo`) e
 * `executarNaLoja('cardapio')` (até dois, em `anexos`) separaram. Nunca vão ao
 * modelo: a projeção das duas ferramentas não inclui esses campos.
 */
function anexosDe(json: unknown): AnexoDaIa[] {
  const bruto = json as { anexo?: AnexoDaIa; anexos?: unknown } | null
  const lista = [...(bruto?.anexo ? [bruto.anexo] : []), ...(Array.isArray(bruto?.anexos) ? bruto.anexos : [])]
  return lista.filter(
    (a): a is AnexoDaIa =>
      typeof a === 'object' && a !== null && a.tipo === 'enviar_midia' && typeof a.url === 'string' && a.url.startsWith('https://'),
  )
}

/** Os produtos que `executarNaLoja('mostrar')` devolveu, inteiros, com foto. */
function produtosDe(json: unknown): ProdutoDaLoja[] {
  const lista = (json as { mostrados?: unknown } | null)?.mostrados
  return Array.isArray(lista) ? (lista as ProdutoDaLoja[]) : []
}

/**
 * Põe os cards logo depois da frase da IA que os apresenta.
 *
 * Depois, e não no fim da lista: o nó de IA pode seguir para outro bloco que
 * já fala ("posso ajudar em mais alguma coisa?"), e o card chegando depois
 * dessa pergunta leria fora de ordem.
 */
/** O que a pessoa vê. É só isto que pode sair antes da IA responder. */
function ehEnvio(acao: Acao): boolean {
  return (
    acao.tipo === 'enviar_texto' ||
    acao.tipo === 'enviar_midia' ||
    acao.tipo === 'enviar_opcoes' ||
    acao.tipo === 'enviar_produtos'
  )
}

function comCards(acoes: Acao[], texto: string, produtos: ProdutoDaLoja[], anexos: AnexoDaIa[] = []): Acao[] {
  const extras: Acao[] = [...(produtos.length > 0 ? [{ tipo: 'enviar_produtos', produtos } as Acao] : []), ...anexos]
  if (extras.length === 0) return acoes
  const posicao = acoes.findIndex((a) => a.tipo === 'enviar_texto' && a.texto === texto)
  if (posicao === -1) return [...acoes, ...extras]
  return [...acoes.slice(0, posicao + 1), ...extras, ...acoes.slice(posicao + 1)]
}

/** O manual em PDF, como ação de mídia que o canal já sabe mandar. */
type AnexoDaIa = Extract<Acao, { tipo: 'enviar_midia' }>

async function logar({
  opcoes,
  ferramenta,
  argumentos,
  decididoPor,
  ok,
  detalhe,
  resumo,
}: {
  opcoes: OpcoesDeEfeitos
  ferramenta: Ferramenta
  argumentos: Record<string, string>
  decididoPor: DecididoPor
  ok: boolean
  detalhe?: string
  resumo?: string
}): Promise<void> {
  if (!opcoes.clienteId) return

  await registrarChamada({
    clienteId: opcoes.clienteId,
    ...(opcoes.contatoId ? { contatoId: opcoes.contatoId } : {}),
    ferramenta: ferramenta.nome,
    argumentos,
    decididoPor,
    ...(resumo ? { resumo } : {}),
    ok,
    ...(detalhe ? { detalhe } : {}),
  })
}

/**
 * Qual dos argumentos aponta para a coisa que vai ser gravada.
 *
 * O primeiro `id` obrigatório da ferramenta: é `sessao_id` em `agenda_marcar` e
 * `participacao_id` em `agenda_desmarcar`. É esse valor que a conversa já viu
 * com data e hora ao lado, e é por ele que se acha a frase que a pessoa
 * reconhece.
 */
function alvoDe(ferramenta: Ferramenta, valores: Record<string, string>): string {
  const argumento = ferramenta.argumentos.find((a) => a.tipo === 'id' && a.obrigatorio)
  return argumento ? (valores[argumento.nome] ?? '') : ''
}

/** A credencial que o nó de IA onde a conversa parou usa. */
function conexaoDoNoDeIa(fluxo: Fluxo, noId: string | null): string | undefined {
  const no = fluxo.nodes.find((n) => n.id === noId)
  return no?.type === 'ia' ? no.data.conexaoId : undefined
}

/**
 * Põe as datas do dia na sessão, para esta rodada.
 *
 * Sobrescrevem o que houver com o mesmo nome, e isso é o certo: se alguém
 * desenhou um "Guardar em {{hoje}}", o valor do relógio vale mais que o valor
 * congelado, e o validador já avisa que o nome é nativo.
 */
function comDatas(sessao: Sessao, datas: Record<string, string> | undefined): Sessao {
  if (!datas) return sessao
  return { ...sessao, vars: { ...sessao.vars, ...datas } }
}

/**
 * Tira as datas antes de a sessão ser gravada.
 *
 * Sem isto, `{{hoje}}` de ontem sobreviveria numa conversa que atravessou a
 * meia-noite e a próxima mensagem usaria a data velha, a mensagem sai bonita
 * e com o dia errado, que é o defeito mais difícil de alguém reparar. E oito
 * campos derivados iriam parar na ficha do lead sem ninguém ter preenchido.
 */
function semDatas(sessao: Sessao): Sessao {
  const vars = { ...sessao.vars }
  for (const nome of VARIAVEIS_DE_DATA) delete vars[nome]
  // Pelo mesmo motivo: `atendimento_aberto` gravado é um "sim" que às 3h da
  // manhã continua dizendo que tem gente atendendo.
  for (const nome of VARIAVEIS_DO_ATENDIMENTO) delete vars[nome]
  return { ...sessao, vars }
}
