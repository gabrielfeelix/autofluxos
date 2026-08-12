'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  COOKIE_PAINEL,
  DURACAO_SESSAO_SEGUNDOS,
  iguais,
  tokenDaSenha,
} from '@/lib/painel-auth'

export type EstadoLogin = { erro?: string }

export async function acaoEntrar(
  _estado: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const configurada = process.env.PAINEL_SENHA
  if (!configurada) {
    return { erro: 'O acesso do painel ainda não foi configurado neste ambiente.' }
  }

  const informada = formData.get('senha')
  if (typeof informada !== 'string' || !iguais(informada, configurada)) {
    return { erro: 'Credenciais não conferem. Verifique e tente de novo.' }
  }

  const [cookieStore, cabecalhos] = await Promise.all([cookies(), headers()])
  const conexaoSegura = cabecalhos.get('x-forwarded-proto') === 'https' || process.env.VERCEL === '1'
  cookieStore.set(COOKIE_PAINEL, await tokenDaSenha(configurada), {
    httpOnly: true,
    secure: conexaoSegura,
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_SESSAO_SEGUNDOS,
    priority: 'high',
  })

  redirect('/')
}

export async function acaoSair() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_PAINEL)
  redirect('/login')
}
