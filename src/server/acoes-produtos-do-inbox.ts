'use server'

import { revalidatePath } from 'next/cache'
import { dentroDaJanela } from '@/channels/janela'
import { autorDaPessoa } from '@/core/autor-da-mensagem'
import { textoDoCard, type ProdutoDaLoja } from '@/core/loja'
import { lojaAtivaDaConta } from './adaptador-da-loja'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { podeResponderAgora } from './distribuir-atendimento'
import { confirmarEntrega, contextoDeResposta, definirStatusDaSessao, registrarSaida } from './repos/conversas'
import { exigirAcessoAoCliente, sessaoAtual } from './sessao'

/**
 * Produtos no Inbox: quem atende busca por nome ou SKU e manda o card.
 *
 * A busca é a **mesma** do bot (`lojaAtivaDaConta`): Magento ao vivo quando
 * ligada, senão o catálogo da conta. Duas buscas diferentes dariam à equipe e
 * ao bot respostas diferentes para a mesma pergunta do cliente.
 *
 * O envio segue `acoes-midia-do-inbox.ts` em tudo que não é o produto: a trava
 * de quem está atendendo, a janela de 24h, gravar antes de enviar, o id da
 * Meta na confirmação e a conversa passando para humano.
 */

export type RespostaDaBusca =
  | { ok: true; produtos: ProdutoDaLoja[]; temMais: boolean }
  | { ok: false; erro: string; semCatalogo?: true }

const POR_PAGINA_NO_SELETOR = 20

export async function acaoBuscarProdutosDoInbox(
  clienteId: string,
  termo: string,
  pagina = 1,
): Promise<RespostaDaBusca> {
  await exigirAcessoAoCliente(clienteId)

  const loja = await lojaAtivaDaConta(clienteId)
  if (!loja) {
    return { ok: false, semCatalogo: true, erro: 'esta conta ainda não tem catálogo nem loja ligada' }
  }
  // Páginas de 20, com foto: aqui quem escolhe é uma pessoa rolando a lista, e
  // a foto é o que diz se o card sai com imagem. O bot fica nos 5 de sempre.
  const r = await loja.buscar(termo.slice(0, 80), { pagina, porPagina: POR_PAGINA_NO_SELETOR, comFoto: true })
  if (!r.ok) return { ok: false, erro: r.motivo }
  return { ok: true, produtos: r.valor, temMais: r.valor.length === POR_PAGINA_NO_SELETOR }
}

export async function acaoEnviarProdutoDoInbox(
  clienteId: string,
  contatoId: string,
  produtoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirAcessoAoCliente(clienteId)

  const trava = await podeResponderAgora(clienteId, contatoId, acesso.sessao.usuario.id)
  if (!trava.ok) return trava

  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return { ok: false, erro: 'este lead não tem um número conectado para responder' }
  if (!dentroDaJanela(contexto)) {
    return {
      ok: false,
      erro: contexto.ultimaEntradaEm
        ? 'passaram mais de 24h desde a última mensagem dela, e o WhatsApp só deixa retomar por um modelo aprovado'
        : 'esta pessoa nunca escreveu, e o WhatsApp não deixa começar a conversa assim',
    }
  }

  const loja = await lojaAtivaDaConta(clienteId)
  if (!loja) return { ok: false, erro: 'esta conta ainda não tem catálogo nem loja ligada' }

  // Relê em vez de confiar no que a tela mostrou: o card é a última palavra
  // sobre o preço, e ela tem que ser a de agora (e com a foto, que a busca
  // da Magento não traz).
  const lido = await loja.lerPorSku([produtoId])
  if (!lido.ok) return { ok: false, erro: lido.motivo }
  const produto = lido.valor[0]
  if (!produto) return { ok: false, erro: 'esse produto não está mais no catálogo' }

  let canal
  try {
    canal = await adaptadorDoCanal(contexto.canal)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) }
  }

  // Card só com foto, link e canal que saiba mostrar; o resto vai como texto
  // com o link, igual ao bot (`receber-mensagem.ts`, `enviar_produtos`).
  const enviarCard = produto.foto && produto.link ? canal.enviarProdutos?.bind(canal) : undefined
  const texto = textoDoCard(produto)

  const quemResponde = await sessaoAtual()
  const registro = await registrarSaida({
    contatoId,
    sessaoId: contexto.sessaoId,
    texto,
    payload: { produtos: [produto] },
    autor: autorDaPessoa(quemResponde?.usuario),
  })

  let waMessageId: string | null
  try {
    waMessageId = enviarCard
      ? await enviarCard(contexto.waId, [produto])
      : await canal.enviarTexto(contexto.waId, texto)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para enviar' }
  }

  await confirmarEntrega(registro, waMessageId)
  if (contexto.sessaoId) await definirStatusDaSessao(contexto.sessaoId, 'humano')

  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return { ok: true }
}
