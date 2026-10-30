import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { CenaFluxo, CenaFunil, CenaIA, CenaInbox, CenaRelatorio } from './bento-do-produto'
import {
  IlustracaoAcervo,
  IlustracaoAnotacoes,
  IlustracaoAtividades,
  IlustracaoAutomacoes,
  IlustracaoChaves,
  IlustracaoContatos,
  IlustracaoDeRelatorio,
  IlustracaoEquipe,
  IlustracaoEtiquetas,
  IlustracaoEventos,
  IlustracaoInbox,
  IlustracaoModelos,
  IlustracaoOutroAparelho,
  IlustracaoPalavrasChave,
  IlustracaoProdutos,
  IlustracaoQuadros,
  IlustracaoRespostas,
  IlustracaoRespostasRapidas,
  IlustracaoSegmentos,
  IlustracaoSequencias,
  IlustracaoTransmissoes,
  IlustracaoTudoCerto,
} from '@/components/design/ilustracoes'
import { RECURSOS, type DesenhoDoItem, type RecursoDoSite } from './recursos-do-site'
import { JanelaDeFicha } from './secoes-do-site'
import { ConversaQuePreencheAFicha, RelatoriosEmAbas } from './pecas-do-produto'
import p from './produto.module.css'
import s from './pagina-inicial.module.css'
import x from './site.module.css'
import { FotoDaPessoa } from './pessoas-do-site'

/*
 * A página de cada parte do produto (`/produto/[slug]`), no molde das páginas
 * de ramo, mas no azul do Dialogon: só o ramo pinta a página inteira. A capa
 * mostra a parte funcionando (as cenas do bento da home, maiores) com a ficha
 * técnica por cima, e cada bloco do corpo tem um tratamento próprio: as três
 * mudanças em linhas largas de texto, a peça interativa da parte e os itens
 * num bento com tons e tamanhos diferentes. Dados em `recursos-do-site.ts`.
 */

const cor = (recurso: RecursoDoSite) => ({ '--cor': recurso.cor }) as CSSProperties

/* ───────────── capa ───────────── */

/** O palco de cada parte: o tom combina com o que a cena desenha (a conversa da IA pede fundo de cor, o editor pede branco). */
/** `ficha`: o lado em que a ficha cobre o palco, o que a cena deixa livre (na IA, a resposta vem pela esquerda). */
const PALCOS: Record<string, { tom: 'claro' | 'tingido' | 'cor'; cena: () => ReactNode; ficha?: 'direita' }> = {
  fluxos: { tom: 'claro', cena: () => <CenaFluxo /> },
  ia: { tom: 'tingido', cena: () => <CenaIA />, ficha: 'direita' },
  inbox: { tom: 'tingido', cena: () => <CenaInbox /> },
  'contatos-e-funil': { tom: 'cor', cena: () => <CenaFunil /> },
  transmissoes: { tom: 'claro', cena: () => <CenaTransmissao /> },
  relatorios: { tom: 'claro', cena: () => <CenaRelatorio /> },
}

export function CapaDoProduto({ recurso }: { recurso: RecursoDoSite }) {
  const palco = PALCOS[recurso.slug]
  return (
    <section className={`${s.capa} ${x.capaDividida}`} style={cor(recurso)}>
      <div className={s.veu} aria-hidden />
      <div className={`${s.faixa} ${x.capaGrade}`}>
        <div className={x.capaTexto}>
          <p className={x.capaOlho} data-entra="" style={{ '--atraso': 0 } as CSSProperties}>
            Produto · {recurso.nome}
          </p>
          <h1 className={x.capaTitulo} data-entra="desfoque" style={{ '--atraso': 60 } as CSSProperties}>
            {recurso.titulo}
          </h1>
          <p className={x.capaSub} data-entra="" style={{ '--atraso': 160 } as CSSProperties}>
            {recurso.subtitulo}
          </p>
          <div className={s.acoes} data-entra="" style={{ '--atraso': 260 } as CSSProperties}>
            <Link className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`} href="/precos">
              Ver planos
            </Link>
            <a className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href="#conversar">
              Fale conosco
            </a>
          </div>
        </div>

        {/* A cena: a parte funcionando no palco, e a ficha técnica por cima, como a tela do app. */}
        <div className={p.cena} data-entra="escala" style={{ '--atraso': 160 } as CSSProperties}>
          {palco && (
            <div className={p.palco} data-tom={palco.tom} data-cena={recurso.slug}>
              {palco.cena()}
            </div>
          )}
          <div className={p.fichaFlutuante} data-lado={palco?.ficha}>
            <JanelaDeFicha barra={recurso.ficha.barra} titulo={recurso.ficha.titulo} linhas={recurso.ficha.linhas.slice(0, 3)} cor={recurso.cor} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────── corpo ───────────── */

/** `children`: a peça interativa da parte, entre as três mudanças e o bento dos itens. */
export function CorpoDoProduto({ recurso, children }: { recurso: RecursoDoSite; children?: ReactNode }) {
  return (
    <div style={cor(recurso)}>
      {/* As três mudanças, em linhas largas de texto: o contrário do bento que vem depois. */}
      <section className={s.secao}>
        <div className={s.faixa}>
          <span className={s.olho} data-revela>
            {recurso.nome}
          </span>
          <h2 className={`${s.tituloSecao} ${p.tituloLargo}`} data-revela data-como="desfoque" data-atraso="60">
            O que muda no dia da equipe
          </h2>
          <ol className={p.mudancas}>
            {recurso.destaques.map((d, i) => (
              <li key={d.titulo} data-revela data-atraso={120 + i * 80}>
                <h3>{d.titulo}</h3>
                <p>{d.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {children}

      <section className={`${s.secao} ${s.secaoTonal}`}>
        <div className={s.faixa}>
          <div className={s.cabecaSecao}>
            <span className={s.olho} data-revela>
              Em detalhe
            </span>
            <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
              Tudo o que vem junto
            </h2>
          </div>
        </div>
        <BentoDosItens recurso={recurso} />
      </section>

      <SecaoOutrasPartes atual={recurso.slug} />
    </div>
  )
}

/*
 * Os itens num bento de 4 colunas: a largura de cada peça vem da posição, para
 * fechar as linhas com 6 ou 9 itens (2+1+1, 1+1+2, 1+1+2). A primeira peça é
 * da cor da parte, a última larga é o degradê escuro da cor, e as do meio
 * alternam branco e tingido; o item que tem número mostra o número grande.
 */
const LARGAS = new Set([0, 5, 8])
const TONS = ['cor', 'claro', 'tingido', 'tingido', 'claro', 'claro', 'claro', 'tingido', 'fundo']

/** Os desenhos do próprio app: quem assina já conhece o traço, e o card mostra a tela de verdade. */
const DESENHOS: Record<Exclude<DesenhoDoItem, Parameters<typeof IlustracaoDeRelatorio>[0]['desenho']>, () => ReactNode> = {
  acervo: () => <IlustracaoAcervo />,
  anotacoes: () => <IlustracaoAnotacoes />,
  atividades: () => <IlustracaoAtividades />,
  automacoes: () => <IlustracaoAutomacoes />,
  chaves: () => <IlustracaoChaves />,
  contatos: () => <IlustracaoContatos />,
  equipe: () => <IlustracaoEquipe />,
  etiquetas: () => <IlustracaoEtiquetas />,
  eventos: () => <IlustracaoEventos />,
  inbox: () => <IlustracaoInbox />,
  modelos: () => <IlustracaoModelos />,
  outroAparelho: () => <IlustracaoOutroAparelho />,
  palavrasChave: () => <IlustracaoPalavrasChave />,
  produtos: () => <IlustracaoProdutos />,
  quadros: () => <IlustracaoQuadros />,
  respostas: () => <IlustracaoRespostas />,
  respostasRapidas: () => <IlustracaoRespostasRapidas />,
  segmentos: () => <IlustracaoSegmentos />,
  sequencias: () => <IlustracaoSequencias />,
  tudoCerto: () => <IlustracaoTudoCerto />,
}

function Desenho({ desenho }: { desenho: DesenhoDoItem }) {
  const proprio = DESENHOS[desenho as keyof typeof DESENHOS]
  return (
    <span className={p.itemDesenho} aria-hidden>
      {proprio ? proprio() : <IlustracaoDeRelatorio desenho={desenho as Parameters<typeof IlustracaoDeRelatorio>[0]['desenho']} />}
    </span>
  )
}

function BentoDosItens({ recurso }: { recurso: RecursoDoSite }) {
  const ultimaLarga = recurso.itens.length - 1
  return (
    <div className={p.itens}>
      {recurso.itens.map((item, i) => {
        const tom = i === ultimaLarga && LARGAS.has(i) ? 'fundo' : TONS[i]
        return (
          <article
            key={item.titulo}
            className={p.item}
            data-tom={tom}
            data-larga={LARGAS.has(i) || undefined}
            data-revela
            data-como="escala"
            data-atraso={(i % 3) * 70}
          >
            {item.numero ? <strong className={p.itemNumero}>{item.numero}</strong> : item.desenho && <Desenho desenho={item.desenho} />}
            <div>
              <h3>{item.titulo}</h3>
              <p>{item.texto}</p>
            </div>
          </article>
        )
      })}
    </div>
  )
}

/** O desenho de cada parte, tirado das telas vazias e dos relatórios do próprio app. */
const DESENHO_DA_PARTE: Record<string, () => ReactNode> = {
  fluxos: () => <IlustracaoAutomacoes />,
  ia: () => <IlustracaoProdutos />,
  inbox: () => <IlustracaoInbox />,
  'contatos-e-funil': () => <IlustracaoQuadros />,
  transmissoes: () => <IlustracaoTransmissoes />,
  relatorios: () => <IlustracaoDeRelatorio desenho="desfecho" />,
}

/**
 * Uma porta para cada parte, cada uma com a sua cor e o desenho dela: no pé de
 * cada parte (a atual fica marcada) e na visão geral de `/produto`.
 */
export function SecaoOutrasPartes({ atual }: { atual?: string }) {
  return (
    <section className={s.secao} id="partes">
      <div className={s.faixa}>
        <div className={s.cabecaSecao}>
          <span className={s.olho} data-revela>
            {atual ? 'O resto do produto' : 'Cada parte'}
          </span>
          <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
            {atual ? 'Cada parte conversa com as outras' : 'Veja cada parte em detalhe'}
          </h2>
        </div>
        <nav className={p.partes} aria-label="Partes do produto">
          {RECURSOS.map((r, i) => (
            <Link
              key={r.slug}
              href={`/produto/${r.slug}`}
              className={p.parte}
              style={cor(r)}
              aria-current={r.slug === atual ? 'page' : undefined}
              data-revela
              data-como="escala"
              data-atraso={(i % 3) * 70}
            >
              <span className={p.parteArte} aria-hidden>
                {DESENHO_DA_PARTE[r.slug]?.()}
                {r.slug === atual && <em className={p.parteAqui}>Você está aqui</em>}
              </span>
              <span className={p.parteTexto}>
                <strong>{r.nome}</strong>
                <span>{r.linha}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  )
}

/* ───────────── as peças novas, com a cabeça de cada uma ───────────── */

function Cabeca({ olho, titulo, texto }: { olho: string; titulo: string; texto: string }) {
  return (
    <div className={`${s.faixa} ${s.cabecaSecao}`}>
      <span className={s.olho} data-revela>
        {olho}
      </span>
      <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
        {titulo}
      </h2>
      <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
        {texto}
      </p>
    </div>
  )
}

export function SecaoConversaPreenche() {
  return (
    <section className={s.secao}>
      <Cabeca
        olho="Na prática"
        titulo="A conversa preenche a ficha e move o cartão"
        texto="O que o fluxo pergunta vira campo do contato. Quando a equipe assume e a venda sai, o cartão anda no funil sem ninguém arrastar."
      />
      <div className={p.palcoLargo} data-revela data-como="escala">
        <ConversaQuePreencheAFicha />
      </div>
    </section>
  )
}

export function SecaoRelatoriosEmAbas() {
  return (
    <section className={s.secao}>
      <Cabeca
        olho="Na prática"
        titulo="Três perguntas que o relatório responde"
        texto="Quanto o chatbot resolveu, quanto entrou de venda e em que hora a equipe faz falta. Cada número vem com a explicação na tela."
      />
      <div data-revela data-como="escala">
        <RelatoriosEmAbas />
      </div>
    </section>
  )
}

/* ───────────── a cena das transmissões ───────────── */

/*
 * A campanha andando: cada contato passa de na fila a enviado, entregue e
 * lido, um depois do outro, e as barras do topo enchem junto. Os status são
 * os da tela de transmissões; a loja e os números são de exemplo.
 */
const CONTATOS_DA_CAMPANHA: [string, string][] = [
  ['MC', 'Marina Costa'],
  ['TS', 'Tiago Souza'],
  ['JP', 'Júlia Pereira'],
  ['AL', 'André Lima'],
  ['NB', 'Nina Barros'],
  ['RS', 'Rafael Souza'],
]

function CenaTransmissao() {
  return (
    <div className={p.campanha} aria-hidden>
      <div className={p.campanhaTopo}>
        <small>Transmissão · agendada para 10:00</small>
        <b>Promoção de sábado</b>
        <span className={p.campanhaModelo}>Modelo aprovado pela Meta · etiqueta &quot;clientes&quot;</span>
      </div>
      <div className={p.campanhaBarras}>
        {[
          ['Enviadas', '1.240'],
          ['Entregues', '1.198'],
          ['Lidas', '874'],
        ].map(([rotulo, valor], i) => (
          <span key={rotulo} style={{ '--n': i } as CSSProperties}>
            <small>{rotulo}</small>
            <b>{valor}</b>
            <i />
          </span>
        ))}
      </div>
      <ul className={p.campanhaLista}>
        {CONTATOS_DA_CAMPANHA.map(([, nome], n) => (
          <li key={nome} style={{ '--n': n } as CSSProperties}>
            <i>
              <FotoDaPessoa nome={nome} />
            </i>
            <span>{nome}</span>
            <em className={p.estados}>
              <span data-estado="fila">Na fila</span>
              <span data-estado="enviado">Enviado</span>
              <span data-estado="entregue">Entregue</span>
              <span data-estado="lido">Lido</span>
            </em>
          </li>
        ))}
      </ul>
    </div>
  )
}
