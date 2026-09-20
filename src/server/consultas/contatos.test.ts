import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { validarSegmento, SEGMENTO_VAZIO, type Segmento } from '@/core/segmentos'
import { db } from '../db'
import { criarCliente } from '../repos/clientes'
import { acharOuCriarContato } from '../repos/conversas'
import { avaliarCartao, criarQuadro, listarCartoes, porNoQuadro } from '../repos/quadros'
import { registrarVendaEConcluir } from '../servicos/registrar-venda'
import { consultarContatos, contarContatos } from './contatos'

/**
 * A consulta única (T6.1, RB-35 a RB-37) contra o banco.
 *
 * O que esta suíte prova, e que a tela antiga errava:
 *
 *  1. **o filtro vale sobre a base, não sobre a página**. As fixtures são
 *     maiores que uma página de propósito: com `filter()` em memória, a
 *     contagem seria a da página e o resultado dependeria de onde a pessoa
 *     estava;
 *  2. **contato aparece uma vez**, mesmo com várias oportunidades (RB-37);
 *  3. **a mesma ocorrência** satisfaz o grupo de condições (RB-36): fria E
 *     aberta tem que ser a mesma negociação;
 *  4. **nulo é informação** (RB-35): "sem comprar há X dias" não arrasta quem
 *     nunca comprou;
 *  5. **o escopo entra na consulta**, e quem não pode ver valor não filtra por
 *     ele.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-cns-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e6)
  .toString()
  .padStart(6, '0')

/** Acima da página de 50: é o que faz o defeito do `filter()` aparecer. */
const QUANTOS = 60

let clienteId = ''
let quadroId = ''
let outroQuadroId = ''
let comprador = ''
let friaEAberta = ''
let friaEGanhaSeparadas = ''

const HOJE = new Date().toISOString().slice(0, 10)

function segmento(condicoes: unknown[], juncao = 'todas'): Segmento {
  const r = validarSegmento({ juncao, condicoes }, { podeLerValores: true })
  if (!r.ok) throw new Error(r.motivo)
  return r.segmento
}

async function cartaoPara(contatoId: string, quadro: string): Promise<string> {
  await porNoQuadro(clienteId, quadro, [contatoId])
  const cartoes = await listarCartoes(clienteId, quadro)
  return cartoes.find((c) => c.contatoId === contatoId)!.id
}

beforeAll(async () => {
  if (!temCredencial) return

  clienteId = (await criarCliente(`${marca} cliente`)).id
  const q = await criarQuadro(clienteId, `${marca} comercial`)
  if (q.ok) quadroId = q.id
  const q2 = await criarQuadro(clienteId, `${marca} outro`)
  if (q2.ok) outroQuadroId = q2.id

  // 60 contatos, para a base ficar maior que a página.
  const criados: string[] = []
  for (let i = 0; i < QUANTOS; i++) {
    const contato = await acharOuCriarContato(
      clienteId,
      `55${seed}${String(i).padStart(4, '0')}`,
      `Pessoa ${i}`,
    )
    criados.push(contato.id)
  }

  // Um comprador, com venda de valor conhecido.
  comprador = criados[0]!
  const cartaoDoComprador = await cartaoPara(comprador, quadroId)
  await registrarVendaEConcluir({
    clienteId,
    cartaoId: cartaoDoComprador,
    dataDaVenda: HOJE,
    valorTotal: 5000,
    itens: [{ descricao: 'Plano Ouro', quantidade: 1, valorUnitario: 5000 }],
    chaveDaOperacao: `cns:${cartaoDoComprador}`,
  })

  // Quem tem UMA oportunidade fria E aberta: satisfaz o grupo.
  friaEAberta = criados[1]!
  const cartaoFrio = await cartaoPara(friaEAberta, quadroId)
  await avaliarCartao(clienteId, cartaoFrio, 'frio')

  // Quem tem uma fria GANHA num quadro e uma aberta SEM temperatura no outro:
  // as duas condições são satisfeitas, mas por negociações diferentes. É
  // exatamente o caso que a RB-36 manda NÃO trazer.
  friaEGanhaSeparadas = criados[2]!
  const cartaoGanho = await cartaoPara(friaEGanhaSeparadas, quadroId)
  await avaliarCartao(clienteId, cartaoGanho, 'frio')
  await registrarVendaEConcluir({
    clienteId,
    cartaoId: cartaoGanho,
    dataDaVenda: HOJE,
    valorTotal: 10,
    chaveDaOperacao: `cns:ganho:${cartaoGanho}`,
  })
  await cartaoPara(friaEGanhaSeparadas, outroQuadroId) // aberta, sem temperatura
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('o filtro vale sobre a base, não sobre a página', () => {
  it('a contagem é do filtro inteiro, e a página é só um recorte', async () => {
    const r = await consultarContatos({
      clienteId,
      segmento: SEGMENTO_VAZIO,
      escopo: { tipo: 'tudo' },
    })

    // 60 contatos, 50 por página: o total é da base, não da página.
    expect(r.total).toBe(QUANTOS)
    expect(r.contatos).toHaveLength(50)
    expect(r.paginas).toBe(2)

    const segunda = await consultarContatos({
      clienteId,
      segmento: SEGMENTO_VAZIO,
      escopo: { tipo: 'tudo' },
      pagina: 2,
    })
    expect(segunda.contatos).toHaveLength(QUANTOS - 50)

    // E ninguém aparece nas duas: a ordenação tem desempate estável.
    const daPrimeira = new Set(r.contatos.map((c) => c.contatoId))
    expect(segunda.contatos.some((c) => daPrimeira.has(c.contatoId))).toBe(false)
  })

  it('a contagem e a lista usam a MESMA definição', async () => {
    const filtro = segmento([{ campo: 'compras', operador: 'maior', valor: '0' }])

    const lista = await consultarContatos({
      clienteId,
      segmento: filtro,
      escopo: { tipo: 'tudo' },
    })
    const contagem = await contarContatos({
      clienteId,
      segmento: filtro,
      escopo: { tipo: 'tudo' },
    })

    expect(contagem).toBe(lista.total)
    expect(lista.contatos.every((c) => c.compras > 0)).toBe(true)
  })

  it('ordenar por valor gasto ordena a BASE, e nulo vai para o fim', async () => {
    // Isto é o que o `filter()` em memória não conseguia fazer: o maior
    // comprador precisa vir na primeira página mesmo que ele fosse o de número
    // 59 na ordem por recência.
    const r = await consultarContatos({
      clienteId,
      segmento: SEGMENTO_VAZIO,
      escopo: { tipo: 'tudo' },
      ordem: 'valor',
    })
    expect(r.contatos[0]?.contatoId).toBe(comprador)
    expect(r.contatos[0]?.valorConhecido).toBe(5000)
    expect(r.contatos.at(-1)?.valorConhecido).toBeNull()
  })
})

describe.skipIf(!temCredencial)('a mesma ocorrência (RB-36)', () => {
  it('fria E aberta tem que ser a MESMA negociação', async () => {
    const r = await consultarContatos({
      clienteId,
      segmento: segmento([
        { campo: 'oportunidade_temperatura', operador: 'igual', valor: 'frio' },
        { campo: 'oportunidade_situacao', operador: 'igual', valor: 'aberta' },
      ]),
      escopo: { tipo: 'tudo' },
    })

    const ids = r.contatos.map((c) => c.contatoId)
    expect(ids).toContain(friaEAberta)

    // Quem tem uma fria ganha e outra aberta sem temperatura satisfaz as duas
    // condições separadamente, e NÃO pode entrar: juntar a temperatura de uma
    // negociação com o estado de outra devolve gente que ninguém pediu.
    expect(ids).not.toContain(friaEGanhaSeparadas)
  })

  it('contato com várias oportunidades aparece uma vez só (RB-37)', async () => {
    // O `friaEGanhaSeparadas` tem dois cartões. Num join ingênuo ele viria
    // duplicado, e a contagem diria 61 numa base de 60.
    const r = await consultarContatos({
      clienteId,
      segmento: segmento([{ campo: 'oportunidade_situacao', operador: 'igual', valor: 'aberta' }]),
      escopo: { tipo: 'tudo' },
    })

    const ids = r.contatos.map((c) => c.contatoId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(r.total).toBe(ids.length)
  })
})

describe.skipIf(!temCredencial)('o nulo é informação (RB-35)', () => {
  it('"sem comprar há X dias" NÃO arrasta quem nunca comprou', async () => {
    const semComprarHaMuito = await consultarContatos({
      clienteId,
      segmento: segmento([
        { campo: 'ultima_compra_em', operador: 'ha_mais_de_dias', valor: '1' },
      ]),
      escopo: { tipo: 'tudo' },
    })

    // Ninguém: as únicas compras são de hoje, e quem nunca comprou tem
    // `ultima_compra_em` nulo — que é um grupo próprio, não "faz muito tempo".
    expect(semComprarHaMuito.contatos.every((c) => c.ultimaCompraEm !== null)).toBe(true)
    expect(semComprarHaMuito.total).toBe(0)
  })

  it('quem nunca comprou tem grupo próprio', async () => {
    const nuncaComprou = await consultarContatos({
      clienteId,
      segmento: segmento([{ campo: 'ultima_compra_em', operador: 'nao_informado' }]),
      escopo: { tipo: 'tudo' },
    })

    expect(nuncaComprou.total).toBe(QUANTOS - 2) // os dois compradores saem
    expect(nuncaComprou.contatos.every((c) => c.ultimaCompraEm === null)).toBe(true)
  })

  it('valor desconhecido não vira zero', async () => {
    const r = await consultarContatos({
      clienteId,
      segmento: segmento([{ campo: 'valor_conhecido', operador: 'nao_informado' }]),
      escopo: { tipo: 'tudo' },
    })
    expect(r.contatos.every((c) => c.valorConhecido === null)).toBe(true)
    expect(r.contatos.every((c) => c.valorConhecido !== 0)).toBe(true)
  })
})

describe.skipIf(!temCredencial)('autorização e isolamento', () => {
  it('escopo impossível não devolve nada, e não devolve tudo', async () => {
    const r = await consultarContatos({
      clienteId,
      segmento: SEGMENTO_VAZIO,
      escopo: { tipo: 'impossivel' },
    })
    expect(r.total).toBe(0)
    expect(r.contatos).toHaveLength(0)
  })

  it('escopo próprio só vê o que é dele', async () => {
    const r = await consultarContatos({
      clienteId,
      segmento: SEGMENTO_VAZIO,
      escopo: { tipo: 'proprios', usuarioId: '11111111-1111-1111-1111-111111111111' },
    })
    // Ninguém tem responsável nesta fixture.
    expect(r.total).toBe(0)
  })

  it('não vê contato de outra conta', async () => {
    const outro = (await criarCliente(`${marca} vizinho`)).id
    const r = await consultarContatos({
      clienteId: outro,
      segmento: SEGMENTO_VAZIO,
      escopo: { tipo: 'tudo' },
    })
    expect(r.total).toBe(0)
    await db().from('clients').delete().eq('id', outro)
  })

  it('quem não lê valores não consegue montar o filtro de valor', () => {
    // A recusa é na validação, antes de chegar aqui: a consulta nunca vê a
    // condição. É o que impede descobrir quanto alguém gastou estreitando um
    // filtro até a contagem mudar.
    const r = validarSegmento(
      { juncao: 'todas', condicoes: [{ campo: 'valor_conhecido', operador: 'maior', valor: '1' }] },
      { podeLerValores: false },
    )
    expect(r.ok).toBe(false)
  })
})

describe.skipIf(!temCredencial)('as duas superfícies concordam (RB-37)', () => {
  it('a lista de leads filtrada por faixa devolve o mesmo conjunto que o CSV', async () => {
    const { contatosDoNivel } = await import('./nivel')
    const { paginarLeads } = await import('../repos/leads')

    const faixas = { ouro: 5000, prata: 1000 }
    const ouro = await contatosDoNivel(clienteId, 'ouro', faixas)

    // Só o comprador de 5000 está em Ouro, na conta inteira.
    expect(ouro).toEqual([comprador])

    // A tela: `paginarLeads` restrito aos mesmos ids.
    const daTela = await paginarLeads(clienteId, { contatos: ouro, porPagina: 50 })

    // O CSV: o mesmo caminho, em lotes maiores. Antes da T6.1 ele nem
    // conhecia o filtro e devolveria os 60.
    const doCsv = await paginarLeads(clienteId, { contatos: ouro, porPagina: 500 })

    expect(daTela.total).toBe(1)
    expect(doCsv.total).toBe(1)
    expect(daTela.leads.map((l) => l.contatoId)).toEqual(doCsv.leads.map((l) => l.contatoId))
    expect(doCsv.leads).toHaveLength(1)
  })

  it('faixa sem ninguém devolve vazio, e não a base inteira', async () => {
    const { contatosDoNivel } = await import('./nivel')
    const { paginarLeads } = await import('../repos/leads')

    // Faixa impossível: ninguém gastou mais de um milhão.
    const ninguem = await contatosDoNivel(clienteId, 'ouro', { ouro: 1_000_000, prata: 999_999 })
    expect(ninguem).toHaveLength(0)

    // Lista vazia é "ninguém passa", e precisa ser distinguível de `null`
    // ("sem restrição"): tratá-las igual mostraria a base inteira justo
    // quando o filtro não achou ninguém.
    const r = await paginarLeads(clienteId, { contatos: ninguem })
    expect(r.total).toBe(0)
    expect(r.leads).toHaveLength(0)
  })
})
