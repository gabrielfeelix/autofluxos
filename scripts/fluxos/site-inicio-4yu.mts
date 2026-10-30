/**
 * O chat do site do AutoFluxos (30/out/2026, texto aprovado pelo Gabriel).
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
 * O roteiro: quem chega escolhe entre testar, tirar dúvida e suporte. Testar
 * pede a empresa e passa para a equipe liberar o acesso. Dúvida e suporte vão
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
const { PLANOS, DIAS_DE_TESTE } = await import('@/core/planos')

const GRAVAR = process.argv.includes('--gravar')

const CLIENTE = '3a1d5ac8-369c-4373-856a-495468e7bad4'
const NOME = 'Site · Início'
const MARCA_DO_PRODUTO = 'SOBRE O AUTOFLUXOS (o produto que a 4YU vende):'

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

const INSTRUCAO_BASE =
  'Você atende no chat do site do AutoFluxos, da 4YU. Responda em português, em frases curtas, com o que está em SOBRE A EMPRESA, ' +
  'principalmente a parte SOBRE O AUTOFLUXOS. Nunca invente preço, prazo, recurso ou integração. ' +
  'Quando a pessoa disser que entendeu, que era só isso, ou que quer testar, chame concluir_conversa com um resumo de uma linha do que ela perguntou.'

no('tem-nome', 'condicao', { variavel: 'nome', operador: 'preenchido', valor: '' })
no('oi-nome', 'mensagem', { partes: [{ tipo: 'texto', texto: 'Oi, {{nome}}! Aqui é o AutoFluxos, da 4YU.' }] }, -200)
no('oi', 'mensagem', { partes: [{ tipo: 'texto', texto: 'Oi! Aqui é o AutoFluxos, da 4YU.' }] }, 200)
no('menu', 'pergunta', {
  texto: 'Como posso te ajudar?',
  opcoes: [
    { id: 'testar', rotulo: 'Quero testar' },
    { id: 'duvida', rotulo: 'Tenho uma dúvida' },
    { id: 'suporte', rotulo: 'Preciso de suporte' },
  ],
})

// Testar
no('teste', 'mensagem', {
  partes: [{ tipo: 'texto', texto: `O teste é de ${DIAS_DE_TESTE} dias, sem cartão, com o plano Operação liberado.` }],
}, -300)
no('empresa', 'pergunta', { texto: 'Qual o nome da sua empresa e o que ela vende?', opcoes: [], salvarEm: 'empresa_lead' }, -300)
no('comercial', 'handoff', {
  motivo: 'Comercial · quer testar · {{empresa_lead}}',
  mensagens: ['Anotado! Alguém da equipe te chama aqui mesmo para liberar o seu acesso.'],
}, -300)

// Dúvida
no('ia-duvida', 'ia', {
  instrucao:
    INSTRUCAO_BASE +
    ' A pessoa ainda não é cliente e tem uma dúvida sobre o produto, os planos ou o teste grátis.',
  salvarEm: 'ultima_resposta',
  ferramentas: [],
  conversar: { maxTurnos: 12, concluir: { salvarEm: 'assunto_ia' } },
})

// Suporte
no('ia-suporte', 'ia', {
  instrucao:
    INSTRUCAO_BASE +
    ' A pessoa já é cliente e precisa de ajuda para usar o sistema. Explique o caminho no painel quando souber. ' +
    'Se for um problema da conta dela (algo que parou, cobrança, acesso), não tente resolver: isso é com a equipe de suporte.',
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
    { id: 'testar', rotulo: 'Quero testar' },
    { id: 'outra', rotulo: 'Tenho outra dúvida' },
    { id: 'fim', rotulo: 'Era só isso' },
  ],
})
no('tchau', 'mensagem', { partes: [{ tipo: 'texto', texto: 'Obrigado pelo contato! Se precisar, é só chamar aqui.' }] })

liga('tem-nome', 'oi-nome', 'verdadeiro')
liga('tem-nome', 'oi', 'falso')
liga('oi-nome', 'menu')
liga('oi', 'menu')
liga('menu', 'teste', 'testar')
liga('menu', 'ia-duvida', 'duvida')
liga('menu', 'ia-suporte', 'suporte')
liga('teste', 'empresa')
liga('empresa', 'comercial')
liga('ia-duvida', 'mais', SAIDA_CONCLUIDO)
liga('ia-duvida', 'comercial')
liga('ia-suporte', 'mais', SAIDA_CONCLUIDO)
liga('ia-suporte', 'suporte')
liga('mais', 'teste', 'testar')
liga('mais', 'ia-duvida', 'outra')
liga('mais', 'tchau', 'fim')

const grafo = fluxoSchema.parse({ inicio: 'tem-nome', nodes: nos, edges: arestas })

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const PRODUTO = [
  MARCA_DO_PRODUTO,
  'Atendimento no WhatsApp, Instagram, Telegram e chat do site numa caixa só (Inbox), com chatbot de fluxos, IA que responde pelo catálogo e pelas regras da empresa, CRM com funil, transmissões e relatórios. A equipe inteira atende no mesmo número.',
  'Usa a API oficial do WhatsApp da Meta. Dá para manter o WhatsApp Business no celular ao mesmo tempo (coexistência).',
  `Teste grátis: ${DIAS_DE_TESTE} dias, sem cartão, com o plano Operação liberado. Sem fidelidade.`,
  'Planos (mensalidade; a tarifa das mensagens da Meta é cobrada à parte, pela Meta):',
  ...PLANOS.map((p) => `- ${p.nome}: ${reais(p.preco)} por mês. ${p.itens.filter((i) => !i.startsWith('Tudo d')).join('; ')}.`),
  '- Enterprise: sob consulta, para operação acima de 50 atendentes ou integração sob medida.',
  'Integrações: Magento, Nuvemshop, Mercado Pago, Asaas, InfinitePay, PagBank, Efí, iugu, Pagar.me, PagHiper, Woovi, Goomer, Cardápio Web, OlaClick, anúncios da Meta, API e webhooks.',
  'Quem cria a conta e monta o primeiro fluxo junto com o cliente é a equipe da 4YU.',
].join('\n')

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
