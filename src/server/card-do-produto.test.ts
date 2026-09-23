import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { canalMock } from '@/channels/mock'
import type { Fluxo } from '@/core/flow/schema'
import type { ProdutoDaLoja } from '@/core/loja'
import { lojaFalsa } from '@/loja/falsa'
import type { Modelo, Resposta } from './ia/types'

/**
 * O card do produto do webhook até o canal, contra o banco de verdade.
 *
 * O que só aparece aqui, e nenhum teste unitário alcança: o aplicador de
 * `receber-mensagem.ts` conhecer `enviar_produtos`. Nenhum `switch` sobre
 * ação é exaustivo no tipo, então esquecer o `case` compila e o card some sem
 * erro. Este teste é o que pega isso.
 *
 * O modelo e a loja são falsos; o banco, o motor, o resolvedor e o aplicador
 * são os de produção.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)

let roteiro: Resposta[] = []
const modelo: Modelo = {
  async responder() {
    return roteiro.shift() ?? { tipo: 'texto', texto: 'fim do roteiro' }
  },
}
vi.mock('./ia/modelo', () => ({ escolherModelo: async () => ({ modelo }) }))

const lojaAtivaDaConta = vi.hoisted(() => vi.fn())
vi.mock('./adaptador-da-loja', () => ({ lojaAtivaDaConta }))

const { db } = await import('./db')
const { receberMensagem } = await import('./receber-mensagem')
const { criarCliente } = await import('./repos/clientes')
const { criarCanal } = await import('./repos/conversas')
const { criarFluxo, publicar } = await import('./repos/fluxos')

const marca = `zz-card-${Math.random().toString(36).slice(2, 8)}`
const numeroDoBot = `test-${Math.random().toString(36).slice(2, 10)}`
const semente = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')
const telefone = (i: number) => `5511${semente}${i.toString().padStart(2, '0')}`

const mock = canalMock()
let clienteId = ''

const headset: ProdutoDaLoja = {
  produtoId: '330107',
  nome: 'Headset PCYES Comfort CM500',
  preco: 108.9,
  emEstoque: true,
  link: 'https://www.pcyes.com.br/headset-comfort-cm500',
}

const fluxo = {
  inicio: 'ia',
  nodes: [
    {
      id: 'ia',
      type: 'ia',
      position: { x: 0, y: 0 },
      data: { instrucao: 'Ajude a escolher.', ferramentas: ['loja_buscar', 'loja_mostrar'] },
    },
  ],
  edges: [],
} as unknown as Fluxo

function webhook(de: string, texto: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: numeroDoBot },
              contacts: [{ wa_id: de, profile: { name: 'Ana Teste' } }],
              messages: [{ id: `${marca}-${de}`, from: de, type: 'text', text: { body: texto } }],
            },
          },
        ],
      },
    ],
  }
}

async function saidas(de: string): Promise<{ texto: string; payload: unknown }[]> {
  const { data: contato } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .eq('wa_id', de)
    .single()
  const { data } = await db()
    .from('messages')
    .select('texto, payload')
    .eq('contact_id', (contato as { id: string }).id)
    .eq('direcao', 'saida')
    .order('ts', { ascending: true })
  return (data ?? []) as { texto: string; payload: unknown }[]
}

const roteiroDeMostrar = (): Resposta[] => [
  { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
  { tipo: 'usar_ferramenta', nome: 'loja_mostrar', argumentos: { produtoId: '330107' } },
  { tipo: 'texto', texto: 'Olha ele aqui:' },
]

beforeAll(async () => {
  if (!temCredencial) return
  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id
  await db().from('clients').update({ contexto_negocio: 'Loja de periféricos.' }).eq('id', clienteId)
  const criado = await criarFluxo(clienteId, `${marca} loja`, fluxo)
  await db().from('flows').update({ ia_habilitada: true }).eq('id', criado.id)
  const pub = await publicar(criado.id, clienteId, fluxo)
  if (!pub.ok) throw new Error(`o fluxo de loja deveria publicar: ${JSON.stringify(pub)}`)
  await criarCanal({ clienteId, phoneNumberId: numeroDoBot, flowId: criado.id })
})

afterAll(async () => {
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

beforeEach(() => {
  mock.enviadas.length = 0
  lojaAtivaDaConta.mockReset()
})

describe.skipIf(!temCredencial)('card do produto no WhatsApp', () => {
  it('com foto real, sai o card depois da frase da IA, e o histórico guarda o texto', async () => {
    const comFoto = { ...headset, foto: 'https://www.pcyes.com.br/media/catalog/product/cm500.jpg' }
    lojaAtivaDaConta.mockResolvedValue(lojaFalsa({ produtos: [comFoto] }))
    roteiro = roteiroDeMostrar()
    const de = telefone(1)

    await receberMensagem(webhook(de, 'tem headset?'), () => mock)

    const envios = mock.enviadas.filter((e) => e.tipo !== 'espera')
    expect(envios.map((e) => e.tipo)).toEqual(['texto', 'produtos'])
    expect(envios[1]).toMatchObject({ para: de, produtos: [{ produtoId: '330107', foto: comFoto.foto }] })

    const historico = await saidas(de)
    expect(historico.map((m) => m.texto)).toEqual([
      'Olha ele aqui:',
      'Headset PCYES Comfort CM500\nR$ 108,90, em estoque\nhttps://www.pcyes.com.br/headset-comfort-cm500',
    ])
  })

  it('sem foto, vai texto com o link, nunca o card com placeholder', async () => {
    lojaAtivaDaConta.mockResolvedValue(lojaFalsa({ produtos: [headset] }))
    roteiro = roteiroDeMostrar()
    const de = telefone(2)

    await receberMensagem(webhook(de, 'tem headset?'), () => mock)

    const envios = mock.enviadas.filter((e) => e.tipo !== 'espera')
    expect(envios.map((e) => e.tipo)).toEqual(['texto', 'texto'])
    expect(envios[1]).toMatchObject({ texto: expect.stringContaining(headset.link) })
  })
})
