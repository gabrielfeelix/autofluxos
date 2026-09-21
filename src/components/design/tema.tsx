'use client'

import { useSyncExternalStore } from 'react'

/**
 * As preferências que o navegador guarda e o `<html>` carrega como atributo.
 *
 * As duas seguem o mesmo desenho, e por um motivo só: as duas precisam estar
 * aplicadas **antes da primeira pintura**. Tema lido tarde pisca a tela
 * inteira; barra lida tarde pisca a largura da barra e empurra o conteúdo.
 */
export const PREFERENCIAS = {
  tema: { chave: 'autofluxos:tema', atributo: 'data-tema', quandoVale: 'escuro' },
  barra: { chave: 'autofluxos:barra', atributo: 'data-barra', quandoVale: 'recolhida' },
} as const

export type Preferencia = keyof typeof PREFERENCIAS

/**
 * Se esta pessoa é administradora da plataforma, gravado no navegador **só**
 * para o esqueleto saber disso antes de qualquer consulta terminar.
 *
 * Não é preferência e ninguém escolhe: é uma marca que a moldura do cliente
 * escreve ao montar. Existe porque o "‹ Todos os clientes" só aparece para o
 * administrador, e o esqueleto de carregamento não tem sessão para consultar.
 * Sem a marca ele desenhava a barra sem aquela linha, a barra inteira subia e
 * descia a cada troca de aba, e voltava ao lugar quando a tela chegava.
 *
 * **Não é controle de acesso.** Quem manda é `exigirAcessoAoCliente`, no
 * servidor. Aqui ela só reserva um espaço de 26px na barra: forjá-la no
 * `localStorage` rende um link para `/painel` que o servidor recusa.
 */
export const MARCA_DE_ADMIN = {
  chave: 'autofluxos:admin',
  atributo: 'data-admin',
  quandoVale: 'sim',
} as const

/**
 * A largura da coluna de conversas do Inbox.
 *
 * Fica fora de `PREFERENCIAS` porque não é um interruptor: é um número, e ele
 * chega ao CSS como variável em vez de atributo. O motivo de estar aqui mesmo
 * assim é o mesmo das outras: precisa valer **antes da primeira pintura**, ou
 * a coluna nasce com 320px e salta para a largura escolhida na frente da
 * pessoa, empurrando a conversa junto.
 *
 * A variável é lida em `MolduraDoInbox`, com `320px` de padrão embutido no
 * próprio `var()`: sem nada gravado, não há o que aplicar e o CSS resolve
 * sozinho.
 */
export const LARGURA_DA_FILA = {
  chave: 'autofluxos:fila',
  variavel: '--fila',
  padrao: 320,
  minimo: 264,
  maximo: 520,
} as const

/**
 * O script que roda **antes da primeira pintura**, no `<head>`.
 *
 * Sem ele existe o defeito clássico de todo tema gravado: a página pinta clara,
 * o React monta, o efeito lê o `localStorage` e a tela pisca para escuro. Um
 * quadro branco na cara de quem escolheu escuro, e o pisca acontece em toda
 * navegação, não só na primeira.
 *
 * Por isso é string e não componente: precisa ser síncrono, inline e antes de
 * tudo. O `try` existe porque `localStorage` lança em janela anônima com dados
 * de site bloqueados, e um tema que não carrega não pode derrubar o painel.
 */
export const SCRIPT_DAS_PREFERENCIAS =
  'var d=document.documentElement;' +
  Object.values(PREFERENCIAS)
    .map(
      (p) =>
        `try{if(localStorage.getItem('${p.chave}')==='${p.quandoVale}')d.setAttribute('${p.atributo}','${p.quandoVale}')}catch(e){}`,
    )
    .join('') +
  `try{var w=parseInt(localStorage.getItem('${LARGURA_DA_FILA.chave}'),10);` +
  `if(w>=${LARGURA_DA_FILA.minimo}&&w<=${LARGURA_DA_FILA.maximo})` +
  `d.style.setProperty('${LARGURA_DA_FILA.variavel}',w+'px')}catch(e){}` +
  `try{if(localStorage.getItem('${MARCA_DE_ADMIN.chave}')==='${MARCA_DE_ADMIN.quandoVale}')` +
  `d.setAttribute('${MARCA_DE_ADMIN.atributo}','${MARCA_DE_ADMIN.quandoVale}')}catch(e){}`

/** Escreve a preferência no `<html>` e no navegador, nesta ordem. */
export function definirPreferencia(qual: Preferencia, ligada: boolean) {
  const { chave, atributo, quandoVale } = PREFERENCIAS[qual]
  const raiz = document.documentElement
  if (ligada) raiz.setAttribute(atributo, quandoVale)
  else raiz.removeAttribute(atributo)
  try {
    localStorage.setItem(chave, ligada ? quandoVale : 'nao')
  } catch {
    // Sem onde gravar, a escolha vale só para esta aba. Pior que gravar, e
    // melhor que não deixar escolher.
  }
}

/**
 * Lê uma preferência do `<html>`.
 *
 * A fonte da verdade é o atributo, não um `useState`: quem escreve primeiro é
 * o script do `<head>`, antes de qualquer componente existir. `useSyncExternal-
 * Store` é como se lê uma fonte dessas sem inventar um segundo estado que
 * precise ser sincronizado com ela, e o `MutationObserver` faz dois botões da
 * mesma preferência concordarem sem se conhecerem.
 *
 * O servidor sempre responde `false`, e é a resposta certa: ele não tem como
 * saber o que está gravado neste navegador. Não há cookie, e criar um só para
 * isto tornaria dinâmica toda página que hoje é estática. O que ele erra é o
 * ícone do botão, corrigido no mesmo quadro em que o React assume: a tela em
 * si já foi pintada certa pelo script.
 */
/*
 * O nome começa em inglês contra a convenção do resto do repositório porque a
 * regra `react-hooks/rules-of-hooks` reconhece hook pelo prefixo `use`, e com
 * `usarPreferencia` o ESLint recusa o arquivo inteiro.
 */
export function usePreferencia(qual: Preferencia): boolean {
  const { atributo, quandoVale } = PREFERENCIAS[qual]
  return useSyncExternalStore(
    inscrever(atributo),
    () => document.documentElement.getAttribute(atributo) === quandoVale,
    () => false,
  )
}

const inscrever = (atributo: string) => (aoMudar: () => void) => {
  const observador = new MutationObserver(aoMudar)
  observador.observe(document.documentElement, { attributes: true, attributeFilter: [atributo] })
  return () => observador.disconnect()
}

/**
 * O interruptor de tema, no rodapé da barra lateral.
 *
 * **Linha inteira com rótulo, e não um ícone solto no topo.** Ele vive junto de
 * presença e conta, as outras preferências de quem está usando, e não do
 * cliente aberto. Um ícone sem palavra ao lado da marca era um enfeite que
 * ninguém associava a tema.
 *
 * Recolhido, vira só o ícone: a barra inteira é ícone nesse estado, e o `title`
 * continua dizendo o que ele faz.
 */
export function BotaoDeTema({ recolhida = false }: { recolhida?: boolean }) {
  const escuro = usePreferencia('tema')
  const rotulo = escuro ? 'Usar tema claro' : 'Usar tema escuro'

  return (
    <button
      type="button"
      onClick={() => definirPreferencia('tema', !escuro)}
      title={rotulo}
      aria-label={rotulo}
      className={`flex items-center rounded-[10px] text-muted transition hover:bg-surface hover:text-ink ${
        recolhida ? 'size-9 justify-center' : 'w-full gap-2 px-1.5 py-1.5'
      }`}
    >
      <span className={escuro ? 'text-primary' : ''}>{escuro ? <Sol /> : <Lua />}</span>
      {!recolhida && (
        <>
          <span className="flex-1 text-left text-[11.5px]">
            {escuro ? 'Tema escuro' : 'Tema claro'}
          </span>
          <span className="text-[10.5px] text-dim">trocar</span>
        </>
      )}
    </button>
  )
}

function Sol() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function Lua() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  )
}
