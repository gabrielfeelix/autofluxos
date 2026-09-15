'use client'

import { useRef, useState, useTransition } from 'react'
import { acaoPrepararEnvioDeArquivo } from '@/server/acoes'
import { acaoEnviarMidiaDoInbox } from '@/server/acoes-midia-do-inbox'

/**
 * O clipe de anexar, na caixa de resposta.
 *
 * ---------------------------------------------------------------------------
 * O arquivo não passa pelo servidor
 * ---------------------------------------------------------------------------
 *
 * Ele sobe direto para o Storage com uma URL assinada, e só o endereço chega à
 * Server Action. **Não é otimização**: um `File` atravessando Server Action bate
 * no teto de 1 MB do Next, e um vídeo de 12 MB morreria no caminho com um erro
 * que não diz nada. É o mesmo caminho que o Acervo já usa.
 *
 * ---------------------------------------------------------------------------
 * Três estados, e o do meio é o que evita o clique duplo
 * ---------------------------------------------------------------------------
 *
 * Subir um vídeo de 15 MB leva segundos. Sem dizer "enviando", quem atende
 * clica de novo — e manda duas vezes. O rótulo do botão conta o que está
 * acontecendo, e o campo fica travado enquanto isso.
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
  const [, comecar] = useTransition()

  function escolher(arquivo: File) {
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

        const r = await acaoEnviarMidiaDoInbox(clienteId, contatoId, {
          url: preparo.envio.urlPublica,
          midia: preparo.envio.midia,
          nomeArquivo: preparo.envio.nome,
        })

        if (!r.ok) setErro(r.erro ?? 'não deu para enviar')
      } finally {
        setFase('parado')
        // Zera o input: sem isso, escolher o **mesmo** arquivo de novo não
        // dispara `change`, e o segundo envio parece que não funcionou.
        if (entrada.current) entrada.current.value = ''
      }
    })
  }

  const ocupado = desabilitado || fase !== 'parado'

  return (
    <>
      <input
        ref={entrada}
        type="file"
        hidden
        accept="image/jpeg,image/png,video/mp4,audio/mpeg,audio/ogg,audio/mp4,audio/aac,application/pdf"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0]
          if (arquivo) escolher(arquivo)
        }}
      />

      <button
        type="button"
        disabled={ocupado}
        onClick={() => entrada.current?.click()}
        title="Enviar foto, vídeo, áudio ou PDF"
        className="rounded-lg border border-white/[0.09] px-2.5 py-1.5 text-[11.5px] text-soft transition hover:border-white/20 disabled:opacity-50"
      >
        {fase === 'subindo' ? 'Subindo…' : fase === 'enviando' ? 'Enviando…' : '📎 Anexar'}
      </button>

      {erro && (
        <p className="mt-2 w-full rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[11.5px] leading-5 text-rose-200">
          {erro}
        </p>
      )}
    </>
  )
}
