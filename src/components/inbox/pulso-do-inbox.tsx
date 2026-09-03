'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { precisaAtualizar } from './pulso'

const respostaSchema = z.object({ pulso: z.string().nullable() })

/**
 * O intervalo do plano B.
 *
 * Cinco segundos era o caminho principal e virou rede de segurança: só roda
 * quando o stream não está de pé. Perto o bastante de "instantâneo" para não
 * deixar ninguém perdido, e uma consulta de uma linha só.
 */
const INTERVALO = 5_000

/**
 * Quanto tempo sem nenhum sinal do stream antes de considerar que ele morreu.
 *
 * O servidor manda uma batida a cada 15s e encerra de propósito aos 50s. 40
 * segundos de silêncio significam que nem batida está chegando — conexão presa
 * num proxy, rede caída, aba que o navegador congelou. Aí o polling assume, e
 * a tela continua andando.
 */
const SILENCIO_ATE_DESISTIR = 40_000

/**
 * Quantos `router.refresh()` sem efeito antes de apelar para o reload.
 *
 * Três é folga suficiente para um refresh lento (o servidor remonta a lista, o
 * histórico e a barra lateral) sem deixar ninguém mais de quinze segundos
 * olhando para uma tela que já não é verdade.
 */
const TENTATIVAS_ATE_RECARREGAR = 3

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
 * ---------------------------------------------------------------------------
 * Do relógio para o empurrão
 * ---------------------------------------------------------------------------
 *
 * A primeira versão perguntava `/pulso` de cinco em cinco segundos. Funcionava
 * e era barata, e mesmo assim errada para quem atende: cinco segundos entre a
 * pessoa mandar a mensagem e ela aparecer é tempo suficiente para o cliente
 * mandar a segunda perguntando se tem alguém aí.
 *
 * Agora quem avisa é o servidor, por `EventSource` (`/inbox/stream`). O
 * servidor olha o banco de segundo em segundo e só escreve na conexão quando o
 * carimbo muda — o navegador não pergunta nada e recebe o empurrão.
 *
 * **Não é WebSocket no Supabase Realtime, e a rota explica por quê** — em
 * resumo: a chave que assina o JWT do projeto é ES256 e a metade privada mora
 * dentro do Supabase, então não dá para emitir token de canal privado; canal
 * público entregaria a qualquer um que soubesse o uuid do cliente *quando*
 * aquele negócio recebe mensagem. Ver o cabeçalho de
 * `app/api/clientes/[clienteId]/inbox/stream/route.ts`.
 *
 * ---------------------------------------------------------------------------
 * O plano B não é enfeite
 * ---------------------------------------------------------------------------
 *
 * SSE atravessa proxy corporativo, extensão de navegador e rede de operadora,
 * e qualquer um dos três pode segurar a conexão sem fechá-la. O sintoma seria o
 * pior possível: tela parada, sem erro nenhum, exatamente o defeito que este
 * componente existe para consertar. Por isso o polling continua aqui, ligado
 * pelo silêncio — se o stream parar de dar sinal, ele assume sozinho.
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
   * Quantas vezes seguidas pedimos refresh sem a tela alcançar o banco.
   *
   * `router.refresh()` é a forma boa de atualizar — mantém o que está digitado
   * na caixa de resposta, o scroll e o foco. Mas quando ele não resolve, ficar
   * repetindo em silêncio deixa quem atende olhando para uma conversa
   * congelada, que é o pior resultado possível.
   *
   * Depois de `TENTATIVAS_ATE_RECARREGAR`, recarrega a página. É o martelo, e
   * por isso vem só no fim: perde o rascunho da resposta, mas mostra a verdade.
   */
  const tentativas = useRef(0)

  useEffect(() => {
    let ativo = true
    /** Instante do último sinal do stream — batida ou evento. */
    let ultimoSinal = Date.now()

    /**
     * O que fazer com um carimbo, venha ele do stream ou do polling.
     *
     * Um lugar só de propósito: a regra de "a tela está velha?" e a escada até
     * o reload não podem existir em duas versões que discordem entre si.
     */
    function reagir(pulso: string | null) {
      if (!ativo) return

      if (!precisaAtualizar({ doBanco: pulso, naTela: pulsoNaTela })) {
        tentativas.current = 0
        return
      }

      tentativas.current += 1
      if (tentativas.current >= TENTATIVAS_ATE_RECARREGAR) {
        window.location.reload()
        return
      }

      router.refresh()
    }

    // ---------------------------------------------------------------- stream

    let fonte: EventSource | null = null

    function abrirStream() {
      if (!ativo || fonte) return
      try {
        fonte = new EventSource(`/api/clientes/${clienteId}/inbox/stream`)
      } catch {
        // Navegador sem `EventSource`. O plano B cobre.
        return
      }

      fonte.onmessage = (evento) => {
        ultimoSinal = Date.now()
        const dados = respostaSchema.safeParse(JSON.parse(evento.data as string))
        if (dados.success) reagir(dados.data.pulso)
      }

      /*
       * `onerror` do `EventSource` também dispara na reconexão normal — a que
       * acontece toda vez que o servidor encerra de propósito aos 50s. Fechar
       * aqui seria trocar a reconexão automática por nenhuma. Quem decide que o
       * stream morreu é o silêncio, medido no polling abaixo.
       */
      fonte.onerror = () => {}

      // Uma conexão que abre já é sinal de vida: sem isto, uma reconexão logo
      // depois de uma aba voltar do congelamento contaria como silêncio antigo.
      fonte.onopen = () => {
        ultimoSinal = Date.now()
      }
    }

    function fecharStream() {
      fonte?.close()
      fonte = null
    }

    // ---------------------------------------------------------------- plano B

    async function conferirPorConta() {
      /*
       * Aba escondida não recebe atualização.
       *
       * O navegador já estrangula timers em segundo plano, e insistir gastaria
       * consulta para desenhar o que ninguém está vendo. Quando a aba volta, o
       * `visibilitychange` abaixo confere na hora — que é o momento em que a
       * pessoa realmente quer ver o que perdeu.
       */
      if (document.visibilityState !== 'visible') return

      // O stream está entregando. Não há o que perguntar.
      if (Date.now() - ultimoSinal < SILENCIO_ATE_DESISTIR) return

      try {
        const resposta = await fetch(`/api/clientes/${clienteId}/inbox/pulso`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (!resposta.ok || !ativo) return

        const dados = respostaSchema.safeParse(await resposta.json())
        if (!dados.success || !ativo) return

        reagir(dados.data.pulso)
      } catch {
        // Igual antes: isto é conveniência. Uma oscilação de rede não pode
        // virar erro na cara de quem está atendendo — na próxima volta o pulso
        // é lido de novo e a tela se acerta sozinha.
      }
    }

    abrirStream()

    const intervalo = window.setInterval(() => void conferirPorConta(), INTERVALO)

    /*
     * Aba escondida: fecha o stream em vez de deixá-lo aberto.
     *
     * Uma conexão aberta é uma função de servidor viva do outro lado. Manter
     * dez abas esquecidas segurando dez funções para desenhar o que ninguém
     * está olhando é o custo que o polling de cinco segundos não tinha, e é o
     * único jeito de o stream sair mais caro que a versão antiga.
     */
    const aoTrocarDeVisibilidade = () => {
      if (document.visibilityState === 'visible') {
        abrirStream()
        void conferirPorConta()
      } else {
        fecharStream()
        // A aba escondida não recebe batida; sem zerar isto, ao voltar o
        // silêncio acumulado dispararia um polling desnecessário na hora.
        ultimoSinal = Date.now()
      }
    }
    document.addEventListener('visibilitychange', aoTrocarDeVisibilidade)

    return () => {
      ativo = false
      fecharStream()
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoTrocarDeVisibilidade)
    }
  }, [clienteId, router, pulsoNaTela])

  // Não desenha nada: o efeito é a tela inteira ficando em dia.
  return null
}
