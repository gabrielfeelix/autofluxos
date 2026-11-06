// PCYES, 05/nov/2026: peça de reposição ganha resposta própria no Suporte.
//
// Roda com `npx tsx --conditions=react-server scripts/fluxos/pcyes-peca-de-reposicao.mts` (só confere e
// grava o candidato da avaliação) ou com `--gravar` (publica os três fluxos).
//
// Conversa que pediu: Mary, 05/nov 13:51. O monitor dela (menos de 4 meses)
// parou, a assistência disse que pode ser a fonte, e ela tocou "Quero comprar"
// e perguntou quanto custa a fonte. A rota estava certa: a PCYES não vende peça
// avulsa, o Suporte confere o estoque (contexto da conta). O erro foi a
// resposta: a IA concluiu "suporte", o motor cala a frase dela quando passa a
// conversa adiante (`core/engine/executar.ts`, 02/out) e o que chegou foi o
// cartão genérico "Suporte técnico, instalação e garantia", que não fala de
// peça. Para quem perguntou um preço, pareceu que o bot não entendeu.
//
// Correção: Vendas e a triagem do menu concluem `suporte peça` quando é peça
// de reposição, e o fluxo de Suporte responde esse caso com um texto que fala
// da peça e do estoque, sem prometer frete nem custo (não está no site), com a mensagem pronta pedindo a
// peça em vez de "o que está acontecendo".
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'))

const { db } = await import('@/server/db')
const { publicar } = await import('@/server/repos/fluxos')
const { fluxoSchema } = await import('@/core/flow/schema')

const GRAVAR = process.argv.includes('--gravar')

const CLIENTE = '64dbc3a9-1f77-4892-9770-e3e4be9e14cd'
const MENU = 'abd4df71-cfa0-4e5c-a39d-af2aa57866cb'
const VENDAS = 'baff0b15-36ce-4740-a805-f049f0ab39b1'
const SUPORTE = '8850e2ad-4cc5-4632-baf8-633169d8f6a2'

type Grafo = { inicio: string; nodes: any[]; edges: any[] }

async function publicado(fluxoId: string): Promise<Grafo> {
  const { data: f } = await db().from('flows').select('versao_publicada_id, rascunho').eq('id', fluxoId).single()
  const { data: v } = await db().from('flow_versions').select('grafo').eq('id', f!.versao_publicada_id!).single()
  // Rascunho diferente do publicado é edição de alguém em andamento, e
  // `publicar` grava o rascunho junto: não atropela.
  if (JSON.stringify(f!.rascunho) !== JSON.stringify(v!.grafo)) {
    throw new Error(`${fluxoId}: rascunho diferente do publicado, alguém está editando`)
  }
  return structuredClone(v!.grafo) as Grafo
}

function trocar(texto: string, antes: string, depois: string, onde: string): string {
  if (texto.includes(depois)) return texto
  if (!texto.includes(antes)) throw new Error(`${onde}: trecho não encontrado: ${antes.slice(0, 60)}`)
  return texto.replace(antes, depois)
}

function no(grafo: Grafo, id: string) {
  const achado = grafo.nodes.find((n) => n.id === id)
  if (!achado) throw new Error(`nó ${id} não existe`)
  return achado
}

// Vendas: peça de reposição sai com o resumo `suporte peça`.
const vendas = await publicado(VENDAS)
const vendedor = no(vendas, 'vendedor-ia')
vendedor.data.instrucao = trocar(
  vendedor.data.instrucao,
  'suporte (defeito, garantia, troca, instalação, produto que não funciona, e peça de reposição de um produto que a pessoa já tem, como tampa, vidro lateral, pé, cabo ou controle);',
  'suporte (defeito, garantia, troca, instalação, produto que não funciona); suporte peça (peça de reposição de um produto que a pessoa já tem, como fonte, tampa, vidro lateral, pé, cabo ou controle, inclusive quando ela quer comprar a peça ou pergunta o preço: a loja não vende peça avulsa, quem confere e envia é o Suporte);',
  'vendedor-ia',
)

// O especialista passava calado: `mensagens: []` vence `mensagem`
// (`core/flow/mensagem.ts`) e a frase da IA é calada na transferência. O
// validador de hoje recusa publicar assim; volta a frase que já estava no nó.
const especialista = no(vendas, 'especialista-produto')
if (Array.isArray(especialista.data.mensagens) && especialista.data.mensagens.length === 0) {
  especialista.data.mensagens = [especialista.data.mensagem]
}

// Triagem do menu: o mesmo resumo.
const menu = await publicado(MENU)
const triagem = no(menu, 'triagem')
triagem.data.instrucao = trocar(
  triagem.data.instrucao,
  '- suporte: defeito, parou de funcionar, quebrou, peça de reposição, instalação, antivírus bloqueando o software;',
  '- suporte: defeito, parou de funcionar, quebrou, instalação, antivírus bloqueando o software;\n- suporte peça: peça de reposição de um produto que a pessoa já tem (fonte, cabo, tampa, pé, controle), inclusive quando ela quer comprar a peça ou pergunta o preço;',
  'triagem',
)

// Suporte: o caso da peça tem texto próprio.
const suporte = await publicado(SUPORTE)
const encaminha = no(suporte, 'encaminha')
if (!suporte.nodes.some((n) => n.id === 'e-peca')) {
  suporte.nodes.push(
    {
      id: 'e-peca',
      type: 'condicao',
      position: { x: 0, y: 300 },
      data: { variavel: 'assunto_ia', operador: 'contem', valor: 'peca' },
    },
    {
      id: 'encaminha-peca',
      type: 'encaminhar',
      position: { x: 300, y: 450 },
      data: {
        ...encaminha.data,
        texto:
          'Peças de reposição, como fonte, cabo, tampa ou pé, são atendidas pelo nosso time de Suporte 🔧\n\nA PCYES não vende peça avulsa pela loja: o Suporte confere se a peça está em estoque e te passa as condições.\n\nToque em *Abrir conversa*: a mensagem já vai pronta, é só completar com o modelo do produto e a peça que você precisa.\n\n📞 Suporte PCYES: (44) 2101-1428\n🕘 Segunda a sexta, das 8h às 18h.',
        mensagemPronta: 'Olá! Vim pelo WhatsApp da PCYES e preciso de uma peça de reposição.\nProduto (modelo):\nPeça:',
      },
    },
  )
  encaminha.position = { x: -300, y: 450 }
  const e2 = suporte.edges.find((e) => e.source === 'marca' && e.target === 'encaminha')
  if (!e2) throw new Error('suporte: ligação marca → encaminha não existe')
  e2.target = 'e-peca'
  suporte.edges.push(
    { id: 'e-peca-sim', source: 'e-peca', sourceHandle: 'verdadeiro', target: 'encaminha-peca' },
    { id: 'e-peca-nao', source: 'e-peca', sourceHandle: 'falso', target: 'encaminha' },
  )
}

const grafos = { [VENDAS]: vendas, [MENU]: menu, [SUPORTE]: suporte }
for (const [id, grafo] of Object.entries(grafos)) {
  const lido = fluxoSchema.safeParse(grafo)
  if (!lido.success) {
    console.error(id, 'SCHEMA:', JSON.stringify(lido.error.issues.slice(0, 5), null, 1))
    process.exit(1)
  }
}

// O candidato da avaliação: os dados de sempre com a instrução nova.
const dados = path.resolve(import.meta.dirname, '../avaliacao/.dados')
const atual = JSON.parse(readFileSync(`${dados}/pcyes.json`, 'utf8'))
atual.no = vendedor
writeFileSync(`${dados}/pcyes-peca.json`, JSON.stringify(atual))
console.log('candidato da avaliação: scripts/avaliacao/.dados/pcyes-peca.json')

if (!GRAVAR) {
  console.log('conferido, nada publicado (use --gravar)')
  process.exit(0)
}

for (const [id, grafo] of Object.entries(grafos)) {
  const r = await publicar(id, CLIENTE, fluxoSchema.parse(grafo))
  if (!r.ok) {
    console.error(id, 'não publicou:', JSON.stringify(r.erros, null, 1))
    process.exit(1)
  }
  console.log(id, 'publicado, versão', r.versao.versao)
}
