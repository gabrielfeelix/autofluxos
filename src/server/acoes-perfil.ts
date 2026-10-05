'use server'

import { PREFIXO_DO_AVATAR, SEMENTES_DA_GALERIA } from '@/lib/retrato'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import QRCode from 'qrcode'
import { autenticacao, ehSenhaVazada, SENHA_VAZADA } from './auth'
import { db } from './db'
import { registrar } from './repos/auditoria'
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
  /*
   * Entrando como outra pessoa (suporte), o id da sessão é o dela: trocar o
   * nome e a foto de alguém que não pediu, sem registro, não é suporte.
   */
  if (sessao.impersonadoPor) {
    return { ok: false, erro: 'entrando como outra pessoa, o perfil dela não pode ser editado' }
  }
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
  } else if (formData.get('avatar')) {
    // Só as sementes da galeria: o campo vira `src` de imagem em toda tela, e
    // texto livre aqui seria um endereço qualquer escolhido por quem pede.
    const semente = String(formData.get('avatar'))
    if (!(SEMENTES_DA_GALERIA as readonly string[]).includes(semente)) {
      return { ok: false, erro: 'esse avatar não existe' }
    }
    imagem = `${PREFIXO_DO_AVATAR}${semente}`
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
    /*
     * `revokeOtherSessions: true`: quem troca a senha quase sempre desconfia
     * de alguma coisa, e trocar a senha sem derrubar as outras sessões deixa
     * um cookie roubado vivo por até 7 dias depois da troca. A sessão deste
     * navegador continua; as dos outros aparelhos pedem login de novo.
     */
    await autenticacao().api.changePassword({
      body: { currentPassword: atual, newPassword: nova, revokeOtherSessions: true },
      headers: await headers(),
    })
    return { ok: true }
  } catch (erro) {
    if (ehSenhaVazada(erro)) return { ok: false, erro: SENHA_VAZADA }
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    if (/invalid password|incorrect/i.test(mensagem)) {
      return { ok: false, erro: 'a senha atual não confere' }
    }
    console.error('[perfil] troca de senha falhou:', mensagem)
    return { ok: false, erro: 'não deu para trocar a senha agora, tente de novo' }
  }
}

/**
 * Verificação em duas etapas, passo 1: confere a senha e devolve o QR.
 *
 * A biblioteca grava o segredo já nesta hora, mas só liga o 2FA quando o
 * primeiro código do aplicativo confere (`acaoConfirmarDuasEtapas`). Quem
 * desiste no meio continua entrando só com a senha, como antes.
 */
export async function acaoComecarDuasEtapas(
  senha: string,
): Promise<{ ok: true; qr: string; chave: string; codigos: string[] } | { ok: false; erro: string }> {
  const sessao = await sessaoAtual()
  if (!sessao) return { ok: false, erro: 'sua sessão expirou, entre de novo' }
  if (sessao.impersonadoPor) return { ok: false, erro: 'isto só a própria pessoa liga, não o suporte' }

  try {
    const r = await autenticacao().api.enableTwoFactor({ body: { password: senha }, headers: await headers() })
    if (r.method !== 'totp') return { ok: false, erro: 'não deu para começar agora, tente de novo' }
    const chave = new URL(r.totpURI).searchParams.get('secret') ?? ''
    const qr = await QRCode.toDataURL(r.totpURI, { margin: 1, width: 220 })
    return { ok: true, qr, chave, codigos: r.backupCodes }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    if (/invalid password|incorrect/i.test(mensagem)) return { ok: false, erro: 'a senha não confere' }
    console.error('[perfil] 2FA não começou:', mensagem)
    return { ok: false, erro: 'não deu para começar agora, tente de novo' }
  }
}

/** Passo 2: o primeiro código do aplicativo liga o 2FA de verdade. */
export async function acaoConfirmarDuasEtapas(codigo: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sessao = await sessaoAtual()
  if (!sessao) return { ok: false, erro: 'sua sessão expirou, entre de novo' }
  if (sessao.impersonadoPor) return { ok: false, erro: 'isto só a própria pessoa liga, não o suporte' }

  const limpo = codigo.replace(/\s/g, '')
  if (!/^\d{6}$/.test(limpo)) return { ok: false, erro: 'são 6 números, do aplicativo' }
  try {
    await autenticacao().api.verifyTOTP({ body: { code: limpo }, headers: await headers() })
  } catch {
    return { ok: false, erro: 'código não confere; confira se o relógio do celular está certo' }
  }
  await registrar({ acao: 'ligou_duas_etapas', autorId: sessao.usuario.id, autorEmail: sessao.usuario.email, alvoTipo: 'usuario', alvoId: sessao.usuario.id })
  return { ok: true }
}

/** Desliga, com a senha. O admin da plataforma perde a administração até ligar de novo. */
export async function acaoDesligarDuasEtapas(senha: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sessao = await sessaoAtual()
  if (!sessao) return { ok: false, erro: 'sua sessão expirou, entre de novo' }
  if (sessao.impersonadoPor) return { ok: false, erro: 'isto só a própria pessoa desliga, não o suporte' }

  try {
    await autenticacao().api.disableTwoFactor({ body: { password: senha }, headers: await headers() })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    if (/invalid password|incorrect/i.test(mensagem)) return { ok: false, erro: 'a senha não confere' }
    return { ok: false, erro: 'não deu para desligar agora, tente de novo' }
  }
  await registrar({ acao: 'desligou_duas_etapas', autorId: sessao.usuario.id, autorEmail: sessao.usuario.email, alvoTipo: 'usuario', alvoId: sessao.usuario.id })
  return { ok: true }
}
