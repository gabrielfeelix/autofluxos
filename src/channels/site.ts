import { LIMITE_ATRASO_SEGUNDOS } from '@/core/flow/schema'
import type { Canal } from './types'

/**
 * O chat do site, o único canal em que entregar é não fazer nada.
 *
 * ---------------------------------------------------------------------------
 * Por que os envios não mandam nada para lugar nenhum
 * ---------------------------------------------------------------------------
 *
 * Nos outros canais a mensagem sai daqui para a Meta ou para o Telegram, e a
 * linha em `messages` é o registro do que foi mandado. No site é o contrário:
 * **a linha é a entrega.** Quem responde (o motor, a IA, a pessoa no Inbox)
 * grava a saída com `registrarSaida` antes de chamar o canal, com texto,
 * opções, produtos e mídia no `payload`, e o balão no navegador do visitante lê
 * essas linhas pela API pública (`/api/site/...`). Não existe fila nossa nem
 * conexão aberta para empurrar nada.
 *
 * Então cada envio devolve `null` e pronto: `null` é o que a interface já usa
 * para "canal sem id de mensagem que sirva em `wa_message_id`", e o
 * `confirmarEntrega` que vem depois marca a linha como entregue, que é
 * verdade: ela já está onde o visitante vai buscar.
 *
 * O que não existe aqui, e de propósito: `enviarTemplate` (não há janela para
 * atravessar), `reagir`, `marcarLida` e `baixarMidia`. Quem chama pergunta se
 * existe antes, como faz com o Telegram.
 *
 * ---------------------------------------------------------------------------
 * O "digitando" é do balão, não daqui
 * ---------------------------------------------------------------------------
 *
 * O balão mostra os três pontinhos sozinho entre a mensagem do visitante e a
 * primeira resposta. Guardar o estado aqui pediria uma escrita no banco a cada
 * 20 segundos de IA pensando, para dizer ao navegador o que ele já sabe. O
 * atraso desenhado no fluxo continua valendo: é a espera, e não o indicador,
 * que faz a conversa ter ritmo de gente.
 */
export function canalDoSite(): Canal {
  return {
    origem: 'site',
    async aguardarResposta(_alvo, atrasoMs) {
      const tetoMs = LIMITE_ATRASO_SEGUNDOS * 1_000
      const esperaMs = Math.min(Math.max(atrasoMs, 0), tetoMs)
      if (esperaMs > 0) await new Promise((resolver) => setTimeout(resolver, esperaMs))
    },
    async enviarTexto() {
      return null
    },
    async enviarOpcoes() {
      return null
    },
    async enviarMidia() {
      return null
    },
    // O balão desenha o card com foto, preço e botão: o `payload` já leva o
    // produto inteiro, e ter o método é o que faz o motor escolher o card em
    // vez do texto com link.
    async enviarProdutos() {
      return null
    },
  }
}
