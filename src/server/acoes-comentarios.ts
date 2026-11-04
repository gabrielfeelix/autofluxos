'use server'

import { revalidatePath } from 'next/cache'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import { LIMITES_DO_COMENTARIO, lerPalavras } from '@/core/comentarios'
import { type PostDoInstagram, postsRecentes } from './instagram/comentarios'
import { exigirCapacidade, recusou } from './permissoes'
import { listarCanais, lerTokenDoCanal } from './repos/conversas'
import {
  alternarRespostaAComentario,
  apagarRespostaAComentario,
  criarRespostaAComentario,
} from './repos/respostas-a-comentarios'

/**
 * As ações da aba Comentários (Automações → Gatilhos → Comentários).
 *
 * Mesma permissão das palavras-chave: quem configura a operação.
 */

export async function acaoCriarRespostaAComentario(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const texto = (nome: string) => String(formData.get(nome) ?? '').trim()
  const canalId = texto('canalId')
  const mensagem = texto('mensagem')
  const respostaPublica = texto('respostaPublica')
  const palavras = lerPalavras(texto('palavras'))
  const qualquer = texto('quando') === 'qualquer'

  if (canalId === '') return { erro: 'Conecte uma conta do Instagram antes.' }
  if (!qualquer && palavras.length === 0) {
    return { erro: 'Escreva ao menos uma palavra, ou escolha responder qualquer comentário.' }
  }
  if (palavras.length > LIMITES_DO_COMENTARIO.palavras) {
    return { erro: `Use até ${LIMITES_DO_COMENTARIO.palavras} palavras por regra.` }
  }
  if (mensagem === '') return { erro: 'Escreva a mensagem que vai no direct.' }
  if (mensagem.length > LIMITES_DO_COMENTARIO.mensagem) {
    return { erro: `A mensagem do direct passa de ${LIMITES_DO_COMENTARIO.mensagem} caracteres.` }
  }
  if (respostaPublica.length > LIMITES_DO_COMENTARIO.respostaPublica) {
    return { erro: `A resposta no comentário passa de ${LIMITES_DO_COMENTARIO.respostaPublica} caracteres.` }
  }

  // O post chega como JSON do seletor. Só id, legenda, imagem e link são lidos.
  let post: { id: string; legenda: string | null; imagem: string | null; link: string | null } | null = null
  const postBruto = texto('post')
  if (postBruto !== '') {
    try {
      const lido = JSON.parse(postBruto) as Partial<PostDoInstagram>
      if (typeof lido.id === 'string' && /^\d{5,30}$/.test(lido.id)) {
        const textoOuNulo = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)
        const link = textoOuNulo(lido.link)
        const imagem = textoOuNulo(lido.imagem)
        post = {
          id: lido.id,
          legenda: textoOuNulo(lido.legenda),
          imagem: imagem?.startsWith('https://') ? imagem : null,
          link: link?.startsWith('https://') ? link : null,
        }
      }
    } catch {
      return { erro: 'Não foi possível ler o post escolhido. Escolha de novo.' }
    }
    if (!post) return { erro: 'Não foi possível ler o post escolhido. Escolha de novo.' }
  }

  const r = await criarRespostaAComentario(clienteId, {
    canalId,
    palavras: qualquer ? [] : palavras,
    post,
    mensagem,
    respostaPublica: respostaPublica === '' ? null : respostaPublica,
  })
  if (!r.ok) return { erro: r.motivo }

  revalidatePath(`/clientes/${clienteId}/fluxos`)
  return { ok: true }
}

export async function acaoAlternarRespostaAComentario(
  clienteId: string,
  respostaId: string,
  ativo: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const mudou = await alternarRespostaAComentario(clienteId, respostaId, ativo)
  return mudou ? { ok: true } : { ok: false, erro: 'esta resposta não existe mais' }
}

export async function acaoApagarRespostaAComentario(
  clienteId: string,
  respostaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const apagou = await apagarRespostaAComentario(clienteId, respostaId)
  revalidatePath(`/clientes/${clienteId}/fluxos`)
  return apagou ? { ok: true } : { ok: false, erro: 'esta resposta não existe mais' }
}

/**
 * Os posts recentes da conta, para o seletor do formulário.
 *
 * Chamado quando o modal abre, e não com a página: a lista vem da Meta, leva um
 * segundo, e quem só olha as regras não precisa esperar por ela.
 */
export async function acaoPostsDoInstagram(
  clienteId: string,
  canalId: string,
): Promise<{ ok: true; posts: PostDoInstagram[] } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem permissão' }

  const canal = (await listarCanais(clienteId)).find((c) => c.id === canalId && c.provider === 'instagram')
  if (!canal || !canal.igUserId) return { ok: false, erro: 'Esta conta do Instagram não está mais ligada.' }

  try {
    const posts = await postsRecentes({ igUserId: canal.igUserId, token: await lerTokenDoCanal(canal) })
    return { ok: true, posts }
  } catch (erro) {
    console.warn('[instagram] não foi possível listar os posts', erro)
    return { ok: false, erro: 'Não foi possível buscar os posts agora. Você ainda pode usar todos os posts.' }
  }
}
