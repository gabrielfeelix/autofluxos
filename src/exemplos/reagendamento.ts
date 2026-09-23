import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { acharPreset } from '@/core/presets'

/**
 * Reagendar uma reposição, o fluxo que quem opera descreveu falando.
 *
 * Ele existe porque a descrição veio pronta, e em ordem: *"no início do fluxo
 * ele identifica o número da pessoa para poder citar que essa pessoa é aluno, e
 * logo em seguida tem que citar dentro da mensagem o nome desse aluno. Então se
 * dentro da mensagem tivesse como integrar o serviço externo, que ele vai pegar
 * da Verandi as informações, retornar como variável, e depois citar 'irei
 * auxiliar reagendar sua aula', ou seja, ele já identificou o nome do aluno, o
 * número"*.
 *
 * **A diferença para o modelo de agendar é o que ele já sabe antes de
 * perguntar.** Agendar começa numa pergunta; reagendar começa numa afirmação ,
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
 *    dado vira "Olá {{nome}}" com o nome vazio, que foi o defeito relatado.
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
 * 5. **Ninguém digita data.** A pergunta era aberta *"me manda a data, por
 *    exemplo 21/08/2026"*, e quem opera cobrou: *"ele pergunta pra que dia,
 *    como se o aluno pudesse escolher quando quiser. Aí ele fala dia 14 e n
 *    tem, e o bot fala q n tem"*. Uma data aberta oferece 365 respostas das
 *    quais meia dúzia funciona, e recusa as outras 359. Agora são duas
 *    escolhas: a faixa (esta semana, a que vem, mais pra frente) e o dia,
 *    vindo de um menu com **só os dias que têm vaga**.
 *
 * O que ele **não** faz, e por decisão registrada em `docs/PLANO-AGENDA.md`:
 * não desmarca a aula antiga sozinho. A reposição já está em aberto na agenda ,
 * é ela que está sendo remarcada , e apagar participação por conta própria é o
 * tipo de escrita que não se desfaz pelo WhatsApp.
 */

/** O bloco de API já preenchido por um preset, para o modelo não repetir a URL. */
function comPreset(id: string, no: { id: string; position: { x: number; y: number } }) {
  const preset = acharPreset(id)
  if (!preset) throw new Error(`preset ${id} sumiu, o modelo de reagendamento depende dele`)
  return { ...no, type: 'http', data: { ...preset.dados } }
}

const em = (x: number, y: number) => ({ x: x * 320, y: y * 190 })

export const reagendamento: Fluxo = fluxoSchema.parse({
  inicio: 'reconhecer',
  nodes: [
    // 1, quem é, e o que a agenda sabe dela. Antes de qualquer palavra.
    comPreset('verandi-quem-e', { id: 'reconhecer', position: em(0, 0) }),
    {
      id: 'ja-e-aluno',
      type: 'condicao',
      position: em(1, 0),
      data: { variavel: 'encontrado', operador: 'igual', valor: '1' },
    },

    // A ficha: nome, próximas e, o que motivou este fluxo, quantas reposições.
    comPreset('verandi-minha-agenda', { id: 'ficha', position: em(2, 0) }),

    /*
     * A saudação, que sai depois das duas chamadas de propósito: o nome só
     * existe porque a ficha já voltou.
     *
     * **A contagem não vem aqui, e já veio.** A frase era "você tem
     * *{{quantas_reposicoes}}* aula(s) para repor", e ela roda antes de
     * `tem-reposicao`, onde o número ainda pode ser qualquer um, inclusive
     * zero. Quem não tinha nada para repor lia *"você tem 0 aula(s) para
     * repor:"* seguido de uma lista vazia, e só na mensagem seguinte era
     * desmentido. O `aula(s)` era o sintoma visível; o defeito era afirmar a
     * contagem antes de saber qual era.
     *
     * Agora cada ramo diz a sua: `sem-reposicao` fala do zero, `uma-so` fala
     * de uma, `recepcao-muitas` fala de duas ou mais. Nenhum deles precisa de
     * `(s)`, porque cada um já sabe o número quando fala , e é por isso que a
     * correção é esta, e não uma sintaxe de plural no interpolador.
     */
    {
      id: 'ola',
      type: 'mensagem',
      position: em(3, 0),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Oi, {{nome_na_agenda}}! 👋 Vou te ajudar a reagendar sua aula.',
          },
        ],
      },
    },

    // 2, nenhuma reposição? A conversa muda de assunto, e não morre.
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
     * 3, mais de uma reposição sai da automação.
     *
     * O bot marca uma. Com duas ou mais, escolher qual remarcar primeiro é uma
     * conversa com gente, e prometer resolver as duas e resolver só uma é o
     * pior desfecho possível.
     */
    /*
     * Mais de uma, dito como "maior que 1".
     *
     * Já foi `diferente de 1`, com um comentário explicando que não existia
     * operador numérico e que o ramo do zero ter saído acima tornava a leitura
     * exata. O contorno estava certo e deixou de ser necessário: `maior` e
     * `menor` entraram no motor depois, e a condição agora diz o que quer
     * dizer sem depender de qual ramo veio antes.
     */
    {
      id: 'mais-de-uma',
      type: 'condicao',
      position: em(5, 0),
      data: { variavel: 'quantas_reposicoes', operador: 'maior', valor: '1' },
    },

    /*
     * 4, uma só: aqui a contagem é certa, e a frase pode ser afirmativa.
     *
     * Ela existe porque a saudação deixou de dizer o número (ver o comentário
     * em `ola`). Dizer *qual* aula está em aberto antes de perguntar a data é
     * o que quem opera pediu , a aluna confirma que é aquela mesmo antes de
     * escolher dia e hora, em vez de descobrir no fim.
     */
    {
      id: 'uma-so',
      type: 'mensagem',
      position: em(5.5, 0.9),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Você tem *uma aula* para repor:\n{{reposicoes_abertas}}',
          },
        ],
      },
    },

    // 5, uma só: o bot resolve inteiro. Para quando?
    {
      id: 'qual-dia',
      type: 'pergunta',
      position: em(6, 0),
      data: {
        texto: 'Vamos remarcar então. Para quando você quer?',
        salvarEm: 'faixa',
        opcoes: [
          { id: 'esta', rotulo: '📅 Esta semana' },
          { id: 'proxima', rotulo: '🗓️ Semana que vem' },
          { id: 'depois', rotulo: '⏳ Mais pra frente' },
        ],
        timeoutMinutos: 60,
      },
    },

    /*
     * A faixa vira intervalo, num nó por opção.
     *
     * São dois valores (`data_de` e `data_ate`) e `salvarValorEm` guarda um
     * só, então a tradução é explícita. As datas em si não são calculadas
     * aqui: `semana_de`, `prox_semana_de` e `daqui_30_dias` já chegam prontas
     * em toda conversa, com o fuso da conta, e foram escritas justamente para
     * este menu existir sem ninguém digitar data. Ver `core/datas.ts`.
     */
    {
      id: 'faixa-esta',
      type: 'mensagem',
      position: em(6.6, -1),
      data: {
        partes: [
          { tipo: 'salvar', campo: 'data_de', valor: '{{semana_de}}' },
          { tipo: 'salvar', campo: 'data_ate', valor: '{{semana_ate}}' },
        ],
      },
    },
    {
      id: 'faixa-proxima',
      type: 'mensagem',
      position: em(6.6, 0),
      data: {
        partes: [
          { tipo: 'salvar', campo: 'data_de', valor: '{{prox_semana_de}}' },
          { tipo: 'salvar', campo: 'data_ate', valor: '{{prox_semana_ate}}' },
        ],
      },
    },
    {
      id: 'faixa-depois',
      type: 'mensagem',
      position: em(6.6, 1),
      data: {
        partes: [
          // Começa na semana seguinte à próxima: as duas primeiras faixas já
          // cobrem até lá, e repetir dia já oferecido faria o terceiro menu
          // parecer que as outras opções não valeram.
          { tipo: 'salvar', campo: 'data_de', valor: '{{prox_semana_ate}}' },
          { tipo: 'salvar', campo: 'data_ate', valor: '{{daqui_30_dias}}' },
        ],
      },
    },

    comPreset('verandi-dias', { id: 'buscar-dias', position: em(7.2, 0) }),

    /*
     * O dia sai de um menu, e não de um teclado.
     *
     * É a correção que quem opera pediu: *"ele pergunta: pra que dia? como se
     * o aluno pudesse escolher quando quiser. Aí ele fala dia 14 e n tem, e o
     * bot fala q n tem"*. Perguntar uma data aberta é oferecer 365 respostas
     * das quais meia dúzia funciona, e depois recusar as outras 359.
     *
     * O menu lê `dias_livres_br` ("sexta 21/08") e manda `dias_livres`
     * ("2026-08-21"): o rótulo é o que a pessoa escolhe, o valor é o que a
     * agenda entende. Um só para os dois papéis significaria ou pedir que ela
     * escolha entre datas ISO, ou mandar "sexta 21/08" no `?de=` da API.
     */
    {
      id: 'dia-do-menu',
      type: 'pergunta',
      position: em(8, 0),
      data: {
        texto: 'Estes são os dias com vaga. Qual fica melhor?',
        salvarEm: 'dia_escrito',
        opcoes: [],
        opcoesDe: 'dias_livres_br',
        valoresDe: 'dias_livres',
        salvarValorEm: 'dia',
        timeoutMinutos: 60,
      },
    },

    // Faixa sem nenhum dia livre: oferece escolher outra, em vez de morrer.
    {
      id: 'faixa-vazia',
      type: 'pergunta',
      position: em(8, 1.5),
      data: {
        texto: 'Não achei vaga nesse período. 😕\nQuer ver outro?',
        opcoes: [
          { id: 'outra', rotulo: '📅 Ver outro período' },
          { id: 'falar', rotulo: '💬 Chamar a recepção' },
        ],
        timeoutMinutos: 60,
      },
    },

    comPreset('verandi-horarios', { id: 'buscar-horarios', position: em(9, 0) }),

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
     * 5, a confirmação antes de gravar.
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

    // 6, "data, horário, nome, e pronto, acabou."
    {
      id: 'confirmado',
      type: 'mensagem',
      position: em(12, 0),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Prontinho, {{nome_na_agenda}}! ✅\nSua aula está marcada para *{{dia_escrito}} às {{horario}}*.',
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
     * "3 em aberto" antes de alguém abrir a conversa, quem pega já sabe se é
     * caso de dois minutos ou de dez.
     *
     * **"em aberto" e não "reposição(ões)".** Aqui o número é mesmo variável ,
     * este handoff recebe o ramo de duas ou mais, o de zero e os timeouts , e
     * não há ramificação que resolva a concordância como em `ola`. Como é
     * texto de fila interna, e não fala com o cliente, a saída é a palavra que
     * serve a qualquer número em vez de um parêntese que ninguém lê em voz
     * alta.
     */
    {
      id: 'recepcao',
      type: 'handoff',
      position: em(12, 1.4),
      data: {
        motivo: 'reagendar, {{quantas_reposicoes}} em aberto, {{nome_na_agenda}}',
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
        motivo: 'reagendar, telefone não encontrado na agenda',
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
    { id: 'e12', source: 'mais-de-uma', sourceHandle: 'falso', target: 'uma-so' },
    { id: 'e12b', source: 'uma-so', target: 'qual-dia' },
    /*
     * Cada faixa grava o seu intervalo e as três caem na mesma busca.
     *
     * Três arestas chegando em `buscar-dias` é o desenho certo: o que muda
     * entre elas é só o par de datas, e um nó de busca por faixa seria o mesmo
     * bloco copiado três vezes, com três lugares para esquecer de mexer.
     */
    { id: 'e13a', source: 'qual-dia', sourceHandle: 'esta', target: 'faixa-esta' },
    { id: 'e13b', source: 'qual-dia', sourceHandle: 'proxima', target: 'faixa-proxima' },
    { id: 'e13c', source: 'qual-dia', sourceHandle: 'depois', target: 'faixa-depois' },
    { id: 'e13d', source: 'faixa-esta', target: 'buscar-dias' },
    { id: 'e13e', source: 'faixa-proxima', target: 'buscar-dias' },
    { id: 'e13f', source: 'faixa-depois', target: 'buscar-dias' },
    { id: 'e13g', source: 'buscar-dias', target: 'dia-do-menu' },
    { id: 'e13h', source: 'dia-do-menu', sourceHandle: 'escolheu', target: 'buscar-horarios' },
    // Período sem vaga nenhuma: a saída `vazio` da pergunta dinâmica existe
    // para isto, e sem ela o menu abriria sem opção alguma.
    { id: 'e13i', source: 'dia-do-menu', sourceHandle: 'vazio', target: 'faixa-vazia' },
    { id: 'e13j', source: 'dia-do-menu', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'e13k', source: 'faixa-vazia', sourceHandle: 'outra', target: 'qual-dia' },
    { id: 'e13l', source: 'faixa-vazia', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'e13m', source: 'faixa-vazia', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'e14', source: 'qual-dia', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'e15', source: 'buscar-horarios', target: 'quem-atende' },
    { id: 'e16', source: 'quem-atende', target: 'qual-horario' },
    { id: 'e17', source: 'qual-horario', sourceHandle: 'escolheu', target: 'confere' },
    { id: 'e18', source: 'qual-horario', sourceHandle: 'vazio', target: 'sem-vaga' },
    { id: 'e19', source: 'qual-horario', sourceHandle: 'timeout', target: 'recepcao' },
    // Voltar para a mesma pergunta é o "voltar ao menu": duas setas chegando no
    // mesmo bloco sempre foram válidas, e é o desenho que este caso pede.
    // Volta ao **menu de dias**, e não à escolha de faixa: a pessoa já disse o
    // período, e refazer essa pergunta descartaria uma resposta que vale.
    { id: 'e20', source: 'sem-vaga', sourceHandle: 'outro-dia', target: 'dia-do-menu' },
    { id: 'e21', source: 'sem-vaga', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'e22', source: 'sem-vaga', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'e23', source: 'confere', sourceHandle: 'sim', target: 'marcar' },
    { id: 'e24', source: 'confere', sourceHandle: 'nao', target: 'dia-do-menu' },
    { id: 'e25', source: 'confere', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'e26', source: 'marcar', target: 'confirmado' },
  ],
})
