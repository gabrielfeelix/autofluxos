import type { AnexoDaMensagem } from '@/server/repos/leads'

/**
 * O arquivo dentro da bolha, nas telas de Lead e de Inbox.
 *
 * As duas desenham a conversa quase igual, e antes disto as duas diziam
 * "(áudio, imagem ou documento)" para qualquer mensagem sem texto. Isso era
 * honesto quando só existia mídia **recebida** e não havia como mostrá-la;
 * agora o bot também manda, e a frase esconderia justamente o que ele mandou.
 *
 * `<img>` puro em vez do `next/image`: a URL é digitada por quem desenha o
 * fluxo e aponta para qualquer host, então não dá para listar domínios no
 * `next.config` sem quebrar o caso normal.
 */
export function AnexoNaConversa({ anexo }: { anexo: AnexoDaMensagem }) {
  const nome = anexo.nomeArquivo?.trim() || 'arquivo'

  if (anexo.midia === 'imagem') {
    return (
      <a href={anexo.url} target="_blank" rel="noreferrer" className="mb-1.5 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={anexo.url}
          alt={nome}
          className="max-h-56 w-full rounded-lg border border-white/[0.08] object-cover"
        />
      </a>
    )
  }

  if (anexo.midia === 'video') {
    return (
      <video
        src={anexo.url}
        controls
        className="mb-1.5 max-h-56 w-full rounded-lg border border-white/[0.08] bg-black"
      />
    )
  }

  if (anexo.midia === 'audio') {
    return <audio src={anexo.url} controls className="mb-1.5 w-full max-w-[240px]" />
  }

  return (
    <a
      href={anexo.url}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 transition hover:border-accent/40"
    >
      <span aria-hidden className="text-sm">
        📄
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium underline">{nome}</span>
    </a>
  )
}

/**
 * O que escrever quando a mensagem não tem texto.
 *
 * Mídia **recebida** continua sem anexo — o webhook guarda o `type` e não baixa
 * o arquivo da Meta, então não há o que mostrar. Aí a frase antiga continua
 * sendo a verdade.
 */
export function SemTexto() {
  return <span className="italic text-muted">(áudio, imagem ou documento)</span>
}
