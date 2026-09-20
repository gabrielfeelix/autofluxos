import { partesDaMensagem } from './flow/mensagem'
import type { Fluxo, No } from './flow/schema'
import type { Problema, ResultadoValidacao } from './flow/validar'

/**
 * A última conferência antes de o bot ir ao ar (RB-45, T7.2).
 *
 * ---------------------------------------------------------------------------
 * O que `validar()` já faz, e o que faltava
 * ---------------------------------------------------------------------------
 *
 * `core/flow/validar.ts` cobre a maior parte da RB-45 e continua sendo o dono
 * disso: destino obrigatório, campo referenciado, credencial exigida, mensagem
 * essencial, saída válida, loop e caminho sem conclusão. Este arquivo **não
 * repete nada daquilo**, e é importante que não repita: duas validações com a
 * mesma regra divergem no primeiro ajuste, e aí uma recusa o que a outra aceita.
 *
 * Faltava a última frase da RB-45, e ela é a que tem dono nenhum hoje:
 *
 * > "Links de exemplo, IDs fictícios e critérios de demonstração precisam ser
 * > substituídos ou explicitamente removidos antes da publicação."
 *
 * ---------------------------------------------------------------------------
 * O defeito medido, e ele está no repositório
 * ---------------------------------------------------------------------------
 *
 * Os modelos de `src/exemplos/` vêm com marcador de demonstração escrito no
 * texto que o cliente recebe. Medidos, nove:
 *
 *   menu-atendimento    "Rua Exemplo, 123 — bairro, cidade."
 *                       "_Troque este texto pelo horário real._"
 *                       "_Troque este texto pelo endereço real._"
 *                       "*Valores*\nA partir de R$ 000..." + "_Troque..._"
 *   pesquisa-nps        "*cole aqui o link da sua página*"
 *   cobranca-amigavel   "*cole aqui o link ou o Pix*"
 *   qualificar-sdr      "*cole aqui o link*"
 *   carrinho-abandonado "_Troque o código pelo seu._" e "_Troque este texto
 *                       pela sua regra de frete._"
 *
 * RB-43 diz que usar modelo **copia** o desenho para um rascunho editável. Está
 * certo, e é justamente o que cria o problema: a cópia nasce com esses textos, e
 * publicar sem trocá-los manda "Rua Exemplo, 123" e "a partir de R$ 000" para o
 * cliente de verdade de alguém. Ninguém revisa nove mensagens antes de clicar em
 * Publicar, e o produto não deveria depender disso.
 *
 * **É erro e não aviso**, e essa é a decisão do arquivo. Aviso se aprende a
 * pular, e o custo aqui não é estético: é o negócio de alguém mandando o
 * endereço de mentira para um cliente que perguntou onde fica a loja. Trocar o
 * texto é trabalho de trinta segundos; desfazer a impressão que "R$ 000" causa,
 * não.
 *
 * ---------------------------------------------------------------------------
 * Por que arquivo à parte, e não mais um caso dentro de `validar()`
 * ---------------------------------------------------------------------------
 *
 * Porque a pergunta é outra. `validar()` responde "este desenho funciona?", e é
 * chamado **enquanto alguém digita**: ele precisa aceitar rascunho incompleto
 * (a própria RB-45 diz isso). Este responde "este desenho está pronto para
 * receber gente de verdade?", e só é chamado no clique de publicar. Misturar os
 * dois faria o editor gritar "troque o texto de exemplo" no segundo em que a
 * pessoa escolhe o modelo, antes de ela ter tido chance de editar nada.
 *
 * Puro, sem banco e sem React.
 */

// ---------------------------------------------------------------------------
// 1. Os marcadores de demonstração
// ---------------------------------------------------------------------------

/**
 * O que denuncia texto de exemplo não trocado.
 *
 * A lista é de **padrões que só existem para serem substituídos**, e cada um
 * está aqui porque aparece num modelo de `src/exemplos/`. Não entram palavras
 * que um texto legítimo poderia usar: "exemplo" sozinho não está na lista, e
 * "por exemplo, das 9h às 18h" é frase boa que ninguém precisa trocar.
 *
 * `motivo` é o que a tela mostra. Ele diz **o que fazer**, e não o que está
 * errado: "troque pelo endereço da sua loja" move alguém, "placeholder
 * detectado" não.
 */
export const MARCADORES: { padrao: RegExp; motivo: string }[] = [
  {
    // "cole aqui o link", "cole aqui o link ou o Pix", "cole aqui o link da sua página"
    padrao: /cole aqui/i,
    motivo: 'troque pelo endereço de verdade, ou apague a frase',
  },
  {
    /*
     * "_Troque este texto pelo horário real._", "Troque o código pelo seu."
     *
     * **`\b` não serve aqui, e é a borda que custou uma volta.** O itálico do
     * WhatsApp é `_assim_`, e o sublinhado é caractere de palavra em JavaScript:
     * `\btroque` não casa em `_Troque`, que é exatamente como o texto aparece
     * nos modelos. `(^|[^a-zà-ú])` no lugar aceita começo de linha, espaço e o
     * `_` do itálico, e continua recusando "estoque" e "retroque".
     */
    padrao: /(^|[^0-9a-zà-úâêîôûãõç])troque (este|esse|o|a|pelo|pela)\b/i,
    motivo: 'a instrução do modelo ficou no texto que o cliente vai receber',
  },
  {
    // "Rua Exemplo, 123"
    padrao: /\bexemplo\s*,\s*\d/i,
    motivo: 'troque pelo endereço da sua empresa',
  },
  {
    /*
     * "R$ 000", "a partir de R$ 000, e aceitamos Pix".
     *
     * **Não casa com valor de verdade**, e a borda é o que importa: o padrão
     * exige que o número inteiro seja só zeros. `R$ 100`, `R$ 1.000,00` e
     * `R$ 0,90` passam; `R$ 000` e `R$ 00` não.
     *
     * A primeira versão usava `(?![1-9.,\d])` e **não pegava o texto do modelo**,
     * porque lá o valor é seguido de vírgula de frase ("R$ 000, e aceitamos
     * Pix"): a vírgula de pontuação é indistinguível da decimal por lookahead de
     * um caractere. `[.,]\d` resolve: só vírgula **seguida de dígito** é
     * decimal.
     */
    padrao: /R\$\s*0+(?![1-9])(?![.,]\d)/,
    motivo: 'troque por um valor de verdade, ou apague a linha',
  },
  {
    // Os `SEU_ALGO`/`COLOQUE_AQUI` que um modelo futuro pode trazer em URL ou
    // corpo de API. Não aparece nos modelos de hoje, e entra porque o custo de
    // prever é uma linha e o custo de descobrir é um cliente.
    padrao: /\b(SEU_|SUA_|COLOQUE_|TROQUE_|INSIRA_)[A-Z_]{2,}/,
    motivo: 'substitua o marcador pelo valor de verdade',
  },
  {
    // `exemplo.com`, `example.com`, `seusite.com.br`: endereço que não é de
    // ninguém, num bloco que vai chamar de verdade.
    padrao: /\b(exemplo|example|seusite|seu-site)\.(com|com\.br|org|net)\b/i,
    motivo: 'troque pelo endereço de verdade do seu sistema',
  },
]

/** O primeiro marcador que casa com este texto, ou `null`. */
export function marcadorEm(texto: string): { padrao: RegExp; motivo: string } | null {
  for (const marcador of MARCADORES) {
    if (marcador.padrao.test(texto)) return marcador
  }
  return null
}

// ---------------------------------------------------------------------------
// 2. O que mais o publicar precisa saber
// ---------------------------------------------------------------------------

/**
 * O que o servidor sabe e o desenho não.
 *
 * `undefined` em cada campo quer dizer "não perguntei", e aí não se cobra: é a
 * mesma convenção de `Capacidades` em `validar()`, e ela existe para o editor
 * poder chamar isto enquanto alguém digita, sem ter ido ao banco.
 */
export type ContextoDaPublicacao = {
  /**
   * Este fluxo está ligado a alguma entrada?
   *
   * `false` vira **aviso e não erro**, e a assimetria é deliberada. A RB-45
   * manda "avisar sobre bot publicado sem entrada", e o fluxo 7 do §12.1 é
   * explícito: "se ainda não houver entrada ligada ao chatbot, oferecer
   * Configurar entrada. Publicar não liga o bot silenciosamente a todos os
   * canais". Publicar sem entrada é caso de uso legítimo: é o que alguém faz
   * para depois apontar um número, ou para usar o fluxo como destino de um
   * salto. Bloquear seria recusar trabalho correto.
   */
  temEntrada?: boolean
}

// ---------------------------------------------------------------------------
// 3. A conferência
// ---------------------------------------------------------------------------

/**
 * Este desenho pode receber gente de verdade?
 *
 * **Não substitui `validar()`: complementa.** Quem publica chama os dois, e
 * `validar()` primeiro, porque o desenho quebrado é a notícia mais urgente.
 */
export function validarPublicacao(
  fluxo: Fluxo,
  contexto: ContextoDaPublicacao = {},
): ResultadoValidacao {
  const erros: Problema[] = []
  const avisos: Problema[] = []

  for (const no of fluxo.nodes) {
    for (const texto of textosDoNo(no)) {
      const marcador = marcadorEm(texto)
      if (!marcador) continue

      erros.push({
        codigo: 'TEXTO_DE_EXEMPLO',
        mensagem: `Este bloco ainda tem texto de exemplo do modelo: ${marcador.motivo}.`,
        noId: no.id,
      })
      // Um erro por bloco. Três marcadores no mesmo texto são um trabalho só, e
      // três linhas iguais na lista fazem a pessoa parar de ler a lista.
      break
    }
  }

  if (contexto.temEntrada === false) {
    avisos.push({
      codigo: 'SEM_ENTRADA',
      mensagem:
        'Este chatbot não está ligado a nenhuma entrada, então publicar não o põe para atender ninguém. Ligue um número, uma palavra-chave ou um evento quando quiser que ele comece.',
    })
  }

  return { ok: erros.length === 0, erros, avisos }
}

/**
 * Todo texto deste bloco que chega ao cliente.
 *
 * ---------------------------------------------------------------------------
 * O que entra, e o que fica de fora de propósito
 * ---------------------------------------------------------------------------
 *
 * Entra o que a pessoa **lê ou clica**: mensagem, legenda de mídia, pergunta,
 * rótulo e valor de opção, mensagens do handoff, e a URL de mídia e de API (um
 * `exemplo.com` ali é chamada que vai falhar, ou pior, chamada que vai a um
 * lugar que não é nosso).
 *
 * Fica de fora a **instrução da IA**: ela é o que alguém escreve *para o modelo*,
 * não para o cliente, e "troque este texto por..." dentro de um prompt é
 * instrução válida. Cobrar ali produziria recusa em desenho correto, que é o
 * jeito mais rápido de ensinar alguém a ignorar esta validação inteira.
 *
 * Fica de fora o **nome do bloco**: é anotação de quem desenha, e o cliente
 * nunca o vê.
 */
function textosDoNo(no: No): string[] {
  const textos: string[] = []
  const push = (valor: unknown) => {
    if (typeof valor === 'string' && valor.trim() !== '') textos.push(valor)
  }

  const dados = no.data as Record<string, unknown> | undefined
  if (!dados) return textos

  /*
   * A mensagem, pelos **dois** formatos.
   *
   * `partesDaMensagem` é a única leitora de `data.texto`/`data.partes` no
   * produto, e é ela que garante que o formato antigo (uma conversa que começou
   * antes da pilha de pedaços existir) continue sendo lido igual. Ler
   * `dados.texto` direto aqui daria falso negativo em todo bloco já migrado para
   * `partes`, que é onde o texto de verdade mora hoje.
   */
  if (no.type === 'mensagem') {
    for (const parte of partesDaMensagem(no)) {
      if (parte.tipo === 'texto') push(parte.texto)
      if (parte.tipo === 'midia') {
        push(parte.url)
        push(parte.legenda)
        push(parte.nomeArquivo)
      }
    }
  }

  push(dados.texto)
  push(dados.legenda)
  push(dados.pergunta)
  push(dados.url)
  push(dados.corpo)
  push(dados.nomeArquivo)

  if (Array.isArray(dados.mensagens)) {
    for (const mensagem of dados.mensagens) push(mensagem)
  }

  if (Array.isArray(dados.opcoes)) {
    for (const opcao of dados.opcoes as { rotulo?: unknown; valor?: unknown }[]) {
      push(opcao?.rotulo)
      push(opcao?.valor)
    }
  }

  if (Array.isArray(dados.cabecalhos)) {
    for (const cabecalho of dados.cabecalhos as { valor?: unknown }[]) push(cabecalho?.valor)
  }

  return textos
}
