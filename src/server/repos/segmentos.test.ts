import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { validarSegmento } from '@/core/segmentos'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import {
  acharSegmento,
  apagarSegmento,
  criarSegmento,
  listarSegmentos,
  salvarRegra,
} from './segmentos'
import { avaliarElegibilidade, revalidarNoEnvio } from '../servicos/elegibilidade'
import { criarTransmissao, enfileirarDestinatarios, progressoDa } from './transmissoes'

/**
 * Segmentos e elegibilidade contra o banco (0083, T6.2).
 *
 * As duas regras que esta suíte existe para provar:
 *
 *  - **RB-38**: editar o segmento depois de confirmar **não** aumenta o lote.
 *    A lista do envio é congelada; o segmento é regra dinâmica. Se a
 *    transmissão lesse o segmento na hora de enviar, mudar a regra mudaria
 *    quem recebe, e ninguém saberia por quê;
 *  - **RB-39**: estar no segmento não autoriza mensagem. A prévia separa
 *    correspondente, elegível e excluído **por motivo**, e a revalidação no
 *    envio recusa quem deixou de ser elegível no meio do caminho.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-sgm-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e6)
  .toString()
  .padStart(6, '0')

let clienteId = ''
let dentroDaJanela = ''
let foraDaJanela = ''
let nuncaEscreveu = ''
let templateId = ''

const AGORA = Date.now()

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id

  const a = await acharOuCriarContato(clienteId, `55${seed}0001`, 'Dentro')
  const b = await acharOuCriarContato(clienteId, `55${seed}0002`, 'Fora')
  const c = await acharOuCriarContato(clienteId, `55${seed}0003`, 'Nunca')
  dentroDaJanela = a.id
  foraDaJanela = b.id
  nuncaEscreveu = c.id

  /*
   * A janela sai da última mensagem **de entrada**, e a coluna do instante é
   * `ts` (não `criado_em`): `messages` nasceu antes do vocabulário em
   * português do resto do schema. A view `leads` lê `entrada.ts`.
   */
  const { error: erroDasMensagens } = await db()
    .from('messages')
    .insert([
      // Uma hora atrás: janela aberta.
      {
        contact_id: dentroDaJanela,
        direcao: 'entrada',
        texto: 'oi',
        ts: new Date(AGORA - 3_600_000).toISOString(),
      },
      // Dois dias atrás: janela fechada.
      {
        contact_id: foraDaJanela,
        direcao: 'entrada',
        texto: 'oi',
        ts: new Date(AGORA - 2 * 86_400_000).toISOString(),
      },
    ])
  if (erroDasMensagens) throw new Error(erroDasMensagens.message)

  // `nuncaEscreveu` não recebe mensagem de entrada nenhuma.

  // A transmissão exige um modelo de verdade: `template_id` tem FK.
  const { data: modelo, error: erroDoModelo } = await db()
    .from('templates')
    .insert({
      cliente_id: clienteId,
      // `templates_nome_check` exige `^[a-z0-9_]+$`: o traço da marca não
      // passa, e é a regra de nome de modelo da própria Meta.
      nome: `${marca.replace(/-/g, '_')}_modelo`,
      categoria: 'MARKETING',
      status: 'aprovado',
    })
    .select('id')
    .single()
  if (erroDoModelo) throw new Error(erroDoModelo.message)
  templateId = (modelo as { id: string }).id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('o segmento é regra, não lista', () => {
  it('cria, lê e renomeia, com nome único por conta', async () => {
    const regra = validarSegmento(
      { juncao: 'todas', condicoes: [{ campo: 'compras', operador: 'maior', valor: '0' }] },
      { podeLerValores: true },
    )
    expect(regra.ok).toBe(true)
    if (!regra.ok) return

    const criado = await criarSegmento(clienteId, `${marca} compradores`, regra.segmento)
    expect(criado.ok).toBe(true)
    if (!criado.ok) return

    expect((await criarSegmento(clienteId, `${marca} COMPRADORES`, regra.segmento)).ok).toBe(false)

    const lido = await acharSegmento(clienteId, criado.segmento.id)
    expect(lido?.regra.condicoes).toHaveLength(1)
    expect(await listarSegmentos(clienteId)).toHaveLength(1)
  })

  it('regra que não valida mais vira vazia, e o segmento não some', async () => {
    // Uma versão anterior do produto pode ter gravado campo que não existe
    // mais. Devolver a regra crua faria a consulta ignorar a condição em
    // silêncio: a tela diria "sem comprar há 90 dias" e traria todo mundo.
    const { data } = await db()
      .from('segmentos')
      .insert({
        client_id: clienteId,
        nome: `${marca} antigo`,
        regra: { juncao: 'todas', condicoes: [{ campo: 'campo_que_sumiu', operador: 'igual', valor: 'x' }] },
      })
      .select('id')
      .single()

    const lido = await acharSegmento(clienteId, (data as { id: string }).id)
    expect(lido).not.toBeNull()
    expect(lido?.regra.condicoes).toHaveLength(0)
  })

  it('não lê nem apaga segmento de outra conta', async () => {
    const meu = await criarSegmento(clienteId, `${marca} meu`, { juncao: 'todas', condicoes: [] })
    expect(meu.ok).toBe(true)
    if (!meu.ok) return

    const outro = (await criarCliente(`${marca} vizinho`)).id
    expect(await acharSegmento(outro, meu.segmento.id)).toBeNull()
    expect((await salvarRegra(outro, meu.segmento.id, { juncao: 'todas', condicoes: [] })).ok).toBe(
      false,
    )
    await apagarSegmento(outro, meu.segmento.id)
    expect(await acharSegmento(clienteId, meu.segmento.id)).not.toBeNull()

    await db().from('clients').delete().eq('id', outro)
  })
})

describe.skipIf(!temCredencial)('editar o segmento não aumenta o lote (RB-38)', () => {
  it('a lista congelada na confirmação não muda quando a regra muda', async () => {
    const segmento = await criarSegmento(clienteId, `${marca} lote`, {
      juncao: 'todas',
      condicoes: [],
    })
    expect(segmento.ok).toBe(true)
    if (!segmento.ok) return

    // A transmissão materializa DOIS destinatários e guarda a procedência.
    const transmissao = await criarTransmissao({
      clienteId,
      nome: `${marca} disparo`,
      templateId,
    })
    await db()
      .from('transmissoes')
      .update({ segmento_id: segmento.segmento.id })
      .eq('id', transmissao.id)

    await enfileirarDestinatarios(transmissao.id, [dentroDaJanela, foraDaJanela])
    expect((await progressoDa(transmissao.id)).total).toBe(2)

    // Agora a regra muda para algo que traria o terceiro contato também.
    const nova = validarSegmento(
      { juncao: 'todas', condicoes: [{ campo: 'compras', operador: 'igual', valor: '0' }] },
      { podeLerValores: true },
    )
    expect(nova.ok).toBe(true)
    if (!nova.ok) return
    expect((await salvarRegra(clienteId, segmento.segmento.id, nova.segmento)).ok).toBe(true)

    // O lote continua com dois. Se a transmissão lesse o segmento na hora de
    // enviar, aqui haveria três, e ninguém saberia por quê.
    expect((await progressoDa(transmissao.id)).total).toBe(2)
  })

  it('apagar o segmento não apaga a transmissão que veio dele', async () => {
    const segmento = await criarSegmento(clienteId, `${marca} efemero`, {
      juncao: 'todas',
      condicoes: [],
    })
    expect(segmento.ok).toBe(true)
    if (!segmento.ok) return

    const transmissao = await criarTransmissao({
      clienteId,
      nome: `${marca} sobrevivente`,
      templateId,
    })
    await db()
      .from('transmissoes')
      .update({ segmento_id: segmento.segmento.id })
      .eq('id', transmissao.id)
    await enfileirarDestinatarios(transmissao.id, [dentroDaJanela])

    await apagarSegmento(clienteId, segmento.segmento.id)

    // A FK é `on delete set null`: perder a procedência é aceitável, perder o
    // registro do que foi enviado não é.
    const { data } = await db()
      .from('transmissoes')
      .select('id, segmento_id')
      .eq('id', transmissao.id)
      .single()
    expect((data as { segmento_id: string | null }).segmento_id).toBeNull()
    expect((await progressoDa(transmissao.id)).total).toBe(1)
  })
})

describe.skipIf(!temCredencial)('estar no segmento não autoriza mensagem (RB-39)', () => {
  it('a prévia separa correspondente, elegível e excluído por motivo', async () => {
    const previa = await avaliarElegibilidade(
      clienteId,
      [dentroDaJanela, foraDaJanela, nuncaEscreveu],
      { comModelo: false, agora: AGORA },
    )

    expect(previa.correspondentes).toBe(3)
    // Só quem escreveu na última hora pode receber texto livre.
    expect(previa.elegiveis).toBe(1)
    expect(previa.excluidos.janela_fechada_sem_modelo).toBe(1)
    expect(previa.excluidos.nunca_escreveu).toBe(1)

    // Os três números fecham: um total só esconderia a pergunta que quem
    // dispara precisa fazer antes de confirmar.
    const excluidos = Object.values(previa.excluidos).reduce((a, b) => a + b, 0)
    expect(previa.elegiveis + excluidos).toBe(previa.correspondentes)
  })

  it('com modelo aprovado a janela fechada não exclui ninguém', async () => {
    // É exatamente para isso que o modelo existe.
    const previa = await avaliarElegibilidade(
      clienteId,
      [dentroDaJanela, foraDaJanela, nuncaEscreveu],
      { comModelo: true, agora: AGORA },
    )
    expect(previa.elegiveis).toBe(3)
    expect(previa.excluidos.janela_fechada_sem_modelo).toBe(0)
  })

  it('a cobrança tem três valores, e desconhecido não vira paga', async () => {
    const previa = await avaliarElegibilidade(clienteId, [dentroDaJanela], {
      comModelo: true,
      agora: AGORA,
    })
    // Ninguém veio por anúncio nesta fixture: o custo é desconhecido, e dizer
    // "paga" seria prometer um número que ninguém calculou.
    expect(previa.detalhes[0]?.cobranca).toBe('desconhecido')
    expect(previa.custoNaoConfirmado).toBe(1)
    expect(previa.gratuitas).toBe(0)
  })

  it('a revalidação do envio recusa quem saiu da janela, com motivo legível', async () => {
    expect(
      await revalidarNoEnvio(clienteId, dentroDaJanela, { comModelo: false, agora: AGORA }),
    ).toBeNull()

    const recusa = await revalidarNoEnvio(clienteId, foraDaJanela, {
      comModelo: false,
      agora: AGORA,
    })
    expect(recusa).toContain('janela')

    // E o mesmo contato, dois dias à frente, deixa de ser elegível: entre
    // confirmar e enviar cabe horas, e a janela fecha sozinha.
    const depois = await revalidarNoEnvio(clienteId, dentroDaJanela, {
      comModelo: false,
      agora: AGORA + 2 * 86_400_000,
    })
    expect(depois).not.toBeNull()
  })

  it('contato que sumiu entre as consultas conta como excluído, e não some da soma', async () => {
    const previa = await avaliarElegibilidade(
      clienteId,
      [dentroDaJanela, crypto.randomUUID()],
      { comModelo: true, agora: AGORA },
    )
    expect(previa.correspondentes).toBe(2)
    expect(previa.elegiveis).toBe(1)
    expect(previa.excluidos.sem_telefone).toBe(1)
  })
})
