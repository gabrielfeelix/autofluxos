/** Contrato mínimo e não sensível entre a rota do Inbox e o navegador. */
export type AlertaDaFila = {
  id: string
  contatoId: string
  nome: string | null
  motivo: string
  desde: string
}

export function idsDosAlertas(alertas: AlertaDaFila[]): Set<string> {
  return new Set(alertas.map((alerta) => alerta.id))
}

/** Só o que entrou desde a última consulta merece interromper quem atende. */
export function novosAlertas(alertas: AlertaDaFila[], vistos: Set<string>): AlertaDaFila[] {
  return alertas.filter((alerta) => !vistos.has(alerta.id))
}
