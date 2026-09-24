import { revalidatePath } from 'next/cache'

/**
 * Tudo que mostra um contato, marcado para recarregar (8.5, X16).
 *
 * Cada ação do Inbox e da ficha revalidava um pedaço diferente: adiar e
 * resolver só o Inbox, agendar o Inbox e a ficha, as atividades o layout
 * inteiro. Resultado: resolver no Inbox e abrir a ficha mostrava o selo velho
 * até alguém apertar F5, e o contrário também. Uma função só, chamada pelas
 * duas telas, faz as duas dizerem a mesma coisa depois de qualquer gesto.
 *
 * `revalidatePath` numa Server Action também limpa o cache de navegação do
 * navegador (ver `staleTimes` no `next.config.ts`): voltar para a outra tela
 * pelo link busca de novo, sem recarregar a página.
 */
export function recarregarContato(clienteId: string, contatoId: string): void {
  revalidatePath(`/clientes/${clienteId}/inbox`)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  revalidatePath(`/clientes/${clienteId}/leads`)
  revalidatePath(`/clientes/${clienteId}/atividades`)
  revalidatePath(`/clientes/${clienteId}/quadros`)
}
