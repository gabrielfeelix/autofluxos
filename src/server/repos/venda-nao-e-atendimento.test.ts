import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { resumoDoContato } from './crm'
import { acharQuadro, criarQuadro, fecharCartao, listarCartoes, moverCartao, porNoQuadro } from './quadros'

/**
 * O aceite A11: atendimento resolvido não é venda. **Corrigido pela 0071.**
 *
 * ---------------------------------------------------------------------------
 * O defeito que este arquivo mede
 * ---------------------------------------------------------------------------
 *
 * `resumoDoContato` responde "quanto essa pessoa já rendeu, quantas vezes
 * comprou" contando **todo cartão com `situacao = 'ganha'`**, em qualquer
 * quadro:
 *
 *     .eq('situacao', 'ganha')
 *
 * Só que `ganha` não quer dizer compra. Os modelos de `core/quadros-modelos.ts`
 * marcam como `ganho` a etapa final de três processos que não vendem nada:
 * "Resolvido" no Atendimento, "Qualificado" na Captação e "Compareceu" na
 * Agenda. E a tabela `quadros` não tem coluna de finalidade, então não existe
 * como o banco saber a diferença.
 *
 * Resultado: a clínica que resolveu a dúvida de dez pessoas tem dez compras e
 * uma receita que ninguém faturou. É a RB-03 e a RB-23 da proposta.
 *
 * A 0071 deu finalidade ao processo, e `jaComprou`/`resumoDoContato` passaram a
 * contar só o que é comercial. Este arquivo nasceu medindo o defeito; os
 * `expect` abaixo são a versão corrigida, e a diferença entre as duas versões
 * está no histórico do git.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-a11-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let contatoId = ''
let atendimentoId = ''
let comercialId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const pessoa = await acharOuCriarContato(clienteId, `55119${seed}`, 'Quem só tirou dúvida')
  contatoId = pessoa.id

  // Um processo de atendimento pelo modelo `atendimento`, que nasce com
  // "Resolvido" marcado como `ganho`, a origem do defeito.
  const atendimento = await criarQuadro(clienteId, `${marca} atendimento`, 'atendimento')
  if (!atendimento.ok) throw new Error(atendimento.motivo)
  atendimentoId = atendimento.id

  // E um comercial de verdade, para separar o que é compra do que não é.
  const comercial = await criarQuadro(clienteId, `${marca} comercial`, 'comercial')
  if (!comercial.ok) throw new Error(comercial.motivo)
  comercialId = comercial.id
})


/** A etapa marcada como ganho num quadro. É onde o cartão precisa cair. */
async function etapaDeGanho(quadroId: string): Promise<string> {
  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro) throw new Error('quadro sumiu')
  const ganho = quadro.etapas.find((etapa) => etapa.tipo === 'ganho')
  if (!ganho) throw new Error('o modelo não trouxe etapa de ganho')
  return ganho.id
}

/** O cartão daquele contato naquele quadro. */
async function cartaoDe(quadroId: string, contato: string): Promise<string> {
  const cartoes = await listarCartoes(clienteId, quadroId)
  const cartao = cartoes.find((c) => c.contatoId === contato)
  if (!cartao) throw new Error('cartão não encontrado')
  return cartao.id
}

afterAll(async () => {
  if (!temCredencial || clienteId === '') return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('atendimento resolvido não é compra', () => {
  /**
   * O caso do A11, inteiro: só atendimento, nenhuma venda. O resumo deveria
   * dizer zero compras.
   */
  it('hoje um atendimento concluído já conta como compra (A11 falha)', async () => {
    await porNoQuadro(clienteId, atendimentoId, [contatoId])
    const cartao = await cartaoDe(atendimentoId, contatoId)
    await moverCartao(clienteId, cartao, await etapaDeGanho(atendimentoId))
    await fecharCartao(clienteId, cartao, 'ganha', {})

    const resumo = await resumoDoContato(clienteId, contatoId)

    // A dúvida respondida não é compra, e não move receita.
    expect(resumo.compras).toBe(0)
    expect(resumo.total).toBe(0)
    expect(resumo.ultimaEm).toBeNull()
  })

  /**
   * O contraste que dá sentido ao teste acima: no processo comercial, fechar
   * **é** compra. A correção não pode apagar este caso junto.
   */
  it('no processo comercial, fechar continua sendo compra', async () => {
    await porNoQuadro(clienteId, comercialId, [contatoId])
    const cartao = await cartaoDe(comercialId, contatoId)
    await fecharCartao(clienteId, cartao, 'ganha', { valor: 500 })

    const resumo = await resumoDoContato(clienteId, contatoId)

    // Uma só: a comercial. O atendimento resolvido continua fora.
    expect(resumo.compras).toBe(1)
    expect(resumo.total).toBe(500)
  })
})

/**
 * O aceite A12: o mesmo contato comprando de novo no mesmo processo.
 *
 * `quadro_cartoes_unico_idx (quadro_id, contact_id)`, da 0032, garante **um
 * cartão por pessoa em cada quadro**. A segunda compra do mesmo cliente no
 * mesmo funil não tem onde existir: o insert é recusado com 23505.
 *
 * A unicidade resolve um problema real, dois cliques em "pôr no quadro" não
 * podem criar a mesma pessoa em duas etapas. Mas ela resolve isso proibindo
 * recorrência para sempre, quando o que precisava ser único era o **evento de
 * criação**, não a existência do vínculo.
 */
describe.skipIf(!temCredencial)('recompra no mesmo processo', () => {
  it('a segunda oportunidade no mesmo quadro passa a existir (A12)', async () => {
    const outro = await acharOuCriarContato(clienteId, `55219${seed}`, 'Cliente que volta')

    await porNoQuadro(clienteId, comercialId, [outro.id])
    const primeira = await cartaoDe(comercialId, outro.id)
    await fecharCartao(clienteId, primeira, 'ganha', { valor: 1200 })

    // A renovação: outra intenção de compra, mesma pessoa, mesmo funil. Com a
    // unicidade parcial da 0071, o cartão fechado sai do caminho.
    await porNoQuadro(clienteId, comercialId, [outro.id])
    const depois = (await listarCartoes(clienteId, comercialId)).filter(
      (c) => c.contatoId === outro.id,
    )
    expect(depois).toHaveLength(2)

    const nova = depois.find((c) => c.id !== primeira)!
    expect((nova.situacao ?? 'aberta')).toBe('aberta')
  })
})
