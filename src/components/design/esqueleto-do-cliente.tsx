import type { ReactNode } from 'react'
import { Marca } from './marca'
import { type AbaDoCliente, ITENS } from './secoes-do-cliente'

/**
 * A moldura do cliente enquanto a tela de verdade vem — o que o `loading.tsx`
 * desenha.
 *
 * ---------------------------------------------------------------------------
 * O problema que ela resolve
 * ---------------------------------------------------------------------------
 *
 * Até 16/set/2026 não havia `loading.tsx` nenhum no projeto, e as telas eram
 * todas `force-dynamic`. Nessa combinação o Next não tem o que mostrar na hora
 * do clique: ele pede o conteúdo da rota nova e **a tela velha fica parada**
 * até a resposta chegar. Os esqueletos existiam, mas moravam dentro do
 * `page.tsx` — ou seja, chegavam junto com a resposta, cobrindo uma espera que
 * já tinha acabado.
 *
 * O `loading.tsx` é pré-carregado junto com o prefetch do link. Ele já está no
 * navegador antes do clique, o que torna a troca local: a URL muda, isto
 * aparece no mesmo quadro, e o conteúdo real entra por cima quando chega.
 *
 * ---------------------------------------------------------------------------
 * Por que a barra lateral é a de verdade, e não cinza
 * ---------------------------------------------------------------------------
 *
 * `EsqueletoDeAbas` já tinha decidido isto para a barra de abas: *os rótulos
 * são os de verdade, não blocos cinzas — trocá-los por cinza faria a barra
 * piscar a cada clique, apagando justamente a única parte da tela que a pessoa
 * acabou de usar*. Vale igual aqui, e com mais força: a barra lateral é o que
 * a pessoa clicou.
 *
 * Isto só é possível porque `secoes-do-cliente.tsx` não faz I/O. A
 * `ClienteShell` faz três consultas antes de desenhar (acesso, contas,
 * presença) e por isso não serve de esqueleto de si mesma.
 *
 * ---------------------------------------------------------------------------
 * O que fica cinza, e o que some
 * ---------------------------------------------------------------------------
 *
 * Cinza: o miolo, que é o que de fato está sendo buscado.
 *
 * Some: o rodapé da barra (conta, presença, sair) e o botão "Todos os
 * clientes". Os três dependem de consulta, e o rodapé inteiro é `md:` — desenhar
 * um retângulo cinza no lugar deles chamaria atenção para a única parte da tela
 * que ninguém está esperando.
 */
export function EsqueletoDoCliente({
  ativa,
  recolhida = false,
  children,
}: {
  ativa: AbaDoCliente
  /**
   * A barra global em ícones, como nas Configurações.
   *
   * Precisa acompanhar o `forcarRecolhida` da `AjustesShell`: se o esqueleto
   * desenhasse a barra larga e a tela real chegasse com ela estreita, o miolo
   * inteiro saltaria 158px para a esquerda na frente da pessoa — que é pior do
   * que não ter esqueleto.
   */
  recolhida?: boolean
  /** O miolo cinza. Cada seção passa o esqueleto que imita a tela dela. */
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
      <aside
        className={`flex shrink-0 flex-col border-line bg-panel md:border-r md:pt-5 md:pb-4 ${
          recolhida ? 'md:w-[68px] md:px-2.5' : 'md:w-[226px] md:px-3.5'
        }`}
      >
        <div
          className={`flex items-center gap-3 border-b border-line px-4 py-3 md:mb-5 md:border-0 md:py-0 ${
            recolhida ? 'md:justify-center md:px-0' : 'md:px-2'
          }`}
        >
          <span className={recolhida ? 'md:[&_span:last-child]:hidden' : ''}>
            <Marca />
          </span>
        </div>

        {/*
          Sem `<Link>`: durante o carregamento estes itens não são clicáveis de
          verdade — o router já está a caminho de outro lugar. Um link que
          parece funcionar e não responde é pior do que um item que só mostra
          onde a pessoa está.
        */}
        <nav
          aria-label="Seções do cliente"
          className={`flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:flex-col md:gap-0.5 md:overflow-visible md:border-0 md:p-0 ${
            recolhida ? 'md:items-center' : ''
          }`}
        >
          {ITENS.map((item) => {
            const acesa = item.chave === ativa
            return (
              <span
                key={item.chave}
                aria-current={acesa ? 'page' : undefined}
                title={item.rotulo}
                className={`flex shrink-0 items-center gap-2.5 rounded-[10px] text-[13px] font-semibold ${
                  recolhida ? 'px-2.5 py-2.5 md:size-10 md:justify-center md:px-0' : 'px-2.5 py-2.5'
                } ${acesa ? 'bg-primary-weak text-primary' : 'text-muted'}`}
              >
                <span className={acesa ? 'text-primary' : 'text-dim'}>{item.icone}</span>
                <span className={recolhida ? 'md:hidden' : ''}>{item.rotulo}</span>
              </span>
            )
          })}
        </nav>

        <div className="hidden flex-1 md:block" />
      </aside>

      <div className="relative min-w-0 flex-1 md:overflow-auto">
        <div className="flex min-h-full flex-col md:h-full">{children}</div>
      </div>
    </div>
  )
}
