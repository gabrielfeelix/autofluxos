import type { AnexoDaMensagem, Citada, ReacaoNaMensagem } from '@/server/repos/leads'

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

/**
 * A mensagem citada, dentro da bolha que a cita.
 *
 * Fica **acima** do texto e com uma barra na lateral — o desenho que o WhatsApp
 * usa e que todo mundo já lê sem pensar. Copiar o padrão aqui não é falta de
 * imaginação: é o que faz a citação ser entendida sem legenda.
 *
 * O caso de a citada não estar no histórico é normal e tem desenho próprio.
 * Acontece quando a conversa foi cortada no teto, quando alguém responde a um
 * anúncio, e quando a mensagem é encaminhada. Sumir com a citação nesses casos
 * esconderia que aquela frase comenta outra — que é justamente o que ela tem de
 * dizer.
 */
export function CitacaoNaBolha({ cita, nome }: { cita: Citada; nome: string | null }) {
  const deQuem = cita.direcao === 'saida' ? 'atendimento' : (nome ?? 'cliente')

  return (
    <span className="mb-1.5 flex gap-2 rounded-md border-l-2 border-accent/50 bg-white/[0.045] px-2 py-1.5">
      <span className="min-w-0 flex-1">
        {cita.direcao && (
          <span className="block text-[10px] font-bold text-accent/90">{deQuem}</span>
        )}
        <span className="block truncate text-[11px] text-muted">
          {cita.texto?.trim() ? (
            cita.texto
          ) : (
            /*
             * Sem texto cobre dois casos diferentes e o mesmo desenho serve
             * para os dois: a citada não está no nosso histórico, ou ela é uma
             * foto (que não tem texto nenhum). Nomear qual dos dois exigiria
             * carregar a mensagem inteira para dizer algo que não muda nada
             * para quem lê.
             */
            <span className="italic">mensagem original</span>
          )}
        </span>
      </span>
    </span>
  )
}

/**
 * As reações penduradas na mensagem.
 *
 * Ficam **fora** da bolha, encostadas na borda de baixo, como no WhatsApp: a
 * reação comenta a mensagem, não faz parte dela. Dentro, viraria parte do
 * texto — e a diferença importa quando a mensagem é longa.
 *
 * `de` distingue os dois lados porque numa conversa os dois reagem, e saber
 * quem reagiu é metade da informação: "ela curtiu o preço" e "nós curtimos o
 * que ela disse" são fatos diferentes para quem abre a conversa depois.
 */
export function ReacoesNaBolha({
  reacoes,
  nome,
}: {
  reacoes: ReacaoNaMensagem[]
  nome: string | null
}) {
  return (
    <span className="-mt-1.5 flex flex-wrap gap-1">
      {reacoes.map((reacao) => (
        <span
          key={reacao.id}
          title={`${reacao.de === 'saida' ? 'atendimento' : (nome ?? 'cliente')} reagiu`}
          className="rounded-full border border-white/[0.1] bg-[#1c2230] px-1.5 py-0.5 text-[11px] leading-none shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
        >
          {reacao.emoji}
        </span>
      ))}
    </span>
  )
}
