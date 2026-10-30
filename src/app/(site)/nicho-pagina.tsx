import Link from 'next/link'
import type { CSSProperties } from 'react'
import { GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import { IlustracaoDoRamo } from './ilustracoes-dos-ramos'
import { MODELOS_DE_TODOS, type NichoDoSite } from './nichos-do-site'
import { PreviaQueTroca } from './pecas-interativas'
import { CONVERSAS, PreviaWhatsApp } from './previa-whatsapp'
import { JanelaDaCapa, ModuloDoRamo } from './modulos-dos-ramos'
import { SecaoInboxDoRamo } from './inbox-do-ramo'
import { SecaoVendaNoChat } from './venda-no-chat'
import { Pergunta } from './pagina-do-site'
import n from './nicho.module.css'
import s from './pagina-inicial.module.css'
import x from './site.module.css'

/*
 * A página de cada ramo (`/segmentos/[slug]`). A cor do ramo pinta a página
 * inteira (o degradê da capa e do rodapé, via `PaginaDoSite`), e cada seção
 * mostra o produto como ele fica naquele ramo: a conversa, os fluxos prontos
 * na tela do app e o menu com os nomes do ramo. Dados em `nichos-do-site.ts`.
 */

const cor = (nicho: NichoDoSite) => ({ '--cor': nicho.cor }) as CSSProperties

function Seta() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6h7M6.5 3l3 3-3 3" />
    </svg>
  )
}

function Cabeca({ olho, titulo, texto }: { olho: string; titulo: string; texto?: string }) {
  return (
    <div className={s.cabecaSecao}>
      <span className={s.olho} data-revela>
        {olho}
      </span>
      <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
        {titulo}
      </h2>
      {texto && (
        <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
          {texto}
        </p>
      )}
    </div>
  )
}

/* ───────────── capa: o texto e a cena do ramo ───────────── */

export function CapaDoRamo({ nicho }: { nicho: NichoDoSite }) {
  return (
    <section className={`${s.capa} ${x.capaDividida}`} style={cor(nicho)}>
      <div className={s.veu} aria-hidden />
      <div className={`${s.faixa} ${x.capaGrade}`}>
        <div className={x.capaTexto}>
          <p className={x.capaOlho} data-entra="" style={{ '--atraso': 0 } as CSSProperties}>
            Para {nicho.nome.toLowerCase()} · {nicho.quem}
          </p>
          <h1 className={x.capaTitulo} data-entra="desfoque" style={{ '--atraso': 60 } as CSSProperties}>
            {nicho.titulo}
          </h1>
          <p className={x.capaSub} data-entra="" style={{ '--atraso': 160 } as CSSProperties}>
            {nicho.subtitulo}
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

        {/* A cena: a ilustração do ramo atrás, a conversa no centro e os fluxos prontos por cima. */}
        <div className={n.cena} data-entra="escala" style={{ '--atraso': 160 } as CSSProperties}>
          <span className={n.cenaCirculo} aria-hidden>
            <IlustracaoDoRamo slug={nicho.slug} />
          </span>
          <div className={n.cenaConversa}>
            <PreviaQueTroca chaves={nicho.conversas} />
          </div>
          <div className={n.cenaApp} aria-hidden>
            <JanelaDaCapa nicho={nicho} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────── o corpo ───────────── */

export function CorpoDoRamo({ nicho }: { nicho: NichoDoSite }) {
  const segunda = nicho.conversas[1] ?? nicho.conversas[0]!
  const nomeMinusculo = nicho.nome.toLowerCase()
  return (
    <div style={cor(nicho)}>
      {/* As três dores do ramo: o problema em destaque, a solução embaixo. */}
      <section className={s.secao}>
        <div className={s.faixa}>
          <Cabeca olho="O que muda no dia" titulo="Três conversas que deixam de tomar o seu tempo" />
          <div className={n.dores}>
            {nicho.dores.map((d, i) => (
              <article key={d.dor} className={n.dor} data-revela data-como="escala" data-atraso={i * 90}>
                <div className={n.dorProblema}>
                  <small>{String(i + 1).padStart(2, '0')} · Hoje</small>
                  <p>{d.dor}</p>
                  <span className={n.repete} aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className={n.dorSolucao}>
                  <span className={n.visto} aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  <p>{d.resposta}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* O que só este ramo tem: módulo e layout próprios. */}
      <ModuloDoRamo nicho={nicho} />

      {/* O Inbox fazendo o trabalho do ramo: produto, cupom e cobrança; ou a aula marcada na Verandi. */}
      <SecaoInboxDoRamo slug={nicho.slug} />

      {/* A venda fechada dentro do WhatsApp, com os gateways prontos. */}
      <SecaoVendaNoChat />

      {/* A IA no ramo: o que ela sabe responder, e a conversa num palco da cor do ramo. */}
      <section className={`${s.secao} ${s.secaoTonal}`}>
        <div className={`${s.faixa} ${n.iaGrade}`}>
          <div>
            <span className={s.olho} data-revela>
              A IA neste ramo
            </span>
            <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
              Responde com o que é seu, e chama a equipe no resto
            </h2>
            <ul className={n.listaIa}>
              {[...nicho.ia, 'Sem resposta na ficha, passa para a equipe em vez de inventar'].map((item, i) => (
                <li key={item} data-revela data-atraso={120 + i * 60}>
                  <span className={n.visto} aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className={n.palco} data-revela data-como="escala">
            <div className={n.palcoConversa}>
              <PreviaWhatsApp conversa={CONVERSAS[segunda]} />
            </div>
          </div>
        </div>
      </section>

      {/* Os modelos como estão na tela de automações. */}
      <section className={s.secao}>
        <div className={s.faixa}>
          <Cabeca olho="Modelos prontos" titulo="Fluxos que já vêm montados" texto="Você liga, ajusta os textos e publica. Dá para editar cada bloco depois." />
          <div className={n.app} data-revela data-como="escala">
            <div className={x.fichaBarra}>
              <i />
              <i />
              <i />
              <span>dialogon.com.br · Automações</span>
            </div>
            <div className={n.appCorpo}>
              {/* O menu do app, como em `secoes-do-cliente.tsx`, com Automações aberto. */}
              <nav className={n.appMenu} aria-hidden>
                <span className={n.appMarca}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logos/logo-dialogon-marca.png" alt="" width={18} height={18} />
                  Dialogon
                </span>
                <span>Início</span>
                <span>Conversas</span>
                <span>CRM</span>
                <span data-ativo>Automações</span>
                <span>Comércio</span>
                <span>Análise</span>
                <span>Configurações</span>
              </nav>
              <div className={n.appLista}>
                {/* O topo e as linhas seguem a tela real de `clientes/[id]/fluxos`. */}
                <div className={n.appTopo}>
                  <strong>Automações</strong>
                  <span className={n.appNova}>+ Nova automação</span>
                </div>
                <div className={n.appAbas} aria-hidden>
                  <span data-ativa>Fluxos</span>
                  <span>Gatilhos</span>
                  <span>Sequências</span>
                </div>
                <div className={n.appBusca}>Buscar automação</div>
                {[...nicho.modelos, ...MODELOS_DE_TODOS].map((m, i) => (
                  <div key={m} className={n.appLinha}>
                    <span className={n.appNome}>
                      <span className={n.appNomeTopo}>
                        {m}
                        <span className={n.seloCanal}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="#25d366" aria-hidden>
                            <path d={GLIFO_WHATSAPP} />
                          </svg>
                          WhatsApp
                        </span>
                        {i % 3 === 1 && <span className={n.seloIa}>IA</span>}
                      </span>
                      <small>
                        {6 + ((i * 5) % 9)} blocos{i === 0 ? ' · Principal' : ''}
                      </small>
                    </span>
                    <span className={n.appPublicada}>Publicada v{1 + (i % 3)}</span>
                    <b className={n.chave} aria-label="Ligada" />
                    <span className={n.appEditar}>Editar</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O menu do app com os nomes do ramo em destaque. */}
      <section className={`${s.secao} ${s.secaoTonal}`}>
        <div className={`${s.faixa} ${n.linguaGrade}`}>
          <div className={n.menuApp} data-revela data-como="escala" aria-hidden>
            <span className={n.menuMarca}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/logo-dialogon-marca.png" alt="" width={20} height={20} />
              Dialogon
            </span>
            <span>Início</span>
            <span>Conversas</span>
            {nicho.noApp.map((item) => (
              <span key={item.titulo} data-ramo>
                {item.titulo}
              </span>
            ))}
            <span>Automações</span>
            <span>Análise</span>
            <span>Configurações</span>
          </div>
          <div>
            <span className={s.olho} data-revela>
              Dentro do app
            </span>
            <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
              O Dialogon fala a língua de {nomeMinusculo}
            </h2>
            <dl className={n.lingua}>
              {nicho.noApp.map((item, i) => (
                <div key={item.titulo} data-revela data-atraso={120 + i * 70}>
                  <dt>{item.titulo}</dt>
                  <dd>{item.texto}</dd>
                </div>
              ))}
            </dl>
            <Link href="/precos" className={n.link}>
              Ver os planos <Seta />
            </Link>
          </div>
        </div>
      </section>

      {/* As dúvidas de quem é do ramo, com a resposta do que o produto faz hoje. */}
      <section className={s.secao}>
        <div className={`${s.faixa} ${n.faqGrade}`}>
          <div>
            <span className={s.olho} data-revela>
              Perguntas frequentes
            </span>
            <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
              O que {nomeMinusculo} pergunta antes de começar
            </h2>
            <p className={s.chamada} data-revela data-atraso="100">
              Não achou a sua? A gente responde pelo WhatsApp.
            </p>
            <a className={n.link} href="#conversar">
              Falar com a gente <Seta />
            </a>
          </div>
          <div className={n.faq}>
            {nicho.duvidas.map((d) => (
              <Pergunta key={d.pergunta} pergunta={d.pergunta} resposta={d.resposta} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
