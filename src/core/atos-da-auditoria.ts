/**
 * O verbo de cada ato da auditoria, como a tela escreve.
 *
 * Mora aqui, e não numa tela, porque três telas escrevem o mesmo registro: a
 * Auditoria, a aba Auditoria do detalhe da organização e os últimos
 * acontecimentos da Visão geral. Ato novo sem verbo aparece com o nome técnico,
 * que é feio mas não esconde nada.
 */
export const VERBOS_DA_AUDITORIA: Record<string, string> = {
  criou_primeiro_administrador: 'criou o primeiro administrador',
  criou_usuario: 'cadastrou',
  criou_conta: 'criou a organização',
  apagou_conta: 'apagou a organização',
  apagou_cliente: 'apagou a organização',
  editou_organizacao: 'editou os dados de',
  suspendeu_organizacao: 'suspendeu a organização',
  reativou_organizacao: 'reativou a organização',
  vinculou_membro: 'deu acesso a',
  removeu_membro: 'tirou o acesso de',
  trocou_papel: 'mudou a função de',
  trocou_funcao: 'mudou a função de',
  trocou_papel_na_conta: 'mudou a função de',
  revogou_sessoes: 'derrubou as sessões de',
  suspendeu_acesso: 'suspendeu',
  devolveu_acesso: 'devolveu o acesso de',
  entrou_como: 'entrou como',
  saiu_do_entrar_como: 'saiu de',
  pediu_troca_de_plano: 'pediu troca para o plano',
  atendeu_pedido_de_plano: 'atendeu o pedido de plano',
  recusou_pedido_de_plano: 'recusou o pedido de plano',
  trocou_plano: 'trocou o plano para',
  editou_plano: 'editou o plano',
  editou_funcao: 'editou a função',
  publicou_fluxo: 'publicou o fluxo',
  importou_fluxo: 'importou o fluxo',
  compartilhou_fluxo: 'compartilhou o fluxo',
  revogou_link_de_fluxo: 'revogou o link do fluxo',
  apagou_contato: 'apagou o contato',
}

export function verboDoAto(acao: string): string {
  return VERBOS_DA_AUDITORIA[acao] ?? acao.replaceAll('_', ' ')
}

/** Os grupos do filtro da tela de Auditoria. */
export const TIPOS_DE_ATO: { valor: string; rotulo: string; acoes: string[] }[] = [
  { valor: 'acesso', rotulo: 'Acesso e pessoas', acoes: ['vinculou_membro', 'removeu_membro', 'trocou_papel', 'trocou_funcao', 'trocou_papel_na_conta', 'criou_usuario', 'criou_primeiro_administrador', 'revogou_sessoes', 'suspendeu_acesso', 'devolveu_acesso'] },
  { valor: 'suporte', rotulo: 'Entrar como', acoes: ['entrou_como', 'saiu_do_entrar_como'] },
  { valor: 'plano', rotulo: 'Planos', acoes: ['pediu_troca_de_plano', 'atendeu_pedido_de_plano', 'recusou_pedido_de_plano', 'trocou_plano', 'editou_plano'] },
  { valor: 'organizacao', rotulo: 'Organização', acoes: ['criou_conta', 'apagou_conta', 'apagou_cliente', 'editou_organizacao', 'suspendeu_organizacao', 'reativou_organizacao'] },
  { valor: 'fluxos', rotulo: 'Fluxos', acoes: ['publicou_fluxo', 'importou_fluxo', 'compartilhou_fluxo', 'revogou_link_de_fluxo'] },
]
