import type { ReactNode } from 'react'
import { Trilha } from './trilha'
import { Pilula } from './pilula'

/**
 * O topo de toda tela da conta: título, contagem, uma frase do que a tela faz
 * e as ações à direita, **fora de cartão**.
 *
 * Cada tela montava o seu, e o resultado era botão dentro do cartão numa,
 * fora na outra, título repetido no cartão logo abaixo do título da página.
 * O padrão escolhido pelo dono é o de Contatos (02/out/2026): o título e as
 * ações moram na casca, e o cartão começa direto no conteúdo.
 *
 * Sem rótulo de seção em cima do título: quem diz a seção é o caminho no
 * cabeçalho ("Automações › Fluxos").
 */
/**
 * O topo que a página passa para um componente de cliente quando a ação da
 * tela mora nele (o modal de "+ Novo segmento" tem estado na tabela): o
 * componente desenha `CabecalhoDaTela` e põe o próprio botão nas ações.
 */
export type TopoDaTela = {
  trilha?: { rotulo: string; href?: string }[]
  titulo: ReactNode
  descricao?: ReactNode
  /** Ações da página, que vão antes da ação do componente. */
  acoes?: ReactNode
}

export function CabecalhoDaTela({
  trilha,
  titulo,
  contagem,
  descricao,
  acoes,
  className = '',
}: {
  /** O caminho de volta, para telas de segundo nível ("Configurações › Pessoas"). */
  trilha?: { rotulo: string; href?: string }[]
  titulo: ReactNode
  /** A pílula ao lado do título ("64 contatos"). */
  contagem?: ReactNode
  descricao?: ReactNode
  acoes?: ReactNode
  className?: string
}) {
  return (
    <>
    {/* Só com link de volta: sem ele, a trilha repete o caminho do cabeçalho. */}
    {trilha?.some((pedaco) => pedaco.href) && <Trilha caminho={trilha} />}
    <header className={`mb-5 flex flex-wrap items-start gap-x-4 gap-y-3 ${className}`}>
      {/* No celular o título ocupa a linha e as ações descem; senão a descrição
          espremia numa coluna de 80px ao lado dos botões. */}
      <div className="min-w-0 flex-1 basis-full md:basis-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">{titulo}</h1>
          {contagem}
        </div>
        {descricao && <div className="mt-1 max-w-[80ch] text-[13.5px] leading-5 text-muted">{descricao}</div>}
      </div>
      {acoes && <div className="topo-acoes flex flex-wrap items-center gap-2 md:pt-0.5">{acoes}</div>}
    </header>
    </>
  )
}

/** A pílula de quantidade ao lado do título ("64 contatos"). */
export function Contagem({ children }: { children: ReactNode }) {
  return (
<Pilula>{children}</Pilula>
  )
}
