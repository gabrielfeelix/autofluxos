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

export const noMensagemSchema = z.object({
  ...base,
  type: z.literal('mensagem'),
  data: z.object({
    texto: z.string(),
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

export const noSchema = z.discriminatedUnion('type', [
  noMensagemSchema,
  noPerguntaSchema,
  noCondicaoSchema,
  noSalvarCampoSchema,
  noIaSchema,
  noHandoffSchema,
  noHttpSchema,
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

export type Opcao = z.infer<typeof opcaoSchema>
export type No = z.infer<typeof noSchema>
export type NoPergunta = z.infer<typeof noPerguntaSchema>
export type Cabecalho = z.infer<typeof cabecalhoSchema>
export type Mapeamento = z.infer<typeof mapeamentoSchema>
export type NoHttp = z.infer<typeof noHttpSchema>
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

/** A pergunta tira as opções de uma variável em vez de tê-las desenhadas? */
export function perguntaEhDinamica(no: NoPergunta): boolean {
  return (no.data.opcoesDe ?? '').trim() !== ''
}
