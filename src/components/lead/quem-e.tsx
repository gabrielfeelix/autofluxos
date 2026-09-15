import { comoMostrar, type NomesDoAnuncio } from '@/core/anuncios'
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
 * "O que o fluxo coletou" — que é o que o bot perguntou, não quem ela é. O
 * telefone e a data de chegada não apareciam em lugar nenhum desta tela: para
 * ver o número era preciso sair do Inbox e abrir a Ficha.
 *
 * Isso apareceu como reclamação do rótulo ("O que o fluxo coletou"), mas o
 * rótulo estava certo — ele distingue o que a automação coletou do que a equipe
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
 * tempo todo — no despejo de "O que o fluxo coletou", indistinguível do que o
 * bot perguntou. Não faltava medir; faltava mostrar.
 *
 * **Quem não tem origem não ganha linha.** Contato anterior a `atribuirOrigem`
 * devolve `null`, e a tela cala. Escrever "Direto" para ele seria afirmar o que
 * ninguém mediu — o mesmo erro que o comentário antigo evitava com razão.
 */
export function QuemE({
  waId,
  criadoEm,
  ultimaEntradaEm,
  campos,
  nomesDoAnuncio = null,
}: {
  /** O telefone como o WhatsApp manda: só dígitos, com DDI. */
  waId: string
  criadoEm: string
  /** A última vez que **a pessoa** falou. `null` = ela nunca escreveu. */
  ultimaEntradaEm: string | null
  /** O que está gravado no contato. A origem sai daqui. */
  campos: Record<string, string>
  /**
   * Os nomes resolvidos na Marketing API, quando a conta conectou o Ads.
   *
   * `null` é o caso comum — conta sem Ads conectado, token vencido, Meta fora
   * do ar. A linha continua aparecendo com o título do anúncio, e é por isso
   * que este parâmetro tem default: quem não sabe de anúncio nenhum não
   * precisa saber que ele existe.
   */
  nomesDoAnuncio?: NomesDoAnuncio | null
}) {
  const origem = origemDoContato(campos)

  return (
    <dl className="mt-4 space-y-1.5 rounded-[11px] border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <Linha rotulo="Telefone">
        {/*
          `tel:` e não texto solto: num celular o toque liga, e no desktop o
          número fica selecionável para copiar — que é o que se faz com ele.
          `telefoneLegivel` devolve o cru quando não reconhece o formato, então
          um número estranho aparece como está em vez de sumir.
        */}
        <a
          href={`tel:+${waId}`}
          className="font-mono text-[11px] text-soft transition hover:text-accent"
        >
          {telefoneLegivel(waId)}
        </a>
      </Linha>

      {/*
        A origem vem em segundo, logo abaixo do telefone: é a informação que
        muda a primeira frase do atendimento. Quem sabe que a pessoa clicou em
        "Filme institucional" abre a conversa sabendo do que ela quer falar.

        **O título ganha do número.** `origem_anuncio` é o `source_id` da Meta —
        16 dígitos que não dizem nada a quem atende, e que só viram nome de
        campanha com um segundo token, de Ads, que o produto ainda não tem. O
        `headline` já é legível por gente e chega de graça no mesmo webhook,
        então ele é o que a linha mostra; o id fica no `title`, para quem
        precisar casar com o Gerenciador de Anúncios.
      */}
      {origem !== null && <LinhaDeOrigem origem={origem} nomes={nomesDoAnuncio} />}

      {/*
        O relativo é o que se lê; o exato fica no `title`. "há 3 meses" responde
        a pergunta — é cliente antigo ou chegou agora — e a data cheia continua
        a um passe de mouse para quem precisa da prova.
      */}
      <Linha rotulo="Cliente desde">
        <time dateTime={criadoEm} title={horaExata(criadoEm)} className="text-[11px] text-soft">
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
            className="text-[11px] text-soft"
          >
            {quando(ultimaEntradaEm)}
          </time>
        ) : (
          <span className="text-[11px] text-dim">nunca escreveu</span>
        )}
      </Linha>
    </dl>
  )
}

/**
 * A origem, com o melhor nome que existir para ela.
 *
 * A escolha do texto está em `comoMostrar`, e não aqui, porque ela é a regra do
 * produto — nome da campanha ganha do título do anúncio, que ganha do rótulo —
 * e regra de produto testada por `npm test` não depende de alguém abrir a tela.
 *
 * O `title` carrega o `ad_id` mesmo quando o nome aparece: é o número que casa
 * com o Gerenciador de Anúncios, e quem for conferir investimento precisa dele.
 */
function LinhaDeOrigem({
  origem,
  nomes,
}: {
  origem: { rotulo: string; titulo: string; anuncio: string }
  nomes: NomesDoAnuncio | null
}) {
  const { texto, detalhe } = comoMostrar({
    rotulo: origem.rotulo,
    titulo: origem.titulo,
    nomes,
  })

  return (
    <Linha rotulo="Origem">
      <span
        title={origem.anuncio === '' ? undefined : `Anúncio ${origem.anuncio}`}
        className="text-[11px] text-soft"
      >
        {texto}
      </span>
      {/*
        O conjunto e o criativo numa segunda linha, menor: eles distinguem duas
        conversas da mesma campanha, o que importa a quem analisa e é ruído a
        quem só vai responder "oi". Some quando não há nome resolvido.
      */}
      {detalhe !== null && <span className="block text-[10px] text-dim">{detalhe}</span>}
    </Linha>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[10px] text-dim">{rotulo}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  )
}
