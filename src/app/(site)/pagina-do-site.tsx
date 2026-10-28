import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  anualDoPlano,
  O_QUE_E_CONVERSA,
  DIAS_DE_TESTE,
  ENTERPRISE,
  PLANOS,
  PLANO_EM_DESTAQUE,
  TARIFA_DA_META,
} from '@/core/planos'
import { Cursor } from './cursor'
import { NumeroQueSobe } from './numero-que-sobe'
import { PerguntaRepetida } from './pergunta-repetida'
import { FluxoSeMontando } from './fluxo-se-montando'
import { MenuDoTopo } from './menu-do-topo'
import fp from './faixa-do-problema.module.css'
import { ProgressoDosPassos } from './progresso-dos-passos'
import { Revelar } from './revelar'
import { GLIFO_CLAUDE, GLIFO_GOOGLE, GLIFO_OPENAI, GLIFO_PERPLEXITY } from '@/components/design/glifos-oficiais'
import s from './pagina-inicial.module.css'

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

export function PaginaDoSite({ capa, children }: { capa: ReactNode; children: ReactNode }) {
  return (
    <div className={s.pagina}>
      <Revelar seletorCabecalho={s.cabecalho} classeRolado={s.cabecalhoRolado} />
      <Cursor classePonto={s.cursorPonto} classeAnel={s.cursorAnel} classeAtivo={s.cursorAtivo} />

      <header className={s.cabecalho}>
        <div className={`${s.faixa} ${s.cabecalhoInterno}`}>
          <Link className={s.marca} href="/">
            <span className={s.marcaSigla} aria-hidden>
              <IconeFluxo />
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
            <div className={s.fechamentoBrilho} aria-hidden />
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
                  <IconeFluxo />
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
              <a className={s.rodapeLink} data-n="001" href="/produto">
                O que ele faz
              </a>
              <a className={s.rodapeLink} data-n="002" href="/produto#como">
                Como funciona
              </a>
              <a className={s.rodapeLink} data-n="003" href="/precos">
                Preços
              </a>
              <a className={s.rodapeLink} data-n="004" href="/precos#duvidas">
                Dúvidas
              </a>
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

export function SecaoProblema() {
  return (
          <section className={fp.faixa} id="produto">
            <div className={`${s.faixa} ${fp.grade}`}>
              <div className={fp.texto}>
                <span className={s.olho} data-revela>
                  O problema
                </span>
                <h2 className={fp.titulo} data-revela data-como="desfoque" data-atraso="60">
                  Você já sabe a resposta antes de ler a pergunta
                </h2>
                <p className={fp.chamada} data-revela data-atraso="100">
                  “Que horas vocês abrem?” pela oitava vez antes do almoço. Você responde,
                  volta para o que estava fazendo, e às sete da noite descobre que alguém
                  pedindo orçamento ficou sem resposta desde as onze.
                </p>
              </div>
              <PerguntaRepetida />
            </div>

            {/*
              Números medidos, não de mercado, 90 dias até 28/out/2026, todas as
              contas. 74%: sessões sem transferência (`sessions` x `handoffs`),
              554 conversas, 141 com equipe. 1 em 6: 12.286 mensagens recebidas,
              16,5% fora de seg-sex 8h-18h. 4 s: mediana entre a mensagem
              recebida e a próxima enviada na mesma sessão (`messages`, lead()
              por session_id, sem histórico), 1.730 respostas antes de haver
              transferência; depois da transferência a mediana é 106 s (136).
              Refazer a conta antes de mudar qualquer número.
            */}
            <div className={`${s.faixa} ${fp.numeros}`}>
              <NumeroEscuro valor="74%" rotulo="das conversas com o chatbot terminam sem precisar da equipe" atraso={0} />
              <NumeroEscuro valor="1 em 6" rotulo="mensagens chega fora do horário comercial, quando a equipe já encerrou o dia" atraso={110} />
              <NumeroEscuro valor="4 s" rotulo="é o tempo de resposta do chatbot, na mediana. Com a equipe, 1 min 46 s." atraso={220} />
            </div>
            <p className={`${s.faixa} ${fp.fonte}`} data-revela data-atraso="300">
              Medido nas contas do AutoFluxos, últimos 90 dias.
            </p>
          </section>
  )
}


export function SecaoOQueFaz() {
  return (
          <section className={s.secao}>
            <div className={`${s.focoLuz} ${s.focoEsquerda}`} aria-hidden />
            <div className={s.faixa}>
              <span className={s.olho} data-revela>
                O que ele faz
              </span>
              <h2 className={s.tituloSecao} data-revela data-como="desfoque" data-atraso="60">
                Cinco peças que trabalham juntas
              </h2>
                <span className={s.risco} data-revela data-atraso="90" aria-hidden />

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
          <section className={s.secao} id="precos">
            <div className={`${s.focoLuz} ${s.focoEsquerda}`} aria-hidden />
            <div className={s.faixa}>
              <div className={s.cabecaSecao}>
                <span className={s.olho} data-revela>
                  Preços
                </span>
                <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
  Um preço que cabe antes de dar resultado
                </h2>
                <span className={`${s.risco} ${s.riscoCentro}`} data-revela data-atraso="90" aria-hidden />
                <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
                  Organize, automatize, decida. A IA é a mesma em todos os planos: o que sobe é o que ela
                  faz sozinha, o tamanho da equipe e quantas conversas cabem no mês. {DIAS_DE_TESTE} dias
                  grátis, sem cartão, e quem só acompanha (sócio, financeiro) entra de graça.
                </p>
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

              <aside className={s.enterprise} data-revela>
                <div>
                  <h3 className={s.enterpriseNome}>{ENTERPRISE.nome}</h3>
                  <p className={s.enterpriseResumo}>
                    {ENTERPRISE.resumo} A partir de R$ {ENTERPRISE.aPartirDe.toLocaleString('pt-BR')} por mês.
                  </p>
                  <ul className={s.enterpriseItens}>
                    {ENTERPRISE.itens.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <a
                  className={`${s.botao} ${s.botaoVazado}`}
                  href={`mailto:contato@4yu.com.br?subject=${encodeURIComponent('AutoFluxos: plano Enterprise')}`}
                >
                  Fale conosco
                </a>
              </aside>

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
function Desktop() {
  const conversas = [
    { sigla: 'MC', nome: 'Marina Costa', previa: 'Quero. Mas antes: dá pra parcelar?', hora: '09:42', espera: true, ativa: true },
    { sigla: 'RS', nome: 'Rafael Souza', previa: 'Perfeito, obrigado!', hora: '09:31', espera: false, ativa: false },
    { sigla: 'JP', nome: 'Julia Pereira', previa: 'Bot: confirmado para quinta às 15h', hora: '09:28', espera: false, ativa: false, bot: true },
    { sigla: 'AL', nome: 'André Lima', previa: 'Vocês fazem orçamento?', hora: '09:15', espera: true, ativa: false },
    { sigla: 'CF', nome: 'Carla Ferreira', previa: 'Bot: endereço enviado', hora: '08:57', espera: false, ativa: false, bot: true },
  ]

  return (
    <div className={s.desktop} data-revela data-como="escala" data-atraso="140">
      <span className={s.lustro} aria-hidden />
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
 * **Ela saiu da capa quando o campo de partículas entrou**, as duas coisas
 * competiam pela mesma atenção, e a capa ficou com o texto. Aqui embaixo ela
 * tem a seção inteira, e é a primeira coisa que aparece depois da dobra.
 *
 * Substitui o print: mostra o produto sem prometer uma interface que continua
 * mudando. Os balões entram em cascata pelo `animation-delay` inline, CSS
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

function NumeroEscuro({ valor, rotulo, atraso }: { valor: string; rotulo: string; atraso: number }) {
  return (
    <div className={fp.numero} data-revela data-como="escala" data-atraso={atraso}>
      <NumeroQueSobe texto={valor} className={fp.numeroValor} />
      <p className={fp.numeroRotulo}>{rotulo}</p>
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
      data-como="escala"
      data-atraso={atraso}
    >
      <span className={s.lustro} aria-hidden />
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
    <li className={s.passo} data-revela data-como="escala" data-atraso={atraso}>
      <span className={s.lustro} aria-hidden />
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
      <span className={s.lustro} aria-hidden />
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



function IconeIA() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
      <rect x="7" y="7" width="10" height="10" rx="3" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
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


function IconeMais() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}
