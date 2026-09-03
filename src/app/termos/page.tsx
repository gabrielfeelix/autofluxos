import type { Metadata } from 'next'
import { Item, Lista, PaginaLegal, type SecaoLegal } from '../(site)/pagina-legal'

/**
 * Os Termos de Serviço — **públicos, e por exigência da Meta**.
 *
 * O campo `terms_of_service_url` das Configurações Básicas do app é
 * obrigatório, e o app review não abre com ele vazio. Como a política de
 * privacidade, esta página fica fora de qualquer verificação de sessão (ver
 * `PORTAS_ABERTAS` em `proxy.ts`): quem revisa não tem conta aqui.
 *
 * **Cada promessa daqui tem correspondente no código, e é essa a regra que
 * governa o texto.** A parte de dados aponta para a política em vez de repetir
 * — dois documentos dizendo a mesma coisa com palavras diferentes divergem no
 * primeiro ajuste. O que este documento acrescenta é o que a política não
 * cobre: quem pode usar, o que não se pode fazer com o serviço, o que acontece
 * quando alguém faz, e o que a 4YU **não** promete.
 *
 * **O que ele não diz, de propósito:** preço, prazo de contrato e nível de
 * serviço. Isso é combinado por proposta, caso a caso, e não existe cobrança
 * dentro do produto. Escrever um número aqui criaria obrigação que o sistema
 * não tem como cumprir nem medir.
 */
export const metadata: Metadata = {
  title: 'Termos de Serviço · AutoFluxos',
  description:
    'As regras de uso do AutoFluxos: quem opera, o que o serviço faz, o que não se pode fazer com ele e o que acontece em caso de uso indevido.',
}

const ATUALIZADA_EM = '3 de setembro de 2026'

const SECOES: readonly SecaoLegal[] = [
  {
    id: 'quem-opera',
    titulo: 'Quem opera o AutoFluxos',
    conteudo: (
      <>
        <p>
          O AutoFluxos é operado por <strong>68.770.493 GABRIEL FELIX BARBOSA (4YU)</strong>, CNPJ
          68.770.493/0001-82, com endereço na Rua Osvaldo Cruz, 297 — Zona 07 — Maringá/PR — CEP
          87020-200. Neste documento, “nós” é essa empresa e “você” é quem usa o serviço.
        </p>
        <p>
          Ao criar uma conta, conectar um número de WhatsApp ou um perfil de Instagram, ou usar o
          painel de qualquer forma, você concorda com estes termos. Se não concordar, não use o
          serviço.
        </p>
      </>
    ),
  },
  {
    id: 'o-que-e',
    titulo: 'O que o serviço faz',
    conteudo: (
      <>
        <p>
          O AutoFluxos é uma ferramenta de automação de atendimento. Você desenha um fluxo de
          conversa, liga esse fluxo a um canal — um número do WhatsApp Business Platform (Cloud
          API, da Meta) ou uma conta profissional do Instagram — e o sistema responde às pessoas
          que escrevem para você, guarda o que elas respondem e chama uma pessoa da sua equipe
          quando o fluxo mandar.
        </p>
        <p>
          <strong>O AutoFluxos não é o WhatsApp nem o Instagram.</strong> Nós usamos as APIs
          oficiais da Meta e não somos afiliados a ela. Quem entrega a mensagem é a Meta, sob as
          regras dela.
        </p>
      </>
    ),
  },
  {
    id: 'sua-conta',
    titulo: 'Sua conta e sua equipe',
    conteudo: (
      <>
        <Lista>
          <Item>
            Cada pessoa entra com uma conta individual, e cada conta enxerga apenas os dados das
            empresas de que é membro. Não compartilhe senha: o registro do que foi feito no painel
            aponta para a conta que fez.
          </Item>
          <Item>
            Quem administra a empresa no painel responde por quem ele convida e pelo que essas
            pessoas fazem ali dentro.
          </Item>
          <Item>
            Você é responsável por manter as credenciais que cadastra — token da Meta, chaves de
            integração — válidas e sob seu controle. Nós as guardamos cifradas e nunca as
            mostramos de volta na tela.
          </Item>
        </Lista>
      </>
    ),
  },
  {
    id: 'dados',
    titulo: 'De quem são os dados das conversas',
    conteudo: (
      <>
        <p>
          <strong>São seus.</strong> Na linguagem da LGPD, a sua empresa é a{' '}
          <strong>controladora</strong> dos dados das conversas dela e a 4YU é a{' '}
          <strong>operadora</strong>: tratamos esses dados para executar o atendimento que você
          desenhou, e não para finalidade própria. Não vendemos dados, não os cedemos para
          publicidade de terceiros e não treinamos modelos de IA com eles.
        </p>
        <p>
          Como isso funciona em detalhe — que dados são tratados, com quem são compartilhados e
          por quanto tempo ficam — está na{' '}
          <a href="/privacidade">política de privacidade</a>, que faz parte destes termos. O
          caminho para apagar está em <a href="/exclusao-de-dados">exclusão de dados</a>.
        </p>
        <p>
          Como controladora, cabe a você ter base legal para falar com as pessoas que fala,
          responder aos pedidos delas e desenhar fluxos que não coletem mais do que você precisa.
          Se um fluxo seu coletar dado sensível, a decisão e a responsabilidade por ela são suas.
        </p>
      </>
    ),
  },
  {
    id: 'uso-indevido',
    titulo: 'O que não se pode fazer com o serviço',
    conteudo: (
      <>
        <p>Usar o AutoFluxos para qualquer das coisas abaixo é quebra destes termos:</p>
        <Lista>
          <Item>
            <strong>Mandar mensagem para quem não pediu.</strong> Disparo em massa para lista
            comprada, raspada ou obtida sem consentimento, e qualquer coisa que uma pessoa normal
            chamaria de spam.
          </Item>
          <Item>
            <strong>Enganar sobre quem está falando</strong> — se passar por outra empresa, por
            órgão público, por banco, ou esconder que do outro lado há uma automação quando
            perguntarem.
          </Item>
          <Item>
            Golpe, fraude, phishing, corrente, pirâmide, e oferta de coisa cuja venda a lei
            proíbe.
          </Item>
          <Item>
            Conteúdo ilegal, ameaça, assédio, discurso de ódio, ou material que explore criança ou
            adolescente.
          </Item>
          <Item>
            <strong>Quebrar as regras da Meta.</strong> A Política de Mensagens do WhatsApp
            Business e os termos das plataformas valem junto com estes — e é a Meta quem bloqueia
            o número, não nós.
          </Item>
          <Item>
            Tentar burlar limites técnicos, sondar falhas de segurança, acessar dado de outra
            empresa, ou automatizar o painel de um jeito que atrapalhe quem mais usa o serviço.
          </Item>
        </Lista>
      </>
    ),
  },
  {
    id: 'suspensao',
    titulo: 'Suspensão e encerramento',
    conteudo: (
      <>
        <p>
          Podemos suspender o acesso, o envio de mensagens ou a conta inteira quando houver uso
          indevido pela lista acima, ordem legal, risco à segurança do serviço, ou quando a Meta
          bloquear o canal. Sempre que der, avisamos antes e explicamos o motivo; quando o risco
          for imediato, agimos primeiro e explicamos em seguida.
        </p>
        <p>
          Você pode parar de usar quando quiser. Ao encerrar, os dados da sua empresa são apagados
          conforme a <a href="/exclusao-de-dados">página de exclusão de dados</a>; se quiser levar
          o que coletou, peça a exportação <strong>antes</strong> de pedir o encerramento —
          apagado aqui é apagado de verdade, e não há cópia guardada em outro lugar.
        </p>
      </>
    ),
  },
  {
    id: 'disponibilidade',
    titulo: 'Disponibilidade: o que não prometemos',
    conteudo: (
      <>
        <p>
          O serviço é fornecido <strong>no estado em que está</strong>. Não garantimos
          funcionamento ininterrupto nem ausência de falhas, e não há SLA salvo se algum estiver
          escrito em contrato assinado com você.
        </p>
        <p>
          Boa parte do que faz uma mensagem chegar não está sob nosso controle: a Meta pode
          indisponibilizar a API, mudar regra, limitar ou bloquear um número; a operadora pode
          atrasar a entrega; o provedor de infraestrutura pode cair. Fazemos manutenção e podemos
          alterar ou descontinuar recursos, avisando com antecedência razoável quando a mudança
          for relevante.
        </p>
        <p>
          <strong>Automação não substitui pessoa em assunto urgente.</strong> Não use o AutoFluxos
          como único canal para emergência médica, segurança ou qualquer situação em que a demora
          de uma resposta cause dano.
        </p>
      </>
    ),
  },
  {
    id: 'responsabilidade',
    titulo: 'Limite de responsabilidade',
    conteudo: (
      <>
        <p>
          Não respondemos por lucro cessante, perda de oportunidade ou dano indireto decorrente do
          uso ou da indisponibilidade do serviço. Nos casos em que houver responsabilidade nossa,
          ela fica limitada ao valor pago por você pelo serviço nos 12 meses anteriores ao fato.
        </p>
        <p>
          Nada aqui afasta as garantias que o Código de Defesa do Consumidor e a legislação
          aplicável tornem inafastáveis.
        </p>
      </>
    ),
  },
  {
    id: 'propriedade',
    titulo: 'De quem é o quê',
    conteudo: (
      <p>
        O software, a marca e o design do AutoFluxos são nossos. Os fluxos que você desenha, os
        textos que escreve e os dados que coleta são seus — você nos dá apenas a licença
        necessária para hospedar, processar e transmitir esse conteúdo para o serviço funcionar.
        Presets e modelos que o produto oferece você pode usar, copiar e alterar à vontade dentro
        do serviço.
      </p>
    ),
  },
  {
    id: 'mudancas',
    titulo: 'Mudanças nestes termos',
    conteudo: (
      <p>
        Quando estes termos mudarem, a data no topo muda junto. Alterações relevantes são avisadas
        pelo painel ou por e-mail antes de valer. Continuar usando o serviço depois disso é
        aceitar a versão nova; se não concordar, encerre a conta.
      </p>
    ),
  },
  {
    id: 'foro',
    titulo: 'Lei aplicável e foro',
    conteudo: (
      <p>
        Estes termos são regidos pela lei brasileira. Fica eleito o foro da comarca de{' '}
        <strong>Maringá, Paraná</strong> para resolver o que não se resolver por conversa — com
        ressalva do foro que a lei garanta ao consumidor.
      </p>
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
]

export default function Pagina() {
  return (
    <PaginaLegal
      titulo="Termos de Serviço"
      rotuloDoIndice="Índice dos termos"
      resumo="O resumo em uma frase: você desenha o atendimento e é dono das conversas, nós rodamos a ferramenta com honestidade sobre o que ela garante, e quem usar isso para incomodar gente perde o acesso."
      selos={[
        { icone: 'documento', texto: 'As conversas são suas' },
        { icone: 'proibido', texto: 'Nada de disparo em massa' },
        { icone: 'escudo', texto: 'As regras da Meta valem junto' },
        { icone: 'relogio', texto: 'Sem garantia de disponibilidade' },
      ]}
      atualizadaEm={ATUALIZADA_EM}
      secoes={SECOES}
      fecho={{
        texto:
          'Alguma dúvida sobre uma regra destas antes de assinar embaixo? Pergunte. Respondemos em português, sem letra miúda.',
        rotulo: 'Falar com a gente',
        href: 'mailto:contato@4yu.com.br?subject=AutoFluxos%3A%20d%C3%BAvida%20sobre%20os%20termos',
      }}
    />
  )
}
