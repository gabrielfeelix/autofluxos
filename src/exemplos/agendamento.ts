import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { acharPreset } from '@/core/presets'

/**
 * Agendar e remarcar, na agenda do cliente — o desenho inteiro.
 *
 * **É o fluxo que quem opera estava montando bloco a bloco**, e o motivo de ele
 * existir como modelo é que a montagem tem seis armadilhas que só se descobre
 * errando com cliente conversando:
 *
 * 1. **Reconhecer antes de perguntar.** O primeiro bloco procura o telefone na
 *    agenda. Sem ele, o bot pergunta o nome de quem faz aula há dois anos.
 * 2. **`encontrado` é `0`, e não vazio.** A rota responde 200 com `total: 0`
 *    quando não acha; a condição olha o total, e não o nome.
 * 3. **A data precisa ir padronizada.** A pessoa escreve `21/08/2026` e a API
 *    quer `2026-08-21` — por isso a pergunta guarda as duas formas, uma para a
 *    mensagem e outra para a chamada.
 * 4. **Rótulo e valor são coisas diferentes.** O menu mostra `07:00` e o
 *    `POST` precisa do id daquele horário. As duas listas saem do mesmo `[]`,
 *    na mesma ordem, e nenhuma delas pode ter "sem repetir".
 * 5. **Lista vazia é conversa, não erro.** Dia sem vaga sai pela saída `veio
 *    vazia` e oferece outro dia, em vez de morrer numa pergunta sem resposta.
 * 6. **A vaga é conferida ao gravar.** Entre montar o menu e a pessoa clicar,
 *    alguém pode ter ocupado — e aí a chamada falha e uma pessoa assume, porque
 *    quem responde por uma vaga é quem está no balcão.
 *
 * O desenho é o de um estúdio, mas nada aqui é de estúdio: troque as palavras
 * das mensagens e ele serve barbearia, clínica e consultório. O que é do
 * cliente são os textos e a credencial, e os dois estão fora do código.
 */

/** O bloco de API já preenchido por um preset, para o modelo não repetir a URL. */
function comPreset(id: string, no: { id: string; position: { x: number; y: number } }) {
  const preset = acharPreset(id)
  if (!preset) throw new Error(`preset ${id} sumiu — o modelo de agendamento depende dele`)
  return { ...no, type: 'http', data: { ...preset.dados } }
}

const coluna = (n: number) => ({ x: n * 320, y: 0 })
const em = (x: number, y: number) => ({ x: x * 320, y: y * 190 })

export const agendamento: Fluxo = fluxoSchema.parse({
  inicio: 'reconhecer',
  nodes: [
    // 1 — quem é esta pessoa? Antes de qualquer pergunta.
    comPreset('verandi-quem-e', { id: 'reconhecer', position: coluna(0) }),
    {
      id: 'ja-e-aluno',
      type: 'condicao',
      position: coluna(1),
      data: { variavel: 'encontrado', operador: 'igual', valor: '1' },
    },

    // 2a — conhecido: chama pelo nome.
    {
      id: 'ola-conhecido',
      type: 'mensagem',
      position: em(2, -1),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto: 'Oi, *{{nome_na_agenda}}*! 👋 Vamos marcar sua aula?',
          },
        ],
      },
    },

    /*
     * 2a′ — conferir o telefone antes de seguir.
     *
     * Pedido de quem opera: *"assim que ele coleta em relação ao agendamento, a
     * gente pode citar, conferindo o telefone: ah, seu telefone é esse mesmo?
     * Então ele tem que confirmar o telefone da pessoa, com base na que foi
     * recebida pelo chatbot, e depois colocar a opção de verdadeiro ou não."*
     *
     * Ela parece redundante — o número veio do próprio WhatsApp — e não é: o
     * número de quem escreve nem sempre é o número que a agenda tem. Filho que
     * escreve pelo aparelho da mãe é o caso comum, e sem esta pergunta a aula
     * do filho ia para a ficha dela.
     */
    {
      id: 'confere-telefone',
      type: 'pergunta',
      position: em(3, -1),
      data: {
        texto: 'Só confirmando: o telefone *{{telefone}}* é o seu mesmo?',
        opcoes: [
          { id: 'sim', rotulo: '✅ É o meu' },
          { id: 'nao', rotulo: '🙋 É de outra pessoa' },
        ],
        timeoutMinutos: 60,
      },
    },

    // 2b — novo: pega nome e cadastra.
    {
      id: 'pedir-nome',
      type: 'pergunta',
      position: em(2, 1),
      data: {
        texto: 'Oi! 👋 Ainda não te achei por aqui. Como posso te chamar?',
        salvarEm: 'nome',
        opcoes: [],
        timeoutMinutos: 60,
      },
    },
    comPreset('verandi-cadastrar', { id: 'cadastrar', position: em(3, 1) }),

    /*
     * 3 — qual modalidade, antes de qualquer horário.
     *
     * Quem opera descreveu a ordem: *"ele consulta primeiro a modalidade que a
     * pessoa citou — pode ter clicado em personal, pode ter clicado em pilates,
     * pode ter clicado em fisioterapia. A partir disso ele identifica a
     * modalidade, depois cita os dias e horários com base naquela modalidade."*
     *
     * **As opções vêm do catálogo, e não escritas aqui**, e é a diferença entre
     * um modelo e um fluxo de um cliente só: o estúdio que tiver quatro
     * modalidades vê quatro, e quem trocar o nome de uma na Verandi vê o nome
     * novo sem mexer no fluxo. Escrever "Pilates / Personal / Fisioterapia" em
     * botão fixo seria gravar o cardápio de um cliente dentro do produto.
     */
    comPreset('verandi-catalogo', { id: 'catalogo', position: coluna(4) }),
    {
      id: 'qual-modalidade',
      type: 'pergunta',
      position: coluna(5),
      data: {
        texto: 'Qual aula você quer marcar?',
        salvarEm: 'modalidade',
        opcoes: [],
        opcoesDe: 'servicos',
        // O par de sempre: a pessoa lê "Pilates solo" e a busca recebe o id.
        valoresDe: 'servicos_id',
        salvarValorEm: 'servico_id',
        timeoutMinutos: 60,
      },
    },

    // 4 — para quando?
    {
      id: 'qual-dia',
      type: 'pergunta',
      position: coluna(6),
      data: {
        texto:
          'Para quando você quer agendar?\nMe manda a data — por exemplo: *21/08/2026*',
        salvarEm: 'dia_escrito',
        // O padronizado é o que a API aceita; o escrito é o que a pessoa lê de
        // volta na confirmação.
        salvarPadraoEm: 'dia',
        formato: 'data',
        mensagemDeErro:
          'Desculpe, pode escrever novamente citando dia / mês / ano? Exemplo: *21/08/2026*',
        opcoes: [],
        timeoutMinutos: 60,
      },
    },

    /*
     * 5 — o que tem livre nesse dia, **daquela modalidade**.
     *
     * O preset filtrado é o que impede o pior desfecho deste fluxo: oferecer o
     * dia inteiro depois de a pessoa ter escolhido pilates, ela clicar num
     * horário de fisioterapia e o erro só aparecer com ela já no estúdio.
     */
    comPreset('verandi-horarios-da-modalidade', {
      id: 'buscar-horarios',
      position: coluna(7),
    }),
    {
      id: 'qual-horario',
      type: 'pergunta',
      position: coluna(8),
      data: {
        texto: 'Estes são os horários de *{{modalidade}}* em {{dia_escrito}}. Qual fica melhor?',
        salvarEm: 'horario',
        opcoes: [],
        opcoesDe: 'horarios',
        // O par que faz o menu virar agendamento: a pessoa lê "07:00" e a API
        // recebe o id daquele horário.
        valoresDe: 'horarios_id',
        salvarValorEm: 'sessao_id',
        timeoutMinutos: 60,
      },
    },

    // 5b — o dia não tem vaga. Não é erro: é a outra metade da conversa.
    {
      id: 'sem-vaga',
      type: 'pergunta',
      position: em(8, 1),
      data: {
        texto:
          'Em {{dia_escrito}} não temos *{{modalidade}}* com vaga. 😕\nQuer tentar outro dia?',
        opcoes: [
          { id: 'outro-dia', rotulo: '📅 Escolher outro dia' },
          { id: 'falar', rotulo: '💬 Chamar a recepção' },
        ],
        timeoutMinutos: 60,
      },
    },

    /*
     * 6 — a confirmação antes de gravar.
     *
     * O passo seguinte escreve na agenda de verdade, e escrita que a pessoa não
     * confirmou é escrita que alguém desfaz no balcão depois.
     */
    {
      id: 'confere',
      type: 'pergunta',
      position: coluna(9),
      data: {
        texto:
          'Confirmando: *{{modalidade}}*, {{dia_escrito}} às *{{horario}}*. Posso marcar?',
        opcoes: [
          { id: 'sim', rotulo: '✅ Sim, pode marcar' },
          { id: 'nao', rotulo: '↩️ Escolher outro' },
        ],
        timeoutMinutos: 60,
      },
    },

    // 7 — marca de verdade.
    comPreset('verandi-marcar', { id: 'marcar', position: coluna(10) }),
    {
      id: 'confirmado',
      type: 'mensagem',
      position: coluna(11),
      data: {
        partes: [
          {
            /*
             * A confirmação repete tudo, e é pedido de quem opera: *"retorna
             * pra pessoa data, horário e a modalidade"*. Quem lê os dados na
             * tela não volta em uma hora perguntando se deu certo.
             */
            tipo: 'texto',
            texto:
              'Prontinho! ✅ Sua *{{modalidade}}* está marcada para *{{dia_escrito}} às {{horario}}*.',
          },
          { tipo: 'atraso', segundos: 1 },
          {
            tipo: 'texto',
            texto:
              'Se precisar desmarcar, é só me chamar por aqui. Até lá! 🙌',
          },
        ],
      },
    },

    {
      id: 'recepcao',
      type: 'handoff',
      position: em(11, 1),
      data: {
        motivo: 'agendamento — {{nome_na_agenda}}{{nome}}',
        mensagem: 'Vou chamar alguém da recepção para te ajudar. Só um instante! 🙌',
      },
    },
  ],

  edges: [
    { id: 'g1', source: 'reconhecer', target: 'ja-e-aluno' },
    { id: 'g2', source: 'ja-e-aluno', sourceHandle: 'verdadeiro', target: 'ola-conhecido' },
    { id: 'g3', source: 'ja-e-aluno', sourceHandle: 'falso', target: 'pedir-nome' },
    { id: 'g4', source: 'ola-conhecido', target: 'confere-telefone' },
    // O telefone é de outra pessoa: quem responde por uma ficha trocada é gente.
    { id: 'g5', source: 'confere-telefone', sourceHandle: 'sim', target: 'catalogo' },
    { id: 'g6', source: 'confere-telefone', sourceHandle: 'nao', target: 'recepcao' },
    { id: 'g7', source: 'confere-telefone', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'g8', source: 'pedir-nome', target: 'cadastrar' },
    { id: 'g9', source: 'pedir-nome', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'g10', source: 'cadastrar', target: 'catalogo' },
    { id: 'g11', source: 'catalogo', target: 'qual-modalidade' },
    { id: 'g12', source: 'qual-modalidade', sourceHandle: 'escolheu', target: 'qual-dia' },
    // Conta sem serviço cadastrado não tem o que oferecer: uma pessoa assume.
    { id: 'g13', source: 'qual-modalidade', sourceHandle: 'vazio', target: 'recepcao' },
    { id: 'g14', source: 'qual-modalidade', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'g15', source: 'qual-dia', target: 'buscar-horarios' },
    { id: 'g16', source: 'qual-dia', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'g17', source: 'buscar-horarios', target: 'qual-horario' },
    { id: 'g18', source: 'qual-horario', sourceHandle: 'escolheu', target: 'confere' },
    { id: 'g19', source: 'qual-horario', sourceHandle: 'vazio', target: 'sem-vaga' },
    { id: 'g20', source: 'qual-horario', sourceHandle: 'timeout', target: 'recepcao' },
    // Voltar para a mesma pergunta é o "voltar ao menu": duas setas chegando no
    // mesmo bloco sempre foram válidas, e é o desenho que este caso pede.
    { id: 'g21', source: 'sem-vaga', sourceHandle: 'outro-dia', target: 'qual-dia' },
    { id: 'g22', source: 'sem-vaga', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'g23', source: 'sem-vaga', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'g24', source: 'confere', sourceHandle: 'sim', target: 'marcar' },
    { id: 'g25', source: 'confere', sourceHandle: 'nao', target: 'qual-dia' },
    { id: 'g26', source: 'confere', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'g27', source: 'marcar', target: 'confirmado' },
    /*
     * A confirmação é o fim, e não uma escala até uma pessoa.
     *
     * O desenho antigo ligava a confirmação ao handoff, e isso abria uma
     * conversa no Inbox para **todo agendamento que deu certo** — a fila enchia
     * de casos resolvidos, e quem opera tinha que fechar um por um. *"E pronto,
     * acabou."* O caminho até uma pessoa continua existindo por todos os outros
     * ramos, que é o que `SEM_SAIDA_HUMANA` cobra.
     */
  ],
})
