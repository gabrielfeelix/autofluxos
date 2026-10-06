/**
 * Licença na MGM, versão enxuta (06/out/2026).
 *
 *   npx tsx --conditions=react-server scripts/fluxos/mgm-licenca-simplifica.mts [--gravar]
 *
 * **Dry-run é o padrão**: lê o publicado, aplica, valida e imprime. Só com
 * `--gravar` publica os dois fluxos e apaga os gatilhos por frase.
 *
 * O que muda em relação a `mgm-voltei-de-licenca.mts`, e por quê:
 *
 * 1. **Uma porta só.** Sai o item "Voltei de licença" do menu do aluno e saem
 *    os quatro gatilhos por frase. Quem tem licença aberta já ouve a pergunta
 *    ao escrever qualquer coisa; o item de menu aparecia para todo aluno, até
 *    para quem nunca se afastou.
 * 2. **Uma pergunta, não duas.** "Está voltando?" seguido de "quer marcar?"
 *    vira "Vamos marcar sua volta?". Quem escolhe marcar entra direto na
 *    escolha do dia.
 * 3. **Sem perguntar o que a agenda já sabe.** Com uma modalidade só no
 *    contrato (`modalidadeUnica` da Verandi), o "qual aula?" é pulado.
 * 4. **"Não quis marcar" sai.** Quem não quer marcar agora escolhe "Outro
 *    assunto" e cai no menu, onde chamar a recepção já existe. Antes isso
 *    abria handoff e ainda marcava a licença em Pendências: o mesmo recado em
 *    dois lugares.
 */
import path from 'node:path'

process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'))

const { db } = await import('@/server/db')
const { publicar } = await import('@/server/repos/fluxos')
const { fluxoSchema } = await import('@/core/flow/schema')

const GRAVAR = process.argv.includes('--gravar')

const CLIENTE = '5de5a891-790f-4c14-b60b-ce0a573fe1c7'
const ATENDIMENTO = 'ae9f663f-933d-4953-bbb9-aefed2360b57'
const LICENCA = 'a40a9d9d-9dc9-45d6-a8d3-e2597a88d491'

type No = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
type Aresta = { id: string; source: string; target: string; sourceHandle?: string }
type Grafo = { inicio: string; nodes: No[]; edges: Aresta[] }

async function publicado(fluxoId: string): Promise<{ grafo: Grafo; versao: number }> {
  const { data: f } = await db().from('flows').select('versao_publicada_id').eq('id', fluxoId).single()
  const { data: v } = await db().from('flow_versions').select('grafo, versao')
    .eq('id', f!.versao_publicada_id!).single()
  return { grafo: structuredClone(v!.grafo) as Grafo, versao: v!.versao as number }
}

function no(g: Grafo, id: string) {
  const n = g.nodes.find((x) => x.id === id)
  if (!n) throw new Error(`o fluxo não tem mais o bloco ${id}`)
  return n
}

/* ---------------- o fluxo de volta ---------------- */

function enxugarLicenca(g: Grafo): Grafo {
  // a pergunta "quer marcar?" e o caminho do "agora não" saem
  const fora = new Set(['quer-marcar', 'avisar-volta', 'equipe-liga'])
  g.nodes = g.nodes.filter((n) => !fora.has(n.id))
  g.edges = g.edges.filter((e) => !fora.has(e.source) && !fora.has(e.target))

  // a ficha lê a modalidade única, nas mesmas variáveis que o "qual aula?" grava
  const ficha = no(g, 'ficha')
  const mapear = ficha.data.mapear as Array<{ caminho: string; variavel: string }>
  for (const [caminho, variavel] of [
    ['modalidadeUnica.servicoId', 'servico_id'],
    ['modalidadeUnica.nome', 'modalidade'],
  ] as const) {
    if (!mapear.some((m) => m.variavel === variavel)) mapear.push({ caminho, variavel })
  }

  if (!g.nodes.some((n) => n.id === 'tem-modalidade')) {
    g.nodes.push({
      id: 'tem-modalidade', type: 'condicao',
      position: { x: ficha.position.x + 320, y: ficha.position.y },
      data: { variavel: 'servico_id', operador: 'preenchido', valor: '' },
    })
  }
  g.edges = g.edges.filter((e) => e.source !== 'ficha' && e.source !== 'tem-modalidade')
  g.edges.push(
    { id: 'ms1', source: 'ficha', target: 'tem-modalidade' },
    { id: 'ms2', source: 'tem-modalidade', sourceHandle: 'verdadeiro', target: 'quando' },
    { id: 'ms3', source: 'tem-modalidade', sourceHandle: 'falso', target: 'catalogo' },
  )
  return g
}

/* ---------------- o Atendimento ---------------- */

function enxugarAtendimento(g: Grafo): Grafo {
  // 1. a pergunta da licença já é o convite para marcar
  const ola = no(g, 'ola-licenca')
  ola.data.texto = 'Oi, *{{primeiro_nome}}*! 👋 Vi aqui que você está de licença.\nVamos marcar sua volta?'
  ola.data.opcoes = [
    { id: 'voltei', rotulo: '📅 Marcar minha volta' },
    { id: 'outro', rotulo: '💭 Outro assunto' },
  ]

  // 2. o item do menu sai, com a aresta dele
  const menu = no(g, 'menu-aluno')
  menu.data.opcoes = (menu.data.opcoes as Array<{ id: string }>).filter((o) => o.id !== 'voltei-licenca')
  g.edges = g.edges.filter((e) => !(e.source === 'menu-aluno' && e.sourceHandle === 'voltei-licenca'))
  return g
}

/* ---------------- conferir e gravar ---------------- */

const licenca = await publicado(LICENCA)
const atendimento = await publicado(ATENDIMENTO)

const novaLicenca = fluxoSchema.safeParse(enxugarLicenca(structuredClone(licenca.grafo)))
if (!novaLicenca.success) {
  console.error('SCHEMA licença:', JSON.stringify(novaLicenca.error.issues.slice(0, 8), null, 1))
  process.exit(1)
}
const novoAtendimento = fluxoSchema.safeParse(enxugarAtendimento(structuredClone(atendimento.grafo)))
if (!novoAtendimento.success) {
  console.error('SCHEMA atendimento:', JSON.stringify(novoAtendimento.error.issues.slice(0, 8), null, 1))
  process.exit(1)
}

// todo bloco precisa continuar alcançável a partir do início, e toda aresta
// precisa apontar para bloco que existe
for (const [nome, g] of [['licença', novaLicenca.data], ['atendimento', novoAtendimento.data]] as const) {
  const ids = new Set(g.nodes.map((n) => n.id))
  const soltas = g.edges.filter((e) => !ids.has(e.source) || !ids.has(e.target))
  if (soltas.length) { console.error(nome, 'arestas soltas:', soltas); process.exit(1) }
  const vistos = new Set<string>([g.inicio])
  const fila = [g.inicio]
  while (fila.length) {
    const atual = fila.shift()!
    for (const e of g.edges) if (e.source === atual && !vistos.has(e.target)) { vistos.add(e.target); fila.push(e.target) }
  }
  const orfaos = g.nodes.filter((n) => !vistos.has(n.id)).map((n) => n.id)
  console.log(`${nome}: ${g.nodes.length} blocos, ${g.edges.length} arestas, inalcançáveis: ${orfaos.join(', ') || 'nenhum'}`)
}
console.log(`licença v${licenca.versao}: ${licenca.grafo.nodes.length} → ${novaLicenca.data.nodes.length} blocos`)
console.log(`atendimento v${atendimento.versao}: menu-aluno com ${(no(novoAtendimento.data as Grafo, 'menu-aluno').data.opcoes as unknown[]).length} opções`)

const { data: gatilhos } = await db().from('gatilhos').select('id, frase').eq('flow_id', LICENCA)
console.log('gatilhos por frase a apagar:', (gatilhos ?? []).map((g) => g.frase).join(', ') || 'nenhum')

if (!GRAVAR) {
  console.log('dry-run: nada gravado. Rode com --gravar.')
  process.exit(0)
}

const r1 = await publicar(LICENCA, CLIENTE, novaLicenca.data)
if (!r1.ok) { console.error('licença não publicou:', JSON.stringify(r1.erros, null, 1)); process.exit(1) }
console.log('licença publicada')

const r2 = await publicar(ATENDIMENTO, CLIENTE, novoAtendimento.data)
if (!r2.ok) { console.error('atendimento não publicou:', JSON.stringify(r2.erros, null, 1)); process.exit(1) }
console.log('atendimento publicado')

if (gatilhos?.length) {
  const { error } = await db().from('gatilhos').delete()
    .eq('flow_id', LICENCA).in('id', gatilhos.map((g) => g.id))
  if (error) { console.error('gatilhos:', error.message); process.exit(1) }
  console.log('gatilhos apagados:', gatilhos.length)
}
