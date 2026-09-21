import type { ReactNode } from 'react'
import { Marca } from './marca'
import { BarraLateral } from './barra-lateral'
import { type AbaDoCliente, ITENS } from './secoes-do-cliente'

/**
 * O "‹ Todos os clientes" fica **escrito** aqui, e não em branco.
 *
 * Ele é só do administrador, e o esqueleto não tem sessão para perguntar: quem
 * responde é a marca `data-admin` no `<html>`, posta antes da primeira pintura
 * (ver `.voltar-reservado` em `globals.css`). Sem isso a linha sumia enquanto a
 * próxima aba vinha e voltava quando ela chegava, com a barra inteira subindo e
 * descendo a cada clique.
 */
const VOLTAR_RESERVADO = (
  <span className="voltar-reservado items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-dim md:mb-1.5">
    <span aria-hidden>‹</span> Todos os clientes
  </span>
)

/** Usa a mesma estrutura da navegação pronta, incluindo grupos e recolhimento. */
export function EsqueletoDoCliente({ ativa, children }: { ativa: AbaDoCliente; children: ReactNode }) {
  return <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
    <BarraLateral carregando marca={<Marca />} identidadeNoCelular={<span className="h-4 w-20 animate-pulse rounded bg-surface" />} voltar={VOLTAR_RESERVADO}
      itens={ITENS.map((item) => ({ ...item, href: '#', acesa: item.chave === ativa }))}
      rodape={<p className="text-sm text-dim">Carregando sua conta…</p>} />
    <div className="relative min-w-0 flex-1 md:overflow-auto"><div className="flex min-h-full flex-col md:h-full">{children}</div></div>
  </div>
}
