import 'server-only'
import { alertar } from '../alertar'
import {
  anotarIdentidade,
  anotarWaba,
  guardarRequestIdDoSync,
  marcarCoexistente,
  reservarSync,
} from '../repos/coexistencia'
import {
  dispararSync,
  ehCoexistente,
  inscreverNaWaba,
  lerNumero,
  wabaQueContemONumero,
} from './conexao'

/**
 * O que acontece depois que o cliente volta do Embedded Signup hospedado.
 *
 * ---------------------------------------------------------------------------
 * A janela de 24 horas é o dono desta ordem
 * ---------------------------------------------------------------------------
 *
 * Depois de embarcar, temos **24 horas** para sincronizar contatos e histórico.
 * Passou, o cliente precisa ser desembarcado e refazer o Embedded Signup
 * inteiro. E **cada sync só pode ser disparado uma vez** — não há segunda
 * tentativa, nem como perguntar à Meta se já gastamos a nossa.
 *
 * Por isso o disparo **não é um botão que alguém aperta quando lembra**: é
 * consequência automática do onboarding terminar. Um passo manual aqui
 * significa que o cliente que embarcou numa sexta à noite perde a janela.
 *
 * ---------------------------------------------------------------------------
 * A ordem, e por que cada passo vem onde vem
 * ---------------------------------------------------------------------------
 *
 * 1. **Ler o número.** É o que prova que ele é coexistente de verdade
 *    (`is_on_biz_app` **e** `platform_type: CLOUD_API`). Disparar sync para um
 *    número que não é coexistente queima a chance sem trazer nada.
 * 2. **Inscrever na WABA do cliente.** Sem isso, os webhooks que respondem ao
 *    disparo se perdem — a janela queima e nem o erro aparece.
 * 3. **Reservar, depois disparar.** A reserva é no banco e é atômica; o disparo
 *    é a chamada à Meta. Nessa ordem, dois retornos do mesmo onboarding
 *    chegando juntos não disparam duas vezes.
 * 4. **Contatos antes do histórico.** A agenda dá nome a quem aparece no
 *    histórico; ao contrário, o histórico entra com números crus e só ganha
 *    nome se alguém reimportar — que não dá, porque o sync não repete.
 *
 * **Nada aqui estoura para quem chama.** A conexão já valeu no passo em que o
 * canal foi gravado; um sync que falha é ruim e não pode desfazer a conexão do
 * cliente. Tudo que falha vira alerta, e o alerta é o que faz alguém olhar
 * **dentro** da janela, que é a única hora em que dá para consertar.
 */
export async function terminarOnboarding(entrada: {
  canalId: string
  clienteId: string
  phoneNumberId: string
  wabaId: string | null
  token: string
}): Promise<void> {
  const contexto = { cliente: entrada.clienteId, numero: entrada.phoneNumberId }

  let coexistente = false
  try {
    const numero = await lerNumero(entrada.phoneNumberId, entrada.token)
    coexistente = ehCoexistente(numero)

    /*
     * **O telefone de verdade, para a tela ter o que mostrar.**
     *
     * Esta resposta já trazia `display_phone_number` e `verified_name`, e nós
     * jogávamos os dois fora — a tela então exibia o `phone_number_id`, um
     * número que o cliente nunca viu. Ele olhava a lista, não achava o seu
     * telefone, e concluía que não tinha conectado.
     *
     * Melhor-esforço de propósito: é enfeite de tela, e falhar aqui não pode
     * impedir a conexão de existir. Sem isso a tela cai de volta no id.
     */
    await anotarIdentidade(entrada.canalId, {
      displayPhoneNumber: numero.display_phone_number ?? null,
      verifiedName: numero.verified_name ?? null,
    }).catch(async (erro) => {
      await alertar('não deu para anotar o telefone de exibição do número', erro, contexto)
    })
  } catch (erro) {
    /*
     * Não deu para perguntar. **Não assumimos que é coexistente**: seguir em
     * frente dispararia os dois syncs de um número que pode ser Cloud API
     * pura, gastando as duas chances por um palpite.
     */
    await alertar('não deu para conferir se o número é coexistente', erro, contexto)
    return
  }

  if (!coexistente) {
    // Cloud API pura. Não é erro — é o outro caminho do produto, e ele não tem
    // agenda nem histórico para sincronizar.
    return
  }

  await marcarCoexistente(entrada.canalId)

  /*
   * **Qual WABA contém este número — perguntado, não presumido.**
   *
   * O `waba_id` da query do Embedded Signup era tratado como verdade até
   * 13/set/2026, quando o primeiro cliente com **duas** WABAs mostrou o preço:
   * o retorno apontava uma, o número dele estava na outra, e nos inscrevemos na
   * errada. Nada entrou no Inbox dele, sem um erro sequer — webhook de WABA sem
   * app inscrito não é entregue nem reclama. Ver `wabaQueContemONumero`.
   *
   * Por isso a resposta da Meta **vence** o que veio na query. Só se a busca
   * não achar nada é que o `waba_id` do retorno serve de último recurso: ele
   * ainda é melhor que desistir, e o alerta diz que estamos no palpite.
   */
  let wabaId = entrada.wabaId
  const encontrada = await wabaQueContemONumero(entrada.phoneNumberId, entrada.token)

  if (encontrada) {
    if (entrada.wabaId && entrada.wabaId !== encontrada) {
      /*
       * Aconteceu de verdade, e em silêncio. O alerta existe para que a
       * próxima vez seja percebida na hora — e para deixar no histórico que a
       * WABA gravada no canal não é a que o retorno trouxe.
       */
      await alertar(
        'o Embedded Signup apontou uma WABA e o número está em outra',
        new Error(
          `o retorno trouxe waba_id ${entrada.wabaId}, mas o número ${entrada.phoneNumberId} está na WABA ${encontrada}. Seguindo a Meta: a inscrição e os syncs vão para ${encontrada}.`,
        ),
        { ...contexto, waba: encontrada },
      )
    }
    wabaId = encontrada
  } else if (wabaId) {
    await alertar(
      'nenhuma WABA do token contém este número; usando a do retorno',
      new Error(
        `wabaQueContemONumero não achou ${entrada.phoneNumberId} em nenhuma WABA do token; seguindo com ${wabaId}, que veio da query do Embedded Signup`,
      ),
      { ...contexto, waba: wabaId },
    )
  }

  /*
   * A inscrição na WABA **do cliente**, antes de qualquer disparo.
   *
   * Se ela falhar, parar aqui é o certo: disparar mesmo assim gastaria as duas
   * chances mandando resposta para um webhook que não escuta.
   */
  if (wabaId) {
    try {
      await inscreverNaWaba(wabaId, entrada.token)
    } catch (erro) {
      await alertar('o app não se inscreveu na WABA do cliente; os syncs não foram disparados', erro, {
        ...contexto,
        waba: wabaId,
      })
      return
    }

    /*
     * A WABA descoberta é gravada no canal.
     *
     * Sem isto, `channels.waba_id` guardaria a WABA do retorno enquanto a
     * inscrição e os webhooks vivem noutra — e quem for depurar daqui a seis
     * meses leria o campo errado, que foi exatamente o que atrasou este caso.
     *
     * Melhor-esforço: a inscrição já valeu, e falhar ao anotar não pode
     * impedir os syncs de saírem dentro da janela de 24h.
     */
    if (wabaId !== entrada.wabaId) {
      await anotarWaba(entrada.canalId, wabaId).catch(async (erro) => {
        await alertar('não deu para corrigir a WABA do canal', erro, {
          ...contexto,
          waba: wabaId,
        })
      })
    }
  } else {
    await alertar(
      'o número é coexistente mas não sabemos a WABA dele; os syncs não foram disparados',
      new Error('channels.waba_id está vazio e nenhuma WABA do token contém o número'),
      contexto,
    )
    return
  }

  // Contatos primeiro: a agenda dá nome a quem aparece no histórico.
  await dispararUmaVez(entrada, 'contatos')
  await dispararUmaVez(entrada, 'historico')
}

/**
 * Reserva e dispara — nessa ordem, e só se a reserva for nossa.
 *
 * O `reservarSync` é um `update` condicional no banco: exatamente uma chamada
 * encontra a coluna vazia. Quem não conseguir a reserva **não dispara**, e isso
 * é o que impede dois webhooks do mesmo onboarding — o caso comum, não o raro —
 * de gastarem a mesma chance duas vezes.
 */
async function dispararUmaVez(
  entrada: { canalId: string; clienteId: string; phoneNumberId: string; token: string },
  tipo: 'contatos' | 'historico',
): Promise<void> {
  const contexto = { cliente: entrada.clienteId, numero: entrada.phoneNumberId, sync: tipo }

  let reservado = false
  try {
    reservado = await reservarSync(entrada.canalId, tipo)
  } catch (erro) {
    await alertar('não deu para reservar o sync', erro, contexto)
    return
  }

  // Já foi gasto. Silêncio é a resposta certa: é o desenho funcionando.
  if (!reservado) return

  try {
    const requestId = await dispararSync(entrada.phoneNumberId, tipo, entrada.token)

    if (requestId) {
      await guardarRequestIdDoSync(entrada.canalId, tipo, requestId)
    } else {
      /*
       * Disparou e a Meta não devolveu `request_id`.
       *
       * A reserva **fica de pé** de propósito: o disparo aconteceu, e tentar de
       * novo não o desfaz — só gastaria a chance de novo, agora sem nem a
       * marca de que a primeira saiu. O que falta é a prova para o suporte, e
       * isso é alerta, não retry.
       */
      await alertar(
        'o sync foi disparado mas a Meta não devolveu request_id',
        new Error('sem request_id na resposta; o suporte da Meta pede esse id'),
        contexto,
      )
    }
  } catch (erro) {
    /*
     * A reserva também fica de pé aqui, e é a decisão difícil deste arquivo.
     *
     * Não dá para saber se a Meta processou o disparo antes de a chamada
     * falhar. Liberar a reserva e tentar de novo arrisca gastar a segunda
     * chance de uma coisa que já aconteceu — e aí não há terceira. Ficar de pé
     * arrisca o contrário: um sync que não saiu e não será retentado.
     *
     * O segundo erro é recuperável dentro da janela (o alerta chama alguém, e
     * há 24h), o primeiro não é recuperável de jeito nenhum.
     */
    await alertar('o disparo do sync falhou', erro, contexto)
  }
}
