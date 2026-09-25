'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { podeReagir } from '@/channels/janela'
import { assinaturaDasReacoes } from '@/core/reacoes'
import {
  AnexoNaConversa,
  ArquivoSemCopia,
  MensagemNaoSuportada,
  CartoesNaBolha,
  CitacaoNaBolha,
  LocalNaBolha,
  SemTexto,
} from '@/components/lead/anexo'
import { RodapeDaMensagem } from '@/components/lead/rodape-da-mensagem'
import { Transcricao } from '@/components/lead/transcricao'
import { CardsDeProduto } from '@/components/lead/cards-de-produto'
import { TextoDoWhatsApp } from '@/components/texto-do-whatsapp'
import { etiquetasDeDia, horaDoRelogio, horaExata } from '@/lib/quando'
import type { MensagemDoLead } from '@/server/repos/leads'
import {
  avisarQueDeuConta,
  PEDIDO,
  type PedidoDeNovas,
} from '@/components/inbox/sinal-de-conversa'

/**
 * A conversa, e ela anda sozinha.
 *
 * ---------------------------------------------------------------------------
 * O que mudou, e por quê
 * ---------------------------------------------------------------------------
 *
 * Esta lista era desenhada só no servidor. Toda mensagem, recebida ou enviada,
 * obrigava a página inteira a ser desenhada de novo (`router.refresh()`, mais o
 * `revalidatePath` do envio) para uma bolha aparecer no fim. A tela piscava a
 * cada mensagem e parecia F5 automático, que é exatamente o contrário do que um
 * aplicativo de conversa faz: o WhatsApp **acrescenta a bolha** e não redesenha
 * o resto.
 *
 * Agora é assim aqui. O servidor continua entregando a conversa inteira no
 * primeiro desenho, o que mantém a abertura rápida e o conteúdo indexável pela
 * própria página; daí em diante, quem chega é acrescentado pelo navegador, a
 * partir de `/api/clientes/<id>/inbox/conversa/<contato>`.
 *
 * ---------------------------------------------------------------------------
 * Servidor e navegador não brigam pela mesma mensagem
 * ---------------------------------------------------------------------------
 *
 * As duas fontes se encontram: uma mensagem que entrou ao vivo aparece na
 * próxima leitura do servidor (trocar de conversa, navegar, voltar para a aba).
 * A junção é por `id`, e **o servidor ganha**: a versão dele é a que tem
 * reação casada, citação resolvida e URL assinada nova. A cópia ao vivo some
 * calada quando a de verdade chega, sem a bolha piscar, porque a `key` da lista
 * é a mesma nas duas.
 */
export function Historico({
  mensagens,
  cortada,
  nome,
  clienteId,
  contatoId,
  favoritas,
}: {
  mensagens: MensagemDoLead[]
  cortada: boolean
  nome: string | null
  clienteId: string
  contatoId: string
  /** Os ids que **eu** guardei, para a estrela nascer cheia. Ver a 0063. */
  favoritas: Set<string>
}) {
  /**
   * O que chegou depois do desenho do servidor.
   *
   * Só o que ele ainda não conhece: assim que a próxima leitura do servidor
   * trouxer a mesma mensagem, ela sai daqui (o efeito logo abaixo), e a lista
   * volta a ter uma fonte só.
   */
  const [aoVivo, setAoVivo] = useState<MensagemDoLead[]>([])

  const idsDoServidor = useMemo(
    () => new Set(mensagens.map((mensagem) => mensagem.id)),
    [mensagens],
  )

  /*
   * A cópia ao vivo **não é apagada** quando o servidor traz a mesma mensagem;
   * ela é só filtrada na montagem da lista, logo abaixo.
   *
   * Apagar exigiria um `setState` dentro de efeito, que é uma renderização em
   * cascata por leitura do servidor para obter exatamente a mesma tela. O que
   * sobra na memória é um punhado de objetos enquanto a conversa está aberta, e
   * trocar de conversa remonta o componente e zera tudo.
   */
  /*
   * A junção, e **a leitura ao vivo é a que vale** quando as duas têm a mesma
   * mensagem.
   *
   * Parece contra-intuitivo (o servidor é a fonte), e é o contrário: a cópia
   * ao vivo é sempre a leitura **mais recente** daquela linha. É por ela que o
   * áudio de 438 KB deixa de ficar preso em "arquivo recebido, sem cópia
   * guardada" e que a saída troca "envio não confirmado" pela hora quando a
   * Meta confirma, sem a página inteira ser redesenhada para isso.
   */
  const lista = useMemo(() => {
    if (aoVivo.length === 0) return mensagens
    const porId = new Map(aoVivo.map((mensagem) => [mensagem.id, mensagem]))
    const atualizadas = mensagens.map((mensagem) => porId.get(mensagem.id) ?? mensagem)
    const ineditas = aoVivo.filter((mensagem) => !idsDoServidor.has(mensagem.id))
    return ineditas.length === 0 ? atualizadas : [...atualizadas, ...ineditas]
  }, [mensagens, aoVivo, idsDoServidor])

  /**
   * O carimbo da última mensagem à vista, que é o "de onde continuar".
   *
   * Vive num `ref` porque quem lê é a função de busca, que é criada uma vez e
   * escuta o evento; lê-lo do estado congelaria o valor do primeiro render e a
   * segunda mensagem seguida nunca chegaria.
   */
  const ultimoTs = useRef<string | null>(null)
  useEffect(() => {
    ultimoTs.current = lista.at(-1)?.ts ?? null
  }, [lista])

  /** Uma busca por vez: o pulso pode avisar duas vezes antes da primeira voltar. */
  const buscando = useRef(false)

  const conferir = useCallback(
    async (pulso: string | null) => {
      const naTela = ultimoTs.current

      /*
       * O atalho que evita a viagem: o instante mais novo da conta já está na
       * tela.
       *
       * O pulso carrega o carimbo da mensagem mais recente da **conta**. Se ele
       * não é mais novo do que a última bolha desta conversa, a novidade era
       * daqui e já foi mostrada, quem acabou de enviar, por exemplo, já buscou.
       * Responder na hora é o que impede um redesenho da página por uma
       * mensagem que está à vista.
       */
      const carimbo = pulso ? Date.parse(pulso.split('|')[0] ?? '') : Number.NaN
      if (naTela && !Number.isNaN(carimbo) && carimbo <= Date.parse(naTela)) {
        avisarQueDeuConta()
        return
      }

      if (buscando.current) return
      buscando.current = true
      try {
        /*
         * Um milissegundo para trás de propósito: a última bolha volta junto.
         *
         * `ts` não muda quando o arquivo termina de baixar nem quando a Meta
         * confirma a entrega, então pedir estritamente o que é mais novo
         * deixaria a última mensagem congelada no estado em que ela nasceu.
         * Reler uma linha é barato; ficar com a errada na tela não é.
         */
        const desde = naTela ? new Date(Date.parse(naTela) - 1).toISOString() : null
        const endereco =
          `/api/clientes/${clienteId}/inbox/conversa/${contatoId}` +
          (desde ? `?desde=${encodeURIComponent(desde)}` : '')

        const resposta = await fetch(endereco, { cache: 'no-store', credentials: 'same-origin' })
        if (!resposta.ok) return

        const corpo = (await resposta.json()) as { novas?: MensagemDoLead[] }
        const novas = corpo.novas ?? []
        if (novas.length === 0) return

        setAoVivo((atual) => {
          const porId = new Map(atual.map((mensagem) => [mensagem.id, mensagem]))
          for (const mensagem of novas) porId.set(mensagem.id, mensagem)
          return [...porId.values()].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
        })

        /*
         * A conversa aberta deu conta do recado: quem escuta o servidor não
         * precisa redesenhar a página. É esta linha que troca o F5 por uma
         * bolha nova.
         *
         * Só vale quando o que chegou **cobre** o pulso que provocou o pedido.
         * Sem essa conferência, uma mensagem de outra conversa que caísse no
         * mesmo instante ficaria fora da fila da esquerda até a próxima.
         */
        const maisNova = novas.reduce(
          (maior, mensagem) => Math.max(maior, Date.parse(mensagem.ts)),
          0,
        )
        if (Number.isNaN(carimbo) || maisNova >= carimbo) avisarQueDeuConta()
      } catch {
        /*
         * Oscilação de rede não pode virar erro na cara de quem atende. O pulso
         * avisa de novo no próximo segundo, e o `desde` continua sendo o mesmo,
         * então nada se perde no caminho.
         */
      } finally {
        buscando.current = false
      }
    },
    [clienteId, contatoId],
  )

  useEffect(() => {
    const aoPedido = (evento: Event) => void conferir((evento as PedidoDeNovas).detail ?? null)
    window.addEventListener(PEDIDO, aoPedido)
    return () => window.removeEventListener(PEDIDO, aoPedido)
  }, [conferir])

  return (
    <ListaDeMensagens
      mensagens={lista}
      cortada={cortada}
      nome={nome}
      clienteId={clienteId}
      contatoId={contatoId}
      favoritas={favoritas}
    />
  )
}

function ListaDeMensagens({
  mensagens,
  cortada,
  nome,
  clienteId,
  contatoId,
  favoritas,
}: {
  mensagens: MensagemDoLead[]
  cortada: boolean
  nome: string | null
  clienteId: string
  contatoId: string
  /** Os ids que **eu** guardei, para a estrela nascer cheia. Ver a 0063. */
  favoritas: Set<string>
}) {
  if (mensagens.length === 0) {
    return <p className="py-16 text-center text-[12.5px] text-dim">Nenhuma mensagem registrada.</p>
  }

  /*
   * Onde cada dia começa, calculado **uma vez** para a conversa inteira.
   *
   * Dentro do `map` isso viraria "comparar com a mensagem anterior" espalhado
   * pelo JSX, e a regra é chata o bastante (fuso de São Paulo, virada da
   * meia-noite) para merecer estar num lugar testado. Ver `lib/quando.ts`.
   */
  const diasDaConversa = etiquetasDeDia(mensagens, (m) => m.ts)

  /*
   * Ordem normal: mais antiga em cima, mais nova embaixo.
   *
   * O `flex-col-reverse` mora no container que ROLA, uma camada acima, e não
   * aqui. Como este bloco é filho único dele, a inversão de lá só escolhe de
   * que ponta o scroll nasce, não mexe na ordem. Inverter aqui também (o que
   * esta tela chegou a fazer) invertia a conversa de verdade.
   */
  return (
    /*
     * **A conversa ocupa a largura toda, sem coluna centralizada.**
     *
     * Havia aqui um `mx-auto max-w-[680px]`. O alinhamento das bolhas estava
     * certo, entrada à esquerda, saída à direita , mas relativo a essa
     * coluna, não à tela: numa área larga, a coluna flutuava no meio e a
     * conversa inteira aparecia deslocada para o centro, com as mensagens
     * recebidas começando longe da borda esquerda. Parecia bug de alinhamento
     * e era o contêiner.
     *
     * O `w-full` não é decoração: o pai que rola é um `flex-col-reverse`, e
     * num contêiner flex em coluna o filho é dimensionado pelo conteúdo no
     * eixo cruzado em vez de esticar. Sem ele, este bloco encolhe até a maior
     * bolha e fica centrado, que foi exatamente o sintoma que sobrou depois
     * de tirar o `max-w`: as bolhas alinhavam certo entre si, e o conjunto
     * todo flutuava no meio, longe das duas bordas.
     *
     * Largura cheia é também o que o WhatsApp faz, e é o que faz a direção da
     * mensagem ser legível de relance, que é a única coisa que o alinhamento
     * precisa comunicar.
     */
    <div className="flex w-full flex-col gap-2.5">
      {cortada && (
        <p className="mb-1 self-center rounded-full border border-dashed border-strong px-3 py-1.5 text-center font-mono text-[11px] text-dim">
          mostrando as 500 mensagens mais recentes
        </p>
      )}
      {mensagens.map((mensagem, indice) => {
        const nossa = mensagem.direcao === 'saida'
        const etiqueta = diasDaConversa[indice]
        /*
         * A barra só aparece onde há id da Meta.
         *
         * Reagir e citar pedem esse id, e saída ainda não confirmada não tem,
         * a Meta só o devolve depois de aceitar. Oferecer o botão ali daria um
         * clique que falharia sempre.
         */
        return (
          /*
           * O `Fragment` existe para a etiqueta de dia ser **irmã** da bolha, e
           * não filha dela: ela atravessa a conversa inteira e fica centrada,
           * enquanto a bolha alinha a um dos lados. A `key` sobe para cá junto,
           * porque agora é o fragmento que é o item da lista.
           */
          <Fragment key={mensagem.id}>
            {etiqueta && <EtiquetaDoDia rotulo={etiqueta} />}
            {/*
             * A coluna existe para a reação ter onde ficar.
             *
             * Antes a bolha era filha direta do `flex justify-*`. A reação
             * pendura embaixo dela e alinhada com ela, então as duas precisam
             * de um pai que empilhe, e `items-end`/`items-start` é o que
             * mantém a bolha do tamanho do conteúdo em vez de esticar na linha
             * toda.
             */}
          <div
            className={`flex min-w-0 max-w-full flex-col gap-0 ${nossa ? 'items-end' : 'items-start'}`}
          >
            {/*
              `[overflow-wrap:anywhere]` e não `break-words`: `break-word` só
              quebra a palavra depois de tentar empurrá-la para uma linha só,
              e uma URL que já é maior que a linha inteira nunca chega a caber,
              então ele desiste e deixa transbordar. `anywhere` quebra onde
              precisar, que é o comportamento certo para link colado.
            */}
            {/*
              `font-texto` e 14.5px, e não a fonte da casca em 13.

              A Outfit é geométrica de display, traço de espessura uniforme,
              aberturas fechadas, pouca diferença entre formas parecidas. Ela dá
              a cara do produto num título e cansa num parágrafo, e a conversa é
              o único lugar do painel onde se lê texto corrido, de outra pessoa,
              o dia inteiro. Aqui entra a Inter (ver `layout.tsx`).

              O corpo sobe para 14.5 e a entrelinha desce para 1.45: o ganho de
              legibilidade vem do tamanho e da forma da letra. **Não engorde o
              peso**, 500 numa bolha azul com texto branco vira borrão em tela
              comum.
            */}
            {mensagem.produtos?.length ? (
              <CardsDeProduto
                produtos={mensagem.produtos}
                nossa={nossa}
                hora={horaDoRelogio(mensagem.ts)}
                horaCompleta={horaExata(mensagem.ts)}
                autor={nossa ? mensagem.autor : null}
                naoConfirmado={nossa && !mensagem.entregue}
              />
            ) : (
            <p title={mensagem.toque ? 'Tocou numa opção do menu' : undefined} className={`max-w-[78%] px-3.5 py-2 font-texto text-[14.5px] leading-[1.45] whitespace-pre-wrap [overflow-wrap:anywhere] ${
              nossa
                ? 'bolha-nossa rounded-[15px_15px_4px_15px]'
                : mensagem.toque
                  ? 'bolha-toque rounded-[15px_15px_15px_4px]'
                  : 'bolha-deles rounded-[15px_15px_15px_4px]'
            }`}>
              {mensagem.cita && <CitacaoNaBolha cita={mensagem.cita} nome={nome} />}
              {mensagem.anexo && <AnexoNaConversa anexo={mensagem.anexo} />}
              {/*
                O arquivo que a pessoa mandou. Mesma bolha do que sai, e a
                diferença está em quem produziu a URL: aqui ela é assinada e
                morre em cinco minutos.
              */}
              {mensagem.recebido && <AnexoNaConversa anexo={mensagem.recebido} />}
              {/*
                Transcrever só o áudio **recebido**.

                O que sai foi escrito ou gravado por quem atende, que sabe o que
                disse. Oferecer transcrição ali seria mandar a própria voz para
                um modelo para ler de volta o que se acabou de falar.
              */}
              {mensagem.recebido?.midia === 'audio' && (
                <Transcricao
                  clienteId={clienteId}
                  contatoId={contatoId}
                  mensagemId={mensagem.id}
                  inicial={mensagem.transcricao ?? null}
                />
              )}
              {mensagem.semCopia && <ArquivoSemCopia nossa={nossa} />}
              {mensagem.naoSuportada && <MensagemNaoSuportada motivo={mensagem.motivoNaoSuportada} />}
              {mensagem.local && <LocalNaBolha local={mensagem.local} />}
              {mensagem.cartoes && <CartoesNaBolha cartoes={mensagem.cartoes} />}
              {/*
                Lugar e cartão **substituem** o "(áudio, imagem ou documento)".
                Eles são a mensagem inteira, e quase nunca vêm com legenda,
                deixar a frase genérica embaixo diria que falta algo que não
                falta.
              */}
              {/*
                A frase "(áudio, imagem ou documento)" é para quando **não há
                arquivo nenhum** para mostrar, mídia recebida que o webhook
                registrou sem baixar. Ela aparecia também embaixo do player, o
                que é dizer que não dá para ver o que está ali tocando.
              */}
              {mensagem.texto !== null ? (
                <TextoDoWhatsApp texto={mensagem.texto} />
              ) : (
                !mensagem.local &&
                !mensagem.cartoes &&
                !mensagem.anexo &&
                !mensagem.recebido &&
                !mensagem.semCopia &&
                !mensagem.naoSuportada && <SemTexto />
              )}
              {/*
                O rodapé da bolha diz a hora, e **quem escreveu só quando isso
                acrescenta alguma coisa**.

                Na entrada não acrescenta: a conversa tem duas vozes, o nome de
                quem está do outro lado já está no cabeçalho, e repeti-lo em
                cada bolha recebida era a mesma palavra dezenas de vezes na
                mesma tela.

                Na saída acrescenta, e muito, mas o rótulo antigo era
                "atendimento" em toda mensagem, do bot ou de gente. Não dizia
                nada e parecia dizer. Agora sai o nome de quem respondeu, ou
                "automação" quando foi o fluxo; quando não sabemos (mensagem
                antiga, ou o eco do que o dono mandou pelo celular), fica só a
                hora, ver `core/autor-da-mensagem.ts`.
              */}
              {/*
                Toque em botão: verde e com o nome dito no rodapé, para quem
                atende ler "resposta pronta" sem comparar com o menu acima.
              */}
              <span className="ml-2 text-[11px] text-muted" title={horaExata(mensagem.ts)}>
                {nossa && mensagem.autor ? `${mensagem.autor} · ` : ''}
                {horaDoRelogio(mensagem.ts)}
              </span>
              {nossa && !mensagem.entregue && (
                <span className="ml-2 text-[11px] font-semibold text-soft">envio não confirmado</span>
              )}
            </p>
            )}
            {mensagem.menu && (
              <MenuNaConversa menu={mensagem.menu} respondido={indice < mensagens.length - 1} />
            )}
            {/*
              O rodapé passou a existir **em toda bolha**.

              Antes ele só nascia com id da Meta ou reação, porque só citar e
              reagir moravam ali, e os dois precisam do id. A estrela não
              precisa: ela guarda pelo id interno (`messages.id`), que existe em
              toda mensagem gravada, inclusive na saída que a Meta ainda não
              confirmou. Guardar o que se acabou de escrever é justamente um dos
              casos de uso, e escondê-lo até a confirmação chegar seria esconder
              o botão no único momento em que a pessoa está olhando para a
              mensagem.

              Os outros dois continuam guardados por `waMessageId` dentro do
              componente, então nada aparece que não funcione.
            */}
            {(
              /*
               * A `key` é o que devolve a palavra final ao servidor.
               *
               * O rodapé guarda a nossa reação em estado para poder mostrá-la
               * antes da resposta. Quando a leitura seguinte trouxer outra
               * coisa, alguém reagiu do celular, a Meta recusou, a outra
               * pessoa reagiu também , a chave muda, o componente remonta, e
               * o otimismo pendurado ali morre junto. Sem isso, a tela ficaria
               * com a aposta para sempre.
               */
              <RodapeDaMensagem
                key={assinaturaDasReacoes(mensagem.reacoes)}
                clienteId={clienteId}
                contatoId={contatoId}
                waMessageId={mensagem.waMessageId ?? null}
                podeReagir={podeReagir(mensagem.ts)}
                reacoes={mensagem.reacoes ?? []}
                nome={nome}
                texto={mensagem.texto}
                deQuem={nossa ? 'ao atendimento' : `a ${nome ?? 'cliente'}`}
                nossa={nossa}
                mensagemId={mensagem.id}
                favorita={favoritas.has(mensagem.id)}
              />
            )}
          </div>
          </Fragment>
        )
      })}

    </div>
  )
}

/**
 * Os botões ou a lista que o bot mandou, do jeito que a pessoa viu.
 *
 * Pendurados embaixo da bolha, como no WhatsApp, para ler "pergunta e o que
 * havia para tocar" como uma coisa só. A opção tocada ganha o azul e o ✓; as
 * outras apagam. Menu sem toque e com conversa depois dele diz isso com todas
 * as letras: foi exatamente a dúvida que gerou este componente, uma conversa
 * em que o menu expirou e parecia que o toque tinha sumido.
 *
 * Lista sai aberta, com todas as linhas. No celular ela fica atrás de um
 * botão, mas aqui quem lê precisa saber o que ela oferecia sem abrir nada.
 */
export function MenuNaConversa({
  menu,
  respondido,
}: {
  menu: NonNullable<MensagemDoLead['menu']>
  respondido: boolean
}) {
  const tocou = menu.escolhida !== undefined
  return (
    <div className="mt-1 flex w-full max-w-[min(78%,300px)] flex-col gap-1">
      {menu.formato === 'lista' && (
        <span className="px-1 text-[11px] font-medium text-muted">opções da lista</span>
      )}
      {menu.opcoes.map((opcao) => {
        const escolhida = opcao.id === menu.escolhida
        return (
          <span
            key={opcao.id}
            className={`flex items-center justify-center gap-1.5 rounded-[12px] border px-3 py-1.5 text-center text-[13px] leading-5 ${
              escolhida
                ? 'border-primary bg-primary-weak font-semibold text-primary-strong'
                : tocou
                  ? 'border-line bg-surface text-dim'
                  : 'border-line bg-surface text-primary'
            }`}
          >
            {escolhida && (
              <span aria-hidden className="text-[12px]">
                ✓
              </span>
            )}
            {opcao.rotulo}
          </span>
        )
      })}
      {!tocou && respondido && (
        <span className="px-1 text-right text-[11px] text-muted">nenhuma opção foi tocada</span>
      )}
    </div>
  )
}

/**
 * A etiqueta que separa os dias dentro da conversa.
 *
 * Ela não é enfeite: sem ela a hora de relógio mente. `09:14` de hoje e `09:14`
 * de terça ficam idênticos na tela, e quem atende lê a conversa de cima para
 * baixo sem nenhuma pista de onde um dia acabou.
 */
function EtiquetaDoDia({ rotulo }: { rotulo: string }) {
  return (
    <p className="my-1 self-center rounded-full border border-line bg-surface px-3 py-1 text-center text-[11px] font-medium text-dim">
      {rotulo}
    </p>
  )
}
