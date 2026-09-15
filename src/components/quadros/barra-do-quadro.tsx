'use client'

import { Avatar } from '@/components/inbox/avatar'
import { Dropdown } from '@/components/design/dropdown'
import { comoDinheiro } from '@/core/crm'
import type { FiltroDoQuadro, OrdemDoQuadro, SituacaoFiltro } from '@/core/quadros'

/**
 * A barra de ações do funil — busca, filtros, ordem e a conta do que está à
 * vista.
 *
 * **Tudo acontece no navegador, em cima dos cartões que já vieram.** O quadro
 * carrega a lista inteira de uma vez para poder arrastar; filtrar no servidor
 * seria uma ida ao banco por tecla digitada para reduzir uma lista que já está
 * na memória.
 *
 * O que cada controle responde, porque nenhum deles é enfeite:
 *
 * - **busca**: "onde está a Ana" num quadro com seis colunas e oitenta cartões,
 *   sem rolar coluna por coluna;
 * - **responsável por avatar** (o gesto do Jira): "o que é meu hoje" em um
 *   clique. Avatar e não lista porque a cor da pessoa já é conhecida da fila do
 *   Inbox — reconhecer é mais rápido que ler;
 * - **situação**: o quadro guarda ganho e perdido de propósito, e por isso ele
 *   abre em **abertas**. Sem esse padrão, um funil de um ano mostraria
 *   sobretudo história;
 * - **ordem**: a fila de trabalho é o padrão, e as outras duas servem ao fim do
 *   mês e ao "o que entrou hoje";
 * - **a conta**: quantas pessoas estão à vista e quanto há em aberto. É a
 *   pergunta que se faz olhando para o funil inteiro, e ela não estava em lugar
 *   nenhum da tela.
 */
export function BarraDoQuadro({
  filtro,
  aoFiltrar,
  ordem,
  aoOrdenar,
  equipe,
  visiveis,
  somaAberta,
  escondidos,
}: {
  filtro: FiltroDoQuadro
  aoFiltrar: (filtro: FiltroDoQuadro) => void
  ordem: OrdemDoQuadro
  aoOrdenar: (ordem: OrdemDoQuadro) => void
  /** Só quem tem cartão neste quadro — filtrar por quem não aparece é clique morto. */
  equipe: { id: string; nome: string }[]
  visiveis: number
  somaAberta: number
  escondidos: number
}) {
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
      <input
        value={filtro.busca}
        onChange={(evento) => aoFiltrar({ ...filtro, busca: evento.currentTarget.value })}
        placeholder="Buscar no funil…"
        aria-label="Buscar cartão por nome, telefone ou negociação"
        className="app-field w-[210px] px-3 py-1.5 text-[12px]"
      />

      {equipe.length > 0 && (
        <span className="flex items-center gap-1">
          {equipe.map((pessoa) => {
            const escolhida = filtro.responsavel === pessoa.id
            return (
              <button
                key={pessoa.id}
                type="button"
                title={escolhida ? `Mostrando só o que é de ${pessoa.nome}` : pessoa.nome}
                aria-pressed={escolhida}
                onClick={() =>
                  aoFiltrar({ ...filtro, responsavel: escolhida ? null : pessoa.id })
                }
                className={`rounded-full transition ${
                  escolhida
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-[var(--bg)]'
                    : 'opacity-65 hover:opacity-100'
                }`}
              >
                <Avatar nome={pessoa.nome} tamanho={26} />
              </button>
            )
          })}
          {/* "Sem dono" é filtro de trabalho, não sobra de lista: é o que
              alguém abre para distribuir a fila no começo do dia. */}
          <button
            type="button"
            aria-pressed={filtro.responsavel === 'ninguem'}
            onClick={() =>
              aoFiltrar({
                ...filtro,
                responsavel: filtro.responsavel === 'ninguem' ? null : 'ninguem',
              })
            }
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              filtro.responsavel === 'ninguem'
                ? 'border-primary/40 bg-primary-weak text-primary'
                : 'border-line bg-panel text-muted hover:border-strong'
            }`}
          >
            sem dono
          </button>
        </span>
      )}

      <span className="flex items-center gap-1">
        {(
          [
            ['abertas', 'Abertas'],
            ['ganhas', 'Ganhas'],
            ['perdidas', 'Perdidas'],
            ['todas', 'Todas'],
          ] as [SituacaoFiltro, string][]
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={filtro.situacao === valor}
            onClick={() => aoFiltrar({ ...filtro, situacao: valor })}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              filtro.situacao === valor
                ? 'border-primary/40 bg-primary-weak text-primary'
                : 'border-line bg-panel text-muted hover:border-strong'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </span>

      {/* O invólucro de largura fixa, e não só a classe no `Dropdown`: a lista
          é medida pelo gatilho, e gatilho que estica ocupa a linha inteira. */}
      <span className="w-[214px] shrink-0">
        <Dropdown
          rotuloAcessivel="Ordem dos cartões na etapa"
          valor={ordem}
          aoMudar={(valor) => aoOrdenar(valor as OrdemDoQuadro)}
          className="w-full text-[12px]"
          opcoes={[
            { valor: 'espera', rotulo: 'Quem espera há mais tempo' },
            { valor: 'valor', rotulo: 'Maior valor' },
            { valor: 'recente', rotulo: 'Mais recente' },
          ]}
        />
      </span>

      <span className="ml-auto flex items-center gap-2 text-[11.5px] text-dim">
        <span>
          {visiveis === 1 ? '1 contato' : `${visiveis} contatos`}
          {somaAberta > 0 && ` · ${comoDinheiro(somaAberta)} em aberto`}
        </span>
        {/* Filtro que esconde gente sem dizer quantas é filtro que faz alguém
            concluir que os cartões sumiram. */}
        {escondidos > 0 && (
          <button
            type="button"
            onClick={() => aoFiltrar({ busca: '', responsavel: null, situacao: 'todas' })}
            className="rounded-full border border-line bg-surface px-2.5 py-1 font-semibold text-muted transition hover:border-strong"
          >
            {escondidos} fora do filtro — limpar
          </button>
        )}
      </span>
    </div>
  )
}
