/**
 * O chat do site do Dialogon (30/out/2026, texto aprovado pelo Gabriel).
 *
 *   npx tsx --conditions=react-server scripts/fluxos/site-inicio-4yu.mts [--gravar]
 *
 * **Dry-run é o padrão**: monta, valida e imprime. Só com `--gravar` ele:
 *
 * 1. cria e publica o fluxo "Site · Início" na conta 4YU Tech Demonstração;
 * 2. aponta o canal Site dessa conta para ele (o WhatsApp 44 7400-7438 segue
 *    no "Demo · Início", que pergunta o ramo da demonstração);
 * 3. soma ao "Sobre a empresa" da conta os fatos do produto, que é de onde a
 *    IA responde (ela só responde com o que está ali);
 * 4. troca a saudação do balão.
 *
 * Os botões têm até 20 caracteres, o limite do WhatsApp que o `validar()` cobra.
 *
 * O roteiro: quem chega escolhe entre testar o chatbot (a demonstração por
 * ramo, a mesma do WhatsApp), criar a conta, tirar dúvida e suporte. Testar
 * manda o link do cadastro (o teste começa sozinho ao criar a empresa) e
 * oferece ajuda da equipe para montar o primeiro fluxo. Dúvida e suporte vão
 * para a IA; quando ela não sabe, ou a pessoa pede alguém, a conversa passa
 * para a equipe sozinha (`NAO_SEI` vira atendimento no motor).
 *
 * A conta não tem setores ainda: os atendimentos caem na fila geral, com
 * "Comercial" ou "Suporte" no motivo. Criar o setor vazio seria pior, a
 * conversa iria para uma fila sem ninguém.
 */
import path from 'node:path'

process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'))

const { db } = await import('@/server/db')
const { criarFluxo, publicar } = await import('@/server/repos/fluxos')
const { fluxoSchema } = await import('@/core/flow/schema')
const { SAIDA_CONCLUIDO } = await import('@/core/flow/schema')
const { DIAS_DE_TESTE } = await import('@/core/planos')
const { CADASTRO, INSTRUCAO_COMERCIAL, INSTRUCAO_SUPORTE, MARCA_DO_PRODUTO, SOBRE_O_PRODUTO } = await import('./textos-do-chat-4yu')

const GRAVAR = process.argv.includes('--gravar')

const CLIENTE = '3a1d5ac8-369c-4373-856a-495468e7bad4'
const NOME = 'Site · Início'

type No = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
type Aresta = { id: string; source: string; target: string; sourceHandle?: string }

let y = 0
const nos: No[] = []
const arestas: Aresta[] = []
function no(id: string, type: string, data: Record<string, unknown>, x = 0) {
  nos.push({ id, type, position: { x, y: (y += 140) }, data })
}
function liga(source: string, target: string, sourceHandle?: string) {
  arestas.push({ id: `e${arestas.length + 1}`, source, target, ...(sourceHandle ? { sourceHandle } : {}) })
}

no('tem-nome', 'condicao', { variavel: 'nome', operador: 'preenchido', valor: '' })
no('oi-nome', 'mensagem', { partes: [{ tipo: 'texto', texto: 'Oi, {{nome}}! Aqui é o Dialogon, da 4YU.' }] }, -200)
no('oi', 'mensagem', { partes: [{ tipo: 'texto', texto: 'Oi! Aqui é o Dialogon, da 4YU.' }] }, 200)
no('menu', 'pergunta', {
  texto: 'Como posso te ajudar?',
  opcoes: [
    { id: 'demo', rotulo: 'Testar o chatbot' },
    { id: 'testar', rotulo: 'Criar minha conta' },
    { id: 'duvida', rotulo: 'Planos e dúvidas' },
    { id: 'suporte', rotulo: 'Já sou cliente' },
  ],
})

// Demonstração: o bot atende como se fosse o negócio da pessoa, com os mesmos
// fluxos de ramo que o WhatsApp 44 7400-7438 usa (Demo · Início).
const DEMOS = [
  { id: 'pizzaria', rotulo: 'Pizzaria', fluxoId: '8db234cc-b965-4f35-8016-e8b6da30e8a9' },
  { id: 'hamburgueria', rotulo: 'Hamburgueria', fluxoId: '5da31bcb-ab13-40a4-9152-d21feef2a28a' },
  { id: 'restaurante', rotulo: 'Restaurante', fluxoId: '3de73e6c-5519-4fd9-a5c4-14d08c8761fe' },
  { id: 'loja-de-roupas', rotulo: 'Loja de roupas', fluxoId: '3c6fdae0-fab8-4d17-8be1-c3bd7131524b' },
  { id: 'salao-e-servicos', rotulo: 'Salão e serviços', fluxoId: '49f0a40c-4eaa-4161-a3b2-e25b8467a928' },
  { id: 'aulas-e-estudio', rotulo: 'Aulas e estúdio', fluxoId: '6679e515-d89e-46b5-825b-d2f907467c7c' },
  { id: 'loja-online', rotulo: 'Loja online', fluxoId: '8d4ba017-0a61-4672-b6ce-b1b347966e2d' },
]
no('demo-aviso', 'mensagem', {
  partes: [{
    tipo: 'texto',
    texto: 'Escolha um ramo e eu atendo como se fosse o seu negócio. É uma demonstração: pedidos, compras e agendamentos feitos aqui não são reais.',
  }],
}, -600)
no('demo-ramo', 'pergunta', {
  texto: 'Qual ramo você quer ver?',
  opcoes: DEMOS.map((d) => ({ id: d.id, rotulo: d.rotulo })),
  salvarEm: 'ramo_demo',
}, -600)
for (const d of DEMOS) no(`ir-${d.id}`, 'ir-fluxo', { rotulo: `Demo · ${d.rotulo}`, fluxoId: d.fluxoId }, -600)

// Testar
no('teste', 'mensagem', {
  partes: [{
    tipo: 'texto',
    texto: `O teste é de ${DIAS_DE_TESTE} dias, sem cartão. Você cria a conta aqui, em um minuto, e a empresa já nasce em teste: ${CADASTRO}`,
  }],
}, -300)
no('ajuda', 'pergunta', {
  texto: 'Quer que alguém da equipe te ajude a montar o primeiro fluxo?',
  opcoes: [
    { id: 'sim', rotulo: 'Quero ajuda' },
    { id: 'nao', rotulo: 'Vou sozinho' },
  ],
}, -300)
no('empresa', 'pergunta', { texto: 'Qual o nome da sua empresa e o que ela vende?', opcoes: [], salvarEm: 'empresa_lead' }, -300)
no('comercial', 'handoff', {
  motivo: 'Comercial · quer ajuda para começar · {{empresa_lead}}',
  mensagens: ['Anotado! Alguém da equipe te chama aqui mesmo para montar o primeiro fluxo com você.'],
}, -300)
no('boa', 'mensagem', { partes: [{ tipo: 'texto', texto: 'Combinado! Se travar em alguma coisa, é só chamar aqui.' }] }, -300)

// Dúvida
no('ia-duvida', 'ia', {
  instrucao: INSTRUCAO_COMERCIAL,
  salvarEm: 'ultima_resposta',
  ferramentas: [],
  conversar: { maxTurnos: 12, concluir: { salvarEm: 'assunto_ia' } },
})

// Suporte
no('ia-suporte', 'ia', {
  instrucao: INSTRUCAO_SUPORTE,
  salvarEm: 'ultima_resposta',
  ferramentas: [],
  conversar: { maxTurnos: 12, concluir: { salvarEm: 'assunto_ia' } },
}, 300)
no('suporte', 'handoff', {
  motivo: 'Suporte · {{assunto_ia}}',
  mensagens: ['Vou te passar para alguém do suporte. Já chamo aqui.'],
}, 300)

no('mais', 'pergunta', {
  texto: 'Posso ajudar em mais alguma coisa?',
  opcoes: [
    { id: 'demo', rotulo: 'Testar o chatbot' },
    { id: 'testar', rotulo: 'Criar minha conta' },
    { id: 'outra', rotulo: 'Tenho outra dúvida' },
    { id: 'equipe', rotulo: 'Falar com a equipe' },
    { id: 'fim', rotulo: 'Era só isso' },
  ],
})
no('tchau', 'mensagem', { partes: [{ tipo: 'texto', texto: 'Obrigado pelo contato! Se precisar, é só chamar aqui.' }] })

liga('tem-nome', 'oi-nome', 'verdadeiro')
liga('tem-nome', 'oi', 'falso')
liga('oi-nome', 'menu')
liga('oi', 'menu')
liga('menu', 'demo-aviso', 'demo')
liga('demo-aviso', 'demo-ramo')
for (const d of DEMOS) liga('demo-ramo', `ir-${d.id}`, d.id)
liga('menu', 'teste', 'testar')
liga('menu', 'ia-duvida', 'duvida')
liga('menu', 'ia-suporte', 'suporte')
liga('teste', 'ajuda')
liga('ajuda', 'empresa', 'sim')
liga('ajuda', 'boa', 'nao')
liga('empresa', 'comercial')
liga('ia-duvida', 'mais', SAIDA_CONCLUIDO)
// Saiu da conversa com a IA ("menu" ou o teto de respostas): volta às opções,
// não cai numa pessoa sem ter pedido. Pedido de gente e "não sei" o motor já transfere.
liga('ia-duvida', 'mais')
liga('ia-suporte', 'mais', SAIDA_CONCLUIDO)
liga('ia-suporte', 'suporte')
liga('mais', 'teste', 'testar')
liga('mais', 'ia-duvida', 'outra')
liga('mais', 'demo-aviso', 'demo')
liga('mais', 'empresa', 'equipe')
liga('mais', 'tchau', 'fim')

const grafo = fluxoSchema.parse({ inicio: 'tem-nome', nodes: nos, edges: arestas })

const PRODUTO = SOBRE_O_PRODUTO

console.log(JSON.stringify({ nos: grafo.nodes.length, arestas: grafo.edges.length }))
console.log(PRODUTO)

if (!GRAVAR) {
  console.log('\n(dry-run: nada gravado; rode com --gravar)')
  process.exit(0)
}

// 3. O "Sobre a empresa": soma o bloco do produto uma vez só.
const { data: cliente } = await db().from('clients').select('contexto_negocio').eq('id', CLIENTE).single()
const atual = String(cliente?.contexto_negocio ?? '')
const semProduto = atual.split(MARCA_DO_PRODUTO)[0]!.trimEnd()
{
  const { error } = await db().from('clients').update({ contexto_negocio: `${semProduto}\n\n${PRODUTO}` }).eq('id', CLIENTE)
  if (error) throw new Error(error.message)
}

// 1. O fluxo, criado uma vez e republicado nas próximas.
const { data: existente } = await db().from('flows').select('id').eq('client_id', CLIENTE).eq('nome', NOME).maybeSingle()
const fluxoId = existente?.id ?? (await criarFluxo(CLIENTE, NOME, grafo, true)).id
if (existente) await db().from('flows').update({ rascunho: grafo, ia_habilitada: true }).eq('id', fluxoId)
const r = await publicar(fluxoId, CLIENTE, grafo)
if (!r.ok) {
  console.error('recusado:', r.erros)
  process.exit(1)
}
console.log('publicado', fluxoId, 'versão', r.versao.versao)

// 2 e 4. O canal Site aponta para ele, com a saudação nova.
const { data: canal } = await db().from('channels').select('id, site_config').eq('client_id', CLIENTE).eq('provider', 'site').single()
const { error } = await db()
  .from('channels')
  .update({
    flow_id: fluxoId,
    flow_boas_vindas_id: fluxoId,
    site_config: { ...(canal!.site_config as Record<string, unknown>), saudacao: 'Olá! Como podemos ajudar?' },
  })
  .eq('id', canal!.id)
if (error) throw new Error(error.message)
console.log('canal do site apontado', canal!.id)
