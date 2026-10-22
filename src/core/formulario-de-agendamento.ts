/**
 * O formulário nativo de agendamento do WhatsApp (WhatsApp Flows), ligado à
 * agenda da Verandi. Modelo pronto, sem editor visual: três telas.
 *
 * 1. **DIA**: os dias com horário livre nos próximos dias;
 * 2. **HORARIO**: os horários livres do dia escolhido, com serviço e
 *    profissional;
 * 3. **CONFIRMADO**: o resumo do que foi marcado. "Concluir" fecha o
 *    formulário e devolve a marcação para a conversa, que segue sozinha.
 *
 * Toda troca de tela passa pelo nosso endpoint (`data_exchange`): a lista vem
 * da agenda na hora, e a vaga é conferida no momento de marcar, nunca no
 * momento em que o menu foi montado.
 *
 * Aqui só o que é regra pura: o JSON das telas e como a resposta da agenda
 * vira opção de rádio. Rede e criptografia moram em `server/formularios-do-whatsapp`.
 */

export const TELA_DIA = 'DIA'
export const TELA_HORARIO = 'HORARIO'
export const TELA_CONFIRMADO = 'CONFIRMADO'

/** Quantos dias à frente o formulário oferece, contando hoje. */
export const DIAS_A_FRENTE = 14

/** O WhatsApp corta o grupo de rádio em 20 opções. */
export const MAXIMO_DE_OPCOES = 20
/** Título de opção: 30 caracteres. Descrição: 300. */
const MAXIMO_DO_TITULO = 30
const MAXIMO_DA_DESCRICAO = 300

/** O horário como a Verandi devolve em `/disponibilidade` (`livres[]`). */
export type HorarioLivre = {
  sessaoId: string
  /** `2026-10-23` */
  data: string
  /** `07:00` */
  hora: string
  servico: string | null
  profissional: string | null
  livres?: number | null
}

export type OpcaoDoFormulario = { id: string; title: string; description?: string }

const DIAS_DA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function cortar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo - 1).trimEnd()}…`
}

/** `2026-10-23` vira `Sexta, 23/10`. A data é civil: sem fuso, sem hora. */
export function rotuloDoDia(data: string): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  if (!ano || !mes || !dia) return data
  const semana = DIAS_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()]
  return `${semana}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
}

/** `aaaa-mm-dd` de hoje em Brasília, e o de daqui a `dias`. */
export function janelaDeDias(agora: Date, dias = DIAS_A_FRENTE): { de: string; ate: string } {
  const formatar = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
  return { de: formatar(agora), ate: formatar(new Date(agora.getTime() + (dias - 1) * 86_400_000)) }
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

/** Um dia por opção, na ordem, com quantos horários tem. */
export function opcoesDeDias(livres: HorarioLivre[]): OpcaoDoFormulario[] {
  const porDia = new Map<string, number>()
  for (const h of [...livres].sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))) {
    porDia.set(h.data, (porDia.get(h.data) ?? 0) + 1)
  }
  return [...porDia.entries()].slice(0, MAXIMO_DE_OPCOES).map(([data, n]) => ({
    id: data,
    title: rotuloDoDia(data),
    description: plural(n, 'horário livre', 'horários livres'),
  }))
}

/** Os horários de um dia: hora e serviço no título, profissional e vagas embaixo. */
export function opcoesDeHorarios(livres: HorarioLivre[], dia: string): OpcaoDoFormulario[] {
  return livres
    .filter((h) => h.data === dia)
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .slice(0, MAXIMO_DE_OPCOES)
    .map((h) => {
      const detalhes = [
        h.profissional ? `com ${h.profissional}` : null,
        typeof h.livres === 'number' && h.livres > 0 ? plural(h.livres, 'vaga', 'vagas') : null,
      ].filter(Boolean)
      return {
        id: h.sessaoId,
        title: cortar([h.hora, h.servico].filter(Boolean).join(' · '), MAXIMO_DO_TITULO),
        ...(detalhes.length ? { description: cortar(detalhes.join(' · '), MAXIMO_DA_DESCRICAO) } : {}),
      }
    })
}

/** A frase da tela final e da conversa: `Sexta, 23/10 às 07:00, Pilates solo com Carol.` */
export function resumoDaMarcacao(h: HorarioLivre): string {
  const oQue = [h.servico, h.profissional ? `com ${h.profissional}` : null].filter(Boolean).join(' ')
  return `${rotuloDoDia(h.data)} às ${h.hora}${oQue ? `, ${oQue}` : ''}.`
}

/**
 * O que o "Concluir" devolve, em `nfm_reply.response_json`, junto do
 * `flow_token`. São os nomes que viram variáveis da conversa.
 */
export type MarcacaoDoFormulario = {
  participacao_id: string
  sessao_id: string
  resumo: string
}

export function lerMarcacao(valor: unknown): MarcacaoDoFormulario | null {
  if (!valor || typeof valor !== 'object') return null
  const v = valor as Record<string, unknown>
  if (typeof v.participacao_id !== 'string' || !v.participacao_id) return null
  return {
    participacao_id: v.participacao_id,
    sessao_id: typeof v.sessao_id === 'string' ? v.sessao_id : '',
    resumo: typeof v.resumo === 'string' ? v.resumo : '',
  }
}

const OPCOES = {
  type: 'array',
  items: {
    type: 'object',
    properties: { id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } },
  },
} as const

/**
 * O Flow JSON publicado na Meta. Versão 7.1 do Flow JSON, 3.0 da API de dados.
 *
 * Os textos são fixos e neutros ("horário", não "aula"), porque o mesmo
 * modelo serve a estúdio, clínica e salão. O que muda por conta vem da agenda.
 */
export const FLOW_JSON_DE_AGENDAMENTO = {
  version: '7.1',
  data_api_version: '3.0',
  routing_model: { [TELA_DIA]: [TELA_HORARIO], [TELA_HORARIO]: [TELA_CONFIRMADO], [TELA_CONFIRMADO]: [] },
  screens: [
    {
      id: TELA_DIA,
      title: 'Escolha o dia',
      data: {
        dias: { ...OPCOES, __example__: [{ id: '2026-10-23', title: 'Sexta, 23/10', description: '3 horários livres' }] },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextBody', text: 'Escolha o dia. Na próxima tela, você vê os horários livres.' },
          { type: 'RadioButtonsGroup', name: 'dia', label: 'Dias com horário livre', required: true, 'data-source': '${data.dias}' },
          {
            type: 'Footer',
            label: 'Ver horários',
            'on-click-action': { name: 'data_exchange', payload: { dia: '${form.dia}' } },
          },
        ],
      },
    },
    {
      id: TELA_HORARIO,
      title: 'Escolha o horário',
      data: {
        dia: { type: 'string', __example__: '2026-10-23' },
        dia_rotulo: { type: 'string', __example__: 'Sexta, 23/10' },
        horarios: { ...OPCOES, __example__: [{ id: 'sessao-1', title: '07:00 · Pilates solo', description: 'com Carol · 2 vagas' }] },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextSubheading', text: '${data.dia_rotulo}' },
          { type: 'RadioButtonsGroup', name: 'sessao', label: 'Horários livres', required: true, 'data-source': '${data.horarios}' },
          {
            type: 'Footer',
            label: 'Marcar',
            'on-click-action': { name: 'data_exchange', payload: { sessao: '${form.sessao}', dia: '${data.dia}' } },
          },
        ],
      },
    },
    {
      id: TELA_CONFIRMADO,
      title: 'Horário marcado',
      terminal: true,
      success: true,
      data: {
        resumo: { type: 'string', __example__: 'Sexta, 23/10 às 07:00, Pilates solo com Carol.' },
        participacao_id: { type: 'string', __example__: 'participacao-1' },
        sessao_id: { type: 'string', __example__: 'sessao-1' },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Pronto, está marcado' },
          { type: 'TextBody', text: '${data.resumo}' },
          {
            type: 'Footer',
            label: 'Concluir',
            'on-click-action': {
              name: 'complete',
              payload: { participacao_id: '${data.participacao_id}', sessao_id: '${data.sessao_id}', resumo: '${data.resumo}' },
            },
          },
        ],
      },
    },
  ],
}
