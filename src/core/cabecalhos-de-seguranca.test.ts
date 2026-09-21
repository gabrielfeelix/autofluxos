import { describe, expect, it } from 'vitest'
import { cabecalhos } from '../../next.config'

/**
 * Os cabeçalhos de segurança do painel, travados por teste.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe
 * ---------------------------------------------------------------------------
 *
 * Em 15/set/2026 o `Permissions-Policy` estava com `microphone=()`, lista
 * **vazia**, que proíbe todas as origens, inclusive a nossa. No mesmo dia a
 * caixa de resposta ganhou o botão de gravar áudio, e `getUserMedia` passou a
 * ser recusado pelo navegador **sem pedir permissão nenhuma**: sem prompt, sem
 * cadeado, sem nada que a pessoa pudesse liberar. Typecheck, lint, 1.540 testes
 * e o build passaram inteiros, nada olhava para este arquivo.
 *
 * O modo de falha é o pior que existe: um cabeçalho de endurecimento
 * silenciando um recurso novo, com todos os sinais verdes. Este teste é a
 * única coisa que faz a próxima tentativa de "desligar o que não usamos"
 * encostar numa asserção.
 */

function valor(chave: string): string {
  const achado = cabecalhos.find((c) => c.key.toLowerCase() === chave.toLowerCase())
  if (!achado) throw new Error(`cabeçalho ${chave} sumiu`)
  return achado.value
}

describe('Permissions-Policy', () => {
  /*
   * `microphone=()` é lista vazia e bloqueia a própria origem. `microphone=(self)`
   * libera só a nossa. A diferença são dois caracteres e é a diferença entre o
   * botão de gravar funcionar e não funcionar.
   */
  it('libera o microfone para a nossa própria origem', () => {
    expect(valor('Permissions-Policy')).toContain('microphone=(self)')
  })

  it('não deixa o microfone voltar para lista vazia', () => {
    expect(valor('Permissions-Policy')).not.toContain('microphone=()')
  })

  /*
   * O painel não usa nem uma nem outra. Se um dia usar, liga aqui **na mesma
   * mudança**, foi não fazer isso que quebrou o microfone.
   */
  it('mantém câmera e localização desligadas, que o painel não usa', () => {
    expect(valor('Permissions-Policy')).toContain('camera=()')
    expect(valor('Permissions-Policy')).toContain('geolocation=()')
  })
})

describe('o resto do endurecimento continua de pé', () => {
  it('fecha clickjacking pelos dois caminhos', () => {
    expect(valor('Content-Security-Policy')).toContain("frame-ancestors 'none'")
    expect(valor('X-Frame-Options')).toBe('DENY')
  })

  it('não deixa o navegador adivinhar o tipo do arquivo', () => {
    expect(valor('X-Content-Type-Options')).toBe('nosniff')
  })

  /* As nossas URLs carregam id de cliente e de contato no caminho. */
  it('não manda a URL inteira para fora', () => {
    expect(valor('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
})
