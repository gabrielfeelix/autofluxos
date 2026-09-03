import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { IndiceAtivo } from '../(site)/indice-ativo'
import s from '../(site)/privacidade.module.css'

/**
 * A política de privacidade — **pública, e por exigência da Meta**.
 *
 * O app review do WhatsApp Business Platform pede uma URL de política de
 * privacidade acessível sem login. Sem ela o app nem chega a ser avaliado, e o
 * campo `privacy_policy_url` do app estava vazio.
 *
 * Ela é renderizada estaticamente e fica fora de qualquer verificação de sessão
 * (ver `proxy.ts`): quem revisa o app na Meta não tem conta aqui, e uma página
 * que redireciona para o login é, para efeito de análise, uma página que não
 * existe.
 *
 * **O texto descreve o que o sistema faz de verdade**, e cada frase aqui tem
 * correspondente no código: os dados listados são as colunas de `contacts` e
 * `messages`, o prazo é `MESES_DE_RETENCAO_PADRAO`, e a parte de IA é o
 * `contextoNegocio` mais a conversa indo ao Gemini. Se o comportamento mudar,
 * esta página muda junto — política que descreve outro produto é pior do que
 * não ter política.
 *
 * **A roupa mudou em set/2026 e o texto não.** Ela era Tailwind cru numa coluna
 * de 760px e parecia um documento colado no navegador; agora usa os mesmos
 * tokens e a mesma luz da landing, com índice fixo, porque política é documento
 * de consulta e ninguém a lê da primeira à última linha. Nenhuma frase do
 * conteúdo jurídico foi alterada nessa passagem.
 */
export const metadata: Metadata = {
  title: 'Política de Privacidade · AutoFluxos',
  description:
    'Como o AutoFluxos trata os dados das conversas de WhatsApp atendidas pelas automações dos seus clientes.',
}

const ATUALIZADA_EM = '19 de agosto de 2026'

/** Título e âncora de cada seção, na ordem em que aparecem. O índice lê daqui. */
const SECOES = [
  { id: 'quem-somos', titulo: 'Quem somos e o que o AutoFluxos faz' },
  { id: 'dados', titulo: 'Que dados são tratados' },
  { id: 'finalidade', titulo: 'Para que usamos' },
  { id: 'compartilhamento', titulo: 'Com quem compartilhamos' },
  { id: 'prazo', titulo: 'Por quanto tempo guardamos' },
  { id: 'seguranca', titulo: 'Segurança' },
  { id: 'direitos', titulo: 'Direitos de quem conversa com a automação' },
  { id: 'contato', titulo: 'Contato' },
  { id: 'mudancas', titulo: 'Mudanças' },
] as const

export default function Pagina() {
  return (
    <div className={s.pagina}>
      <IndiceAtivo seletorSecao={s.secao} classeAtivo={s.indiceAtivo} />

      <header className={s.cabecalho}>
        <div className={`${s.faixa} ${s.cabecalhoInterno}`}>
          <Link className={s.marca} href="/">
            <span className={s.marcaSigla} aria-hidden>
              <IconeFluxo />
            </span>
            AutoFluxos
          </Link>
          <Link className={s.voltar} href="/">
            <IconeVoltar />
            Voltar ao site
          </Link>
        </div>
      </header>

      <section className={s.capa}>
        <div className={s.capaGrade} aria-hidden />
        <div className={s.capaBrilho} aria-hidden />

        <div className={s.faixa}>
          <span className={s.olho}>4YU · AutoFluxos</span>
          <h1 className={s.titulo}>Política de Privacidade</h1>
          <p className={s.resumo}>
            O resumo em uma frase: as conversas são da empresa que você contratou, nós as
            tratamos para executar o atendimento que ela desenhou, e não usamos nada disso
            para outra finalidade.
          </p>

          <div className={s.selos}>
            <span className={s.selo}>
              <span className={s.seloIcone} aria-hidden>
                <IconeEscudo />
              </span>
              Conforme a LGPD
            </span>
            <span className={s.selo}>
              <span className={s.seloIcone} aria-hidden>
                <IconeProibido />
              </span>
              Não vendemos dados
            </span>
            <span className={s.selo}>
              <span className={s.seloIcone} aria-hidden>
                <IconeProibido />
              </span>
              Não treinamos IA com eles
            </span>
            <span className={s.selo}>
              <span className={s.seloIcone} aria-hidden>
                <IconeRelogio />
              </span>
              Apagamos em 12 meses
            </span>
          </div>

          <p className={s.data}>Atualizada em {ATUALIZADA_EM}</p>
        </div>
      </section>

      <main className={`${s.faixa} ${s.corpo}`}>
        <nav className={s.indice} aria-label="Índice da política">
          <span className={s.indiceTitulo}>Nesta página</span>
          {SECOES.map((secao, i) => (
            <a
              key={secao.id}
              className={s.indiceLink}
              href={`#${secao.id}`}
              data-n={String(i + 1).padStart(2, '0')}
            >
              {secao.titulo}
            </a>
          ))}
        </nav>

        <div className={s.texto}>
          <Secao n={1} id="quem-somos" titulo="Quem somos e o que o AutoFluxos faz">
            <p>
              O AutoFluxos é um serviço da <strong>4YU</strong> que automatiza o atendimento de
              empresas no WhatsApp. Cada empresa cliente desenha o próprio fluxo de conversa e o
              conecta a um número do WhatsApp Business Platform (Cloud API, da Meta).
            </p>
            <p>
              Nessa relação, a <strong>empresa cliente é a controladora</strong> dos dados das
              conversas dela, e a 4YU é <strong>operadora</strong>: tratamos os dados para
              executar o atendimento que ela desenhou, e não para finalidade própria.
            </p>
          </Secao>

          <Secao n={2} id="dados" titulo="Que dados são tratados">
            <ul className={s.lista}>
              <li className={s.item}>
                <strong>Identificação do contato:</strong> o número de WhatsApp e o nome de
                exibição que a Meta envia junto da mensagem.
              </li>
              <li className={s.item}>
                <strong>Conteúdo das mensagens</strong> trocadas entre o contato e a automação,
                inclusive arquivos enviados na conversa, para dar continuidade ao atendimento e
                permitir que uma pessoa da empresa assuma quando o fluxo pedir.
              </li>
              <li className={s.item}>
                <strong>Respostas guardadas pelo fluxo:</strong> o que a própria empresa decidiu
                perguntar e registrar (por exemplo: nome, assunto, prazo).
              </li>
              <li className={s.item}>
                <strong>Dados de operação:</strong> horários das mensagens, status de entrega, e
                registros técnicos necessários para investigar falhas.
              </li>
            </ul>
            <p>
              Não pedimos nem tratamos, por conta própria, dados sensíveis (saúde, biometria,
              convicção religiosa ou política). Se a empresa cliente desenhar um fluxo que os
              colete, a responsabilidade por essa decisão e pela base legal é dela.
            </p>
          </Secao>

          <Secao n={3} id="finalidade" titulo="Para que usamos">
            <ul className={s.lista}>
              <li className={s.item}>
                Executar a automação de atendimento que a empresa cliente desenhou.
              </li>
              <li className={s.item}>Entregar e receber mensagens pelo WhatsApp Business Platform.</li>
              <li className={s.item}>
                Mostrar a conversa e os dados coletados no painel da empresa cliente.
              </li>
              <li className={s.item}>Operar, monitorar e corrigir falhas do serviço.</li>
            </ul>
            <p>
              Não vendemos dados, não os cedemos para publicidade de terceiros e não os usamos
              para treinar modelos de inteligência artificial.
            </p>
          </Secao>

          <Secao n={4} id="compartilhamento" titulo="Com quem compartilhamos">
            <ul className={s.lista}>
              <li className={s.item}>
                <strong>Meta Platforms:</strong> é por ela que a mensagem chega e sai, pelo
                WhatsApp Business Platform.
              </li>
              <li className={s.item}>
                <strong>Provedores de infraestrutura</strong> que hospedam a aplicação e o banco
                de dados, contratados como suboperadores e obrigados a confidencialidade.
              </li>
              <li className={s.item}>
                <strong>Provedor de modelo de IA</strong>, quando e somente quando a empresa
                cliente contrata o recurso de IA e desenha um bloco que o use. Nesse caso, a
                mensagem da pessoa e o contexto escrito pela empresa são enviados ao provedor
                para gerar a resposta.
              </li>
              <li className={s.item}>Autoridades públicas, quando houver obrigação legal.</li>
            </ul>
          </Secao>

          <Secao n={5} id="prazo" titulo="Por quanto tempo guardamos">
            <p>
              Contatos e conversas sem qualquer interação por <strong>12 meses</strong> são
              apagados automaticamente. A empresa cliente pode apagar um contato ou uma conversa
              antes disso, a qualquer momento, pelo painel. Registros que a lei obrigue a manter
              são preservados pelo prazo exigido.
            </p>
          </Secao>

          <Secao n={6} id="seguranca" titulo="Segurança">
            <p>
              O tráfego é cifrado em trânsito (HTTPS). O acesso ao painel exige conta individual,
              e cada conta enxerga apenas os dados da empresa de que é membro. Credenciais de
              integração são guardadas cifradas e nunca aparecem no desenho do fluxo, nos
              registros ou nas telas.
            </p>
          </Secao>

          <Secao n={7} id="direitos" titulo="Direitos de quem conversa com a automação">
            <p>
              Você pode pedir confirmação de tratamento, acesso, correção, anonimização,
              portabilidade ou eliminação dos seus dados, nos termos da LGPD (Lei 13.709/2018).
              Como a 4YU é operadora, o caminho mais direto é falar com a empresa com quem você
              conversou no WhatsApp, que é a controladora. Se preferir, escreva para nós e
              encaminhamos ao cliente responsável.
            </p>
            <p>
              Para parar de receber mensagens automáticas, basta pedir na própria conversa: o
              atendimento é interrompido para o seu número.
            </p>
          </Secao>

          <Secao n={8} id="contato" titulo="Contato">
            <p>
              <a href="mailto:contato@4yu.com.br">contato@4yu.com.br</a>
            </p>
          </Secao>

          <Secao n={9} id="mudancas" titulo="Mudanças">
            <p>
              Quando esta política mudar, a data no topo muda junto. Alterações relevantes são
              avisadas às empresas clientes pelo painel ou por e-mail.
            </p>
          </Secao>

          <div className={s.fecho}>
            <p className={s.fechoTexto}>
              Ficou alguma dúvida sobre o que fazemos com os dados? Escreva. Respondemos em
              português, sem letra miúda.
            </p>
            <a
              className={s.fechoBotao}
              href="mailto:contato@4yu.com.br?subject=AutoFluxos%3A%20d%C3%BAvida%20sobre%20privacidade"
            >
              Falar com a gente
            </a>
          </div>
        </div>
      </main>

      <footer className={s.rodape}>
        <div className={s.faixa}>
          AutoFluxos é um produto da <a href="https://4yu.com.br" rel="noopener">4YU</a> · Gabriel
          Felix Barbosa · CNPJ 68.770.493/0001-82 · Maringá, PR
          <br />
          WhatsApp é marca da Meta Platforms. Usamos a API oficial do WhatsApp Business e não
          somos afiliados à Meta.
        </div>
      </footer>
    </div>
  )
}

function Secao({
  n,
  id,
  titulo,
  children,
}: {
  n: number
  id: string
  titulo: string
  children: ReactNode
}) {
  return (
    <section className={s.secao} id={id}>
      <div className={s.secaoTopo}>
        <span className={s.secaoNumero} aria-hidden>
          {String(n).padStart(2, '0')}
        </span>
        <h2 className={s.secaoTitulo}>{titulo}</h2>
      </div>
      <div className={s.secaoCorpo}>{children}</div>
    </section>
  )
}

/* ─────────────────────────── ícones ─────────────────────────── */

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

function IconeVoltar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 12H6M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconeEscudo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 3l7 3v6c0 4.2-2.8 7.6-7 9-4.2-1.4-7-4.8-7-9V6z" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconeProibido() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="9" />
      <path d="m6 6 12 12" strokeLinecap="round" />
    </svg>
  )
}

function IconeRelogio() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.4l3.4 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
