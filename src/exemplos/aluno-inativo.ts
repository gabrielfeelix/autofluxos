import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { acharPreset } from '@/core/presets'

/**
 * Quem parou de vir, e voltou a escrever.
 *
 * Pedido de quem opera: *"to criando um fluxo pra caso o aluno seja INATIVO,
 * esteja de licença. As opções de boas vindas são diferentes, ele pergunta se
 * quer voltar às aulas, se quer marcar alguma aula, ou se quer conversar com um
 * atendente sobre o contrato"*.
 *
 * **Por que um fluxo próprio, e não um ramo do de atendimento.** A conversa de
 * quem está ativo começa em "o que você quer fazer hoje?"; a de quem sumiu
 * começa em outro lugar, porque a pergunta que interessa é *por que você
 * parou*. Oferecer "remarcar aula" a quem está de licença há três meses é o
 * mesmo erro que perguntar "você é aluno?" a quem o sistema já reconheceu: o
 * bot tem a informação e não a usa.
 *
 * **Todas as saídas levam a uma pessoa, e isso é o desenho, não uma falha
 * dele.** *"De qualquer forma, cada uma delas leva pro atendente, mas já
 * resolve a maior dúvida do pq entrou em contato."* Reativar contrato, cancelar
 * e negociar são conversas com dinheiro e com vínculo no meio; o que o bot faz
 * aqui é chegar na recepção com o motivo já escrito, em vez de um "oi" que
 * alguém vai ter que destrinchar.
 *
 * **Cancelar não é tratado como perda a evitar.** O menu diz que cancelar é
 * possível, em vez de esconder a opção atrás de duas perguntas de retenção. Bot
 * que dificulta a saída não segura ninguém: só transfere a irritação para quem
 * atende, e o cancelamento acontece do mesmo jeito, pior.
 *
 * O que ele **não** faz: decidir se a pessoa está inativa. Isso é `situacao` na
 * ficha da Verandi, e é a conta do cliente que define o que cada situação quer
 * dizer. Aqui só se lê.
 */

/** O bloco de API já preenchido por um preset, para o modelo não repetir a URL. */
function comPreset(id: string, no: { id: string; position: { x: number; y: number } }) {
  const preset = acharPreset(id)
  if (!preset) throw new Error(`preset ${id} sumiu, o modelo de aluno inativo depende dele`)
  return { ...no, type: 'http', data: { ...preset.dados } }
}

const em = (x: number, y: number) => ({ x: x * 320, y: y * 190 })

export const alunoInativo: Fluxo = fluxoSchema.parse({
  inicio: 'reconhecer',
  nodes: [
    // Quem é, e o que a agenda sabe dela. Antes de qualquer palavra, como nos
    // outros fluxos de agenda: saudação antes do dado sai com o nome vazio.
    comPreset('verandi-quem-e', { id: 'reconhecer', position: em(0, 0) }),
    {
      id: 'ja-e-aluno',
      type: 'condicao',
      position: em(1, 0),
      data: { variavel: 'encontrado', operador: 'igual', valor: '1' },
    },
    comPreset('verandi-minha-agenda', { id: 'ficha', position: em(2, 0) }),

    /*
     * Ativa ou não: é o que decide qual conversa esta pessoa merece.
     *
     * A comparação é contra `ativa` e não contra uma lista de situações
     * inativas ("licenca", "trancado", "cancelado", "inadimplente"...): a conta
     * do cliente inventa situação nova sem avisar ninguém, e um fluxo que lista
     * as inativas trataria a situação nova como ativa , exatamente o caso em
     * que errar é pior. Assim, o que não é ativo cai aqui, que é o ramo
     * cuidadoso.
     */
    {
      id: 'esta-ativa',
      type: 'condicao',
      position: em(3, 0),
      data: { variavel: 'situacao_na_agenda', operador: 'igual', valor: 'ativa' },
    },

    /*
     * Quem está ativo não é assunto deste fluxo.
     *
     * Em vez de um "não é com você" que deixa a pessoa sem resposta, o bloco
     * de ir-para-fluxo manda para o atendimento normal. Quem instala este
     * modelo troca o destino pelo fluxo principal da conta dele.
     */
    {
      id: 'segue-normal',
      type: 'handoff',
      position: em(4, -1.4),
      data: {
        motivo: 'aluno ativo escreveu no fluxo de inativos, {{nome_na_agenda}}',
        mensagem: 'Oi, {{nome_na_agenda}}! 👋 Só um instante que já te atendo. 🙌',
      },
    },

    /*
     * As boas-vindas de quem sumiu.
     *
     * Nomeia a ausência em vez de fingir que não houve: *"que bom te ver por
     * aqui de novo"* reconhece o intervalo sem cobrar explicação, e é o que
     * abre espaço para a pessoa dizer o que quer sem precisar se justificar.
     *
     * A situação não entra na frase de propósito. A ficha diz "trancado" ou
     * "inadimplente", e devolver isso na saudação é constranger alguém com o
     * rótulo interno do sistema logo no "oi".
     */
    {
      id: 'ola-inativo',
      type: 'pergunta',
      position: em(4, 0.6),
      data: {
        texto:
          'Oi, {{nome_na_agenda}}! 👋 Que bom te ver por aqui de novo.\nComo posso te ajudar hoje?',
        salvarEm: 'intencao',
        opcoes: [
          { id: 'voltar', rotulo: '💪 Voltar às aulas' },
          { id: 'contrato', rotulo: '📄 Falar do contrato' },
          { id: 'cancelar', rotulo: '🚪 Cancelar contrato' },
          { id: 'outro', rotulo: '💬 Outro assunto' },
        ],
        timeoutMinutos: 240,
      },
    },

    /*
     * Voltar às aulas: a única que o bot quase resolve.
     *
     * Quase, e não inteiro: reativar contrato mexe em plano, valor e vigência,
     * e nada disso está nesta conversa. O que ele faz é chegar na recepção com
     * a intenção escrita, que é a diferença entre "quero voltar" e um "oi" às
     * 22h que alguém vai ter que destrinchar de manhã.
     */
    {
      id: 'quer-voltar',
      type: 'handoff',
      position: em(5.4, -0.6),
      data: {
        motivo: 'quer voltar às aulas, {{nome_na_agenda}} ({{situacao_na_agenda}})',
        mensagem:
          'Que boa notícia! 🎉\nVou chamar alguém da recepção para acertar seu retorno e ver os horários com você. Só um instante! 🙌',
      },
    },

    {
      id: 'quer-contrato',
      type: 'handoff',
      position: em(5.4, 0.4),
      data: {
        motivo: 'dúvida de contrato, {{nome_na_agenda}} ({{situacao_na_agenda}})',
        mensagem:
          'Claro! Vou chamar alguém da recepção para ver seu contrato com você. Só um instante! 🙌',
      },
    },

    /*
     * Cancelar: o bot não desfaz vínculo, e diz isso sem enrolar.
     *
     * Duas coisas de propósito. A primeira é não perguntar "tem certeza?": o
     * bot não vai cancelar de qualquer jeito, então a pergunta não protege
     * ninguém de nada, só atrasa quem já decidiu.
     *
     * A segunda é **não prometer que é presencial**. Quem opera levantou a
     * hipótese (*"tem que cancelar presencialmente lá na MGM"*) e ela não foi
     * fechada, e uma frase dessas no fluxo viraria regra sem ninguém ter
     * decidido, dita a um cliente que vai se organizar em torno dela. A
     * recepção diz como é.
     */
    {
      id: 'quer-cancelar',
      type: 'handoff',
      position: em(5.4, 1.4),
      data: {
        motivo: 'quer cancelar o contrato, {{nome_na_agenda}} ({{situacao_na_agenda}})',
        mensagem:
          'Entendi. Cancelamento é sempre com uma pessoa da equipe, então vou chamar alguém da recepção para te explicar como fica e cuidar disso com você. Só um instante. 🙌',
      },
    },

    {
      id: 'outro-assunto',
      type: 'handoff',
      position: em(5.4, 2.4),
      data: {
        motivo: 'assunto não listado, {{nome_na_agenda}} ({{situacao_na_agenda}})',
        mensagem: 'Certo! Vou chamar alguém da recepção para te ouvir. Só um instante. 🙌',
      },
    },

    /*
     * Ninguém respondeu o menu.
     *
     * Quatro horas de prazo e silêncio: aqui o silêncio **não** é tratado como
     * desinteresse. Quem sumiu das aulas e escreveu de novo já deu o passo mais
     * difícil, e deixar a conversa morrer devolveria a pessoa ao estado em que
     * ela estava. A recepção fica sabendo, e decide se retoma.
     *
     * A mensagem não pode ser vazia, e o validador recusa com razão: passar
     * alguém para um humano sem dizer nada é pior justamente aqui, onde a
     * conversa ficou quatro horas parada e a pessoa já não espera resposta. O
     * texto deixa a porta aberta sem cobrar o silêncio.
     */
    {
      id: 'sem-resposta',
      type: 'handoff',
      position: em(5.4, 3.4),
      data: {
        motivo: 'voltou a escrever e não respondeu o menu, {{nome_na_agenda}}',
        mensagem:
          'Vou deixar seu contato com a recepção para te chamarem, tudo bem? Se preferir, é só me escrever de novo quando quiser. 🙌',
      },
    },

    // Quem a agenda não conhece: não é aluno inativo, é alguém novo.
    {
      id: 'nao-e-aluno',
      type: 'handoff',
      position: em(2, 1.8),
      data: {
        motivo: 'telefone não encontrado na agenda',
        mensagem:
          'Oi! 👋 Não te encontrei aqui na agenda pelo seu número. Vou chamar a recepção para te ajudar. 🙌',
      },
    },
  ],

  edges: [
    { id: 'i1', source: 'reconhecer', target: 'ja-e-aluno' },
    { id: 'i2', source: 'ja-e-aluno', sourceHandle: 'verdadeiro', target: 'ficha' },
    { id: 'i3', source: 'ja-e-aluno', sourceHandle: 'falso', target: 'nao-e-aluno' },
    { id: 'i4', source: 'ficha', target: 'esta-ativa' },
    { id: 'i5', source: 'esta-ativa', sourceHandle: 'verdadeiro', target: 'segue-normal' },
    // Tudo que não é `ativa` cai aqui: ver o comentário de `esta-ativa`.
    { id: 'i6', source: 'esta-ativa', sourceHandle: 'falso', target: 'ola-inativo' },
    { id: 'i7', source: 'ola-inativo', sourceHandle: 'voltar', target: 'quer-voltar' },
    { id: 'i8', source: 'ola-inativo', sourceHandle: 'contrato', target: 'quer-contrato' },
    { id: 'i9', source: 'ola-inativo', sourceHandle: 'cancelar', target: 'quer-cancelar' },
    { id: 'i10', source: 'ola-inativo', sourceHandle: 'outro', target: 'outro-assunto' },
    { id: 'i11', source: 'ola-inativo', sourceHandle: 'timeout', target: 'sem-resposta' },
  ],
})
