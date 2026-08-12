import type { Opcao } from '@/core/flow/schema'
import type { Canal } from './types'

export type Enviada =
  | { tipo: 'texto'; para: string; texto: string }
  | { tipo: 'opcoes'; para: string; texto: string; opcoes: Opcao[]; formato: 'botoes' | 'lista' }

/**
 * O canal que não envia nada — guarda o que enviaria.
 *
 * É o driver número um, não um brinquedo: com ele o produto inteiro foi
 * construído antes de existir qualquer credencial da Meta. Hoje ele serve aos
 * testes do webhook, que rodam sem tocar na rede.
 */
export function canalMock(): Canal & { enviadas: Enviada[] } {
  const enviadas: Enviada[] = []

  return {
    enviadas,
    async enviarTexto(para, texto) {
      enviadas.push({ tipo: 'texto', para, texto })
    },
    async enviarOpcoes(para, texto, opcoes, formato) {
      enviadas.push({ tipo: 'opcoes', para, texto, opcoes, formato })
    },
  }
}
