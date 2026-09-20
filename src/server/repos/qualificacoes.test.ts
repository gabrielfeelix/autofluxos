import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { gravarCampos } from './campos'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import {
  avaliacoesDoContato,
  avaliarContato,
  criteriosDoObjetivo,
  publicarCriterios,
} from './qualificacoes'

/**
 * A avaliação versionada, contra o banco de verdade.
 *
 * `core/qualificacao.test.ts` cobre a lógica de três valores, exaustivamente e
 * sem fixture. O que **só** o banco prova é o que a T4.2 pede de verdade:
 * alterar os critérios **não reescreve** as avaliações passadas, e a mesma
 * pessoa qualifica para um objetivo e não para outro sem que o cadastro global
 * dela mude.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-t42-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let outroClienteId = ''

const campo = (valor: string) => ({
  valor,
  origem: 'contato' as const,
  autorId: null,
  em: new Date().toISOString(),
})

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

describe.skipIf(!temCredencial)('os critérios publicados', () => {
  it('publicar sobe a versão a cada vez', async () => {
    const primeira = await publicarCriterios(clienteId, {
      objetivo: 'Plano XYZ',
      modo: 'todas',
      condicoes: [{ campo: 'orcamento', operador: 'maior', valor: '500' }],
    })
    expect(primeira.ok).toBe(true)
    if (!primeira.ok) return
    expect(primeira.versao).toBe(1)

    const segunda = await publicarCriterios(clienteId, {
      objetivo: 'Plano XYZ',
      modo: 'todas',
      condicoes: [{ campo: 'orcamento', operador: 'maior', valor: '900' }],
    })
    expect(segunda.ok).toBe(true)
    if (!segunda.ok) return
    expect(segunda.versao).toBe(2)

    expect((await criteriosDoObjetivo(clienteId, 'Plano XYZ'))?.versao).toBe(2)
  })

  /**
   * RB-22: valores de demonstração não viram política real. É o que impedia o
   * `499` do modelo SDR de ser copiado para dentro de uma conta.
   */
  it('recusa publicar regra incompleta, dizendo o que falta', async () => {
    const r = await publicarCriterios(clienteId, {
      objetivo: 'Incompleto',
      modo: 'todas',
      condicoes: [{ campo: 'orcamento', operador: 'maior' }],
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.problemas.join(' ')).toContain('orcamento')

    // E não gravou nada: a conta não fica com uma regra pela metade.
    expect(await criteriosDoObjetivo(clienteId, 'Incompleto')).toBeNull()
  })

  it('a regra de uma conta não vaza para a outra', async () => {
    await publicarCriterios(clienteId, {
      objetivo: 'Só meu',
      modo: 'todas',
      condicoes: [{ campo: 'cidade', operador: 'preenchido' }],
    })
    expect(await criteriosDoObjetivo(outroClienteId, 'Só meu')).toBeNull()
  })
})

describe.skipIf(!temCredencial)('a avaliação gravada', () => {
  /**
   * **O teste central da T4.2.** Alterar os critérios não pode reescrever o que
   * já foi avaliado: a avaliação de março é o que a regra de março respondeu, e
   * sem isso ninguém consegue explicar por que um lead foi recusado.
   */
  it('mudar os critérios não reescreve a avaliação passada', async () => {
    const contato = await contatoNovo('01')
    await gravarCampos(clienteId, contato, { orcamento: campo('600') })

    await publicarCriterios(clienteId, {
      objetivo: 'Histórico',
      modo: 'todas',
      condicoes: [{ campo: 'orcamento', operador: 'maior', valor: '500' }],
    })

    const antes = await avaliarContato(clienteId, contato, 'Histórico', null)
    expect(antes.ok).toBe(true)
    if (!antes.ok) return
    expect(antes.avaliacao.resultado).toBe('atende')
    expect(antes.avaliacao.criteriosVersao).toBe(1)

    // A conta aperta o critério. A pessoa não mudou.
    await publicarCriterios(clienteId, {
      objetivo: 'Histórico',
      modo: 'todas',
      condicoes: [{ campo: 'orcamento', operador: 'maior', valor: '5000' }],
    })

    // A linha antiga continua dizendo o que dizia, com a versão que a produziu.
    const { data } = await db()
      .from('avaliacoes_de_qualificacao')
      .select('resultado, criterios_versao')
      .eq('contact_id', contato)
      .eq('objetivo', 'Histórico')
      .order('criado_em', { ascending: true })

    const linhas = (data ?? []) as { resultado: string; criterios_versao: number }[]
    expect(linhas[0]?.resultado).toBe('atende')
    expect(linhas[0]?.criterios_versao).toBe(1)

    // E reavaliar gera linha **nova**, não sobrescreve.
    const depois = await avaliarContato(clienteId, contato, 'Histórico', null)
    expect(depois.ok).toBe(true)
    if (!depois.ok) return
    expect(depois.avaliacao.resultado).toBe('nao_atende')
    expect(depois.avaliacao.criteriosVersao).toBe(2)

    const { data: agora } = await db()
      .from('avaliacoes_de_qualificacao')
      .select('id')
      .eq('contact_id', contato)
      .eq('objetivo', 'Histórico')
    expect(agora ?? []).toHaveLength(2)
  })

  /**
   * A verificação que a T4.2 pede literalmente: a mesma pessoa qualifica para
   * um objetivo e não para outro **sem alterar seu cadastro global**.
   */
  it('a mesma pessoa atende a um objetivo e não a outro', async () => {
    const contato = await contatoNovo('02')
    await gravarCampos(clienteId, contato, { orcamento: campo('600') })

    await publicarCriterios(clienteId, {
      objetivo: 'Básico',
      modo: 'todas',
      condicoes: [{ campo: 'orcamento', operador: 'maior', valor: '500' }],
    })
    await publicarCriterios(clienteId, {
      objetivo: 'Premium',
      modo: 'todas',
      condicoes: [{ campo: 'orcamento', operador: 'maior', valor: '5000' }],
    })

    const basico = await avaliarContato(clienteId, contato, 'Básico', null)
    const premium = await avaliarContato(clienteId, contato, 'Premium', null)
    expect(basico.ok && basico.avaliacao.resultado).toBe('atende')
    expect(premium.ok && premium.avaliacao.resultado).toBe('nao_atende')

    // As duas convivem, uma por objetivo.
    const lidas = await avaliacoesDoContato(clienteId, contato)
    expect(lidas.find((a) => a.objetivo === 'Básico')?.resultado).toBe('atende')
    expect(lidas.find((a) => a.objetivo === 'Premium')?.resultado).toBe('nao_atende')
  })

  /**
   * Os valores considerados ficam congelados. Sem isso, corrigir o campo depois
   * faria a avaliação antiga parecer errada: "não atende porque o orçamento é
   * 300", com o campo já mostrando 900.
   */
  it('guarda os valores que usou, e só os que usou', async () => {
    const contato = await contatoNovo('03')
    await gravarCampos(clienteId, contato, {
      orcamento: campo('300'),
      // Um campo que a regra não olha: não deve ir para o histórico.
      observacao: campo('dado pessoal que a regra não usou'),
    })

    await publicarCriterios(clienteId, {
      objetivo: 'Congelado',
      modo: 'todas',
      condicoes: [{ campo: 'orcamento', operador: 'maior', valor: '500' }],
    })
    await avaliarContato(clienteId, contato, 'Congelado', null)

    // A pessoa corrige o orçamento depois.
    await gravarCampos(clienteId, contato, { orcamento: campo('900') })

    const lidas = await avaliacoesDoContato(clienteId, contato)
    const congelada = lidas.find((a) => a.objetivo === 'Congelado')
    expect(congelada?.valores.orcamento).toBe('300')
    expect(congelada?.valores.observacao).toBeUndefined()
  })

  it('dados faltando viram incompleto, e a linha diz qual campo', async () => {
    const contato = await contatoNovo('04')
    await publicarCriterios(clienteId, {
      objetivo: 'Faltando',
      modo: 'todas',
      condicoes: [{ campo: 'cidade', operador: 'igual', valor: 'Maringá' }],
    })

    const r = await avaliarContato(clienteId, contato, 'Faltando', null)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.avaliacao.resultado).toBe('incompleto')
    expect(r.avaliacao.faltam).toEqual(['cidade'])
  })

  it('não avalia contato de outra conta', async () => {
    const contato = await contatoNovo('05')
    await publicarCriterios(outroClienteId, {
      objetivo: 'Alheio',
      modo: 'todas',
      condicoes: [{ campo: 'cidade', operador: 'preenchido' }],
    })

    const r = await avaliarContato(outroClienteId, contato, 'Alheio', null)
    expect(r.ok).toBe(false)
  })

  it('sem critérios para o objetivo, recusa com motivo em vez de aprovar', async () => {
    const contato = await contatoNovo('06')
    const r = await avaliarContato(clienteId, contato, 'Nunca configurado', null)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toContain('critérios')
  })
})
