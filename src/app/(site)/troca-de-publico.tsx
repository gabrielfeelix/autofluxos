import Link from 'next/link'
import s from './troca-de-publico.module.css'

/**
 * "Para pessoas / Para agentes": a mesma empresa contada duas vezes, uma para
 * quem lê com os olhos e outra para o assistente de IA que alguém mandou
 * pesquisar. Referência: a home da Capgo (capgo.app/for-agents).
 *
 * São dois links, e não um botão que troca estado: cada lado é uma URL que dá
 * para mandar, abrir sem JavaScript e o rastreador seguir.
 *
 * `tom`: `azul` no rodapé (sobre a casca azul), `escuro` na página de agentes.
 */
export function TrocaDePublico({ atual, tom }: { atual: 'pessoas' | 'agentes'; tom: 'azul' | 'escuro' }) {
  return (
    <nav aria-label="Versão do site" className={`${s.troca} ${tom === 'azul' ? s.azul : s.escuro}`}>
      <Link href="/" className={s.opcao} aria-current={atual === 'pessoas' ? 'page' : undefined}>
        Para pessoas
      </Link>
      <Link href="/para-agentes" className={s.opcao} aria-current={atual === 'agentes' ? 'page' : undefined}>
        Para agentes
      </Link>
    </nav>
  )
}
