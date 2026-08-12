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
