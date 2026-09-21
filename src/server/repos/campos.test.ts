import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ValorDeCampo } from '@/core/campos'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato, guardarCampo } from './conversas'
import {
  arquivarCampo,
  camposDoContato,
  definicoesDeCampo,
  definirCampo,
  gravarCampos,
} from './campos'

/**
 * A escrita campo a campo, contra o banco de verdade.
 *
 * ---------------------------------------------------------------------------
 * O que só o Postgres prova aqui
 * ---------------------------------------------------------------------------
 *
 * `core/campos.test.ts` cobre a precedência, exaustivamente e sem fixture. O
 * defeito nunca esteve na decisão: `guardarCampo` fazia
 * `update contacts set campos = $1` com o mapa **inteiro**, e duas escritas a
 * campos diferentes perdiam uma.
 *
 * Ler, mesclar e gravar em TypeScript não conserta, e é isso que um teste de
 * unidade não mostra: um repo falso executaria as duas escritas em sequência,
 * as duas veriam o estado que o mock tem naquele instante, e o teste passaria
 * verde com o defeito inteiro no lugar. O primeiro bloco abaixo dispara as duas
 * em `Promise.all`, que é o que o produto faz.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-t41-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let outroClienteId = ''

const valor = (
  v: string,
  origem: ValorDeCampo['origem'],
  em = new Date().toISOString(),
): ValorDeCampo => ({ valor: v, origem, autorId: null, em })

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
  outroClienteId = (await criarCliente(`${marca} vizinho`)).id
})

afterAll(async () => {
  if (!temCredencial || clienteId === '') return
  await db().from('clients').delete().in('id', [clienteId, outroClienteId])
})

async function contatoNovo(sufixo: string): Promise<string> {
  const contato = await acharOuCriarContato(clienteId, `5511${seed}${sufixo}`, `Contato ${sufixo}`)
  return contato.id
}

describe.skipIf(!temCredencial)('a escrita campo a campo', () => {
  /**
   * **O teste que justifica a migration, e ele vai direto ao RPC.**
   *
   * A garantia que a 0077 acrescenta é que a escrita **mescla** em vez de
   * substituir: um lote que traz `interesse` não apaga o `cidade` que já
   * estava lá. Chamar `gravarCampos` duas vezes em `Promise.all` não prova
   * isso de forma confiável, ele lê e mescla em TypeScript antes de chamar o
   * RPC, então o resultado depende de como as duas leituras se intercalam, e o
   * teste passa por sorte mesmo com a trava removida. Foi conferido.
   *
   * Então o teste chama `gravar_campos` direto, com um lote parcial, que é
   * exatamente a operação cuja atomicidade a migration garante.
   */
  it('o lote parcial não apaga os campos que ele não traz (RB-19)', async () => {
    const contato = await contatoNovo('01')
    await gravarCampos(clienteId, contato, { cidade: valor('Maringá', 'contato') })

    // Um lote que só conhece `interesse`. Antes da 0077, `campos` era
    // substituído por ele e `cidade` sumia.
    const { error } = await db().rpc('gravar_campos', {
      p_client_id: clienteId,
      p_contact_id: contato,
      p_valores: { interesse: 'Plano XYZ' },
      p_meta: { interesse: { origem: 'contato', autor_id: null, em: new Date().toISOString() } },
    })
    expect(error).toBeNull()

    const campos = await camposDoContato(clienteId, contato)
    expect(campos?.cidade?.valor).toBe('Maringá')
    expect(campos?.interesse?.valor).toBe('Plano XYZ')
  })

  /**
   * E a trava, que é a outra metade: duas chamadas ao RPC disparadas juntas,
   * cada uma com o seu campo. Sem `for update`, as duas leem o mesmo estado e
   * uma sobrescreve a outra.
   */
  it('duas gravações simultâneas a campos diferentes convivem', async () => {
    const contato = await contatoNovo('01b')
    const agora = new Date().toISOString()

    await Promise.all([
      db().rpc('gravar_campos', {
        p_client_id: clienteId,
        p_contact_id: contato,
        p_valores: { cidade: 'Maringá' },
        p_meta: { cidade: { origem: 'contato', autor_id: null, em: agora } },
      }),
      db().rpc('gravar_campos', {
        p_client_id: clienteId,
        p_contact_id: contato,
        p_valores: { interesse: 'Plano XYZ' },
        p_meta: { interesse: { origem: 'contato', autor_id: null, em: agora } },
      }),
    ])

    const campos = await camposDoContato(clienteId, contato)
    expect(campos?.cidade?.valor).toBe('Maringá')
    expect(campos?.interesse?.valor).toBe('Plano XYZ')
  })

  it('a proveniência é gravada junto do valor', async () => {
    const contato = await contatoNovo('02')
    await gravarCampos(clienteId, contato, {
      cidade: { valor: 'Maringá', origem: 'humano', autorId: null, em: '2026-09-19T10:00:00Z' },
    })

    const campos = await camposDoContato(clienteId, contato)
    expect(campos?.cidade?.origem).toBe('humano')
    expect(campos?.cidade?.em).toBe('2026-09-19T10:00:00Z')
  })

  /**
   * A outra metade da RB-19, no caminho inteiro: a importação de março, subida
   * hoje, não desfaz o que uma pessoa conferiu e digitou ontem.
   */
  it('a importação não sobrescreve a correção humana, e diz por quê', async () => {
    const contato = await contatoNovo('03')
    await gravarCampos(clienteId, contato, {
      telefone: valor('11 99999-0000', 'humano', '2026-09-18T10:00:00Z'),
    })

    const r = await gravarCampos(clienteId, contato, {
      telefone: valor('11 88888-1111', 'importacao', '2026-09-19T10:00:00Z'),
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.recusados).toHaveLength(1)
    expect(r.recusados[0]?.chave).toBe('telefone')

    // E o banco guardou o valor certo.
    const campos = await camposDoContato(clienteId, contato)
    expect(campos?.telefone?.valor).toBe('11 99999-0000')
  })

  /**
   * O legado continua legível: o que o fluxo já gravava por `guardarCampo`
   * aparece no formato tipado, com origem `automacao`, e **aceita** ser
   * corrigido por uma pessoa.
   */
  it('o campo legado é lido e pode ser corrigido por uma pessoa', async () => {
    const contato = await contatoNovo('04')
    await guardarCampo(contato, { cidade: 'Londrina' })

    const antes = await camposDoContato(clienteId, contato)
    expect(antes?.cidade?.valor).toBe('Londrina')
    expect(antes?.cidade?.origem).toBe('automacao')

    await gravarCampos(clienteId, contato, { cidade: valor('Maringá', 'humano') })
    const depois = await camposDoContato(clienteId, contato)
    expect(depois?.cidade?.valor).toBe('Maringá')
    expect(depois?.cidade?.origem).toBe('humano')
  })

  /**
   * E o inverso, que é o que a coluna separada protege: `campos` continua
   * sendo `{chave: "valor"}` puro, legível por quem ainda não entende o formato
   * tipado. Um leitor esquecido mostraria um objeto na tela do cliente.
   */
  it('`campos` continua no formato antigo, legível pelos leitores de hoje', async () => {
    const contato = await contatoNovo('05')
    await gravarCampos(clienteId, contato, { cidade: valor('Maringá', 'humano') })

    const { data } = await db().from('contacts').select('campos').eq('id', contato).single()
    expect((data as { campos: Record<string, unknown> }).campos.cidade).toBe('Maringá')
  })

  /**
   * `service_role` ignora RLS: quem isola conta de conta é o `client_id` de
   * cada consulta. Sem ele, um id vazado escreveria na conta do vizinho.
   */
  it('não grava nem lê campo de contato de outra conta', async () => {
    const contato = await contatoNovo('06')
    await gravarCampos(clienteId, contato, { cidade: valor('Maringá', 'humano') })

    expect(await camposDoContato(outroClienteId, contato)).toBeNull()

    const r = await gravarCampos(outroClienteId, contato, { cidade: valor('Invadida', 'humano') })
    expect(r.ok).toBe(false)

    // E não encostou no dado.
    const campos = await camposDoContato(clienteId, contato)
    expect(campos?.cidade?.valor).toBe('Maringá')
  })

  it('gravar o mesmo valor de novo não muda a proveniência', async () => {
    const contato = await contatoNovo('07')
    await gravarCampos(clienteId, contato, { cidade: valor('Maringá', 'humano') })

    await gravarCampos(clienteId, contato, { cidade: valor('Maringá', 'automacao') })

    const campos = await camposDoContato(clienteId, contato)
    /*
     * Continua `humano`. Se virasse `automacao`, a próxima importação passaria
     * a vencer um valor que uma pessoa conferiu.
     */
    expect(campos?.cidade?.origem).toBe('humano')
  })
})

describe.skipIf(!temCredencial)('as definições de campo', () => {
  it('define, lê e atualiza pelo mesmo par conta/chave', async () => {
    expect(
      await definirCampo(clienteId, {
        chave: 'cnpj',
        rotulo: 'CNPJ',
        tipo: 'texto_curto',
        obrigatorioEm: ['fechar_venda'],
      }),
    ).toEqual({ ok: true })

    const lidas = await definicoesDeCampo(clienteId)
    const cnpj = lidas.find((d) => d.chave === 'cnpj')
    expect(cnpj?.rotulo).toBe('CNPJ')
    expect(cnpj?.obrigatorioEm).toEqual(['fechar_venda'])

    /*
     * Renomear muda o rótulo e **não** a chave: é o que preserva as
     * referências dos fluxos e das avaliações já gravadas (7.2).
     */
    await definirCampo(clienteId, { chave: 'cnpj', rotulo: 'CNPJ da empresa', tipo: 'texto_curto' })
    const depois = await definicoesDeCampo(clienteId)
    expect(depois.filter((d) => d.chave === 'cnpj')).toHaveLength(1)
    expect(depois.find((d) => d.chave === 'cnpj')?.rotulo).toBe('CNPJ da empresa')
  })

  it('recusa campo sem chave ou sem nome, com motivo', async () => {
    expect((await definirCampo(clienteId, { chave: '  ', rotulo: 'X', tipo: 'texto_curto' })).ok).toBe(false)
    expect((await definirCampo(clienteId, { chave: 'x', rotulo: ' ', tipo: 'texto_curto' })).ok).toBe(false)
  })

  /** Arquiva e não apaga: valor gravado sem rótulo é dado ilegível. */
  it('arquivar mantém a definição para explicar o histórico', async () => {
    await definirCampo(clienteId, { chave: 'antigo', rotulo: 'Antigo', tipo: 'texto_curto' })
    expect(await arquivarCampo(clienteId, 'antigo')).toEqual({ ok: true })

    const lidas = await definicoesDeCampo(clienteId)
    expect(lidas.find((d) => d.chave === 'antigo')?.arquivado).toBe(true)
  })

  it('não arquiva campo de outra conta', async () => {
    await definirCampo(clienteId, { chave: 'meu', rotulo: 'Meu', tipo: 'texto_curto' })
    expect((await arquivarCampo(outroClienteId, 'meu')).ok).toBe(false)
  })

  it('a definição de uma conta não vaza para a outra', async () => {
    await definirCampo(clienteId, { chave: 'so_meu', rotulo: 'Só meu', tipo: 'texto_curto' })
    expect((await definicoesDeCampo(outroClienteId)).some((d) => d.chave === 'so_meu')).toBe(false)
  })
})
