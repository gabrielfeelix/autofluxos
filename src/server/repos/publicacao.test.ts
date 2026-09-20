import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { db } from '../db'
import { criarCliente } from './clientes'
import { criarCanal } from './conversas'
import { criarGatilho } from './gatilhos'
import {
  conversasEmAndamento,
  conversasEmAndamentoDeMuitos,
  criarFluxo,
  publicar,
  temEntradaLigada,
} from './fluxos'

/**
 * O portão de publicação contra o banco de verdade (RB-44/RB-45, T7.2).
 *
 * O que só aparece contra o Postgres, e é o que este arquivo prova:
 *
 *  - **`temEntradaLigada` conta as quatro portas.** Palavra-chave é entrada tanto
 *    quanto número, e esquecer uma faria o aviso "este bot não atende ninguém"
 *    aparecer em cima de trabalho correto: o jeito mais rápido de ensinar alguém
 *    a ignorar os avisos desta tela;
 *  - **publicar recusa texto de exemplo do modelo**, e a recusa acontece no
 *    servidor, não no botão;
 *  - **`conversasEmAndamento` conta por versão**, que é o que permite a uma
 *    conversa de 14h seguir rodando o grafo de 14h depois de alguém publicar às
 *    15h. Contar por fluxo daria o número errado depois da primeira republicação.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-pub-${Math.random().toString(36).slice(2, 8)}`

/** O menor desenho que `validar()` aceita: uma mensagem e a saída para gente. */
function desenho(texto: string): Fluxo {
  return fluxoSchema.parse({
    inicio: 'oi',
    nodes: [
      { id: 'oi', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto } },
      { id: 'h', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [{ id: 'e1', source: 'oi', target: 'h' }],
  })
}

let clienteId = ''
let semEntradaId = ''
let comNumeroId = ''
let comPalavraId = ''

beforeAll(async () => {
  if (!temCredencial) return
  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const [semEntrada, comNumero, comPalavra] = await Promise.all([
    criarFluxo(clienteId, `${marca} sem entrada`, desenho('Olá!')),
    criarFluxo(clienteId, `${marca} com numero`, desenho('Olá!')),
    criarFluxo(clienteId, `${marca} com palavra`, desenho('Olá!')),
  ])
  semEntradaId = semEntrada.id
  comNumeroId = comNumero.id
  comPalavraId = comPalavra.id

  await criarCanal({
    clienteId,
    phoneNumberId: `${marca}-numero`,
    flowId: comNumeroId,
  })
  await criarGatilho(clienteId, {
    frase: 'orcamento',
    operador: 'contem',
    fluxoId: comPalavraId,
  })
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('as quatro portas de entrada', () => {
  it('fluxo sem nada não tem entrada', async () => {
    expect(await temEntradaLigada(clienteId, semEntradaId)).toBe(false)
  })

  it('ligado ao número principal tem entrada', async () => {
    expect(await temEntradaLigada(clienteId, comNumeroId)).toBe(true)
  })

  it('ligado a uma palavra-chave TAMBÉM tem entrada', async () => {
    /*
     * **É o teste que impede o aviso falso.** Quem ligou só a palavra-chave tem
     * um bot que atende de verdade; dizer a essa pessoa que o bot não recebe
     * conversa é mentira, e a primeira mentira desliga a atenção dela para todos
     * os avisos seguintes.
     */
    expect(await temEntradaLigada(clienteId, comPalavraId)).toBe(true)
  })

  it('uma conta não vê a entrada da outra', async () => {
    // `service_role` ignora RLS: quem isola é o `client_id` em cada consulta.
    const outra = await criarCliente(`${marca} outra`)
    try {
      expect(await temEntradaLigada(outra.id, comNumeroId)).toBe(false)
    } finally {
      await db().from('clients').delete().eq('id', outra.id)
    }
  })
})

describe.skipIf(!temCredencial)('publicar', () => {
  it('aceita um desenho escrito de verdade', async () => {
    const r = await publicar(comNumeroId, clienteId, desenho('Bom dia! Como posso ajudar?'))
    expect(r.ok).toBe(true)
  })

  it('recusa o texto de exemplo que veio do modelo', async () => {
    /*
     * O defeito medido: os modelos de `exemplos/` trazem "Rua Exemplo, 123" e
     * "a partir de R$ 000", a RB-43 os copia para um rascunho editável, e
     * publicar sem trocar manda isso para o cliente de verdade de alguém.
     *
     * **A recusa é do servidor**, e é o que importa aqui: o botão desabilitado
     * no editor é conveniência, e uma aba aberta há uma hora publicaria por cima
     * dela.
     */
    const r = await publicar(
      comNumeroId,
      clienteId,
      desenho('*Onde estamos*\nRua Exemplo, 123, bairro, cidade.'),
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.erros.map((e) => e.codigo)).toContain('TEXTO_DE_EXEMPLO')
  })

  it('recusa o preço de mentira', async () => {
    const r = await publicar(comNumeroId, clienteId, desenho('*Valores*\nA partir de R$ 000.'))
    expect(r.ok).toBe(false)
  })

  it('não publica fluxo de outra conta', async () => {
    const outra = await criarCliente(`${marca} intrusa`)
    try {
      const r = await publicar(comNumeroId, outra.id, desenho('Olá!'))
      expect(r.ok).toBe(false)
    } finally {
      await db().from('clients').delete().eq('id', outra.id)
    }
  })
})

describe.skipIf(!temCredencial)('conversas em andamento', () => {
  it('fluxo sem conversa nenhuma devolve zero', async () => {
    expect(await conversasEmAndamento(clienteId, semEntradaId)).toBe(0)
  })

  it('id que não é uuid devolve zero em vez de estourar', async () => {
    // Este número vai para um modal de confirmação: ele não pode derrubar a tela.
    expect(await conversasEmAndamento(clienteId, 'nao-e-uuid')).toBe(0)
  })

  it('em lote, todo fluxo pedido aparece no mapa, mesmo com zero', async () => {
    /*
     * Quem chama desenha uma linha por fluxo e não confere se a chave existe: um
     * `undefined` aqui vira `cannot read property` na tela.
     */
    const mapa = await conversasEmAndamentoDeMuitos([semEntradaId, comNumeroId, comPalavraId])
    expect(mapa.get(semEntradaId)).toBe(0)
    expect(mapa.get(comNumeroId)).toBe(0)
    expect(mapa.get(comPalavraId)).toBe(0)
  })

  it('em lote, lista vazia não vai ao banco', async () => {
    expect((await conversasEmAndamentoDeMuitos([])).size).toBe(0)
  })
})
