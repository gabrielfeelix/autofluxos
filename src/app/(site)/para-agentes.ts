import {
  CONVERSAS_NO_TESTE,
  DIAS_DE_TESTE,
  ENTERPRISE,
  O_QUE_E_CONVERSA,
  PLANOS,
  RECURSOS_DO_PLANO,
  TARIFA_DA_META,
  anualDoPlano,
  type Plano,
} from '@/core/planos'
import { CANAIS } from './canais-do-site'
import { DUVIDAS, DUVIDAS_DE_QUEM_PESQUISA, type Duvida } from './duvidas-do-site'
import { ITENS_DE_INTEGRACAO, type Grupo } from './integracoes-do-site'
import { SITE_URL } from './metadados'
import { MODELOS_DE_TODOS, NICHOS_DO_SITE } from './nichos-do-site'
import { RECURSOS } from './recursos-do-site'

/*
 * O Dialogon em texto puro, para agente de IA ler: `/llms.txt` (o índice),
 * `/llms-full.txt` (tudo) e as fatias `.md` (preços, integrações, dúvidas,
 * API). A página `/para-agentes` lista esses endereços.
 *
 * **Nada aqui é escrito à mão duas vezes.** Canal, recurso, segmento,
 * integração, plano e dúvida vêm dos mesmos módulos que desenham o site. Mudou
 * o preço em `src/core/planos.ts`, o `llms.txt` muda no próximo deploy. Era o
 * defeito do arquivo estático anterior em `public/`: dizia "Profissional" muito
 * depois do plano virar "Operação".
 */

const CONTATO_EMAIL = 'contato@dialogon.com.br'

const u = (caminho: string) => `${SITE_URL}${caminho}`

const reais = (valor: number, centavos = false) =>
  valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: centavos ? 2 : 0,
    maximumFractionDigits: 2,
  })

const NOMES_DOS_GRUPOS: Record<Grupo, string> = {
  canais: 'Canais e entradas',
  lojas: 'Lojas virtuais',
  pagamentos: 'Pagamentos (link de pagamento na conversa)',
  cardapios: 'Cardápios digitais (pedido entra no quadro)',
}

export const RESUMO =
  'Dialogon é uma plataforma brasileira de atendimento e vendas por mensagem. Reúne WhatsApp, Instagram Direct, chat do site e Telegram numa caixa de entrada só, com chatbot de fluxos visuais, IA que atende com o contexto da empresa, CRM com funil e transmissões. Usa a API oficial do WhatsApp (Cloud API da Meta), no mesmo número que a empresa já tem. A empresa é de Maringá (PR).'

export const FATOS_CURTOS = [
  `Teste grátis de ${DIAS_DE_TESTE} dias, sem cartão.`,
  `Planos mensais sem fidelidade, de ${reais(Math.min(...PLANOS.map((p) => p.preco)))} a ${reais(Math.max(...PLANOS.map((p) => p.preco)))} por mês, mais o Enterprise sob contrato.`,
  TARIFA_DA_META,
  'O número continua no app WhatsApp Business do celular (coexistência).',
  'A IA é opcional, responde só com o que a empresa cadastrou e passa para uma pessoa quando não sabe.',
  'Painel, suporte e preços em português e em reais.',
]

/* ───────────────────────── peças ───────────────────────── */

function blocoDeDuvidas(duvidas: Duvida[], nivel = '###') {
  return duvidas.map((d) => `${nivel} ${d.pergunta}\n\n${d.resposta}`).join('\n\n')
}

function linhaDoPlano(p: Plano) {
  const anual = anualDoPlano(p)
  return [
    `### ${p.nome}: ${reais(p.preco)} por mês`,
    '',
    p.resumo,
    '',
    `- No anual: ${anual ? `${reais(anual.porMes)} por mês (${reais(anual.porAno)} por ano, ${anual.desconto}% de desconto)` : 'sem opção anual'}`,
    `- Conversas por mês: ${p.conversas.toLocaleString('pt-BR')}; acima disso, ${reais(p.precoExcedente, true)} por conversa`,
    `- Atendentes inclusos: ${p.atendentes}; atendente a mais: ${reais(p.precoAtendenteExtra)} por mês`,
    `- Números de WhatsApp: ${p.numeros === 1 ? '1' : `até ${p.numeros}`}`,
    `- Respostas de IA por mês: ${p.tetoIa.toLocaleString('pt-BR')}${p.recursos.includes('chave_propria') ? ', ou sem teto com chave de IA própria' : ''}`,
    `- Envios de transmissão por mês: ${p.tetoTransmissoes === null ? 'sem limite' : p.tetoTransmissoes.toLocaleString('pt-BR')}`,
    `- Recursos: ${RECURSOS_DO_PLANO.filter((r) => p.recursos.includes(r.chave))
      .map((r) => r.rotulo)
      .join('; ')}`,
    '',
    ...p.itens.map((item) => `- ${item}`),
  ].join('\n')
}

/** Desce um nível em todo título, para a fatia entrar dentro do arquivo completo. */
const rebaixar = (md: string) => md.replace(/^(#+) /gm, '#$1 ')

/* ───────────────────────── as fatias ───────────────────────── */

export function precosEmMarkdown() {
  return [
    '# Preços do Dialogon',
    '',
    `> Fonte: ${u('/precos')}. Valores em reais (BRL), planos mensais sem fidelidade.`,
    '',
    `- Teste grátis: ${DIAS_DE_TESTE} dias, sem cartão, até ${CONVERSAS_NO_TESTE} conversas, com os recursos do plano Operação.`,
    `- ${O_QUE_E_CONVERSA}`,
    `- ${TARIFA_DA_META} As primeiras 1.000 mensagens de atendimento por número no mês são grátis pela Meta.`,
    '- Em qualquer plano, a equipe do Dialogon monta o primeiro fluxo junto, se o cliente pedir.',
    '',
    '## Planos',
    '',
    ...PLANOS.map((p) => linhaDoPlano(p) + '\n'),
    `### ${ENTERPRISE.nome}: sob consulta`,
    '',
    ENTERPRISE.resumo,
    '',
    ...ENTERPRISE.itens.map((item) => `- ${item}`),
    '',
  ].join('\n')
}

export function integracoesEmMarkdown() {
  const grupos = Object.keys(NOMES_DOS_GRUPOS) as Grupo[]
  return [
    '# Integrações do Dialogon',
    '',
    `> Fonte: ${u('/integracoes')}. "Disponível" significa conector pronto hoje; "em breve" significa que ainda não existe.`,
    '',
    ...grupos.flatMap((g) => {
      const itens = ITENS_DE_INTEGRACAO.filter((i) => i.grupo === g)
      return [
        `## ${NOMES_DOS_GRUPOS[g]}`,
        '',
        ...itens.map((i) => `- **${i.nome}** (${i.emBreve ? 'em breve' : 'disponível'}): ${i.detalhe}`),
        '',
      ]
    }),
    '## Agenda e sistemas de gestão',
    '',
    'Em todos, a IA mostra o horário livre, marca e desmarca direto no sistema, sempre para quem está conversando e só depois de a pessoa confirmar.',
    '',
    '- **Verandi** (disponível): agenda e gestão de aulas, para estúdios, academias e escolas.',
    '- **Google Agenda** (disponível): para quem não usa sistema nenhum; conecta com um login e o atendimento vira evento com nome e telefone do cliente.',
    '- **Feegow** (disponível): clínicas.',
    '- **Clínica nas Nuvens** (disponível): clínicas.',
    '- **Trinks** (disponível): salões e estética.',
    '- **AgendaPro** (disponível): salões e estética.',
    '- **EVO** (disponível): academias.',
    '',
    '## Vendas',
    '',
    '- **Greenn** (disponível): venda paga vira contato com etiqueta e mensagem de boas-vindas; boleto ou Pix em aberto ganha lembrete; reembolso e chargeback tiram o contato das campanhas.',
    '',
    '## Integração com qualquer sistema',
    '',
    '- API REST v1, webhook de entrada (outro sistema abre um fluxo) e webhooks de saída. Detalhes em ' + u('/api.md') + '.',
    '- O bloco "Chama um sistema" faz requisição HTTP no meio da conversa, com a credencial guardada no cofre da conta e a resposta virando variável.',
    '',
  ].join('\n')
}

export function duvidasEmMarkdown() {
  return [
    '# Dúvidas frequentes sobre o Dialogon',
    '',
    `> Fonte: ${u('/precos#duvidas')} e as páginas de segmento.`,
    '',
    '## Antes de assinar',
    '',
    blocoDeDuvidas(DUVIDAS),
    '',
    '## O que quem pesquisa costuma perguntar',
    '',
    blocoDeDuvidas(DUVIDAS_DE_QUEM_PESQUISA),
    '',
    ...NICHOS_DO_SITE.flatMap((n) => [`## Segmento: ${n.nome}`, '', blocoDeDuvidas(n.duvidas), '']),
  ].join('\n')
}

export function apiEmMarkdown() {
  return [
    '# API do Dialogon',
    '',
    '> Para conectar um sistema ao Dialogon. A documentação completa, com exemplos em cURL, Node e Python, fica no painel, em Ajuda > Desenvolvedores.',
    '',
    '## API REST v1',
    '',
    `- Base: \`${SITE_URL}/api/v1\``,
    '- Planos: Operação e Escala.',
    '- Autenticação: `Authorization: Bearer <chave>`. A chave é criada no painel, mostrada uma vez e guardada só em hash.',
    '- Escopos: `contatos:ler`, `contatos:escrever`, `fluxos:disparar`, `mensagens:enviar`, `funil:ler`, `funil:escrever`.',
    '- Limites: 120 chamadas por minuto por chave, corpo até 64 KB, `Idempotency-Key` no envio de modelo.',
    '',
    '| Método | Caminho | O que faz |',
    '|---|---|---|',
    '| GET | `/api/v1/contatos` | Lista contatos, com filtro por etiqueta e data |',
    '| POST | `/api/v1/contatos` | Cria ou atualiza contato com campos e etiquetas |',
    '| GET | `/api/v1/contatos/{telefone}` | Consulta um contato |',
    '| GET | `/api/v1/etiquetas` | Lista etiquetas |',
    '| GET | `/api/v1/fluxos` | Lista automações |',
    '| POST | `/api/v1/fluxos/{id}/disparar` | Abre uma automação para um contato |',
    '| GET | `/api/v1/templates` | Lista modelos aprovados pela Meta |',
    '| POST | `/api/v1/mensagens/template` | Envia modelo aprovado (cria o contato se preciso) |',
    '| GET | `/api/v1/funil` | Funis e etapas |',
    '| GET | `/api/v1/funil/oportunidades` | Oportunidades de um telefone |',
    '| POST | `/api/v1/funil/oportunidades` | Abre oportunidade |',
    '| PATCH | `/api/v1/funil/oportunidades/{id}` | Muda etapa, marca ganha ou perdida |',
    '',
    '## Webhook de entrada',
    '',
    `- \`POST ${SITE_URL}/api/webhook/entrada/{clienteId}\` com \`{ evento, telefone, dados }\`, assinado com HMAC-SHA256.`,
    '- Cada evento cadastrado no painel abre uma automação no WhatsApp do contato.',
    '',
    '## Webhooks de saída (plano Escala)',
    '',
    '- Eventos: `contato.criado`, `contato.etapa_mudou`, `oportunidade.ganha`, `oportunidade.perdida`.',
    '- Até 5 por conta, assinatura HMAC-SHA256, 6 tentativas (de 1 minuto a 12 horas) e registro de entregas.',
    '',
    '## Chat do site',
    '',
    '- Uma linha de `<script>` coloca o balão de atendimento no site; as conversas entram no mesmo Inbox do WhatsApp.',
    '',
  ].join('\n')
}

/* ───────────────────────── os dois arquivos ───────────────────────── */

export function llmsTxt() {
  return [
    '# Dialogon',
    '',
    `> ${RESUMO}`,
    '',
    ...FATOS_CURTOS.map((f) => `- ${f}`),
    '',
    `Para o conteúdo inteiro num arquivo só, leia ${u('/llms-full.txt')}.`,
    '',
    '## Comece por aqui',
    '',
    `- [Tudo em um arquivo](${u('/llms-full.txt')}): produto, canais, segmentos, integrações, preços, dúvidas e limites.`,
    `- [Preços](${u('/precos.md')}): planos, franquias, excedentes e o que a Meta cobra.`,
    `- [Integrações](${u('/integracoes.md')}): o que conecta hoje e o que ainda não.`,
    `- [Dúvidas](${u('/duvidas.md')}): perguntas frequentes, inclusive quando o Dialogon não é a escolha certa.`,
    `- [API](${u('/api.md')}): API REST v1 e webhooks.`,
    `- [Para agentes](${u('/para-agentes')}): a lista destes endereços.`,
    '',
    '## Produto',
    '',
    `- [Visão geral](${u('/produto')})`,
    ...RECURSOS.map((r) => `- [${r.nome}](${u(`/produto/${r.slug}`)}): ${r.subtitulo}`),
    '',
    '## Canais',
    '',
    ...CANAIS.map((c) => `- [${c.nome}](${u(`/canais/${c.slug}`)}): ${c.subtitulo}${c.aviso ? ` Observação: ${c.aviso}` : ''}`),
    '',
    '## Segmentos',
    '',
    ...NICHOS_DO_SITE.map((n) => `- [${n.nome}](${u(`/segmentos/${n.slug}`)}): ${n.quem}. ${n.subtitulo}`),
    '',
    '## Empresa',
    '',
    `- [Página inicial](${u('/')})`,
    `- [Preços](${u('/precos')})`,
    `- [Integrações](${u('/integracoes')})`,
    `- [Privacidade](${u('/privacidade')})`,
    `- [Termos de serviço](${u('/termos')})`,
    `- [Exclusão de dados](${u('/exclusao-de-dados')})`,
    `- [Contato](mailto:${CONTATO_EMAIL})`,
    '- [Instagram](https://www.instagram.com/usedialogon/)',
    '',
    '## Optional',
    '',
    `- [Mapa do site](${u('/sitemap.xml')})`,
    '',
  ].join('\n')
}

export function llmsFullTxt() {
  return [
    '# Dialogon',
    '',
    `> ${RESUMO}`,
    '',
    `Este arquivo reúne o site ${SITE_URL} em texto puro, para assistentes de IA. É gerado a partir das mesmas fontes que o site, então os números batem com as páginas.`,
    '',
    '## Em poucas linhas',
    '',
    ...FATOS_CURTOS.map((f) => `- ${f}`),
    '',
    '## Produto',
    '',
    ...RECURSOS.flatMap((r) => [
      `### ${r.nome}`,
      '',
      `${r.titulo}. ${r.subtitulo}`,
      `Página: ${u(`/produto/${r.slug}`)}`,
      '',
      ...r.destaques.map((d) => `- **${d.titulo}**: ${d.texto}`),
      ...r.itens.map((i) => `- **${i.titulo}**: ${i.texto}`),
      ...r.ficha.linhas.map((l) => `- ${l.rotulo}: ${l.valor}`),
      '',
    ]),
    '## Canais',
    '',
    ...CANAIS.flatMap((c) => [
      `### ${c.nome}`,
      '',
      `${c.titulo}. ${c.subtitulo}`,
      `Página: ${u(`/canais/${c.slug}`)}`,
      ...(c.aviso ? ['', `Observação: ${c.aviso}`] : []),
      '',
      'Como conecta:',
      '',
      ...c.passos.map((p, i) => `${i + 1}. **${p.titulo}**: ${p.texto}`),
      '',
      ...c.recursos.map((r) => `- **${r.titulo}**: ${r.texto}`),
      ...c.ficha.map((f) => `- ${f.rotulo}: ${f.valor}`),
      '',
    ]),
    '## Segmentos',
    '',
    `Toda conta recebe os modelos ${MODELOS_DE_TODOS.join(', ')}, mais os do seu ramo.`,
    '',
    ...NICHOS_DO_SITE.flatMap((n) => [
      `### ${n.nome}`,
      '',
      `Para: ${n.quem}. ${n.titulo}. ${n.subtitulo}`,
      `Página: ${u(`/segmentos/${n.slug}`)}`,
      '',
      'Problemas que resolve:',
      '',
      ...n.dores.map((d) => `- ${d.dor} → ${d.resposta}`),
      '',
      'O que a IA faz neste ramo:',
      '',
      ...n.ia.map((i) => `- ${i}`),
      '',
      `Modelos prontos: ${n.modelos.join(', ')}.`,
      '',
      ...n.noApp.map((a) => `- **${a.titulo}**: ${a.texto}`),
      '',
      blocoDeDuvidas(n.duvidas, '####'),
      '',
    ]),
    rebaixar(integracoesEmMarkdown()),
    rebaixar(precosEmMarkdown()),
    '## Dúvidas frequentes',
    '',
    blocoDeDuvidas(DUVIDAS),
    '',
    blocoDeDuvidas(DUVIDAS_DE_QUEM_PESQUISA),
    '',
    rebaixar(apiEmMarkdown()),
    '## Contato',
    '',
    `- E-mail: ${CONTATO_EMAIL}`,
    `- Site: ${SITE_URL}`,
    '- Instagram: https://www.instagram.com/usedialogon/',
    `- Criar conta: ${u('/criar-conta')}`,
    '',
  ].join('\n')
}

/** Os endereços em texto puro, na ordem em que a página `/para-agentes` os lista. */
export const RECURSOS_PARA_AGENTES = [
  { rotulo: 'índice', caminho: '/llms.txt' },
  { rotulo: 'completo', caminho: '/llms-full.txt' },
  { rotulo: 'preços', caminho: '/precos.md' },
  { rotulo: 'integrações', caminho: '/integracoes.md' },
  { rotulo: 'dúvidas', caminho: '/duvidas.md' },
  { rotulo: 'api', caminho: '/api.md' },
  { rotulo: 'mapa', caminho: '/sitemap.xml' },
] as const

/** O que a pessoa cola no assistente dela. */
export const PROMPT_PARA_AGENTE = `Leia ${u('/llms-full.txt')} e me diga se o Dialogon atende a minha empresa: o que ele resolve, qual plano cabe no meu volume e o que ele ainda não faz.`
