import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { DIAS_DE_TESTE, PLANOS } from '@/core/planos'
import { DerivaDeParticulas } from './deriva-de-particulas'
import { CANAIS } from './canais-do-site'
import { MODELOS_DE_TODOS, NICHOS_DO_SITE, type NichoDoSite } from './nichos-do-site'
import { CalculadoraMeta, DoisLados, PreviaQueTroca } from './pecas-interativas'
import { CONVERSAS, PreviaWhatsApp } from './previa-whatsapp'
import { ITENS_DE_INTEGRACAO } from './integracoes-do-site'
import { VitrineDeIntegracoes } from './vitrine-de-integracoes'
import { GLIFO_INSTAGRAM, GLIFO_TELEGRAM, GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import s from './pagina-inicial.module.css'
import x from './site.module.css'

/*
 * As seções do site institucional (`docs/PLANO-SITE-INSTITUCIONAL.md`). Cada
 * ideia aparece uma vez: a home apresenta e leva para a página que detalha.
 */

const precoDeEntrada = Math.min(...PLANOS.map((p) => p.preco))
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function Cabeca({ olho, titulo, texto, id }: { olho: string; titulo: ReactNode; texto?: ReactNode; id?: string }) {
  return (
    <div className={s.cabecaSecao} id={id}>
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

/* ─────────────────────────── capas ─────────────────────────── */

export function CapaDaHome() {
  return (
    <section className={`${s.capa} ${x.capaSimples}`}>
      <DerivaDeParticulas className={s.campo} />
      <div className={s.veu} aria-hidden />
      <div className={`${s.faixa} ${x.capaSimplesInterno}`}>
        <p className={s.selo} data-revela>
          <span className={s.seloTag}>Novo</span>
          API oficial do WhatsApp Business
        </p>
        <h1 className={`${x.capaTitulo} ${x.capaTituloHome}`} data-revela data-como="desfoque" data-atraso="80">
          Seu WhatsApp responde na hora. <em>Sua equipe entra quando precisa.</em>
        </h1>
        <p className={x.capaSub} data-revela data-atraso="200">
          Chatbot, IA e a caixa de entrada da equipe no número que você já usa. Horário, preço, agenda e pedido se
          resolvem na conversa; o que precisa de gente chega à equipe com o histórico ao lado.
        </p>
        <div className={s.acoes} data-revela data-atraso="300">
          <Link className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`} href="/precos">
            Ver planos
          </Link>
          <a className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href="#conversar">
            Fale conosco
          </a>
        </div>
      </div>
    </section>
  )
}

export function CapaSimples({ olho, titulo, texto, children }: { olho: string; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <section className={`${s.capa} ${x.capaSimples}`}>
      <div className={s.veu} aria-hidden />
      <div className={`${s.faixa} ${x.capaSimplesInterno}`}>
        <p className={x.capaOlho} data-revela>
          {olho}
        </p>
        <h1 className={x.capaTitulo} data-revela data-como="desfoque" data-atraso="60">
          {titulo}
        </h1>
        <p className={x.capaSub} data-revela data-atraso="160">
          {texto}
        </p>
        {children}
      </div>
    </section>
  )
}

export function CapaDoNicho({ nicho }: { nicho: NichoDoSite }) {
  return (
    <section className={`${s.capa} ${x.capaDividida}`}>
      <div className={s.veu} aria-hidden />
      <div className={`${s.faixa} ${x.capaGrade}`}>
        <div className={x.capaTexto}>
          <p className={x.capaOlho} data-revela>
            Para {nicho.nome.toLowerCase()} · {nicho.quem}
          </p>
          <h1 className={x.capaTitulo} data-revela data-como="desfoque" data-atraso="60">
            {nicho.titulo}
          </h1>
          <p className={x.capaSub} data-revela data-atraso="160">
            {nicho.subtitulo}
          </p>
          <div className={s.acoes} data-revela data-atraso="260">
            <Link className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`} href="/precos">
              Ver planos
            </Link>
            <a className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href="#conversar">
              Fale conosco
            </a>
          </div>
        </div>
        <div className={x.capaVisual} data-revela data-como="escala" data-atraso="160">
          <PreviaQueTroca chaves={nicho.conversas} />
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── home ─────────────────────────── */

export function SecaoNichos() {
  return (
    <section className={s.secao} id="nichos">
      <div className={s.faixa}>
        <Cabeca
          olho="Para quem é"
          titulo="Pronto para o seu tipo de negócio"
          texto="Cada ramo entra com os modelos, os nomes e a IA do seu dia a dia. O plano é o mesmo; muda o que vem pronto."
        />
        <div className={x.nichos}>
          {NICHOS_DO_SITE.map((n, i) => (
            <Link
              key={n.slug}
              href={`/segmentos/${n.slug}`}
              className={x.nicho}
              style={{ '--cor': n.cor } as CSSProperties}
              data-revela
              data-como="escala"
              data-atraso={i * 80}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={n.foto} alt="" width={400} height={260} />
              <span className={x.nichoTexto}>
                <strong>{n.nome}</strong>
                <small>{n.quem}</small>
              </span>
              <span className={x.nichoMais}>
                Ver como funciona <Seta />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SecaoIntegracoesResumo() {
  const logos = ITENS_DE_INTEGRACAO.filter((i) => !i.emBreve).slice(0, 14)
  return (
    <section className={s.secao}>
      <div className={s.faixa}>
        <Cabeca olho="Integrações" titulo="Liga no que você já usa" />
        <div className={x.logos} data-revela>
          {logos.map((l) => (
            <span key={l.nome} title={l.nome}>
              {l.marca}
              {l.nome}
            </span>
          ))}
        </div>
        <p className={x.centro} data-revela>
          <Link href="/integracoes" className={x.linkForte}>
            Ver as {ITENS_DE_INTEGRACAO.filter((i) => !i.emBreve).length} integrações <Seta />
          </Link>
        </p>
      </div>
    </section>
  )
}

export function SecaoPrecoResumo() {
  return (
    <section className={x.faixaAzul}>
      <div className={`${s.faixa} ${x.faixaAzulInterno}`}>
        <div>
          <p className={x.capaOlho}>Preços</p>
          <h2 className={x.faixaAzulTitulo}>
            A partir de {reais(precoDeEntrada)} por mês, com {DIAS_DE_TESTE} dias para testar.
          </h2>
          <p className={x.faixaAzulTexto}>Sem fidelidade. A tarifa da Meta vem à parte, sem acréscimo nosso, e você calcula antes de assinar.</p>
        </div>
        <Link className={`${s.botao} ${x.botaoBranco} ${s.botaoGrande}`} href="/precos">
          Ver planos e calcular
        </Link>
      </div>
    </section>
  )
}

/* ─────────────────────────── produto ─────────────────────────── */

export function SecaoCanais() {
  const glifos: Record<string, string | undefined> = { WhatsApp: GLIFO_WHATSAPP, Instagram: GLIFO_INSTAGRAM, Telegram: GLIFO_TELEGRAM }
  return (
    <section className={s.secao} id="canais">
      <div className={s.faixa}>
        <Cabeca olho="Canais" titulo="Onde o seu cliente já está" texto="Uma fila só para todos os canais, com o mesmo fluxo e a mesma equipe." />
        <div className={x.canais}>
          {CANAIS.map((c, i) => (
            <article key={c.nome} className={x.canal} style={{ '--cor': c.cor } as CSSProperties} data-revela data-como="escala" data-atraso={i * 70}>
              <span className={x.canalMarca}>
                {glifos[c.nome] ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={glifos[c.nome]} />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    <rect x="2.5" y="3.5" width="19" height="14" rx="2.5" />
                    <path d="M2.5 7.5h19M8 21h8" />
                  </svg>
                )}
              </span>
              <h3>{c.nome}</h3>
              <p>{c.linha}</p>
              <ul>
                {c.fatos.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SecaoDoisLados() {
  return (
    <section className={s.secao} id="coexistencia">
      <div className={s.faixa}>
        <Cabeca
          olho="Coexistência"
          titulo="O WhatsApp do celular continua com você"
          texto="O número segue no app WhatsApp Business. O que o chatbot responde aparece no celular, e o que a equipe responde pelo celular aparece no Inbox."
        />
        <DoisLados />
      </div>
    </section>
  )
}

/* ─────────────────────────── preços ─────────────────────────── */

export function SecaoCalculadora() {
  return (
    <section className={s.secao} id="custo-da-meta">
      <div className={s.faixa}>
        <Cabeca
          olho="Custo da Meta"
          titulo="Quanto a Meta cobra, antes de você assinar"
          texto="A Meta cobra por mensagem, à parte do plano. Ajuste ao seu volume e veja o valor."
        />
        <CalculadoraMeta />
      </div>
    </section>
  )
}

/* ─────────────────────────── nicho ─────────────────────────── */

export function CorpoDoNicho({ nicho }: { nicho: NichoDoSite }) {
  const segunda = nicho.conversas[1]
  return (
    <>
      <section className={s.secao}>
        <div className={s.faixa}>
          <Cabeca olho="O que muda no dia" titulo="Três conversas que deixam de tomar o seu tempo" />
          <div className={x.dores} style={{ '--cor': nicho.cor } as CSSProperties}>
            {nicho.dores.map((d, i) => (
              <article key={d.dor} className={x.dor} data-revela data-como="escala" data-atraso={i * 90}>
                <span className={x.dorNumero}>{String(i + 1).padStart(2, '0')}</span>
                <h3>{d.dor}</h3>
                <p>{d.resposta}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={s.secao}>
        <div className={`${s.faixa} ${x.iaGrade}`}>
          <div>
            <span className={s.olho} data-revela>
              A IA neste ramo
            </span>
            <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
              Responde com o que é seu, e chama a equipe no resto
            </h2>
            <ul className={x.listaIa} style={{ '--cor': nicho.cor } as CSSProperties}>
              {nicho.ia.map((item, i) => (
                <li key={item} data-revela data-atraso={120 + i * 60}>
                  {item}
                </li>
              ))}
              <li data-revela data-atraso={120 + nicho.ia.length * 60}>
                Sem resposta na ficha, passa para a equipe em vez de inventar
              </li>
            </ul>
          </div>
          {segunda ? (
            <div data-revela data-como="escala">
              <PreviaWhatsApp conversa={CONVERSAS[segunda]} />
            </div>
          ) : (
            <div className={x.noAppCaixa} data-revela data-como="escala">
              <NoApp nicho={nicho} />
            </div>
          )}
        </div>
      </section>

      <section className={s.secao}>
        <div className={s.faixa}>
          <Cabeca olho="Modelos prontos" titulo="Fluxos que já vêm montados" texto="Você liga, ajusta os textos e publica. Dá para editar cada bloco depois." />
          <div className={x.modelos}>
            {nicho.modelos.map((m, i) => (
              <div key={m} className={x.modelo} style={{ '--cor': nicho.cor } as CSSProperties} data-revela data-atraso={i * 50}>
                <span className={x.modeloFios} aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <strong>{m}</strong>
                <small>Modelo para {nicho.nome.toLowerCase()}</small>
              </div>
            ))}
            {MODELOS_DE_TODOS.map((m) => (
              <div key={m} className={x.modelo} data-revela>
                <span className={x.modeloFios} aria-hidden>
                  <i />
                  <i />
                </span>
                <strong>{m}</strong>
                <small>Em toda conta</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {segunda && (
        <section className={s.secao}>
          <div className={s.faixa}>
            <Cabeca olho="Dentro do app" titulo={`O AutoFluxos fala a língua de ${nicho.nome.toLowerCase()}`} />
            <NoApp nicho={nicho} />
          </div>
        </section>
      )}

    </>
  )
}

export function IntegracoesDoNicho({ nicho }: { nicho: NichoDoSite }) {
  return (
    <section className={s.secao}>
      <div className={s.faixa}>
        <Cabeca olho="Integrações" titulo="Conecta com o que você já usa" />
        <VitrineDeIntegracoes grupos={nicho.integracoes} />
      </div>
    </section>
  )
}

function NoApp({ nicho }: { nicho: NichoDoSite }) {
  return (
    <div className={x.noApp}>
      {nicho.noApp.map((item) => (
        <div key={item.titulo} data-revela>
          <strong>{item.titulo}</strong>
          <p>{item.texto}</p>
        </div>
      ))}
    </div>
  )
}

function Seta() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6h7M6.5 3l3 3-3 3" />
    </svg>
  )
}
