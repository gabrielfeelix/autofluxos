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
 * **"Origem" não entra porque não existe.** O `Lead` não guarda de onde o
 * contato veio — não há campo, não há coluna. Mostrar "WhatsApp" para todo
 * mundo seria escrever na tela uma informação que não foi medida, e dado que
 * não distingue ninguém ocupa espaço sem responder nada. Quando houver origem
 * de verdade (anúncio, link, importação), ela entra aqui.
 */
export function QuemE({
  waId,
  criadoEm,
  ultimaEntradaEm,
}: {
  /** O telefone como o WhatsApp manda: só dígitos, com DDI. */
  waId: string
  criadoEm: string
  /** A última vez que **a pessoa** falou. `null` = ela nunca escreveu. */
  ultimaEntradaEm: string | null
}) {
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

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[10px] text-dim">{rotulo}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  )
}
