import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { acharPreset } from '@/core/presets'

/**
 * O lembrete de aula — o mini fluxo que quem opera pediu no fim da conversa:
 * *"aí depois a gente pode criar um mini fluxo que seja somente de lembrete"*.
 *
 * Ele é curto de propósito. Um lembrete não é um atendimento: ele diz uma coisa
 * e oferece dois gestos — confirmar presença ou avisar que não vem. Tudo além
 * disso vira uma conversa que ninguém pediu no meio do dia da pessoa.
 *
 * **A parte que ele resolve, e a que ele não resolve, precisam estar claras**,
 * porque a diferença é a de um aviso que sai e um que não sai:
 *
 * - **O que sai daqui**: a conversa do lembrete inteira — a mensagem, a
 *   confirmação, o "não vou poder" que já desmarca na agenda e devolve a vaga
 *   para outra pessoa na hora. Isso funciona hoje.
 * - **O que ainda não sai**: o disparo sozinho na véspera. Quem começa uma
 *   conversa fora da janela de 24h da Meta precisa de **modelo aprovado**, e
 *   este produto ainda não manda modelo (C4). Dentro da janela — alguém que
 *   falou com o bot hoje e tem aula amanhã — uma sequência entrega. Fora dela,
 *   não entrega, e o §2.1 do `docs/PLANO-AGENDA.md` é onde essa lacuna mora.
 *
 * Registrar isso aqui em vez de desenhar o fluxo e deixar quieto é a diferença
 * entre uma peça que falta e uma promessa falsa: um lembrete que não chega é
 * pior do que nenhum lembrete, porque quem confia nele para de olhar a agenda.
 *
 * **Desmarcar preserva a reposição.** O `DELETE` da participação não apaga nada
 * do outro lado: registra falta avisada, que é o que mantém o crédito da pessoa
 * e devolve a vaga para a fila de espera na mesma hora. É por isso que vale
 * insistir para a pessoa avisar em vez de simplesmente não aparecer.
 */

/** O bloco de API já preenchido por um preset, para o modelo não repetir a URL. */
function comPreset(id: string, no: { id: string; position: { x: number; y: number } }) {
  const preset = acharPreset(id)
  if (!preset) throw new Error(`preset ${id} sumiu — o modelo de lembrete depende dele`)
  return { ...no, type: 'http', data: { ...preset.dados } }
}

const em = (x: number, y: number) => ({ x: x * 320, y: y * 190 })

export const lembrete: Fluxo = fluxoSchema.parse({
  inicio: 'reconhecer',
  nodes: [
    // Quem é, e o que ela tem marcado. O lembrete fala de uma aula específica.
    comPreset('verandi-quem-e', { id: 'reconhecer', position: em(0, 0) }),
    {
      id: 'ja-e-aluno',
      type: 'condicao',
      position: em(1, 0),
      data: { variavel: 'encontrado', operador: 'igual', valor: '1' },
    },
    comPreset('verandi-minha-agenda', { id: 'ficha', position: em(2, 0) }),

    /*
     * A pergunta **é** o lembrete.
     *
     * Uma mensagem antes dela, dizendo a mesma coisa, faria o lembrete chegar
     * em duas notificações separadas — e a segunda chega quando a pessoa já
     * guardou o telefone. O aviso e o gesto moram juntos.
     *
     * O menu sai de `proximas`, e não de um texto fixo: quem tem duas aulas na
     * semana precisa saber de qual delas se está falando, e o rótulo do preset
     * já traz dia, hora e qual aula é.
     */
    {
      id: 'qual-aula',
      type: 'pergunta',
      position: em(3, 0),
      data: {
        texto:
          'Oi, *{{nome_na_agenda}}*! 👋 Passando para lembrar da sua aula.\nÉ sobre qual delas?',
        salvarEm: 'aula',
        opcoes: [],
        opcoesDe: 'proximas',
        valoresDe: 'proximas_id',
        salvarValorEm: 'participacao_id',
        timeoutMinutos: 60,
      },
    },

    // Nada marcado: o lembrete não tem assunto, e dizer isso é melhor do que
    // abrir um menu vazio.
    {
      id: 'nada-marcado',
      type: 'mensagem',
      position: em(3, 1.5),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Oi, *{{nome_na_agenda}}*! 👋 Não vi nenhuma aula marcada para você por aqui.\nSe quiser marcar uma, é só me chamar. 🙌',
          },
        ],
      },
    },

    {
      id: 'vem-ou-nao',
      type: 'pergunta',
      position: em(4, 0),
      data: {
        texto: 'Sua aula é *{{aula}}*. Podemos contar com você?',
        opcoes: [
          { id: 'vou', rotulo: '✅ Vou sim' },
          { id: 'nao-vou', rotulo: '❌ Não vou poder' },
          { id: 'remarcar', rotulo: '🔄 Quero remarcar' },
        ],
        timeoutMinutos: 240,
      },
    },

    {
      id: 'ate-la',
      type: 'mensagem',
      position: em(5, -1.2),
      data: {
        partes: [
          { tipo: 'texto', texto: 'Combinado! Te espero em *{{aula}}*. Até lá! 🙌' },
        ],
      },
    },

    // Avisar que não vem desmarca de verdade, e é o que devolve a vaga.
    comPreset('verandi-desmarcar', { id: 'desmarcar', position: em(5, 0) }),
    {
      id: 'desmarcado',
      type: 'mensagem',
      position: em(6, 0),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Tudo bem, avisado! ✅ Já liberei sua vaga em *{{aula}}*.',
          },
          { tipo: 'atraso', segundos: 1 },
          {
            /*
             * Dizer que a reposição ficou guardada é o que faz a pessoa avisar
             * da próxima vez em vez de simplesmente não aparecer — e falta
             * avisada é a diferença entre uma vaga que outra aluna aproveita e
             * uma vaga perdida pelas duas.
             */
            tipo: 'texto',
            texto:
              'Sua reposição fica guardada. Quando quiser remarcar, é só me chamar por aqui. 🙌',
          },
        ],
      },
    },

    // Remarcar é outra conversa inteira: quem opera pediu que ela tivesse dono.
    {
      id: 'recepcao',
      type: 'handoff',
      position: em(5, 1.5),
      data: {
        motivo: 'lembrete — remarcar {{aula}} · {{nome_na_agenda}}',
        mensagem:
          'Vou chamar alguém da recepção para remarcar com você. Só um instante! 🙌',
      },
    },

    {
      id: 'nao-e-aluno',
      type: 'handoff',
      position: em(2, 1.5),
      data: {
        motivo: 'lembrete — telefone não encontrado na agenda',
        mensagem:
          'Oi! 👋 Não te encontrei aqui na agenda pelo seu número. Vou chamar a recepção. 🙌',
      },
    },
  ],

  edges: [
    { id: 'l1', source: 'reconhecer', target: 'ja-e-aluno' },
    { id: 'l2', source: 'ja-e-aluno', sourceHandle: 'verdadeiro', target: 'ficha' },
    { id: 'l3', source: 'ja-e-aluno', sourceHandle: 'falso', target: 'nao-e-aluno' },
    { id: 'l4', source: 'ficha', target: 'qual-aula' },
    { id: 'l5', source: 'qual-aula', sourceHandle: 'escolheu', target: 'vem-ou-nao' },
    { id: 'l6', source: 'qual-aula', sourceHandle: 'vazio', target: 'nada-marcado' },
    { id: 'l7', source: 'qual-aula', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'l8', source: 'vem-ou-nao', sourceHandle: 'vou', target: 'ate-la' },
    { id: 'l9', source: 'vem-ou-nao', sourceHandle: 'nao-vou', target: 'desmarcar' },
    { id: 'l10', source: 'vem-ou-nao', sourceHandle: 'remarcar', target: 'recepcao' },
    /*
     * Silêncio no lembrete **não** desmarca.
     *
     * É a decisão que mais importa neste fluxo: quem não respondeu pode estar
     * dirigindo, e liberar a vaga de quem ia aparecer é o pior erro possível
     * aqui — pior do que a vaga ociosa de quem faltou. Sem resposta, a aula
     * continua de pé e quem confere é o balcão.
     */
    { id: 'l11', source: 'vem-ou-nao', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'l12', source: 'desmarcar', target: 'desmarcado' },
  ],
})
