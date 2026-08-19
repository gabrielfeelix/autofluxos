import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { autenticacao } from '../auth'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato, registrarEntrada, registrarSaida } from './conversas'
import { marcarComoLida, naoLidasPorContato } from './leituras'

/**
 * O contador de não lidas (0023 + a função da 0025).
 *
 * **É por pessoa, e o piso é a criação dela.** As duas coisas erradas aqui são
 * caladas: contar por conversa faria a insígnia dizer "alguém não leu", que não
 * ajuda ninguém a decidir o que abrir; contar desde o começo dos tempos faria a
 * primeira pessoa da equipe abrir o Inbox com tudo em vermelho, inclusive
 * conversas de antes de ela existir.
 *
 * Precisa das duas credenciais: `DATABASE_URL` para criar o usuário (as tabelas
 * do login ficam fora da Data API) e a do Supabase para o resto.
 */
const temTudo = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
)

const marca = `zz-lida-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')
const telefone = (i: number) => `5511${seed}${i.toString().padStart(2, '0')}`
const email = `${marca}@exemplo.test`

let clienteId = ''
let usuarioId = ''
let contatoId = ''

beforeAll(async () => {
  if (!temTudo) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const criado = await autenticacao().api.signUpEmail({
    body: { email, password: 'senha-comprida-de-teste', name: 'Quem lê' },
  })
  usuarioId = criado.user.id

  const contato = await acharOuCriarContato(clienteId, telefone(1), 'Ana')
  contatoId = contato.id
})

afterAll(async () => {
  if (!temTudo) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (usuarioId) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    await pool.query('delete from public.af_usuarios where email = $1', [email])
    await pool.end()
  }
})

describe.skipIf(!temTudo)('quantas não lidas', () => {
  it('sem usuário não conta nada — a senha única não tem de quem contar', async () => {
    expect(await naoLidasPorContato(null, [contatoId])).toEqual(new Map())
  })

  it('conta as entradas e ignora o que o bot mandou', async () => {
    await registrarEntrada({
      contatoId,
      sessaoId: null,
      waMessageId: `wamid-${marca}-1`,
      texto: 'oi',
      payload: {},
    })
    await registrarEntrada({
      contatoId,
      sessaoId: null,
      waMessageId: `wamid-${marca}-2`,
      texto: 'alguém aí?',
      payload: {},
    })
    // Saída nossa não é "não lida": ninguém precisa ler o que o próprio time
    // mandou.
    await registrarSaida({ contatoId, sessaoId: null, texto: 'já respondo' })

    expect((await naoLidasPorContato(usuarioId, [contatoId])).get(contatoId)).toBe(2)
  })

  it('abrir a conversa zera, e a próxima entrada volta a contar', async () => {
    await marcarComoLida(usuarioId, contatoId)
    expect((await naoLidasPorContato(usuarioId, [contatoId])).get(contatoId)).toBeUndefined()

    await registrarEntrada({
      contatoId,
      sessaoId: null,
      waMessageId: `wamid-${marca}-3`,
      texto: 'voltei',
      payload: {},
    })
    expect((await naoLidasPorContato(usuarioId, [contatoId])).get(contatoId)).toBe(1)
  })

  it('marcar duas vezes seguidas não estoura — a tela pode renderizar duas vezes', async () => {
    await marcarComoLida(usuarioId, contatoId)
    await marcarComoLida(usuarioId, contatoId)
    expect((await naoLidasPorContato(usuarioId, [contatoId])).get(contatoId)).toBeUndefined()
  })

  it('não conta o que chegou antes de a pessoa existir', async () => {
    const outro = await acharOuCriarContato(clienteId, telefone(2), 'Bruno')
    await registrarEntrada({
      contatoId: outro.id,
      sessaoId: null,
      waMessageId: `wamid-${marca}-4`,
      texto: 'mensagem antiga',
      payload: {},
    })

    // Envelhece a entrada para antes do cadastro de quem está olhando. Sem o
    // piso, a primeira pessoa da equipe abriria o Inbox com meses de histórico
    // em vermelho — histórico que ela não deixou de ler, porque não estava lá.
    await db()
      .from('messages')
      .update({ ts: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('wa_message_id', `wamid-${marca}-4`)

    expect((await naoLidasPorContato(usuarioId, [outro.id])).get(outro.id)).toBeUndefined()
  })
})
