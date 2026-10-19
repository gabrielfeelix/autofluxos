// PCYES, 19/out/2026: a triagem passa a escrever o `assunto` antes de rotear.
//
// Roda com `ENTRADA=<pasta> npx tsx scripts/fluxos/pcyes-triagem-assunto.mts`.
// A pasta tem o grafo publicado do menu (`<flow_id>.json`); o script escreve
// `<flow_id>.novo.json` ao lado e valida. Publicar é à parte, com autorização.
//
// Conversa que pediu: Sueli, 19/out 15:07. Ela já conversava com o vendedor
// (cards mostrados, "o mouse tem que ter 12cm"), a equipe devolveu ao bot e a
// resposta foi "Show! Me conta o que você procura", a pergunta do zero.
//
// Por quê: `assunto` é onde o menu guarda o botão tocado, e ele fica nos campos
// do contato. Dias antes ela tinha tocado "Quero comprar". Na retomada a
// triagem leu a conversa, concluiu "compra" e saltou para Vendas, mas o
// `veio-do-botao` de Vendas (e o de Drivers) olha `assunto`, achou o "Quero
// comprar" velho e mandou para a pergunta inicial em vez do vendedor.
//
// Correção: logo que a triagem conclui, `assunto` recebe o que ela concluiu.
// Quem chega pela triagem nunca é "veio do botão", e os saltos levam as
// variáveis junto (`server/efeitos/resolver.ts`).
import { readFileSync, writeFileSync } from 'node:fs'
import { fluxoSchema } from '../../src/core/flow/schema'
import { validar } from '../../src/core/flow/validar'
import { validarPublicacao } from '../../src/core/validar-publicacao'

const MENU = 'abd4df71-cfa0-4e5c-a39d-af2aa57866cb'
const DESTINOS = [
  'baff0b15-36ce-4740-a805-f049f0ab39b1',
  'a7db904f-00fa-48b7-81a5-4b828fce82cc',
  '968c958a-af07-43e8-b68a-79ad326c2849',
  '8850e2ad-4cc5-4632-baf8-633169d8f6a2',
  'b4a82637-0f88-41a5-a51b-dfc95ff63605',
  '29b15d4d-0cdf-4486-a399-fcee507c60c3',
  '8bb8c3cc-c6ee-4c2e-9af1-2aff26b2219b',
]

const pasta = process.env.ENTRADA ?? '.'
type Grafo = { inicio: string; nodes: any[]; edges: any[] }
const menu: Grafo = JSON.parse(readFileSync(`${pasta}/${MENU}.json`, 'utf8'))

const saida = menu.edges.find((e) => e.source === 'triagem' && e.sourceHandle === 'concluido')
if (!saida) throw new Error('triagem sem saída "concluido"')
const seguinte = saida.target === 'triagem-assunto' ? null : saida.target

if (seguinte) {
  const triagem = menu.nodes.find((n) => n.id === 'triagem')!
  menu.nodes.push({
    id: 'triagem-assunto',
    type: 'salvar-campo',
    position: { x: triagem.position.x + 200, y: triagem.position.y + 150 },
    data: { campo: 'assunto', valor: '{{assunto_ia}}' },
  })
  saida.target = 'triagem-assunto'
  menu.edges.push({ id: 'triagem-assunto-e', source: 'triagem-assunto', target: seguinte })
}

const lido = fluxoSchema.safeParse(menu)
if (!lido.success) {
  console.error('SCHEMA:', JSON.stringify(lido.error.issues.slice(0, 5), null, 1))
  process.exit(1)
}
const fluxos = [MENU, ...DESTINOS].map((id) => ({ id, nome: id, publicado: true, ativo: true }))
const v = validar(lido.data, { iaHabilitada: true, conexoes: [], temContextoDeNegocio: true, fluxos })
const pub = validarPublicacao(lido.data, { temEntrada: true })
const erros = [...v.erros, ...pub.erros]
console.log('erros:', erros.map((e) => e.mensagem), 'avisos:', [...v.avisos, ...pub.avisos].map((a) => a.codigo))
writeFileSync(`${pasta}/${MENU}.novo.json`, JSON.stringify(lido.data))
process.exit(erros.length > 0 ? 1 : 0)
