'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { precisaAtualizar } from './pulso'

const respostaSchema = z.object({ pulso: z.string().nullable() })

/**
 * Cinco segundos: perto o bastante de "instantâneo" para quem atende, e uma
 * consulta de uma linha só — mais barata que quase todo clique na tela.
 */
const INTERVALO = 5_000

/**
 * O Inbox se atualizando sozinho quando chega mensagem.
 *
 * ---------------------------------------------------------------------------
 * O que estava errado
 * ---------------------------------------------------------------------------
 *
 * O Inbox é Server Component: ele desenha o que era verdade no instante em que
 * a página carregou, e depois nada. Uma mensagem chegava pelo webhook, entrava
 * no banco, e a tela de quem estava atendendo continuava mostrando a conversa
 * de dez minutos atrás — até alguém apertar F5.
 *
 * O aviso sonoro (`NotificacoesDaFila`) já existia e piorava a impressão: a
 * pessoa era avisada de que algo chegou numa tela que não mostrava o que era.
 * E ele só enxerga a **fila de handoff** — mensagem numa conversa que o bot
 * está conduzindo não passa por lá, que é o caso mais comum.
 *
 * ---------------------------------------------------------------------------
 * Perguntar barato, recarregar caro
 * ---------------------------------------------------------------------------
 *
 * `/pulso` devolve **um carimbo de data**. Só quando ele muda é que vem o
 * `router.refresh()`, que remonta a lista de conversas, o histórico e a barra
 * lateral no servidor.
 *
 * Um `refresh` cego a cada cinco segundos custaria isso tudo o tempo inteiro
 * para, quase sempre, redesenhar exatamente a mesma tela.
 *
 * `router.refresh()` e não `location.reload()`: ele troca os dados mantendo o
 * estado do React — o que está escrito na caixa de resposta, o scroll, o foco.
 * Um reload jogaria fora a mensagem que alguém estava digitando.
 */
export function PulsoDoInbox({
  clienteId,
  pulsoNaTela,
}: {
  clienteId: string
  /**
   * O pulso no instante em que o servidor desenhou esta página.
   *
   * **Vem de fora, e não de um `useRef`, e isso é o conserto de um bug real.**
   * Na primeira versão o componente guardava a última leitura em si mesmo — e
   * `router.refresh()` remonta a árvore, o que zerava essa memória. Toda
   * leitura virava "linha de base", nenhuma comparação acontecia, e o Inbox
   * seguia parado: exatamente o defeito que este componente existe para
   * consertar.
   *
   * Comparar contra uma prop tira a dúvida: ela é, por definição, o estado da
   * tela que está à vista. Se o banco tem um carimbo diferente, a tela está
   * velha — não importa quantas vezes o React remontou nada.
   */
  pulsoNaTela: string | null
}) {
  const router = useRouter()
  /*
   * Guarda o que já mandou atualizar, para não pedir duas vezes o mesmo
   * refresh enquanto o servidor ainda não respondeu com a tela nova.
   */
  const pedido = useRef<string | null>(null)

  useEffect(() => {
    let ativo = true

    async function conferir() {
      /*
       * Aba escondida não recebe atualização.
       *
       * O navegador já estrangula timers em segundo plano, e insistir gastaria
       * consulta para desenhar o que ninguém está vendo. Quando a aba volta, o
       * `visibilitychange` abaixo confere na hora — que é o momento em que a
       * pessoa realmente quer ver o que perdeu.
       */
      if (document.visibilityState !== 'visible') return

      try {
        const resposta = await fetch(`/api/clientes/${clienteId}/inbox/pulso`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (!resposta.ok || !ativo) return

        const dados = respostaSchema.safeParse(await resposta.json())
        if (!dados.success || !ativo) return

        const agora = dados.data.pulso
        if (!precisaAtualizar({ doBanco: agora, naTela: pulsoNaTela, jaPedido: pedido.current })) {
          return
        }

        pedido.current = agora
        router.refresh()
      } catch {
        // Igual ao polling de alertas: isto é conveniência. Uma oscilação de
        // rede não pode virar erro na cara de quem está atendendo — na próxima
        // volta o pulso é lido de novo e a tela se acerta sozinha.
      }
    }

    /*
     * Uma conferência na entrada, e não só depois do primeiro intervalo.
     *
     * Entre o servidor desenhar a página e o navegador montar isto já passou
     * tempo — e é justamente aí que chega a mensagem que a pessoa está
     * esperando. Sem esta linha, ela demoraria os 5 segundos inteiros.
     */
    void conferir()

    const intervalo = window.setInterval(() => void conferir(), INTERVALO)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void conferir()
    }
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      ativo = false
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [clienteId, router, pulsoNaTela])

  // Não desenha nada: o efeito é a tela inteira ficando em dia.
  return null
}
