import Link from 'next/link'

/**
 * Onde você está, a trilha acima do título.
 *
 * A barra lateral acende "Configurações" para **nove** telas diferentes
 * (WhatsApp, Instagram, chaves de API, contexto, acervo, equipe, etiquetas,
 * horário, respostas rápidas). Isso responde "em que seção estou", e nenhuma
 * delas respondia "em qual das nove", o título dizia "Número do WhatsApp" sem
 * nada ligando aquilo a Configurações, e o caminho de volta era o item já aceso
 * na lateral, que não parece um botão de voltar porque não é.
 *
 * O último pedaço **não é link**: ele é a página em que a pessoa está, e um
 * link para o lugar onde já se está é um clique que não faz nada.
 *
 * Existe como componente e não como texto solto em cada tela porque nove cópias
 * de uma trilha divergem, em separador, em tamanho, e sobretudo em quem
 * lembrou de atualizar quando uma seção mudou de nome. `Configurações` já foi
 * `Ajustes` uma vez.
 */
export function Trilha({
  caminho,
}: {
  /** Do mais geral para o mais específico. O último é onde a pessoa está. */
  caminho: { rotulo: string; href?: string }[]
}) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-2 flex flex-wrap items-center gap-1.5">
      {caminho.map((pedaco, indice) => {
        const ultimo = indice === caminho.length - 1
        return (
          <span key={`${pedaco.rotulo}-${indice}`} className="flex items-center gap-1.5">
            {indice > 0 && (
              <span aria-hidden className="text-[11px] text-dim/60">
                /
              </span>
            )}
            {pedaco.href && !ultimo ? (
              <Link
                href={pedaco.href}
                className="text-[11.5px] text-dim transition hover:text-primary"
              >
                {pedaco.rotulo}
              </Link>
            ) : (
              <span
                // `aria-current` diz ao leitor de tela que este é o lugar
                // atual, sem ele a trilha vira uma lista de palavras soltas.
                aria-current={ultimo ? 'page' : undefined}
                className={ultimo ? 'text-[11.5px] font-semibold text-muted' : 'text-[11.5px] text-dim'}
              >
                {pedaco.rotulo}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
