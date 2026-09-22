'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { precisaAtualizar } from './pulso'
import { DEU_CONTA, ESPERA_PELA_CONVERSA_MS, pedirNovas } from './sinal-de-conversa'

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
 * segundos de silêncio significam que nem batida está chegando, conexão presa
 * num proxy, rede caída, aba que o navegador congelou. Aí o polling assume, e
 * a tela continua andando.
 */
const SILENCIO_ATE_DESISTIR = 40_000

/**
 * O intervalo mínimo entre dois redesenhos da página.
 *
 * Redesenhar continua existindo, mas só para o que **não** é a conversa aberta:
 * a fila da esquerda, as contagens, a insígnia de não lidas. Numa conta
 * movimentada, cinco mensagens em cinco segundos pediriam cinco páginas
 * inteiras ao servidor para desenhar praticamente a mesma fila. Uma a cada
 * quatro segundos mantém a lista viva sem transformar movimento em pisca-pisca.
 */
const ESPERA_ENTRE_REDESENHOS_MS = 4_000

/**
 * De quanto em quanto tempo a fila da esquerda se acerta quando a conversa
 * aberta está dando conta sozinha.
 *
 * Meio minuto: quem está numa conversa longa olha para as bolhas, não para a
 * linha da fila, e a linha só precisa não estar mentindo quando o olho voltar
 * para ela. Mais curto que isso é pagar página inteira por mensagem de novo,
 * que é exatamente o defeito que esta versão desfaz.
 */
const REDESENHO_PREGUICOSO_MS = 30_000

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
 * de dez minutos atrás, até alguém apertar F5.
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
 * carimbo muda, o navegador não pergunta nada e recebe o empurrão.
 *
 * **Não é WebSocket no Supabase Realtime, e a rota explica por quê**, em
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
 * pelo silêncio, se o stream parar de dar sinal, ele assume sozinho.
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
   * Na primeira versão o componente guardava a última leitura em si mesmo, e
   * `router.refresh()` remonta a árvore, o que zerava essa memória. Toda
   * leitura virava "linha de base", nenhuma comparação acontecia, e o Inbox
   * seguia parado: exatamente o defeito que este componente existe para
   * consertar.
   *
   * Comparar contra uma prop tira a dúvida: ela é, por definição, o estado da
   * tela que está à vista. Se o banco tem um carimbo diferente, a tela está
   * velha, não importa quantas vezes o React remontou nada.
   */
  pulsoNaTela: string | null
}) {
  const router = useRouter()
  /** Quando a página foi redesenhada pela última vez, para não repetir à toa. */
  const ultimoRedesenho = useRef(0)

  useEffect(() => {
    let ativo = true
    /** Instante do último sinal do stream, batida ou evento. */
    let ultimoSinal = Date.now()
    /** O redesenho marcado, que a conversa aberta ainda pode cancelar. */
    let redesenhoMarcado: number | null = null
    /** O redesenho sem pressa, só para a fila da esquerda não mentir por horas. */
    let preguicoso: number | null = null

    /*
     * A conversa aberta avisando que já mostrou o que chegou.
     *
     * É o que faz a mensagem da conversa à vista **não** custar uma página
     * inteira: a bolha já está na tela, e redesenhar só repetiria o que se
     * está vendo. Mensagem de outra conversa nunca produz este aviso, e aí o
     * redesenho marcado acontece e a fila da esquerda se atualiza.
     */
    const aoDarConta = () => {
      if (redesenhoMarcado !== null) {
        window.clearTimeout(redesenhoMarcado)
        redesenhoMarcado = null
      }

      /*
       * A fila da esquerda ainda precisa saber, só que **sem pressa**.
       *
       * A bolha já apareceu na conversa; o que falta é a linha da fila mostrar
       * a última frase e a ordem certa. Isso não vale uma página inteira por
       * mensagem numa conversa em andamento, e vale um redesenho de vez em
       * quando, senão a fila mente por horas em quem atende o dia todo na mesma
       * conversa.
       */
      if (preguicoso === null) {
        preguicoso = window.setTimeout(() => {
          preguicoso = null
          redesenhar()
        }, REDESENHO_PREGUICOSO_MS)
      }
    }
    window.addEventListener(DEU_CONTA, aoDarConta)

    /** O redesenho da página, no máximo um a cada `ESPERA_ENTRE_REDESENHOS_MS`. */
    function redesenhar() {
      if (!ativo) return
      const desde = Date.now() - ultimoRedesenho.current
      if (desde < ESPERA_ENTRE_REDESENHOS_MS) {
        // Ainda dentro da janela: remarca para o fim dela em vez de desistir,
        // senão a última mensagem de uma rajada nunca chegaria à fila.
        redesenhoMarcado = window.setTimeout(redesenhar, ESPERA_ENTRE_REDESENHOS_MS - desde)
        return
      }
      ultimoRedesenho.current = Date.now()
      redesenhoMarcado = null
      router.refresh()
    }

    /**
     * O que fazer com um carimbo, venha ele do stream ou do polling.
     *
     * ------------------------------------------------------------------------
     * Duas coisas acontecem, nesta ordem, e a ordem é o conserto
     * ------------------------------------------------------------------------
     *
     * Antes, "mudou alguma coisa na conta" virava `router.refresh()` direto: a
     * página inteira no servidor, a cada mensagem, recebida ou enviada. Era o
     * F5 automático que se via na tela.
     *
     * Agora o aviso vai primeiro para a **conversa aberta** (`pedirNovas`), que
     * busca só as mensagens novas e acrescenta as bolhas. Se ela responder que
     * deu conta, nada mais acontece. Só o silêncio dela, a mensagem era de
     * outra conversa, é que paga o preço de redesenhar a fila.
     */
    function reagir(pulso: string | null) {
      if (!ativo) return
      if (!precisaAtualizar({ doBanco: pulso, naTela: pulsoNaTela })) return

      pedirNovas(pulso)

      // Um só por vez: duas mensagens seguidas marcariam dois redesenhos, e o
      // "deu conta" da conversa só cancelaria um deles.
      if (redesenhoMarcado !== null) return
      redesenhoMarcado = window.setTimeout(redesenhar, ESPERA_PELA_CONVERSA_MS)
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
       * `onerror` do `EventSource` também dispara na reconexão normal, a que
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
       * `visibilitychange` abaixo confere na hora, que é o momento em que a
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
        // virar erro na cara de quem está atendendo, na próxima volta o pulso
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
      if (redesenhoMarcado !== null) window.clearTimeout(redesenhoMarcado)
      if (preguicoso !== null) window.clearTimeout(preguicoso)
      window.removeEventListener(DEU_CONTA, aoDarConta)
      document.removeEventListener('visibilitychange', aoTrocarDeVisibilidade)
    }
  }, [clienteId, router, pulsoNaTela])

  // Não desenha nada: o efeito é a tela inteira ficando em dia.
  return null
}
