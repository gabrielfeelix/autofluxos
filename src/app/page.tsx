import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DerivaDeParticulas } from './(site)/deriva-de-particulas'
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
  title: 'AutoFluxos: o WhatsApp da sua empresa respondendo sozinho',
  description:
    'Plataforma de atendimento no WhatsApp para pequenas e médias empresas. O fluxo responde o que se repete e sua equipe assume o resto, no número que seus clientes já conhecem.',
  // O painel inteiro é `noindex` pelo layout raiz. Esta página é a exceção:
  // ela existe para ser encontrada.
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://autofluxos.4yu.com.br/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'AutoFluxos',
    url: 'https://autofluxos.4yu.com.br/',
    title: 'AutoFluxos: o WhatsApp da sua empresa respondendo sozinho',
    description:
      'O fluxo responde o que se repete e sua equipe assume o resto, no número que seus clientes já conhecem.',
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
          <DerivaDeParticulas className={s.campo} />
          <div className={s.veu} aria-hidden />
          <div className={s.grade} aria-hidden />

          <div className={`${s.faixa} ${s.capaInterno}`}>
            <p className={s.selo} data-revela>
              <span className={s.seloTag}>Novo</span>
API oficial do WhatsApp Business
            </p>

            <h1 className={s.titulo}>
              <TituloAnimado
                linhas={[
                  { texto: 'Seu WhatsApp responde sozinho.' },
                  { texto: 'Até a hora de não responder.', destaque: true },
                ]}
              />
            </h1>

            <p className={s.subtitulo} data-revela data-atraso="820">
              Horário, preço, endereço, confirmação: o AutoFluxos responde sozinho as cinco
              perguntas que chegam quarenta vezes por dia. O resto vai para a sua equipe,
              com a conversa inteira do lado. Tudo no número que já está no seu cartão.
            </p>

            <div className={s.acoes} data-revela data-atraso="920">
              <a className={`${s.botao} ${s.botaoPrincipal} ${s.botaoGrande}`} href="#precos">
                Ver planos
              </a>
              <a className={`${s.botao} ${s.botaoVazado} ${s.botaoGrande}`} href="#conversar">
                Falar com a gente
              </a>
            </div>

            <div className={s.tiras} data-revela data-atraso="1010">
              <span className={s.tira}>
                <span className={s.tiraValor}>24/7</span> sem ninguém de plantão
              </span>
              <span className={s.tira}>
                <span className={s.tiraValor}>API oficial</span> do WhatsApp Business
              </span>
              <span className={s.tira}>
                <span className={s.tiraValor}>Seu número</span> continua sendo o seu
              </span>
            </div>
          </div>

          <span className={s.rolar} aria-hidden>
            <IconeSeta />
          </span>
        </section>

        <section className={s.secao}>
          <div className={`${s.focoLuz} ${s.focoDireita}`} aria-hidden />
          <div className={s.faixa}>
            <div className={s.cabecaSecao}>
              <span className={s.olho} data-revela>
                Na prática
              </span>
              <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
                Isto é o que a sua equipe vê
              </h2>
              <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
                Uma tela com as conversas de todo mundo. Quem espera resposta sobe para o
                topo, o histórico fica ao lado, e a ficha diz quem é a pessoa antes de você
                digitar a primeira palavra.
              </p>
            </div>
            <Desktop />
          </div>
        </section>

        <section className={s.secao} id="produto">
          <div className={s.faixa}>
            <div className={s.cabecaSecao}>
              <span className={s.olho} data-revela>
                O problema
              </span>
              <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
                Você já sabe a resposta antes de ler a pergunta
              </h2>
              <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
                "Que horas vocês abrem?" pela oitava vez antes do almoço. Você responde,
                volta pro que estava fazendo, e às sete da noite descobre que alguém
                perguntando de orçamento ficou sem resposta desde as onze.
              </p>
            </div>

            <div className={s.numeros} data-revela data-atraso="140">
              <Numero valor="70%" rotulo="das mensagens que chegam são as mesmas cinco perguntas" />
              <Numero valor="24/7" rotulo="responde domingo de manhã e na véspera de feriado" />
              <Numero valor="1 número" rotulo="o seu. Ninguém precisa decorar um número novo" />
              <Numero valor="0 linhas" rotulo="de código. Você arrasta blocos e testa ali mesmo" />
            </div>
          </div>
        </section>

        <section className={s.secao}>
          <div className={`${s.focoLuz} ${s.focoEsquerda}`} aria-hidden />
          <div className={s.faixa}>
            <span className={s.olho} data-revela>
              O que ele faz
            </span>
            <h2 className={s.tituloSecao} data-revela data-atraso="60">
              Cinco peças que trabalham juntas
            </h2>

            <div className={s.bento}>
              <Caixa
                larga
                arte={<ArteFluxo />}
                titulo="Fluxos montados bloco a bloco"
                texto="Você arrasta mensagem, pergunta, condição e espera até a conversa ficar do jeito que você atende. Testa ali mesmo. Cada publicação vira uma versão, então dá para voltar quando algo sai errado."
                atraso={0}
              />
              <Caixa
                larga
                arte={<ArteFila />}
                titulo="Caixa de entrada da equipe"
                texto="Todas as conversas numa tela. Quem espera sobe para o topo, cada atendente vê o que é dele, e quem assume no meio lê o que já foi dito antes de responder."
                atraso={80}
              />
              <Caixa
                arte={<ArteIA />}
                titulo="IA com coleira"
                texto="Para o que não cabe num roteiro fixo. Ela responde dentro do que você escrever e chama alguém quando não sabe, em vez de arriscar."
                atraso={160}
              />
              <Caixa
                arte={<ArteFicha />}
                titulo="Ficha de cada contato"
                texto="Sete conversas anteriores, as etiquetas que você criou e o que já foi combinado. Quem entra no meio não pergunta de novo."
                atraso={200}
              />
              <Caixa
                arte={<ArteConexao />}
                titulo="Conecta no seu sistema"
                texto="O fluxo abre a sua agenda no meio da conversa e responde com o horário que está livre agora, não com um horário genérico."
                atraso={240}
              />
            </div>
          </div>
        </section>

        <section className={s.secao} id="como">
          <div className={`${s.focoLuz} ${s.focoDireita}`} aria-hidden />
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
                  falando com o número que já está no cartão, no site e no Google. E você
                  desconecta quando quiser.
                </p>
              </div>

              <ol className={s.passosLista}>
                <Passo
                  rotulo="Conectar"
                  arte={<JanelaConexao />}
                  titulo="Você conecta o seu número"
                  texto="A autorização acontece dentro do WhatsApp, com a sua conta. Nunca pedimos
senha. Você corta o acesso quando quiser, no painel da Meta, sem falar com a
gente."
                  atraso={0}
                />
                <Passo
                  rotulo="Desenhar"
                  arte={<JanelaDesenho />}
                  titulo="A gente monta o primeiro fluxo com você"
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

        <section className={s.secao}>
          <div className={s.faixa}>
            <div className={s.cabecaSecao}>
              <span className={s.olho} data-revela>
                Para quem é
              </span>
              <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
  Para quem atende no WhatsApp o dia inteiro
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
              Ele não emite nota fiscal, não controla estoque e não substitui o seu sistema de
              gestão. Cuida do atendimento, e cuida inteiro.
            </p>
          </div>
        </section>

        <section className={s.secao}>
          <div className={`${s.focoLuz} ${s.focoDireita}`} aria-hidden />
          <div className={s.faixa}>
            <div className={s.cabecaSecao}>
              <span className={s.olho} data-revela>
                Quem faz
              </span>
              <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
A 4YU já tem software no ar
              </h2>
              <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
                O AutoFluxos é novo e ainda não tem carteira de clientes. Não vamos inventar
                uma. O que dá para conferir hoje são os produtos que a 4YU publicou e mantém.
              </p>
            </div>

            <div className={s.provas}>
              <Prova
                sigla="DA"
                nome="Deixei Aqui"
                onde="Google Play · desde ago/2026"
                texto="App para lembrar onde você guardou as coisas. Está na produção da Play Store desde agosto, com atualizações desde então."
                estado="No ar"
                atraso={0}
              />
              <Prova
                sigla="QC"
                nome="Quanto Cobro"
                onde="Google Play · desde ago/2026"
                texto="Calculadora de preço para quem presta serviço e nunca sabe quanto cobrar. Também na produção da Play Store."
                estado="No ar"
                atraso={80}
              />
              <Prova
                sigla="VE"
                nome="Verandi"
                onde="verandi.4yu.com.br"
                texto="Agenda para estúdios e clínicas: grade fixa, chamada, reposição. Nasceu da planilha de um estúdio de pilates que atende de verdade."
                estado="No ar, com clientes"
                atraso={160}
              />
            </div>
          </div>
        </section>

        <section className={s.secao} id="precos">
          <div className={`${s.focoLuz} ${s.focoEsquerda}`} aria-hidden />
          <div className={s.faixa}>
            <div className={s.cabecaSecao}>
              <span className={s.olho} data-revela>
                Preços
              </span>
              <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-atraso="60">
Um preço que cabe antes de dar resultado
              </h2>
              <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
                Sem fidelidade e sem cobrar por atendente. O que muda entre os planos é
                quantos fluxos e quantas conversas cabem no seu mês.
              </p>
            </div>

            <div className={s.planos}>
              <Plano
                nome="Essencial"
                preco="197"
                resumo="Para quem atende sozinho e quer parar de repetir horário e preço."
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
                resumo="Para quem já tem três pessoas atendendo e perde conversa no meio."
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
                resumo="Mais de um número, volume alto, ou integração que precisa ser desenhada."
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
              Os valores são mensais e não incluem o que a Meta cobra por conversa iniciada
              pela empresa. Essa cobrança é da sua conta do WhatsApp e muda conforme o tipo
              de mensagem. Fazemos essa conta com o seu volume antes de você assinar.
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
O que perguntam antes de assinar
              </h2>
            </div>

            <div className={s.perguntas}>
              <Pergunta
                pergunta="Vou perder o meu número atual?"
                resposta="Não. O atendimento acontece no seu próprio número, o mesmo que está no cartão e no Google. Você autoriza a conexão dentro do WhatsApp e desfaz quando quiser."
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
                resposta="A autorização do número na Meta costuma levar alguns dias. O primeiro fluxo a gente desenha numa conversa de uma hora."
              />
              <Pergunta
                pergunta="E os meus dados?"
                resposta="As conversas ficam na sua conta e cada empresa vê só as próprias. O que fazemos com dado pessoal está na política de privacidade, sem letra miúda."
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
              Não existe cadastro automático aqui, e isso é de propósito. Conectamos o seu
              número e montamos o primeiro fluxo junto, para o sistema abrir já atendendo.
              Escreva contando que perguntas chegam no seu WhatsApp.
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
 * A caixa de entrada, desenhada como o navegador a mostra.
 *
 * **A versão anterior era uma conversa solta**, e ela prova que o bot responde
 * sem provar o que a pessoa compra: a tela onde o atendimento acontece. Aqui
 * aparecem as três colunas que fazem a diferença no dia — a fila com quem
 * espera, a conversa com o handoff no meio dela, e a ficha do contato.
 *
 * Desenhada em HTML pelo mesmo motivo das outras ilustrações: print de um
 * produto que muda toda semana envelhece antes da página ir ao ar.
 */
function Desktop() {
  const conversas = [
    { sigla: 'MC', nome: 'Marina Costa', previa: 'Quero. Mas antes: dá pra parcelar?', hora: '09:42', espera: true, ativa: true },
    { sigla: 'RS', nome: 'Rafael Souza', previa: 'Perfeito, obrigado!', hora: '09:31', espera: false, ativa: false },
    { sigla: 'JP', nome: 'Julia Pereira', previa: 'Bot: confirmado para quinta às 15h', hora: '09:28', espera: false, ativa: false, bot: true },
    { sigla: 'AL', nome: 'André Lima', previa: 'Vocês fazem orçamento?', hora: '09:15', espera: true, ativa: false },
    { sigla: 'CF', nome: 'Carla Ferreira', previa: 'Bot: endereço enviado', hora: '08:57', espera: false, ativa: false, bot: true },
  ]

  return (
    <div className={s.desktop} data-revela data-atraso="140">
      <div className={s.desktopBarra} aria-hidden>
        <span className={s.janelaPonto} />
        <span className={s.janelaPonto} />
        <span className={s.janelaPonto} />
        <span className={s.desktopEndereco}>autofluxos.4yu.com.br/inbox</span>
      </div>

      <div className={s.desktopCorpo}>
        <div className={s.colunaLista}>
          <div className={s.tituloColuna}>
            Conversas
            <span className={s.contadorEspera}>2 esperando</span>
          </div>

          {conversas.map((c) => (
            <div key={c.nome} className={`${s.itemLista} ${c.ativa ? s.itemListaAtivo : ''}`}>
              <span className={`${s.avatarLista} ${c.bot ? s.avatarListaBot : ''}`} aria-hidden>
                {c.sigla}
              </span>
              <span className={s.corpoLista}>
                <span className={s.nomeLista}>{c.nome}</span>
                <span className={s.previaLista}>{c.previa}</span>
              </span>
              {c.espera ? <span className={s.marcaLista} aria-hidden /> : <span className={s.horaLista}>{c.hora}</span>}
            </div>
          ))}
        </div>

        <div className={s.colunaThread}>
          <div className={s.threadTopo}>
            <span className={s.avatarLista} aria-hidden>
              MC
            </span>
            <span>
              <span className={s.threadNome}>Marina Costa</span>
              <span className={s.threadSub}>+55 44 9•••-4412</span>
            </span>
            <span className={s.threadAcao}>Ana assumiu</span>
          </div>

          <div className={s.threadCorpo}>
            <Falas />
          </div>

          <div className={s.threadRodape} aria-hidden>
            <span className={s.campoFalso}>Escreva para Marina…</span>
            <span className={s.botaoEnviar}>
              <IconeEnviar />
            </span>
          </div>
        </div>

        <div className={s.colunaFicha}>
          <div className={s.fichaCabeca}>
            <span className={s.fichaAvatarGrande} aria-hidden>
              MC
            </span>
            <span>
              <span className={s.threadNome}>Marina Costa</span>
              <span className={s.threadSub}>cliente desde mar/2026</span>
            </span>
          </div>

          <div className={s.blocoFicha}>
            <span className={s.rotuloFicha}>Etiquetas</span>
            <div className={s.fichaEtiquetas}>
              <span className={s.etiqueta}>quer sábado</span>
              <span className={s.etiqueta}>parcelamento</span>
              <span className={s.etiqueta}>volta sempre</span>
            </div>
          </div>

          <div className={s.blocoFicha}>
            <span className={s.rotuloFicha}>Histórico</span>
            <span className={s.linhaFicha}>
              <span>Conversas</span>
              <span>7</span>
            </span>
            <span className={s.linhaFicha}>
              <span>Último atendimento</span>
              <span>12/ago</span>
            </span>
            <span className={s.linhaFicha}>
              <span>Atendida por</span>
              <span>Ana</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * A conversa que mostra o produto funcionando.
 *
 * **Ela saiu da capa quando o campo de partículas entrou** — as duas coisas
 * competiam pela mesma atenção, e a capa ficou com o texto. Aqui embaixo ela
 * tem a seção inteira, e é a primeira coisa que aparece depois da dobra.
 *
 * Substitui o print: mostra o produto sem prometer uma interface que continua
 * mudando. Os balões entram em cascata pelo `animation-delay` inline — CSS
 * puro, sem timer no cliente.
 */
function Falas() {
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
      texto: 'Oi Marina, aqui é a Ana. Vi que você quer sábado. Me conta o seu caso.',
    },
  ]

  return (
    <>
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
    </>
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
  arte,
  titulo,
  texto,
  larga,
  atraso,
}: {
  arte: ReactNode
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
      <div className={s.caixaArte} aria-hidden>
        {arte}
      </div>
      <div className={s.caixaPe}>
        <h3 className={s.caixaTitulo}>{titulo}</h3>
        <p className={s.caixaTexto}>{texto}</p>
      </div>
    </article>
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
    <li className={s.passo} data-revela data-atraso={atraso}>
      <span className={s.passoNumero}>{rotulo}</span>
      <div className={s.passoArte} aria-hidden>
        {arte}
      </div>
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

/**
 * Um produto que a 4YU publicou.
 *
 * Ocupa o lugar do depoimento e responde à mesma pergunta — "dá para confiar
 * em quem fez isso?" — com o que é verificável: os apps estão na Play Store e
 * a Verandi está no ar. Ver o comentário da seção no CSS.
 */
function Prova({
  sigla,
  nome,
  onde,
  texto,
  estado,
  atraso,
}: {
  sigla: string
  nome: string
  onde: string
  texto: string
  estado: string
  atraso: number
}) {
  return (
    <article className={s.prova} data-revela data-atraso={atraso}>
      <div className={s.provaTopo}>
        <span className={s.provaSigla} aria-hidden>
          {sigla}
        </span>
        <div>
          <div className={s.provaNome}>{nome}</div>
          <div className={s.provaOnde}>{onde}</div>
        </div>
      </div>
      <p className={s.provaTexto}>{texto}</p>
      <span className={s.provaEstado}>
        <span className={s.pontoVivo} aria-hidden />
        {estado}
      </span>
    </article>
  )
}

/**
 * O título da capa, palavra por palavra.
 *
 * **A quebra em palavras é o efeito.** Cada uma vira um `<span>` com o próprio
 * atraso, e o CSS as materializa subindo e saindo do desfoque — o olho lê isso
 * como profundidade, não como um fade.
 *
 * O texto continua legível para quem não executa JS e para leitor de tela: são
 * spans com o texto dentro, na ordem, dentro de um `<h1>` de verdade. O
 * `aria-hidden` ficaria errado aqui — é o título da página.
 */
function TituloAnimado({ linhas }: { linhas: { texto: string; destaque?: boolean }[] }) {
  let indice = 0

  return (
    <>
      {linhas.map((linha, iLinha) => (
        <span key={iLinha} className={linha.destaque ? s.tituloDestaque : undefined}>
          {iLinha > 0 && <br />}
          {linha.texto.split(' ').map((palavra, iPalavra, todas) => {
            // 78ms entre palavras: a frase inteira leva pouco mais de um
            // segundo, que é o tempo que alguém leva para focar a tela.
            const atraso = 120 + indice++ * 78
            const ultima = iPalavra === todas.length - 1
            return (
              // O espaço fica **fora** do span animado: dentro de um
              // `inline-block` ele é colapsado e as palavras se colam. Depois
              // da última não há espaço nenhum, senão o cursor que vem em
              // seguida quebra para a linha de baixo sozinho.
              <span key={`${iLinha}-${palavra}-${atraso}`}>
                <span className={s.palavra} style={{ animationDelay: `${atraso}ms` }}>
                  {palavra}
                </span>
                {!ultima && ' '}
              </span>
            )
          })}
          {iLinha === linhas.length - 1 && (
            <span
              className={s.cursor}
              style={{ animationDelay: `${120 + indice * 78}ms, ${420 + indice * 78}ms` }}
              aria-hidden
            />
          )}
        </span>
      ))}
    </>
  )
}

/* ─────────────────────── ilustrações animadas ─────────────────────── */

/*
 * Mini-interfaces desenhadas em HTML, uma por card e uma por passo.
 *
 * **Elas existem porque a alternativa é print**, e print de um produto que
 * muda toda semana envelhece antes de a página ir ao ar. Desenhadas, mostram o
 * *mecanismo* — o fluxo acendendo bloco a bloco, a fila que esvazia, o pacote
 * atravessando a integração — que é o que continua verdadeiro mesmo quando a
 * tela muda.
 *
 * Todas são `aria-hidden` no ponto de uso: são figura, e o texto ao lado já
 * diz o que elas mostram.
 */

/** Três blocos que acendem em sequência, como o fluxo executando. */
function ArteFluxo() {
  return (
    <div className={`${s.arte} ${s.arteFluxo}`}>
      {['Mensagem', 'Pergunta', 'Condição'].map((rotulo) => (
        <div key={rotulo} className={s.blocoFluxo}>
          <span className={s.pontoBloco} />
          {rotulo}
          <span className={s.linhaBloco} />
        </div>
      ))}
    </div>
  )
}

/** A fila da caixa de entrada esvaziando: cada item resolve e some. */
function ArteFila() {
  return (
    <div className={s.arteFila}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={s.itemFila}>
          <span className={s.avatarFila} />
          <span className={s.textoFila}>
            <span className={s.barraFila} />
            <span className={`${s.barraFila} ${s.barraFilaCurta}`} />
          </span>
          {i === 0 && <span className={s.selinhoFila}>espera</span>}
        </div>
      ))}
    </div>
  )
}

/** O núcleo da IA pulsando com dois anéis, e os três pontos de "pensando". */
function ArteIA() {
  return (
    <div className={s.arteIA}>
      <span className={s.nucleoIA}>
        <IconeIA />
      </span>
      <span className={s.pontosIA}>
        <span className={s.pontoIA} />
        <span className={s.pontoIA} />
        <span className={s.pontoIA} />
      </span>
    </div>
  )
}

/** A ficha do contato, com as etiquetas acendendo uma a uma. */
function ArteFicha() {
  return (
    <div className={s.arteFicha}>
      <div className={s.fichaTopo}>
        <span className={s.fichaAvatar}>MC</span>
        <span className={s.textoFila}>
          <span className={s.barraFila} />
          <span className={`${s.barraFila} ${s.barraFilaCurta}`} />
        </span>
      </div>
      <div className={s.fichaEtiquetas}>
        <span className={s.etiqueta}>cliente</span>
        <span className={s.etiqueta}>sábado</span>
        <span className={s.etiqueta}>parcelar</span>
      </div>
    </div>
  )
}

/** Dois sistemas ligados, com o pacote atravessando o trilho. */
function ArteConexao() {
  return (
    <div className={s.arteConexao}>
      <span className={s.noConexao}>
        <IconeFluxo />
      </span>
      <span className={s.trilhoConexao} />
      <span className={s.noConexao}>
        <IconePlug />
      </span>
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
      <ArteConexao />
      <span className={s.linhaMedidor}>
        <span className={s.pontoBloco} />
        +55 44 7400-7438
      </span>
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

function JanelaNumeros() {
  return (
    <Janela titulo="o que aconteceu">
      {[
        ['resolvido pelo fluxo', 78],
        ['passou para pessoa', 22],
        ['sem resposta', 4],
      ].map(([rotulo, pct]) => (
        <span key={rotulo as string} className={s.linhaMedidor}>
          <span className={s.medidor}>
            <span className={s.medidorPreenchido} style={{ maxWidth: `${pct}%` }} />
          </span>
          {rotulo}
        </span>
      ))}
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

function IconeEnviar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconeSeta() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 5v13M6.5 12.5 12 18l5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
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
