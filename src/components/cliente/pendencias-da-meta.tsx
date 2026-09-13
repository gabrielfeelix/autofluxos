import { LogoDoCanal } from '@/components/design/selo-do-canal'
import { estaBloqueado, pendenciasDaMeta, type SaudeDaMeta } from '@/core/pendencias-da-meta'

/**
 * O aviso que explica por que as mensagens não estão chegando.
 *
 * ---------------------------------------------------------------------------
 * O silêncio era o problema
 * ---------------------------------------------------------------------------
 *
 * Um cliente conectou o WhatsApp, tudo ficou verde, e nenhuma mensagem entrou.
 * A conta dele estava bloqueada na Meta por falta de cartão. Do lado de cá não
 * havia erro nenhum para mostrar, porque não houve erro: a Cloud API
 * simplesmente não movimenta conversa nesse estado.
 *
 * Levou horas de investigação com acesso à Graph API para descobrir. Quem usa o
 * painel não tem esse acesso, e não tem como adivinhar. Então a tela conta.
 *
 * ---------------------------------------------------------------------------
 * Por que ele é assim
 * ---------------------------------------------------------------------------
 *
 * **Cada item leva a pessoa até a tela que resolve**, com os ids da conta dela
 * na URL. Sem isso ela cai num seletor da Meta e desiste no meio — e "resolva
 * na Meta" sem endereço é a mesma coisa que não avisar.
 *
 * **Numerado, e na ordem de resolver.** O que bloqueia vem antes do que só
 * limita: mandar alguém verificar o negócio (dias de fila) antes de pôr o
 * cartão (dois minutos) é fazer a pessoa esperar pelo motivo errado.
 *
 * O tom é de recado, não de erro do sistema: nada aqui quebrou por culpa dela,
 * e tratar como falha faria alguém abrir chamado em vez de resolver em dois
 * cliques.
 */
export function PendenciasDaMeta({
  saude,
  contexto,
}: {
  saude: SaudeDaMeta | null
  /**
   * Muda só a primeira frase. No Inbox a pessoa chegou estranhando uma lista
   * vazia; na tela do número ela chegou para configurar. A mesma informação,
   * respondendo a pergunta que cada uma trouxe.
   */
  contexto: 'inbox' | 'numero'
}) {
  const pendencias = pendenciasDaMeta(saude)
  if (pendencias.length === 0) return null

  const travado = estaBloqueado(saude)

  return (
    <section
      className={`mb-[18px] overflow-hidden rounded-[14px] border ${
        travado
          ? 'border-amber-400/30 bg-amber-400/[0.06]'
          : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start gap-3 px-5 pt-[18px] pb-3.5">
        <span
          style={{ color: '#25D366' }}
          className="mt-0.5 inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#25D366]/10"
        >
          <LogoDoCanal canal="whatsapp" tamanho={16} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-bold tracking-[-0.01em]">
            {travado
              ? 'A Meta está segurando as mensagens deste número'
              : 'A Meta pediu mais uma coisa neste número'}
          </h2>
          <p className="mt-1 max-w-[64ch] text-[12.5px] leading-6 text-dim">
            {travado ? (
              <>
                {contexto === 'inbox'
                  ? 'O Inbox está vazio por isso, e não porque ninguém falou com você. '
                  : 'O número está conectado certinho do nosso lado. '}
                Falta{' '}
                {pendencias.length > 1
                  ? 'resolver estas pendências na conta do WhatsApp'
                  : 'resolver esta pendência na conta do WhatsApp'}
                , e aí as conversas voltam a entrar sozinhas.
              </>
            ) : (
              'As mensagens estão entrando normalmente. Isto aqui aumenta o limite de conversas por dia quando você tiver tempo.'
            )}
          </p>
        </div>
      </div>

      <ol className="border-t border-white/[0.06]">
        {pendencias.map((pendencia, i) => (
          <li
            key={pendencia.id}
            className="flex flex-col gap-2.5 border-b border-white/[0.06] px-5 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
          >
            <span
              aria-hidden
              className={`inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                pendencia.bloqueia
                  ? 'bg-amber-400/15 text-amber-200'
                  : 'bg-white/[0.06] text-dim'
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-soft">{pendencia.titulo}</p>
              <p className="mt-0.5 text-[12px] leading-5 text-dim">{pendencia.efeito}</p>
              <p className="mt-1 text-[11.5px] leading-5 text-muted/70">{pendencia.onde}</p>
            </div>
            {pendencia.link && (
              <a
                href={pendencia.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12px] font-semibold transition ${
                  pendencia.bloqueia
                    ? 'bg-amber-400/90 text-[#1a1408] hover:bg-amber-300'
                    : 'border border-white/12 text-soft hover:bg-white/[0.06]'
                }`}
              >
                {pendencia.rotuloDoLink}
                <span aria-hidden>↗</span>
              </a>
            )}
          </li>
        ))}
      </ol>

      <p className="border-t border-white/[0.06] px-5 py-3 text-[11.5px] leading-5 text-muted/70">
        Depois de resolver, pode levar alguns minutos até a Meta liberar. Não
        precisa reconectar o número: assim que ela liberar, as conversas entram
        sozinhas.
      </p>
    </section>
  )
}
