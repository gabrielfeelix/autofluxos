'use client'

import { useRef, useState, useTransition } from 'react'
import { BotaoDeAnexo } from '@/components/lead/botao-de-anexo'
import { BotaoDeMicrofone } from '@/components/lead/botao-de-microfone'
import { useCitacao } from '@/components/lead/citacao'
import { RetomarComModelo } from '@/components/lead/retomar-com-modelo'
import { pedirNovas } from '@/components/inbox/sinal-de-conversa'
import { SeletorDeEmoji } from '@/components/lead/seletor-de-emoji'
import { SeletorDeProduto } from '@/components/lead/seletor-de-produto'

/**
 * Até onde o campo cresce sozinho antes de virar rolagem.
 *
 * 132px são cerca de seis linhas: o suficiente para ver um parágrafo inteiro
 * antes de mandar, e pouco o bastante para a conversa continuar à vista. Um
 * campo que cresce sem teto empurra o histórico para fora da tela e faz quem
 * escreve perder de vista o que está respondendo.
 */
const TETO_DA_ALTURA = 132

/**
 * A caixa de responder do painel.
 *
 * Ela existe porque o handoff era um beco: o bot calava e não havia de onde
 * responder. O número roda na Cloud API, então o celular do cliente não é
 * caixa de entrada.
 *
 * Duas coisas que a tela faz de propósito:
 *
 * - **Não limpa o campo antes de a mensagem sair.** Erro de envio com o texto
 *   apagado faz a pessoa reescrever um parágrafo que ela acabou de pensar.
 * - **Diz que responder assume a conversa**, em vez de deixar descobrir depois
 *   que o bot calou. Fora da janela de 24h o campo nem abre.
 *
 * A recusa de verdade é a do servidor (`acaoResponderLead`); isto aqui é
 * conveniência, como o botão desabilitado de publicar.
 *
 * ---------------------------------------------------------------------------
 * A linha de baixo: quatro controles viraram três, e o da direita troca
 * ---------------------------------------------------------------------------
 *
 * Antes havia "📎 Anexar", "😊", "🎤 Gravar" e "Enviar", quatro botões com
 * borda disputando a linha, e um "Enviar" sempre aceso que perguntava "enviar o
 * quê?" com o campo vazio.
 *
 * Agora é o desenho que WhatsApp, Instagram e Telegram usam, e que a mão já
 * sabe sem ler: clipe e emoji à esquerda, sem borda; o campo no meio; e **um
 * botão só à direita**, que é microfone enquanto não há texto e vira avião de
 * papel assim que há. O gesto disponível é sempre o gesto que faz sentido.
 */
export function CaixaDeResposta({
  acao,
  restaDaJanela,
  nome,
  respostasRapidas = [],
  temAutomacao = true,
  anexo,
}: {
  acao: (formData: FormData) => Promise<{ ok: boolean; erro?: string }>
  /** `null` = fora da janela, ou a pessoa nunca escreveu. */
  restaDaJanela: string | null
  nome: string
  respostasRapidas?: { atalho: string; texto: string }[]
  /**
   * Existe automação nesta conta? **Sem ela o rodapé não fala de bot**, porque dizer
   * "o bot para de falar" numa conta sem fluxo nenhum descreve um robô que não
   * existe, e faz procurar onde desligá-lo. A janela de 24h não mora mais aqui:
   * ela é estado da conversa e subiu para o cabeçalho.
   */
  temAutomacao?: boolean
  /**
   * De onde sai o clipe de anexar. Opcional porque a tela da Ficha usa a mesma
   * caixa e não precisa dele, e passar os dois ids só onde faz sentido evita
   * inventar um botão que não teria para onde enviar.
   */
  anexo?: { clienteId: string; contatoId: string }
}) {
  const campo = useRef<HTMLTextAreaElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  /*
   * **Um booleano, e o campo continua não controlado.**
   *
   * A tentação é tornar o `<textarea>` controlado para saber se há texto. Isso
   * quebraria `inserirResposta`, que usa `setRangeText` direto no DOM para
   * escrever no cursor, que é o que faz `/atalho` e emoji entrarem no meio da
   * frase em vez de no fim dela, e o que respeita o teto de 4.096 caracteres
   * sem contar duas vezes.
   *
   * Então o React guarda só a resposta da única pergunta que a tela faz ao
   * texto: tem alguma coisa aí? Quem escreve no campo, seja a digitação, a inserção
   * ou o envio, é quem atualiza.
   */
  const [temTexto, setTemTexto] = useState(false)
  /*
   * Gravar áudio toma a barra inteira. O estado mora aqui, e não dentro do
   * botão de microfone, porque quem precisa sair de cena é o resto da linha:
   * o campo de texto, o clipe e o emoji.
   */
  const [gravando, setGravando] = useState(false)
  const [enviando, comecar] = useTransition()
  /** `null` fora do provedor, porque a tela da Ficha não monta citação. */
  const citacao = useCitacao()

  if (restaDaJanela === null) {
    /*
     * Fora da janela, a saída é o modelo aprovado, e ela só existe onde há os
     * ids para mandá-lo. A Ficha não os passa (mesmo motivo do clipe de
     * anexar), e lá a explicação continua sendo só texto.
     */
    if (anexo) {
      return (
        <RetomarComModelo clienteId={anexo.clienteId} contatoId={anexo.contatoId} nome={nome} />
      )
    }

    return (
      <div className="border-t border-line px-[18px] py-3.5">
        <p className="text-[12.5px] leading-5 text-dim">
          <strong className="text-muted">Não dá para responder por aqui agora.</strong> O WhatsApp
          só aceita texto livre por 24h depois da última mensagem de {nome}, ou por 72h quando a
          conversa nasceu de um anúncio. Passado isso, retomar exige um modelo aprovado pela Meta.
        </p>
      </div>
    )
  }

  /**
   * O campo cresce com o que se escreve, até o teto, e **só aí** ganha rolagem.
   *
   * Zerar a altura antes de medir não é gambiarra: `scrollHeight` devolve o
   * maior entre o conteúdo e a altura atual, então sem o zero o campo cresce e
   * nunca mais encolhe ao apagar.
   *
   * A barra de rolagem é ligada e desligada na mão porque o padrão do
   * `<textarea>` é `overflow: auto`, e "auto" aqui mente: enquanto a altura
   * está sendo reescrita a cada tecla, o navegador desenha a barra por um
   * quadro no meio do crescimento, uma linha cinza que pisca do lado do texto
   * enquanto ainda há espaço de sobra. Escondida abaixo do teto e só então
   * `auto`, o campo se comporta como o do WhatsApp: cresce em silêncio, e a
   * barra aparece no exato momento em que ele para de crescer.
   */
  function ajustarAltura(textarea: HTMLTextAreaElement) {
    textarea.style.height = '0px'
    const desejada = textarea.scrollHeight
    textarea.style.height = `${Math.min(desejada, TETO_DA_ALTURA)}px`
    textarea.style.overflowY = desejada > TETO_DA_ALTURA ? 'auto' : 'hidden'
  }

  /** Depois de qualquer escrita que não veio da digitação. */
  function conferirTexto() {
    const textarea = campo.current
    if (!textarea) return
    setTemTexto(textarea.value.trim() !== '')
    ajustarAltura(textarea)
  }

  function enviar(dados: FormData) {
    setErro(null)

    /*
     * A citação entra no `FormData` aqui, e não como campo escondido no
     * formulário: ela vive em contexto, não no DOM. Um `<input type="hidden">`
     * daria o mesmo resultado e mais um lugar para os dois saírem de sincronia.
     */
    if (citacao?.citando) dados.set('cita', citacao.citando.waMessageId)

    comecar(async () => {
      const r = await acao(dados)
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para enviar')
        return
      }
      /*
       * A bolha do que acabou de sair, sem esperar o servidor avisar.
       *
       * O envio já gravou a mensagem; quem desenha é a transcrição, que busca
       * só o que é novo. Sem esta linha a própria resposta levaria até um
       * segundo para aparecer (o tempo do pulso), e um segundo entre apertar
       * enviar e ver o que se escreveu é o que faz uma tela parecer lenta.
       */
      pedirNovas()

      // Só depois de sair. O texto fica onde está enquanto houver erro.
      if (campo.current) campo.current.value = ''
      conferirTexto()
      // A citação some junto com o texto, e pelo mesmo motivo: ela era daquela
      // mensagem. Deixá-la faria a resposta seguinte citar sem querer.
      citacao?.limpar()
    })
  }

  function inserirResposta(texto: string) {
    const textarea = campo.current
    if (!textarea) return

    const inicio = textarea.selectionStart ?? textarea.value.length
    const fim = textarea.selectionEnd ?? textarea.value.length
    const proximo = textarea.value.slice(0, inicio) + texto + textarea.value.slice(fim)
    if (proximo.length > 4096) {
      setErro('esta resposta não cabe inteira: o WhatsApp aceita até 4.096 caracteres')
      return
    }

    textarea.setRangeText(texto, inicio, fim, 'end')
    textarea.focus()
    conferirTexto()
    setErro(null)
  }

  /*
   * Quem ocupa a direita.
   *
   * O microfone é o padrão com o campo vazio, mas só existe onde há para onde
   * mandar (`anexo`). Na Ficha, que não passa os ids, a direita fica sendo o
   * avião sempre: um canto vazio faria procurar o botão de enviar.
   */
  const mostrarMicrofone = Boolean(anexo) && (!temTexto || gravando)
  const mostrarEnviar = !gravando && (temTexto || !anexo)

  return (
    <form action={enviar} className="border-t border-line px-[18px] py-3">
      {/*
        A citação escolhida, acima do campo.

        Com o X para desfazer: escolher a mensagem errada é o erro mais comum
        aqui, e sem saída a pessoa manda a resposta citando a frase errada, que
        é pior do que não citar.
      */}
      {citacao?.citando && (
        <div className="mb-2 flex items-start gap-2 rounded-[10px] border-l-2 border-primary/60 bg-surface px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-primary/90">
              Respondendo {citacao.citando.deQuem}
            </p>
            <p className="truncate text-[12.5px] text-muted">
              {citacao.citando.texto?.trim() || <span className="italic">mensagem sem texto</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={citacao.limpar}
            aria-label="Não citar esta mensagem"
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[12.5px] leading-none text-dim transition hover:bg-surface-strong hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      {/*
        As respostas rápidas vêm **acima** da linha de escrever, e não abaixo.
        Elas são o que se escolhe antes de escrever; embaixo, empurravam o campo
        para longe do botão de enviar a cada conta que tem muitos atalhos.
      */}
      {respostasRapidas.length > 0 && !gravando && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Inserir resposta rápida">
          {respostasRapidas.map((resposta) => (
            <button
              key={resposta.atalho}
              type="button"
              disabled={enviando}
              title={resposta.texto}
              onClick={() => inserirResposta(resposta.texto)}
              className="rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-[11.5px] font-bold text-primary transition hover:border-primary/40 hover:bg-primary/[0.13] disabled:opacity-50"
            >
              /{resposta.atalho}
            </button>
          ))}
        </div>
      )}

      {erro && (
        <p className="mb-2 rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[12.5px] leading-5 text-perigo">
          {erro}
        </p>
      )}

      {/*
        A linha de escrever. `items-end` para que, quando o campo cresce, os
        ícones fiquem alinhados com a última linha do texto, e não flutuando no
        meio de um retângulo alto.
      */}
      <div className="flex items-end gap-1">
        {anexo && !gravando && <BotaoDeAnexo desabilitado={enviando} />}
        {/*
          O emoji entra pelo mesmo caminho da resposta rápida: `inserirResposta`
          escreve no cursor e confere o teto de 4.096 caracteres. Um caminho só
          é o que evita a tela aceitar por aqui o que recusa por ali.
        */}
        {!gravando && <SeletorDeEmoji aoEscolher={inserirResposta} desabilitado={enviando} />}
        {anexo && !gravando && (
          <SeletorDeProduto clienteId={anexo.clienteId} contatoId={anexo.contatoId} desabilitado={enviando} />
        )}

        {/*
          O campo some enquanto grava, e `hidden` em vez de desmontar: desmontar
          levaria junto o texto já digitado, e quem grava um áudio no meio de
          uma frase perderia a frase. Ele continua no formulário, só sai de
          vista.
        */}
        <textarea
          hidden={gravando}
          ref={campo}
          name="texto"
          rows={1}
          maxLength={4096}
          /*
            Nasce sem barra. O `ajustarAltura` liga e desliga daí em diante, mas
            o primeiro render acontece antes de qualquer digitação, e sem isto
            o campo vazio já mostrava a barra em navegador que desenha a de
            reserva.
          */
          style={{ overflowY: 'hidden' }}
          disabled={enviando}
          placeholder={`Responder ${nome} pelo WhatsApp…`}
          /*
            `font-texto` aqui pelo mesmo motivo da bolha, e mais um: o que se
            escreve tem que parecer com o que sai. Campo numa fonte e bolha em
            outra faz a mensagem "mudar" ao ser enviada, e quem escreve passa a
            revisar duas vezes o mesmo parágrafo.
          */
          className="min-h-9 flex-1 resize-none rounded-[19px] border border-line bg-surface px-3.5 py-2 font-texto text-[14px] leading-[1.45] outline-none transition placeholder:text-dim focus:border-primary/40 disabled:opacity-50"
          onChange={(evento) => {
            setTemTexto(evento.currentTarget.value.trim() !== '')
            ajustarAltura(evento.currentTarget)
          }}
          /*
            Ao sair do campo, reconfere.

            `onChange` cobre digitar e apagar, mas não cobre o que escreve no
            `<textarea>` por fora dele: `setRangeText` do emoji e dos atalhos, o
            autopreenchimento do navegador, um `undo` com Ctrl+Z. Qualquer um
            deixa o estado dizendo "tem texto" com o campo vazio, e o microfone
            não volta.
          */
          onBlur={conferirTexto}
          onKeyDown={(evento) => {
            // Enter manda, Shift+Enter quebra linha, o hábito de todo mundo que
            // usa WhatsApp. `requestSubmit` para o `action` do form valer.
            if (evento.key === 'Enter' && !evento.shiftKey) {
              evento.preventDefault()
              evento.currentTarget.form?.requestSubmit()
            }
          }}
        />

        {/*
          Gravando, a linha é só da gravação, e o microfone se encarrega disso
          sozinho e ocupa tudo.
          -------------------------------------------------------------------
          Antes o "⏹ Enviar" do áudio convivia com o "Enviar" do formulário na
          mesma linha: dois botões com o mesmo nome, e o da direita respondia
          "escreva a mensagem antes de enviar" porque é o do texto. Não há como
          adivinhar qual é qual, então enquanto grava, o resto sai de cena.
        */}
        {mostrarMicrofone && anexo && (
          <BotaoDeMicrofone
            clienteId={anexo.clienteId}
            contatoId={anexo.contatoId}
            desabilitado={enviando}
            aoGravar={setGravando}
          />
        )}

        {mostrarEnviar && (
          <button
            type="submit"
            disabled={enviando}
            aria-label={enviando ? 'Enviando' : 'Enviar a mensagem'}
            className="app-primary-button flex size-9 shrink-0 items-center justify-center rounded-full text-[13.5px] leading-none disabled:opacity-50"
          >
            {enviando ? '…' : '➤'}
          </button>
        )}
      </div>

      {/*
        O rodapé diz **a consequência do gesto**, e só ela.

        A contagem da janela de 24h saiu daqui e subiu para o cabeçalho: ela é
        estado da conversa, vale para qualquer coisa que se faça nela, e no
        rodapé só era lida por quem já estava prestes a escrever. O que fica é o
        que só importa a quem vai responder agora.
      */}
      {!gravando && temAutomacao && (
        <p className="mt-1.5 px-1 text-[11.5px] leading-4 text-dim">
          Responder daqui assume a conversa: o bot para de falar com {nome} até você clicar em
          &ldquo;Finalizar atendimento&rdquo;.
        </p>
      )}
    </form>
  )
}
