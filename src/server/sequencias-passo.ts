import 'server-only'
import { MOTIVOS_DE_SAIDA, passoDoIndice, quandoRodaOPasso } from '@/core/sequencias'
import { chaveDoPasso, dadosDoPassoSchema } from '@/core/tarefas'
import { abrirFluxoParaContato, type FabricaDeCanal } from './receber-mensagem'
import { agendar } from './repos/tarefas'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { podeEnviar, variaveisDe } from '@/core/templates'
import { lerTemplate } from './repos/templates'
import { acharContato, contextoDeResposta } from './repos/conversas'
import {
  acharInscricao,
  acharSequencia,
  avancarInscricao,
  encerrarInscricao,
} from './repos/sequencias'

/**
 * A execução de um passo de sequência (0031).
 *
 * Mora à parte de `server/sequencias.ts` para não fechar ciclo de imports: ele
 * é chamado do caminho de uma mensagem que chega, e este aqui precisa de
 * `receber-mensagem.ts` inteiro para abrir um fluxo. Quem chama este arquivo é
 * só o despachante do agendador, `server/tarefas.ts`.
 */

/**
 * Um passo venceu.
 *
 * A conferência dupla — inscrição ainda ativa **e** ainda no mesmo índice — é o
 * que impede o pior erro daqui: uma tarefa velha chegando depois de a pessoa já
 * ter avançado mandaria de novo algo que ela recebeu.
 *
 * **A janela de 24h é conferida na entrega, não no desenho.** O relógio corre
 * entre agendar e mandar, e a tela só conseguiu prever com a janela cheia. Se
 * ela fechou, a inscrição vira `bloqueada` — estado próprio, e não `saiu`,
 * porque é a única saída que significa "a sequência não entregou" em vez de "a
 * sequência funcionou". É o número que diz ao cliente que os prazos dele estão
 * longos demais.
 */
export async function rodarPassoDeSequencia(
  dados: unknown,
  fabricaDeCanal?: FabricaDeCanal,
): Promise<'feita' | 'ignorada'> {
  const analise = dadosDoPassoSchema.safeParse(dados)
  if (!analise.success) return 'ignorada'

  const { inscricaoId, sequenciaId, contatoId, passoIndice, entrouEm } = analise.data

  const inscricao = await acharInscricao(inscricaoId)
  if (!inscricao) return 'ignorada'
  if (inscricao.estado !== 'ativa') return 'ignorada'
  // A inscrição andou entre o agendamento e agora — outro passo já saiu.
  if (inscricao.passoAtual !== passoIndice) return 'ignorada'

  const sequencia = await acharSequencia(inscricao.clienteId, sequenciaId)
  // Sequência apagada ou desligada no meio do caminho. Desligar é um ato
  // deliberado do cliente, e continuar entregando depois dele seria ignorar o
  // interruptor que a tela oferece.
  if (!sequencia || !sequencia.ativa) {
    await encerrarInscricao(inscricaoId, 'saiu', 'sequencia_desligada')
    return 'ignorada'
  }

  const passo = passoDoIndice(sequencia.passos, passoIndice)
  if (!passo) {
    await encerrarInscricao(inscricaoId, 'concluida', null)
    return 'ignorada'
  }

  /*
   * O passo que carrega modelo aprovado vai por outro caminho (0061).
   *
   * `abrirFluxoParaContato` manda texto livre, e texto livre fora das 24h é
   * recusado pela Meta — foi por isso que o teto do passo era 1440. Com um
   * modelo, o passo atravessa a janela fechada, que é a única razão de o teto
   * ter subido para 30 dias.
   *
   * A ordem importa: **o modelo é tentado antes da janela ser conferida**. O
   * contrário encerraria a inscrição como `bloqueada` justamente no caso que
   * esta mudança existe para atender.
   */
  if (passo.templateId) {
    const saiu = await mandarModeloDoPasso(inscricao.clienteId, contatoId, passo.templateId)

    if (saiu === 'sem_contexto' || saiu === 'sem_modelo') {
      // Número fora do ar, ou modelo apagado/reprovado. Nada disso passa
      // sozinho: insistir três vezes só enche a fila de erro.
      await encerrarInscricao(inscricaoId, 'saiu', 'sem_fluxo')
      return 'ignorada'
    }

    if (saiu === 'erro') {
      // Rede ou recusa transitória da Meta: vale nova tentativa, e é isso que
      // estourar aqui faz.
      throw new Error('o modelo não saiu; o passo tenta de novo')
    }
  } else {
    const resultado = await abrirFluxoParaContato(
      inscricao.clienteId,
      contatoId,
      passo.fluxoId,
      fabricaDeCanal,
    )

    if (resultado === 'ocupado') {
      // Uma mensagem está sendo processada agora, e a mensagem ganha do prazo,
      // sempre. Devolver o erro faz a tarefa voltar para a fila e tentar de novo
      // — é o único desfecho aqui que merece nova tentativa.
      throw new Error('o contato está ocupado; o passo tenta de novo')
    }

    if (resultado === 'janela_fechada') {
      await encerrarInscricao(inscricaoId, 'bloqueada', MOTIVOS_DE_SAIDA.janela_fechada)
      return 'ignorada'
    }

    if (resultado === 'automacao_pausada') {
      await encerrarInscricao(inscricaoId, 'saiu', 'automacao_pausada')
      return 'ignorada'
    }

    /*
     * Alguém da equipe está atendendo agora (RB-48, T7.3).
     *
     * **Estourar, e não encerrar**, e a diferença é a decisão: encerrar mataria o
     * acompanhamento por causa de um atendimento que vai acabar em vinte minutos,
     * e a RB-47 exige ação explícita para reinscrever. Estourar devolve a tarefa
     * à fila, e ela tenta de novo mais tarde, quando o atendimento tiver
     * terminado. É o mesmo tratamento de `ocupado`, e pelo mesmo motivo: a pessoa
     * ganha do prazo, sempre.
     *
     * A pausa por atendimento **não** entra como estado da inscrição, e é
     * deliberado: a inscrição segue `ativa`, que é a verdade (ela não saiu de
     * nada), e a pausa é uma condição do momento do envio, não do acompanhamento.
     */
    if (resultado === 'atendimento_humano') {
      throw new Error('alguém da equipe está atendendo; o passo tenta de novo')
    }

    if (resultado === 'sem_fluxo' || resultado === 'sem_contexto') {
      // O fluxo do passo foi despublicado, apagado, ou o número saiu do ar. Não
      // adianta tentar de novo: nada disso passa sozinho, e insistir três vezes
      // só enche a fila de erro. A inscrição morre dizendo por quê.
      await encerrarInscricao(inscricaoId, 'saiu', 'sem_fluxo')
      return 'ignorada'
    }
  }

  const proximo = passoDoIndice(sequencia.passos, passoIndice + 1)
  if (!proximo) {
    await encerrarInscricao(inscricaoId, 'concluida', null)
    return 'feita'
  }

  await avancarInscricao(inscricaoId, passoIndice + 1)
  await agendar({
    clienteId: inscricao.clienteId,
    tipo: 'passo_de_sequencia',
    // **Do evento, não do agora.** Recontar a partir daqui empurraria a
    // sequência inteira para a frente a cada atraso do agendador, e o passo de
    // 20h chegaria fora da janela por causa de uma passada que demorou.
    quando: quandoRodaOPasso(new Date(entrouEm), proximo),
    chave: chaveDoPasso(inscricaoId),
    dados: {
      inscricaoId,
      sequenciaId,
      contatoId,
      passoIndice: passoIndice + 1,
      entrouEm,
    },
  })

  return 'feita'
}

/**
 * Manda o modelo aprovado de um passo (0061).
 *
 * **É o que permite um passo além das 24h existir.** Fora da janela o WhatsApp
 * recusa texto livre, então um passo de 3 dias sem modelo nunca entregaria — e
 * era por isso que o teto da 0031 era 1440.
 *
 * Não confere a janela de propósito: modelo aprovado atravessa janela fechada,
 * que é o ponto inteiro dele. Conferir aqui recriaria o bloqueio que esta
 * mudança remove.
 *
 * As variáveis do modelo são preenchidas com o nome do contato, e só. Um passo
 * de sequência não tem de onde tirar mais nada — quem precisa de valor por
 * pessoa usa transmissão, onde a tela pergunta.
 */
async function mandarModeloDoPasso(
  clienteId: string,
  contatoId: string,
  templateId: string,
): Promise<'ok' | 'sem_contexto' | 'sem_modelo' | 'erro'> {
  const template = await lerTemplate(templateId)
  // Modelo apagado, de outro cliente, ou que a Meta pausou depois de aprovado.
  // Nenhum dos três passa sozinho.
  if (!template || template.clienteId !== clienteId) return 'sem_modelo'
  if (!podeEnviar(template.status)) return 'sem_modelo'

  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return 'sem_contexto'

  // O nome vem do contato, que é quem o tem. `contextoDeResposta` responde
  // "por onde falar", não "com quem".
  const contato = await acharContato(contatoId)

  try {
    const canal = await adaptadorDoCanal(contexto.canal)
    if (!canal.enviarTemplate) return 'sem_modelo'

    const quantas = variaveisDe(template.componentes.corpo).length
    await canal.enviarTemplate(contexto.waId, {
      nome: template.nome,
      idioma: template.idioma,
      ...(quantas > 0
        ? {
            valores: {
              // Vazio a Meta recusa com 132000; "tudo bem" é o que sobra quando
              // o contato não tem nome gravado.
              corpo: Array.from({ length: quantas }, () => contato?.nome || 'tudo bem'),
            },
          }
        : {}),
    })

    return 'ok'
  } catch (erro) {
    console.error('[sequencia] o modelo do passo não saiu', erro)
    return 'erro'
  }
}
