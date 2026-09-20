import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { triagem } from '@/exemplos/triagem'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { criarFluxo } from './fluxos'
import { acharQuadro, criarQuadro } from './quadros'
import {
  acharInscricao,
  criarPasso,
  criarSequencia,
  inscrever,
  sairDasSequencias,
} from './sequencias'

/**
 * A saída por negociação, contra o Postgres de verdade (RB-47, 0085, T7.3).
 *
 * ---------------------------------------------------------------------------
 * Por que este teste tem que falar com o banco
 * ---------------------------------------------------------------------------
 *
 * Porque a regra **mora numa função SQL**. `core/politica-de-acompanhamento.ts`
 * explica e testa a decisão sem Postgres, e isso é útil, mas quem decide de
 * verdade é o `where` de `sair_das_sequencias`: se o `or cartao_id is null` sair
 * de lá, o teste puro continua verde e a produção volta a encerrar o
 * acompanhamento errado.
 *
 * ---------------------------------------------------------------------------
 * O cenário, e ele é o da clínica
 * ---------------------------------------------------------------------------
 *
 * A mesma pessoa, três acompanhamentos ativos:
 *
 *   1. um **do contato** (régua de recompra: `cartao_id is null`);
 *   2. um da **negociação A** (a mensalidade);
 *   3. um da **negociação B** (a avaliação física).
 *
 * Vende a A. O que tem que sobrar é **exatamente** o da B. Antes da 0085
 * sobrava nada, e ninguém percebia: a sequência não falha, ela "sai com motivo".
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-sai-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let contatoId = ''
let cartaoA = ''
let cartaoB = ''
const sequencias: string[] = []

/** Uma sequência com um passo, para a inscrição ter para onde andar. */
async function sequenciaComPasso(nome: string, fluxoId: string): Promise<string> {
  const r = await criarSequencia(clienteId, {
    nome: `${marca} ${nome}`,
    evento: 'atendimento_encerrado',
    etiquetaId: null,
    etiquetaDeSaidaId: null,
    colunaId: null,
  })
  if (!r.ok) throw new Error(`fixture: ${r.motivo}`)
  await criarPasso(clienteId, r.id, { fluxoId, atrasoMinutos: 60 })
  sequencias.push(r.id)
  return r.id
}

/** Um cartão numa etapa do quadro, direto no banco: é fixture, não fluxo de uso. */
async function cartao(quadroId: string, colunaId: string): Promise<string> {
  const { data, error } = await db()
    .from('quadro_cartoes')
    .insert({
      client_id: clienteId,
      quadro_id: quadroId,
      coluna_id: colunaId,
      contact_id: contatoId,
    })
    .select('id')
    .single()

  if (error) throw new Error(`fixture do cartão: ${error.message}`)
  return (data as { id: string }).id
}

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const [contato, fluxo] = await Promise.all([
    acharOuCriarContato(clienteId, `5511${seed}01`, 'Ana'),
    criarFluxo(clienteId, `${marca} passo`, triagem),
  ])
  contatoId = contato.id

  /*
   * Dois quadros, e não duas etapas do mesmo: o índice único de `quadro_cartoes`
   * é por (quadro, contato), então a mesma pessoa não tem dois cartões no mesmo
   * quadro. Duas negociações da mesma pessoa são, na prática, dois funis: a
   * mensalidade no comercial e a avaliação no de pós-venda.
   */
  const [qa, qb] = await Promise.all([
    criarQuadro(clienteId, `${marca} mensalidade`),
    criarQuadro(clienteId, `${marca} avaliacao`),
  ])
  if (!qa.ok || !qb.ok) throw new Error('fixture: quadro')

  const [quadroA, quadroB] = await Promise.all([
    acharQuadro(clienteId, qa.id),
    acharQuadro(clienteId, qb.id),
  ])
  cartaoA = await cartao(qa.id, quadroA!.etapas[0]!.id)
  cartaoB = await cartao(qb.id, quadroB!.etapas[0]!.id)

  await Promise.all([
    sequenciaComPasso('do contato', fluxo.id),
    sequenciaComPasso('da negociacao A', fluxo.id),
    sequenciaComPasso('da negociacao B', fluxo.id),
  ])
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('vender numa negociação', () => {
  it('encerra a dela e a do contato, e deixa a de OUTRA negociação de pé', async () => {
    const [doContato, daA, daB] = await Promise.all([
      inscrever(clienteId, sequencias[0]!, contatoId, null),
      inscrever(clienteId, sequencias[1]!, contatoId, cartaoA),
      inscrever(clienteId, sequencias[2]!, contatoId, cartaoB),
    ])
    expect(doContato).not.toBeNull()
    expect(daA).not.toBeNull()
    expect(daB).not.toBeNull()

    // Vendeu a negociação A.
    const encerradas = await sairDasSequencias(contatoId, 'vendeu', cartaoA)

    /*
     * **A asserção que é o ponto inteiro da tarefa.** A inscrição da negociação B
     * não pode estar na lista de encerradas.
     */
    expect(encerradas).toContain(daA!.id)
    expect(encerradas).toContain(doContato!.id)
    expect(encerradas).not.toContain(daB!.id)

    // E o estado gravado confirma, que é o que a tela vai ler.
    expect((await acharInscricao(daA!.id))?.estado).toBe('saiu')
    expect((await acharInscricao(doContato!.id))?.estado).toBe('saiu')
    expect((await acharInscricao(daB!.id))?.estado).toBe('ativa')
  })

  it('o motivo fica gravado, para a ficha poder dizer por quê', async () => {
    // `inscrever` devolve `null` quando já há uma ativa (o índice único parcial
    // da 0031), então cada teste começa limpando: é fixture, não asserção.
    await sairDasSequencias(contatoId, 'respondeu')

    const inscricao = await inscrever(clienteId, sequencias[1]!, contatoId, cartaoA)
    expect(inscricao).not.toBeNull()

    await sairDasSequencias(contatoId, 'vendeu', cartaoA)

    const { data } = await db()
      .from('sequencia_inscricoes')
      .select('motivo')
      .eq('id', inscricao!.id)
      .single()
    expect((data as { motivo: string }).motivo).toBe('vendeu')
  })
})

describe.skipIf(!temCredencial)('evento do contato', () => {
  it('alcança tudo, inclusive as de negociação', async () => {
    /*
     * O comportamento antigo, preservado inteiro: quem voltou a falar não precisa
     * ser lembrado de falar, qualquer que seja o acompanhamento. Se a 0085
     * tivesse estreitado isto, uma pessoa que respondeu continuaria recebendo os
     * passos das sequências de negociação dela.
     */
    await sairDasSequencias(contatoId, 'respondeu')

    const [doContato, daA, daB] = await Promise.all([
      inscrever(clienteId, sequencias[0]!, contatoId, null),
      inscrever(clienteId, sequencias[1]!, contatoId, cartaoA),
      inscrever(clienteId, sequencias[2]!, contatoId, cartaoB),
    ])
    expect(doContato).not.toBeNull()
    expect(daA).not.toBeNull()
    expect(daB).not.toBeNull()

    const encerradas = await sairDasSequencias(contatoId, 'respondeu', null)

    for (const inscricao of [doContato, daA, daB]) {
      expect(encerradas).toContain(inscricao!.id)
      expect((await acharInscricao(inscricao!.id))?.estado).toBe('saiu')
    }
  })

  it('a assinatura antiga, de dois argumentos, continua valendo', async () => {
    await sairDasSequencias(contatoId, 'respondeu')
    /*
     * **Ela não é sobra.** Entre esta migration e o deploy, o código publicado
     * chama a de dois argumentos: é a ordem que a 0058 e a 0071 ensinaram
     * (migration primeiro, deploy depois). Este teste prova que o intervalo é
     * seguro, chamando a RPC antiga diretamente.
     */
    const inscricao = await inscrever(clienteId, sequencias[0]!, contatoId, null)
    expect(inscricao).not.toBeNull()

    const { data, error } = await db().rpc('sair_das_sequencias', {
      p_contato_id: contatoId,
      p_motivo: 'respondeu',
    })
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect((await acharInscricao(inscricao!.id))?.estado).toBe('saiu')
  })
})

describe.skipIf(!temCredencial)('a coluna nova', () => {
  it('nulo é o padrão: inscrição sem cartão é do contato', async () => {
    // Inscrição sem cartão é o caso comum e legítimo (régua por sumiço, etiqueta,
    // pós-atendimento). Obrigar um cartão inventaria uma oportunidade por
    // acompanhamento.
    await sairDasSequencias(contatoId, 'respondeu')
    const inscricao = await inscrever(clienteId, sequencias[0]!, contatoId)
    expect(inscricao?.cartaoId).toBeNull()
    await sairDasSequencias(contatoId, 'respondeu')
  })

  it('guarda e devolve o cartão', async () => {
    await sairDasSequencias(contatoId, 'respondeu')
    const inscricao = await inscrever(clienteId, sequencias[1]!, contatoId, cartaoB)
    expect(inscricao?.cartaoId).toBe(cartaoB)
    await sairDasSequencias(contatoId, 'respondeu')
  })

  it('apagar o cartão não apaga a inscrição: ela vira do contato', async () => {
    /*
     * `on delete set null`, e não `cascade`: apagar uma negociação não pode apagar
     * o histórico do acompanhamento que rodou por causa dela. "Do contato" é a
     * leitura honesta depois de a negociação deixar de existir.
     */
    const quadro = await criarQuadro(clienteId, `${marca} temporario`)
    if (!quadro.ok) throw new Error('fixture')
    const q = await acharQuadro(clienteId, quadro.id)
    const efemero = await cartao(quadro.id, q!.etapas[0]!.id)

    await sairDasSequencias(contatoId, 'respondeu')
    const inscricao = await inscrever(clienteId, sequencias[2]!, contatoId, efemero)
    expect(inscricao?.cartaoId).toBe(efemero)

    await db().from('quadro_cartoes').delete().eq('id', efemero)

    const depois = await acharInscricao(inscricao!.id)
    expect(depois).not.toBeNull()
    expect(depois?.cartaoId).toBeNull()
    expect(depois?.estado).toBe('ativa')

    await sairDasSequencias(contatoId, 'respondeu')
  })
})
