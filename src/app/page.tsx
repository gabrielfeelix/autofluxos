import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Revelar } from './(site)/revelar'
import s from './(site)/pagina-inicial.module.css'

/**
 * A porta de entrada pública do AutoFluxos.
 *
 * **Esta rota era o painel e virou a landing.** O painel foi para `/painel`.
 * A troca não é cosmética: a Meta exige, para a verificação de acesso do Tech
 * Provider, *"um site completo que mostre o serviço e os detalhes da empresa"*
 * — e o domínio do produto abrindo uma tela de login é rejeição na certa.
 *
 * O visual sai dos tokens do painel (`globals.css`), não de uma paleta
 * inventada aqui. Quem clica em "Entrar" tem que sentir que continuou no mesmo
 * produto.
 */
export const metadata: Metadata = {
  title: 'AutoFluxos — o WhatsApp da sua empresa respondendo sozinho',
  description:
    'Plataforma de atendimento no WhatsApp para pequenas e médias empresas. O fluxo responde o que se repete, sua equipe assume o resto — no número que seus clientes já conhecem.',
  // O painel inteiro é `noindex` pelo layout raiz. Esta página é a exceção:
  // ela existe para ser encontrada.
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://autofluxos.4yu.com.br/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'AutoFluxos',
    url: 'https://autofluxos.4yu.com.br/',
    title: 'AutoFluxos — o WhatsApp da sua empresa respondendo sozinho',
    description:
      'O fluxo responde o que se repete, sua equipe assume o resto. No número que seus clientes já conhecem.',
  },
}

const ENTRAR = '/entrar'

export default function PaginaInicial() {
  return (
    <div className={s.pagina}>
      <Revelar seletorCabecalho={s.cabecalho} classeRolado={s.cabecalhoRolado} />

      <header className={s.cabecalho}>
        <div className={`${s.faixa} ${s.cabecalhoInterno}`}>
          <Link className={s.marca} href="/">
            <span className={s.marcaSigla} aria-hidden>
              <IconeFluxo />
            </span>
            AutoFluxos
          </Link>

          <nav className={s.menu}>
            <a className={s.menuItem} href="#produto">
              O produto
            </a>
            <a className={s.menuItem} href="#como">
              Como funciona
            </a>
            <a className={s.menuItem} href="#precos">
              Preços
            </a>
            <a className={s.menuItem} href="#duvidas">
              Dúvidas
            </a>
          </nav>

          <Link className={`${s.botao} ${s.botaoVazado}`} href={ENTRAR}>
            Entrar
          </Link>
        </div>
      </header>

      <main>
        <section className={s.capa}>
          <div className={s.grade} aria-hidden />
          <div className={s.brilho} aria-hidden />

          <div className={`${s.faixa} ${s.capaInterno}`}>
            <p className={s.selo} data-revela>
              <span className={s.seloTag}>Novo</span>
              Atendimento com IA, dentro dos seus limites
            </p>

            <h1 className={s.titulo} data-revela data-atraso="60">
              Seu WhatsApp responde sozinho.{' '}
              <span className={s.tituloDestaque}>Até a hora de não responder.</span>
            </h1>

            <p className={s.subtitulo} data-revela data-atraso="120">
              O AutoFluxos atende as perguntas que se repetem — horário, preço, endereço,
              confirmação — e passa para a sua equipe o que precisa de gente. No número que
              seus clientes já conhecem, com a conversa inteira guardada.
            </p>

            <div className={s.acoes} data-revela data-atraso="180">
              <a className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`} href="#precos">
                Ver planos
              </a>
              <a className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href="#conversar">
                Falar com a gente
              </a>
            </div>

            <p className={s.notaAcoes} data-revela data-atraso="220">
              Sem cartão para começar · Configuramos o primeiro fluxo com você
            </p>

            <ConversaDaCapa />
          </div>
        </section>

        <section className={s.secao} id="produto">
          <div className={s.faixa}>
            <div className={s.cabecaSecao}>
              <span className={s.olho} data-revela>
                O problema
              </span>
              <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
                A mesma pergunta, quarenta vezes por dia
              </h2>
              <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
                Quem atende por WhatsApp conhece a cena: o celular na mão o dia inteiro, as
                mesmas cinco perguntas se repetindo, e uma conversa importante que ficou sem
                resposta porque entrou no meio das outras.
              </p>
            </div>

            <div className={s.numeros} data-revela data-atraso="140">
              <Numero valor="70%" rotulo="das mensagens que um negócio recebe são as mesmas perguntas" />
              <Numero valor="24/7" rotulo="o fluxo atende de madrugada, no fim de semana e no feriado" />
              <Numero valor="1 número" rotulo="o seu — seus clientes não precisam decorar outro" />
              <Numero valor="0 linhas" rotulo="de código para montar o atendimento" />
            </div>
          </div>
        </section>

        <section className={s.secao}>
          <div className={s.faixa}>
            <span className={s.olho} data-revela>
              O que ele faz
            </span>
            <h2 className={s.tituloSecao} data-revela data-atraso="60">
              Quatro peças, e elas se conversam
            </h2>

            <div className={s.bento}>
              <Caixa
                larga
                icone={<IconeBlocos />}
                titulo="Fluxos montados bloco a bloco"
                texto="Você desenha o caminho da conversa arrastando peças: mensagem, pergunta, condição, espera, guardar. Testa ali mesmo antes de publicar, e cada publicação vira uma versão — dá para voltar."
                atraso={0}
              />
              <Caixa
                larga
                icone={<IconeCaixa />}
                titulo="Caixa de entrada da equipe"
                texto="Todas as conversas num lugar só. Quem está esperando resposta aparece primeiro, cada atendente vê o que é dele, e a conversa inteira está do lado quando alguém assume."
                atraso={80}
              />
              <Caixa
                icone={<IconeIA />}
                titulo="IA com coleira"
                texto="Para o que não cabe num roteiro fixo. Ela responde dentro do que você definir e chama uma pessoa quando não sabe — nunca inventa."
                atraso={160}
              />
              <Caixa
                icone={<IconeFicha />}
                titulo="Ficha de cada contato"
                texto="Histórico, etiquetas e o que já foi combinado. Quem entra no meio da conversa não começa do zero."
                atraso={200}
              />
              <Caixa
                icone={<IconePlug />}
                titulo="Conecta no seu sistema"
                texto="O fluxo consulta a sua agenda, o seu estoque ou o seu ERP durante a conversa, e responde com dado de verdade."
                atraso={240}
              />
            </div>
          </div>
        </section>

        <section className={s.secao} id="como">
          <div className={s.faixa}>
            <div className={s.passos}>
              <div className={s.passosFixo}>
                <span className={s.olho} data-revela>
                  Como funciona
                </span>
                <h2 className={s.tituloSecao} data-revela data-atraso="60">
                  Do seu número, não do nosso
                </h2>
                <p className={s.chamada} data-revela data-atraso="100">
                  O atendimento acontece no WhatsApp da sua empresa. Seus clientes continuam
                  falando com o número que já está no cartão, no site e no Google — e você
                  desconecta quando quiser.
                </p>
              </div>

              <ol className={s.passosLista}>
                <Passo
                  titulo="Você conecta o seu número"
                  texto="A autorização é feita pelo próprio WhatsApp, com a sua conta. Nós não pedimos senha, e você revoga o acesso a qualquer momento pelo painel da Meta."
                  atraso={0}
                />
                <Passo
                  titulo="A gente monta o primeiro fluxo com você"
                  texto="Nada de tela em branco. Configuramos junto o atendimento inicial do seu negócio, com as perguntas que você de fato recebe — não um exemplo genérico."
                  atraso={80}
                />
                <Passo
                  titulo="Sua equipe entra na caixa de entrada"
                  texto="Cada pessoa com o próprio acesso. O que o fluxo não resolveu chega ali com a conversa inteira ao lado, e ninguém pergunta duas vezes a mesma coisa."
                  atraso={160}
                />
                <Passo
                  titulo="Você ajusta olhando o que aconteceu"
                  texto="Onde as pessoas desistem, o que elas perguntam e o bot não sabia, quanto tempo levou para alguém responder. O fluxo melhora com uso."
                  atraso={240}
                />
              </ol>
            </div>
          </div>
        </section>

        <section className={s.secao}>
          <div className={s.faixa}>
            <div className={s.cabecaSecao}>
              <span className={s.olho} data-revela>
                Para quem é
              </span>
              <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
                Feito para quem atende no WhatsApp o dia inteiro
              </h2>
            </div>
          </div>

          <div className={s.esteira} data-revela data-atraso="100">
            <div className={s.esteiraTrilho}>
              <Pastilhas />
              <Pastilhas />
            </div>
          </div>

          <div className={s.faixa}>
            <p className={`${s.chamada} ${s.chamadaCentro}`} style={{ marginTop: 34 }} data-revela>
              Não serve para tudo: o AutoFluxos não emite nota fiscal, não controla estoque e
              não substitui o seu sistema de gestão. Ele cuida do atendimento, e faz isso
              inteiro.
            </p>
          </div>
        </section>

        <section className={s.secao} id="precos">
          <div className={s.faixa}>
            <div className={s.cabecaSecao}>
              <span className={s.olho} data-revela>
                Preços
              </span>
              <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
                Um preço que cabe antes de dar resultado
              </h2>
              <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
                Sem contrato de fidelidade e sem cobrança por atendente. O que muda entre os
                planos é quantos fluxos e quantas conversas você precisa por mês.
              </p>
            </div>

            <div className={s.planos}>
              <Plano
                nome="Essencial"
                preco="197"
                resumo="Para quem quer parar de responder as mesmas perguntas."
                itens={[
                  '1 número de WhatsApp',
                  '3 fluxos publicados',
                  'Até 1.000 conversas por mês',
                  'Caixa de entrada com 3 usuários',
                  'Suporte por WhatsApp',
                ]}
                atraso={0}
              />
              <Plano
                destaque
                nome="Operação"
                preco="397"
                resumo="Para quem já tem equipe atendendo e precisa organizar."
                itens={[
                  '1 número de WhatsApp',
                  'Fluxos ilimitados',
                  'Até 5.000 conversas por mês',
                  'Caixa de entrada com 10 usuários',
                  'Respostas com IA',
                  'Conexão com seus sistemas',
                ]}
                atraso={80}
              />
              <Plano
                nome="Sob medida"
                preco={null}
                resumo="Vários números, volume alto ou integração que exige desenho."
                itens={[
                  'Múltiplos números e unidades',
                  'Volume combinado',
                  'Usuários ilimitados',
                  'Integração desenvolvida com você',
                  'Acompanhamento dedicado',
                ]}
                atraso={160}
              />
            </div>

            <p className={s.notaPreco}>
              Os valores são mensais, em reais, e não incluem o custo que a Meta cobra por
              conversa iniciada pela empresa — ele é da sua conta do WhatsApp e varia com o
              tipo de mensagem. A gente explica isso antes de você começar, com a conta do
              seu volume.
            </p>
          </div>
        </section>

        <section className={s.secao} id="duvidas">
          <div className={s.faixa}>
            <div className={s.cabecaSecao}>
              <span className={s.olho} data-revela>
                Dúvidas
              </span>
              <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
                O que perguntam antes de começar
              </h2>
            </div>

            <div className={s.perguntas}>
              <Pergunta
                pergunta="Vou perder o meu número atual?"
                resposta="Não. O atendimento acontece no seu próprio número, e é ele que continua no cartão e no Google. A conexão é autorizada por você pelo WhatsApp e pode ser desfeita quando quiser."
              />
              <Pergunta
                pergunta="Preciso saber programar?"
                resposta="Não. O fluxo é montado arrastando blocos, e a gente configura o primeiro com você. Quem mexe depois é quem atende, não um técnico."
              />
              <Pergunta
                pergunta="A IA pode inventar coisa e falar besteira com meu cliente?"
                resposta="Ela responde dentro dos limites que você escrever e, quando não sabe, chama uma pessoa em vez de arriscar. Você também pode usar o produto inteiro sem IA nenhuma — muitos fluxos não precisam dela."
              />
              <Pergunta
                pergunta="Continuo conseguindo atender pessoalmente?"
                resposta="Sim, e é o ponto. Quando a conversa sai do previsto, ela chega na caixa de entrada da sua equipe com todo o histórico. A pessoa assume no meio, sem o cliente repetir nada."
              />
              <Pergunta
                pergunta="Quanto tempo até estar no ar?"
                resposta="Depende da autorização do seu número na Meta, que costuma levar alguns dias. O desenho do primeiro fluxo a gente faz numa conversa."
              />
              <Pergunta
                pergunta="E os meus dados?"
                resposta="As conversas ficam na sua conta e cada empresa vê só as próprias. O que fazemos com dado pessoal está escrito na política de privacidade, sem letra miúda."
              />
            </div>
          </div>
        </section>

        <section className={s.faixa} id="conversar">
          <div className={s.fechamento}>
            <div className={s.fechamentoBrilho} aria-hidden />
            <span className={s.olho} data-revela>
              Começar
            </span>
            <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
              A conta nasce pela nossa mão
            </h2>
            <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
              Não há cadastro automático de propósito: a gente conecta o seu número e monta o
              primeiro fluxo com você, para o sistema já abrir atendendo. Escreva contando o
              que o seu negócio recebe de pergunta e a gente responde.
            </p>
            <div className={s.acoes} data-revela data-atraso="140">
              <a
                className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`}
                href="mailto:contato@4yu.com.br?subject=AutoFluxos%3A%20quero%20conhecer"
              >
                Falar com a gente
              </a>
              <Link className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href={ENTRAR}>
                Já sou cliente
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.rodape}>
        <div className={s.faixa}>
          <div className={s.rodapeGrade}>
            <Link className={s.marca} href="/">
              <span className={s.marcaSigla} aria-hidden>
                <IconeFluxo />
              </span>
              AutoFluxos
            </Link>

            <nav className={s.rodapeLinks}>
              <a className={s.rodapeLink} href="#produto">
                O produto
              </a>
              <a className={s.rodapeLink} href="#precos">
                Preços
              </a>
              <Link className={s.rodapeLink} href="/privacidade">
                Privacidade
              </Link>
              <a className={s.rodapeLink} href="https://4yu.com.br" rel="noopener">
                4YU
              </a>
              <Link className={s.rodapeLink} href={ENTRAR}>
                Entrar
              </Link>
            </nav>
          </div>

          <p className={s.rodapeEmpresa}>
            AutoFluxos é um produto da 4YU · Gabriel Felix Barbosa · CNPJ 68.770.493/0001-82
            <br />
            Contato: <a href="mailto:contato@4yu.com.br">contato@4yu.com.br</a> · WhatsApp
            oficial +55 44 7400-7438
            <br />
            WhatsApp é uma marca da Meta Platforms, Inc. Este produto usa a API oficial do
            WhatsApp Business e não é afiliado à Meta.
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ─────────────────────────── peças ─────────────────────────── */

/**
 * A conversa da capa.
 *
 * Ela é o herói da tela e substitui o print: mostra o produto sem prometer uma
 * interface que continua mudando. Os balões entram em cascata pelo `animation-delay`
 * inline — CSS puro, sem timer no cliente.
 */
function ConversaDaCapa() {
  const falas = [
    { quem: 'cliente' as const, texto: 'Oi! Vocês atendem sábado de manhã?' },
    {
      quem: 'bot' as const,
      autor: 'AutoFluxos',
      texto: 'Oi, Marina! Sábado das 8h às 12h. Quer que eu veja um horário para você?',
    },
    { quem: 'cliente' as const, texto: 'Quero. Mas antes: dá pra parcelar? Meu caso é meio específico…' },
    { quem: 'marco' as const, texto: 'Passou para uma pessoa' },
    {
      quem: 'pessoa' as const,
      autor: 'Ana · equipe',
      texto: 'Oi Marina, aqui é a Ana. Vi que você quer sábado — me conta o seu caso.',
    },
  ]

  return (
    <div className={s.palco} data-revela data-atraso="260">
      <div className={s.telefone}>
        <div className={s.telefoneTopo}>
          <span className={s.avatar} aria-hidden>
            MC
          </span>
          <div>
            <div className={s.telefoneNome}>Marina Costa</div>
            <div className={s.telefoneStatus}>+55 44 9•••-4412</div>
          </div>
        </div>

        <div className={s.thread}>
          {falas.map((fala, i) => {
            // 420ms entre balões: rápido o bastante para não entediar, lento o
            // bastante para o olho acompanhar quem fala.
            const estilo = { animationDelay: `${600 + i * 420}ms` }

            if (fala.quem === 'marco') {
              return (
                <span key={i} className={s.marcoHandoff} style={estilo}>
                  <span className={s.pontoVivo} aria-hidden />
                  {fala.texto}
                </span>
              )
            }

            const classe =
              fala.quem === 'cliente'
                ? s.balaoCliente
                : fala.quem === 'bot'
                  ? s.balaoBot
                  : s.balaoPessoa

            return (
              <div key={i} className={`${s.balao} ${classe}`} style={estilo}>
                {fala.quem !== 'cliente' && (
                  <span className={`${s.autor} ${fala.quem === 'bot' ? s.autorBot : s.autorPessoa}`}>
                    {fala.autor}
                  </span>
                )}
                {fala.texto}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className={s.numeroItem}>
      <div className={s.numeroValor}>{valor}</div>
      <div className={s.numeroRotulo}>{rotulo}</div>
    </div>
  )
}

function Caixa({
  icone,
  titulo,
  texto,
  larga,
  atraso,
}: {
  icone: ReactNode
  titulo: string
  texto: string
  larga?: boolean
  atraso: number
}) {
  return (
    <article
      className={`${s.caixa} ${larga ? s.caixaLarga : ''}`}
      data-revela
      data-atraso={atraso}
    >
      <span className={s.caixaIcone} aria-hidden>
        {icone}
      </span>
      <h3 className={s.caixaTitulo}>{titulo}</h3>
      <p className={s.caixaTexto}>{texto}</p>
    </article>
  )
}

function Passo({ titulo, texto, atraso }: { titulo: string; texto: string; atraso: number }) {
  return (
    <li className={s.passo} data-revela data-atraso={atraso}>
      <h3 className={s.passoTitulo}>{titulo}</h3>
      <p className={s.passoTexto}>{texto}</p>
    </li>
  )
}

function Pastilhas() {
  const casos = [
    'Clínicas e consultórios',
    'Estúdios de pilates',
    'Salões e barbearias',
    'Escolas e cursos',
    'Lojas e e-commerce',
    'Imobiliárias',
    'Oficinas',
    'Restaurantes e delivery',
    'Times de vendas',
    'Prestadores de serviço',
  ]

  return (
    <>
      {casos.map((caso) => (
        <span key={caso} className={s.pastilha}>
          <span className={s.pastilhaPonto} aria-hidden />
          {caso}
        </span>
      ))}
    </>
  )
}

function Plano({
  nome,
  preco,
  resumo,
  itens,
  destaque,
  atraso,
}: {
  nome: string
  preco: string | null
  resumo: string
  itens: string[]
  destaque?: boolean
  atraso: number
}) {
  return (
    <article
      className={`${s.plano} ${destaque ? s.planoDestaque : ''}`}
      data-revela
      data-atraso={atraso}
    >
      {destaque && <span className={s.planoSelo}>Mais escolhido</span>}
      <h3 className={s.planoNome}>{nome}</h3>

      <p className={s.planoPreco}>
        {preco ? (
          <>
            <span className={s.planoMoeda}>R$</span>
            {preco}
            <span className={s.planoPeriodo}> /mês</span>
          </>
        ) : (
          'Combinado'
        )}
      </p>

      <p className={s.planoResumo}>{resumo}</p>

      <ul className={s.planoLista}>
        {itens.map((item) => (
          <li key={item} className={s.planoItem}>
            <span className={s.planoCheque} aria-hidden>
              <IconeCheque />
            </span>
            {item}
          </li>
        ))}
      </ul>

      <a
        className={`${s.botao} ${destaque ? s.botaoPrincipal : s.botaoVazado} ${s.planoBotao}`}
        href={`mailto:contato@4yu.com.br?subject=${encodeURIComponent(`AutoFluxos: plano ${nome}`)}`}
      >
        {preco ? 'Começar' : 'Falar com a gente'}
      </a>
    </article>
  )
}

function Pergunta({ pergunta, resposta }: { pergunta: string; resposta: string }) {
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

function IconeBlocos() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <path d="M14 17.5h7M17.5 14v7" strokeLinecap="round" />
    </svg>
  )
}

function IconeCaixa() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12h5l2 3h4l2-3h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 5h13l2.5 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" strokeLinejoin="round" />
    </svg>
  )
}

function IconeIA() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
      <rect x="7" y="7" width="10" height="10" rx="3" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconeFicha() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <circle cx="12" cy="10" r="2.6" />
      <path d="M8 17c.9-1.7 2.3-2.5 4-2.5s3.1.8 4 2.5" strokeLinecap="round" />
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
