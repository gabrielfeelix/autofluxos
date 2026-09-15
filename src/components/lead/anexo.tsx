import type { AnexoDaMensagem, CartaoDeContato, Citada, LocalDaMensagem } from '@/server/repos/leads'

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
 * O lugar que a pessoa mandou, dentro da bolha.
 *
 * ---------------------------------------------------------------------------
 * Por que um link, e não um mapa
 * ---------------------------------------------------------------------------
 *
 * Um mapa embutido custa uma chave de API, um domínio a mais no `next.config` e
 * um iframe de terceiro em cima da conversa — por um recurso que aparece em uma
 * conversa em cem. O link abre o mapa que a pessoa já usa, com o caminho de
 * casa dela já configurado, e é o que quem atende vai querer de qualquer jeito:
 * **traçar a rota**, não olhar a figura.
 *
 * As coordenadas ficam à vista embaixo do nome porque às vezes é só isso que
 * chega: arrastando o pino, a Meta não manda nem nome nem endereço, e uma bolha
 * dizendo apenas "Localização" não diria nada.
 */
export function LocalNaBolha({ local }: { local: LocalDaMensagem }) {
  const titulo = local.nome?.trim() || 'Localização'
  const coordenadas = `${local.latitude.toFixed(5)}, ${local.longitude.toFixed(5)}`

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${local.latitude},${local.longitude}`}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 flex items-start gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2.5 py-2 transition hover:border-accent/40"
    >
      <span className="text-[15px] leading-none">📍</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-bold text-white">{titulo}</span>
        {local.endereco && (
          <span className="block text-[11px] leading-4 text-muted">{local.endereco}</span>
        )}
        <span className="block font-mono text-[9.5px] text-dim">{coordenadas}</span>
        <span className="mt-0.5 block text-[10px] font-bold text-accent">Abrir no mapa →</span>
      </span>
    </a>
  )
}

/**
 * Os cartões de contato encaminhados.
 *
 * Cada telefone é um link `tel:` — no celular disca, no computador abre o que a
 * pessoa usa para ligar. Antes disto a bolha vinha vazia e o número ficava
 * preso no `payload`, onde ninguém olha.
 *
 * Um cartão pode chegar **sem telefone nenhum** (a Meta manda o vCard como
 * está), e nesse caso a bolha diz isso em vez de mostrar um cartão que parece
 * quebrado.
 */
export function CartoesNaBolha({ cartoes }: { cartoes: CartaoDeContato[] }) {
  return (
    <span className="mb-1.5 flex flex-col gap-1">
      {cartoes.map((cartao, i) => (
        <span
          key={`${cartao.nome}-${i}`}
          className="flex items-start gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2.5 py-2"
        >
          <span className="text-[15px] leading-none">👤</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-bold text-white">{cartao.nome}</span>
            {cartao.telefones.length > 0 ? (
              cartao.telefones.map((telefone) => (
                <a
                  key={telefone}
                  href={`tel:${telefone.replace(/[^+\d]/g, '')}`}
                  className="block font-mono text-[11px] text-accent hover:underline"
                >
                  {telefone}
                </a>
              ))
            ) : (
              <span className="block text-[11px] text-dim italic">sem telefone no cartão</span>
            )}
          </span>
        </span>
      ))}
    </span>
  )
}
