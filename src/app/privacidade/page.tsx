import type { Metadata } from 'next'
import { Item, Lista, PaginaLegal, type SecaoLegal } from '../(site)/pagina-legal'

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
 * conteúdo jurídico foi alterada nessa passagem — nem quando a moldura saiu
 * daqui para `(site)/pagina-legal.tsx`, para os termos e a exclusão de dados
 * nascerem com a mesma cara em vez de com uma cópia dela.
 */
export const metadata: Metadata = {
  title: 'Política de Privacidade · AutoFluxos',
  description:
    'Como o AutoFluxos trata os dados das conversas de WhatsApp atendidas pelas automações dos seus clientes.',
}

const ATUALIZADA_EM = '19 de agosto de 2026'

const SECOES: readonly SecaoLegal[] = [
  {
    id: 'quem-somos',
    titulo: 'Quem somos e o que o AutoFluxos faz',
    conteudo: (
      <>
        <p>
          O AutoFluxos é um serviço da <strong>4YU</strong> que automatiza o atendimento de
          empresas no WhatsApp. Cada empresa cliente desenha o próprio fluxo de conversa e o
          conecta a um número do WhatsApp Business Platform (Cloud API, da Meta).
        </p>
        <p>
          Nessa relação, a <strong>empresa cliente é a controladora</strong> dos dados das
          conversas dela, e a 4YU é <strong>operadora</strong>: tratamos os dados para executar o
          atendimento que ela desenhou, e não para finalidade própria.
        </p>
      </>
    ),
  },
  {
    id: 'dados',
    titulo: 'Que dados são tratados',
    conteudo: (
      <>
        <Lista>
          <Item>
            <strong>Identificação do contato:</strong> o número de WhatsApp e o nome de exibição
            que a Meta envia junto da mensagem.
          </Item>
          <Item>
            <strong>Conteúdo das mensagens</strong> trocadas entre o contato e a automação,
            inclusive arquivos enviados na conversa, para dar continuidade ao atendimento e
            permitir que uma pessoa da empresa assuma quando o fluxo pedir.
          </Item>
          <Item>
            <strong>Respostas guardadas pelo fluxo:</strong> o que a própria empresa decidiu
            perguntar e registrar (por exemplo: nome, assunto, prazo).
          </Item>
          <Item>
            <strong>Dados de operação:</strong> horários das mensagens, status de entrega, e
            registros técnicos necessários para investigar falhas.
          </Item>
        </Lista>
        <p>
          Não pedimos nem tratamos, por conta própria, dados sensíveis (saúde, biometria,
          convicção religiosa ou política). Se a empresa cliente desenhar um fluxo que os colete,
          a responsabilidade por essa decisão e pela base legal é dela.
        </p>
      </>
    ),
  },
  {
    id: 'finalidade',
    titulo: 'Para que usamos',
    conteudo: (
      <>
        <Lista>
          <Item>Executar a automação de atendimento que a empresa cliente desenhou.</Item>
          <Item>Entregar e receber mensagens pelo WhatsApp Business Platform.</Item>
          <Item>Mostrar a conversa e os dados coletados no painel da empresa cliente.</Item>
          <Item>Operar, monitorar e corrigir falhas do serviço.</Item>
        </Lista>
        <p>
          Não vendemos dados, não os cedemos para publicidade de terceiros e não os usamos para
          treinar modelos de inteligência artificial.
        </p>
      </>
    ),
  },
  {
    id: 'compartilhamento',
    titulo: 'Com quem compartilhamos',
    conteudo: (
      <Lista>
        <Item>
          <strong>Meta Platforms:</strong> é por ela que a mensagem chega e sai, pelo WhatsApp
          Business Platform.
        </Item>
        <Item>
          <strong>Provedores de infraestrutura</strong> que hospedam a aplicação e o banco de
          dados, contratados como suboperadores e obrigados a confidencialidade.
        </Item>
        <Item>
          <strong>Provedor de modelo de IA</strong>, quando e somente quando a empresa cliente
          contrata o recurso de IA e desenha um bloco que o use. Nesse caso, a mensagem da pessoa
          e o contexto escrito pela empresa são enviados ao provedor para gerar a resposta.
        </Item>
        <Item>Autoridades públicas, quando houver obrigação legal.</Item>
      </Lista>
    ),
  },
  {
    id: 'prazo',
    titulo: 'Por quanto tempo guardamos',
    conteudo: (
      <p>
        Contatos e conversas sem qualquer interação por <strong>12 meses</strong> são apagados
        automaticamente. A empresa cliente pode apagar um contato ou uma conversa antes disso, a
        qualquer momento, pelo painel. Registros que a lei obrigue a manter são preservados pelo
        prazo exigido.
      </p>
    ),
  },
  {
    id: 'seguranca',
    titulo: 'Segurança',
    conteudo: (
      <p>
        O tráfego é cifrado em trânsito (HTTPS). O acesso ao painel exige conta individual, e cada
        conta enxerga apenas os dados da empresa de que é membro. Credenciais de integração são
        guardadas cifradas e nunca aparecem no desenho do fluxo, nos registros ou nas telas.
      </p>
    ),
  },
  {
    id: 'direitos',
    titulo: 'Direitos de quem conversa com a automação',
    conteudo: (
      <>
        <p>
          Você pode pedir confirmação de tratamento, acesso, correção, anonimização,
          portabilidade ou eliminação dos seus dados, nos termos da LGPD (Lei 13.709/2018). Como a
          4YU é operadora, o caminho mais direto é falar com a empresa com quem você conversou no
          WhatsApp, que é a controladora. Se preferir, escreva para nós e encaminhamos ao cliente
          responsável.
        </p>
        <p>
          O passo a passo para pedir que os dados sumam, com prazo e com o que exatamente é
          apagado, está em <a href="/exclusao-de-dados">exclusão de dados</a>.
        </p>
        <p>
          Para parar de receber mensagens automáticas, basta pedir na própria conversa: o
          atendimento é interrompido para o seu número.
        </p>
      </>
    ),
  },
  {
    id: 'contato',
    titulo: 'Contato',
    conteudo: (
      <>
        <p>
          <a href="mailto:contato@4yu.com.br">contato@4yu.com.br</a>
        </p>
        <p>
          WhatsApp <a href="https://wa.me/5544998775978">+55 44 99877-5978</a>
        </p>
        <p>
          68.770.493 GABRIEL FELIX BARBOSA (4YU) · CNPJ 68.770.493/0001-82 · Rua Osvaldo Cruz,
          297 — Zona 07 — Maringá/PR — CEP 87020-200.
        </p>
      </>
    ),
  },
  {
    id: 'mudancas',
    titulo: 'Mudanças',
    conteudo: (
      <p>
        Quando esta política mudar, a data no topo muda junto. Alterações relevantes são avisadas
        às empresas clientes pelo painel ou por e-mail.
      </p>
    ),
  },
]

export default function Pagina() {
  return (
    <PaginaLegal
      titulo="Política de Privacidade"
      rotuloDoIndice="Índice da política"
      resumo="O resumo em uma frase: as conversas são da empresa que você contratou, nós as tratamos para executar o atendimento que ela desenhou, e não usamos nada disso para outra finalidade."
      selos={[
        { icone: 'escudo', texto: 'Conforme a LGPD' },
        { icone: 'proibido', texto: 'Não vendemos dados' },
        { icone: 'proibido', texto: 'Não treinamos IA com eles' },
        { icone: 'relogio', texto: 'Apagamos em 12 meses' },
      ]}
      atualizadaEm={ATUALIZADA_EM}
      secoes={SECOES}
      fecho={{
        texto:
          'Ficou alguma dúvida sobre o que fazemos com os dados? Escreva. Respondemos em português, sem letra miúda.',
        rotulo: 'Falar com a gente',
        href: 'mailto:contato@4yu.com.br?subject=AutoFluxos%3A%20d%C3%BAvida%20sobre%20privacidade',
      }}
    />
  )
}
