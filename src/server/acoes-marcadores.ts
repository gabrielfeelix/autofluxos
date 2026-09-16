'use server'

import { revalidatePath } from 'next/cache'
import { TETO_DE_FIXADAS } from '@/core/marcadores'
import { contatosDaConta } from './repos/leads'
import { marcarComoNaoLida, marcarTodasComoLidas } from './repos/leituras'
import {
  contarFixadasNoCliente,
  desfavoritar,
  favoritar,
  fixar,
  soltar,
} from './repos/marcadores'
import { exigirAcessoAoCliente } from './sessao'

/**
 * As marcações que cada atendente faz para si: o alfinete, a estrela e o
 * "deixa marcada que eu volto".
 *
 * ---------------------------------------------------------------------------
 * O que estas quatro ações têm em comum, e por que moram juntas
 * ---------------------------------------------------------------------------
 *
 * Nenhuma delas fala com a Meta, nenhuma muda a conversa, e nenhuma o colega ao
 * lado vê acontecer. São estado de **quem está olhando a tela**, e é por isso
 * que todas começam pegando o usuário da sessão em vez de receberem um id de
 * quem marcar: quem marca é sempre quem clicou, e aceitar isso por parâmetro
 * seria abrir um jeito de marcar coisa na tela dos outros.
 *
 * `exigirAcessoAoCliente` vem primeiro em todas pelo motivo de sempre: sem
 * direito à conta, o id de contato que veio na chamada não devia nem ser
 * consultado.
 */

/**
 * Gruda ou solta a conversa no topo da fila desta pessoa.
 *
 * O teto é conferido **aqui**, e não só na tela: entre carregar a fila e clicar
 * o alfinete pode passar o dia inteiro, e a outra aba da mesma pessoa pode ter
 * fixado três no meio disso. A tela desabilita antes por conforto; o servidor
 * recusa porque é ele quem sabe.
 */
export async function acaoFixarConversa(
  clienteId: string,
  contatoId: string,
  grudar: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  const { sessao } = await exigirAcessoAoCliente(clienteId)
  const usuarioId = sessao.usuario.id

  const [permitido] = await contatosDaConta(clienteId, [contatoId])
  if (!permitido) return { ok: false, erro: 'esta conversa não é desta conta' }

  if (!grudar) {
    const r = await soltar(usuarioId, permitido)
    if (r.ok) revalidarInbox(clienteId)
    return r
  }

  const quantas = await contarFixadasNoCliente(usuarioId, clienteId)
  if (quantas >= TETO_DE_FIXADAS) {
    return {
      ok: false,
      erro: `você já fixou ${TETO_DE_FIXADAS} conversas. Solte uma para fixar outra.`,
    }
  }

  const r = await fixar(usuarioId, permitido)
  if (r.ok) revalidarInbox(clienteId)
  return r
}

/**
 * Devolve a insígnia à conversa, para a pessoa voltar nela depois.
 *
 * **Não é o inverso de abrir a conversa**, e essa diferença aparece na tela: a
 * página do Inbox marca como lida ao desenhar a conversa aberta (ver o
 * `marcarComoLida` em `page.tsx`). Marcar como não lida a conversa que está
 * aberta seria desfeito no próximo quadro, e por isso quem chama é a linha da
 * fila, não a conversa.
 */
export async function acaoMarcarNaoLida(
  clienteId: string,
  contatoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { sessao } = await exigirAcessoAoCliente(clienteId)

  const [permitido] = await contatosDaConta(clienteId, [contatoId])
  if (!permitido) return { ok: false, erro: 'esta conversa não é desta conta' }

  const r = await marcarComoNaoLida(sessao.usuario.id, permitido)
  if (r.ok) revalidarInbox(clienteId)
  return r
}

/**
 * Zera a insígnia do que está à vista.
 *
 * **A lista vem da tela, e isso é o desenho, não preguiça.** "Todas" precisa
 * dizer todas de quê: quem está olhando "Adiadas" com uma busca escrita vê
 * onze conversas, e zerar as quatrocentas da conta apagaria o rastro de
 * trezentas e oitenta e nove que a pessoa nunca viu. A peneira de
 * `contatosDaConta` continua existindo porque a lista passou pelo navegador.
 */
export async function acaoMarcarTodasComoLidas(
  clienteId: string,
  contatos: string[],
): Promise<{ ok: boolean; erro?: string }> {
  const { sessao } = await exigirAcessoAoCliente(clienteId)

  const permitidos = await contatosDaConta(clienteId, contatos)
  if (permitidos.length === 0) return { ok: true }

  const r = await marcarTodasComoLidas(sessao.usuario.id, permitidos)
  if (r.ok) revalidarInbox(clienteId)
  return r
}

/**
 * Guarda a mensagem no acervo desta pessoa, ou tira de lá.
 *
 * O id é o interno (`messages.id`), e não o da Meta: saída ainda não confirmada
 * não tem id da Meta, e guardar o que se acabou de escrever é justamente um dos
 * casos de uso.
 */
export async function acaoFavoritarMensagem(
  clienteId: string,
  mensagemId: string,
  guardar: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  const { sessao } = await exigirAcessoAoCliente(clienteId)
  const usuarioId = sessao.usuario.id

  const id = mensagemId?.trim() ?? ''
  if (id === '') return { ok: false, erro: 'não deu para saber qual mensagem guardar' }

  const r = guardar
    ? await favoritar(usuarioId, clienteId, id)
    : await desfavoritar(usuarioId, id)

  if (r.ok) revalidarInbox(clienteId)
  return r
}

/**
 * As duas telas que mostram marcação.
 *
 * O Inbox porque é onde se marca, e a lista de favoritas porque ela é o acervo,
 * tirar a estrela de dentro da conversa e a lista continuar mostrando aquela
 * mensagem é o tipo de divergência que faz a pessoa clicar duas vezes.
 */
function revalidarInbox(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/inbox`)
  revalidatePath(`/clientes/${clienteId}/favoritas`)
}
