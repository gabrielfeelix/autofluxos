/**
 * O recado entre quem escuta o servidor e quem desenha a conversa.
 *
 * ---------------------------------------------------------------------------
 * Por que um evento do navegador, e não um contexto do React
 * ---------------------------------------------------------------------------
 *
 * Os dois lados desta conversa são primos distantes na árvore: `PulsoDoInbox`
 * nasce no topo da página, e o `Historico` nasce três fronteiras abaixo, dentro
 * de um `<Suspense>` que remonta a cada troca de contato. Um contexto exigiria
 * um provedor envolvendo a página inteira, e a página é Server Component: o
 * provedor viraria mais uma camada cliente em volta de tudo, só para carregar
 * um booleano.
 *
 * `window` já é o lugar onde as duas partes se encontram, e o evento é o que o
 * navegador dá de graça para isso. Um `CustomEvent` também sobrevive ao
 * remonte: quem escuta se inscreve de novo, e nada precisa ser guardado.
 *
 * ---------------------------------------------------------------------------
 * A conversa responde, e a resposta é o que evita o F5
 * ---------------------------------------------------------------------------
 *
 * O fluxo tem duas mãos de propósito:
 *
 * 1. Chegou mensagem na conta → `pedirNovas()`.
 * 2. A conversa aberta busca o que chegou. Se a mensagem era **dela**, ela
 *    acrescenta a bolha e responde `avisarQueDeuConta()`.
 * 3. Quem perguntou espera um instante. Veio resposta, a tela já está em dia e
 *    **nada mais acontece**. Não veio, a mensagem era de outra conversa, e aí
 *    sim vale redesenhar a fila.
 *
 * É essa segunda mão que tira o "F5 a cada mensagem": antes, toda mensagem
 * refazia a página inteira no servidor, inclusive a que já estava à vista.
 */

/** Chegou coisa nova na conta: quem estiver com uma conversa aberta, confira. */
export const PEDIDO = 'inbox:conferir-conversa'

/** A conversa aberta já mostrou o que chegou. Não precisa redesenhar a página. */
export const DEU_CONTA = 'inbox:conversa-em-dia'

/**
 * Quanto tempo esperar a conversa dizer que deu conta, antes de redesenhar a
 * página por garantia.
 *
 * É o tempo de uma ida ao servidor numa conexão ruim. Curto demais e a fila
 * pisca à toa enquanto a busca ainda está no ar; longo demais e a mensagem de
 * outra conversa demora a aparecer na fila.
 */
export const ESPERA_PELA_CONVERSA_MS = 2_500

/**
 * O carimbo que veio junto do pedido.
 *
 * É o pulso da conta (`<ts>|<flags>`, ver `repos/leads.ts`), opaco de
 * propósito, e a conversa usa dele só a data: se o instante mais recente da
 * conta já é um instante que ela tem na tela, a novidade era dela, e ela
 * responde `avisarQueDeuConta()` sem precisar de mais nada do servidor.
 *
 * `null` = pedido sem carimbo, o caso de quem acabou de enviar uma mensagem e
 * quer vê-la agora, sem esperar o servidor avisar.
 */
export type PedidoDeNovas = CustomEvent<string | null>

export function pedirNovas(pulso: string | null = null) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PEDIDO, { detail: pulso }))
}

export function avisarQueDeuConta() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DEU_CONTA))
}
