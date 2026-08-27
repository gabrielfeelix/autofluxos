import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { acharPreset } from '@/core/presets'

/**
 * Reagendar uma reposição — o fluxo que quem opera descreveu falando.
 *
 * Ele existe porque a descrição veio pronta, e em ordem: *"no início do fluxo
 * ele identifica o número da pessoa para poder citar que essa pessoa é aluno, e
 * logo em seguida tem que citar dentro da mensagem o nome desse aluno. Então se
 * dentro da mensagem tivesse como integrar o serviço externo, que ele vai pegar
 * da Verandi as informações, retornar como variável, e depois citar 'irei
 * auxiliar reagendar sua aula' — ou seja, ele já identificou o nome do aluno, o
 * número"*.
 *
 * **A diferença para o modelo de agendar é o que ele já sabe antes de
 * perguntar.** Agendar começa numa pergunta; reagendar começa numa afirmação —
 * quem é a pessoa, e quantas aulas ela tem para repor. Perguntar "quantas aulas
 * você tem para repor?" seria pedir à aluna um número que a agenda já tem, e
 * foi exatamente isso que quem opera recusou: *"não acho que deveria existir
 * uma opção de quantas aulas tem disponível para repor, mas sim que, ao
 * identificar o aluno, ele conseguir salvar essa informação para que já
 * possamos informar ao aluno"*.
 *
 * As quatro decisões que o desenho carrega, e o porquê de cada uma:
 *
 * 1. **Duas chamadas antes da primeira palavra.** `verandi-quem-e` traz o id, e
 *    `verandi-minha-agenda` traz o nome, as próximas e o número de reposições.
 *    A saudação só sai depois das duas, porque uma saudação que chega antes do
 *    dado vira "Olá {{nome}}" com o nome vazio — que foi o defeito relatado.
 * 2. **Zero reposições é conversa, não erro.** Quem não tem nada para repor
 *    ouve isso e recebe a oferta de marcar uma aula avulsa, em vez de cair num
 *    menu vazio.
 * 3. **Mais de uma reposição chama gente.** *"Caso a agenda só uma e ela tenha
 *    dificuldade mais de uma, a gente pode citar de uma forma que faz a
 *    transferência pro Daniel por garantia, e não ficar dependendo somente da
 *    automação, do robô em si."* O bot marca **uma**; remarcar duas de uma vez
 *    envolve escolher qual perde a vez, e isso é decisão de quem está no balcão.
 * 4. **A confirmação repete tudo.** *"Depois que a pessoa reagenda, ele só
 *    retorna as informações citando data, horário, nome, e fala assim: você tem
 *    aula agendada tal dia, tal horário, e pronto, acabou."* Quem confirma com
 *    os dados na tela não volta em uma hora perguntando se deu certo.
 *
 * O que ele **não** faz, e por decisão registrada em `docs/PLANO-AGENDA.md`:
 * não desmarca a aula antiga sozinho. A reposição já está em aberto na agenda —
 * é ela que está sendo remarcada —, e apagar participação por conta própria é o
 * tipo de escrita que não se desfaz pelo WhatsApp.
 */

/** O bloco de API já preenchido por um preset, para o modelo não repetir a URL. */
function comPreset(id: string, no: { id: string; position: { x: number; y: number } }) {
  const preset = acharPreset(id)
  if (!preset) throw new Error(`preset ${id} sumiu — o modelo de reagendamento depende dele`)
  return { ...no, type: 'http', data: { ...preset.dados } }
}

const em = (x: number, y: number) => ({ x: x * 320, y: y * 190 })

export const reagendamento: Fluxo = fluxoSchema.parse({
  inicio: 'reconhecer',
  nodes: [
    // 1 — quem é, e o que a agenda sabe dela. Antes de qualquer palavra.
    comPreset('verandi-quem-e', { id: 'reconhecer', position: em(0, 0) }),
    {
      id: 'ja-e-aluno',
      type: 'condicao',
      position: em(1, 0),
      data: { variavel: 'encontrado', operador: 'igual', valor: '1' },
    },

    // A ficha: nome, próximas e — o que motivou este fluxo — quantas reposições.
    comPreset('verandi-minha-agenda', { id: 'ficha', position: em(2, 0) }),

    /*
     * A saudação que quem opera pediu, com nome **e** número na mesma mensagem.
     *
     * Ela sai depois das duas chamadas de propósito: é o dado que faz a frase
     * existir. Sem `{{quantas_reposicoes}}` esta mensagem seria a saudação
     * genérica de qualquer bot, e a conversa começaria pedindo à aluna uma
     * informação que a agenda já tinha.
     */
    {
      id: 'ola',
      type: 'mensagem',
      position: em(3, 0),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Oi, *{{nome_na_agenda}}*! 👋 Vou te ajudar a reagendar sua aula.',
          },
          { tipo: 'atraso', segundos: 1 },
          {
            tipo: 'texto',
            texto:
              'Aqui no sistema você tem *{{quantas_reposicoes}}* aula(s) para repor:\n{{reposicoes_abertas}}',
          },
        ],
      },
    },

    // 2 — nenhuma reposição? A conversa muda de assunto, e não morre.
    {
      id: 'tem-reposicao',
      type: 'condicao',
      position: em(4, 0),
      data: { variavel: 'quantas_reposicoes', operador: 'igual', valor: '0' },
    },
    {
      id: 'sem-reposicao',
      type: 'pergunta',
      position: em(5, -1.4),
      data: {
        texto:
          'Na verdade você não tem nenhuma aula para repor agora. 🙂\nQuer marcar uma aula avulsa?',
        opcoes: [
          { id: 'marcar', rotulo: '📅 Marcar uma aula' },
          { id: 'falar', rotulo: '💬 Chamar a recepção' },
        ],
        timeoutMinutos: 60,
      },
    },

    /*
     * 3 — mais de uma reposição sai da automação.
     *
     * O bot marca uma. Com duas ou mais, escolher qual remarcar primeiro é uma
     * conversa com gente — e prometer resolver as duas e resolver só uma é o
     * pior desfecho possível.
     */
    /*
     * "Mais de uma" escrito como "não é exatamente uma".
     *
     * A condição compara texto, e não número — não existe `maior` aqui, e
     * inventar um operador numérico para este caso seria criar uma linguagem de
     * comparação inteira para manter e explicar. O ramo do zero já saiu acima,
     * então neste ponto `diferente de 1` só pode ser dois ou mais, e a leitura
     * continua exata.
     */
    {
      id: 'mais-de-uma',
      type: 'condicao',
      position: em(5, 0),
      data: { variavel: 'quantas_reposicoes', operador: 'diferente', valor: '1' },
    },

    // 4 — uma só: o bot resolve inteiro. Para quando?
    {
      id: 'qual-dia',
      type: 'pergunta',
      position: em(6, 0),
      data: {
        texto:
          'Vamos remarcar então. Para quando você quer?\nMe manda a data — por exemplo: *21/08/2026*',
        salvarEm: 'dia_escrito',
        salvarPadraoEm: 'dia',
        formato: 'data',
        mensagemDeErro:
          'Desculpe, pode escrever novamente citando dia / mês / ano? Exemplo: *21/08/2026*',
        opcoes: [],
        timeoutMinutos: 60,
      },
    },

    comPreset('verandi-horarios', { id: 'buscar-horarios', position: em(7, 0) }),

    /*
     * O menu diz a hora, a aula **e** o professor.
     *
     * *"Dependendo, nem precisa nem do professor porque a pessoa já pode
     * identificar. Caso queira deixar mais completo, a gente pode até citar
     * sobre o professor."* Fica citado: a mensagem antes do menu traz os
     * professores do dia, porque o rótulo do botão do WhatsApp para em 20
     * caracteres e `07:00 · Pilates solo` já são os 20.
     */
    {
      id: 'quem-atende',
      type: 'mensagem',
      position: em(8, 0),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Em {{dia_escrito}} quem atende é: {{horarios_prof}}.',
          },
        ],
      },
    },
    {
      id: 'qual-horario',
      type: 'pergunta',
      position: em(9, 0),
      data: {
        texto: 'Estes são os horários livres em {{dia_escrito}}. Qual fica melhor?',
        salvarEm: 'horario',
        opcoes: [],
        opcoesDe: 'horarios',
        valoresDe: 'horarios_id',
        salvarValorEm: 'sessao_id',
        timeoutMinutos: 60,
      },
    },

    // Dia sem vaga: oferece outro, em vez de morrer numa pergunta sem resposta.
    {
      id: 'sem-vaga',
      type: 'pergunta',
      position: em(9, 1.4),
      data: {
        texto:
          'Em {{dia_escrito}} não temos horário livre. 😕\nQuer tentar outro dia?',
        opcoes: [
          { id: 'outro-dia', rotulo: '📅 Escolher outro dia' },
          { id: 'falar', rotulo: '💬 Chamar a recepção' },
        ],
        timeoutMinutos: 60,
      },
    },

    /*
     * 5 — a confirmação antes de gravar.
     *
     * *"Pergunta sim ou não com variável de reposição."* Ela existe porque o
     * passo seguinte **escreve na agenda de verdade**, e escrita que a pessoa
     * não confirmou é escrita que alguém vai desfazer no balcão.
     */
    {
      id: 'confere',
      type: 'pergunta',
      position: em(10, 0),
      data: {
        texto:
          'Confirmando: *{{dia_escrito}} às {{horario}}*, no lugar da sua reposição. Posso marcar?',
        opcoes: [
          { id: 'sim', rotulo: '✅ Sim, pode marcar' },
          { id: 'nao', rotulo: '↩️ Escolher outro' },
        ],
        timeoutMinutos: 60,
      },
    },

    comPreset('verandi-marcar', { id: 'marcar', position: em(11, 0) }),

    // 6 — "data, horário, nome, e pronto, acabou."
    {
      id: 'confirmado',
      type: 'mensagem',
      position: em(12, 0),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Prontinho, *{{nome_na_agenda}}*! ✅\nSua aula está marcada para *{{dia_escrito}} às {{horario}}*.',
          },
          { tipo: 'atraso', segundos: 1 },
          {
            tipo: 'texto',
            texto: 'Se precisar mudar de novo, é só me chamar por aqui. Até lá! 🙌',
          },
        ],
      },
    },
    /*
     * A saída para gente, e o motivo entra nela.
     *
     * `{{quantas_reposicoes}}` no motivo é o que faz a fila do Inbox dizer
     * "3 reposições" antes de alguém abrir a conversa — quem pega já sabe se é
     * caso de dois minutos ou de dez.
     */
    {
      id: 'recepcao',
      type: 'handoff',
      position: em(12, 1.4),
      data: {
        motivo: 'reagendar {{quantas_reposicoes}} reposição(ões) — {{nome_na_agenda}}',
        mensagem:
          'Vou chamar alguém da recepção para acertar isso com você. Só um instante! 🙌',
      },
    },

    // Quem a agenda não conhece: o reagendamento não se aplica.
    {
      id: 'nao-e-aluno',
      type: 'handoff',
      position: em(2, 1.6),
      data: {
        motivo: 'reagendar — telefone não encontrado na agenda',
        mensagem:
          'Oi! 👋 Não te encontrei aqui na agenda pelo seu número. Vou chamar a recepção para te ajudar. 🙌',
      },
    },
  ],

  edges: [
    { id: 'e1', source: 'reconhecer', target: 'ja-e-aluno' },
    { id: 'e2', source: 'ja-e-aluno', sourceHandle: 'verdadeiro', target: 'ficha' },
    { id: 'e3', source: 'ja-e-aluno', sourceHandle: 'falso', target: 'nao-e-aluno' },
    { id: 'e4', source: 'ficha', target: 'ola' },
    { id: 'e5', source: 'ola', target: 'tem-reposicao' },
    { id: 'e6', source: 'tem-reposicao', sourceHandle: 'verdadeiro', target: 'sem-reposicao' },
    { id: 'e7', source: 'tem-reposicao', sourceHandle: 'falso', target: 'mais-de-uma' },
    { id: 'e8', source: 'sem-reposicao', sourceHandle: 'marcar', target: 'qual-dia' },
    { id: 'e9', source: 'sem-reposicao', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'e10', source: 'sem-reposicao', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'e11', source: 'mais-de-uma', sourceHandle: 'verdadeiro', target: 'recepcao' },
    { id: 'e12', source: 'mais-de-uma', sourceHandle: 'falso', target: 'qual-dia' },
    { id: 'e13', source: 'qual-dia', target: 'buscar-horarios' },
    { id: 'e14', source: 'qual-dia', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'e15', source: 'buscar-horarios', target: 'quem-atende' },
    { id: 'e16', source: 'quem-atende', target: 'qual-horario' },
    { id: 'e17', source: 'qual-horario', sourceHandle: 'escolheu', target: 'confere' },
    { id: 'e18', source: 'qual-horario', sourceHandle: 'vazio', target: 'sem-vaga' },
    { id: 'e19', source: 'qual-horario', sourceHandle: 'timeout', target: 'recepcao' },
    // Voltar para a mesma pergunta é o "voltar ao menu": duas setas chegando no
    // mesmo bloco sempre foram válidas, e é o desenho que este caso pede.
    { id: 'e20', source: 'sem-vaga', sourceHandle: 'outro-dia', target: 'qual-dia' },
    { id: 'e21', source: 'sem-vaga', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'e22', source: 'sem-vaga', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'e23', source: 'confere', sourceHandle: 'sim', target: 'marcar' },
    { id: 'e24', source: 'confere', sourceHandle: 'nao', target: 'qual-dia' },
    { id: 'e25', source: 'confere', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'e26', source: 'marcar', target: 'confirmado' },
  ],
})
