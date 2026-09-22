import { passagensComNome, type AnuncioEmCache, type Passagem } from '@/core/anuncios'
import { origemDoContato } from '@/core/contatos/origem'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { horaExata, quando } from '@/lib/quando'

/**
 * Quem é a pessoa, no topo da coluna do contato.
 *
 * ---------------------------------------------------------------------------
 * Por que ele existe
 * ---------------------------------------------------------------------------
 *
 * A coluna abria em "Etiquetas" e a primeira informação sobre a **pessoa** era
 * "O que o fluxo coletou", que é o que o bot perguntou, não quem ela é. O
 * telefone e a data de chegada não apareciam em lugar nenhum desta tela: para
 * ver o número era preciso sair do Inbox e abrir a Ficha.
 *
 * Isso apareceu como reclamação do rótulo ("O que o fluxo coletou"), mas o
 * rótulo estava certo, ele distingue o que a automação coletou do que a equipe
 * escreveu, e essa diferença importa na hora de confiar no dado. O que faltava
 * era o bloco acima dele.
 *
 * ---------------------------------------------------------------------------
 * O que entra, e o que não
 * ---------------------------------------------------------------------------
 *
 * Três linhas, e todas respondem alguma coisa que se pergunta com a conversa
 * aberta: para onde eu ligo, há quanto tempo essa pessoa é nossa, e quando ela
 * falou pela última vez.
 *
 * **"Origem" entrou em 14/set/2026, e ela sempre existiu.** O comentário antigo
 * daqui dizia que o `Lead` não guardava de onde o contato veio e que a linha
 * entraria "quando houver origem de verdade". Havia: `atribuirOrigem` grava
 * `origem`, `origem_anuncio` e `origem_titulo` na primeira mensagem desde que o
 * `referral` do CTWA passou a ser lido, com teste. O dado estava na tela o
 * tempo todo, no despejo de "O que o fluxo coletou", indistinguível do que o
 * bot perguntou. Não faltava medir; faltava mostrar.
 *
 * **Quem não tem origem não ganha linha.** Contato anterior a `atribuirOrigem`
 * devolve `null`, e a tela cala. Escrever "Direto" para ele seria afirmar o que
 * ninguém mediu, o mesmo erro que o comentário antigo evitava com razão.
 */
export function QuemE({
  waId,
  criadoEm,
  ultimaEntradaEm,
  campos,
  passagens = [],
  nomesDosAnuncios,
}: {
  /** O telefone como o WhatsApp manda: só dígitos, com DDI. */
  waId: string
  criadoEm: string
  /** A última vez que **a pessoa** falou. `null` = ela nunca escreveu. */
  ultimaEntradaEm: string | null
  /** O que está gravado no contato. A origem sai daqui. */
  campos: Record<string, string>
  /**
   * Por onde a pessoa já chegou, da mais recente para a mais antiga.
   *
   * Vazio é o caso comum, a maioria escreve direto, sem anúncio no meio.
   */
  passagens?: Passagem[]
  /**
   * Os nomes resolvidos na Marketing API, por `ad_id`.
   *
   * Mapa vazio é normal: conta sem Ads conectado, token vencido, Meta fora do
   * ar. Cada passagem cai para o título que a pessoa leu no dia, que já está
   * guardado, a lista nunca fica vazia por causa disso.
   */
  nomesDosAnuncios?: Map<string, AnuncioEmCache>
}) {
  const origem = origemDoContato(campos)

  return (
    <dl className="mt-4 space-y-1.5 rounded-[11px] border border-line bg-panel px-3 py-2.5">
      <Linha rotulo="Telefone">
        {/*
          `tel:` e não texto solto: num celular o toque liga, e no desktop o
          número fica selecionável para copiar, que é o que se faz com ele.
          `telefoneLegivel` devolve o cru quando não reconhece o formato, então
          um número estranho aparece como está em vez de sumir.
        */}
        <a
          href={`tel:+${waId}`}
          className="font-mono text-[12px] text-soft transition hover:text-primary"
        >
          {telefoneLegivel(waId)}
        </a>
      </Linha>

      {/*
        A origem vem em segundo, logo abaixo do telefone: é a informação que
        muda a primeira frase do atendimento. Quem sabe que a pessoa clicou em
        "Filme institucional" abre a conversa sabendo do que ela quer falar.

        **O título ganha do número.** `origem_anuncio` é o `source_id` da Meta ,
        16 dígitos que não dizem nada a quem atende, e que só viram nome de
        campanha com um segundo token, de Ads, que o produto ainda não tem. O
        `headline` já é legível por gente e chega de graça no mesmo webhook,
        então ele é o que a linha mostra; o id fica no `title`, para quem
        precisar casar com o Gerenciador de Anúncios.
      */}
      {origem !== null && (
        <LinhaDeOrigem origem={origem} passagens={passagens} nomes={nomesDosAnuncios} />
      )}

      {/*
        O relativo é o que se lê; o exato fica no `title`. "há 3 meses" responde
        a pergunta, é cliente antigo ou chegou agora, e a data cheia continua
        a um passe de mouse para quem precisa da prova.
      */}
      <Linha rotulo="Cliente desde">
        <time dateTime={criadoEm} title={horaExata(criadoEm)} className="text-[12px] text-soft">
          {quando(criadoEm)}
        </time>
      </Linha>

      {/*
        A última entrada, e não a última mensagem: com o bot respondendo depois,
        a última mensagem é a dele, e a linha diria que a pessoa falou agora
        quando quem falou fomos nós.
      */}
      <Linha rotulo="Falou por último">
        {ultimaEntradaEm ? (
          <time
            dateTime={ultimaEntradaEm}
            title={horaExata(ultimaEntradaEm)}
            className="text-[12px] text-soft"
          >
            {quando(ultimaEntradaEm)}
          </time>
        ) : (
          <span className="text-[12px] text-dim">nunca escreveu</span>
        )}
      </Linha>
    </dl>
  )
}

/**
 * Por onde a pessoa chegou, todas as vezes.
 *
 * ---------------------------------------------------------------------------
 * Por que uma lista, e não um campo
 * ---------------------------------------------------------------------------
 *
 * Porque o contato é a entidade e a campanha é o meio por onde ele chegou,
 * daquela vez. Quem veio pela campanha de agosto, sumiu e voltou pela de
 * setembro passou por duas, e as duas explicam alguma coisa: a primeira, como
 * essa pessoa virou nossa; a segunda, por que ela está escrevendo hoje.
 *
 * A mais recente vem em cima porque é a que responde o presente, é ela que diz
 * o que a pessoa acabou de ver antes de abrir a conversa.
 *
 * **Contato sem passagem nenhuma ainda mostra a linha**, com o rótulo que está
 * gravado ("Direto"). Ela responde de qualquer forma: essa pessoa não veio de
 * anúncio, veio sozinha.
 */
function LinhaDeOrigem({
  origem,
  passagens,
  nomes,
}: {
  origem: { rotulo: string; titulo: string; anuncio: string }
  passagens: Passagem[]
  nomes?: Map<string, AnuncioEmCache>
}) {
  const comNome = passagensComNome(passagens, nomes ?? new Map())

  if (comNome.length === 0) {
    return (
      <Linha rotulo="Origem">
        <span
          title={origem.anuncio === '' ? undefined : `Anúncio ${origem.anuncio}`}
          className="text-[12px] text-soft"
        >
          {origem.titulo !== '' ? origem.titulo : origem.rotulo}
        </span>
      </Linha>
    )
  }

  return (
    <Linha rotulo={comNome.length === 1 ? 'Origem' : `Origem · ${comNome.length}`}>
      <ul className="space-y-1">
        {comNome.map((passagem) => (
          <li key={`${passagem.adId}-${passagem.criadoEm}`}>
            <span title={`Anúncio ${passagem.adId}`} className="text-[12px] text-soft">
              {passagem.texto}
            </span>
            {/*
              O conjunto e o criativo saem numa segunda linha, menores: eles
              distinguem duas chegadas da mesma campanha, o que importa a quem
              analisa e é ruído a quem só vai responder "oi".
            */}
            {passagem.detalhe !== null && (
              <span className="block text-[11px] text-dim">{passagem.detalhe}</span>
            )}
            {/*
              A data é o que transforma a lista em linha do tempo. Sem ela,
              "duas campanhas" é um fato solto; com ela, vira "essa pessoa é
              nossa desde agosto e voltou agora".
            */}
            <time
              dateTime={passagem.criadoEm}
              title={horaExata(passagem.criadoEm)}
              className="block text-[11px] text-dim"
            >
              {quando(passagem.criadoEm)}
            </time>
          </li>
        ))}
      </ul>
    </Linha>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[11px] text-dim">{rotulo}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  )
}
