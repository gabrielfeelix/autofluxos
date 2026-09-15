'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Dica } from '@/components/design/dica'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { LIMITE_LEGENDA } from '@/core/flow/schema'
import { acaoPrepararEnvioDeArquivo } from '@/server/acoes'
import { acaoEnviarMidiaDoInbox } from '@/server/acoes-midia-do-inbox'

/**
 * O clipe de anexar, na caixa de resposta.
 *
 * ---------------------------------------------------------------------------
 * A revisão antes de enviar não é conforto: é a única defesa que existe
 * ---------------------------------------------------------------------------
 *
 * Antes disto, escolher o arquivo **era** enviar: o `change` do `<input>`
 * disparava o upload e o envio direto. Um clique errado na lista de arquivos
 * mandava a foto errada para o cliente, e **não há como desfazer** — apagar
 * para todos não existe na Cloud API, e nunca vai existir por API oficial.
 *
 * Num aplicativo comum, "enviou errado" custa um constrangimento. Aqui custa
 * mandar o documento de um cliente para outro. O passo de revisão é o que
 * transforma um erro irreversível num clique em "Cancelar".
 *
 * É também o que o WhatsApp faz, e por isso ninguém precisa aprender: escolheu
 * o arquivo, vê o que vai mandar, escreve a legenda junto, e só então envia.
 *
 * ---------------------------------------------------------------------------
 * A legenda entra aqui porque ela viaja com o arquivo
 * ---------------------------------------------------------------------------
 *
 * A Cloud API manda legenda **dentro** da mensagem de mídia (`caption`), não
 * como uma segunda mensagem. Escrever na caixa de texto e anexar separado
 * produziria duas mensagens, e no celular do cliente elas podem até chegar fora
 * de ordem. Áudio é a exceção e a API recusa — para ele o campo nem aparece.
 *
 * ---------------------------------------------------------------------------
 * O arquivo não passa pelo servidor
 * ---------------------------------------------------------------------------
 *
 * Ele sobe direto para o Storage com uma URL assinada, e só o endereço chega à
 * Server Action. **Não é otimização**: um `File` atravessando Server Action bate
 * no teto de 1 MB do Next, e um vídeo de 12 MB morreria no caminho com um erro
 * que não diz nada. É o mesmo caminho que o Acervo já usa.
 */
export function BotaoDeAnexo({
  clienteId,
  contatoId,
  desabilitado = false,
}: {
  clienteId: string
  contatoId: string
  desabilitado?: boolean
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [fase, setFase] = useState<'parado' | 'subindo' | 'enviando'>('parado')
  const [escolhido, setEscolhido] = useState<File | null>(null)
  const [legenda, setLegenda] = useState('')
  const [, comecar] = useTransition()

  /*
   * A prévia é um `blob:` criado a partir do arquivo local — **nada sobe para
   * ver**. É o que faz a revisão custar zero: o arquivo só vai para o Storage
   * depois de a pessoa confirmar.
   *
   * `useMemo` para derivar e `useEffect` só para soltar. A ordem importa:
   * criar dentro do efeito obrigaria a guardar o endereço em estado, e um
   * `setState` dentro de efeito é um render a mais em que a prévia ainda não
   * existe — a moldura pisca vazia antes de a imagem aparecer.
   *
   * Revogar não é zelo: cada `createObjectURL` prende o arquivo na memória da
   * aba até alguém soltar, e quem atende anexa dezenas por dia.
   */
  const previa = useMemo(
    () => (escolhido ? URL.createObjectURL(escolhido) : null),
    [escolhido],
  )

  useEffect(() => {
    if (!previa) return
    return () => URL.revokeObjectURL(previa)
  }, [previa])

  /* `Esc` desiste, como em qualquer diálogo. */
  useEffect(() => {
    if (!escolhido) return
    const noTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fase === 'parado') desistir()
    }
    window.addEventListener('keydown', noTeclado)
    return () => window.removeEventListener('keydown', noTeclado)
  }, [escolhido, fase])

  function desistir() {
    setEscolhido(null)
    setLegenda('')
    setErro(null)
    // Zera o input: sem isso, escolher o **mesmo** arquivo de novo não dispara
    // `change`, e a segunda tentativa parece que não funcionou.
    if (entrada.current) entrada.current.value = ''
  }

  /** O tipo de mídia é decidido no servidor; aqui só escolhemos como mostrar. */
  const ehImagem = escolhido?.type.startsWith('image/') ?? false
  const ehVideo = escolhido?.type.startsWith('video/') ?? false
  const ehAudio = escolhido?.type.startsWith('audio/') ?? false

  function enviar() {
    const arquivo = escolhido
    if (!arquivo) return
    setErro(null)

    comecar(async () => {
      try {
        setFase('subindo')

        /*
         * O servidor decide se o tipo e o tamanho passam, e devolve a URL
         * assinada. Conferir no navegador antes seria adivinhar a regra em dois
         * lugares — e a regra é do Acervo, não desta tela.
         */
        const preparo = await acaoPrepararEnvioDeArquivo(clienteId, {
          nome: arquivo.name,
          tipo: arquivo.type,
          bytes: arquivo.size,
        })

        if (!preparo.ok || !preparo.envio) {
          setErro(preparo.erro ?? 'não deu para preparar o envio')
          return
        }

        const subida = await fetch(preparo.envio.url, {
          method: 'PUT',
          body: arquivo,
          headers: { 'content-type': arquivo.type },
        })

        if (!subida.ok) {
          setErro('o arquivo não subiu; tente de novo')
          return
        }

        setFase('enviando')

        const texto = legenda.trim()
        const r = await acaoEnviarMidiaDoInbox(clienteId, contatoId, {
          url: preparo.envio.urlPublica,
          midia: preparo.envio.midia,
          nomeArquivo: preparo.envio.nome,
          // Áudio não leva legenda na Cloud API, e a ação recusa se vier uma.
          ...(texto !== '' && preparo.envio.midia !== 'audio' ? { legenda: texto } : {}),
        })

        if (!r.ok) {
          setErro(r.erro ?? 'não deu para enviar')
          return
        }

        /*
         * Só fecha quando deu certo. Fechar no erro jogaria fora o arquivo
         * escolhido e a legenda escrita, e quem atende teria de refazer os dois
         * para tentar de novo.
         */
        desistir()
      } finally {
        setFase('parado')
      }
    })
  }

  const ocupado = fase !== 'parado'
  const legendaGrande = legenda.length > LIMITE_LEGENDA

  return (
    <>
      <input
        ref={entrada}
        type="file"
        hidden
        accept="image/jpeg,image/png,video/mp4,audio/mpeg,audio/ogg,audio/mp4,audio/aac,application/pdf"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0]
          // Escolher **não** envia mais. Só abre a revisão.
          if (arquivo) {
            setErro(null)
            setEscolhido(arquivo)
          }
        }}
      />

      <Dica texto="Foto, vídeo, áudio ou PDF" lado="cima">
        <button
          type="button"
          disabled={desabilitado || ocupado}
          onClick={() => entrada.current?.click()}
          aria-label="Enviar foto, vídeo, áudio ou PDF"
          className={BOTAO_DA_BARRA}
        >
          📎
        </button>
      </Dica>

      {escolhido && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Revisar o arquivo antes de enviar"
          onClick={() => !ocupado && desistir()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-line bg-panel p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold">Enviar este arquivo?</p>
                <p className="mt-0.5 truncate text-[10.5px] text-dim" title={escolhido.name}>
                  {escolhido.name} · {(escolhido.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={desistir}
                disabled={ocupado}
                aria-label="Cancelar"
                className="shrink-0 rounded-lg border border-strong px-2 py-1 text-[12px] text-dim transition hover:border-strong hover:text-soft disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            <div className="flex max-h-[45vh] items-center justify-center overflow-hidden rounded-xl border border-line bg-black/30 p-2">
              {previa && ehImagem && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previa}
                  alt={escolhido.name}
                  className="max-h-[42vh] max-w-full rounded-lg object-contain"
                />
              )}
              {previa && ehVideo && (
                <video src={previa} controls className="max-h-[42vh] max-w-full rounded-lg" />
              )}
              {previa && ehAudio && <audio src={previa} controls className="w-full" />}
              {/*
                PDF e o que não tem prévia: o nome grande é a revisão possível.
                Mostrar um ícone genérico sem o nome seria uma revisão que não
                revisa nada.
              */}
              {!ehImagem && !ehVideo && !ehAudio && (
                <p className="px-3 py-6 text-center text-[12px] break-all text-soft">
                  <span aria-hidden className="mb-2 block text-2xl">
                    📄
                  </span>
                  {escolhido.name}
                </p>
              )}
            </div>

            {/*
              Áudio não leva legenda na Cloud API. Esconder o campo é melhor do
              que deixá-lo aceitar texto e o envio recusar depois.
            */}
            {!ehAudio && (
              <div>
                <input
                  autoFocus
                  value={legenda}
                  onChange={(e) => setLegenda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !ocupado && !legendaGrande) enviar()
                  }}
                  disabled={ocupado}
                  placeholder="Escreva uma legenda (opcional)"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12px] outline-none transition focus:border-primary/50 disabled:opacity-50"
                />
                {legendaGrande && (
                  <p className="mt-1 text-[10.5px] text-perigo">
                    a legenda aceita {LIMITE_LEGENDA} caracteres, e esta tem {legenda.length}
                  </p>
                )}
              </div>
            )}

            {erro && (
              <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[11.5px] leading-5 text-perigo">
                {erro}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={desistir}
                disabled={ocupado}
                className="rounded-lg border border-strong px-3 py-1.5 text-[11.5px] text-soft transition hover:border-strong disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviar}
                disabled={ocupado || legendaGrande}
                className="app-primary-button px-4 py-1.5 text-[12px] disabled:opacity-50"
              >
                {fase === 'subindo' ? 'Subindo…' : fase === 'enviando' ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Erro que sobra depois de o diálogo fechar — raro, mas não pode sumir. */}
      {erro && !escolhido && (
        <p className="mt-2 w-full rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[11.5px] leading-5 text-perigo">
          {erro}
        </p>
      )}
    </>
  )
}
