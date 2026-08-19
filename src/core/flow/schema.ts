import { z } from 'zod'

/**
 * O formato do fluxo é o formato nativo do React Flow (`nodes`, `edges`,
 * `type`, `position`, `data`, `sourceHandle`). Isso é decisão de arquitetura,
 * não descuido: o editor salva o objeto dele direto, sem camada de tradução.
 * Por isso essas chaves ficam em inglês enquanto o resto do domínio é
 * português — a fronteira é o React Flow.
 */

/** Limites da Cloud API. Acima disso a Meta recusa a mensagem. */
export const LIMITE_BOTOES = 3
export const LIMITE_LISTA = 10
/** Botão de resposta aceita 20 caracteres; item de lista aceita 24.
 *  Usamos 20 para o rótulo funcionar nos dois formatos. */
export const LIMITE_ROTULO = 20

/**
 * Tamanho do corpo da mensagem, e são **dois** limites porque a Meta trata as
 * duas mensagens como coisas diferentes:
 *
 * - texto puro (`enviar_texto`) aceita 4096
 * - mensagem interativa, a que carrega botões ou lista (`enviar_opcoes`),
 *   aceita **1024** — um quarto disso
 *
 * Qual vale depende de ter opção ou não, que é a mesma decisão do
 * `executar.ts`: pergunta sem opção sai como texto puro.
 *
 * Sem isto, dava para escrever 3.000 caracteres numa pergunta com botões,
 * publicar, e só descobrir com cliente de verdade conversando — a Meta recusa a
 * mensagem inteira e a pessoa não recebe nada.
 */
export const LIMITE_TEXTO = 4096
export const LIMITE_TEXTO_INTERATIVO = 1024

export const opcaoSchema = z.object({
  id: z.string().min(1),
  rotulo: z.string(),
})

const posicaoSchema = z.object({ x: z.number(), y: z.number() })

const base = {
  id: z.string().min(1),
  position: posicaoSchema,
}

/**
 * Nome de variável: `nome`, `valor_estimado`. Sem espaço, sem acento.
 *
 * Note que aqui é só `string`. A regra do formato mora no `validar()`, e a
 * razão é o editor: enquanto alguém digita, o campo passa por estados
 * inválidos ("no", "nom") e por vazio. Se o schema recusasse, o editor
 * quebraria a cada tecla.
 *
 * A divisão que ficou: **Zod garante a estrutura, `validar()` garante o
 * sentido.** Rascunho pode estar pela metade; publicar é que não pode.
 */
const nomeVariavel = z.string()

export const FORMATO_VARIAVEL = /^[a-zA-Z][a-zA-Z0-9_]*$/

/**
 * Espera curta cabe no `after()` do webhook. Acima disso é agendamento, não
 * sono dentro de uma função serverless (EXPANSAO, item 12).
 */
export const LIMITE_ATRASO_SEGUNDOS = 3

/**
 * Os quatro tipos de mídia que a Cloud API envia, e eles não são
 * intercambiáveis — cada um tem regra própria e a Meta recusa a mensagem
 * inteira quando a regra é quebrada:
 *
 * - `imagem` e `video` aceitam legenda;
 * - `documento` aceita legenda **e** nome de arquivo (é o que a pessoa vê
 *   antes de baixar; sem ele o WhatsApp mostra o hash da URL);
 * - `audio` **não aceita legenda nenhuma**. Mandar uma faz a Meta devolver
 *   erro, não ignorar o campo.
 */
export const TIPOS_DE_MIDIA = ['imagem', 'video', 'documento', 'audio'] as const
export type TipoDeMidia = (typeof TIPOS_DE_MIDIA)[number]

/** Legenda de mídia é campo próprio na Cloud API e cabe menos que o texto. */
export const LIMITE_LEGENDA = 1024

/**
 * Quantos pedaços cabem num bloco só.
 *
 * O teto existe para o bloco não virar um fluxo dentro do fluxo: dez pedaços já
 * são dez mensagens seguidas no WhatsApp de alguém, e passar disso é conversa
 * que ninguém lê. Também protege de um laço no editor gerar duzentos.
 */
export const LIMITE_PARTES = 10

/**
 * Um pedaço de mensagem.
 *
 * **O bloco deixou de ser um texto e virou uma pilha**, e essa é a mudança mais
 * profunda da Etapa A (PLANO-SISTEMA §3.10). O que a gente tinha era
 * `data: { texto }`, e a mesma conversa que o produto de referência resolve num
 * bloco exigia cinco dos nossos: um para o texto, outro para a foto, outro para
 * a pausa, outro para gravar o campo.
 *
 * Os tipos não são invenção nossa — são os que a Cloud API sabe entregar, mais
 * os dois que só mexem no nosso lado (`salvar`, `auto-off`).
 */
export const parteTextoSchema = z.object({
  tipo: z.literal('texto'),
  /**
   * Aceita a formatação do WhatsApp: `*negrito*`, `_itálico_`, `~riscado~` e
   * três crases para monoespaçado. É texto puro de propósito — quem renderiza é
   * o WhatsApp, e guardar HTML ou Markdown aqui obrigaria a converter na saída
   * e a adivinhar na volta.
   */
  texto: z.string(),
})

export const parteMidiaSchema = z.object({
  tipo: z.literal('midia'),
  midia: z.enum(TIPOS_DE_MIDIA),
  url: z.string(),
  legenda: z.string().optional(),
  /** Só o `documento` usa. Vazio = quem entrega inventa a partir da URL. */
  nomeArquivo: z.string().optional(),
})

export const parteAtrasoSchema = z.object({
  tipo: z.literal('atraso'),
  segundos: z.number().min(0).max(LIMITE_ATRASO_SEGUNDOS),
})

export const parteSalvarSchema = z.object({
  tipo: z.literal('salvar'),
  campo: nomeVariavel,
  /** Aceita interpolação: "{{nome}} - {{assunto}}" */
  valor: z.string(),
})

/**
 * Pausa o bot **neste contato**.
 *
 * Existe como pedaço, e não como bloco próprio, porque o uso real é sempre
 * junto de uma frase: *"já chamei alguém, não respondo mais por aqui"* e o bot
 * cala. Separado em dois blocos, a ordem entre eles vira detalhe que dá para
 * errar.
 *
 * Não é o mesmo que `handoff`: aqui ninguém entra na fila de atendimento. É o
 * "AutoOff" do produto de referência — a automação para e a conversa fica como
 * está.
 */
export const parteAutoOffSchema = z.object({ tipo: z.literal('auto-off') })

export const parteSchema = z.discriminatedUnion('tipo', [
  parteTextoSchema,
  parteMidiaSchema,
  parteAtrasoSchema,
  parteSalvarSchema,
  parteAutoOffSchema,
])

/**
 * O bloco de mensagem, nos **dois** formatos.
 *
 * `texto` e `atraso` são o formato antigo e continuam aqui para sempre — não
 * por preguiça, mas porque `flow_versions` é imutável e a sessão fica presa à
 * versão em que começou. Uma conversa que começou às 14h continua rodando o
 * grafo de 14h; se este schema deixasse de dar parse no que foi publicado
 * antes, **toda conversa em andamento morreria no meio**.
 *
 * A regra, escrita para não se perder: **ler os dois formatos, escrever só um.**
 * O motor e o validador nunca tocam `data.texto` direto — passam por
 * `partesDaMensagem()`, em `core/flow/mensagem.ts`. O editor só escreve
 * `partes`. E nenhuma migration reescreve `flow_versions.grafo`, inclusive as
 * nossas.
 *
 * Os dois campos serem opcionais é de propósito: um bloco sem nenhum dos dois é
 * estruturalmente válido e **semanticamente** vazio, e quem recusa isso é o
 * `validar()`. É a mesma divisão que já vale para nome de variável — Zod
 * garante a estrutura, `validar()` garante o sentido, e rascunho pode estar
 * pela metade.
 */
export const noMensagemSchema = z.object({
  ...base,
  type: z.literal('mensagem'),
  data: z.object({
    /** Formato antigo. Só leitura — nada escreve aqui desde a A3. */
    texto: z.string().optional(),
    /** Formato antigo: espera antes de mandar. Vira uma parte `atraso`. */
    atraso: z.number().min(0).max(LIMITE_ATRASO_SEGUNDOS).optional(),
    partes: z.array(parteSchema).max(LIMITE_PARTES).optional(),
  }),
})

/**
 * Um arquivo enviado pelo bot.
 *
 * `url` é o endereço de onde o arquivo sai, e o motor **não** o interpreta: ele
 * descreve `enviar_midia` e quem entrega decide se busca, faz upload ou reusa
 * um id. Isso mantém `core/` sem rede, como as outras seis ações.
 *
 * A legenda interpola variável igual ao texto — "Segue a planta do {{plano}}"
 * é o caso comum, não a exceção.
 */
export const noMidiaSchema = z.object({
  ...base,
  type: z.literal('midia'),
  data: z.object({
    midia: z.enum(TIPOS_DE_MIDIA),
    url: z.string(),
    legenda: z.string().optional(),
    /** Só o `documento` usa. Vazio = quem entrega inventa a partir da URL. */
    nomeArquivo: z.string().optional(),
    atraso: z.number().min(0).max(LIMITE_ATRASO_SEGUNDOS).optional(),
  }),
})

export const noPerguntaSchema = z.object({
  ...base,
  type: z.literal('pergunta'),
  data: z.object({
    texto: z.string(),
    /** Onde guardar a resposta. Sem isso a resposta é usada só para ramificar. */
    salvarEm: nomeVariavel.optional(),
    /** Vazio = resposta livre em texto. Preenchido = botões ou lista. */
    opcoes: z.array(opcaoSchema).default([]),
    /**
     * Nome da variável que traz as opções prontas, separadas por `;` ou quebra
     * de linha. Preenchido, as opções deixam de ser desenhadas e passam a
     * nascer da conversa.
     *
     * Existe porque há pergunta que ninguém tem como desenhar de antemão: "os
     * horários livres de quarta" só se sabe depois de perguntar a alguém. O
     * caminho normal é um nó de API mapear a resposta para esta variável.
     *
     * **Some a ramificação por opção.** Não dá para ligar uma aresta a uma
     * opção que não existe na hora do desenho, então a pergunta dinâmica tem
     * duas saídas fixas: `escolheu` e `vazio`. Qual foi a escolha vira
     * `salvarEm`, e quem ramifica sobre ela é um nó de condição depois.
     */
    opcoesDe: nomeVariavel.optional(),
    /**
     * Quantos minutos esperar antes de desistir da resposta (B1).
     *
     * **Opcional, e ausente significa esperar para sempre** — que é o
     * comportamento que o produto sempre teve. Isso não é preferência: existe
     * conversa em produção rodando um grafo publicado antes deste campo
     * existir, e `flow_versions` é imutável. Um campo obrigatório aqui faria
     * todas elas pararem de dar parse e morrerem no meio.
     *
     * O teto de 24h é o mesmo da janela do WhatsApp: passado disso não há como
     * mandar nada em texto livre, e um timeout que dispara para não conseguir
     * falar é um timeout que só gera handoff.
     */
    timeoutMinutos: z.number().int().min(1).max(1_440).optional(),
  }),
})

export const OPERADORES = ['igual', 'diferente', 'contem', 'vazio', 'preenchido'] as const
export type Operador = (typeof OPERADORES)[number]

export const noCondicaoSchema = z.object({
  ...base,
  type: z.literal('condicao'),
  data: z.object({
    variavel: nomeVariavel,
    operador: z.enum(OPERADORES),
    valor: z.string().default(''),
  }),
})

export const noSalvarCampoSchema = z.object({
  ...base,
  type: z.literal('salvar-campo'),
  data: z.object({
    campo: nomeVariavel,
    /** Aceita interpolação: "{{nome}} - {{assunto}}" */
    valor: z.string(),
  }),
})

export const noIaSchema = z.object({
  ...base,
  type: z.literal('ia'),
  data: z.object({
    instrucao: z.string(),
    salvarEm: nomeVariavel.optional(),
  }),
})

export const noHandoffSchema = z.object({
  ...base,
  type: z.literal('handoff'),
  data: z.object({
    motivo: z.string().default('solicitado pelo fluxo'),
    mensagem: z.string().default('Vou te passar para um atendente. Só um instante!'),
  }),
})

/** Verbos que o nó de API aceita. `GET` consulta, `POST` grava. */
export const METODOS = ['GET', 'POST'] as const
export type Metodo = (typeof METODOS)[number]

/**
 * O que fazer quando a chamada falha.
 *
 * O padrão é `humano` por decisão de produto (§9): quem garante a saída é o
 * sistema. `seguir` existe para enriquecimento opcional — o CEP não respondeu e
 * a conversa não deveria morrer por isso.
 */
export const AO_FALHAR = ['humano', 'seguir'] as const
export type AoFalhar = (typeof AO_FALHAR)[number]

export const cabecalhoSchema = z.object({
  chave: z.string(),
  valor: z.string(),
})

export const mapeamentoSchema = z.object({
  /** A variável que recebe o valor extraído. */
  variavel: nomeVariavel,
  /**
   * Caminho no JSON da resposta, com ponto e índice: `pedido.status`,
   * `resultados.0.nome`. Não é JSONPath: quase todo caso é campo raso, e o que
   * não for o cliente achata do lado dele. JSONPath seria uma linguagem
   * inteira para manter, testar e explicar.
   */
  caminho: z.string(),
})

export const noHttpSchema = z.object({
  ...base,
  type: z.literal('http'),
  data: z.object({
    metodo: z.enum(METODOS).default('GET'),
    /** Aceita `{{variavel}}` e, no futuro, `{{segredo.nome}}`. */
    url: z.string().default(''),
    cabecalhos: z.array(cabecalhoSchema).default([]),
    /** JSON escrito como texto. Aceita interpolação. */
    corpo: z.string().default(''),
    mapear: z.array(mapeamentoSchema).default([]),
    aoFalhar: z.enum(AO_FALHAR).default('humano'),
    /**
     * Qual credencial do cliente usar. É só o **id** — o valor nunca entra no
     * fluxo, e portanto nunca entra na versão publicada, que é imutável por
     * gatilho. Quem resolve é o servidor, depois do motor.
     *
     * `undefined` = chamada sem autenticação, que é o caso de webhook e de
     * Apps Script (onde a chave já vem embutida na URL que o Google gera).
     */
    conexaoId: z.string().optional(),
  }),
})

/**
 * Move o contato para uma etapa de um quadro (C1b, 0032).
 *
 * **É o bloco que faz o quadro valer.** Sem ele, a posição de cada pessoa no
 * funil só muda por gesto humano — e quadro que depende de digitação manual é
 * quadro que ninguém mantém, o que é pior que quadro nenhum: ele mente com cara
 * de dado.
 *
 * Guarda **referência**, e não cópia, e essa é a exceção consciente à regra do
 * preset e do modelo (§6.3 do HANDOFF). Etapa não é configuração congelável: é
 * estado vivo, e um cartão precisa cair na etapa que existe **hoje**. O preço
 * dessa escolha é a etapa poder sumir depois de publicada, e ele é pago em dois
 * lugares: o `validar()` recusa publicar apontando para etapa que não existe, e
 * o servidor trata etapa sumida como nada-a-fazer em vez de estourar — a mesma
 * regra do papel de número que aponta para fluxo sem versão publicada.
 *
 * Os dois campos são texto livre no schema porque o editor passa por estados
 * vazios enquanto alguém escolhe. Quem cobra o preenchimento é o `validar()`,
 * como em toda a casa: Zod garante a estrutura, `validar()` garante o sentido.
 */
export const noEtapaSchema = z.object({
  ...base,
  type: z.literal('etapa'),
  data: z.object({
    quadroId: z.string().default(''),
    colunaId: z.string().default(''),
  }),
})

export const noSchema = z.discriminatedUnion('type', [
  noMensagemSchema,
  noMidiaSchema,
  noPerguntaSchema,
  noCondicaoSchema,
  noSalvarCampoSchema,
  noIaSchema,
  noHandoffSchema,
  noHttpSchema,
  noEtapaSchema,
])

export const arestaSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  /**
   * A saída de onde a aresta parte. É aqui que mora a ramificação:
   * - `pergunta` → o id da opção
   * - `condicao` → "verdadeiro" ou "falso"
   * - demais nós → ausente (saída única)
   */
  sourceHandle: z.string().nullish(),
})

export const fluxoSchema = z.object({
  /** Id do nó onde a conversa começa. */
  inicio: z.string().min(1),
  nodes: z.array(noSchema).min(1),
  edges: z.array(arestaSchema),
})

export type Parte = z.infer<typeof parteSchema>
export type ParteTexto = z.infer<typeof parteTextoSchema>
export type ParteMidia = z.infer<typeof parteMidiaSchema>
export type TipoDeParte = Parte['tipo']
export type NoMensagem = z.infer<typeof noMensagemSchema>
export type Opcao = z.infer<typeof opcaoSchema>
export type No = z.infer<typeof noSchema>
export type NoPergunta = z.infer<typeof noPerguntaSchema>
export type NoMidia = z.infer<typeof noMidiaSchema>
export type Cabecalho = z.infer<typeof cabecalhoSchema>
export type Mapeamento = z.infer<typeof mapeamentoSchema>
export type NoHttp = z.infer<typeof noHttpSchema>
export type NoEtapa = z.infer<typeof noEtapaSchema>
export type Aresta = z.infer<typeof arestaSchema>
export type Fluxo = z.infer<typeof fluxoSchema>
export type TipoNo = No['type']

/** Saídas da condição, usadas como `sourceHandle`. */
export const SAIDA_VERDADEIRO = 'verdadeiro'
export const SAIDA_FALSO = 'falso'

/**
 * Saídas da pergunta com opções dinâmicas.
 *
 * `vazio` não é detalhe: lista que vem de fora vem vazia com frequência — não
 * há horário livre, a API não respondeu nada. Sem essa saída, a conversa
 * pararia numa pergunta sem resposta possível. Por isso o validador cobra as
 * duas.
 */
export const SAIDA_ESCOLHEU = 'escolheu'
export const SAIDA_VAZIO = 'vazio'

/**
 * A saída de quando ninguém respondeu dentro do prazo (B1).
 *
 * Sem aresta ligada nela, o timeout **passa a conversa para uma pessoa** em vez
 * de encerrar calado: quem parou de responder no meio de uma triagem é o lead
 * que mais vale a pena resgatar, e sumir com ele seria o pior desfecho
 * possível. Encerrar só acontece quando o cliente desenhou a saída para isso.
 */
export const SAIDA_TIMEOUT = 'timeout'

/** O prazo desta pergunta em minutos, ou `null` quando ela espera para sempre. */
export function timeoutDaPergunta(no: NoPergunta): number | null {
  return no.data.timeoutMinutos ?? null
}

/** A pergunta tira as opções de uma variável em vez de tê-las desenhadas? */
export function perguntaEhDinamica(no: NoPergunta): boolean {
  return (no.data.opcoesDe ?? '').trim() !== ''
}
