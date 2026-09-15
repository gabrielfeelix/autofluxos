'use client'

import { useRef, useState, useTransition } from 'react'
import { BotaoDeAnexo } from '@/components/lead/botao-de-anexo'
import { BotaoDeMicrofone } from '@/components/lead/botao-de-microfone'
import { useCitacao } from '@/components/lead/citacao'
import { SeletorDeEmoji } from '@/components/lead/seletor-de-emoji'

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
 * - **Diz quanto falta da janela de 24h antes de alguém digitar**, em vez de
 *   deixar descobrir no erro. Fora da janela o campo nem abre.
 *
 * A recusa de verdade é a do servidor (`acaoResponderLead`); isto aqui é
 * conveniência, como o botão desabilitado de publicar.
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
   * Existe automação nesta conta? **Sem ela o rodapé não fala de bot** — dizer
   * "o bot para de falar" numa conta sem fluxo nenhum descreve um robô que não
   * existe, e faz procurar onde desligá-lo. Só a janela de 24h continua, que é
   * regra da Meta e vale com ou sem automação.
   */
  temAutomacao?: boolean
  /**
   * De onde sai o clipe de anexar. Opcional porque a tela da Ficha usa a mesma
   * caixa e não precisa dele — passar os dois ids só onde faz sentido evita
   * inventar um botão que não teria para onde enviar.
   */
  anexo?: { clienteId: string; contatoId: string }
}) {
  const campo = useRef<HTMLTextAreaElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  /*
   * Gravar áudio toma a barra inteira. O estado mora aqui, e não dentro do
   * botão de microfone, porque quem precisa sair de cena é o rodapé — o campo
   * de texto, o clipe, o emoji e o "Enviar" do formulário.
   */
  const [gravando, setGravando] = useState(false)
  const [enviando, comecar] = useTransition()
  /** `null` fora do provedor — a tela da Ficha não monta citação. */
  const citacao = useCitacao()

  if (restaDaJanela === null) {
    return (
      <div className="border-t border-line px-[18px] py-3.5">
        <p className="text-[11.5px] leading-5 text-dim">
          <strong className="text-muted">Não dá para responder por aqui agora.</strong> O WhatsApp
          só aceita texto livre até 24h depois da última mensagem de {nome}. Passado isso, retomar
          exige um modelo aprovado pela Meta — que este produto ainda não manda.
        </p>
      </div>
    )
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
      // Só depois de sair. O texto fica onde está enquanto houver erro.
      if (campo.current) campo.current.value = ''
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
    setErro(null)
  }

  return (
    <form action={enviar} className="border-t border-line px-[18px] py-3.5">
      {/*
        A citação escolhida, acima do campo.

        Com o X para desfazer: escolher a mensagem errada é o erro mais comum
        aqui, e sem saída a pessoa manda a resposta citando a frase errada — que
        é pior do que não citar.
      */}
      {citacao?.citando && (
        <div className="mb-2 flex items-start gap-2 rounded-[10px] border-l-2 border-primary/60 bg-surface px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-primary/90">
              Respondendo {citacao.citando.deQuem}
            </p>
            <p className="truncate text-[11.5px] text-muted">
              {citacao.citando.texto?.trim() || <span className="italic">mensagem sem texto</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={citacao.limpar}
            aria-label="Não citar esta mensagem"
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[12px] leading-none text-dim transition hover:bg-surface-strong hover:text-ink"
          >
            ×
          </button>
        </div>
      )}
      {/*
        O campo some enquanto grava, e `hidden` em vez de desmontar: desmontar
        levaria junto o texto já digitado, e quem grava um áudio no meio de uma
        frase perderia a frase. Ele continua no formulário, só sai de vista.
      */}
      <textarea
        hidden={gravando}
        ref={campo}
        name="texto"
        rows={2}
        maxLength={4096}
        disabled={enviando}
        placeholder={`Responder ${nome} pelo WhatsApp…`}
        className="w-full resize-y rounded-[11px] border border-line bg-surface px-3 py-2.5 text-[12.5px] leading-[1.45] outline-none transition placeholder:text-dim focus:border-primary/40 disabled:opacity-50"
        onKeyDown={(evento) => {
          // Enter manda, Shift+Enter quebra linha — o hábito de todo mundo que
          // usa WhatsApp. `requestSubmit` para o `action` do form valer.
          if (evento.key === 'Enter' && !evento.shiftKey) {
            evento.preventDefault()
            evento.currentTarget.form?.requestSubmit()
          }
        }}
      />

      {respostasRapidas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Inserir resposta rápida">
          {respostasRapidas.map((resposta) => (
            <button
              key={resposta.atalho}
              type="button"
              disabled={enviando}
              title={resposta.texto}
              onClick={() => inserirResposta(resposta.texto)}
              className="rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-[10.5px] font-bold text-primary transition hover:border-primary/40 hover:bg-primary/[0.13] disabled:opacity-50"
            >
              /{resposta.atalho}
            </button>
          ))}
        </div>
      )}

      {erro && (
        <p className="mt-2 rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[11.5px] leading-5 text-perigo">
          {erro}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {/*
          Gravando, a barra é só da gravação.
          -------------------------------------------------------------------
          Antes o "⏹ Enviar" do áudio convivia com o "Enviar" do formulário na
          mesma linha: dois botões com o mesmo nome, e o da direita respondia
          "escreva a mensagem antes de enviar" porque é o do texto. Não há como
          adivinhar qual é qual — então enquanto grava, o resto sai de cena.
        */}
        {/*
          O clipe fica fora do `<form>` em comportamento — ele não é `submit`,
          manda por conta própria. Fica aqui na linha do rodapé porque é onde
          todo mundo procura: ao lado do botão de enviar.
        */}
        {/*
          O emoji entra pelo mesmo caminho da resposta rápida: `inserirResposta`
          escreve no cursor e confere o teto de 4.096 caracteres. Um caminho só
          é o que evita a tela aceitar por aqui o que recusa por ali.
        */}
        {!gravando && <SeletorDeEmoji aoEscolher={inserirResposta} desabilitado={enviando} />}
        {anexo && !gravando && (
          <BotaoDeAnexo
            clienteId={anexo.clienteId}
            contatoId={anexo.contatoId}
            desabilitado={enviando}
          />
        )}
        {/*
          O microfone entra ao lado do clipe porque é o mesmo gesto: mandar algo
          que não é texto. Ele manda por conta própria, como o clipe — não é
          `submit` deste formulário.
        */}
        {anexo && (
          <BotaoDeMicrofone
            clienteId={anexo.clienteId}
            contatoId={anexo.contatoId}
            desabilitado={enviando}
            aoGravar={setGravando}
          />
        )}
        {!gravando && (
        <span className="flex-1 text-[10.5px] leading-4 text-dim">
          {temAutomacao ? (
            <>
              Responder daqui assume a conversa: o bot para de falar com {nome} até você clicar em
              &ldquo;Já atendi&rdquo;. Janela do WhatsApp fecha em {restaDaJanela}.
            </>
          ) : (
            <>Janela do WhatsApp fecha em {restaDaJanela}.</>
          )}
        </span>
        )}
        {!gravando && (
          <button
            type="submit"
            disabled={enviando}
            className="app-primary-button shrink-0 px-4 py-2 text-[12px] disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        )}
      </div>
    </form>
  )
}
