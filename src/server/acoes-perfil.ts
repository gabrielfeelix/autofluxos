'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { autenticacao } from './auth'
import { db } from './db'
import { atualizarPerfil } from './repos/usuarios'
import { sessaoAtual } from './sessao'

/**
 * O perfil de quem está usando (tarefa 7.5, "Você" no rodapé).
 *
 * **Só a própria sessão.** Nenhuma ação aqui recebe id de usuário: o id sai de
 * `sessaoAtual()`, então não há o que a tela possa mandar para mexer em outra
 * pessoa. E não pede capacidade nenhuma: nome, foto e senha próprios valem
 * igual para proprietário, gestão, atendimento e suporte.
 */

const BUCKET_DOS_AVATARES = 'autofluxos-avatares'
const TIPOS_DE_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const TETO_DA_FOTO = 2 * 1024 * 1024

type Resultado = { ok: true; nome: string; imagem: string | null } | { ok: false; erro: string }

export async function acaoEditarPerfil(formData: FormData): Promise<Resultado> {
  const sessao = await sessaoAtual()
  if (!sessao) return { ok: false, erro: 'sua sessão expirou, entre de novo' }
  const usuarioId = sessao.usuario.id

  const nome = String(formData.get('nome') ?? '')
  let imagem: string | null | undefined

  const foto = formData.get('foto')
  if (foto instanceof File && foto.size > 0) {
    if (!TIPOS_DE_FOTO.includes(foto.type)) return { ok: false, erro: 'a foto precisa ser jpg, png ou webp' }
    if (foto.size > TETO_DA_FOTO) return { ok: false, erro: 'a foto passa de 2 MB' }
    if (nome.trim() === '') return { ok: false, erro: 'o nome não pode ficar vazio' }

    const extensao = foto.type === 'image/png' ? 'png' : foto.type === 'image/jpeg' ? 'jpg' : 'webp'
    const caminho = `${usuarioId}/${Date.now()}.${extensao}`
    const { error } = await db()
      .storage.from(BUCKET_DOS_AVATARES)
      .upload(caminho, foto, { contentType: foto.type, upsert: false })
    if (error) {
      console.error('[perfil] não deu para subir a foto:', error.message)
      return { ok: false, erro: 'não deu para guardar a foto agora, tente de novo' }
    }
    imagem = db().storage.from(BUCKET_DOS_AVATARES).getPublicUrl(caminho).data.publicUrl
  } else if (formData.get('tirarFoto') === '1') {
    imagem = null
  }

  const r = await atualizarPerfil(usuarioId, { nome, imagem })
  if (!r.ok) return { ok: false, erro: r.motivo }

  // A foto velha sai do bucket quando é trocada. Falhar aqui só deixa um
  // arquivo órfão, então não desfaz o que já foi salvo.
  if (imagem !== undefined && r.imagemAnterior) {
    const marca = `/${BUCKET_DOS_AVATARES}/`
    const i = r.imagemAnterior.indexOf(marca)
    if (i >= 0) {
      const velho = r.imagemAnterior.slice(i + marca.length)
      if (velho.startsWith(`${usuarioId}/`)) {
        await db().storage.from(BUCKET_DOS_AVATARES).remove([velho]).catch(() => {})
      }
    }
  }

  revalidatePath('/', 'layout')
  return {
    ok: true,
    nome: nome.trim(),
    imagem: imagem === undefined ? (sessao.usuario.imagem ?? null) : imagem,
  }
}

/**
 * Trocar a própria senha, pela troca do Better Auth: ele confere a atual e
 * guarda a nova com o mesmo hash do cadastro. Resolve o "acesso provisório"
 * de quem foi cadastrado com senha combinada por fora (7.4).
 */
export async function acaoTrocarSenha(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sessao = await sessaoAtual()
  if (!sessao) return { ok: false, erro: 'sua sessão expirou, entre de novo' }

  const atual = String(formData.get('atual') ?? '')
  const nova = String(formData.get('nova') ?? '')
  if (atual === '') return { ok: false, erro: 'escreva a senha atual' }
  if (nova.length < 10) return { ok: false, erro: 'a senha nova precisa de pelo menos 10 caracteres' }
  if (nova === atual) return { ok: false, erro: 'a senha nova é igual à atual' }

  try {
    await autenticacao().api.changePassword({
      body: { currentPassword: atual, newPassword: nova, revokeOtherSessions: false },
      headers: await headers(),
    })
    return { ok: true }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    if (/invalid password|incorrect/i.test(mensagem)) {
      return { ok: false, erro: 'a senha atual não confere' }
    }
    console.error('[perfil] troca de senha falhou:', mensagem)
    return { ok: false, erro: 'não deu para trocar a senha agora, tente de novo' }
  }
}
