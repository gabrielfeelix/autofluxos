import type { ReactNode } from 'react'
import { Marca } from './marca'
import { BarraLateral } from './barra-lateral'
import { type ChaveDaSecao, SECOES } from './secoes-do-cliente'

/**
 * O "‹ Administração" fica **escrito** aqui, e não em branco.
 *
 * Ele é só do administrador, e o esqueleto não tem sessão para perguntar: quem
 * responde é a marca `data-admin` no `<html>`, posta antes da primeira pintura
 * (ver `.voltar-reservado` em `globals.css`). Sem isso a linha sumia enquanto a
 * próxima aba vinha e voltava quando ela chegava, com a barra inteira subindo e
 * descendo a cada clique.
 */
const VOLTAR_RESERVADO = (
  <span className="voltar-reservado items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-dim md:mb-1.5">
    <span aria-hidden>‹</span> Administração
  </span>
)

/**
 * A barra de verdade, com os nomes escritos e o Início aceso, antes de qualquer
 * consulta. Usa `SECOES` inteira (sem permissão nem recurso, que o esqueleto
 * não tem como perguntar) e o cookie da barra recolhida, para a largura já
 * nascer certa.
 */
export function EsqueletoDoCliente({ ativa, recolhida = false, children }: { ativa: ChaveDaSecao; recolhida?: boolean; children: ReactNode }) {
  return <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
    <BarraLateral carregando marca={<Marca />} voltar={VOLTAR_RESERVADO}
      contaNoTopo={<span className="block h-[36px]" />}
      recolhidaInicial={recolhida}
      aceso={{ secao: ativa, item: ativa === 'inicio' ? 'inicio' : null }}
      secoes={SECOES.map((secao) => ({ ...secao, itens: secao.itens.map((item) => ({ ...item, href: '#' })) }))}
      rodape={<p className="text-sm text-dim">Carregando sua organização…</p>} />
    <div className="relative min-w-0 flex-1 md:overflow-auto"><div className="flex min-h-full flex-col md:h-full">{children}</div></div>
  </div>
}

/**
 * O miolo de uma tela da conta enquanto ela vem, **sem barra**.
 *
 * A barra mora no `layout.tsx` e continua na tela durante a navegação; o
 * `loading.tsx` de cada seção só troca o miolo. Mesmas classes do miolo pronto
 * (`ClienteShell`), para a altura não pular quando a tela chega.
 */
export function MioloCarregando({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full flex-col md:h-full">{children}</div>
}
