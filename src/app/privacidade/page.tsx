import type { Metadata } from 'next'

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
 */
export const metadata: Metadata = {
  title: 'Política de Privacidade — AutoFluxos',
  description:
    'Como o AutoFluxos trata os dados das conversas de WhatsApp atendidas pelas automações dos seus clientes.',
}

const ATUALIZADA_EM = '19 de agosto de 2026'

export default function Pagina() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-5 py-14 text-ink">
      <p className="text-[11px] font-bold tracking-[0.12em] text-dim uppercase">4YU · AutoFluxos</p>
      <h1 className="mt-2 text-[28px] font-bold tracking-[-0.02em]">Política de Privacidade</h1>
      <p className="mt-1 text-[12.5px] text-dim">Atualizada em {ATUALIZADA_EM}.</p>

      <Secao titulo="Quem somos e o que o AutoFluxos faz">
        <p>
          O AutoFluxos é um serviço da <strong className="text-soft">4YU</strong> que automatiza o
          atendimento de empresas no WhatsApp. Cada empresa cliente desenha o próprio fluxo de
          conversa e o conecta a um número do WhatsApp Business Platform (Cloud API, da Meta).
        </p>
        <p>
          Nessa relação, a <strong className="text-soft">empresa cliente é a controladora</strong>{' '}
          dos dados das conversas dela, e a 4YU é <strong className="text-soft">operadora</strong>:
          tratamos os dados para executar o atendimento que ela desenhou, e não para finalidade
          própria.
        </p>
      </Secao>

      <Secao titulo="Que dados são tratados">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong className="text-soft">Identificação do contato:</strong> o número de WhatsApp e
            o nome de exibição que a Meta envia junto da mensagem.
          </li>
          <li>
            <strong className="text-soft">Conteúdo das mensagens</strong> trocadas entre o contato e
            a automação, inclusive arquivos enviados na conversa, para dar continuidade ao
            atendimento e permitir que uma pessoa da empresa assuma quando o fluxo pedir.
          </li>
          <li>
            <strong className="text-soft">Respostas guardadas pelo fluxo</strong> — o que a própria
            empresa decidiu perguntar e registrar (por exemplo: nome, assunto, prazo).
          </li>
          <li>
            <strong className="text-soft">Dados de operação:</strong> horários das mensagens, status
            de entrega, e registros técnicos necessários para investigar falhas.
          </li>
        </ul>
        <p>
          Não pedimos nem tratamos, por conta própria, dados sensíveis (saúde, biometria, convicção
          religiosa ou política). Se a empresa cliente desenhar um fluxo que os colete, a
          responsabilidade por essa decisão e pela base legal é dela.
        </p>
      </Secao>

      <Secao titulo="Para que usamos">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>Executar a automação de atendimento que a empresa cliente desenhou.</li>
          <li>Entregar e receber mensagens pelo WhatsApp Business Platform.</li>
          <li>Mostrar a conversa e os dados coletados no painel da empresa cliente.</li>
          <li>Operar, monitorar e corrigir falhas do serviço.</li>
        </ul>
        <p>
          Não vendemos dados, não os cedemos para publicidade de terceiros e não os usamos para
          treinar modelos de inteligência artificial.
        </p>
      </Secao>

      <Secao titulo="Com quem compartilhamos">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong className="text-soft">Meta Platforms</strong> — é por ela que a mensagem chega e
            sai, pelo WhatsApp Business Platform.
          </li>
          <li>
            <strong className="text-soft">Provedores de infraestrutura</strong> que hospedam a
            aplicação e o banco de dados, contratados como suboperadores e obrigados a confidencia-
            lidade.
          </li>
          <li>
            <strong className="text-soft">Provedor de modelo de IA</strong>, quando — e somente
            quando — a empresa cliente contrata o recurso de IA e desenha um bloco que o use. Nesse
            caso, a mensagem da pessoa e o contexto escrito pela empresa são enviados ao provedor
            para gerar a resposta.
          </li>
          <li>Autoridades públicas, quando houver obrigação legal.</li>
        </ul>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <p>
          Contatos e conversas sem qualquer interação por{' '}
          <strong className="text-soft">12 meses</strong> são apagados automaticamente. A empresa
          cliente pode apagar um contato ou uma conversa antes disso, a qualquer momento, pelo
          painel. Registros que a lei obrigue a manter são preservados pelo prazo exigido.
        </p>
      </Secao>

      <Secao titulo="Segurança">
        <p>
          O tráfego é cifrado em trânsito (HTTPS). O acesso ao painel exige conta individual, e cada
          conta enxerga apenas os dados da empresa de que é membro. Credenciais de integração são
          guardadas cifradas e nunca aparecem no desenho do fluxo, nos registros ou nas telas.
        </p>
      </Secao>

      <Secao titulo="Direitos de quem conversa com a automação">
        <p>
          Você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade
          ou eliminação dos seus dados, nos termos da LGPD (Lei 13.709/2018). Como a 4YU é operadora,
          o caminho mais direto é falar com a empresa com quem você conversou no WhatsApp — ela é a
          controladora. Se preferir, escreva para nós e encaminhamos ao cliente responsável.
        </p>
        <p>
          Para parar de receber mensagens automáticas, basta pedir na própria conversa: o
          atendimento é interrompido para o seu número.
        </p>
      </Secao>

      <Secao titulo="Contato">
        <p>
          <a
            href="mailto:contato@4yu.com.br"
            className="font-semibold text-accent underline underline-offset-4"
          >
            contato@4yu.com.br
          </a>
        </p>
      </Secao>

      <Secao titulo="Mudanças">
        <p>
          Quando esta política mudar, a data no topo muda junto. Alterações relevantes são avisadas
          às empresas clientes pelo painel ou por e-mail.
        </p>
      </Secao>
    </main>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-[16px] font-bold tracking-[-0.01em]">{titulo}</h2>
      <div className="mt-2 space-y-3 text-[13.5px] leading-[1.75] text-muted">{children}</div>
    </section>
  )
}
