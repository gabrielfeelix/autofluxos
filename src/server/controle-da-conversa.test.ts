import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { aindaAutorizada } from '@/core/controle-da-conversa'
import { db } from './db'
import { criarCliente } from './repos/clientes'
import {
  acharOuCriarContato,
  assumirAtendimento,
  revisaoDoControle,
  trocarControle,
} from './repos/conversas'

/**
 * A corrida por uma conversa, contra o banco de verdade.
 *
 * ---------------------------------------------------------------------------
 * Por que isto não pode ser teste de unidade
 * ---------------------------------------------------------------------------
 *
 * `core/controle-da-conversa.test.ts` cobre a decisão, e a decisão está certa
 * desde sempre. O defeito nunca esteve lá: `atribuirContato` era um `update`
 * sem condição, e **ler antes de gravar não conserta** — entre o `select` que
 * diz "está livre" e o `update` que grava cabe o clique do colega.
 *
 * Só o Postgres prova que a condição no `where` fecha a corrida. Um repo falso
 * executaria as duas tomadas em sequência, as duas veriam o estado que o mock
 * tem naquele instante, e o teste passaria verde com o defeito inteiro no lugar.
 *
 * É a RB-14: "apenas um assume a versão atual; o outro vê quem assumiu".
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-t32-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let outroClienteId = ''
let ana = ''
let bruno = ''

async function criarUsuario(nome: string): Promise<string> {
  const id = crypto.randomUUID()
  const { error } = await db().from('af_usuarios').insert({
    id,
    name: `${marca} ${nome}`,
    email: `${marca}-${nome}@exemplo.test`,
    emailVerified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  if (error) throw new Error(`não deu para criar o usuário: ${error.message}`)
  return id
}

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
  outroClienteId = (await criarCliente(`${marca} vizinho`)).id
  ana = await criarUsuario('ana')
  bruno = await criarUsuario('bruno')
})

afterAll(async () => {
  if (!temCredencial || clienteId === '') return
  await db().from('clients').delete().in('id', [clienteId, outroClienteId])
  await db().from('af_usuarios').delete().in('id', [ana, bruno])
})

/** Um contato novo, sem dono, para cada cenário. */
async function contatoLivre(sufixo: string): Promise<string> {
  const contato = await acharOuCriarContato(clienteId, `5511${seed}${sufixo}`, `Contato ${sufixo}`)
  return contato.id
}

describe.skipIf(!temCredencial)('a tomada do atendimento', () => {
  it('quem chega primeiro assume, e a revisão sobe', async () => {
    const contato = await contatoLivre('01')
    const antes = await revisaoDoControle(clienteId, contato)

    const tomada = await assumirAtendimento(clienteId, contato, ana)
    expect(tomada.ok).toBe(true)
    if (!tomada.ok) return
    expect(tomada.revisao).toBe((antes ?? 0) + 1)
  })

  /**
   * **O teste que justifica a migration.** Duas tomadas disparadas juntas, sem
   * `await` entre elas: é o que dois atendentes clicando ao mesmo tempo produz,
   * dois pedidos HTTP concorrentes no mesmo instante.
   *
   * Antes da 0076 as duas respondiam sucesso e a última gravação vencia. Agora
   * exatamente uma ganha, e a que perde diz de quem é a conversa.
   */
  it('duas tomadas simultâneas: só uma ganha (RB-14)', async () => {
    const contato = await contatoLivre('02')

    const [daAna, doBruno] = await Promise.all([
      assumirAtendimento(clienteId, contato, ana),
      assumirAtendimento(clienteId, contato, bruno),
    ])

    const ganhos = [daAna, doBruno].filter((r) => r.ok)
    expect(ganhos).toHaveLength(1)

    const perdida = [daAna, doBruno].find((r) => !r.ok)
    expect(perdida).toBeDefined()
    if (!perdida || perdida.ok) return
    expect(perdida.motivo).toBe('ja_assumida')

    /*
     * E quem perdeu sabe de quem é. Sem isto a tela diria "não deu", e a
     * pessoa não teria como decidir se pede transferência.
     */
    const vencedor = daAna.ok ? ana : bruno
    expect(perdida.responsavelId).toBe(vencedor)

    // E o banco concorda com quem ganhou: não sobrou estado dividido.
    const { data } = await db().from('contacts').select('atribuido_a').eq('id', contato).single()
    expect((data as { atribuido_a: string }).atribuido_a).toBe(vencedor)
  })

  /**
   * Clicar de novo no que já é seu não sobe a revisão. Se subisse, o segundo
   * clique invalidaria a execução em andamento da própria pessoa.
   */
  it('assumir o que já é seu não mexe na revisão', async () => {
    const contato = await contatoLivre('03')
    const primeira = await assumirAtendimento(clienteId, contato, ana)
    expect(primeira.ok).toBe(true)
    if (!primeira.ok) return

    const segunda = await assumirAtendimento(clienteId, contato, ana)
    expect(segunda.ok).toBe(false)
    if (segunda.ok) return
    expect(segunda.motivo).toBe('ja_e_sua')

    expect(await revisaoDoControle(clienteId, contato)).toBe(primeira.revisao)
  })

  /**
   * `service_role` ignora RLS: quem isola conta de conta é o `client_id` de
   * cada consulta. Sem ele no `where`, um id de contato vazado assumiria a
   * conversa da conta vizinha.
   */
  it('não assume contato de outra conta pelo id', async () => {
    const contato = await contatoLivre('04')
    const r = await assumirAtendimento(outroClienteId, contato, ana)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toBe('nao_encontrado')

    // E não encostou no dado: a conversa segue sem dono.
    const { data } = await db().from('contacts').select('atribuido_a').eq('id', contato).single()
    expect((data as { atribuido_a: string | null }).atribuido_a).toBeNull()
  })
})

/**
 * RB-15: a resposta de IA que termina depois da tomada não pode sair.
 *
 * O cenário inteiro, do jeito que acontece: o bot anota a revisão, chama o
 * modelo, leva segundos, e nesse meio alguém assume. A conferência antes do
 * envio é o que impede o bot de falar por cima de quem pegou a conversa.
 */
describe.skipIf(!temCredencial)('a execução que ficou para trás', () => {
  it('a revisão anotada antes da tomada não autoriza mais o envio', async () => {
    const contato = await contatoLivre('05')

    // O bot anota a revisão e sai para chamar o modelo.
    const revisaoDaExecucao = await revisaoDoControle(clienteId, contato)
    expect(revisaoDaExecucao).not.toBeNull()

    // No meio da chamada, a Ana assume.
    expect((await assumirAtendimento(clienteId, contato, ana)).ok).toBe(true)

    // O modelo volta, e o envio é conferido.
    const agora = await revisaoDoControle(clienteId, contato)
    expect(
      aindaAutorizada({ conducao: 'bot', responsavelId: null, revisao: agora ?? -1 }, revisaoDaExecucao),
    ).toBe(false)
  })

  it('sem ninguém assumir no meio, o envio continua autorizado', async () => {
    const contato = await contatoLivre('06')
    const revisaoDaExecucao = await revisaoDoControle(clienteId, contato)
    const agora = await revisaoDoControle(clienteId, contato)

    expect(
      aindaAutorizada({ conducao: 'bot', responsavelId: null, revisao: agora ?? -1 }, revisaoDaExecucao),
    ).toBe(true)
  })

  /**
   * Devolver à fila também invalida, e é a RB-16 junto: a conversa perde o dono
   * e **não** volta para o bot por isso. Quem quiser o bot de volta usa
   * "Retomar chatbot", que é outra ação.
   */
  it('devolver à fila sobe a revisão e invalida a execução no ar', async () => {
    const contato = await contatoLivre('07')
    expect((await assumirAtendimento(clienteId, contato, ana)).ok).toBe(true)

    const revisaoDaExecucao = await revisaoDoControle(clienteId, contato)
    const depois = await trocarControle(clienteId, contato, null)
    expect(depois).toBe((revisaoDaExecucao ?? 0) + 1)

    expect(
      aindaAutorizada({ conducao: 'bot', responsavelId: null, revisao: depois ?? -1 }, revisaoDaExecucao),
    ).toBe(false)

    // Sem dono, e disponível de novo para quem quiser assumir.
    const { data } = await db().from('contacts').select('atribuido_a').eq('id', contato).single()
    expect((data as { atribuido_a: string | null }).atribuido_a).toBeNull()
    expect((await assumirAtendimento(clienteId, contato, bruno)).ok).toBe(true)
  })

  /**
   * Transferir **vence** um responsável existente, ao contrário de assumir: é
   * ação deliberada de quem tem permissão, não uma corrida.
   */
  it('transferir passa a conversa e sobe a revisão', async () => {
    const contato = await contatoLivre('08')
    expect((await assumirAtendimento(clienteId, contato, ana)).ok).toBe(true)
    const antes = await revisaoDoControle(clienteId, contato)

    const depois = await trocarControle(clienteId, contato, bruno)
    expect(depois).toBe((antes ?? 0) + 1)

    const { data } = await db().from('contacts').select('atribuido_a').eq('id', contato).single()
    expect((data as { atribuido_a: string }).atribuido_a).toBe(bruno)
  })

  it('trocar controle de contato de outra conta não faz nada', async () => {
    const contato = await contatoLivre('09')
    expect(await trocarControle(outroClienteId, contato, ana)).toBeNull()
  })
})
