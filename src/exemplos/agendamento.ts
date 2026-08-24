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

    // 3 — para quando?
    {
      id: 'qual-dia',
      type: 'pergunta',
      position: coluna(4),
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

    // 4 — o que tem livre nesse dia.
    comPreset('verandi-horarios', { id: 'buscar-horarios', position: coluna(5) }),
    {
      id: 'qual-horario',
      type: 'pergunta',
      position: coluna(6),
      data: {
        texto: 'Estes são os horários livres em {{dia_escrito}}. Qual fica melhor?',
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

    // 4b — o dia não tem vaga. Não é erro: é a outra metade da conversa.
    {
      id: 'sem-vaga',
      type: 'pergunta',
      position: em(6, 1),
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

    // 5 — marca de verdade.
    comPreset('verandi-marcar', { id: 'marcar', position: coluna(7) }),
    {
      id: 'confirmado',
      type: 'mensagem',
      position: coluna(8),
      data: {
        partes: [
          {
            tipo: 'texto',
            texto:
              'Prontinho! ✅ Sua aula está marcada para *{{dia_escrito}} às {{horario}}*.',
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
      position: em(8, 1),
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
    { id: 'g4', source: 'ola-conhecido', target: 'qual-dia' },
    { id: 'g5', source: 'pedir-nome', target: 'cadastrar' },
    { id: 'g6', source: 'pedir-nome', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'g7', source: 'cadastrar', target: 'qual-dia' },
    { id: 'g8', source: 'qual-dia', target: 'buscar-horarios' },
    { id: 'g9', source: 'qual-dia', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'g10', source: 'buscar-horarios', target: 'qual-horario' },
    { id: 'g11', source: 'qual-horario', sourceHandle: 'escolheu', target: 'marcar' },
    { id: 'g12', source: 'qual-horario', sourceHandle: 'vazio', target: 'sem-vaga' },
    { id: 'g13', source: 'qual-horario', sourceHandle: 'timeout', target: 'recepcao' },
    // Voltar para a mesma pergunta é o "voltar ao menu": duas setas chegando no
    // mesmo bloco sempre foram válidas, e é o desenho que este caso pede.
    { id: 'g14', source: 'sem-vaga', sourceHandle: 'outro-dia', target: 'qual-dia' },
    { id: 'g15', source: 'sem-vaga', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'g16', source: 'sem-vaga', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'g17', source: 'marcar', target: 'confirmado' },
    { id: 'g18', source: 'confirmado', target: 'recepcao' },
  ],
})
