import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { DIAS_DE_TESTE, PLANOS } from '@/core/planos'
import { DerivaDeParticulas } from './deriva-de-particulas'
import { Desktop, Pergunta } from './pagina-do-site'
import { GLIFO_META } from '@/components/design/glifos-oficiais'
import { CANAIS, type CanalDoSite } from './canais-do-site'
import { RECURSOS, type RecursoDoSite } from './recursos-do-site'
import { MODELOS_DE_TODOS, type NichoDoSite } from './nichos-do-site'
import { CalculadoraMeta, DoisLados, NumerosMedidos, PreviaQueTroca, VitrineDeNichos } from './pecas-interativas'
import { CONVERSAS, PreviaWhatsApp } from './previa-whatsapp'
import { ITENS_DE_INTEGRACAO } from './integracoes-do-site'
import { VitrineDeIntegracoes } from './vitrine-de-integracoes'
import s from './pagina-inicial.module.css'
import x from './site.module.css'

/*
 * As seções do site institucional (`docs/PLANO-SITE-INSTITUCIONAL.md`). Cada
 * ideia aparece uma vez: a home apresenta e leva para a página que detalha.
 */

const precoDeEntrada = Math.min(...PLANOS.map((p) => p.preco))
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** `naPrimeiraTela`: a seção que abre logo abaixo de uma capa curta entra como a capa (ver `entra()`). */
function Cabeca({
  olho,
  titulo,
  texto,
  id,
  naPrimeiraTela,
}: {
  olho: string
  titulo: ReactNode
  texto?: ReactNode
  id?: string
  naPrimeiraTela?: boolean
}) {
  const revela = (atraso: number, como?: 'desfoque') =>
    naPrimeiraTela ? entra(atraso, como) : { 'data-revela': true, 'data-como': como, 'data-atraso': atraso }
  return (
    <div className={s.cabecaSecao} id={id}>
      <span className={s.olho} {...revela(0)}>
        {olho}
      </span>
      <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} {...revela(60, 'desfoque')}>
        {titulo}
      </h2>
      {texto && (
        <p className={`${s.chamada} ${s.chamadaCentro}`} {...revela(100)}>
          {texto}
        </p>
      )}
    </div>
  )
}

/* ─────────────────────────── capas ─────────────────────────── */

/*
 * A capa entra só com CSS, na primeira pintura. Com `data-revela` ela esperava
 * o JavaScript hidratar para aparecer, e o subtítulo, que é o maior texto da
 * tela, virava o LCP: 4,7 s de espera no Lighthouse mobile de 28/out. Vale
 * também para o que fica na primeira tela logo abaixo dela.
 */
function entra(atraso: number, como?: 'desfoque' | 'escala') {
  return { 'data-entra': como ?? '', style: { '--atraso': atraso } as CSSProperties }
}

export function CapaDaHome() {
  return (
    <section className={`${s.capa} ${x.capaSimples}`}>
      <DerivaDeParticulas className={s.campo} />
      <div className={s.veu} aria-hidden />
      <div className={`${s.faixa} ${x.capaSimplesInterno}`}>
        <p className={s.selo} {...entra(0)}>
          <span className={s.seloTag}>Novo</span>
          <span className={s.seloMeta}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-label="Meta" role="img">
              <path d={GLIFO_META} />
            </svg>
            Meta
          </span>
          API oficial do WhatsApp Business
        </p>
        <h1 className={`${x.capaTitulo} ${x.capaTituloHome}`} {...entra(80, 'desfoque')}>
          {/* Hífen que não quebra: "pós-" sozinho no fim da linha. */}
          Atendimento, vendas e pós{'\u2011'}venda no WhatsApp. <em>A equipe inteira no mesmo número.</em>
        </h1>
        <p className={x.capaSub} {...entra(200)}>
          O chatbot e a IA respondem na hora, cada setor tem a sua fila, o funil anda sozinho e o pagamento se confirma
          na conversa. Do primeiro oi à recompra, no número que você já usa.
        </p>
        <div className={s.acoes} {...entra(300)}>
          <Link className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`} href="/precos">
            Ver planos
          </Link>
          <a className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href="#conversar">
            Fale conosco
          </a>
        </div>
      </div>
      {/* A tela do Inbox saindo pela borda de baixo: o produto aparece antes de rolar. */}
      <div className={x.capaTela} {...entra(420, 'escala')} aria-hidden>
        <Desktop />
      </div>
    </section>
  )
}

export function CapaSimples({ olho, titulo, texto, children }: { olho: string; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <section className={`${s.capa} ${x.capaSimples}`}>
      <div className={s.veu} aria-hidden />
      <div className={`${s.faixa} ${x.capaSimplesInterno}`}>
        <p className={x.capaOlho} {...entra(0)}>
          {olho}
        </p>
        <h1 className={x.capaTitulo} {...entra(60, 'desfoque')}>
          {titulo}
        </h1>
        <p className={x.capaSub} {...entra(160)}>
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
          <p className={x.capaOlho} {...entra(0)}>
            Para {nicho.nome.toLowerCase()} · {nicho.quem}
          </p>
          <h1 className={x.capaTitulo} {...entra(60, 'desfoque')}>
            {nicho.titulo}
          </h1>
          <p className={x.capaSub} {...entra(160)}>
            {nicho.subtitulo}
          </p>
          <div className={s.acoes} {...entra(260)}>
            <Link className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`} href="/precos">
              Ver planos
            </Link>
            <a className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href="#conversar">
              Fale conosco
            </a>
          </div>
        </div>
        <div className={x.capaVisual} {...entra(160, 'escala')}>
          <PreviaQueTroca chaves={nicho.conversas} />
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── home ─────────────────────────── */

/*
 * Números medidos, não de mercado, 90 dias até 28/out/2026, todas as contas.
 * 74%: sessões sem transferência (`sessions` x `handoffs`), 554 conversas, 141
 * com equipe. 1 em 6: 12.286 mensagens recebidas, 16,5% fora de seg-sex
 * 8h-18h. 4 s: mediana entre a mensagem recebida e a próxima enviada na mesma
 * sessão (`messages`, lead() por session_id), 1.730 respostas antes de haver
 * transferência; com a equipe a mediana é 106 s. Refazer a conta antes de
 * mudar qualquer número. Desenhados em `NumerosMedidos` (`pecas-interativas.tsx`).
 */

// Logo abaixo da capa, já na primeira tela do celular: entra como a capa, sem esperar o JavaScript.
export function SecaoNumeros() {
  return (
    <section className={x.numeros} {...entra(500)}>
      <div className={s.faixa}>
        <NumerosMedidos atraso={500} />
      </div>
    </section>
  )
}

export function SecaoDuvidasCurtas() {
  return (
    <section className={s.secao}>
      <div className={`${s.faixa} ${x.duvidasCurtas}`}>
        <div>
          <span className={s.olho} data-revela>
            Antes de assinar
          </span>
          <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
            As três perguntas que todo mundo faz
          </h2>
          <Link href="/precos#duvidas" className={x.linkForte} data-revela data-atraso="120">
            Ver todas as dúvidas <Seta />
          </Link>
        </div>
        <div className={s.perguntas}>
          <Pergunta
            pergunta="Perco o WhatsApp do celular?"
            resposta="Não. O número continua no app WhatsApp Business do celular. O que o chatbot responde aparece lá, e o que você responde pelo celular aparece no Inbox."
          />
          <Pergunta
            pergunta="Meu número pode ser bloqueado?"
            resposta="O AutoFluxos usa a API oficial da Meta e respeita as regras dela: fora da janela de 24 horas, só sai mensagem com modelo aprovado. Bloqueio vem de disparo em massa para quem não pediu, e o produto não deixa isso acontecer por acidente."
          />
          <Pergunta
            pergunta="A IA pode inventar preço?"
            resposta="Ela responde só com o que está na ficha e no catálogo do seu negócio. Sem a informação, passa a conversa para a equipe em vez de arriscar."
          />
        </div>
      </div>
    </section>
  )
}


export function SecaoNichos() {
  return (
    <section className={s.secao} id="nichos">
      <div className={s.faixa}>
        <Cabeca
          olho="Para quem é"
          titulo="Pronto para o seu tipo de negócio"
          texto="Cada ramo entra com os modelos, os nomes e a IA do seu dia a dia. O plano é o mesmo; muda o que vem pronto."
        />
        <VitrineDeNichos />
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

/* ─────────────────────────── jornada ─────────────────────────── */

/*
 * A conversa inteira, do anúncio à recompra: o AutoFluxos não é só o chatbot.
 * Cada etapa existe no produto (fila por setor e IA do atendente desde
 * `a743d066` e `79aa74f4`; pagamento confirmado pelos gateways; aviso do
 * pedido e pesquisa pelos fluxos e sequências) e leva à página que detalha.
 */
const JORNADA = [
  { titulo: 'Chega', texto: 'Do anúncio, do Instagram, do site ou do formulário, com a origem anotada.', href: '/produto/contatos-e-funil' },
  { titulo: 'O chatbot atende', texto: 'Responde na hora, qualifica e mostra o produto com foto e preço.', href: '/produto/fluxos' },
  { titulo: 'O setor assume', texto: 'Vendas, suporte ou financeiro: cai na fila certa, com o histórico junto.', href: '/produto/inbox' },
  { titulo: 'Vira negócio', texto: 'Etapa, valor, dono e próxima ação no funil.', href: '/produto/contatos-e-funil' },
  { titulo: 'Paga no chat', texto: 'Link de pagamento ou Pix na conversa, confirmado quando o banco aprova.', href: '/integracoes' },
  { titulo: 'Recebe', texto: 'O status do pedido chega pelo WhatsApp, do pago ao entregue.', href: '/segmentos/loja-virtual' },
  { titulo: 'Volta', texto: 'Pesquisa de satisfação e mensagem de recompra no tempo certo.', href: '/produto/fluxos' },
]

export function SecaoJornada() {
  return (
    <section className={s.secao} id="jornada">
      <div className={s.faixa}>
        <Cabeca
          olho="Como funciona"
          titulo="Do primeiro contato ao pós-venda, tudo no mesmo WhatsApp"
          texto="Hoje cada etapa mora num lugar: o celular, a planilha, o link de pagamento, o grupo da equipe. No AutoFluxos é a mesma conversa do começo ao fim."
        />
        <ol className={x.jornada} data-revela>
          {JORNADA.map((e, i) => (
            <li key={e.titulo} style={{ '--i': i } as CSSProperties}>
              <span className={x.jornadaNo}>{String(i + 1).padStart(2, '0')}</span>
              <Link href={e.href} className={x.jornadaTexto}>
                <strong>{e.titulo}</strong>
                <span>{e.texto}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ─────────────────────────── produto ─────────────────────────── */

export function SecaoCanais() {
  return (
    <section className={s.secao} id="canais">
      <div className={s.faixa}>
        <Cabeca naPrimeiraTela olho="Canais" titulo="Onde o seu cliente já está" texto="Uma fila só para todos os canais, com o mesmo fluxo e a mesma equipe." />
        <div className={x.canais}>
          {CANAIS.map((c, i) => (
            <Link
              key={c.nome}
              href={`/canais/${c.slug}`}
              className={x.canal}
              style={{ '--cor': c.cor } as CSSProperties}
              data-revela
              data-como="escala"
              data-atraso={i * 70}
            >
              <span className={x.canalMarca}>
                <MarcaDoCanal canal={c} />
              </span>
              <h3>{c.nome}</h3>
              <p>{c.linha}</p>
              <ul>
                {c.fatos.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Glifo oficial quando a marca tem um; o chat do site é nosso e leva o desenho de uma janela. */
export function MarcaDoCanal({ canal, tamanho = 22 }: { canal: CanalDoSite; tamanho?: number }) {
  return canal.glifo ? (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={canal.glifo} />
    </svg>
  ) : (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="2.5" y="3.5" width="19" height="14" rx="2.5" />
      <path d="M2.5 7.5h19M8 21h8" />
    </svg>
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

/* ─────────────────────────── canal ─────────────────────────── */

/** Capa com texto à esquerda e uma janela do produto à direita: canais e partes do produto. */
function CapaComJanela({ olho, titulo, texto, aviso, visual }: { olho: string; titulo: string; texto: string; aviso?: string; visual: ReactNode }) {
  return (
    <section className={`${s.capa} ${x.capaDividida}`}>
      <div className={s.veu} aria-hidden />
      <div className={`${s.faixa} ${x.capaGrade}`}>
        <div className={x.capaTexto}>
          <p className={x.capaOlho} {...entra(0)}>
            {olho}
          </p>
          <h1 className={x.capaTitulo} {...entra(60, 'desfoque')}>
            {titulo}
          </h1>
          <p className={x.capaSub} {...entra(160)}>
            {texto}
          </p>
          {aviso && (
            <p className={x.avisoCanal} {...entra(200)}>
              {aviso}
            </p>
          )}
          <div className={s.acoes} {...entra(260)}>
            <Link className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`} href="/precos">
              Ver planos
            </Link>
            <a className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href="#conversar">
              Fale conosco
            </a>
          </div>
        </div>
        <div className={x.capaVisual} {...entra(160, 'escala')}>
          {visual}
        </div>
      </div>
    </section>
  )
}

/** Uma janela branca com linhas de rótulo e valor, como uma tela de configuração do app. */
function JanelaDeFicha({
  barra,
  titulo,
  marca,
  linhas,
  cor = '#1d4ed8',
}: {
  barra: string
  titulo: string
  marca?: ReactNode
  linhas: { rotulo: string; valor: string }[]
  cor?: string
}) {
  return (
    <div className={x.ficha} style={{ '--cor': cor } as CSSProperties}>
      <div className={x.fichaBarra}>
        <i />
        <i />
        <i />
        <span>{barra}</span>
      </div>
      <div className={x.fichaTopo}>
        {marca && <span className={x.canalMarca}>{marca}</span>}
        <strong>{titulo}</strong>
      </div>
      <dl className={x.fichaLinhas}>
        {linhas.map((f) => (
          <div key={f.rotulo}>
            <dt>{f.rotulo}</dt>
            <dd>{f.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function CapaDoCanal({ canal }: { canal: CanalDoSite }) {
  return (
    <CapaComJanela
      olho={`Canais · ${canal.nome}`}
      titulo={canal.titulo}
      texto={canal.subtitulo}
      aviso={canal.aviso}
      visual={canal.conversas ? <PreviaQueTroca chaves={canal.conversas} /> : <FichaDoCanal canal={canal} />}
    />
  )
}

/** Os números do canal, lidos de `src/core/canais.ts` via `canais-do-site.ts`. */
function FichaDoCanal({ canal }: { canal: CanalDoSite }) {
  return <JanelaDeFicha barra="Ficha do canal" titulo={canal.nome} marca={<MarcaDoCanal canal={canal} />} linhas={canal.ficha} cor={canal.cor} />
}

export function CorpoDoCanal({ canal }: { canal: CanalDoSite }) {
  const cor = { '--cor': canal.cor } as CSSProperties
  return (
    <>
      <section className={s.secao}>
        <div className={s.faixa}>
          <Cabeca olho="Como conecta" titulo={`${canal.nome} ligado em três passos`} />
          <div className={x.dores} style={cor}>
            {canal.passos.map((p, i) => (
              <article key={p.titulo} className={x.dor} data-revela data-como="escala" data-atraso={i * 90}>
                <span className={x.dorNumero}>{String(i + 1).padStart(2, '0')}</span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {canal.slug === 'whatsapp' && <SecaoDoisLados />}

      {canal.slug === 'site' && (
        <section className={s.secao}>
          <div className={`${s.faixa} ${x.iaGrade} ${x.gradeLarga}`}>
            <div>
              <span className={s.olho} data-revela>
                Instalação
              </span>
              <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
                Uma linha antes do fim da página
              </h2>
              <p className={s.chamada} data-revela data-atraso="100">
                Funciona em WordPress, Wix, Shopify, Nuvemshop, Magento ou HTML puro. O código já vem com a chave da sua conta no painel.
              </p>
            </div>
            <div className={x.codigo} data-revela data-como="escala">
              <div className={x.fichaBarra}>
                <i />
                <i />
                <i />
                <span>index.html</span>
              </div>
              <pre>
                <code>
                  <span className={x.codigoApagado}>{'<body>\n  ...\n'}</span>
                  {'  <script\n    src="'}
                  <span className={x.codigoTexto}>https://autofluxos.4yu.com.br/chat/v1.js</span>
                  {'"\n    data-chave="'}
                  <span className={x.codigoTexto}>SUA_CHAVE</span>
                  {'"\n    async\n  ></script>\n'}
                  <span className={x.codigoApagado}>{'</body>'}</span>
                </code>
              </pre>
            </div>
          </div>
        </section>
      )}

      <section className={s.secao}>
        <div className={s.faixa}>
          <Cabeca olho="O que funciona" titulo={`Tudo o que ${canal.slug === 'site' ? 'o chat do site' : `o ${canal.nome}`} faz no AutoFluxos`} />
          <div className={x.noApp}>
            {canal.recursos.map((r) => (
              <div key={r.titulo} data-revela>
                <strong>{r.titulo}</strong>
                <p>{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {canal.conversas && (
        <section className={s.secao}>
          <div className={`${s.faixa} ${x.iaGrade} ${x.gradeLarga}`}>
            <div>
              <span className={s.olho} data-revela>
                Ficha técnica
              </span>
              <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
                Os limites da Meta, já respeitados no editor
              </h2>
              <p className={s.chamada} data-revela data-atraso="100">
                O editor de fluxos avisa antes de publicar um botão a mais ou um texto longo demais. O que passa no editor, chega no celular do cliente.
              </p>
            </div>
            <div data-revela data-como="escala">
              <FichaDoCanal canal={canal} />
            </div>
          </div>
        </section>
      )}

      <section className={s.secao}>
        <div className={s.faixa}>
          <Cabeca olho="Os outros canais" titulo="O mesmo fluxo, onde o cliente estiver" />
          <div className={`${x.canais} ${x.canaisOutros}`}>
            {CANAIS.filter((c) => c.slug !== canal.slug).map((c, i) => (
              <Link
                key={c.slug}
                href={`/canais/${c.slug}`}
                className={x.canal}
                style={{ '--cor': c.cor } as CSSProperties}
                data-revela
                data-atraso={i * 70}
              >
                <span className={x.canalMarca}>
                  <MarcaDoCanal canal={c} />
                </span>
                <h3>
                  {c.nome} <Seta />
                </h3>
                <p>{c.linha}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/* ─────────────────────────── partes do produto ─────────────────────────── */

export function CapaDoRecurso({ recurso }: { recurso: RecursoDoSite }) {
  return (
    <CapaComJanela
      olho={`Produto · ${recurso.nome}`}
      titulo={recurso.titulo}
      texto={recurso.subtitulo}
      visual={<JanelaDeFicha barra={recurso.ficha.barra} titulo={recurso.ficha.titulo} linhas={recurso.ficha.linhas} />}
    />
  )
}

/** `children`: a peça própria da parte (o fluxo que se monta, o Inbox, a calculadora), entre os destaques e a lista. */
export function CorpoDoRecurso({ recurso, children }: { recurso: RecursoDoSite; children?: ReactNode }) {
  return (
    <>
      <section className={s.secao}>
        <div className={s.faixa}>
          <Cabeca olho={recurso.nome} titulo="O que muda no dia da equipe" />
          <div className={x.dores}>
            {recurso.destaques.map((d, i) => (
              <article key={d.titulo} className={x.dor} data-revela data-como="escala" data-atraso={i * 90}>
                <span className={x.dorNumero}>{String(i + 1).padStart(2, '0')}</span>
                <h3>{d.titulo}</h3>
                <p>{d.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {children}

      <section className={s.secao}>
        <div className={s.faixa}>
          <Cabeca olho="Em detalhe" titulo="Tudo o que vem junto" />
          <div className={x.noApp}>
            {recurso.itens.map((r) => (
              <div key={r.titulo} data-revela>
                <strong>{r.titulo}</strong>
                <p>{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SecaoPartesDoProduto atual={recurso.slug} />
    </>
  )
}

/** A IA marcando o horário dentro da conversa, na prévia do WhatsApp já aprovada. */
export function SecaoIaNaConversa() {
  return (
    <section className={s.secao}>
      <div className={`${s.faixa} ${x.iaGrade}`}>
        <div>
          <span className={s.olho} data-revela>
            Na conversa
          </span>
          <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
            Consulta a agenda, oferece o horário e confirma
          </h2>
          <ul className={x.listaIa}>
            <li data-revela data-atraso="120">
              Vê os horários livres antes de oferecer
            </li>
            <li data-revela data-atraso="180">
              Pergunta antes de marcar, se você pedir
            </li>
            <li data-revela data-atraso="240">
              Agenda o lembrete sem ninguém lembrar de mandar
            </li>
            <li data-revela data-atraso="300">
              Sem resposta na ficha, passa para a equipe em vez de inventar
            </li>
          </ul>
        </div>
        <div data-revela data-como="escala">
          <PreviaWhatsApp conversa={CONVERSAS.clinica} />
        </div>
      </div>
    </section>
  )
}

/** Uma porta para cada parte: na visão geral de `/produto` e no pé de cada parte, com a atual marcada. */
export function SecaoPartesDoProduto({ atual }: { atual?: string }) {
  return (
    <section className={s.secao} id="partes">
      <div className={s.faixa}>
        <Cabeca olho={atual ? 'O resto do produto' : 'Cada parte'} titulo={atual ? 'Cada parte conversa com as outras' : 'Veja em detalhe'} />
        <div className={`${x.canais} ${x.partes}`}>
          {RECURSOS.map((r, i) => (
            <Link
              key={r.slug}
              href={`/produto/${r.slug}`}
              className={x.canal}
              aria-current={r.slug === atual ? 'page' : undefined}
              data-revela
              data-atraso={i * 60}
            >
              <h3>
                {r.nome} {r.slug === atual ? <small>Você está aqui</small> : <Seta />}
              </h3>
              <p>{r.linha}</p>
            </Link>
          ))}
        </div>
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
