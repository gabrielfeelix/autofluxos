import type { Opcao } from '@/core/flow/schema'
import type { ProdutoDaLoja } from '@/core/loja'
import type { Canal, EnvioDeTemplate, Midia, Template } from './types'

export type Enviada =
  | { tipo: 'espera'; mensagemId: string; atrasoMs: number }
  | { tipo: 'texto'; para: string; texto: string }
  | { tipo: 'opcoes'; para: string; texto: string; opcoes: Opcao[]; formato: 'botoes' | 'lista' }
  | ({ tipo: 'midia'; para: string } & Midia)
  | ({ tipo: 'template'; para: string } & Template)
  | { tipo: 'produtos'; para: string; produtos: ProdutoDaLoja[] }

/**
 * O canal que não envia nada, guarda o que enviaria.
 *
 * É o driver número um, não um brinquedo: com ele o produto inteiro foi
 * construído antes de existir qualquer credencial da Meta. Hoje ele serve aos
 * testes do webhook, que rodam sem tocar na rede.
 */
export function canalMock(): Canal & { enviadas: Enviada[] } {
  const enviadas: Enviada[] = []

  return {
    enviadas,
    async aguardarResposta({ mensagemId }, atrasoMs) {
      // O mock prova a ordem sem tornar a suíte três segundos mais lenta.
      enviadas.push({ tipo: 'espera', mensagemId, atrasoMs })
    },
    async enviarTexto(para, texto) {
      enviadas.push({ tipo: 'texto', para, texto })
      return null
    },
    async enviarOpcoes(para, texto, opcoes, formato) {
      enviadas.push({ tipo: 'opcoes', para, texto, opcoes, formato })
      return null
    },
    async enviarMidia(para, midia) {
      enviadas.push({ tipo: 'midia', para, ...midia })
      return null
    },
    async enviarProdutos(para, produtos) {
      enviadas.push({ tipo: 'produtos', para, produtos })
      return null
    },
    /**
     * O mock sempre aceita.
     *
     * `retida` não se simula aqui: quem precisa provar o caminho da mensagem
     * segurada testa `lerStatusDeEnvio()` direto, que é onde a regra mora. Um
     * mock que às vezes retém faria os testes do motor de disparo dependerem de
     * qual resposta ele resolveu dar.
     */
    async enviarTemplate(para, template): Promise<EnvioDeTemplate> {
      enviadas.push({ tipo: 'template', para, ...template })
      return { wamid: `mock-${enviadas.length}`, situacao: 'aceita' }
    },
  }
}
