import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dentroDaJanela, dentroDaPortaDeEntrada, permissaoDeEnvio } from '@/channels/janela'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { registrarPassagem } from './passagens'

/**
 * De onde sai a janela de 72h, e quem não deveria abri-la.
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo está provando
 * ---------------------------------------------------------------------------
 *
 * A Meta abre a janela gratuita de 72h para quem **clica num anúncio Click to
 * WhatsApp** ou no botão da Página: o clique manda a pessoa para a conversa, e
 * é a conversa que a janela autoriza. Um lead de **formulário** (Lead Ads) não
 * faz nada disso, ele entrega um telefone preenchido num formulário dentro do
 * Facebook, sem que a pessoa tenha escrito para o número nem aberto conversa
 * nenhuma.
 *
 * Até a 0074 os dois caminhos gravavam a mesma linha em `passagens`, e a view
 * da 0065 lia **qualquer** linha de lá como `porta_de_entrada_em`. Quer dizer:
 * um formulário concedia 72h de texto livre que a Meta não concedeu, e quem
 * respondesse confiando nisso escrevia, enviava e recebia
 * `(#131047) Re-engagement message`.
 *
 * É a RB-09 da proposta de 19/set: "formulário não é conversa... não abre
 * janela de conversa do WhatsApp por si só".
 *
 * A **0074** deu tipo à entrada e pôs o filtro na view. Este arquivo passou a
 * exigir o comportamento certo: a troca dos `expect` abaixo, de
 * `not.toBeNull()` para `toBeNull()`, é a prova de que o defeito fechou.
 *
 * O teste está no nível do banco, e não em `channels/janela.test.ts`, porque a
 * conta em TypeScript está certa: ela recebe `portaDeEntradaEm` e confia. O
 * defeito é a **procedência** desse campo, e isso só aparece contra a view.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-porta-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let doAnuncio = ''
let doFormulario = ''

/** O que a view devolve como porta de entrada para este contato. */
async function portaDaView(contatoId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('leads')
    .select('porta_de_entrada_em')
    .eq('contact_id', contatoId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as { porta_de_entrada_em: string | null } | null)?.porta_de_entrada_em ?? null
}

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const ana = await acharOuCriarContato(clienteId, `55119${seed}`, 'Ana do anúncio')
  const bruno = await acharOuCriarContato(clienteId, `55219${seed}`, 'Bruno do formulário')
  doAnuncio = ana.id
  doFormulario = bruno.id

  // A chegada por clique em anúncio: é esta que a Meta credita com as 72h.
  await registrarPassagem({
    clienteId,
    contatoId: doAnuncio,
    adId: '1200000000001',
    tipo: 'anuncio_whatsapp',
    titulo: 'Anúncio, Plano XYZ',
  })

  // A chegada por formulário, como `receber-lead-do-formulario.ts` grava.
  await registrarPassagem({
    clienteId,
    contatoId: doFormulario,
    adId: '1200000000002',
    tipo: 'formulario',
    idExterno: `lead-${seed}`,
    titulo: 'Formulário, Bruno',
  })
})

afterAll(async () => {
  if (!temCredencial || clienteId === '') return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('a porta de entrada das 72h', () => {
  it('o clique em anúncio abre a janela gratuita', async () => {
    const porta = await portaDaView(doAnuncio)
    expect(porta).not.toBeNull()
    expect(dentroDaPortaDeEntrada({ ultimaEntradaEm: null, portaDeEntradaEm: porta })).toBe(true)
  })

  /**
   * O defeito fechado. A linha de formulário continua em `passagens`, o lead
   * precisa saber de qual anúncio veio, e a view **não** a conta como porta.
   */
  it('o formulário não abre a janela (RB-09)', async () => {
    expect(await portaDaView(doFormulario)).toBeNull()

    // E a consequência que isso evita: nada de texto livre para quem nunca
    // mandou mensagem. Sem janela de 24h e sem porta, o compositor fica fechado
    // e a tela oferece modelo aprovado, que é o que a Meta aceita.
    expect(dentroDaJanela({ ultimaEntradaEm: null, portaDeEntradaEm: null })).toBe(false)
  })

  /**
   * E a linha continua lá, o que é a outra metade da RB-09: o formulário
   * **pode** criar contato e cartão, e a origem dele precisa aparecer na ficha.
   * Fechar a janela não é apagar a chegada.
   */
  it('a chegada por formulário continua registrada no histórico', async () => {
    const { data, error } = await db()
      .from('passagens')
      .select('tipo, chave_externa')
      .eq('contact_id', doFormulario)

    if (error) throw new Error(error.message)
    const linhas = (data ?? []) as { tipo: string; chave_externa: string | null }[]
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.tipo).toBe('formulario')
    expect(linhas[0]?.chave_externa).toBe(`formulario:lead-${seed}`)
  })

  /**
   * O botão da Página abre a porta igual ao anúncio. São dois tipos separados
   * porque a Meta os reporta diferente, e um dia o preço pode divergir.
   */
  it('o botão da Página abre a janela gratuita', async () => {
    const carla = await acharOuCriarContato(clienteId, `55419${seed}`, 'Carla do botão')
    await registrarPassagem({
      clienteId,
      contatoId: carla.id,
      adId: '1200000000003',
      tipo: 'botao_pagina',
      titulo: 'Botão da Página',
    })

    const porta = await portaDaView(carla.id)
    expect(porta).not.toBeNull()
    expect(dentroDaPortaDeEntrada({ ultimaEntradaEm: null, portaDeEntradaEm: porta })).toBe(true)
  })

  /**
   * A importação de histórico não abre nada. É a segunda metade da RB-09:
   * "importar contato também não simula mensagem recebida".
   */
  it('a importação não abre janela nenhuma', async () => {
    const davi = await acharOuCriarContato(clienteId, `55519${seed}`, 'Davi importado')
    await registrarPassagem({
      clienteId,
      contatoId: davi.id,
      adId: '1200000000004',
      tipo: 'importacao',
      titulo: 'Planilha de março',
    })

    expect(await portaDaView(davi.id)).toBeNull()
  })

  /**
   * A regra que o índice de minuto da 0050 não sabia aplicar: duas submissões
   * reais do mesmo formulário, no mesmo minuto, são **duas** entradas, e a
   * reentrega do mesmo evento é **uma**. Quem decide é a chave externa.
   */
  it('a chave externa separa submissão nova de reentrega (RB-10)', async () => {
    const elis = await acharOuCriarContato(clienteId, `55619${seed}`, 'Elis')
    const mesmoAnuncio = '1200000000005'

    // Duas submissões legítimas, no mesmo minuto, ids diferentes.
    await registrarPassagem({ clienteId, contatoId: elis.id, adId: mesmoAnuncio, tipo: 'formulario', idExterno: `a-${seed}` })
    await registrarPassagem({ clienteId, contatoId: elis.id, adId: mesmoAnuncio, tipo: 'formulario', idExterno: `b-${seed}` })

    // E a reentrega da primeira, que não pode virar uma terceira linha.
    await registrarPassagem({ clienteId, contatoId: elis.id, adId: mesmoAnuncio, tipo: 'formulario', idExterno: `a-${seed}` })

    const { data, error } = await db().from('passagens').select('chave_externa').eq('contact_id', elis.id)
    if (error) throw new Error(error.message)
    expect(data ?? []).toHaveLength(2)
  })

  /**
   * Nenhuma passagem, nenhuma janela. É o caso da maioria dos contatos, e é o
   * comportamento que precisa continuar valendo depois da correção.
   */
  it('quem não chegou por lugar nenhum não tem janela', async () => {
    const semPassagem = await acharOuCriarContato(clienteId, `55319${seed}`, 'Sem origem')
    expect(await portaDaView(semPassagem.id)).toBeNull()
    expect(dentroDaJanela({ ultimaEntradaEm: null, portaDeEntradaEm: null })).toBe(false)
  })
})

/**
 * A outra metade do caminho: a consulta que decide o envio.
 *
 * `contextoDeResposta` tem a **própria** consulta a `passagens`, separada da
 * view da 0065. Ela lia qualquer linha de lá, e corrigir só a view deixaria
 * metade do produto com a regra antiga: justamente a metade que o servidor
 * consulta no instante de enviar.
 *
 * O teste vai ao banco pela mesma consulta em vez de chamar
 * `contextoDeResposta`, porque aquela função devolve `null` sem canal ativo e
 * montar um canal aqui provaria a existência do canal, não o filtro de tipo. O
 * que precisa ser provado é o `in('tipo', ...)`, e é ele que está abaixo.
 */
describe.skipIf(!temCredencial)('a consulta de porta do envio', () => {
  /** A mesma consulta de `contextoDeResposta`, com o mesmo filtro. */
  async function portaDoEnvio(contatoId: string): Promise<string | null> {
    const { data, error } = await db()
      .from('passagens')
      .select('criado_em')
      .eq('contact_id', contatoId)
      .eq('client_id', clienteId)
      .in('tipo', ['anuncio_whatsapp', 'botao_pagina'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return (data as { criado_em: string } | null)?.criado_em ?? null
  }

  it('o formulário não entrega porta de entrada ao envio (RB-09)', async () => {
    const porta = await portaDoEnvio(doFormulario)
    expect(porta).toBeNull()

    /*
     * E a consequência no envio: sem janela de 24h (ela nunca escreveu) e sem
     * porta, o caminho é modelo aprovado, e o custo não é afirmado.
     */
    const permissao = permissaoDeEnvio({ ultimaEntradaEm: null, portaDeEntradaEm: porta })
    expect(permissao.textoLivre).toBe(false)
    expect(permissao.cobranca).toBe('desconhecido')
  })

  it('o clique em anúncio entrega a porta, e ela é gratuita', async () => {
    const porta = await portaDoEnvio(doAnuncio)
    expect(porta).not.toBeNull()

    /*
     * Ela clicou e não escreveu: texto livre não, gratuidade sim. É exatamente
     * o par que o defeito misturava, e que a T3.3 separou.
     */
    const permissao = permissaoDeEnvio({ ultimaEntradaEm: null, portaDeEntradaEm: porta })
    expect(permissao.textoLivre).toBe(false)
    expect(permissao.cobranca).toBe('gratuita')
  })
})
