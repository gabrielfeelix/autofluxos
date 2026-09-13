import { describe, expect, it } from 'vitest'
import { estaBloqueado, pendenciasDaMeta } from './pendencias-da-meta'

/**
 * O caso real que originou isto: a conta do primeiro cliente coexistente
 * respondeu `BLOCKED` com 141006 e 141007 na WABA, e 141010 no negócio. A tela
 * ficou vazia e ninguém tinha como saber o motivo.
 */
const SAUDE_REAL = {
  podeEnviar: 'BLOCKED',
  codigos: [141006, 141007, 141010],
  negocioId: '1629792983847355',
  wabaId: '2042524849790437',
}

describe('pendenciasDaMeta', () => {
  it('traduz os três códigos do caso real', () => {
    expect(pendenciasDaMeta(SAUDE_REAL).map((p) => p.id)).toEqual([
      'pagamento',
      'fuso',
      'verificacao',
    ])
  })

  it('põe o que bloqueia antes do que só limita', () => {
    // Mandar verificar o negócio antes de pôr o cartão faria a pessoa entrar
    // numa fila de dias por um problema que não era o dela.
    const ordem = pendenciasDaMeta({ podeEnviar: 'BLOCKED', codigos: [141010, 141006] })
    expect(ordem[0]?.id).toBe('pagamento')
    expect(ordem[1]?.id).toBe('verificacao')
  })

  it('não repete a mesma queixa vinda de duas entidades', () => {
    // O mesmo código aparece na WABA e no negócio; a pessoa tem uma tarefa só.
    expect(pendenciasDaMeta({ podeEnviar: 'BLOCKED', codigos: [141006, 141006] })).toHaveLength(1)
  })

  it('ignora código que ainda não sabemos traduzir', () => {
    // A Meta acrescenta códigos, e o que não conhecemos não pode virar tela em
    // branco nem texto genérico assustando quem está bem.
    expect(pendenciasDaMeta({ podeEnviar: 'BLOCKED', codigos: [999999] })).toEqual([])
  })

  it('conta saudável não tem pendência', () => {
    expect(pendenciasDaMeta({ podeEnviar: 'AVAILABLE', codigos: [] })).toEqual([])
  })

  it('sem resposta da Meta, nenhuma pendência — silêncio não é acusação', () => {
    // Falha de rede não pode fazer a tela dizer que o cliente está devendo.
    expect(pendenciasDaMeta(null)).toEqual([])
    expect(pendenciasDaMeta(undefined)).toEqual([])
  })
})

describe('estaBloqueado', () => {
  it('BLOCKED trava', () => {
    expect(estaBloqueado(SAUDE_REAL)).toBe(true)
  })

  it('LIMITED não é travado — entrega com teto menor', () => {
    expect(estaBloqueado({ podeEnviar: 'LIMITED', codigos: [141010] })).toBe(false)
  })

  it('AVAILABLE e desconhecido não alarmam', () => {
    expect(estaBloqueado({ podeEnviar: 'AVAILABLE', codigos: [] })).toBe(false)
    expect(estaBloqueado({ podeEnviar: 'COISA_NOVA', codigos: [] })).toBe(false)
    expect(estaBloqueado(null)).toBe(false)
  })
})

describe('os links levam à tela que resolve', () => {
  /*
   * Mandar a pessoa para "o site da Meta" é o mesmo que não mandar link: sem
   * `business_id` ela cai num seletor de contas, ou numa visão geral onde a
   * opção certa está a três cliques.
   */
  it('a cobrança leva o business_id junto', () => {
    const p = pendenciasDaMeta(SAUDE_REAL).find((x) => x.id === 'pagamento')
    expect(p?.link).toBe(
      'https://business.facebook.com/billing_hub/payment_settings?business_id=1629792983847355',
    )
  })

  it('o fuso abre a própria conta do WhatsApp, com os dois ids', () => {
    const p = pendenciasDaMeta(SAUDE_REAL).find((x) => x.id === 'fuso')
    expect(p?.link).toBe(
      'https://business.facebook.com/settings/whatsapp-business-accounts/2042524849790437?business_id=1629792983847355',
    )
  })

  it('a verificação abre a Central de Segurança do negócio certo', () => {
    const p = pendenciasDaMeta(SAUDE_REAL).find((x) => x.id === 'verificacao')
    expect(p?.link).toContain('/settings/security?business_id=1629792983847355')
  })

  it('sem os ids, nenhum link — melhor texto que link no lugar errado', () => {
    // Um link que abre onde não devia faz a pessoa achar que ela errou.
    const sem = pendenciasDaMeta({ podeEnviar: 'BLOCKED', codigos: [141006, 141007] })
    expect(sem.every((p) => p.link === null)).toBe(true)
  })

  it('fuso sem waba_id não inventa link', () => {
    const p = pendenciasDaMeta({
      podeEnviar: 'BLOCKED',
      codigos: [141007],
      negocioId: '123',
    })
    expect(p[0]?.link).toBeNull()
  })
})

describe('o fuso avisa que são dois campos diferentes', () => {
  /*
   * O defeito que isto trava: o cliente preencheu "Fuso horário" em
   * **Informações da empresa**, viu America/Sao_Paulo na tela, e o aviso não
   * saiu — porque o `timezone_id` que a Meta cobra é o da **WABA**, outro
   * objeto, em outra aba. Dois campos com o mesmo nome, e só um resolve.
   *
   * Sem esse alerta no texto, a pessoa preenche o errado, conclui que o painel
   * está quebrado, e para de confiar no aviso inteiro.
   */
  it('diz explicitamente que o da empresa não resolve', () => {
    const fuso = pendenciasDaMeta(SAUDE_REAL).find((p) => p.id === 'fuso')
    expect(fuso?.efeito).toContain('não o da empresa')
  })
})
