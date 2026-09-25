import type { Opcao, TipoDeMidia } from '@/core/flow/schema'
import type { CanalId } from '@/core/canais'
import type { ProdutoDaLoja } from '@/core/loja'

/** O que o canal precisa para entregar um arquivo. Espelha `enviar_midia`. */
export type Midia = {
  midia: TipoDeMidia
  url: string
  legenda?: string
  nomeArquivo?: string
}

/**
 * A mensagem que esta está citando, quando há uma.
 *
 * É o `wa_message_id` da outra, o identificador da Meta, não o nosso. Vai
 * como opcional em todo envio porque citar é escolha de quem responde, e não
 * um tipo de mensagem à parte: o WhatsApp cita texto, foto e PDF igualmente.
 *
 * **O canal que não sabe citar ignora e entrega mesmo assim.** O Instagram não
 * tem o recurso, e transformar isso em erro faria a resposta não sair por causa
 * de um enfeite.
 */
export type Citacao = string

/**
 * A quem o "digitando" se refere.
 *
 * **Os dois campos existem porque os canais pedem coisas diferentes**, e essa
 * diferença só apareceu quando o segundo canal chegou. O WhatsApp liga o
 * indicador respondendo a uma mensagem específica, o mesmo pedido marca como
 * lida e mostra "digitando", e sem o `message_id` a Meta recusa. O Instagram
 * usa `sender_action`, que não sabe nada de mensagem: ele quer saber com quem
 * a conversa é.
 *
 * Passar só o id da mensagem, como era antes, obrigaria o adaptador do
 * Instagram a adivinhar o destinatário a partir dele, informação que ele não
 * tem. Passar os dois deixa cada canal usar o que precisa e nenhum inventar
 * nada.
 */
export type AlvoDoIndicador = {
  /** Id da mensagem que chegou. É o que o WhatsApp exige. */
  mensagemId: string
  /** Id de quem está do outro lado. É o que o Instagram exige. */
  contato: string
}

/**
 * Os valores que preenchem as lacunas de um modelo aprovado.
 *
 * A Meta liga valor e lacuna **pela posição**, não pelo nome: o primeiro item
 * da lista vai para `{{1}}`, o segundo para `{{2}}`. Por isso é um array e não
 * um objeto, um `Record<string, string>` daria a impressão de que a ordem não
 * importa, e ela é a única coisa que importa.
 *
 * `cabecalho` é separado do `corpo` porque a Meta os numera **de forma
 * independente**: o `{{1}}` do cabeçalho e o `{{1}}` do corpo são lacunas
 * diferentes, em componentes diferentes do mesmo payload. Juntar os dois num
 * array só faria o valor do cabeçalho aparecer no meio do texto.
 */
export type ValoresDoTemplate = {
  /** O header aceita **uma** variável no máximo, ver `LIMITE_VARIAVEIS_NO_HEADER`. */
  cabecalho?: string[]
  corpo?: string[]
}

/**
 * O que o canal precisa para entregar um modelo aprovado.
 *
 * `idioma` vai junto e não é opcional porque **o mesmo nome existe em vários
 * idiomas**: é assim que se faz um template bilíngue, e mandar sem o idioma
 * faz a Meta recusar com 132001 ("não existe nesse idioma") mesmo o template
 * estando aprovado.
 */
export type Template = {
  nome: string
  idioma: string
  valores?: ValoresDoTemplate
}

/**
 * O que a Meta respondeu a um envio de template.
 *
 * **`retida` não é `aceita`, e é por isso que este tipo existe.** Os outros
 * envios do `Canal` devolvem `void` porque para eles 200 é sucesso. Para
 * template não é: a Meta responde 200 e manda `message_status`, que pode dizer
 * `held_for_quality_assessment`, ela **segurou** a mensagem para avaliar, e se
 * o veredito for ruim a mensagem é descartada e chega depois como `failed` com
 * código 132015.
 *
 * Quem trata o 200 como entrega mostra "campanha enviada" e nada saiu. Ver
 * `lerStatusDeEnvio()` em `core/templates.ts`.
 *
 * `wamid` é o id da Meta para esta mensagem, a única chave que liga o webhook
 * de status de volta a esta linha, porque o webhook não sabe nada de
 * transmissão.
 */
export type EnvioDeTemplate = {
  wamid: string
  situacao: 'aceita' | 'retida' | 'falhou'
}

/**
 * Por onde as mensagens saem.
 *
 * O motor nunca conhece este arquivo: ele descreve ações, e quem executa é um
 * canal. Trocar o WhatsApp por outra coisa é escrever outra implementação ,
 * nada em `core/` muda.
 */
export type Canal = {
  /**
   * Por onde este canal fala, para o `utm_source` dos links de produto.
   * Ausente vale WhatsApp, que é o canal de sempre e o dos testes.
   */
  origem?: CanalId
  /** Mostra "digitando" quando houver suporte e segura a resposta pelo prazo. */
  aguardarResposta(alvo: AlvoDoIndicador, atrasoMs: number): Promise<void>
  /**
   * Os três envios devolvem o id que a Meta deu à mensagem, para gravar no
   * histórico (`wa_message_id`). `null` quando o canal não tem id que sirva
   * ali: Telegram e Instagram numeram de outro jeito, e misturar os ids deles
   * na coluna da Meta quebraria a unicidade que deduplica o histórico.
   */
  enviarTexto(para: string, texto: string, citando?: Citacao): Promise<string | null>
  enviarOpcoes(
    para: string,
    texto: string,
    opcoes: Opcao[],
    formato: 'botoes' | 'lista',
  ): Promise<string | null>
  enviarMidia(para: string, midia: Midia, citando?: Citacao): Promise<string | null>
  /**
   * O card do produto: foto, nome, preço, estoque e o botão para a loja.
   *
   * Opcional, como `reagir`: o Telegram não tem o formato, e quem chama manda
   * texto com o link quando o método não existe. Só recebe produto **com
   * foto real**, a não ser que o canal diga `cardSemFoto`; sem foto, quem
   * chama manda texto, e o adaptador nunca precisa inventar imagem.
   */
  enviarProdutos?(para: string, produtos: ProdutoDaLoja[]): Promise<string | null>
  /**
   * O card deste canal existe sem imagem. No WhatsApp o `cta_url` tem o
   * cabeçalho opcional, e o card sem foto ainda esconde o link de rastreio
   * atrás do botão; em texto, o link aparece inteiro, e ele é longo.
   */
  cardSemFoto?: boolean
  /**
   * Manda um modelo aprovado, a única coisa que atravessa a janela fechada.
   *
   * Opcional pelo mesmo motivo de `reagir`: é recurso de WhatsApp. O Telegram
   * e o Instagram não têm janela de 24h nem aprovação prévia, então para eles o
   * conceito não existe, e fingir que existe faria o motor de disparo achar
   * que pode transmitir por qualquer canal.
   *
   * **Devolve o resultado em vez de `void`**, ao contrário de todos os outros
   * envios daqui. Ver `EnvioDeTemplate`: para template, o 200 da Meta não
   * significa entrega.
   */
  enviarTemplate?(para: string, template: Template): Promise<EnvioDeTemplate>
  /**
   * Reage a uma mensagem com um emoji. String vazia **remove** a reação.
   *
   * Opcional na interface, e não em todos os canais: só o WhatsApp tem o
   * recurso. Quem chama pergunta se existe antes, o mesmo que já se faz com
   * qualquer coisa que um canal tenha e o outro não.
   *
   * O teto de 30 dias da Meta não é conferido aqui: o adaptador é o último
   * ponto antes da rede, e recusar em silêncio seria pior que a recusa dela,
   * que ao menos vem com motivo. Quem desenha a tela é que precisa esconder o
   * botão, ver `PODE_REAGIR_ATE_DIAS`.
   */
  reagir?(para: string, mensagemId: string, emoji: string): Promise<void>
  /**
   * Marca a última mensagem que chegou como **lida**, o segundo tique azul.
   *
   * Existe separado de `aguardarResposta`, que também marca lida, porque as
   * duas respondem a perguntas diferentes: lá o bot vai responder e o "lido"
   * vem junto do "digitando"; aqui uma pessoa abriu a conversa no painel e pode
   * não responder nada. Amarrar os dois faria abrir a conversa mostrar
   * "digitando" para alguém que ninguém está atendendo.
   *
   * Opcional pelo mesmo motivo de `reagir`: nem todo canal tem o recurso.
   */
  marcarLida?(mensagemId: string): Promise<void>
  /**
   * Baixa o arquivo que a pessoa mandou. `null` quando não deu.
   *
   * São **dois** pedidos à Meta, e não um: o primeiro troca o id por uma URL, o
   * segundo baixa dela, e a URL só vale 5 minutos e exige o token no header.
   * Quem chama não precisa saber disso, e é por isso que os dois moram dentro
   * do adaptador.
   *
   * Devolve `null` em vez de estourar quando o arquivo não vem. Perder uma
   * mídia é ruim; derrubar a conversa por causa dela é pior, e a mensagem em si
   * já está gravada quando isto roda.
   */
  baixarMidia?(
    mediaId: string,
  ): Promise<{ bytes: Uint8Array; mime: string; nomeArquivo?: string } | null>
}
