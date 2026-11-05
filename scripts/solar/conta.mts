/**
 * O atendimento da conta "Solar Buy-Side" (cliente, Francis Poloni), a partir
 * do mesmo conteúdo do ramo de demonstração (`scripts/solar/conteudo.mts`).
 *
 *   npx tsx --conditions=react-server scripts/solar/conta.mts            (dry-run: monta e valida)
 *   npx tsx --conditions=react-server scripts/solar/conta.mts --gravar   (publica, copia a base, liga o fluxo nos canais)
 *
 * Diferente do demo: sem "Com botões / Com IA", sem trocar de ramo e sem
 * "Quero no meu negócio". A conversa começa direto na IA, que responde a
 * primeira mensagem; depois de concluir (comprou, pediu aviso), uma pergunta
 * de texto livre devolve a conversa a ela. A base de conhecimento é copiada
 * da conta demo, que é onde os PDFs foram extraídos e testados.
 *
 * Os canais recebem o fluxo, mas **ninguém é ligado aqui**: o status de cada
 * canal continua o que estava (o chat do site nasceu pausado).
 */
import path from 'node:path'
import { INSTRUCAO_SOLAR, SOBRE_SOLAR, SOLAR_BOTAO } from './conteudo.mts'

process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'))

const { fluxoSchema } = await import('@/core/flow/schema')
const { validar } = await import('@/core/flow/validar')
const { criarFluxo, publicar, definirIa, listarFluxos } = await import('@/server/repos/fluxos')
const { db } = await import('@/server/db')

const CONTA = '3d149933-40e6-4aa0-9d6e-4cb4498ace0d'
const DEMO = '3a1d5ac8-369c-4373-856a-495468e7bad4'
const NOME = 'Atendimento Solar Buy-Side'
const GRAVAR = process.argv.includes('--gravar')

const grafo = {
  inicio: 'ia',
  nodes: [
    {
      id: 'ia',
      type: 'ia',
      position: { x: 0, y: 0 },
      data: {
        instrucao: INSTRUCAO_SOLAR,
        ferramentas: ['consultar_material', 'enviar_botao_de_compra'],
        botaoDeCompra: SOLAR_BOTAO,
        sobreAEmpresa: SOBRE_SOLAR,
        salvarEm: 'resposta_da_ia',
        conversar: { maxTurnos: 30, concluir: { salvarEm: 'resumo' } },
      },
    },
    { id: 'nota', type: 'nota', position: { x: 340, y: 0 }, data: { texto: 'Atendimento Solar Buy-Side: {{resumo}}' } },
    {
      id: 'mais',
      type: 'pergunta',
      position: { x: 680, y: 0 },
      data: { texto: 'Se surgir outra dúvida, é só escrever por aqui. 😊', salvarEm: 'primeira_mensagem' },
    },
  ],
  edges: [
    { id: 'e1', source: 'ia', target: 'nota', sourceHandle: 'concluido' },
    { id: 'e2', source: 'nota', target: 'mais' },
    // Saída comum (30 turnos): a conversa segue, não acaba num menu.
    { id: 'e3', source: 'ia', target: 'mais' },
    { id: 'e4', source: 'mais', target: 'ia' },
  ],
}

const analise = fluxoSchema.safeParse(grafo)
if (!analise.success) throw new Error(JSON.stringify(analise.error.issues, null, 1))
const { erros, avisos } = validar(analise.data, { iaHabilitada: true, temContextoDeNegocio: true })
for (const e of erros) console.log(`ERRO [${e.codigo}] ${e.mensagem}`)
for (const a of avisos) console.log(`aviso [${a.codigo}] ${a.mensagem}`)
if (erros.length) throw new Error('há erros: nada foi publicado')
console.log(`${NOME}: ${analise.data.nodes.length} blocos, 0 erros, ${avisos.length} avisos`)

if (!GRAVAR) {
  console.log('dry-run: nada foi escrito. Rode com --gravar.')
  process.exit(0)
}

/* ---------------------------------------------------- fluxo */
const existente = (await listarFluxos(CONTA)).find((f) => f.nome === NOME)
const fluxoId = existente?.id ?? (await criarFluxo(CONTA, NOME, analise.data, true)).id
await definirIa(fluxoId, CONTA, true)
const r = await publicar(fluxoId, CONTA, analise.data)
if (!r.ok) throw new Error(JSON.stringify(r.erros))
console.log(`publicado: ${NOME} v${r.versao.versao} (${fluxoId})`)

/* ---------------------------------------------------- base de conhecimento */
const { data: trechos, error: erroLer } = await db()
  .from('conhecimento_trechos')
  .select('fonte, secao, pagina, ordem, texto, busca')
  .eq('client_id', DEMO)
if (erroLer) throw new Error(erroLer.message)
const { error: erroApagar } = await db().from('conhecimento_trechos').delete().eq('client_id', CONTA)
if (erroApagar) throw new Error(erroApagar.message)
for (let i = 0; i < trechos.length; i += 200) {
  const { error } = await db()
    .from('conhecimento_trechos')
    .insert(trechos.slice(i, i + 200).map((t) => ({ ...t, client_id: CONTA })))
  if (error) throw new Error(error.message)
}
console.log(`base: ${trechos.length} trechos copiados da conta demo`)

/* ---------------------------------------------------- canais */
const { data: canais, error: erroCanais } = await db()
  .from('channels')
  .update({ flow_id: fluxoId })
  .eq('client_id', CONTA)
  .select('id, provider, status')
if (erroCanais) throw new Error(erroCanais.message)
for (const c of canais ?? []) console.log(`canal ${c.provider} ${c.id}: fluxo ligado, status ${c.status} (não mexido)`)
