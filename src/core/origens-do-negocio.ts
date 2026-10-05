/**
 * De onde um negócio veio (0127). Lista curta e fechada na tela pelo mesmo
 * motivo dos motivos de perda: texto livre vira "insta", "Instagram" e "IG"
 * como três origens, e aí o relatório não agrupa nada. O banco aceita texto,
 * então a lista pode crescer sem migration.
 */
export const ORIGENS_DO_NEGOCIO = [
  'WhatsApp',
  'Instagram',
  'Facebook',
  'Site',
  'Google',
  'Indicação',
  'Loja física',
  'Evento',
  'Outro',
] as const
