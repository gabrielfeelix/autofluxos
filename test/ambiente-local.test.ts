import { describe, expect, it } from 'vitest'
import { conferirAmbienteLocal, ehEnderecoLocal, exigirAmbienteLocal } from './ambiente-local'

/**
 * O guarda é a única coisa entre `npm test` e o banco de produção
 * compartilhado com a Verandi. Ele precisa recusar pelos três caminhos que
 * chegariam lá sem querer: endereço remoto, variável herdada do `.env` de
 * produção e configuração pela metade.
 */

/** O `.env` real desta máquina, como ele chegaria ao teste antes da F0. */
const COMO_PRODUCAO = {
  SUPABASE_URL: 'https://xxxynoshwirupkdzwxbj.supabase.co',
  SUPABASE_SECRET_KEY: 'chave-de-mentira-para-o-teste',
} as unknown as NodeJS.ProcessEnv

const COMO_LOCAL = {
  AUTOFLUXOS_TESTE_LOCAL: 'sim',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SECRET_KEY: 'chave-de-mentira-para-o-teste',
} as unknown as NodeJS.ProcessEnv

describe('reconhecer endereço local', () => {
  it('aceita os hosts locais conhecidos', () => {
    expect(ehEnderecoLocal('http://127.0.0.1:54321')).toBe(true)
    expect(ehEnderecoLocal('http://localhost:54321')).toBe(true)
    expect(ehEnderecoLocal('http://host.docker.internal:54321')).toBe(true)
  })

  it('recusa o Supabase de produção', () => {
    expect(ehEnderecoLocal('https://xxxynoshwirupkdzwxbj.supabase.co')).toBe(false)
  })

  /**
   * O caso que um `includes('localhost')` deixaria passar. O host precisa ser
   * exatamente local, não apenas conter a palavra.
   */
  it('recusa host que só imita o nome local', () => {
    expect(ehEnderecoLocal('https://localhost.exemplo.com')).toBe(false)
    expect(ehEnderecoLocal('https://127.0.0.1.exemplo.com')).toBe(false)
  })

  it('recusa endereço inválido em vez de estourar', () => {
    expect(ehEnderecoLocal('nao é uma url')).toBe(false)
    expect(ehEnderecoLocal('')).toBe(false)
  })
})

describe('conferir o ambiente', () => {
  /** A regra central: achar credencial não é o mesmo que ter permissão. */
  it('recusa o .env de produção mesmo com credencial completa', () => {
    const veredito = conferirAmbienteLocal(COMO_PRODUCAO)
    expect(veredito.ok).toBe(false)
    expect(veredito.ok === false && veredito.motivo).toContain('AUTOFLUXOS_TESTE_LOCAL')
  })

  /** Mesmo consentindo, o endereço remoto continua recusado. */
  it('recusa host remoto mesmo com o consentimento dado', () => {
    const veredito = conferirAmbienteLocal({
      ...COMO_PRODUCAO,
      AUTOFLUXOS_TESTE_LOCAL: 'sim',
    } as unknown as NodeJS.ProcessEnv)
    expect(veredito.ok).toBe(false)
    expect(veredito.ok === false && veredito.motivo).toContain('host remoto')
  })

  /** A recusa nomeia o host, mas nunca imprime a chave. */
  it('não vaza a credencial na mensagem de recusa', () => {
    const veredito = conferirAmbienteLocal({
      ...COMO_PRODUCAO,
      AUTOFLUXOS_TESTE_LOCAL: 'sim',
      SUPABASE_SECRET_KEY: 'segredo-que-nao-pode-aparecer',
    } as unknown as NodeJS.ProcessEnv)
    expect(veredito.ok).toBe(false)
    expect(veredito.ok === false && veredito.motivo).not.toContain('segredo-que-nao-pode-aparecer')
  })

  it('recusa configuração ausente', () => {
    expect(conferirAmbienteLocal({} as NodeJS.ProcessEnv).ok).toBe(false)
    expect(
      conferirAmbienteLocal({ AUTOFLUXOS_TESTE_LOCAL: 'sim' } as unknown as NodeJS.ProcessEnv).ok,
    ).toBe(false)
  })

  it('recusa local sem a chave secreta', () => {
    const veredito = conferirAmbienteLocal({
      AUTOFLUXOS_TESTE_LOCAL: 'sim',
      SUPABASE_URL: 'http://127.0.0.1:54321',
    } as unknown as NodeJS.ProcessEnv)
    expect(veredito.ok).toBe(false)
    expect(veredito.ok === false && veredito.motivo).toContain('SUPABASE_SECRET_KEY')
  })

  it('aceita o ambiente local configurado de propósito', () => {
    const veredito = conferirAmbienteLocal(COMO_LOCAL)
    expect(veredito.ok).toBe(true)
    expect(veredito.ok === true && veredito.url).toBe('http://127.0.0.1:54321')
  })
})

describe('exigir o ambiente', () => {
  it('lança antes de qualquer conexão quando o ambiente é de produção', () => {
    expect(() => exigirAmbienteLocal(COMO_PRODUCAO)).toThrow(/ambiente-local/)
  })

  it('devolve a url quando o ambiente é local', () => {
    expect(exigirAmbienteLocal(COMO_LOCAL)).toBe('http://127.0.0.1:54321')
  })
})
