import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { acharPreset } from '@/core/presets'

/**
 * "Voltei de licença", o fluxo que o estúdio pediu depois de ver a licença
 * acompanhada na Verandi.
 *
 * A conversa, como foi descrita: *"ter no chatbot essa informação de retornei
 * de licença, pergunta se quer reagendar a aula ou se não quer. Caso queira ele
 * dá opções e marca, caso não, notifica o Daniel e deixa em aberto e fica como
 * pendência"*.
 *
 * As decisões que o desenho carrega:
 *
 * 1. **Reconhecer e ler a ficha antes da primeira palavra**, como no reagendar:
 *    a saudação usa o nome que a agenda tem.
 * 2. **Marcar é o mesmo caminho do reagendar**: faixa (esta semana, a que vem,
 *    mais pra frente), dia de um menu com só os dias que têm vaga, horário, e
 *    confirmação antes de gravar. Ninguém digita data.
 * 3. **A licença só fecha depois da aula marcada.** O aviso para a agenda com
 *    `reagendou: true` vem depois do `marcar`; se marcar falhar, a conversa vai
 *    para a recepção e a licença continua aberta, que é o lado seguro.
 * 4. **"Agora não" não fecha nada.** A agenda recebe `reagendou: false`, a
 *    licença fica aberta e sobe para o topo de Pendências, e a conversa passa
 *    para uma pessoa com o motivo escrito. É a notificação que o estúdio pediu.
 */

function comPreset(
  id: string,
  no: { id: string; position: { x: number; y: number } },
  troca: Record<string, unknown> = {},
) {
  const preset = acharPreset(id)
  if (!preset) throw new Error(`preset ${id} sumiu, o modelo de licença depende dele`)
  return { ...no, type: 'http', data: { ...preset.dados, ...troca } }
}

const em = (x: number, y: number) => ({ x: x * 320, y: y * 190 })

export const volteiDeLicenca: Fluxo = fluxoSchema.parse({
  inicio: 'reconhecer',
  nodes: [
    comPreset('verandi-quem-e', { id: 'reconhecer', position: em(0, 0) }),
    {
      id: 'ja-e-aluno',
      type: 'condicao',
      position: em(1, 0),
      data: { variavel: 'encontrado', operador: 'igual', valor: '1' },
    },

    comPreset('verandi-minha-agenda', { id: 'ficha', position: em(2, 0) }),

    {
      id: 'quer-marcar',
      type: 'pergunta',
      position: em(3, 0),
      data: {
        texto:
          'Oi, {{nome_na_agenda}}! 👋 Que bom ter você de volta.\nQuer aproveitar e já marcar uma aula?',
        opcoes: [
          { id: 'marcar', rotulo: '📅 Quero marcar' },
          { id: 'depois', rotulo: '⏳ Agora não' },
        ],
        timeoutMinutos: 60,
      },
    },

    {
      id: 'qual-dia',
      type: 'pergunta',
      position: em(4, 0),
      data: {
        texto: 'Para quando você quer?',
        salvarEm: 'faixa',
        opcoes: [
          { id: 'esta', rotulo: '📅 Esta semana' },
          { id: 'proxima', rotulo: '🗓️ Semana que vem' },
          { id: 'depois', rotulo: '⏳ Mais pra frente' },
        ],
        timeoutMinutos: 60,
      },
    },
    {
      id: 'faixa-esta',
      type: 'mensagem',
      position: em(4.6, -1),
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
      position: em(4.6, 0),
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
      position: em(4.6, 1),
      data: {
        partes: [
          { tipo: 'salvar', campo: 'data_de', valor: '{{prox_semana_ate}}' },
          { tipo: 'salvar', campo: 'data_ate', valor: '{{daqui_30_dias}}' },
        ],
      },
    },

    comPreset('verandi-dias', { id: 'buscar-dias', position: em(5.2, 0) }),
    {
      id: 'dia-do-menu',
      type: 'pergunta',
      position: em(6, 0),
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
    {
      id: 'faixa-vazia',
      type: 'pergunta',
      position: em(6, 1.5),
      data: {
        texto: 'Não achei vaga nesse período. 😕\nQuer ver outro?',
        opcoes: [
          { id: 'outra', rotulo: '📅 Ver outro período' },
          { id: 'falar', rotulo: '💬 Chamar a recepção' },
        ],
        timeoutMinutos: 60,
      },
    },

    comPreset('verandi-horarios', { id: 'buscar-horarios', position: em(7, 0) }),
    {
      id: 'qual-horario',
      type: 'pergunta',
      position: em(8, 0),
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
    {
      id: 'sem-vaga',
      type: 'pergunta',
      position: em(8, 1.4),
      data: {
        texto: 'Em {{dia_escrito}} não temos horário livre. 😕\nQuer tentar outro dia?',
        opcoes: [
          { id: 'outro-dia', rotulo: '📅 Escolher outro dia' },
          { id: 'falar', rotulo: '💬 Chamar a recepção' },
        ],
        timeoutMinutos: 60,
      },
    },

    {
      id: 'confere',
      type: 'pergunta',
      position: em(9, 0),
      data: {
        texto: 'Confirmando: *{{dia_escrito}} às {{horario}}*. Posso marcar?',
        opcoes: [
          { id: 'sim', rotulo: '✅ Sim, pode marcar' },
          { id: 'nao', rotulo: '↩️ Escolher outro' },
        ],
        timeoutMinutos: 60,
      },
    },

    comPreset('verandi-marcar', { id: 'marcar', position: em(10, 0) }),

    // a aula está gravada: agora a licença pode fechar. Se este aviso falhar, a
    // aula continua marcada e a recepção encerra a licença em Pendências
    comPreset(
      'verandi-voltei-de-licenca',
      { id: 'fechar-licenca', position: em(11, 0) },
      {
        corpo: `{
  "pessoaId": "{{pessoa_id}}",
  "reagendou": true
}`,
        aoFalhar: 'seguir',
      },
    ),

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
          { tipo: 'texto', texto: 'Bom retorno! Qualquer coisa, é só me chamar por aqui. 🙌' },
        ],
      },
    },

    // "agora não": a licença fica aberta e marcada, e alguém do estúdio liga
    comPreset('verandi-voltei-de-licenca', { id: 'avisar-volta', position: em(4, 2.2) }),
    {
      id: 'equipe-liga',
      type: 'handoff',
      position: em(5, 2.2),
      data: {
        motivo: 'voltou de licença e não quis reagendar agora, {{nome_na_agenda}}',
        mensagem:
          'Tudo bem! Já avisei a equipe que você voltou, e alguém te chama para combinar o melhor horário. 🙌',
      },
    },

    {
      id: 'recepcao',
      type: 'handoff',
      position: em(11, 1.4),
      data: {
        motivo: 'voltou de licença e precisa de ajuda para marcar, {{nome_na_agenda}}',
        mensagem: 'Vou chamar alguém da recepção para acertar isso com você. Só um instante! 🙌',
      },
    },
    {
      id: 'nao-e-aluno',
      type: 'handoff',
      position: em(2, 1.6),
      data: {
        motivo: 'voltou de licença, telefone não encontrado na agenda',
        mensagem:
          'Oi! 👋 Não te encontrei aqui na agenda pelo seu número. Vou chamar a recepção para te ajudar. 🙌',
      },
    },
  ],

  edges: [
    { id: 'l1', source: 'reconhecer', target: 'ja-e-aluno' },
    { id: 'l2', source: 'ja-e-aluno', sourceHandle: 'verdadeiro', target: 'ficha' },
    { id: 'l3', source: 'ja-e-aluno', sourceHandle: 'falso', target: 'nao-e-aluno' },
    { id: 'l4', source: 'ficha', target: 'quer-marcar' },
    { id: 'l5', source: 'quer-marcar', sourceHandle: 'marcar', target: 'qual-dia' },
    { id: 'l6', source: 'quer-marcar', sourceHandle: 'depois', target: 'avisar-volta' },
    { id: 'l7', source: 'quer-marcar', sourceHandle: 'timeout', target: 'avisar-volta' },
    { id: 'l8', source: 'avisar-volta', target: 'equipe-liga' },
    { id: 'l9a', source: 'qual-dia', sourceHandle: 'esta', target: 'faixa-esta' },
    { id: 'l9b', source: 'qual-dia', sourceHandle: 'proxima', target: 'faixa-proxima' },
    { id: 'l9c', source: 'qual-dia', sourceHandle: 'depois', target: 'faixa-depois' },
    { id: 'l9d', source: 'qual-dia', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'l10a', source: 'faixa-esta', target: 'buscar-dias' },
    { id: 'l10b', source: 'faixa-proxima', target: 'buscar-dias' },
    { id: 'l10c', source: 'faixa-depois', target: 'buscar-dias' },
    { id: 'l11', source: 'buscar-dias', target: 'dia-do-menu' },
    { id: 'l12a', source: 'dia-do-menu', sourceHandle: 'escolheu', target: 'buscar-horarios' },
    { id: 'l12b', source: 'dia-do-menu', sourceHandle: 'vazio', target: 'faixa-vazia' },
    { id: 'l12c', source: 'dia-do-menu', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'l13a', source: 'faixa-vazia', sourceHandle: 'outra', target: 'qual-dia' },
    { id: 'l13b', source: 'faixa-vazia', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'l13c', source: 'faixa-vazia', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'l14', source: 'buscar-horarios', target: 'qual-horario' },
    { id: 'l15a', source: 'qual-horario', sourceHandle: 'escolheu', target: 'confere' },
    { id: 'l15b', source: 'qual-horario', sourceHandle: 'vazio', target: 'sem-vaga' },
    { id: 'l15c', source: 'qual-horario', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'l16a', source: 'sem-vaga', sourceHandle: 'outro-dia', target: 'dia-do-menu' },
    { id: 'l16b', source: 'sem-vaga', sourceHandle: 'falar', target: 'recepcao' },
    { id: 'l16c', source: 'sem-vaga', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'l17a', source: 'confere', sourceHandle: 'sim', target: 'marcar' },
    { id: 'l17b', source: 'confere', sourceHandle: 'nao', target: 'dia-do-menu' },
    { id: 'l17c', source: 'confere', sourceHandle: 'timeout', target: 'recepcao' },
    { id: 'l18', source: 'marcar', target: 'fechar-licenca' },
    { id: 'l19', source: 'fechar-licenca', target: 'confirmado' },
  ],
})
