import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { DIAS_DE_TESTE, PLANOS } from '@/core/planos'
import { DerivaDeParticulas } from './deriva-de-particulas'
import { Desktop, Pergunta } from './pagina-do-site'
import { GLIFO_META, GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import { CANAIS, type CanalDoSite } from './canais-do-site'
import { type NichoDoSite } from './nichos-do-site'
import { AntesEDepois } from './antes-e-depois'
import { JornadaViva } from './jornada-viva'
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

/*
 * A logo oficial no rótulo de cima, quando a seção fala da Meta ou do
 * WhatsApp: a pessoa reconhece a marca antes de ler (pedido do Gabriel,
 * 29/out, como o selo da capa da home).
 */
const MARCAS_DO_OLHO = {
  meta: { glifo: GLIFO_META, cor: '#0866ff', nome: 'Meta' },
  whatsapp: { glifo: GLIFO_WHATSAPP, cor: '#25d366', nome: 'WhatsApp' },
} as const

function MarcaDoOlho({ marca }: { marca: keyof typeof MARCAS_DO_OLHO }) {
  const m = MARCAS_DO_OLHO[marca]
  return (
    <svg className={x.olhoMarca} width="16" height="16" viewBox="0 0 24 24" fill={m.cor} role="img" aria-label={m.nome}>
      <path d={m.glifo} />
    </svg>
  )
}

/** `naPrimeiraTela`: a seção que abre logo abaixo de uma capa curta entra como a capa (ver `entra()`). */
function Cabeca({
  olho,
  titulo,
  texto,
  id,
  naPrimeiraTela,
  marca,
}: {
  olho: string
  titulo: ReactNode
  texto?: ReactNode
  id?: string
  naPrimeiraTela?: boolean
  marca?: keyof typeof MARCAS_DO_OLHO
}) {
  const revela = (atraso: number, como?: 'desfoque') =>
    naPrimeiraTela ? entra(atraso, como) : { 'data-revela': true, 'data-como': como, 'data-atraso': atraso }
  return (
    <div className={s.cabecaSecao} id={id}>
      <span className={`${s.olho} ${marca ? x.olhoComMarca : ''}`} {...revela(0)}>
        {marca && <MarcaDoOlho marca={marca} />}
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
            resposta="O Dialogon usa a API oficial da Meta e respeita as regras dela: fora da janela de 24 horas, só sai mensagem com modelo aprovado. Bloqueio vem de disparo em massa para quem não pediu, e o produto não deixa isso acontecer por acidente."
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
      <div className={`${s.faixa} ${s.faixaLarga}`}>
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
    <section className={`${s.secao} ${s.secaoCompacta}`}>
      <div className={`${s.faixa} ${s.faixaEstreita}`}>
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
 * A conversa inteira, do anúncio à recompra: o Dialogon não é só o chatbot.
 * Cada etapa existe no produto (fila por setor e IA do atendente desde
 * `a743d066` e `79aa74f4`; pagamento confirmado pelos gateways; aviso do
 * pedido e pesquisa pelos fluxos e sequências) e leva à página que detalha.
 */
const JORNADA = [
  {
    titulo: 'Captação de leads',
    texto: 'Do anúncio, do Instagram, do site ou do formulário: todo contato entra com a origem anotada.',
    href: '/produto/contatos-e-funil',
  },
  {
    titulo: 'Atendimento automático',
    texto: 'O chatbot e a IA respondem na hora, tiram dúvidas e mostram o produto com foto e preço.',
    href: '/produto/fluxos',
  },
  {
    titulo: 'Atendimento da equipe',
    texto: 'Quando precisa de gente, a conversa cai na fila do setor certo, com o histórico junto.',
    href: '/produto/inbox',
  },
  {
    titulo: 'Funil de vendas',
    texto: 'Cada negociação com etapa, valor, responsável e próxima ação, sem planilha.',
    href: '/produto/contatos-e-funil',
  },
  {
    titulo: 'Pagamento',
    texto: 'Link de pagamento ou Pix na própria conversa, confirmado sozinho quando o banco aprova.',
    href: '/integracoes',
  },
  {
    titulo: 'Entrega e rastreio',
    texto: 'O cliente recebe cada etapa do pedido no WhatsApp, do pagamento aprovado à entrega.',
    href: '/segmentos/loja-virtual',
  },
  {
    titulo: 'Avaliação e recompra',
    texto: 'Pesquisa de satisfação depois da entrega e lembrete de recompra na hora certa.',
    href: '/produto/fluxos',
  },
]

export function SecaoJornada() {
  return (
    <section className={s.secao} id="jornada">
      <div className={`${s.faixa} ${s.faixaLarga}`}>
        <Cabeca
          olho="Como funciona"
          titulo={`Do primeiro contato ao pós\u2011venda, tudo no mesmo WhatsApp`}
          texto="Hoje cada etapa mora num lugar: o celular, a planilha, o link de pagamento, o grupo da equipe. No Dialogon é a mesma conversa do começo ao fim."
        />
        <JornadaViva etapas={JORNADA} />
      </div>
    </section>
  )
}

/* ─────────────────────────── antes e depois ─────────────────────────── */

/* Cada "depois" existe no produto: acessos por pessoa, funil, fila por setor (`a743d066`), pagamento pelos gateways, transmissões e aviso do pedido. */
export function SecaoImprovisos() {
  return (
    <section className={`${s.secao} ${s.secaoTonal}`} id="antes-e-depois">
      <div className={s.faixa}>
        <Cabeca
          olho="Antes e depois"
          titulo="Seis improvisos a menos na sua operação"
          texto="Vire a chave e veja a operação se arrumar."
        />
        <AntesEDepois />
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
    <section className={`${s.secao} ${s.secaoTonal}`} id="coexistencia">
      <div className={s.faixa}>
        <Cabeca
          marca="whatsapp"
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
          marca="meta"
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
export function JanelaDeFicha({
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
          <Cabeca olho="O que funciona" titulo={`Tudo o que ${canal.slug === 'site' ? 'o chat do site' : `o ${canal.nome}`} faz no Dialogon`} />
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

/* ─────────────────────────── nicho ─────────────────────────── */

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

function Seta() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6h7M6.5 3l3 3-3 3" />
    </svg>
  )
}
