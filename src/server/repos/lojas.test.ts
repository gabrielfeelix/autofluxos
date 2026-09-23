import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { apagarConexao, criarConexao, listarConexoes, listarConexoesParaFluxos } from './conexoes'
import { desligarEstoqueExato, ligarEstoqueExato, ligarLoja, lojaDaConta, salvarLoja } from './lojas'

/**
 * A loja da conta contra o banco de verdade (0092).
 *
 * O que só aparece contra o Postgres:
 *
 *  - salvar de novo atualiza a mesma linha (upsert por conta e plataforma);
 *  - conta não vê loja de conta;
 *  - desligar não apaga a linha, e o endereço fica para religar;
 *  - o check da 0092 recusa estoque exato sem token, direto no banco.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-loja-${Math.random().toString(36).slice(2, 8)}`

let clienteId = ''
let outroId = ''

beforeAll(async () => {
  if (!temCredencial) return
  const [cliente, outro] = await Promise.all([criarCliente(`${marca} cliente`), criarCliente(`${marca} outro`)])
  clienteId = cliente.id
  outroId = outro.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (outroId) await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('loja da conta', () => {
  it('conta sem loja devolve null e não liga', async () => {
    expect(await lojaDaConta(clienteId)).toBeNull()
    expect(await ligarLoja(clienteId, true)).toEqual({ ok: false, motivo: 'configure e teste a loja antes de ligar' })
  })

  it('salva, nasce desligada e carimba a verificação', async () => {
    const loja = await salvarLoja(clienteId, { endereco: 'https://loja.exemplo.com.br', codigoDaLoja: 'default', sufixo: '' })
    expect(loja.ativa).toBe(false)
    expect(loja.sufixo).toBe('')
    expect(loja.verificadaEm).not.toBeNull()
    expect(loja.estoqueExato).toBe('desligado')
  })

  it('salvar de novo atualiza a mesma linha', async () => {
    const antes = await lojaDaConta(clienteId)
    const depois = await salvarLoja(clienteId, { endereco: 'https://nova.exemplo.com.br', codigoDaLoja: null, sufixo: '.html' })
    expect(depois.id).toBe(antes!.id)
    expect(depois.endereco).toBe('https://nova.exemplo.com.br')
  })

  it('liga, desliga e a linha continua lá', async () => {
    expect(await ligarLoja(clienteId, true)).toEqual({ ok: true })
    expect((await lojaDaConta(clienteId))!.ativa).toBe(true)
    expect(await ligarLoja(clienteId, false)).toEqual({ ok: true })
    const loja = await lojaDaConta(clienteId)
    expect(loja!.ativa).toBe(false)
    expect(loja!.endereco).toBe('https://nova.exemplo.com.br')
  })

  it('conta não vê loja de conta', async () => {
    expect(await lojaDaConta(outroId)).toBeNull()
  })

  it('o banco recusa estoque exato sem token', async () => {
    const { error } = await db()
      .from('lojas_integradas')
      .update({ estoque_exato: 'msi' })
      .eq('client_id', clienteId)
    expect(error?.code).toBe('23514')
  })

  it('desligar o estoque exato sem token é inofensivo', async () => {
    expect(await desligarEstoqueExato(clienteId)).toEqual({ conexaoId: null })
    expect((await lojaDaConta(clienteId))!.estoqueExato).toBe('desligado')
  })

  // O token do Magento é uma Conexão comum, e aparece na tela de Chaves de
  // API. Apagar por lá não passa por `desconectarToken`: o `on delete set
  // null` da 0092 esbarrava no check `lojas_estoque_exige_token` e o delete
  // inteiro falhava.
  it('apagar a Conexão do token pela tela de Chaves desliga o estoque exato', async () => {
    const conexao = await criarConexao({ clienteId, nome: 'Magento (somente leitura)', tipo: 'bearer', valor: 'token-de-teste' })
    await ligarEstoqueExato(clienteId, { conexaoId: conexao.id, via: 'msi', estoqueId: 1 })

    await apagarConexao(conexao.id, clienteId)

    const loja = await lojaDaConta(clienteId)
    expect(loja!.estoqueExato).toBe('desligado')
    expect(loja!.conexaoId).toBeNull()
    expect(loja!.estoqueId).toBeNull()
    const { data } = await db().from('connections').select('id').eq('id', conexao.id)
    expect(data).toEqual([])
  })

  it('apagar Conexão de outra conta não mexe na loja desta', async () => {
    const conexao = await criarConexao({ clienteId, nome: 'Magento (somente leitura)', tipo: 'bearer', valor: 'token-de-teste' })
    await ligarEstoqueExato(clienteId, { conexaoId: conexao.id, via: 'msi', estoqueId: 1 })

    await expect(apagarConexao(conexao.id, outroId)).resolves.toBeUndefined()

    expect((await lojaDaConta(clienteId))!.estoqueExato).toBe('msi')
    await apagarConexao(conexao.id, clienteId)
  })

  it('o token da loja some da lista dos fluxos e continua na tela de Chaves', async () => {
    const comum = await criarConexao({ clienteId, nome: 'API da agenda', tipo: 'bearer', valor: 'outro-token' })
    const token = await criarConexao({ clienteId, nome: 'Magento (somente leitura)', tipo: 'bearer', valor: 'token-de-teste' })
    await ligarEstoqueExato(clienteId, { conexaoId: token.id, via: 'msi', estoqueId: 1 })

    expect((await listarConexoesParaFluxos(clienteId)).map((c) => c.id)).toEqual([comum.id])
    expect((await listarConexoes(clienteId)).map((c) => c.id)).toContain(token.id)

    await apagarConexao(token.id, clienteId)
    await apagarConexao(comum.id, clienteId)
  })
})
