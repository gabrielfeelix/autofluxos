/**
 * Conversa de teste com os fluxos publicados da conta demo, sem WhatsApp.
 *
 *   npx tsx --conditions=react-server scripts/demo/simular.mts <roteiro.json>
 *
 * Roda o mesmo `executarComEfeitos` da aba Testar (`/api/simular`), com a IA
 * de verdade, o catálogo e a loja da conta demo, e o salto entre fluxos lendo
 * a versão publicada. Nada é enviado a ninguém.
 *
 * O roteiro é JSON: { "fluxo": "<id do fluxo de entrada>", "nome": "Gabriel",
 * "passos": [ { "opcao": "Com botões" } | { "texto": "..." } | { "timeout": true } ] }
 *
 * `opcao` é o rótulo do botão da última pergunta. O gatilho de palavra-chave
 * não roda aqui (ele escolhe o fluxo antes do motor); o roteiro já começa no
 * fluxo que o gatilho abriria.
 */
import fs from 'node:fs'
import path from 'node:path'

process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'))

const { executarComEfeitos } = await import('@/server/efeitos/resolver')
const { escolherModelo } = await import('@/server/ia/modelo')
const { acharFluxo, acharVersao } = await import('@/server/repos/fluxos')
const { acharCliente } = await import('@/server/repos/clientes')
const { sessaoNova } = await import('@/core/engine/types')
const { varsDeData } = await import('@/core/datas')
const { SEMPRE_ABERTO, hojeNaConta } = await import('@/core/horario')
const { casarGatilho } = await import('@/core/gatilhos')
const { gatilhosAtivos } = await import('@/server/repos/gatilhos')

type Passo = { opcao?: string; texto?: string; timeout?: boolean }
const roteiro: { fluxo: string; nome?: string; passos: Passo[] } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

const inicial = await acharFluxo(roteiro.fluxo)
if (!inicial?.versaoPublicadaId) throw new Error('fluxo sem versão publicada')
const clienteId = inicial.clienteId
const conta = await acharCliente(clienteId)
let grafo = (await acharVersao(inicial.versaoPublicadaId))!.grafo
let iaHabilitada = inicial.iaHabilitada
let sessao = { ...sessaoNova(), vars: roteiro.nome ? { nome: roteiro.nome } : {} }
const historico: { de: 'pessoa' | 'bot'; texto: string }[] = []
let ultimasOpcoes: { id: string; rotulo: string }[] = []

const carregarFluxo = async (id: string) => {
  const f = await acharFluxo(id)
  if (!f || f.clienteId !== clienteId || !f.ativo || !f.versaoPublicadaId) return null
  const v = await acharVersao(f.versaoPublicadaId)
  return v ? { versaoId: v.id, grafo: v.grafo, iaHabilitada: f.iaHabilitada } : null
}

async function rodada(entrada: Record<string, unknown>) {
  const { modelo } = await escolherModelo({ iaHabilitada, clienteId })
  const r = await executarComEfeitos(grafo, sessao as never, entrada as never, {
    modelo,
    contextoNegocio: conta?.contextoNegocio ?? '',
    historico: historico.slice(-20),
    hoje: hojeNaConta(SEMPRE_ABERTO.fuso),
    datas: varsDeData(SEMPRE_ABERTO.fuso),
    origem: 'simulador',
    clienteId,
    carregarFluxo,
  })
  sessao = r.sessao as typeof sessao
  if (r.destino) {
    grafo = r.destino.grafo
    // Todo fluxo da demo tem IA ligada; o destino não diz o próprio id aqui.
    iaHabilitada = true
    console.log(`   ↪ saltou para outro fluxo`)
  }
  for (const a of r.acoes as Record<string, any>[]) {
    switch (a.tipo) {
      case 'enviar_texto':
        console.log(`BOT: ${a.texto.replace(/\n/g, '\n     ')}`)
        historico.push({ de: 'bot', texto: a.texto })
        break
      case 'enviar_opcoes':
        console.log(
          `BOT: ${a.texto.replace(/\n/g, '\n     ')}\n     ${a.formato === 'lista' ? 'LISTA ' : ''}[${a.opcoes.map((o: any) => o.rotulo + (o.descricao ? ` / ${o.descricao}` : '')).join(a.formato === 'lista' ? ']\n           [' : '] [')}]`,
        )
        historico.push({ de: 'bot', texto: a.texto })
        ultimasOpcoes = a.opcoes
        break
      case 'enviar_midia':
        console.log(`BOT: <${a.midia}> ${path.basename(a.url)}${a.legenda ? ` "${a.legenda}"` : ''}${a.nomeArquivo ? ` (${a.nomeArquivo})` : ''}`)
        break
      case 'enviar_produtos':
        console.log(`BOT: <cards> ${a.produtos.map((p: any) => `${p.nome} R$ ${p.preco ?? '?'}${p.foto ? ' [foto]' : ''}${p.link ? ' [link]' : ''}`).join(' | ')}`)
        break
      case 'transferir_humano':
        console.log(`BOT: >> PASSOU PARA PESSOA: ${a.motivo}`)
        break
      case 'anotar':
      case 'nota':
        console.log(`     (nota: ${String(a.texto).slice(0, 160).replace(/\n/g, ' ')})`)
        break
      default:
        if (!['salvar_campo', 'agendar_timeout', 'cancelar_timeout'].includes(a.tipo)) console.log(`     (${a.tipo})`)
    }
  }
  console.log(`     [status=${sessao.status} no=${sessao.noAtual}]`)
}

await rodada({ tipo: 'inicio' })
for (const p of roteiro.passos) {
  if (p.timeout) {
    console.log('\n--- (passaram os minutos do prazo)')
    await rodada({ tipo: 'timeout' })
  } else if (p.opcao) {
    const o = ultimasOpcoes.find((x) => x.rotulo === p.opcao)
    console.log(`\nPESSOA: [${p.opcao}]`)
    if (!o) {
      console.log(`!!! opção "${p.opcao}" não estava entre as últimas`)
      break
    }
    historico.push({ de: 'pessoa', texto: p.opcao })
    await rodada({ tipo: 'opcao', opcaoId: o.id })
  } else if (p.texto !== undefined) {
    console.log(`\nPESSOA: ${p.texto}`)
    // Como o servidor: com a conversa numa pessoa, nem gatilho fala.
    if (sessao.status === 'humano') {
      console.log('     (conversa com uma pessoa: o bot fica calado)')
      continue
    }
    // Como o servidor: o gatilho escolhe o fluxo antes do motor, e a conversa recomeça.
    const casado = casarGatilho(await gatilhosAtivos(clienteId), p.texto)
    if (casado) {
      const destino = await carregarFluxo(casado.fluxoId)
      if (destino) {
        console.log(`   ↪ gatilho "${casado.frase}": conversa nova`)
        grafo = destino.grafo
        sessao = { ...sessaoNova(), vars: roteiro.nome ? { nome: roteiro.nome } : {} }
        historico.push({ de: 'pessoa', texto: p.texto })
        await rodada({ tipo: 'inicio' })
        continue
      }
    }
    historico.push({ de: 'pessoa', texto: p.texto })
    await rodada({ tipo: 'texto', texto: p.texto })
  }
  if (sessao.status === 'encerrada') break
}
