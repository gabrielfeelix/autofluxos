// PCYES, 30/set/2026: o menu entende texto, a venda não pergunta de novo o que
// a pessoa já disse, e pergunta parada não vira fila de atendente.
//
// Roda com `ENTRADA=<pasta> npx tsx scripts/fluxos/pcyes-triagem.mts`. A pasta
// tem os rascunhos atuais (`<flow_id>.json`, lidos de `flows.rascunho`); o
// script escreve `<flow_id>.novo.json` ao lado e valida. Publicar é à parte,
// por `publicar_fluxo`, com autorização.
//
// O que muda, e a conversa real que pediu cada coisa:
//  - Menu: "Entender o que a pessoa escrever" ligado numa IA de triagem. Victor
//    descreveu o defeito do mouse e recebeu "toca numa das opções" + o menu.
//  - Venda: quem chega pela triagem já disse o que quer; a pergunta "me conta o
//    que você procura" só sai para quem tocou em "Quero comprar".
//  - Prazo das perguntas: sem saída ligada, "ninguém respondeu no prazo" virava
//    handoff; na PCYES foram 7 desde 25/set, gente que só não tocou no menu.
//    Sem prazo, quem voltar dias depois segue do ponto em que parou, e INICIO
//    recomeça.
import { readFileSync, writeFileSync } from 'node:fs'
import { fluxoSchema } from '../../src/core/flow/schema'
import { validar } from '../../src/core/flow/validar'
import { validarPublicacao } from '../../src/core/validar-publicacao'

const MENU = 'abd4df71-cfa0-4e5c-a39d-af2aa57866cb'
const VENDAS = 'baff0b15-36ce-4740-a805-f049f0ab39b1'
const DRIVERS = '968c958a-af07-43e8-b68a-79ad326c2849'
const PEDIDO = 'a7db904f-00fa-48b7-81a5-4b828fce82cc'
const SUPORTE = '8850e2ad-4cc5-4632-baf8-633169d8f6a2'
const EMPRESA = '29b15d4d-0cdf-4486-a399-fcee507c60c3'
const PARCERIA = '8bb8c3cc-c6ee-4c2e-9af1-2aff26b2219b'

const FLUXOS = [
  { id: MENU, nome: 'Boas-vindas e menu' },
  { id: VENDAS, nome: 'Vendas com IA' },
  { id: DRIVERS, nome: 'Drivers e manuais' },
  { id: PEDIDO, nome: 'Meu pedido' },
  { id: SUPORTE, nome: 'Suporte técnico' },
  { id: EMPRESA, nome: 'Compra para empresa' },
  { id: PARCERIA, nome: 'Parcerias e marketing' },
].map((f) => ({ ...f, publicado: true, ativo: true }))

const pasta = process.env.ENTRADA ?? '.'
type Grafo = { inicio: string; nodes: any[]; edges: any[] }
const ler = (id: string): Grafo => JSON.parse(readFileSync(`${pasta}/${id}.json`, 'utf8'))
const p = (x: number, y: number) => ({ x, y })

/** Pergunta sem prazo: a espera sem saída ligada virava handoff. */
function semPrazo(g: Grafo): Grafo {
  for (const n of g.nodes) if (n.type === 'pergunta') delete n.data.timeoutMinutos
  g.edges = g.edges.filter((e) => e.sourceHandle !== 'timeout')
  return g
}

// ---------------------------------------------------------------- menu
const TRIAGEM = `A pessoa escreveu em vez de escolher uma opção do menu, ou voltou a escrever logo depois de um atendimento terminar. Leia a mensagem dela e a conversa até aqui.
Seu único trabalho é entender o assunto e levar ao time certo. Não resolva o assunto aqui, não indique produto, não peça dado.
Os assuntos:
- compra: quer comprar, escolher, comparar, saber preço, estoque ou se um produto serve;
- pedido: pedido já feito, pagamento, boleto, entrega, rastreio, nota fiscal, cancelamento;
- drivers: driver, manual, software, download, como configurar RGB, DPI, macro;
- suporte: defeito, parou de funcionar, quebrou, peça de reposição, garantia, troca, devolução, instalação, antivírus bloqueando o software;
- empresa: compra com CNPJ, cotação, revenda, licitação;
- parceria: influenciador, patrocínio, parceria, marketing.
Se der para saber o assunto, chame concluir_conversa com o resumo sendo só a palavra do assunto, e escreva como fechamento uma frase curta que mostre que entendeu (ex.: "Entendi, é sobre o defeito do mouse. Vou te passar para o Suporte."). Não pergunte nada nesse caso.
Se for agradecimento, confirmação ou despedida ("obrigado", "ok", "valeu", "blz"), responda em uma frase cordial e curta, sem pergunta, e chame concluir_conversa com o resumo fim.
Se continuar o assunto do atendimento que acabou (conversa até aqui), leve ao mesmo assunto.
Se for só um cumprimento ou não der para saber, responda em uma frase perguntando como pode ajudar, com exemplos curtos (comprar um produto, acompanhar um pedido, baixar driver, suporte). Uma pergunta só.`

const menu = semPrazo(ler(MENU))
const noMenu = menu.nodes.find((n) => n.id === 'menu')!
noMenu.data.entendeTextoLivre = true

const rotas = [
  ['compra', 'Vendas com IA', VENDAS],
  ['pedido', 'Meu pedido', PEDIDO],
  ['drivers', 'Drivers e manuais', DRIVERS],
  ['suporte', 'Suporte técnico', SUPORTE],
  ['empresa', 'Compra para empresa', EMPRESA],
  ['parceria', 'Parcerias e marketing', PARCERIA],
] as const

menu.nodes = menu.nodes.filter((n) => !n.id.startsWith('triagem'))
menu.edges = menu.edges.filter((e) => !String(e.id).startsWith('triagem') && e.sourceHandle !== 'texto-livre')
// Retomada: quem acabou de ser atendido e escreve de novo não recebe a
// saudação e o menu de novo; a frase vai direto para a triagem. A variável
// vem do servidor (`VARIAVEL_DE_RETOMADA`, até 2 h depois do fim).
menu.edges = menu.edges.filter((e) => !(e.source === 'funil' && e.target === 'menu'))
menu.nodes.push({
  id: 'triagem-retomada',
  type: 'condicao',
  position: p(0, 350),
  data: { variavel: 'retomada', operador: 'preenchido', valor: '' },
})
menu.edges.push(
  { id: 'triagem-retomada-e0', source: 'funil', target: 'triagem-retomada' },
  { id: 'triagem-retomada-v', source: 'triagem-retomada', sourceHandle: 'verdadeiro', target: 'triagem' },
  { id: 'triagem-retomada-f', source: 'triagem-retomada', sourceHandle: 'falso', target: 'menu' },
)
menu.nodes.push({
  id: 'triagem',
  type: 'ia',
  position: p(500, 700),
  data: {
    instrucao: TRIAGEM,
    ferramentas: [],
    salvarEm: 'ultima_resposta',
    conversar: { concluir: { salvarEm: 'assunto_ia' }, maxTurnos: 4 },
  },
})
menu.edges.push({ id: 'triagem-e0', source: 'menu', sourceHandle: 'texto-livre', target: 'triagem' })
rotas.forEach(([valor, rotulo, fluxoId], i) => {
  const rota = `triagem-rota-${valor}`
  const ir = `triagem-ir-${valor}`
  menu.nodes.push(
    { id: rota, type: 'condicao', position: p(900, 500 + i * 150), data: { variavel: 'assunto_ia', operador: 'contem', valor } },
    { id: ir, type: 'ir-fluxo', position: p(1260, 500 + i * 150), data: { rotulo, fluxoId } },
  )
  menu.edges.push({ id: `triagem-e-${valor}-v`, source: rota, sourceHandle: 'verdadeiro', target: ir })
  const seguinte = rotas[i + 1] ? `triagem-rota-${rotas[i + 1]![0]}` : 'triagem-fim'
  menu.edges.push({ id: `triagem-e-${valor}-f`, source: rota, sourceHandle: 'falso', target: seguinte })
})
menu.nodes.push({ id: 'triagem-fim', type: 'nota', position: p(900, 1500), data: { texto: 'A triagem encerrou a conversa ({{assunto_ia}}).' } })
menu.edges.push({ id: 'triagem-e1', source: 'triagem', sourceHandle: 'concluido', target: 'triagem-rota-compra' })

// ---------------------------------------------------------------- vendas
const vendas = semPrazo(ler(VENDAS))
vendas.nodes = vendas.nodes.filter((n) => n.id !== 'veio-do-botao')
vendas.edges = vendas.edges.filter((e) => !String(e.id).startsWith('veio-do-botao') && !(e.source === 'marca' && e.target === 'procura'))
vendas.nodes.push({
  id: 'veio-do-botao',
  type: 'condicao',
  position: p(540, 300),
  data: { variavel: 'assunto', operador: 'igual', valor: 'Quero comprar' },
})
vendas.edges.push(
  { id: 'veio-do-botao-e0', source: 'marca', target: 'veio-do-botao' },
  { id: 'veio-do-botao-v', source: 'veio-do-botao', sourceHandle: 'verdadeiro', target: 'procura' },
  { id: 'veio-do-botao-f', source: 'veio-do-botao', sourceHandle: 'falso', target: 'funil-ia' },
)

// ---------------------------------------------------------------- resto
// Drivers: o mesmo. Quem escreveu "driver do mouse Basaran" não precisa ouvir
// "qual é o produto?"; a IA lê a frase dele.
const drivers = semPrazo(ler(DRIVERS))
drivers.nodes = drivers.nodes.filter((n) => n.id !== 'veio-do-botao')
drivers.edges = drivers.edges.filter((e) => !String(e.id).startsWith('veio-do-botao'))
drivers.inicio = 'veio-do-botao'
drivers.nodes.push({
  id: 'veio-do-botao',
  type: 'condicao',
  position: p(-360, 0),
  data: { variavel: 'assunto', operador: 'igual', valor: 'Drivers e manuais' },
})
drivers.edges.push(
  { id: 'veio-do-botao-v', source: 'veio-do-botao', sourceHandle: 'verdadeiro', target: 'modelo' },
  { id: 'veio-do-botao-f', source: 'veio-do-botao', sourceHandle: 'falso', target: 'busca' },
)
const busca = drivers.nodes.find((n) => n.id === 'busca')!
busca.data.instrucao = String(busca.data.instrucao).replace(
  'a primeira resposta dela foi: {{produto}}.',
  'o produto que ela disse está na mensagem dela ou em {{produto}}.',
)
const pedido = semPrazo(ler(PEDIDO))

let falhou = false
for (const [id, grafo] of [
  [MENU, menu],
  [VENDAS, vendas],
  [DRIVERS, drivers],
  [PEDIDO, pedido],
] as const) {
  const lido = fluxoSchema.safeParse(grafo)
  if (!lido.success) {
    console.error(id, 'SCHEMA:', JSON.stringify(lido.error.issues.slice(0, 5), null, 1))
    falhou = true
    continue
  }
  const v = validar(lido.data, { iaHabilitada: true, conexoes: [], temContextoDeNegocio: true, fluxos: FLUXOS })
  const pub = validarPublicacao(lido.data, { temEntrada: true })
  const erros = [...v.erros, ...pub.erros]
  console.log(id, 'erros:', erros.length, erros.map((e) => e.mensagem), 'avisos:', [...v.avisos, ...pub.avisos].map((a) => a.codigo))
  if (erros.length > 0) falhou = true
  writeFileSync(`${pasta}/${id}.novo.json`, JSON.stringify(lido.data))
}
process.exit(falhou ? 1 : 0)
