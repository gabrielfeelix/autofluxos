import { redirect } from 'next/navigation'
import { alertar } from '@/server/alertar'
import { lerEstado } from '@/server/instagram/estado'
import { salvarNumeroDoOnboarding } from '@/server/repos/coexistencia'
import { conferirAcessoAoCliente, sessaoAtual } from '@/server/sessao'
import { trocarCodigoPorToken } from '@/server/whatsapp/conexao'
import { terminarOnboarding } from '@/server/whatsapp/onboarding'

export const dynamic = 'force-dynamic'

/**
 * Um minuto, e não o padrão.
 *
 * Esta rota faz **cinco chamadas à Meta em sequência** antes de responder:
 * trocar o `code` por token, ler o número, inscrever o app na WABA do cliente,
 * e disparar os dois syncs. Cada uma é rede, e a soma passa folgadamente de
 * alguns segundos num dia ruim da Graph API.
 *
 * O que um timeout aqui custa é desproporcional ao que ele parece: a função
 * morre no meio, e o que já foi disparado **não volta atrás**, cada sync só
 * pode ser disparado uma vez na vida daquele número. Terminar a sequência é
 * mais importante que responder rápido, porque quem espera é uma pessoa que
 * acabou de conectar e vai ver a tela de qualquer jeito.
 */
export const maxDuration = 60

/**
 * Onde a Meta devolve o cliente depois do Embedded Signup **hospedado**.
 *
 * A Meta hospeda a tela inteira (o link do painel já vem com Coexistence
 * ligado) e devolve o cliente aqui com um `code`. O nosso lado é este arquivo:
 * conferir quem chegou, trocar o `code` por token **no servidor**, gravar o
 * número e deixar o onboarding terminar dentro da janela de 24h.
 *
 * ---------------------------------------------------------------------------
 * As duas conferências, e nenhuma substitui a outra
 * ---------------------------------------------------------------------------
 *
 * Esta rota é **pública por obrigação**: quem a chama é o navegador de quem
 * autorizou, vindo do facebook.com, sem cookie nosso garantido. Então:
 *
 * - o `state` prova **qual cliente** começou. Sem ele, bastaria induzir um
 *   administrador logado a abrir um link para ligar um número de WhatsApp ao
 *   cliente errado, ou ligar o número do atacante a um cliente de verdade e
 *   passar a receber as mensagens dele.
 * - a sessão prova **quem está pedindo**. O bilhete diz qual cliente; só a
 *   sessão diz se esta pessoa pode mexer nele.
 *
 * O `state` é o mesmo mecanismo do Instagram (`instagram/estado.ts`), reusado
 * de propósito: ele assina um `clienteId` e não sabe de que canal se trata, e
 * duplicá-lo aqui seria duplicar a validade, o segredo e a chance de as duas
 * cópias discordarem.
 *
 * **A resposta é sempre um redirect para a tela.** O navegador de quem clicou
 * está aqui e espera voltar para o painel; um JSON na cara dele seria a tela do
 * produto virando endpoint.
 */
export async function GET(req: Request) {
  const parametros = new URL(req.url).searchParams

  const clienteId = lerEstado(parametros.get('state'))
  if (!clienteId) {
    // Sem bilhete válido não sabemos nem de que cliente era. A lista é o único
    // destino honesto.
    redirect('/painel?erro=whatsapp_estado')
  }

  const destino = `/clientes/${clienteId}/conversas/canais/whatsapp`

  /*
   * **A sessão pode não vir aqui, e isso é normal, não é invasão.**
   *
   * Quem chega é o navegador voltando do `facebook.com`: navegação cross-site.
   * O cookie do Better Auth é `SameSite=Lax`, e `Lax` manda o navegador **não
   * enviar o cookie** num redirect vindo de outro site. Exigir sessão aqui
   * recusava toda conexão real com `?erro=whatsapp_acesso`, e pior, sem
   * alerta, porque a recusa acontece antes do código que alerta.
   *
   * Quando ela vem, vale: sessão presente e sem direito àquele cliente é
   * tentativa de ligar um número na conta de outro, e continua recusada.
   *
   * Quando não vem, quem responde é o `state`, e ele basta, porque é o que
   * esta rota precisa saber. Ele é **assinado por nós** e vale dez minutos:
   * quem não tem o segredo não fabrica um, então o `clienteId` que chega aqui
   * só pode ter saído de uma tela onde alguém com acesso apertou "conectar".
   * O que ele não prova é *quem* está voltando, e para gravar o número
   * conectado essa pergunta não muda a resposta.
   */
  const acesso = await conferirAcessoAoCliente(clienteId)
  const temSessao = (await sessaoAtual()) !== null
  if (temSessao && !acesso) {
    redirect('/painel?erro=whatsapp_acesso')
  }

  /*
   * A pessoa clicou em "Cancelar" na tela da Meta.
   *
   * Vem como `error=access_denied`, e **não é falha: é resposta**. Tratar junto
   * com erro de verdade faria a tela pedir para investigar uma decisão que
   * alguém tomou de propósito.
   */
  if (parametros.get('error')) {
    redirect(`${destino}?resultado=cancelado`)
  }

  const codigo = parametros.get('code')
  if (!codigo) redirect(`${destino}?resultado=sem_codigo`)

  /*
   * O Hosted devolve qual número e qual WABA embarcaram.
   *
   * Sem o número não há o que gravar: ele é a chave do canal e é por ele que o
   * webhook descobre de quem é a mensagem. A WABA pode faltar e o onboarding
   * avisa por alerta, ela é necessária para inscrever o app e disparar os
   * syncs, mas não para o número existir.
   */
  const phoneNumberId = parametros.get('phone_number_id')
  const wabaId = parametros.get('waba_id')

  if (!phoneNumberId) {
    await alertar(
      'o retorno do Embedded Signup veio sem phone_number_id',
      new Error(`parâmetros: ${JSON.stringify(Object.fromEntries(parametros))}`),
      { cliente: clienteId },
    )
    redirect(`${destino}?resultado=sem_numero`)
  }

  try {
    // **No servidor, nunca no navegador**: a troca exige o `client_secret` do
    // app, que é o que assina o webhook de todos os clientes.
    const { token, expiraEm } = await trocarCodigoPorToken(codigo)

    const { canalId } = await salvarNumeroDoOnboarding({
      clienteId,
      phoneNumberId,
      wabaId,
      token,
      expiraEm,
    })

    /*
     * **Depois de gravar, e dentro do mesmo pedido.**
     *
     * Depois porque um sync disparado antes de o canal existir manda a Meta
     * responder para um webhook que não acha canal nenhum, e o histórico dela
     * chega uma vez só.
     *
     * Dentro do mesmo pedido porque a janela é de 24 horas e **cada sync só
     * pode ser disparado uma vez**: um passo manual aqui significa que o
     * cliente que embarcou numa sexta à noite perde a janela inteira. Não
     * estoura para cá, ver o cabeçalho de `onboarding.ts`.
     */
    await terminarOnboarding({
      canalId,
      clienteId,
      phoneNumberId,
      wabaId,
      token,
    })
  } catch (erro) {
    /*
     * `redirect()` funciona lançando uma exceção, então ele **não pode** ficar
     * dentro deste `try`, seria capturado aqui e virado em "falhou". É a
     * pegadinha clássica do App Router, e ela transforma um sucesso em erro.
     */
    await alertar('o onboarding do WhatsApp falhou', erro, { cliente: clienteId })
    redirect(`${destino}?resultado=falhou`)
  }

  redirect(`${destino}?resultado=conectado`)
}
