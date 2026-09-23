import type { ReactNode } from 'react'
import { pode, type Acesso, type Capacidade, type Escopo } from '@/core/permissoes'

/**
 * As seções do cliente, a lista, os ícones, e mais nada.
 *
 * ---------------------------------------------------------------------------
 * Por que isto saiu de `cliente-shell.tsx`
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
 * em vez de sete blocos cinzas.
 *
 * ---------------------------------------------------------------------------
 * A regra que isso preserva
 * ---------------------------------------------------------------------------
 *
 * O `EsqueletoDeAbas` já dizia, sobre a barra de abas: *os rótulos são os de
 * verdade, não blocos cinzas, trocá-los por cinza faria a barra piscar a cada
 * clique, apagando justamente a única parte da tela que a pessoa acabou de
 * usar*. O raciocínio vale igual para a barra lateral, e só vale porque esta
 * lista não depende de I/O nenhum.
 */

export type AbaDoCliente =
  | 'inicio'
  | 'atividades'
  | 'fluxos'
  | 'transmissoes'
  | 'leads'
  | 'quadros'
  | 'relatorios'
  | 'inbox'
  | 'ajustes'

/**
 * As chaves são as antigas de propósito.
 *
 * `fluxos` acende "Automações" e `leads` acende "Contatos", o rótulo mudou, a
 * chave não. Renomear as duas obrigaria a tocar as doze telas que passam
 * `ativa`, para arrumar uma palavra que só aparece aqui. É a mesma decisão que
 * manteve a rota `/leads` quando a aba virou "Contatos".
 */
export const ITENS: {
  chave: AbaDoCliente
  rotulo: string
  href: string
  icone: ReactNode
}[] = [
  { chave: 'inicio', rotulo: 'Painel', href: '', icone: <IconePainel /> },
  { chave: 'inbox', rotulo: 'Inbox', href: '/inbox', icone: <IconeInbox /> },
  { chave: 'atividades', rotulo: 'Atividades', href: '/atividades', icone: <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-12 5 2 2 5-4"/></svg> },
  { chave: 'leads', rotulo: 'Contatos', href: '/leads', icone: <IconeContatos /> },
  // Quadros entra ao lado de Contatos, e não no fim, porque é a mesma gente
  // olhada de outro jeito: a lista responde "quem existe", o quadro responde
  // "em que ponto cada um está".
  /*
   * **"Funil de vendas", a rota continua `/quadros`.**
   *
   * O nome foi "Quadros" enquanto a tela era só a posição da pessoa no funil, e
   * "Quadros" descreve o desenho (colunas), não o trabalho. Virou "Funis" quando
   * ela ganhou negociação, valor, ganho e perda, e agora "Funil de vendas"
   * porque sozinha a palavra é ambígua: este produto também tem funil de
   * automação, e quem chega não sabe qual dos dois o menu está oferecendo.
   *
   * O singular não esconde que são vários, captação, comercial, pós-venda: o
   * seletor dentro da tela continua mostrando todos. É o nome da seção, e é
   * assim que o mercado a chama. A URL não muda: link salvo quebrado em troca
   * de um rótulo não se paga.
   */
  { chave: 'quadros', rotulo: 'Funil de vendas', href: '/quadros', icone: <IconeQuadros /> },
  // Relatórios fica no dia a dia, logo abaixo do funil: é onde se olha como a
  // semana andou. Todo mundo que atende vê, cada um no próprio escopo; o corte
  // é feito na consulta, não no menu (plano de UX, 11.1).
  { chave: 'relatorios', rotulo: 'Relatórios', href: '/relatorios', icone: <IconeRelatorios /> },
  { chave: 'fluxos', rotulo: 'Automações', href: '/fluxos', icone: <IconeAutomacoes /> },
  /*
   * Transmissões entra ao lado de Automações, e não dentro delas.
   *
   * Ela nasceu como um link dentro do texto da aba Campanhas, e isso foi um
   * erro que custou o tempo de alguém procurando: tela que existe e não se
   * acha é tela que não existe. O trabalho aqui também é de outra natureza ,
   * automação responde a um gatilho, transmissão é alguém decidindo falar com
   * uma lista hoje.
   */
  {
    chave: 'transmissoes',
    rotulo: 'Transmissões',
    href: '/transmissoes',
    icone: <IconeTransmissoes />,
  },
  { chave: 'ajustes', rotulo: 'Configurações', href: '/ajustes', icone: <IconeConfiguracoes /> },
]

/**
 * O que cada seção exige de quem a abre (E7).
 *
 * A mesma exigência vale para o menu (o item some) e para a moldura (a rota
 * direta mostra `SemAcesso`); as ações continuam conferindo no servidor, cada
 * uma com a sua capacidade. Duas capacidades numa seção querem dizer
 * "qualquer uma das duas": Configurações serve a quem mexe na empresa **ou** na
 * operação.
 *
 * Não muda acesso de ninguém que já existe: `member` sem exceção tem todas as
 * capacidades abaixo em `todos`. Quem perde itens do menu é quem já não
 * conseguia usar a tela (o acesso de atendimento, por exemplo), e que até
 * aqui abria a tela para ser recusado no primeiro clique.
 */
export const EXIGENCIA_DA_SECAO: Partial<
  Record<AbaDoCliente, { capacidades: readonly Capacidade[]; minimo: Escopo }>
> = {
  inbox: { capacidades: ['atender'], minimo: 'proprios' },
  atividades: { capacidades: ['atender'], minimo: 'proprios' },
  leads: { capacidades: ['atender'], minimo: 'proprios' },
  quadros: { capacidades: ['criar_oportunidade'], minimo: 'proprios' },
  // Mesma porta que a página de Relatórios já usava (o escopo filtra os números).
  relatorios: { capacidades: ['atender'], minimo: 'proprios' },
  fluxos: { capacidades: ['configurar_operacao'], minimo: 'todos' },
  transmissoes: { capacidades: ['exportar'], minimo: 'todos' },
  ajustes: { capacidades: ['configurar_empresa', 'configurar_operacao'], minimo: 'todos' },
}

/**
 * Esta pessoa abre esta seção?
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

/** O nome da seção como o menu mostra, para a tela de sem acesso dizer o mesmo. */
export function rotuloDaSecao(chave: AbaDoCliente): string {
  return ITENS.find((item) => item.chave === chave)?.rotulo ?? 'esta tela'
}

/**
 * As seções que **esta** conta vê (T7.1), e que **esta pessoa** pode usar (E7).
 *
 * ---------------------------------------------------------------------------
 * Por que a filtragem mora aqui, e não em `cliente-shell.tsx`
 * ---------------------------------------------------------------------------
 *
 * Pelo mesmo motivo de `ITENS` morar neste arquivo: aqui não há `await`, não há
 * banco e não há sessão, e é isso que permite o `loading.tsx` desenhar a barra
 * de verdade. Quem vai ao banco é a moldura; ela pergunta lá e passa a resposta
 * para cá.
 *
 * **O padrão é mostrar.** `crmVisivel` e `regras` ausentes querem dizer "não
 * perguntei" (é o esqueleto, que não pergunta nada), e esconder por falta de
 * resposta faria a barra piscar um item a menos em todo carregamento:
 * exatamente o defeito que este arquivo existe para não ter.
 *
 * O funil escondido por preferência (CRM desligado) e a seção escondida por
 * acesso são coisas diferentes, e a rota direta diz qual das duas é (E8): a
 * moldura mostra "o funil está desligado" num caso e `SemAcesso` no outro.
 */
export function secoesVisiveis({
  crmVisivel,
  regras,
}: { crmVisivel?: boolean; regras?: Acesso } = {}): typeof ITENS {
  return ITENS.filter(
    (item) => !(crmVisivel === false && item.chave === 'quadros') && liberaSecao(regras, item.chave),
  )
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

function IconeQuadros() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.4" y="2" width="3.4" height="11" rx="1" />
      <rect x="5.8" y="2" width="3.4" height="7.4" rx="1" />
      <rect x="10.2" y="2" width="3.4" height="9.2" rx="1" opacity=".6" />
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

function IconeTransmissoes() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      {/* Um megafone: falar com muita gente de uma vez. */}
      <path d="M2.2 6v3a1 1 0 0 0 1 1h1.4l4.6 2.6V3.4L5.6 6H3.2a1 1 0 0 0-1 1Z" strokeLinejoin="round" />
      <path d="M11.2 5.6a2.8 2.8 0 0 1 0 4.4" strokeLinecap="round" />
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
