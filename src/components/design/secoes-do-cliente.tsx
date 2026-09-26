import type { ReactNode } from 'react'
import { pode, type Acesso, type Capacidade, type Escopo } from '@/core/permissoes'
import { ocultoNaBarra, pacoteDo, type IconeDoComercio, type LugarDaBarra, type Nicho, type PacoteDoNicho } from '@/core/nichos'

/**
 * As seções do cliente, os subitens, os ícones, e mais nada.
 *
 * ---------------------------------------------------------------------------
 * Por que isto não mora em `cliente-shell.tsx`
 * ---------------------------------------------------------------------------
 *
 * A moldura faz três consultas ao banco antes de desenhar qualquer coisa
 * (acesso, contas, presença). Enquanto a navegação morava lá dentro, **quem
 * quisesse desenhar a barra lateral tinha de pagar as três**, e o `loading.tsx`
 * é exatamente quem não pode: ele existe para aparecer *antes* de qualquer
 * consulta terminar.
 *
 * Aqui não há `await`, não há banco, não há sessão. É o que permite o esqueleto
 * mostrar a barra lateral **de verdade**, com os nomes escritos e o item aceso,
 * em vez de blocos cinzas. As contagens chegam depois, cada uma no seu
 * `Suspense`, pela `BarraDoCliente`.
 *
 * ---------------------------------------------------------------------------
 * Seções com subitens (plano de navegação de 24/set, seção 3)
 * ---------------------------------------------------------------------------
 *
 * A barra era plana, nove itens, e metade do trabalho diário morava escondida
 * em Configurações ou em tela sem menu nenhum. Agora são seções com subitens,
 * em sanfona: só a seção atual fica aberta, e clicar no nome de outra vai para
 * o primeiro subitem dela. Início e Configurações ficam soltas, sem subitem.
 */

/**
 * A porta de cada tela: o que ela exige de quem a abre (`EXIGENCIA_DA_SECAO`)
 * e o nome que a tela de sem acesso usa.
 *
 * As chaves antigas continuam de propósito. `fluxos` é Automações e `leads` é
 * Contatos: o rótulo mudou, a chave não, e as rotas também não (`/leads`,
 * `/quadros`, `/inbox`). Renomear obrigaria a tocar todas as telas que passam
 * `ativa`, para arrumar uma palavra que só aparece aqui.
 */
export type AbaDoCliente =
  | 'inicio'
  | 'inbox'
  | 'respostas-rapidas'
  | 'canais'
  | 'leads'
  | 'etiquetas'
  | 'quadros'
  | 'atividades'
  | 'fluxos'
  | 'transmissoes'
  | 'loja'
  | 'relatorios'
  | 'vendas'
  | 'ajustes'

export type ChaveDaSecao = 'inicio' | 'conversas' | 'crm' | 'automacoes' | 'loja' | 'analise' | 'ajustes'

/** Os três números que pedem ação, e só eles (plano, seção 3, item 2). */
export type Contagem = 'minhas' | 'sem-dono' | 'atrasadas'

export type Subitem = {
  /** Único na barra inteira: é o que acende. */
  id: string
  rotulo: string
  /** Relativo a `/clientes/<id>`. */
  href: string
  /** A porta da tela, para a permissão e para o nome na tela de sem acesso. */
  aba: AbaDoCliente
  contagem?: Contagem
}

export type Secao = {
  chave: ChaveDaSecao
  rotulo: string
  icone: ReactNode
  /** Sem subitens à vista: a seção é o próprio link (Início, Configurações). */
  solta?: true
  itens: Subitem[]
}

export const SECOES: Secao[] = [
  {
    chave: 'inicio',
    rotulo: 'Início',
    icone: <IconePainel />,
    solta: true,
    itens: [{ id: 'inicio', rotulo: 'Início', href: '', aba: 'inicio' }],
  },
  {
    /*
     * "Conversas", e não "Inbox": é a palavra de quem atende, e a da Brevo, RD
     * e Kommo em português. As três visões são a mesma tela, filtrada pela URL
     * (`?de=`), para o número ficar na barra, onde ele faz alguém agir.
     */
    chave: 'conversas',
    rotulo: 'Conversas',
    icone: <IconeInbox />,
    itens: [
      { id: 'minhas', rotulo: 'Minhas conversas', href: '/inbox?de=minhas', aba: 'inbox', contagem: 'minhas' },
      { id: 'sem-dono', rotulo: 'Sem responsável', href: '/inbox?de=sem-dono', aba: 'inbox', contagem: 'sem-dono' },
      { id: 'todas', rotulo: 'Todas as conversas', href: '/inbox', aba: 'inbox' },
      { id: 'salvas', rotulo: 'Mensagens salvas', href: '/favoritas', aba: 'inbox' },
      { id: 'respostas-rapidas', rotulo: 'Respostas rápidas', href: '/conversas/respostas-rapidas', aba: 'respostas-rapidas' },
      { id: 'canais', rotulo: 'Canais', href: '/conversas/canais', aba: 'canais' },
    ],
  },
  {
    /*
     * "Negócios", e não "Funil de vendas": o cartão é a negociação
     * (`docs/MODELO-CRM.md`), e é o nome do Pipedrive e do Agendor no Brasil.
     * O seletor dentro da tela continua mostrando os funis. A rota continua
     * `/quadros`: link salvo quebrado em troca de um rótulo não se paga.
     *
     * Etiqueta é a nossa "lista" e segmento é a regra: não existe um terceiro
     * conceito (plano, seção 2).
     */
    chave: 'crm',
    rotulo: 'CRM',
    icone: <IconeContatos />,
    itens: [
      { id: 'contatos', rotulo: 'Contatos', href: '/leads', aba: 'leads' },
      { id: 'segmentos', rotulo: 'Segmentos', href: '/leads/segmentos', aba: 'leads' },
      { id: 'etiquetas', rotulo: 'Etiquetas', href: '/leads/etiquetas', aba: 'etiquetas' },
      { id: 'negocios', rotulo: 'Negócios', href: '/quadros', aba: 'quadros' },
      { id: 'atividades', rotulo: 'Atividades', href: '/atividades', aba: 'atividades', contagem: 'atrasadas' },
    ],
  },
  {
    /*
     * As abas de Automações viraram subitens: invisíveis até entrar era o
     * defeito. Os endereços são os mesmos de antes (`?aba=`), então link
     * salvo abre o mesmo lugar.
     *
     * Transmissões continua aqui dentro, e não solta: automação responde a um
     * gatilho, transmissão é alguém decidindo falar com uma lista hoje, mas as
     * duas são o produto falando sozinho com muita gente.
     */
    chave: 'automacoes',
    rotulo: 'Automações',
    icone: <IconeAutomacoes />,
    itens: [
      { id: 'fluxos', rotulo: 'Fluxos', href: '/fluxos', aba: 'fluxos' },
      { id: 'gatilhos', rotulo: 'Gatilhos', href: '/fluxos?aba=gatilhos', aba: 'fluxos' },
      { id: 'sequencias', rotulo: 'Sequências', href: '/fluxos?aba=sequencias', aba: 'fluxos' },
      { id: 'transmissoes', rotulo: 'Transmissões', href: '/transmissoes', aba: 'transmissoes' },
      { id: 'respostas-coletadas', rotulo: 'Respostas coletadas', href: '/respostas', aba: 'fluxos' },
    ],
  },
  {
    // Comércio (pedido do Gabriel, 24/set; o plano dizia "Loja"). Aparece por
    // padrão e some quando a conta desliga em Objetivo e recursos
    // (`lojaVisivel`). A chave e as rotas seguem `loja`: nenhum link quebra.
    chave: 'loja',
    rotulo: 'Comércio',
    icone: <IconeLoja />,
    itens: [
      { id: 'catalogo', rotulo: 'Produtos', href: '/loja/catalogo', aba: 'loja' },
      { id: 'conectar-loja', rotulo: 'Integrações', href: '/loja', aba: 'loja' },
    ],
  },
  {
    /*
     * Atendimento responde "como a fila andou"; Vendas, "quanto entrou, onde
     * perco e quem vende" (plano, 5.3). Vendas é sobre negócios, então some
     * junto com Negócios quando o CRM está desligado.
     */
    chave: 'analise',
    rotulo: 'Análise',
    icone: <IconeRelatorios />,
    itens: [
      { id: 'atendimento', rotulo: 'Atendimento', href: '/relatorios', aba: 'relatorios' },
      { id: 'vendas', rotulo: 'Vendas', href: '/relatorios/vendas', aba: 'vendas' },
    ],
  },
  {
    chave: 'ajustes',
    rotulo: 'Configurações',
    icone: <IconeConfiguracoes />,
    solta: true,
    itens: [{ id: 'ajustes', rotulo: 'Configurações', href: '/ajustes', aba: 'ajustes' }],
  },
]

/** Todos os subitens, na ordem da barra. */
export const ITENS: (Subitem & { secao: ChaveDaSecao })[] = SECOES.flatMap((secao) =>
  secao.itens.map((item) => ({ ...item, secao: secao.chave })),
)

/**
 * O que cada porta exige de quem a abre (E7).
 *
 * A mesma exigência vale para o menu (o subitem some) e para a moldura (a rota
 * direta mostra `SemAcesso`); as ações continuam conferindo no servidor, cada
 * uma com a sua capacidade. Duas capacidades querem dizer "qualquer uma das
 * duas": Configurações serve a quem mexe na empresa **ou** na operação.
 *
 * As telas que saíram de Configurações (Respostas rápidas, Canais, Etiquetas,
 * Loja) levaram a exigência que tinham lá. Mudar de lugar não é mudar quem
 * pode: isso seria decisão de acesso escondida numa mudança de menu.
 */
const DE_CONFIGURACAO = {
  capacidades: ['configurar_empresa', 'configurar_operacao'] as const,
  minimo: 'todos' as const,
}

export const EXIGENCIA_DA_SECAO: Partial<
  Record<AbaDoCliente, { capacidades: readonly Capacidade[]; minimo: Escopo }>
> = {
  inbox: { capacidades: ['atender'], minimo: 'proprios' },
  atividades: { capacidades: ['atender'], minimo: 'proprios' },
  leads: { capacidades: ['atender'], minimo: 'proprios' },
  quadros: { capacidades: ['criar_oportunidade'], minimo: 'proprios' },
  // Mesma porta que a página de Relatórios já usava (o escopo filtra os números).
  relatorios: { capacidades: ['atender'], minimo: 'proprios' },
  // A porta de Negócios: quem mexe em negócio vê o resultado deles (o escopo filtra).
  vendas: { capacidades: ['criar_oportunidade'], minimo: 'proprios' },
  fluxos: { capacidades: ['configurar_operacao'], minimo: 'todos' },
  transmissoes: { capacidades: ['exportar'], minimo: 'todos' },
  'respostas-rapidas': DE_CONFIGURACAO,
  canais: DE_CONFIGURACAO,
  etiquetas: DE_CONFIGURACAO,
  loja: DE_CONFIGURACAO,
  ajustes: DE_CONFIGURACAO,
}

/**
 * Esta pessoa abre esta tela?
 *
 * `regras` ausente é "não perguntei" (o esqueleto), e responde sim pelo mesmo
 * motivo do `crmVisivel`: esconder por falta de resposta faria a barra piscar.
 */
export function liberaSecao(regras: Acesso | undefined, chave: AbaDoCliente): boolean {
  if (!regras) return true
  const exigencia = EXIGENCIA_DA_SECAO[chave]
  if (!exigencia) return true
  return exigencia.capacidades.some((capacidade) => pode(regras, capacidade, exigencia.minimo))
}

/**
 * A primeira tela de quem entra na conta, relativa a `/clientes/<id>`.
 *
 * Quem atende só as próprias conversas não tem o que fazer no Início: o
 * trabalho dele é a fila, e abrir no resumo da operação é um clique a mais toda
 * manhã. Dono, gestor e membro sem restrição continuam no Início.
 *
 * Sai do **escopo**, e não do nome do papel: a sobrescrita que transforma um
 * membro em operador muda a tela inicial junto, sem ninguém lembrar de mexer
 * aqui.
 */
export function telaInicial(regras: Acesso): string {
  if (regras.ehAdminDaPlataforma) return ''
  const soOsProprios = pode(regras, 'atender', 'proprios') && !pode(regras, 'atender', 'equipe')
  return soOsProprios && liberaSecao(regras, 'inbox') ? '/inbox' : ''
}

/** O endereço de cada porta, para quem troca de conta cair no mesmo lugar. */
const ENDERECO_DA_ABA: Record<AbaDoCliente, string> = {
  inicio: '',
  inbox: '/inbox',
  'respostas-rapidas': '/conversas/respostas-rapidas',
  canais: '/conversas/canais',
  leads: '/leads',
  etiquetas: '/leads/etiquetas',
  quadros: '/quadros',
  atividades: '/atividades',
  fluxos: '/fluxos',
  transmissoes: '/transmissoes',
  loja: '/loja',
  relatorios: '/relatorios',
  vendas: '/relatorios/vendas',
  ajustes: '/ajustes',
}

function ehAba(valor: unknown): valor is AbaDoCliente {
  return typeof valor === 'string' && Object.hasOwn(ENDERECO_DA_ABA, valor)
}

/**
 * Para onde vai quem troca de conta estando em `secao`.
 *
 * Quem estava nas Conversas da Empresa 1 quer as Conversas da Empresa 2, e não
 * o Início. Se a outra conta não libera aquela tela para esta pessoa, cai na
 * tela inicial dela: mandar para a tela de "sem acesso" seria punir a troca.
 */
export function destinoNaConta(regras: Acesso, secao?: string | null): string {
  if (ehAba(secao) && secao !== 'inicio' && liberaSecao(regras, secao)) return ENDERECO_DA_ABA[secao]
  return telaInicial(regras)
}

/** O nome da tela como o menu mostra, para a tela de sem acesso dizer o mesmo. */
export function rotuloDaSecao(chave: AbaDoCliente, nicho?: Nicho | null): string {
  if (chave === 'inbox') return 'Conversas'
  const pacote = pacoteDo(nicho)
  if (chave === 'loja') return comPalavrasDoRamo(SECOES.find((secao) => secao.chave === 'loja')!, pacote).rotulo
  const item = ITENS.find((item) => item.aba === chave)
  return item ? (pacote?.rotulos[item.id as LugarDaBarra] ?? item.rotulo) : 'esta tela'
}

const ICONE_DO_COMERCIO: Record<IconeDoComercio, ReactNode> = {
  sacola: <IconeLoja />,
  talheres: <IconeTalheres />,
  vitrine: <IconeVitrine />,
}

/**
 * A seção com as palavras do ramo (`core/nichos.ts`): o nome da seção e dos
 * subitens que o pacote renomeia, sem os subitens que ele esconde, e o ícone
 * da seção Comércio.
 *
 * **A posição não muda**: quem vende e quem dá suporte explica o sistema do
 * mesmo jeito para todo ramo. O que some, some do menu; a rota continua
 * abrindo. Sem ramo, a seção sai intocada.
 */
function comPalavrasDoRamo(secao: Secao, pacote: PacoteDoNicho | null): Secao {
  if (!pacote) return secao
  const rotulo = (lugar: string, padrao: string) => pacote.rotulos[lugar as LugarDaBarra] ?? padrao
  return {
    ...secao,
    rotulo: rotulo(secao.chave, secao.rotulo),
    icone: secao.chave === 'loja' ? ICONE_DO_COMERCIO[pacote.iconeComercio] : secao.icone,
    itens: secao.itens
      .filter((item) => !ocultoNaBarra(pacote, item.id))
      .map((item) => ({ ...item, rotulo: rotulo(item.id, item.rotulo) })),
  }
}

/**
 * As seções que **esta** conta vê (T7.1), com os subitens que **esta pessoa**
 * pode usar (E7).
 *
 * ---------------------------------------------------------------------------
 * Por que a filtragem mora aqui, e não em `barra-do-cliente.tsx`
 * ---------------------------------------------------------------------------
 *
 * Pelo mesmo motivo de `SECOES` morar neste arquivo: aqui não há `await`, e é
 * isso que permite o `loading.tsx` desenhar a barra de verdade. Quem vai ao
 * banco é a moldura; ela pergunta lá e passa a resposta para cá.
 *
 * **O padrão é mostrar.** `crmVisivel`, `lojaVisivel` e `regras` ausentes
 * querem dizer "não perguntei" (é o esqueleto), e esconder por falta de
 * resposta faria a barra piscar um item a menos em todo carregamento.
 *
 * Seção sem nenhum subitem liberado some inteira: um título que abre para o
 * nada é pior que título nenhum.
 *
 * `nicho` ausente é a conta sem ramo, e o esqueleto também não pergunta: ele
 * mostra os nomes de sempre até a barra de verdade chegar com os do ramo.
 */
export function secoesVisiveis({
  crmVisivel,
  lojaVisivel,
  regras,
  nicho,
}: { crmVisivel?: boolean; lojaVisivel?: boolean; regras?: Acesso; nicho?: Nicho | null } = {}): Secao[] {
  return SECOES.filter((secao) => !(lojaVisivel === false && secao.chave === 'loja'))
    .map((secao) => comPalavrasDoRamo(secao, pacoteDo(nicho)))
    .map((secao) => ({
      ...secao,
      itens: secao.itens.filter(
        (item) =>
          !(crmVisivel === false && (item.aba === 'quadros' || item.aba === 'vendas')) && liberaSecao(regras, item.aba),
      ),
    }))
    .filter((secao) => secao.itens.length > 0)
}

/** As portas que esta pessoa alcança pelo menu, para os atalhos do Início. */
export function abasVisiveis(filtro: Parameters<typeof secoesVisiveis>[0] = {}): AbaDoCliente[] {
  return [...new Set(secoesVisiveis(filtro).flatMap((secao) => secao.itens.map((item) => item.aba)))]
}

function IconePainel() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.6" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.6" opacity=".45" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.6" opacity=".45" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.6" opacity=".45" />
    </svg>
  )
}

function IconeInbox() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.2" y="2.4" width="12.6" height="10.2" rx="2" />
      <path d="M1.6 4.2 7.5 8.4l5.9-4.2" />
    </svg>
  )
}

function IconeContatos() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="6" cy="5" r="2.6" />
      <path d="M1.4 13c0-2.4 2.1-4 4.6-4s4.6 1.6 4.6 4" />
      <path d="M10.6 3.1a2.4 2.4 0 0 1 0 4.4M11.6 9.3c1.3.5 2.1 1.6 2.1 3.1" opacity=".5" />
    </svg>
  )
}

function IconeAutomacoes() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="3.4" cy="3.4" r="2" />
      <circle cx="11.6" cy="3.4" r="2" />
      <circle cx="7.5" cy="11.8" r="2" />
      <path d="M3.4 5.4v1.4a1.6 1.6 0 0 0 1.6 1.6h5a1.6 1.6 0 0 0 1.6-1.6V5.4M7.5 8.4v1.4" />
    </svg>
  )
}

function IconeRelatorios() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2 13h11M4 10.5V8M7.5 10.5V4M11 10.5V6.5" />
    </svg>
  )
}

function IconeConfiguracoes() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7.5" cy="7.5" r="2.3" />
      <path d="M7.5 1.2v1.6M7.5 12.2v1.6M1.2 7.5h1.6M12.2 7.5h1.6M3 3l1.2 1.2M10.8 10.8 12 12M12 3l-1.2 1.2M4.2 10.8 3 12" />
    </svg>
  )
}

function IconeTalheres() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* Garfo e faca: o cardápio do restaurante. */}
      <path d="M4 1.6v4.2a1.6 1.6 0 0 0 3.2 0V1.6M5.6 1.6v12" />
      <path d="M11.2 13.6V1.6c-1.4.6-2 2.4-2 4.4v2.4h2" />
    </svg>
  )
}

function IconeVitrine() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      {/* Um toldo sobre a porta: a loja de rua. */}
      <path d="M1.6 5.4 2.6 1.8h9.8l1 3.6a1.9 1.9 0 0 1-3.8 0 1.9 1.9 0 0 1-3.8 0 1.9 1.9 0 0 1-3.8 0Z" />
      <path d="M2.6 7.2v6h9.8v-6M6 13.2V9.6h3v3.6" />
    </svg>
  )
}

function IconeLoja() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      {/* Uma sacola: a loja do cliente, e não o nosso plano. */}
      <path d="M2.6 4.6h9.8l-.7 8.2a1 1 0 0 1-1 .9H4.3a1 1 0 0 1-1-.9Z" />
      <path d="M5.2 6.4V3.9a2.3 2.3 0 0 1 4.6 0v2.5" strokeLinecap="round" />
    </svg>
  )
}
