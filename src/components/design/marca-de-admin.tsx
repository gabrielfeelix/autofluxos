'use client'

import { useEffect } from 'react'
import { MARCA_DE_ADMIN } from './tema'

/**
 * Grava no navegador se quem está aqui é administrador da plataforma.
 *
 * Roda na moldura do cliente, que é por onde toda tela da conta passa, e existe
 * por causa da tela de carregamento: ela desenha a barra lateral inteira sem
 * ter sessão para consultar. Sem esta marca, o "‹ Administração" sumia
 * enquanto a próxima aba vinha e voltava quando ela chegava, e a barra subia e
 * descia junto a cada troca.
 *
 * Escreve sempre, inclusive `nao`: quem sai de uma conta de administrador para
 * uma comum precisa que a marca antiga saia com ela, ou passa a ver um espaço
 * reservado para um link que não é dela.
 */
export function MarcaDeAdmin({ admin }: { admin: boolean }) {
  useEffect(() => {
    const raiz = document.documentElement
    if (admin) raiz.setAttribute(MARCA_DE_ADMIN.atributo, MARCA_DE_ADMIN.quandoVale)
    else raiz.removeAttribute(MARCA_DE_ADMIN.atributo)
    try {
      localStorage.setItem(MARCA_DE_ADMIN.chave, admin ? MARCA_DE_ADMIN.quandoVale : 'nao')
    } catch {
      // Sem onde gravar, a barra volta a piscar nesta aba. É o defeito antigo,
      // e não é motivo para derrubar a tela.
    }
  }, [admin])

  return null
}
