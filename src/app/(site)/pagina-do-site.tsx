import Link from 'next/link'
import { BentoDoProduto } from './bento-do-produto'
import { InboxClicavel } from './inbox-clicavel'
import { CartaoEnterprise } from './precos-pagina'
import { CANAIS } from './canais-do-site'
import { RECURSOS } from './recursos-do-site'
import type { CSSProperties, ReactNode } from 'react'
import {
  anualDoPlano,
  O_QUE_E_CONVERSA,
  DIAS_DE_TESTE,
  PLANOS,
  PLANO_EM_DESTAQUE,
  TARIFA_DA_META,
} from '@/core/planos'
import { Cursor } from './cursor'
import { FluxoSeMontando } from './fluxo-se-montando'
import { MenuDoTopo } from './menu-do-topo'
import { ProgressoDosPassos } from './progresso-dos-passos'
import { Revelar } from './revelar'
import { GLIFO_CLAUDE, GLIFO_GOOGLE, GLIFO_OPENAI, GLIFO_PERPLEXITY } from '@/components/design/glifos-oficiais'
import s from './pagina-inicial.module.css'
import { FotoDaPessoa } from './pessoas-do-site'

/**
 * A porta de entrada pública do AutoFluxos.
 *
 * **Esta rota era o painel e virou a landing.** O painel foi para `/painel`.
 * A troca não é cosmética: a Meta exige, para a verificação de acesso do Tech
 * Provider, *"um site completo que mostre o serviço e os detalhes da empresa"*, e o domínio do produto abrindo uma tela de login é rejeição na certa.
 *
 * O visual sai dos tokens do painel (`globals.css`), não de uma paleta
 * inventada aqui. Quem clica em "Entrar" tem que sentir que continuou no mesmo
 * produto.
 */

const ENTRAR = '/entrar'

/*
 * "Pergunte a uma IA" do rodapé (como no zipchat.ai, 28/out/2026): abre a IA
 * com a pergunta pronta, apontando para o `public/llms.txt`. O Gemini não
 * aceita pergunta pelo endereço; o Modo IA do Google (`udm=50`) aceita.
 */
const PERGUNTA_PARA_IA =
  'Estou pesquisando o AutoFluxos (https://autofluxos.4yu.com.br), plataforma brasileira de atendimento e vendas no WhatsApp, Instagram e chat do site, com chatbot e IA. Usando o site oficial e https://autofluxos.4yu.com.br/llms.txt, resuma: 1) o que o AutoFluxos faz e como funciona; 2) para quem ele é e os melhores usos; 3) o que o diferencia de outras ferramentas de atendimento.'

const IAS = [
  { nome: 'ChatGPT', glifo: GLIFO_OPENAI, endereco: (q: string) => `https://chatgpt.com/?q=${q}` },
  { nome: 'Claude', glifo: GLIFO_CLAUDE, endereco: (q: string) => `https://claude.ai/new?q=${q}` },
  { nome: 'Perplexity', glifo: GLIFO_PERPLEXITY, endereco: (q: string) => `https://www.perplexity.ai/search?q=${q}` },
  { nome: 'Google', glifo: GLIFO_GOOGLE, endereco: (q: string) => `https://www.google.com/search?udm=50&q=${q}` },
]

/**
 * `cor`: a página de um ramo troca o azul da casca pelo degradê da cor dele,
 * na capa e no rodapé. Sem ela, o azul de sempre.
 */
export function PaginaDoSite({ capa, children, cor }: { capa: ReactNode; children: ReactNode; cor?: string }) {
  const estilo = cor
    ? ({
        '--lp-casca': `linear-gradient(135deg, color-mix(in srgb, ${cor} 72%, #0c1838) 0%, ${cor} 48%, color-mix(in srgb, ${cor} 78%, #ffffff) 100%)`,
        '--cor-veu': `color-mix(in srgb, ${cor} 70%, #0c1838)`,
      } as CSSProperties)
    : undefined
  return (
    <div className={s.pagina} style={estilo}>
      <Revelar seletorCabecalho={s.cabecalho} classeRolado={s.cabecalhoRolado} />
      <Cursor classePonto={s.cursorPonto} classeAnel={s.cursorAnel} classeAtivo={s.cursorAtivo} />

      <header className={s.cabecalho}>
        <div className={`${s.faixa} ${s.cabecalhoInterno}`}>
          <Link className={s.marca} href="/">
            <span className={s.marcaSigla} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/logo-autofluxos-marca.png" alt="" width={24} height={24} />
            </span>
            AutoFluxos
          </Link>

          <MenuDoTopo classeItem={s.menuItem} hrefEntrar={ENTRAR} />

          <Link className={`${s.botao} ${s.botaoVazado}`} href={ENTRAR}>
            Entrar
          </Link>
        </div>
      </header>

      <main>
        {capa}

        <div className={s.quadro}>{children}</div>

        <section className={s.faixa} id="conversar">
          <div className={s.fechamento}>
            <span className={s.olho} data-revela>
              Começar
            </span>
            <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
              A conta nasce pela nossa mão
            </h2>
              <span className={`${s.risco} ${s.riscoCentro}`} data-revela data-atraso="90" aria-hidden />
            <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
              Não existe cadastro automático aqui, e isso é de propósito. Conectamos o seu
              número e montamos o primeiro fluxo junto, para o sistema abrir já atendendo.
              Escreva contando que perguntas chegam no seu WhatsApp.
            </p>
            <div className={s.acoes} data-revela data-atraso="140">
              <a
                className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`}
                href="mailto:contato@4yu.com.br?subject=AutoFluxos%3A%20quero%20conhecer"
              >
                Fale conosco
              </a>
              <Link className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href={ENTRAR}>
                Já sou cliente
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.rodape}>
        <div className={s.rodapeGrade2} aria-hidden />

        <div className={s.faixa}>
          <div className={s.rodapeTopo}>
            <div className={s.rodapeSobre}>
              <Link className={s.marca} href="/">
                <span className={s.marcaSigla} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/logo-autofluxos-marca.png" alt="" width={24} height={24} />
            </span>
                AutoFluxos
              </Link>
              <p className={s.rodapeTexto}>
                Atendimento no WhatsApp da sua empresa. O fluxo responde o que se repete e
                sua equipe assume o resto.
              </p>
              <span className={s.rodapeStatus}>
                <span className={s.rodapeStatusPonto} aria-hidden />
                Atendendo em +55 44 7400-7438
              </span>
              <div className={s.rodapeIa}>
                <span className={s.rodapeIaTitulo}>Pergunte a uma IA sobre o AutoFluxos</span>
                <div className={s.rodapeIaBotoes}>
                  {IAS.map((ia) => (
                    <a
                      key={ia.nome}
                      className={s.rodapeIaBotao}
                      href={ia.endereco(encodeURIComponent(PERGUNTA_PARA_IA))}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Perguntar ao ${ia.nome} sobre o AutoFluxos`}
                      title={ia.nome}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d={ia.glifo} />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <nav className={s.rodapeColuna}>
              <span className={s.rodapeTitulo}>Produto</span>
              <Link className={s.rodapeLink} data-n="001" href="/produto">
                Visão geral
              </Link>
              {RECURSOS.map((r, i) => (
                <Link key={r.slug} className={s.rodapeLink} data-n={String(i + 2).padStart(3, '0')} href={`/produto/${r.slug}`}>
                  {r.nome}
                </Link>
              ))}
            </nav>

            <nav className={s.rodapeColuna}>
              <span className={s.rodapeTitulo}>Canais</span>
              {CANAIS.map((c, i) => (
                <Link key={c.slug} className={s.rodapeLink} data-n={String(i + 1).padStart(3, '0')} href={`/canais/${c.slug}`}>
                  {c.nome}
                </Link>
              ))}
              <Link className={s.rodapeLink} data-n={String(CANAIS.length + 1).padStart(3, '0')} href="/integracoes">
                Integrações
              </Link>
              <Link className={s.rodapeLink} data-n={String(CANAIS.length + 2).padStart(3, '0')} href="/precos">
                Preços
              </Link>
            </nav>

            <nav className={s.rodapeColuna}>
              <span className={s.rodapeTitulo}>Conta</span>
              <Link className={s.rodapeLink} data-n="001" href={ENTRAR}>
                Entrar
              </Link>
              <a
                className={s.rodapeLink}
                data-n="002"
                href="mailto:contato@4yu.com.br?subject=AutoFluxos%3A%20quero%20conhecer"
              >
                Fale conosco
              </a>
              <Link className={s.rodapeLink} data-n="003" href="/privacidade">
                Privacidade
              </Link>
              <Link className={s.rodapeLink} data-n="004" href="/termos">
                Termos de serviço
              </Link>
              <Link className={s.rodapeLink} data-n="005" href="/exclusao-de-dados">
                Exclusão de dados
              </Link>
            </nav>

            <nav className={s.rodapeColuna}>
              <span className={s.rodapeTitulo}>4YU</span>
              <a className={s.rodapeLink} data-n="001" href="https://4yu.com.br" rel="noopener">
                Todos os produtos
              </a>
              <a
                className={s.rodapeLink}
                data-n="002"
                href="https://verandi.4yu.com.br"
                rel="noopener"
              >
                Verandi
              </a>
              <a className={s.rodapeLink} data-n="003" href="mailto:contato@4yu.com.br">
                contato@4yu.com.br
              </a>
            </nav>
          </div>

          <div className={s.rodapeMarca} aria-hidden>
            <p className={s.rodapeNome}>AutoFluxos</p>
          </div>

          <div className={s.rodapePe}>
            <span>
              Um produto da <a href="https://4yu.com.br" rel="noopener">4YU</a> · Gabriel Felix
              Barbosa · CNPJ 68.770.493/0001-82 · Maringá, PR
            </span>
            <span className={s.rodapeAviso}>
              WhatsApp é marca da Meta Platforms. Usamos a API oficial do WhatsApp Business e
              não somos afiliados à Meta.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}


export function SecaoNaPratica() {
  return (
          <section className={s.secao}>
            <div className={`${s.focoLuz} ${s.focoDireita}`} aria-hidden />
            <div className={s.faixa}>
              <div className={s.cabecaSecao}>
                <span className={s.olho} data-revela>
                  Na prática
                </span>
                <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
                  Isto é o que a sua equipe vê
                </h2>
                <span className={`${s.risco} ${s.riscoCentro}`} data-revela data-atraso="90" aria-hidden />
                <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
                  Uma tela com as conversas de todo mundo. Quem espera resposta sobe para o
                  topo, o histórico fica ao lado, e a ficha diz quem é a pessoa antes de você
                  digitar a primeira palavra.
                </p>
              </div>
              <Desktop />
            </div>
          </section>
  )
}

export function SecaoFluxo() {
  return (
          <FluxoSeMontando
            cabeca={
              <div className={`${s.faixa} ${s.cabecaSecao}`}>
                <span className={s.olho} data-revela>
                  O fluxo
                </span>
                <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
                  Você desenha o caminho de cada conversa
                </h2>
                <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
                  O que perguntar, quando chamar a IA, quando passar para a equipe. Cada
                  bloco é uma decisão sua, do canal até o sistema da loja, sem escrever
                  código.
                </p>
              </div>
            }
          />
  )
}



export function SecaoOQueFaz() {
  return (
          <section className={s.secao}>
            <div className={`${s.focoLuz} ${s.focoEsquerda}`} aria-hidden />
            <div className={`${s.faixa} ${s.faixaLarga}`}>
              <BentoDoProduto
                cabeca={
                  <>
                    <span className={s.olho} data-revela>
                      O que ele faz
                    </span>
                    <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
                      Seis peças que trabalham juntas
                    </h2>
                    <span className={`${s.risco} ${s.riscoCentro}`} data-revela data-atraso="90" aria-hidden />
                  </>
                }
              />
            </div>
          </section>
  )
}

export function SecaoComo() {
  return (
          <section className={s.secao} id="como">
            <div className={`${s.focoLuz} ${s.focoDireita}`} aria-hidden />
            <div className={s.faixa}>
              <div className={s.passos}>
                <div className={s.passosFixo}>
                  <span className={s.olho} data-revela data-como="lado">
                    Como funciona
                  </span>
                  <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
                    Do seu número, não do nosso
                  </h2>
                <span className={s.risco} data-revela data-atraso="90" aria-hidden />
                  <p className={s.chamada} data-revela data-atraso="100">
                    O atendimento acontece no WhatsApp da sua empresa. Seus clientes continuam
                    falando com o número que já está no cartão, no site e no Google. E você
                    desconecta quando quiser.
                  </p>

                  <ProgressoDosPassos
                    seletorPasso={s.passo}
                    classes={{
                      caixa: s.progresso,
                      conta: s.progressoConta,
                      atual: s.progressoAtual,
                      total: s.progressoTotal,
                      trilho: s.progressoTrilho,
                      segmento: s.progressoSegmento,
                      segmentoAtivo: s.progressoSegmentoAtivo,
                      rotulo: s.progressoRotulo,
                    }}
                    rotulos={[
                      'Você conecta o seu número',
                      'Montamos o primeiro fluxo com você',
                      'Sua equipe entra na caixa de entrada',
                      'Você ajusta olhando o que aconteceu',
                    ]}
                  />
                </div>

                <ol className={s.passosLista}>
                  <Passo
                    rotulo="Conectar"
                    arte={<JanelaConexao />}
                    titulo="Você conecta o seu número"
                    texto="A autorização acontece dentro do WhatsApp, com a sua conta. Nunca pedimos
  senha. Você corta o acesso quando quiser, no painel da Meta, sem precisar nos
  contatar."
                    atraso={0}
                  />
                  <Passo
                    rotulo="Desenhar"
                    arte={<JanelaDesenho />}
                    titulo="Montamos o primeiro fluxo com você"
                    texto="Você não abre o sistema numa tela vazia. Sentamos junto e montamos o
  atendimento com as perguntas que chegam no seu WhatsApp de verdade."
                    atraso={80}
                  />
                  <Passo
                    rotulo="Atender"
                    arte={<JanelaAtendimento />}
                    titulo="Sua equipe entra na caixa de entrada"
                    texto="Cada pessoa entra com o próprio acesso. O que o fluxo não resolveu chega ali
  com a conversa inteira do lado, e ninguém pergunta duas vezes a mesma coisa."
                    atraso={160}
                  />
                  <Passo
                    rotulo="Ajustar"
                    arte={<JanelaNumeros />}
                    titulo="Você ajusta olhando o que aconteceu"
                    texto="Em que bloco as pessoas param de responder, o que perguntaram e o fluxo não
  sabia, quanto tempo alguém levou para assumir. Você corrige olhando isso."
                    atraso={240}
                  />
                </ol>
              </div>
            </div>
          </section>
  )
}



export function SecaoPrecos() {
  return (
          <section className={`${s.secao} ${s.secaoAbaixoDaCapa}`} id="precos">
            <div className={`${s.focoLuz} ${s.focoEsquerda}`} aria-hidden />
            <div className={s.faixa}>
              {/*
                O título anuncia a seção: sem ele, a capa azul virava branco vazio e
                a quebra parecia seca (Edu e Gabriel, 29/out). Não repete o da capa.
                Sem revelação: é o primeiro texto abaixo da capa e virava o LCP.
              */}
              <div className={s.cabecaSecao}>
                <span className={s.olho}>Planos</span>
                <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} style={{ maxWidth: '26ch' }}>
                  Os planos crescem com a sua equipe
                </h2>
              </div>

              <div className={s.planos}>
                {PLANOS.map((plano, indice) => (
                  <Plano
                    key={plano.id}
                    nome={plano.nome}
                    preco={plano.preco.toLocaleString('pt-BR')}
                    anual={anualDoPlano(plano)}
                    resumo={plano.resumo}
                    itens={plano.itens}
                    destaque={plano.id === PLANO_EM_DESTAQUE}
                    atraso={indice * 80}
                  />
                ))}
              </div>

              <CartaoEnterprise />

              <ul className={s.semLetraMiuda} aria-label="O que não cobramos">
                <li>Sem taxa de implantação</li>
                <li>Sem fidelidade no mensal</li>
                <li>Tarifa da Meta sem acréscimo</li>
                <li>Disparo sem resposta não conta</li>
              </ul>

              <p className={s.notaPreco}>
                {O_QUE_E_CONVERSA} No anual você paga o ano de uma vez, com desconto. Fazemos a conta da
                tarifa da Meta com o seu volume antes de você assinar.
              </p>
            </div>
          </section>
  )
}

export function SecaoDuvidas() {
  return (
          <section className={s.secao} id="duvidas">
            <div className={s.faixa}>
              <div className={s.cabecaSecao}>
                <span className={s.olho} data-revela>
                  Dúvidas
                </span>
                <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
  O que perguntam antes de assinar
                </h2>
                <span className={`${s.risco} ${s.riscoCentro}`} data-revela data-atraso="90" aria-hidden />
              </div>

              <div className={s.perguntas}>
                <Pergunta
                  pergunta="Vou perder o meu número atual?"
                  resposta="Não. O atendimento acontece no seu próprio número, o mesmo que está no cartão e no Google. Você autoriza a conexão dentro do WhatsApp e desfaz quando quiser."
                />
                <Pergunta
                  pergunta="Meu número pode ser bloqueado?"
                  resposta="O AutoFluxos usa a API oficial da Meta, e o envio respeita as regras dela: fora da janela de 24 horas, só sai mensagem com modelo aprovado. O que leva a bloqueio é disparo em massa para quem não pediu e denúncia de spam, e é isso que o produto não deixa acontecer por acidente."
                />
                <Pergunta
                  pergunta="Perco o WhatsApp do celular?"
                  resposta="Não. Com a coexistência, o número continua no app WhatsApp Business do celular. O que o chatbot responde aparece lá, e o que você responde pelo celular aparece no Inbox."
                />
                <Pergunta
                  pergunta="Quanto a Meta cobra pelas mensagens?"
                  resposta="A Meta cobra por mensagem, à parte do plano e sem acréscimo nosso. As primeiras 1.000 de atendimento por número no mês são grátis. A calculadora logo acima mostra o valor para o seu volume."
                />
                <Pergunta
                  pergunta="Preciso saber programar?"
                  resposta="Não. O fluxo se monta arrastando blocos, e configuramos o primeiro com você. Quem ajusta depois é quem atende, não um técnico."
                />
                <Pergunta
                  pergunta="A IA pode inventar coisa e falar besteira com meu cliente?"
                  resposta="Ela responde dentro dos limites que você escrever e chama uma pessoa quando não sabe, em vez de arriscar. Você também pode rodar o produto inteiro sem IA. Muitos fluxos não precisam dela."
                />
                <Pergunta
                  pergunta="Continuo conseguindo atender pessoalmente?"
                  resposta="Sim, e é para isso que ele existe. Quando a conversa sai do previsto, ela cai na caixa de entrada com o histórico junto. A pessoa assume no meio e o cliente não repete nada."
                />
                <Pergunta
                  pergunta="Quanto tempo até estar no ar?"
                  resposta="A autorização do número na Meta costuma levar alguns dias. O primeiro fluxo desenhamos juntos numa conversa de uma hora."
                />
                <Pergunta
                  pergunta="E os meus dados?"
                  resposta="As conversas ficam na sua conta e cada empresa vê só as próprias. O que fazemos com dado pessoal está na política de privacidade, sem letra miúda."
                />
              </div>
            </div>
          </section>
  )
}

/* ─────────────────────────── peças ─────────────────────────── */

/**
 * A caixa de entrada, desenhada como o navegador a mostra.
 *
 * **A versão anterior era uma conversa solta**, e ela prova que o bot responde
 * sem provar o que a pessoa compra: a tela onde o atendimento acontece. Aqui
 * aparecem as três colunas que fazem a diferença no dia, a fila com quem
 * espera, a conversa com o handoff no meio dela, e a ficha do contato.
 *
 * Desenhada em HTML pelo mesmo motivo das outras ilustrações: print de um
 * produto que muda toda semana envelhece antes da página ir ao ar.
 */
export function Desktop() {
  return (
    <div className={s.desktop} data-revela data-como="escala" data-atraso="140">
      <div className={s.desktopBarra} aria-hidden>
        <span className={s.janelaPonto} />
        <span className={s.janelaPonto} />
        <span className={s.janelaPonto} />
        <span className={s.desktopEndereco}>autofluxos.4yu.com.br/inbox</span>
      </div>
      <InboxClicavel />
    </div>
  )
}



function Passo({
  rotulo,
  arte,
  titulo,
  texto,
  atraso,
}: {
  rotulo: string
  arte: ReactNode
  titulo: string
  texto: string
  atraso: number
}) {
  return (
    <li className={s.passo} data-revela data-como="escala" data-atraso={atraso}>
      <span className={s.passoNumero}>{rotulo}</span>
      <div className={s.passoArte} aria-hidden>
        {arte}
      </div>
      <h3 className={s.passoTitulo}>{titulo}</h3>
      <p className={s.passoTexto}>{texto}</p>
    </li>
  )
}



/**
 * A primeira frase do resumo é a promessa (Organizar / Automatizar / Decidir),
 * e vira título; o resto é o subtítulo. Um campo só porque a administração
 * edita o plano numa linha (`planos.resumo`).
 */
function PromessaDoPlano({ resumo }: { resumo: string }) {
  const corte = resumo.indexOf('. ')
  if (corte < 0) return <p className={s.planoResumo}>{resumo}</p>
  return (
    <p className={s.planoResumo}>
      <strong className={s.planoPromessa}>{resumo.slice(0, corte + 1)}</strong> {resumo.slice(corte + 2)}
    </p>
  )
}

function Plano({
  nome,
  preco,
  anual,
  resumo,
  itens,
  destaque,
  atraso,
}: {
  nome: string
  preco: string | null
  /** O anual, quando o plano tem: a linha embaixo do preço mensal. */
  anual: { porMes: number; porAno: number; desconto: number } | null
  resumo: string
  itens: string[]
  destaque?: boolean
  atraso: number
}) {
  return (
    <article
      className={`${s.plano} ${destaque ? s.planoDestaque : ''}`}
      data-revela
      data-como="escala"
      data-atraso={atraso}
    >
      <h3 className={s.planoNome}>
        {nome}
        {destaque && <span className={s.planoSelo}>Mais escolhido</span>}
      </h3>

      <p className={s.planoPreco}>
        {preco ? (
          <>
            <span className={s.planoMoeda}>R$</span>
            {preco}
            <span className={s.planoPeriodo}> /mês</span>
          </>
        ) : (
          <span className={s.planoPrecoTexto}>Combinado</span>
        )}
      </p>
      {preco && anual && (
        <p className={s.planoAnual}>
          ou <strong>R$ {anual.porMes.toLocaleString('pt-BR')}/mês</strong> no anual ({anual.desconto}% a menos)
        </p>
      )}

      <PromessaDoPlano resumo={resumo} />

      {/*
        A tarifa da Meta aparece aqui, dentro do card, e não numa nota de rodapé.
        É decisão de venda: num mercado em que a concorrência esconde markup
        dentro de "créditos", repassar a custo é diferenciação real, e escondê-la
        no rodapé desperdiça o argumento.
      */}
      <p className={s.planoTarifa}>{TARIFA_DA_META}</p>

      <ul className={s.planoLista}>
        {itens.map((item) => (
          <li
            key={item}
            className={`${s.planoItem} ${item.startsWith('Tudo d') ? s.planoItemHerda : ''}`}
          >
            <span className={s.planoCheque} aria-hidden>
              <IconeCheque />
            </span>
            {item}
          </li>
        ))}
      </ul>

      <a
        className={`${s.botao} ${destaque ? s.botaoPrincipal : s.botaoVazado} ${s.planoBotao}`}
        href={`mailto:contato@4yu.com.br?subject=${encodeURIComponent(`AutoFluxos: teste grátis do plano ${nome}`)}`}
      >
        {preco ? `Testar ${DIAS_DE_TESTE} dias grátis` : 'Fale conosco'}
      </a>
    </article>
  )
}

export function Pergunta({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  return (
    <details className={s.pergunta} data-revela>
      <summary className={s.perguntaTitulo}>
        {pergunta}
        <span className={s.perguntaSinal} aria-hidden>
          <IconeMais />
        </span>
      </summary>
      <p className={s.perguntaTexto}>{resposta}</p>
    </details>
  )
}


/* ─────────────────────── ilustrações animadas ─────────────────────── */

/*
 * Mini-interfaces desenhadas em HTML, uma por card e uma por passo.
 *
 * **Elas existem porque a alternativa é print**, e print de um produto que
 * muda toda semana envelhece antes de a página ir ao ar. Desenhadas, mostram o
 * *mecanismo*, o fluxo acendendo bloco a bloco, a fila que esvazia, o pacote
 * atravessando a integração, que é o que continua verdadeiro mesmo quando a
 * tela muda.
 *
 * Todas são `aria-hidden` no ponto de uso: são figura, e o texto ao lado já
 * diz o que elas mostram.
 */

/** Três blocos de verdade que acendem em sequência, como o fluxo executando. */
function ArteFluxo() {
  const blocos = [
    ['Mensagem', 'Olá, {nome}! Como posso ajudar?'],
    ['Pergunta', 'Horário · Fazer pedido · Falar com alguém'],
    ['Condição', 'Fora do horário? Deixa recado'],
  ]
  return (
    <div className={`${s.arte} ${s.arteFluxo}`}>
      {blocos.map(([tipo, texto]) => (
        <div key={tipo} className={s.blocoFluxo}>
          <span className={s.blocoTipo}>
            <span className={s.pontoBloco} />
            {tipo}
          </span>
          <span className={s.blocoTexto}>{texto}</span>
        </div>
      ))}
    </div>
  )
}

/** A fila da caixa de entrada: quem espera em cima, cada um com o seu dono. */
function ArteFila() {
  const fila = [
    ['MC', 'Marina Costa', 'Dá pra parcelar?', 'espera 2 min'],
    ['AL', 'André Lima', 'Vocês fazem orçamento?', 'Ana'],
    ['RS', 'Rafael Souza', 'Perfeito, obrigado!', 'chatbot'],
    ['JP', 'Júlia Pereira', 'Confirmado para sábado', '09:28'],
  ]
  return (
    <div className={s.arteFila}>
      {fila.map(([, nome, previa, canto], i) => (
        <div key={nome} className={s.itemFila}>
          <span className={s.avatarFila}>
            <FotoDaPessoa nome={nome!} />
          </span>
          <span className={s.textoFila}>
            <b>{nome}</b>
            <span>{previa}</span>
          </span>
          <span className={i === 0 ? s.selinhoFila : s.cantoFila}>{canto}</span>
        </div>
      ))}
    </div>
  )
}

/** Dois sistemas ligados, com o pacote atravessando o trilho e a resposta embaixo. */
function ArteConexao({
  de = 'Fluxo',
  para = 'Agenda',
  resposta = 'Quinta, 19h está livre',
}: {
  de?: string
  para?: string
  resposta?: string
}) {
  return (
    <div className={s.arteConexaoCaixa}>
      <div className={s.arteConexao}>
        <span className={s.noConexaoRotulado}>
          <span className={s.noConexao}>
            <IconeFluxo />
          </span>
          {de}
        </span>
        <span className={s.trilhoConexao} />
        <span className={s.noConexaoRotulado}>
          <span className={s.noConexao}>
            <IconePlug />
          </span>
          {para}
        </span>
      </div>
      <span className={s.respostaConexao}>{resposta}</span>
    </div>
  )
}

/* As quatro janelas dos passos. A moldura é a mesma; muda o miolo. */

function Janela({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={s.janela}>
      <div className={s.janelaBarra}>
        <span className={s.janelaPonto} />
        <span className={s.janelaPonto} />
        <span className={s.janelaPonto} />
        <span className={s.janelaTitulo}>{titulo}</span>
      </div>
      <div className={s.janelaCorpo}>{children}</div>
    </div>
  )
}

function JanelaConexao() {
  return (
    <Janela titulo="conectar número">
      <ArteConexao de="Seu WhatsApp" para="AutoFluxos" resposta="+55 44 7400-7438 · conectado" />
    </Janela>
  )
}

function JanelaDesenho() {
  return (
    <Janela titulo="editor de fluxo">
      <ArteFluxo />
    </Janela>
  )
}

function JanelaAtendimento() {
  return (
    <Janela titulo="caixa de entrada">
      <ArteFila />
    </Janela>
  )
}

/*
 * Os mesmos números da faixa da home (medidos nas contas do AutoFluxos, 90
 * dias; ver `NUMEROS` em `secoes-do-site.tsx`), para a janela não contradizer a
 * página.
 */
function JanelaNumeros() {
  return (
    <Janela titulo="o que aconteceu">
      {[
        ['resolvido pelo fluxo', 74, '74%'],
        ['passou para a equipe', 26, '26%'],
      ].map(([rotulo, pct, valor]) => (
        <span key={rotulo} className={s.linhaMedidor}>
          <span className={s.rotuloMedidor}>{rotulo}</span>
          <span className={s.medidor}>
            <span className={s.medidorPreenchido} style={{ width: `${pct}%` }} />
          </span>
          <b>{valor}</b>
        </span>
      ))}
      <span className={s.linhaMedidor}>
        <span className={s.rotuloMedidor}>equipe responde em</span>
        <b>1 min 46 s</b>
      </span>
    </Janela>
  )
}

/* ─────────────────────────── ícones ─────────────────────────── */

/*
 * Desenhados aqui em vez de virem de uma biblioteca: são seis, e uma dependência
 * inteira para seis caminhos de SVG custa mais do que resolve.
 */

function IconeFluxo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M8.5 7 15.5 11M8.5 17 15.5 13" strokeLinecap="round" />
    </svg>
  )
}



function IconePlug() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 3v5M15 3v5" strokeLinecap="round" />
      <path d="M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6z" strokeLinejoin="round" />
      <path d="M12 17v4" strokeLinecap="round" />
    </svg>
  )
}

function IconeCheque() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}






function IconeMais() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}
