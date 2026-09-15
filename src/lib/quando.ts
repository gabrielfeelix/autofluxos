/**
 * Quando foi, em português de gente.
 *
 * Roda só no servidor (as duas telas são componentes de servidor), então não
 * existe o risco clássico de "há 2 min" no HTML e "há 3 min" na hidratação.
 *
 * O fuso é fixo em São Paulo de propósito: o painel é de um negócio brasileiro
 * e a hora tem que bater com o relógio de quem atende, não com o do servidor
 * da Vercel.
 */

const FUSO = 'America/Sao_Paulo'

const horaCurta = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: FUSO,
})

const horaCompleta = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: FUSO,
})

/** "agora", "há 12 min", "há 3 h", "há 2 dias", "12 de ago. 14:32". */
export function quando(iso: string, agora = Date.now()): string {
  const minutos = Math.floor((agora - new Date(iso).getTime()) / 60000)

  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`

  const dias = Math.floor(horas / 24)
  if (dias < 7) return dias === 1 ? 'ontem' : `há ${dias} dias`

  return horaCurta.format(new Date(iso))
}

/** A hora exata, para o `title` — o relativo é confortável, não é prova. */
export function horaExata(iso: string): string {
  return horaCompleta.format(new Date(iso))
}

/*
 * -----------------------------------------------------------------------------
 * Hora de relógio e agrupamento por dia
 * -----------------------------------------------------------------------------
 *
 * O relativo ("há 48 min") serve para uma lista que se varre de relance. Dentro
 * da conversa ele é ruim, e por um motivo concreto: quem atende precisa dizer
 * "te respondi 14:32", e "há 48 min" não responde isso — muda de valor a cada
 * minuto e não sobrevive a um print.
 *
 * O WhatsApp resolve isso com duas peças que andam juntas: **a hora de relógio
 * em cada bolha** e **uma etiqueta de dia** entre os blocos. Sem a etiqueta, a
 * hora sozinha mente — `09:14` de hoje e `09:14` de terça ficam idênticos.
 */

const relogio = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: FUSO,
})

/**
 * O dia de um instante, como `2026-09-15`, **no fuso de São Paulo**.
 *
 * `en-CA` porque é a localidade cujo formato curto já é ISO — o truque evita
 * montar a string à mão a partir de `getFullYear`/`getMonth`, que leem o fuso
 * do servidor. Uma mensagem das 22h em São Paulo é do dia seguinte em UTC, e
 * agrupar por UTC colocaria a conversa da noite debaixo da etiqueta errada.
 */
const diaISO = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: FUSO,
})

const diaPorExtenso = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  timeZone: FUSO,
})

const diaComAno = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: FUSO,
})

/** `14:32`. A hora que se lê na bolha e que sobrevive a um print. */
export function horaDoRelogio(iso: string): string {
  return relogio.format(new Date(iso))
}

/** A chave de agrupamento: `2026-09-15`, no fuso de quem atende. */
export function diaDaMensagem(iso: string): string {
  return diaISO.format(new Date(iso))
}

/**
 * A etiqueta que separa os blocos: `Hoje`, `Ontem`, `15 de setembro`, ou com
 * ano quando for de outro ano.
 *
 * O ano só aparece quando muda, porque numa conversa de atendimento quase tudo
 * é do ano corrente e repetir "2026" em toda etiqueta é ruído. Quando muda, ele
 * é obrigatório — `15 de setembro` sem ano, numa conversa que atravessou o
 * réveillon, é ambíguo de um jeito que ninguém percebe.
 */
export function rotuloDoDia(iso: string, agora = Date.now()): string {
  const dia = diaDaMensagem(iso)
  const hoje = diaDaMensagem(new Date(agora).toISOString())
  if (dia === hoje) return 'Hoje'

  const ontem = diaDaMensagem(new Date(agora - 24 * 60 * 60 * 1000).toISOString())
  if (dia === ontem) return 'Ontem'

  const data = new Date(iso)
  const mesmoAno = dia.slice(0, 4) === hoje.slice(0, 4)
  return mesmoAno ? diaPorExtenso.format(data) : diaComAno.format(data)
}

/**
 * Decide, item a item, se ele abre um dia novo.
 *
 * Devolve a etiqueta quando abre e `null` quando não — em vez de agrupar as
 * mensagens em arrays aninhados. A diferença importa: a lista continua plana,
 * então a `key` de cada bolha, o índice e o desenho existente seguem valendo, e
 * a etiqueta é só mais um nó entre irmãos.
 *
 * Espera a lista **em ordem cronológica**, que é como a conversa é lida.
 */
export function etiquetasDeDia<T>(
  itens: readonly T[],
  quandoFoi: (item: T) => string,
  agora = Date.now(),
): (string | null)[] {
  let anterior: string | null = null
  return itens.map((item) => {
    const dia = diaDaMensagem(quandoFoi(item))
    if (dia === anterior) return null
    anterior = dia
    return rotuloDoDia(quandoFoi(item), agora)
  })
}
