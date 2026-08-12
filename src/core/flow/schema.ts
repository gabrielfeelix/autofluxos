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

export const noSchema = z.discriminatedUnion('type', [
  noMensagemSchema,
  noPerguntaSchema,
  noCondicaoSchema,
  noSalvarCampoSchema,
  noIaSchema,
  noHandoffSchema,
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
export type Aresta = z.infer<typeof arestaSchema>
export type Fluxo = z.infer<typeof fluxoSchema>
export type TipoNo = No['type']

/** Saídas da condição, usadas como `sourceHandle`. */
export const SAIDA_VERDADEIRO = 'verdadeiro'
export const SAIDA_FALSO = 'falso'
