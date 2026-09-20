import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ETAPAS_INICIAIS } from '@/core/quadros'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { linhaDoTempo } from './eventos'
import {
  acharQuadro,
  acharQuadroPadrao,
  apagarEtapa,
  apagarQuadro,
  criarEtapa,
  criarQuadro,
  definirEntradaNoFunil,
  definirQuadroPadrao,
  listarCartoes,
  listarQuadros,
  moverCartao,
  moverEtapa,
  politicaDeEntrada,
  porNoQuadro,
  quadrosDoContato,
  renomearEtapa,
  tirarDoQuadro,
} from './quadros'

/**
 * Os quadros contra o banco de verdade (0032).
 *
 * O que precisa ser provado aqui é a recusa: a mesma pessoa duas vezes no mesmo
 * quadro, o cartão movido para a etapa de **outro** quadro, e a etapa apagada
 * com gente dentro. As três são índice e chave estrangeira, e só aparecem
 * contra Postgres.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-qdr-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let outroId = ''
let ana = ''
let bruno = ''
let doOutro = ''
let quadroId = ''
let outroQuadroId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const [cliente, outro] = await Promise.all([
    criarCliente(`${marca} cliente`),
    criarCliente(`${marca} outro`),
  ])
  clienteId = cliente.id
  outroId = outro.id

  const [a, b, c] = await Promise.all([
    acharOuCriarContato(clienteId, `5511${seed}01`, 'Ana'),
    acharOuCriarContato(clienteId, `5511${seed}02`, 'Bruno'),
    acharOuCriarContato(outroId, `5511${seed}03`, 'De outra conta'),
  ])
  ana = a.id
  bruno = b.id
  doOutro = c.id

  const q = await criarQuadro(clienteId, `${marca} comercial`)
  if (q.ok) quadroId = q.id
  const q2 = await criarQuadro(clienteId, `${marca} suporte`)
  if (q2.ok) outroQuadroId = q2.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (outroId) await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('o quadro nasce vivo', () => {
  it('vem com as três etapas neutras, na ordem', async () => {
    // Quadro vazio abre morto: três cliques separam a pessoa de qualquer coisa.
    const quadro = await acharQuadro(clienteId, quadroId)
    expect(quadro?.etapas.map((e) => e.nome)).toEqual([...ETAPAS_INICIAIS])
  })

  it('recusa nome repetido na mesma conta', async () => {
    const r = await criarQuadro(clienteId, `  ${marca} COMERCIAL `)
    expect(r).toEqual({ ok: false, motivo: 'já existe um quadro com este nome' })
  })

  it('o mesmo nome em outra conta é outro quadro', async () => {
    expect((await criarQuadro(outroId, `${marca} comercial`)).ok).toBe(true)
  })

  it('não acha quadro de outra conta pelo id dele', async () => {
    expect(await acharQuadro(outroId, quadroId)).toBeNull()
    expect(await apagarQuadro(outroId, quadroId)).toBe(false)
  })
})

describe.skipIf(!temCredencial)('etapas', () => {
  it('a nova entra no fim e renomear não a move', async () => {
    expect(await criarEtapa(clienteId, quadroId, 'Perdido')).toEqual({ ok: true })

    let quadro = (await acharQuadro(clienteId, quadroId))!
    expect(quadro.etapas.at(-1)!.nome).toBe('Perdido')

    const alvo = quadro.etapas.at(-1)!
    expect(await renomearEtapa(clienteId, quadroId, alvo.id, 'Sem interesse')).toEqual({ ok: true })

    quadro = (await acharQuadro(clienteId, quadroId))!
    expect(quadro.etapas.at(-1)!.nome).toBe('Sem interesse')
  })

  it('recusa nome repetido de etapa', async () => {
    expect(await criarEtapa(clienteId, quadroId, 'novo')).toEqual({
      ok: false,
      motivo: 'já existe uma etapa com este nome',
    })
  })

  it('mover para o lado troca só as duas, e a ponta não move', async () => {
    const antes = (await acharQuadro(clienteId, quadroId))!.etapas
    const segunda = antes[1]!

    expect(await moverEtapa(clienteId, quadroId, segunda.id, 'esquerda')).toBe(true)

    const depois = (await acharQuadro(clienteId, quadroId))!.etapas
    expect(depois[0]!.id).toBe(segunda.id)
    expect(depois[1]!.id).toBe(antes[0]!.id)
    // As outras não foram tocadas.
    expect(depois.slice(2).map((e) => e.id)).toEqual(antes.slice(2).map((e) => e.id))

    expect(await moverEtapa(clienteId, quadroId, depois[0]!.id, 'esquerda')).toBe(false)
  })

  it('não mexe em etapa de quadro de outra conta', async () => {
    const etapa = (await acharQuadro(clienteId, quadroId))!.etapas[0]!
    expect(await renomearEtapa(outroId, quadroId, etapa.id, 'roubada')).toEqual({
      ok: false,
      motivo: 'esta etapa não existe mais',
    })
    expect(await moverEtapa(outroId, quadroId, etapa.id, 'direita')).toBe(false)
  })
})

describe.skipIf(!temCredencial)('cartões', () => {
  it('põe em lote, ignora contato de outra conta, e não move quem já está', async () => {
    const r = await porNoQuadro(clienteId, quadroId, [ana, bruno, doOutro])
    expect(r).toEqual({ ok: true, postos: 2 })

    const primeira = (await acharQuadro(clienteId, quadroId))!.etapas[0]!
    const cartoes = await listarCartoes(clienteId, quadroId)
    expect(cartoes).toHaveLength(2)
    expect(cartoes.every((c) => c.colunaId === primeira.id)).toBe(true)
    expect(cartoes.map((c) => c.nome).sort()).toEqual(['Ana', 'Bruno'])
  })

  it('mover para uma etapa e pôr de novo não devolve ninguém para a primeira', async () => {
    const quadro = (await acharQuadro(clienteId, quadroId))!
    const destino = quadro.etapas[2]!
    const cartaoDaAna = (await listarCartoes(clienteId, quadroId)).find((c) => c.contatoId === ana)!

    expect(await moverCartao(clienteId, cartaoDaAna.id, destino.id)).toEqual({ ok: true })

    // O ponto do `ignoreDuplicates`: quem selecionou trinta sem lembrar quais já
    // estavam lá não pode desfazer o trabalho de quem os arrastou até o fim.
    expect(await porNoQuadro(clienteId, quadroId, [ana, bruno])).toEqual({ ok: true, postos: 0 })

    const depois = (await listarCartoes(clienteId, quadroId)).find((c) => c.contatoId === ana)!
    expect(depois.colunaId).toBe(destino.id)
  })

  /*
   * O evento existia na 0058, `comoFrase` sabia escrevê-lo, e **ninguém o
   * emitia** — a aba de histórico dizia "Nada registrado ainda" depois de o time
   * arrastar cartão o dia inteiro. Este teste é o que impede isso de voltar.
   */
  it('mover grava a mudança de etapa na linha do tempo, com os dois nomes', async () => {
    const quadro = (await acharQuadro(clienteId, quadroId))!
    const origem = quadro.etapas[0]!
    const destino = quadro.etapas[1]!
    const cartao = (await listarCartoes(clienteId, quadroId)).find((c) => c.contatoId === bruno)!

    expect(cartao.colunaId).toBe(origem.id)
    expect(await moverCartao(clienteId, cartao.id, destino.id, 'Ana')).toEqual({ ok: true })

    const evento = (await linhaDoTempo(clienteId, bruno)).find((e) => e.tipo === 'mudou-de-etapa')
    expect(evento).toBeDefined()
    // Os **nomes**, e não os ids: a linha do tempo é para ler, não para casar.
    expect(evento!.dados).toMatchObject({ de: origem.nome, para: destino.nome })
    expect(evento!.autor).toBe('Ana')
  })

  it('voltar para a mesma etapa não vira evento', async () => {
    const destino = (await acharQuadro(clienteId, quadroId))!.etapas[1]!
    const cartao = (await listarCartoes(clienteId, quadroId)).find((c) => c.contatoId === bruno)!
    expect(cartao.colunaId).toBe(destino.id)

    const antes = (await linhaDoTempo(clienteId, bruno)).filter((e) => e.tipo === 'mudou-de-etapa')
    expect((await moverCartao(clienteId, cartao.id, destino.id)).ok).toBe(true)
    const depois = (await linhaDoTempo(clienteId, bruno)).filter((e) => e.tipo === 'mudou-de-etapa')

    // Arrastar de volta para onde já estava é engano de mão — o mesmo motivo
    // pelo qual a função do banco não reinicia o relógio da etapa.
    expect(depois).toHaveLength(antes.length)
  })

  it('não move para a etapa de outro quadro', async () => {
    // O id da etapa chega da tela. Sem a conferência dentro da função do banco,
    // isto tiraria o cartão do próprio funil.
    const etapaDoOutro = (await acharQuadro(clienteId, outroQuadroId))!.etapas[0]!
    const cartao = (await listarCartoes(clienteId, quadroId))[0]!

    const r = await moverCartao(clienteId, cartao.id, etapaDoOutro.id)
    expect(r.ok).toBe(false)
  })

  it('não move cartão de outra conta', async () => {
    const cartao = (await listarCartoes(clienteId, quadroId))[0]!
    const etapa = (await acharQuadro(clienteId, quadroId))!.etapas[1]!
    expect((await moverCartao(outroId, cartao.id, etapa.id)).ok).toBe(false)
  })

  it('a mesma pessoa entra em quadros diferentes, cada um na sua etapa', async () => {
    expect(await porNoQuadro(clienteId, outroQuadroId, [ana])).toEqual({ ok: true, postos: 1 })

    const posicoes = await quadrosDoContato(clienteId, ana)
    expect(posicoes).toHaveLength(2)
    expect(posicoes.map((p) => p.quadro).sort()).toEqual(
      [`${marca} comercial`, `${marca} suporte`].sort(),
    )
  })

  /*
   * Os ids são o que deixa a conversa mover o cartão sem sair da tela. Nome não
   * serve: dois quadros podem ter etapa "Fechado", e casar por texto moveria o
   * cartão do funil errado.
   */
  it('devolve os ids, e eles são os que `moverCartao` aceita', async () => {
    const posicao = (await quadrosDoContato(clienteId, ana)).find(
      (p) => p.quadroId === quadroId,
    )!
    expect(posicao).toBeDefined()

    const destino = (await acharQuadro(clienteId, quadroId))!.etapas[1]!
    expect(posicao.etapaId).not.toBe(destino.id)

    // O cartaoId que veio daqui move de verdade — a prova de que é o id certo.
    expect((await moverCartao(clienteId, posicao.cartaoId, destino.id)).ok).toBe(true)

    const depois = (await quadrosDoContato(clienteId, ana)).find(
      (p) => p.quadroId === quadroId,
    )!
    expect(depois.etapaId).toBe(destino.id)
    expect(depois.etapa).toBe(destino.nome)
    // O cartão é o mesmo; o que mudou foi a etapa dele.
    expect(depois.cartaoId).toBe(posicao.cartaoId)
  })

  it('tirar do quadro não apaga o contato', async () => {
    const cartao = (await listarCartoes(clienteId, outroQuadroId))[0]!
    expect(await tirarDoQuadro(clienteId, cartao.id)).toBe(true)
    expect(await listarCartoes(clienteId, outroQuadroId)).toHaveLength(0)

    // A pessoa continua existindo — é a diferença entre tirar do funil e apagar.
    const { data } = await db().from('contacts').select('id').eq('id', ana).maybeSingle()
    expect(data).not.toBeNull()
  })
})

describe.skipIf(!temCredencial)('apagar', () => {
  it('recusa etapa com gente dentro, e diz quantos são', async () => {
    const cartao = (await listarCartoes(clienteId, quadroId))[0]!
    const r = await apagarEtapa(clienteId, quadroId, cartao.colunaId)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toMatch(/contato\(s\) estão nesta etapa/)
  })

  it('apaga etapa vazia', async () => {
    const quadro = (await acharQuadro(clienteId, quadroId))!
    const cartoes = await listarCartoes(clienteId, quadroId)
    const ocupadas = new Set(cartoes.map((c) => c.colunaId))
    const vazia = quadro.etapas.find((etapa) => !ocupadas.has(etapa.id))!

    expect(await apagarEtapa(clienteId, quadroId, vazia.id)).toEqual({ ok: true })
  })

  it('apagar o quadro leva as etapas e os cartões, e nenhum contato', async () => {
    expect(await apagarQuadro(clienteId, quadroId)).toBe(true)
    expect((await listarQuadros(clienteId)).some((q) => q.id === quadroId)).toBe(false)

    const { data } = await db().from('contacts').select('id').eq('id', bruno).maybeSingle()
    expect(data).not.toBeNull()
  })
})

/**
 * O quadro padrão (0043), sob a política de entrada da conta (0075).
 *
 * O que só o Postgres prova aqui é o índice parcial: várias linhas `false`
 * convivendo e só a marcada colidindo. Um teste de unidade com repo falso
 * acharia que `unique (client_id, padrao)` serviria — e ele proibiria dois
 * quadros comuns na mesma conta, que é o caso normal.
 *
 * **Os blocos abaixo declaram a política, e isso é a mudança da F3.** Antes da
 * 0075 `acharQuadroPadrao` decidia sozinha e caía no quadro mais antigo, contra
 * a RB-12. Agora quem decide é a conta, e conta nova nasce em `nao_criar`: sem a
 * declaração explícita, a resposta certa passa a ser `null`.
 */
describe.skipIf(!temCredencial)('quadro padrão', () => {
  let umId = ''
  let outroDaMesmaContaId = ''

  /**
   * A regra nova, e a razão de a 0075 existir: conta nova não põe ninguém em
   * quadro nenhum, nem mesmo tendo quadros. É a RB-12 ("Configuração inicial de
   * empresa nova é não criar"), e é o teste que falharia se alguém trouxesse o
   * fallback de volta como default.
   */
  it('conta nova não cria cartão sozinha, mesmo com quadros (RB-12)', async () => {
    expect(await politicaDeEntrada(clienteId)).toBe('nao_criar')
    expect(await acharQuadroPadrao(clienteId)).toBeNull()
  })

  /**
   * E com `quadro_marcado` sem marcação, também não: a conta disse "só onde eu
   * escolher", e não escolheu. `null` aqui é obediência, não falha.
   */
  it('quadro_marcado sem marcação não cai no mais antigo', async () => {
    expect(await definirEntradaNoFunil(clienteId, 'quadro_marcado')).toEqual({ ok: true })
    await definirQuadroPadrao(clienteId, null)
    expect(await acharQuadroPadrao(clienteId)).toBeNull()
  })

  it('política inexistente é recusada com motivo', async () => {
    const r = await definirEntradaNoFunil(clienteId, 'qualquer_coisa' as never)
    expect(r.ok).toBe(false)
  })

  beforeAll(async () => {
    if (!temCredencial) return
    /*
     * Em série, e não em `Promise.all`: agora que "o mais antigo recebe" é
     * regra, os dois quadros precisam ter `criado_em` distinto. Criados juntos,
     * o relógio empata e o desempate vira sorteio — o teste passaria ou não
     * conforme a ordem que o Postgres devolvesse.
     */
    const um = await criarQuadro(clienteId, `${marca} padrao a`)
    const dois = await criarQuadro(clienteId, `${marca} padrao b`)
    umId = um.ok ? um.id : ''
    outroDaMesmaContaId = dois.ok ? dois.id : ''
  })

  /*
   * A regra mudou, e mudou porque a anterior entregou o recurso desligado: com
   * cinco quadros em produção, nenhum estava marcado, e lead nenhum entrava em
   * quadro nenhum. Do lado de fora isso é indistinguível de recurso quebrado.
   *
   * O alvo é o **primeiro da conta**, e esta conta já tinha quadros criados
   * pelos blocos acima — por isso a expectativa sai de `listarQuadros`, que
   * ordena por `criado_em`, e não do quadro que este bloco criou. Fixar o id
   * daqui seria fixar uma coincidência de ordem de execução.
   */
  /*
   * O legado, preservado nominalmente. A conta precisa **pedir** `mais_antigo`
   * agora; a 0075 escreveu esse valor em quem já existia justamente para que
   * ninguém perdesse automação por causa de uma migration.
   */
  it('em mais_antigo, sem marcação nenhuma, quem recebe é o mais antigo', async () => {
    expect(await definirEntradaNoFunil(clienteId, 'mais_antigo')).toEqual({ ok: true })
    await definirQuadroPadrao(clienteId, null)
    const [maisAntigo] = await listarQuadros(clienteId)
    expect(maisAntigo).toBeDefined()
    expect(await acharQuadroPadrao(clienteId)).toBe(maisAntigo!.id)
  })

  it('marcar um quadro faz `acharQuadroPadrao` devolver ele', async () => {
    expect(await definirEntradaNoFunil(clienteId, 'quadro_marcado')).toEqual({ ok: true })
    expect(await definirQuadroPadrao(clienteId, umId)).toEqual({ ok: true })
    expect(await acharQuadroPadrao(clienteId)).toBe(umId)
  })

  it('marcar o segundo desmarca o primeiro — nunca dois padrões na mesma conta', async () => {
    expect(await definirQuadroPadrao(clienteId, outroDaMesmaContaId)).toEqual({ ok: true })
    expect(await acharQuadroPadrao(clienteId)).toBe(outroDaMesmaContaId)

    // O índice parcial é a garantia real; a consulta confirma que ela valeu.
    const { data } = await db()
      .from('quadros')
      .select('id')
      .eq('client_id', clienteId)
      .eq('padrao', true)
    expect(data).toHaveLength(1)
  })

  it('em mais_antigo, desmarcar não desliga a automação', async () => {
    expect(await definirEntradaNoFunil(clienteId, 'mais_antigo')).toEqual({ ok: true })
    expect(await definirQuadroPadrao(clienteId, null)).toEqual({ ok: true })
    const [maisAntigo] = await listarQuadros(clienteId)
    expect(await acharQuadroPadrao(clienteId)).toBe(maisAntigo!.id)
  })

  // A marcação escolhe o destino, e por isso ela tem que vencer a idade.
  it('mesmo em mais_antigo, o quadro marcado vence a idade', async () => {
    expect(await definirEntradaNoFunil(clienteId, 'mais_antigo')).toEqual({ ok: true })
    expect(await definirQuadroPadrao(clienteId, outroDaMesmaContaId)).toEqual({ ok: true })
    expect(await acharQuadroPadrao(clienteId)).toBe(outroDaMesmaContaId)
  })

  // O único caso em que não há mesmo o que fazer, e ele tem que seguir mudo.
  it('conta sem quadro nenhum devolve null, e isso não é erro', async () => {
    const vazio = await criarCliente(`${marca} sem quadro`)
    try {
      // Mesmo pedindo o legado: não há quadro para ser o mais antigo.
      await definirEntradaNoFunil(vazio.id, 'mais_antigo')
      expect(await acharQuadroPadrao(vazio.id)).toBeNull()
    } finally {
      /*
       * Apaga aqui, e não num `afterAll`: este é o único cliente que o bloco
       * cria, e a produção já carrega doze contas `zz-` de suítes que
       * esqueceram de limpar. Os testes rodam contra o banco de produção — o
       * que não se apaga fica.
       */
      await db().from('clients').delete().eq('id', vazio.id)
    }
  })

  it('o padrão é por conta: o de um cliente não vaza para o outro', async () => {
    const alheio = await criarQuadro(outroId, `${marca} padrao alheio`)
    expect(alheio.ok).toBe(true)
    if (!alheio.ok) return

    expect(await definirEntradaNoFunil(outroId, 'quadro_marcado')).toEqual({ ok: true })
    expect(await definirEntradaNoFunil(clienteId, 'quadro_marcado')).toEqual({ ok: true })
    expect(await definirQuadroPadrao(outroId, alheio.id)).toEqual({ ok: true })
    expect(await definirQuadroPadrao(clienteId, umId)).toEqual({ ok: true })

    // Os dois convivem porque o índice é por `client_id`.
    expect(await acharQuadroPadrao(outroId)).toBe(alheio.id)
    expect(await acharQuadroPadrao(clienteId)).toBe(umId)

    /*
     * E a política também é por conta. `service_role` ignora RLS: quem isola é
     * o `client_id` de cada consulta, e é isso que este par prova.
     */
    expect(await definirEntradaNoFunil(outroId, 'nao_criar')).toEqual({ ok: true })
    expect(await politicaDeEntrada(outroId)).toBe('nao_criar')
    expect(await politicaDeEntrada(clienteId)).toBe('quadro_marcado')
  })

  it('não marca quadro de outra conta pelo id', async () => {
    const r = await definirQuadroPadrao(outroId, umId)
    expect(r.ok).toBe(false)
  })

  it('`listarQuadros` traz a marcação, que é o que a tela desenha', async () => {
    const quadros = await listarQuadros(clienteId)
    expect(quadros.filter((q) => q.padrao).map((q) => q.id)).toEqual([umId])
  })
})
