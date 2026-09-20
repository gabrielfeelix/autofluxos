import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from '../repos/clientes'
import { acharOuCriarContato } from '../repos/conversas'
import { linhaDoTempo } from '../repos/eventos'
import {
  acharQuadro,
  criarQuadro,
  encadearQuadro,
  listarCartoes,
  porNoQuadro,
  reabrirCartao,
} from '../repos/quadros'
import { rodarTarefas } from '../tarefas'
import { chaveDaContinuidade } from '@/core/continuidade'
import {
  conclusaoDoCartao,
  concluirProcesso,
  continuidadesPendentes,
  enfileirarContinuidade,
  resolverContinuidade,
} from './concluir-processo'

/**
 * A T1.2: concluir é uma transação, e continuar é uma intenção gravada.
 *
 * ---------------------------------------------------------------------------
 * O que cada bloco prova
 * ---------------------------------------------------------------------------
 *
 *  - **transação** — estado final e evento existem juntos. Não dá para simular
 *    a queda no meio de dentro do teste (é uma transação do Postgres), então o
 *    que se afirma é o observável: uma conclusão, um evento, com os ids e os
 *    nomes da época (RB-24);
 *  - **A13** — duplo clique e retry depois de resposta perdida devolvem a
 *    **mesma** conclusão, pelos dois caminhos: com chave e sem;
 *  - **A26** — o destino falhando deixa a origem concluída e uma pendência
 *    visível; repetir a ação não cria um segundo cartão lá.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-t12-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let sdrId = ''
let posVendaId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const sdr = await criarQuadro(clienteId, `${marca} sdr`, 'comercial')
  if (!sdr.ok) throw new Error(sdr.motivo)
  sdrId = sdr.id

  const pos = await criarQuadro(clienteId, `${marca} pos-venda`, 'atendimento')
  if (!pos.ok) throw new Error(pos.motivo)
  posVendaId = pos.id
})

afterAll(async () => {
  if (!temCredencial || clienteId === '') return
  await db().from('clients').delete().eq('id', clienteId)
})

let proximo = 0
/** Um contato novo por cenário: um cartão aberto por quadro é a regra da 0071. */
async function alguem(nome: string): Promise<string> {
  proximo += 1
  const pessoa = await acharOuCriarContato(
    clienteId,
    `55${seed}${String(proximo).padStart(3, '0')}`,
    nome,
  )
  return pessoa.id
}

async function cartaoDe(quadroId: string, contatoId: string): Promise<string> {
  const cartoes = await listarCartoes(clienteId, quadroId)
  const cartao = cartoes.find((c) => c.contatoId === contatoId)
  if (!cartao) throw new Error('cartão não encontrado')
  return cartao.id
}

async function abrirCartao(quadroId: string, contatoId: string): Promise<string> {
  const posto = await porNoQuadro(clienteId, quadroId, [contatoId])
  if (!posto.ok) throw new Error(posto.motivo)
  return cartaoDe(quadroId, contatoId)
}

describe.skipIf(!temCredencial)('concluir é uma transação', () => {
  it('grava estado final, evento e conclusão com os nomes da época (RB-24)', async () => {
    const contatoId = await alguem('Quem fechou')
    const cartaoId = await abrirCartao(sdrId, contatoId)

    const r = await concluirProcesso({
      clienteId,
      cartaoId,
      situacao: 'ganha',
      valor: 1200,
      titulo: 'Plano anual',
      autor: 'Ana',
    })

    expect(r.ok).toBe(true)
    if (!r.ok) return

    // O estado final.
    const { data: cartao } = await db()
      .from('quadro_cartoes')
      .select('situacao, valor, fechado_em, titulo')
      .eq('id', cartaoId)
      .single()
    expect((cartao as { situacao: string }).situacao).toBe('ganha')
    expect((cartao as { fechado_em: string | null }).fechado_em).not.toBeNull()
    expect((cartao as { titulo: string }).titulo).toBe('Plano anual')

    // A conclusão, com os ids e nomes do momento do fato.
    expect(r.conclusao.quadroId).toBe(sdrId)
    expect(r.conclusao.quadroNome).toBe(`${marca} sdr`)
    expect(r.conclusao.quadroFinalidade).toBe('comercial')
    expect(r.conclusao.colunaNome).not.toBe('')
    expect(r.conclusao.cartaoId).toBe(cartaoId)

    // E o evento, com os mesmos ids — é o que a T1.2 pede no histórico.
    const eventos = await linhaDoTempo(clienteId, contatoId)
    const ganhou = eventos.find((e) => e.tipo === 'ganhou')
    expect(ganhou).toBeDefined()
    expect(ganhou?.dados.cartaoId).toBe(cartaoId)
    expect(ganhou?.dados.quadroId).toBe(sdrId)
    expect(ganhou?.dados.quadroNome).toBe(`${marca} sdr`)
    expect(ganhou?.dados.colunaId).toBe(r.conclusao.colunaId)
  })

  /**
   * **Renomear o processo depois não reescreve o histórico.**
   *
   * É a metade da RB-24 que só aparece quando alguém renomeia: se o nome fosse
   * buscado na leitura, a linha do tempo de quem fechou em março mudaria de
   * texto por causa de uma decisão de julho.
   */
  it('renomear o processo depois não muda o que foi registrado', async () => {
    const contatoId = await alguem('Quem fechou antes do rename')
    const quadro = await criarQuadro(clienteId, `${marca} efemero`, 'comercial')
    if (!quadro.ok) throw new Error(quadro.motivo)

    const cartaoId = await abrirCartao(quadro.id, contatoId)
    const r = await concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 10 })
    expect(r.ok).toBe(true)

    await db().from('quadros').update({ nome: `${marca} nome novo` }).eq('id', quadro.id)

    const relido = await conclusaoDoCartao(clienteId, cartaoId)
    expect(relido?.quadroNome).toBe(`${marca} efemero`)
  })

  it('perder exige motivo da lista, e a recusa não escreve nada', async () => {
    const contatoId = await alguem('Quem não fechou')
    const cartaoId = await abrirCartao(sdrId, contatoId)

    const r = await concluirProcesso({
      clienteId,
      cartaoId,
      situacao: 'perdida',
      motivo: 'inventado na hora',
    })

    expect(r.ok).toBe(false)

    // Nenhuma venda parcial, e nenhum estado parcial: o cartão segue aberto e
    // o histórico não ganhou um "perdeu" que não aconteceu.
    const { data: cartao } = await db()
      .from('quadro_cartoes')
      .select('situacao')
      .eq('id', cartaoId)
      .single()
    expect((cartao as { situacao: string }).situacao).toBe('aberta')
    expect(await conclusaoDoCartao(clienteId, cartaoId)).toBeNull()
  })
})

describe.skipIf(!temCredencial)('duplo clique e resposta perdida (A13)', () => {
  it('duas chamadas com a mesma chave devolvem a mesma conclusão', async () => {
    const contatoId = await alguem('Quem clicou duas vezes')
    const cartaoId = await abrirCartao(sdrId, contatoId)
    const chave = `teste:${cartaoId}`

    const primeira = await concluirProcesso({
      clienteId, cartaoId, situacao: 'ganha', valor: 900, chaveDaOperacao: chave,
    })
    const segunda = await concluirProcesso({
      clienteId, cartaoId, situacao: 'ganha', valor: 900, chaveDaOperacao: chave,
    })

    expect(primeira.ok).toBe(true)
    expect(segunda.ok).toBe(true)
    if (!primeira.ok || !segunda.ok) return

    expect(segunda.conclusao.id).toBe(primeira.conclusao.id)
    expect(segunda.repetida).toBe(true)

    // E uma só no banco: repetir não soma linha.
    const { count } = await db()
      .from('conclusoes_de_processo')
      .select('id', { count: 'exact', head: true })
      .eq('cartao_id', cartaoId)
    expect(count).toBe(1)

    // Nem um segundo evento no histórico.
    const eventos = await linhaDoTempo(clienteId, contatoId)
    expect(eventos.filter((e) => e.tipo === 'ganhou')).toHaveLength(1)
  })

  /**
   * **A corrida de verdade**: as duas requisições saem juntas, sem chave.
   *
   * É o duplo clique real — o segundo clique sai antes de a resposta do
   * primeiro voltar, então não há como a tela saber que já está feito. Quem
   * fecha é o `and situacao = 'aberta'` do update, dentro da transação.
   */
  it('duas chamadas simultâneas sem chave produzem uma conclusão só', async () => {
    const contatoId = await alguem('Quem clicou junto')
    const cartaoId = await abrirCartao(sdrId, contatoId)

    const [a, b] = await Promise.all([
      concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 300 }),
      concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 300 }),
    ])

    // As duas respondem sucesso, porque as duas descrevem a verdade: o cartão
    // está concluído. O que não pode é haver duas conclusões.
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.conclusao.id).toBe(b.conclusao.id)

    const { count } = await db()
      .from('conclusoes_de_processo')
      .select('id', { count: 'exact', head: true })
      .eq('cartao_id', cartaoId)
    expect(count).toBe(1)

    const eventos = await linhaDoTempo(clienteId, contatoId)
    expect(eventos.filter((e) => e.tipo === 'ganhou')).toHaveLength(1)
  })

  it('reabrir libera a ocorrência para ser concluída de novo', async () => {
    const contatoId = await alguem('Quem reabriu')
    const cartaoId = await abrirCartao(sdrId, contatoId)

    expect((await concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 50 })).ok).toBe(true)
    expect((await reabrirCartao(clienteId, cartaoId)).ok).toBe(true)

    // A conclusão saiu junto: sem isso o índice único por cartão recusaria a
    // próxima, e o cartão ficaria impossível de fechar.
    expect(await conclusaoDoCartao(clienteId, cartaoId)).toBeNull()

    const denovo = await concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 80 })
    expect(denovo.ok).toBe(true)
  })
})

describe.skipIf(!temCredencial)('continuidade entre processos (RB-25, A26)', () => {
  /**
   * O caso comum: a passagem acontece **no mesmo clique**.
   *
   * A tela diz "o contato entrou no funil Pós-venda" na resposta da ação, e um
   * cartão que só aparecesse na próxima passada do cron transformaria essa
   * frase em promessa. O que a T1.2 mudou não é quando a passagem acontece, é
   * o que sobra quando ela não acontece — o caso do teste seguinte.
   */
  it('concluir num processo encadeado abre o destino na hora', async () => {
    expect((await encadearQuadro(clienteId, sdrId, posVendaId)).ok).toBe(true)

    const contatoId = await alguem('Quem vai ao pós-venda')
    const cartaoId = await abrirCartao(sdrId, contatoId)

    const r = await concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 700 })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.conclusao.destinoQuadroId).toBe(posVendaId)
    expect(r.conclusao.continuidade).toBe('feita')
    expect(r.conclusao.destinoCartaoId).not.toBeNull()

    // E a fila não ficou com trabalho duplicado para fazer.
    await rodarTarefas()

    const depois = await conclusaoDoCartao(clienteId, cartaoId)
    expect(depois?.continuidade).toBe('feita')
    expect(depois?.destinoCartaoId).toBe(r.conclusao.destinoCartaoId)

    // O cartão está mesmo lá, e o histórico diz por quê.
    const noDestino = (await listarCartoes(clienteId, posVendaId)).filter(
      (c) => c.contatoId === contatoId,
    )
    expect(noDestino).toHaveLength(1)

    const eventos = await linhaDoTempo(clienteId, contatoId)
    const entrou = eventos.find((e) => e.tipo === 'entrou-no-quadro')
    expect(entrou?.dados.porConclusao).toBe(r.conclusao.id)
  })

  /**
   * **O retry depois de uma resposta perdida não duplica o destino** (A26).
   *
   * Executar a mesma intenção duas, três vezes tem que dar sempre o mesmo
   * cartão — é a `chave_de_criacao` da 0071 fazendo o trabalho dela.
   */
  it('repetir a intenção não cria um segundo cartão no destino', async () => {
    expect((await encadearQuadro(clienteId, sdrId, posVendaId)).ok).toBe(true)

    const contatoId = await alguem('Quem teve retry')
    const cartaoId = await abrirCartao(sdrId, contatoId)

    const r = await concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 100 })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const primeira = await resolverContinuidade(r.conclusao.id)
    const segunda = await resolverContinuidade(r.conclusao.id)
    const terceira = await resolverContinuidade(r.conclusao.id)

    expect(primeira?.continuidade).toBe('feita')
    expect(segunda?.destinoCartaoId).toBe(primeira?.destinoCartaoId)
    expect(terceira?.destinoCartaoId).toBe(primeira?.destinoCartaoId)

    const noDestino = (await listarCartoes(clienteId, posVendaId)).filter(
      (c) => c.contatoId === contatoId,
    )
    expect(noDestino).toHaveLength(1)

    // E um evento só de entrada: repetir não vira ruído no histórico de ninguém.
    const eventos = await linhaDoTempo(clienteId, contatoId)
    expect(eventos.filter((e) => e.tipo === 'entrou-no-quadro')).toHaveLength(1)
  })

  /**
   * **O destino falha, e a origem continua de pé** (A26).
   *
   * O caso escolhido é o processo de destino **sem etapa nenhuma** — a última
   * foi arquivada e ninguém notou. Não serve apagar o quadro de destino:
   * `quadros.seguinte_id` é `on delete set null`, então apagá-lo desfaz a
   * cadeia e a conclusão nasce sem destino nenhum, que é `nao_se_aplica` e
   * está certo. A pendência exige uma cadeia que existe e um destino que não
   * recebe — foi o próprio teste que mostrou a diferença.
   *
   * Antes da T1.2 isso era um `console.error` e um `null`: o ganho ficava
   * registrado e ninguém nunca sabia que o pós-venda não abriu.
   */
  it('destino sem etapa vira pendência visível, sem desfazer a conclusão', async () => {
    const quebrado = await criarQuadro(clienteId, `${marca} destino quebrado`, 'atendimento')
    if (!quebrado.ok) throw new Error(quebrado.motivo)

    const origem = await criarQuadro(clienteId, `${marca} origem`, 'comercial')
    if (!origem.ok) throw new Error(origem.motivo)
    expect((await encadearQuadro(clienteId, origem.id, quebrado.id)).ok).toBe(true)

    const contatoId = await alguem('Quem ficou pendente')
    const cartaoId = await abrirCartao(origem.id, contatoId)

    // O destino fica sem etapa: a cadeia continua de pé, e não há onde pôr o
    // cartão quando ele chegar.
    await db().from('quadro_colunas').delete().eq('quadro_id', quebrado.id)

    const r = await concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 400 })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    // A conclusão **respondeu sucesso**, porque ela deu certo. O que não
    // aconteceu foi a continuidade, e é isso que a resposta não esconde.
    expect(r.conclusao.continuidade).toBe('falhou')

    // A fila tenta de novo e chega ao mesmo lugar: destino sem etapa não
    // melhora com repetição, e a pendência continua de pé.
    await rodarTarefas()

    const depois = await conclusaoDoCartao(clienteId, cartaoId)

    // A conclusão de origem **não** foi desfeita: o ganho continua ganho.
    expect(depois?.situacao).toBe('ganha')
    const { data: cartao } = await db()
      .from('quadro_cartoes')
      .select('situacao')
      .eq('id', cartaoId)
      .single()
    expect((cartao as { situacao: string }).situacao).toBe('ganha')

    // E a pendência ficou visível, com motivo.
    expect(depois?.continuidade).toBe('falhou')
    expect(depois?.continuidadeErro).toBeTruthy()
    expect(depois?.destinoCartaoId).toBeNull()

    const pendentes = await continuidadesPendentes(clienteId)
    expect(pendentes.map((p) => p.id)).toContain(r.conclusao.id)
  })

  it('perder não abre destino nenhum', async () => {
    expect((await encadearQuadro(clienteId, sdrId, posVendaId)).ok).toBe(true)

    const { data: motivo } = await db()
      .from('motivos_de_perda')
      .insert({ client_id: clienteId, nome: 'achou caro' })
      .select('nome')
      .single()

    const contatoId = await alguem('Quem não comprou')
    const cartaoId = await abrirCartao(sdrId, contatoId)

    const r = await concluirProcesso({
      clienteId, cartaoId, situacao: 'perdida', motivo: (motivo as { nome: string }).nome,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.conclusao.continuidade).toBe('nao_se_aplica')

    await rodarTarefas()

    const noDestino = (await listarCartoes(clienteId, posVendaId)).filter(
      (c) => c.contatoId === contatoId,
    )
    expect(noDestino).toHaveLength(0)
  })

  /**
   * Já estar **aberto** no destino é recompra, não erro: o cartão que já está
   * lá é o que vale, e mover de volta para a primeira etapa desfaria o
   * trabalho de quem o arrastou até o fim.
   */
  it('quem já está aberto no destino não é movido de volta', async () => {
    expect((await encadearQuadro(clienteId, sdrId, posVendaId)).ok).toBe(true)

    const contatoId = await alguem('Quem já estava no pós-venda')
    const jaLa = await abrirCartao(posVendaId, contatoId)

    const destino = await acharQuadro(clienteId, posVendaId)
    const segunda = destino?.etapas[1]
    if (segunda) {
      await db().from('quadro_cartoes').update({ coluna_id: segunda.id }).eq('id', jaLa)
    }

    const cartaoId = await abrirCartao(sdrId, contatoId)
    const r = await concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 60 })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    await rodarTarefas()

    const depois = await conclusaoDoCartao(clienteId, cartaoId)
    expect(depois?.continuidade).toBe('feita')
    expect(depois?.destinoCartaoId).toBe(jaLa)

    // Um cartão só lá, e ele não voltou para a primeira etapa.
    const noDestino = (await listarCartoes(clienteId, posVendaId)).filter(
      (c) => c.contatoId === contatoId,
    )
    expect(noDestino).toHaveLength(1)
    if (segunda) expect(noDestino[0]?.colunaId).toBe(segunda.id)
  })

  /**
   * A rede embaixo existe, e some quando não é mais necessária.
   *
   * A tarefa é enfileirada **antes** da tentativa inline — morrer entre as
   * duas tem que deixar a fila cobrindo. Quando a tentativa dá certo, ela é
   * cancelada: deixá-la viva não criaria um segundo cartão (a
   * `chave_de_criacao` da 0071 fecha isso), mas gastaria uma passada do cron
   * para descobrir que não há o que fazer.
   */
  it('a tarefa da continuidade é enfileirada por conclusão, e sai depois do sucesso', async () => {
    expect((await encadearQuadro(clienteId, sdrId, posVendaId)).ok).toBe(true)

    const contatoId = await alguem('Quem tem tarefa na fila')
    const cartaoId = await abrirCartao(sdrId, contatoId)

    const r = await concluirProcesso({ clienteId, cartaoId, situacao: 'ganha', valor: 20 })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const { data } = await db()
      .from('tarefas')
      .select('tipo, chave, estado')
      .eq('chave', chaveDaContinuidade(r.conclusao.id))

    const fila = (data ?? []) as { tipo: string; chave: string; estado: string }[]

    // Uma tarefa, dela, e já cancelada porque a passagem aconteceu na hora.
    expect(fila).toHaveLength(1)
    expect(fila[0]?.tipo).toBe('continuidade_de_processo')
    expect(fila[0]?.estado).toBe('cancelada')
  })

  /**
   * **A fila é a rede, e ela precisa funcionar sozinha** (A26).
   *
   * O cenário: a tentativa inline não aconteceu — a função morreu entre
   * enfileirar e tentar, o deploy caiu no meio. A intenção está gravada e a
   * tarefa está na fila; é só com isso que a passagem tem que acontecer.
   */
  it('a fila resolve a continuidade sem nenhuma tentativa inline', async () => {
    expect((await encadearQuadro(clienteId, sdrId, posVendaId)).ok).toBe(true)

    const contatoId = await alguem('Quem depende só da fila')
    const cartaoId = await abrirCartao(sdrId, contatoId)

    // A conclusão, sem a tentativa inline: a RPC direto, que é exatamente o
    // que `concluirProcesso` faz antes de enfileirar.
    const { data } = await db().rpc('concluir_processo', {
      p_client_id: clienteId,
      p_cartao_id: cartaoId,
      p_situacao: 'ganha',
      p_valor: 30,
      p_motivo: null,
      p_titulo: null,
      p_autor: null,
      p_chave: null,
    })
    const conclusaoId = ((data ?? []) as { o_id: string }[])[0]?.o_id
    expect(conclusaoId).toBeTruthy()
    if (!conclusaoId) return

    const antes = await conclusaoDoCartao(clienteId, cartaoId)
    expect(antes?.continuidade).toBe('pendente')

    await enfileirarContinuidade(clienteId, conclusaoId)
    await rodarTarefas()

    const depois = await conclusaoDoCartao(clienteId, cartaoId)
    expect(depois?.continuidade).toBe('feita')
    expect(depois?.destinoCartaoId).not.toBeNull()

    const noDestino = (await listarCartoes(clienteId, posVendaId)).filter(
      (c) => c.contatoId === contatoId,
    )
    expect(noDestino).toHaveLength(1)
  })
})
