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

/**
 * `gestoSemRecarregar`: por que as ações de gesto rápido não chamam a função
 * acima (25/set).
 *
 * No Next 16.3, **qualquer** `revalidatePath` dentro de Server Action faz a
 * resposta trazer a página aberta redesenhada inteira, seja qual for o caminho
 * passado (`next/dist/server/web/spec-extension/revalidate.js`: "TODO: only
 * revalidate if the path matches"). No Inbox isso é a fila, as contagens, o
 * histórico e a ficha refeitos no servidor antes de o `await` da ação voltar:
 * o botão ficava desabilitado por segundos, e quando a resposta chegava a tela
 * pulava.
 *
 * Resolver, adiar, pausar o bot, assumir, devolver, passar, finalizar, marcar
 * etiqueta, reagir, favoritar, agendar e mover no funil agora só gravam. Quem
 * põe a mudança na tela é o cliente, na hora do clique
 * (`components/inbox/conversa-local.ts`). As outras telas leem o banco no
 * próximo carregamento; uma já visitada pode mostrar o valor antigo até o fim
 * do `staleTimes.dynamic` (60 s, `next.config.ts`) ou um F5.
 */
