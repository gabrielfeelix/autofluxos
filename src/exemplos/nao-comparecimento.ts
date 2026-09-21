import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { acharPreset } from '@/core/presets'

/**
 * Avisar que não vai à aula — o fluxo que quem opera descreveu em áudio.
 *
 * A descrição veio inteira e em ordem: *"o fluxo de não comparecimento começa
 * para você identificar com quem essa pessoa está falando, quem é o lead, o
 * aluno. Assim que ele identifica, ele pede para confirmar o não
 * comparecimento. Aí ele identifica a aula que essa pessoa vai querer cancelar.
 * Aí ele vai identificar que horas, quando que essa aula vai acontecer para
 * poder avisar — se a pessoa avisa antes de duas horas, beleza; se ela avisar
 * de última hora, ela não pode ter uma reposição. Caso esteja fora do horário,
 * avisar e falar: por você estar fora do horário, você não vai conseguir ter
 * uma reposição dessa aula. Você gostaria de cancelar mesmo? Sim ou não."*
 *
 * ---------------------------------------------------------------------------
 * Por que é um modelo próprio, e não o "Lembrete de aula" com mais um ramo
 * ---------------------------------------------------------------------------
 *
 * Os dois terminam desmarcando na agenda, e é aí que a semelhança acaba. **O
 * que muda é quem fala primeiro.** No lembrete é o bot que começa ("passando
 * para lembrar da sua aula"), então ele já sabe de qual aula está falando antes
 * da primeira palavra. Aqui quem começa é a aluna, dizendo que não vai poder
 * ir, e descobrir qual aula é parte do trabalho.
 *
 * Enfiar os dois no mesmo grafo criaria um fluxo com dois inícios, e o editor
 * não modela isso: um fluxo tem um `inicio`. O que liga os dois é o bloco
 * "ir para outro fluxo", a partir da triagem.
 *
 * ---------------------------------------------------------------------------
 * As quatro decisões que este desenho carrega
 * ---------------------------------------------------------------------------
 *
 * 1. **O prazo não está escrito aqui.** Em lugar nenhum deste arquivo aparece
 *    "2h". Quem decide é a conta na Verandi (`minutos_minimos_cancelamento`, na
 *    tela de Padrões), e o fluxo pergunta a ela. O MGM usa 2h e o próximo
 *    estúdio vai usar 30 minutos; um número cravado no grafo viraria mentira no
 *    dia da primeira mudança, e mentira publicada, porque versão de fluxo é
 *    imutável e continuaria dizendo 2h para sempre.
 *
 * 2. **A frase do aviso também vem de lá.** `{{aviso_do_prazo}}` chega pronta
 *    da agenda, citando o prazo certo daquela conta. Montar o texto aqui daria
 *    o mesmo problema do item acima, com o agravante de cada fluxo do cliente
 *    inventar uma redação diferente para a mesma regra.
 *
 * 3. **Cancelar acontece dos dois lados da pergunta.** Quem avisa em cima da
 *    hora e confirma **cancela do mesmo jeito** — a vaga abre para quem estiver
 *    na fila, e é isso que se quer. O que ela perde é a reposição, não o
 *    direito de avisar. Recusar o cancelamento faria a pessoa simplesmente não
 *    aparecer, e aí a vaga se perde para as duas.
 *
 * 4. **Silêncio não desmarca.** Se a conversa morre no meio, a aula fica de pé
 *    e quem confere é o balcão. É a mesma decisão do lembrete, pelo mesmo
 *    motivo: liberar a vaga de quem ia aparecer é pior do que a vaga ociosa de
 *    quem faltou.
 */

/** O bloco de API já preenchido por um preset, para o modelo não repetir a URL. */
function comPreset(id: string, no: { id: string; position: { x: number; y: number } }) {
  const preset = acharPreset(id)
  if (!preset) throw new Error(`preset ${id} sumiu — o modelo de não comparecimento depende dele`)
  return { ...no, type: 'http', data: { ...preset.dados } }
}

const em = (x: number, y: number) => ({ x: x * 320, y: y * 190 })

export const naoComparecimento: Fluxo = fluxoSchema.parse({
  inicio: 'reconhecer',
  nodes: [
    // 1 — quem está falando. Sem isto o bot pergunta o nome de quem faz aula
    // há dois anos, que foi a reclamação que originou o preset.
    comPreset('verandi-quem-e', { id: 'reconhecer', position: em(0, 0) }),
    {
      id: 'ja-e-aluno',
      type: 'condicao',
      position: em(1, 0),
      data: { variavel: 'encontrado', operador: 'igual', valor: '1' },
    },

    // 2 — o que ela tem marcado, para o menu saber do que está falando.
    comPreset('verandi-minha-agenda', { id: 'ficha', position: em(2, 0) }),

    /*
     * 3 — qual aula.
     *
     * O menu sai de `proximas`, com o rótulo do preset (dia, hora e serviço):
     * quem tem duas aulas na semana precisa saber de qual delas se trata, e
     * duas linhas idênticas são uma escolha no escuro.
     *
     * A saída `vazio` existe porque "não tenho nada marcado" é resposta
     * legítima, e um menu vazio seria a pior versão dela.
     */
    {
      id: 'qual-aula',
      type: 'pergunta',
      position: em(3, 0),
      data: {
        texto:
          'Oi, *{{nome_na_agenda}}*! 👋 Vamos avisar da falta então.\nQual aula você não vai poder fazer?',
        salvarEm: 'aula',
        opcoes: [],
        opcoesDe: 'proximas',
        valoresDe: 'proximas_id',
        salvarValorEm: 'participacao_id',
        timeoutMinutos: 60,
      },
    },
    {
      id: 'nada-marcado',
      type: 'mensagem',
      position: em(3, 1.6),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Oi, *{{nome_na_agenda}}*! 👋 Não vi nenhuma aula marcada para você por aqui.\nSe precisar de alguma coisa, é só me chamar. 🙌',
          },
        ],
      },
    },

    /*
     * 4 — ainda dá tempo?
     *
     * A pergunta é sobre **esta** aula, e é por isso que ela tem o id no
     * pedido. A ficha acima também sabe responder isso, mas para a lista
     * inteira: casar a resposta com a aula escolhida dependeria da posição no
     * menu, e posição é um acordo que ninguém vê quebrar.
     */
    comPreset('verandi-ver-marcacao', { id: 'confere-prazo', position: em(4, 0) }),
    {
      id: 'dentro-do-prazo',
      type: 'condicao',
      position: em(5, 0),
      data: { variavel: 'pode_repor', operador: 'igual', valor: 'true' },
    },

    /*
     * 5a — dentro do prazo: confirma sem drama.
     *
     * Ainda assim confirma, e não desmarca direto: o passo seguinte escreve na
     * agenda de verdade, e escrita que a pessoa não confirmou é escrita que
     * alguém desfaz no balcão.
     */
    {
      id: 'confirma-no-prazo',
      type: 'pergunta',
      position: em(6, -1.3),
      data: {
        texto:
          'Certo. Você quer cancelar a aula *{{aula}}*?\nComo você está avisando com antecedência, ela fica guardada para reposição. 🙌',
        opcoes: [
          { id: 'sim', rotulo: '✅ Sim, pode cancelar' },
          { id: 'nao', rotulo: '↩️ Não, deixa assim' },
        ],
        timeoutMinutos: 120,
      },
    },

    /*
     * 5b — fora do prazo: a pessoa decide sabendo o que perde.
     *
     * *"Caso esteja fora do horário, avisar e falar: por você estar fora do
     * horário, você não vai conseguir ter uma reposição dessa aula. Você
     * gostaria de cancelar mesmo?"*
     *
     * `{{aviso_do_prazo}}` é a frase da agenda, com o prazo daquela conta
     * dentro dela. Aqui não se escreve quantas horas são.
     */
    {
      id: 'confirma-fora-do-prazo',
      type: 'pergunta',
      position: em(6, 1.3),
      data: {
        texto: '{{aviso_do_prazo}}',
        opcoes: [
          { id: 'sim', rotulo: '✅ Sim, cancelar' },
          { id: 'nao', rotulo: '↩️ Não, vou tentar' },
        ],
        timeoutMinutos: 120,
      },
    },

    // 6 — a baixa na agenda. É o mesmo bloco nos dois caminhos: quem avisa
    // tarde cancela igual, e o que muda é só o crédito, que a agenda decide.
    comPreset('verandi-desmarcar', { id: 'desmarcar', position: em(7, 0) }),

    /*
     * Teve crédito, afinal?
     *
     * A pergunta se repete aqui de propósito. `pode_repor` foi lido antes da
     * confirmação, e entre aquele instante e este a pessoa levou um tempo para
     * responder: uma aula que ainda estava dentro do prazo quando o menu abriu
     * pode ter saído dele enquanto ela decidia. Quem grava a decisão é o
     * `DELETE`, e é a resposta dele que diz o que de fato aconteceu.
     */
    {
      id: 'teve-credito',
      type: 'condicao',
      position: em(8, 0),
      data: { variavel: 'situacao', operador: 'igual', valor: 'falta_avisada' },
    },

    /*
     * 7 — o desfecho, e ele é diferente nos dois lados.
     *
     * Dizer "sua reposição fica guardada" para quem avisou tarde seria prometer
     * o que a agenda não vai dar, e a pessoa só descobriria na hora de remarcar.
     */
    {
      id: 'cancelado-com-credito',
      type: 'mensagem',
      position: em(8, -1.3),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Pronto, avisado! ✅ Já liberei sua vaga em *{{aula}}*.',
          },
          { tipo: 'atraso', segundos: 1 },
          {
            tipo: 'texto',
            texto:
              'Sua reposição fica guardada. Quando quiser remarcar, é só me chamar por aqui. 🙌',
          },
        ],
      },
    },
    {
      id: 'cancelado-sem-credito',
      type: 'mensagem',
      position: em(8, 1.3),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Tudo bem, cancelado. ✅ Sua vaga em *{{aula}}* já foi liberada.',
          },
          { tipo: 'atraso', segundos: 1 },
          {
            /*
             * O lembrete do prazo sai **aqui**, que é quando ele significa
             * alguma coisa. Dito antes, no meio da conversa, seria sermão; dito
             * agora, é a informação que evita a próxima perda.
             */
            tipo: 'texto',
            texto:
              'Como o aviso veio em cima da hora, essa aula não entra como reposição. Na próxima, avisando com {{prazo_cancelamento}} de antecedência, ela fica guardada. 🙌',
          },
        ],
      },
    },

    // Mudou de ideia: não escreve nada na agenda, e diz isso.
    {
      id: 'manteve',
      type: 'mensagem',
      position: em(7, 2.6),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Combinado, deixei sua aula *{{aula}}* como estava. Até lá! 🙌',
          },
        ],
      },
    },

    /*
     * A saída para gente. O motivo carrega o nome e a aula porque é o que a
     * fila do Inbox mostra antes de alguém abrir a conversa.
     */
    {
      id: 'recepcao',
      type: 'handoff',
      position: em(5, 2.6),
      data: {
        motivo: 'não comparecimento — {{aula}} · {{nome_na_agenda}}',
        mensagem: 'Vou chamar alguém da recepção para te ajudar com isso. Só um instante! 🙌',
      },
    },
    {
      id: 'nao-e-aluno',
      type: 'handoff',
      position: em(2, 2),
      data: {
        motivo: 'não comparecimento — telefone não encontrado na agenda',
        mensagem:
          'Oi! 👋 Não te encontrei aqui na agenda pelo seu número. Vou chamar a recepção. 🙌',
      },
    },
  ],

  edges: [
    { id: 'n1', source: 'reconhecer', target: 'ja-e-aluno' },
    { id: 'n2', source: 'ja-e-aluno', sourceHandle: 'verdadeiro', target: 'ficha' },
    { id: 'n3', source: 'ja-e-aluno', sourceHandle: 'falso', target: 'nao-e-aluno' },
    { id: 'n4', source: 'ficha', target: 'qual-aula' },
    { id: 'n5', source: 'qual-aula', sourceHandle: 'escolheu', target: 'confere-prazo' },
    { id: 'n6', source: 'qual-aula', sourceHandle: 'vazio', target: 'nada-marcado' },
    { id: 'n7', source: 'qual-aula', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'n8', source: 'confere-prazo', target: 'dentro-do-prazo' },
    { id: 'n9', source: 'dentro-do-prazo', sourceHandle: 'verdadeiro', target: 'confirma-no-prazo' },
    { id: 'n10', source: 'dentro-do-prazo', sourceHandle: 'falso', target: 'confirma-fora-do-prazo' },
    { id: 'n11', source: 'confirma-no-prazo', sourceHandle: 'sim', target: 'desmarcar' },
    { id: 'n12', source: 'confirma-no-prazo', sourceHandle: 'nao', target: 'manteve' },
    /*
     * Silêncio mantém a aula, e não cancela. Quem não respondeu pode estar
     * dirigindo, e liberar a vaga de quem ia aparecer é o pior erro daqui.
     */
    { id: 'n13', source: 'confirma-no-prazo', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'n14', source: 'confirma-fora-do-prazo', sourceHandle: 'sim', target: 'desmarcar' },
    { id: 'n15', source: 'confirma-fora-do-prazo', sourceHandle: 'nao', target: 'manteve' },
    { id: 'n16', source: 'confirma-fora-do-prazo', sourceHandle: 'timeout', target: 'recepcao' },
    /*
     * O desfecho olha o que a agenda **gravou**, e não o ramo que trouxe até
     * aqui. `verandi-desmarcar` já mapeia `situacao` da resposta: `falta_avisada`
     * é com crédito, `falta` é sem. Confiar no ramo diria "sua reposição fica
     * guardada" para quem passou do prazo enquanto pensava.
     */
    { id: 'n17', source: 'desmarcar', target: 'teve-credito' },
    { id: 'n18', source: 'teve-credito', sourceHandle: 'verdadeiro', target: 'cancelado-com-credito' },
    { id: 'n19', source: 'teve-credito', sourceHandle: 'falso', target: 'cancelado-sem-credito' },
  ],
})
