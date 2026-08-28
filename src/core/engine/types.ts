import { z } from 'zod'
import type {
  AoFalhar,
  Cabecalho,
  Mapeamento,
  Metodo,
  Opcao,
  TipoDeMidia,
} from '../flow/schema'

/**
 * `Sessao` e `Entrada` são schemas Zod, não só tipos: eles atravessam a
 * fronteira da rede (o simulador manda a sessão de volta a cada mensagem, o
 * webhook do WhatsApp manda o que chegou). Tudo que vem de fora é validado
 * antes de encostar no motor.
 *
 * `Acao` é só tipo — ela sempre sai daqui, nunca entra.
 */

export const statusSessaoSchema = z.enum([
  /** conversando normalmente */
  'ativa',
  /** parada num nó de IA, esperando a resposta do modelo */
  'aguardando_ia',
  /** parada num nó de API, esperando a resposta da chamada */
  'aguardando_http',
  /** o humano assumiu — o bot fica calado */
  'humano',
  /** o fluxo chegou ao fim */
  'encerrada',
])

/**
 * Tudo que o motor precisa lembrar de uma conversa. É serializável: cabe numa
 * linha de banco e volta de lá sem perder nada. Não existe estado do motor
 * fora daqui.
 */
export const sessaoSchema = z.object({
  /** Nó onde a conversa parou. `null` = ainda não começou. */
  noAtual: z.string().nullable(),
  /** Variáveis coletadas: `{ nome: "Ana", assunto: "orçamento" }` */
  vars: z.record(z.string(), z.string()),
  /** Quantas vezes seguidas o motor não entendeu. Reseta ao avançar. */
  tentativas: z.number().int().min(0),
  status: statusSessaoSchema,
})

/** O que chegou. O motor não sabe se veio do WhatsApp ou do simulador. */
export const entradaSchema = z.discriminatedUnion('tipo', [
  /** primeira interação: começa o fluxo do zero */
  z.object({ tipo: z.literal('inicio') }),
  z.object({ tipo: z.literal('texto'), texto: z.string() }),
  /** a pessoa clicou num botão ou item de lista */
  z.object({ tipo: z.literal('opcao'), opcaoId: z.string().min(1) }),
  /** áudio, imagem, documento, figurinha... (Regra B) */
  z.object({
    tipo: z.literal('midia'),
    formato: z.string().min(1),
    /**
     * O id do anexo no WhatsApp. **Opcional para sempre**: existe conversa
     * gravada de antes deste campo, e `Entrada` é validada ao voltar do
     * navegador — obrigatório aqui faria essas sessões pararem de dar parse.
     */
    midiaId: z.string().optional(),
    /** A legenda que a pessoa escreveu junto com a foto, quando escreveu. */
    legenda: z.string().optional(),
  }),
  /** o servidor chamou o modelo e trouxe a resposta de volta */
  z.object({ tipo: z.literal('ia_respondeu'), texto: z.string() }),
  /**
   * O servidor chamou a API e trouxe os valores **já extraídos**. Quem entende
   * de JSON é o resolvedor; o motor só sabe manipular pares de nome e texto.
   */
  z.object({
    tipo: z.literal('http_respondeu'),
    valores: z.record(z.string(), z.string()),
  }),
  /**
   * O prazo da pergunta acabou e ninguém respondeu (B1).
   *
   * Não vem de pessoa nenhuma: vem do agendador. É a única entrada que o motor
   * recebe sem alguém do outro lado ter feito nada — e por isso a única que
   * significa **ausência**.
   */
  z.object({ tipo: z.literal('timeout') }),
])

export type StatusSessao = z.infer<typeof statusSessaoSchema>
export type Sessao = z.infer<typeof sessaoSchema>
export type Entrada = z.infer<typeof entradaSchema>

/**
 * O que o mundo lá fora deve fazer. O motor nunca executa nada — ele descreve.
 * Quem executa é o canal (WhatsApp de verdade) ou o simulador (que só mostra).
 */
export type Acao =
  | {
      tipo: 'enviar_texto'
      texto: string
      /** Esperar fora do motor antes do envio. Ausente = entregar na hora. */
      atrasoMs?: number
    }
  | {
      tipo: 'enviar_opcoes'
      texto: string
      opcoes: Opcao[]
      /** decidido pela quantidade: até 3 vira botão, até 10 vira lista */
      formato: 'botoes' | 'lista'
    }
  /**
   * Entregar um arquivo: foto da sala, PDF do plano, vídeo do portfólio.
   *
   * O motor descreve **de onde o arquivo sai** e não sabe como ele chega. Quem
   * entrega decide entre mandar o endereço, fazer upload ou reusar um id que já
   * tem — é o mesmo motivo de `chamar_http` carregar `conexaoId` em vez da
   * credencial: `core/` não faz rede, e essa regra não abre exceção por mídia.
   */
  | {
      tipo: 'enviar_midia'
      midia: TipoDeMidia
      url: string
      /** Já interpolada. Ausente em `audio`, que não aceita legenda. */
      legenda?: string
      /** O nome que a pessoa vê antes de baixar. Só `documento` usa. */
      nomeArquivo?: string
      atrasoMs?: number
    }
  /** persistir no contato — é isso que alimenta a tela de leads */
  | { tipo: 'salvar_campo'; campo: string; valor: string }
  /**
   * Desligar a automação **deste contato** — o "AutoOff".
   *
   * Não é `transferir_humano`: ninguém entra na fila de atendimento e ninguém
   * é avisado. O bot simplesmente para de responder para esta pessoa, e a
   * conversa fica onde está. Serve para o fim de fluxo que já resolveu tudo, e
   * para o "não me responde mais por aqui".
   */
  | { tipo: 'pausar_automacao' }
  /** chamar o modelo e reentrar no motor com `{ tipo: 'ia_respondeu' }` */
  | { tipo: 'chamar_ia'; instrucao: string }
  /**
   * Chamar uma API e reentrar no motor com `{ tipo: 'http_respondeu' }`.
   *
   * `url`, `corpo` e os valores dos cabeçalhos já vêm interpolados com as
   * variáveis da sessão. O que **não** vem resolvido é `{{segredo.x}}` — isso é
   * trabalho do servidor, e de propósito: segredo que entrasse aqui entraria na
   * sessão, e a sessão viaja para o navegador no simulador.
   */
  | {
      tipo: 'chamar_http'
      metodo: Metodo
      url: string
      cabecalhos: Cabecalho[]
      corpo: string
      mapear: Mapeamento[]
      aoFalhar: AoFalhar
      /**
       * Referência à credencial, nunca a credencial. O motor não sabe o que há
       * do outro lado deste id, e é por isso que segredo nenhum consegue
       * entrar na sessão — que viaja para o navegador no simulador.
       */
      conexaoId?: string
    }
  /**
   * Pôr o contato numa etapa de um quadro (C1b).
   *
   * Como toda ação daqui, o motor **descreve** e não executa: ele não sabe que
   * existe tabela `quadro_cartoes`, e é o servidor que cria o cartão se ele
   * ainda não existe ou o move se já existe. Etapa que sumiu depois da
   * publicação é nada-a-fazer do lado de fora — o motor não tem como saber, e
   * uma conversa não pode morrer porque alguém arrumou o quadro.
   */
  | { tipo: 'mover_etapa'; quadroId: string; colunaId: string }
  /**
   * Continuar a conversa em **outra automação** (0036).
   *
   * O motor não carrega fluxo nenhum — ele não fala com banco, e é essa
   * ignorância que faz o simulador e a produção rodarem o mesmo código. Ele
   * descreve o salto; quem carrega a versão publicada do destino e reentra é o
   * resolvedor de efeitos, exatamente como já acontece com a IA e a API.
   *
   * As variáveis vão junto porque a sessão continua sendo a mesma conversa: o
   * nome que a pessoa deu na triagem não pode sumir só porque o desenho
   * mudou de arquivo.
   */
  | { tipo: 'ir_para_fluxo'; fluxoId: string }
  | { tipo: 'transferir_humano'; motivo: string }
  | { tipo: 'encerrar' }

export type Resultado = {
  acoes: Acao[]
  sessao: Sessao
}

export function sessaoNova(): Sessao {
  return { noAtual: null, vars: {}, tentativas: 0, status: 'ativa' }
}
