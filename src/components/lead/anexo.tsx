import { ImagemDaConversa } from '@/components/lead/visor-de-imagem'
import type { AnexoDaMensagem, CartaoDeContato, ProdutoNaMensagem, Citada, LocalDaMensagem } from '@/server/repos/leads'
import { telefoneLegivel } from '@/core/contatos/telefone'

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
/**
 * As fotos do card de produto, em cima do texto dele. Uma foto ocupa a bolha;
 * o carrossel do bot (até três) vira uma fileira, na ordem em que chegou.
 */
export function FotosDoCard({ produtos }: { produtos: ProdutoNaMensagem[] }) {
  const comFoto = produtos.flatMap((p) => (p.foto ? [{ ...p, foto: p.foto }] : []))
  if (comFoto.length === 0) return null
  if (comFoto.length === 1) return <ImagemDaConversa url={comFoto[0]!.foto} nome={comFoto[0]!.nome} produto />
  return (
    <div className="mb-1.5 grid grid-cols-3 gap-1.5 [&>button]:mb-0">
      {comFoto.map((p) => (
        <ImagemDaConversa key={p.foto} url={p.foto} nome={p.nome} produto />
      ))}
    </div>
  )
}

export function AnexoNaConversa({ anexo }: { anexo: AnexoDaMensagem }) {
  const nome = anexo.nomeArquivo?.trim() || 'arquivo'

  /*
   * A imagem abre num visor por cima da conversa, e não numa aba nova. Além do
   * conforto, há um motivo técnico: a mídia recebida vive em bucket privado com
   * URL assinada de cinco minutos, e uma aba com essa URL expira sozinha.
   */
  if (anexo.midia === 'imagem') {
    return <ImagemDaConversa url={anexo.url} nome={nome} />
  }

  if (anexo.midia === 'video') {
    return (
      <video
        src={anexo.url}
        controls
        className="mb-1.5 max-h-56 w-full rounded-lg border border-line bg-black"
      />
    )
  }

  if (anexo.midia === 'audio') {
    /*
     * **Largura fixa, e não `w-full`.** A bolha é um item de flex com
     * `items-end`, ou seja, largura de conteúdo, e `w-full` dentro de um pai
     * que se mede pelo filho é circular: o navegador resolve para quase nada.
     *
     * Dava para não perceber enquanto só o áudio recebido aparecia, porque
     * aquela bolha trazia junto a frase "(áudio, imagem ou documento)" e era a
     * frase que lhe dava largura. O áudio que sai não tem texto nenhum: a bolha
     * encolhia até o player virar uma pílula com um traço e três pontinhos,
     * abaixo dos ~200px em que o Chrome desiste de desenhar os controles.
     *
     * 260px é a medida em que os controles nativos aparecem inteiros ,
     * play, tempo, barra e volume. `max-w-full` é o que impede que ela estoure
     * a coluna numa janela estreita.
     */
    return <audio src={anexo.url} controls className="mb-1.5 w-[260px] max-w-full" />
  }

  return (
    <a
      href={anexo.url}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 transition hover:border-primary/40"
    >
      <span aria-hidden className="text-sm">
        📄
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium underline">{nome}</span>
    </a>
  )
}

/**
 * O que escrever quando a mensagem não tem texto.
 *
 * Mídia **recebida** continua sem anexo, o webhook guarda o `type` e não baixa
 * o arquivo da Meta, então não há o que mostrar. Aí a frase antiga continua
 * sendo a verdade.
 */
export function SemTexto() {
  return <span className="italic text-muted">(áudio, imagem ou documento)</span>
}

/**
 * A mensagem citada, dentro da bolha que a cita.
 *
 * Fica **acima** do texto e com uma barra na lateral, o desenho que o WhatsApp
 * usa e que todo mundo já lê sem pensar. Copiar o padrão aqui não é falta de
 * imaginação: é o que faz a citação ser entendida sem legenda.
 *
 * O caso de a citada não estar no histórico é normal e tem desenho próprio.
 * Acontece quando a conversa foi cortada no teto, quando alguém responde a um
 * anúncio, e quando a mensagem é encaminhada. Sumir com a citação nesses casos
 * esconderia que aquela frase comenta outra, que é justamente o que ela tem de
 * dizer.
 */
export function CitacaoNaBolha({ cita, nome }: { cita: Citada; nome: string | null }) {
  const deQuem = cita.direcao === 'saida' ? 'atendimento' : (nome ?? 'cliente')

  return (
    <span className="mb-1.5 flex gap-2 rounded-md border-l-2 border-primary/50 bg-surface px-2 py-1.5">
      <span className="min-w-0 flex-1">
        {cita.direcao && (
          <span className="block text-[11px] font-bold text-primary/90">{deQuem}</span>
        )}
        <span className="block truncate text-[12px] text-muted">
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
 * um iframe de terceiro em cima da conversa, por um recurso que aparece em uma
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
      className="mb-1.5 flex items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 transition hover:border-primary/40"
    >
      <span className="text-[15px] leading-none">📍</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold text-ink">{titulo}</span>
        {local.endereco && (
          <span className="block text-[12px] leading-4 text-muted">{local.endereco}</span>
        )}
        <span className="block font-mono text-[11px] text-dim">{coordenadas}</span>
        <span className="mt-0.5 block text-[11px] font-bold text-primary">Abrir no mapa →</span>
      </span>
    </a>
  )
}

/**
 * Os cartões de contato encaminhados.
 *
 * Cada telefone é um link `tel:`, no celular disca, no computador abre o que a
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
          className="flex items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-2"
        >
          <span className="text-[15px] leading-none">👤</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-bold text-ink">{cartao.nome}</span>
            {cartao.telefones.length > 0 ? (
              cartao.telefones.map((telefone) => (
                <a
                  key={telefone}
                  href={`tel:${telefone.replace(/[^+\d]/g, '')}`}
                  className="block text-[12px] text-primary tabular-nums hover:underline"
                >
                  {telefoneLegivel(telefone)}
                </a>
              ))
            ) : (
              <span className="block text-[12px] text-dim italic">sem telefone no cartão</span>
            )}
          </span>
        </span>
      ))}
    </span>
  )
}

/**
 * A Meta mandou `unsupported`: houve mensagem, e ela não vem para cá.
 *
 * ---------------------------------------------------------------------------
 * Por que isto não é "(áudio, imagem ou documento)"
 * ---------------------------------------------------------------------------
 *
 * Caía no genérico antes, e o genérico mentia duas vezes: chuta que era mídia
 * (pode ser enquete, pagamento, evento, um "ver uma vez") e não diz que **o
 * conteúdo não existe deste lado**, o que faz quem lê procurar o botão de
 * baixar que nunca vai aparecer, e concluir que o painel está quebrado.
 *
 * O que a Cloud API não entrega, ela não entrega para ninguém: é limite dela, e
 * o caminho é abrir a conversa no celular. Dizer isso é a única coisa útil que
 * esta bolha pode fazer, e não prometer recuperação, porque não há.
 */
export function MensagemNaoSuportada({ motivo }: { motivo?: string } = {}) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-dashed border-strong px-2.5 py-1.5">
      <span aria-hidden className="text-[13.5px] leading-none">
        🚫
      </span>
      <span className="text-[12px] leading-4 text-dim italic">
        {motivo ? `${motivo}: ` : ''}mensagem que o WhatsApp não entrega para o painel, veja no celular
      </span>
    </span>
  )
}

/**
 * Chegou arquivo e não temos cópia dele.
 *
 * ---------------------------------------------------------------------------
 * Por que uma frase, e não nada
 * ---------------------------------------------------------------------------
 *
 * Três caminhos levam aqui: o arquivo passou do teto de 16 MB, o download da
 * Meta falhou, ou a mensagem é anterior à `0055`, e nesse caso o `id` dela já
 * expirou nos 7 dias e o arquivo não existe mais em lugar nenhum do mundo.
 *
 * Para quem lê, os três dão no mesmo, e o que **não** pode acontecer é a bolha
 * ficar vazia. "Sumiu minha foto" é a reclamação mais comum do mercado neste
 * recurso, Digisac, Huggy e Chatwoot todos a colecionam (ver
 * `docs/PLANO-MIDIA-RECEBIDA.md`). A diferença entre um produto que perdeu algo
 * e um produto quebrado é uma frase que assume o que aconteceu.
 *
 * Não promete recuperação, porque não há: a Meta não guarda cópia, e depois de
 * sete dias ninguém guarda.
 */
export function ArquivoSemCopia({ nossa = false }: { nossa?: boolean }) {
  return (
    /*
      `inline-flex` e `max-w-full`: era `flex`, que é bloco e esticava até os
      78% da bolha, um retângulo grande e vazio para dizer uma frase curta.
    */
    <span className="mb-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-dashed border-strong px-2.5 py-1.5">
      <span className="text-[13.5px] leading-none">📎</span>
      <span className="text-[12px] leading-4 text-dim italic">
        {nossa
          ? 'arquivo enviado pelo celular, sem cópia por aqui'
          : 'arquivo recebido, sem cópia guardada, peça para enviar de novo'}
      </span>
    </span>
  )
}
