import { describe, expect, it } from 'vitest'
import { estadoDaConexao, idadeDoEvento, resumoDoCatalogo, seloDaConexao } from './conexoes'

const AGORA = new Date('2026-09-23T15:00:00Z')
const dias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000).toISOString()

describe('o estado da conexão em camadas', () => {
  /*
   * Sem tráfego recente não é falha: canal quieto numa semana fraca não pode
   * acender alerta, senão a pessoa aprende a ignorá-lo.
   */
  it('canal sem evento recente continua válido e sem falha', () => {
    const e = estadoDaConexao(
      {
        tipo: 'instagram',
        conta: { igUsername: 'studio', tokenExpiraEm: dias(40) },
        ultimoEvento: dias(-12),
      },
      AGORA,
    )
    expect(e).toMatchObject({ configurado: true, autorizacao: 'valida', falha: null, proximaAcao: null })
    expect(e.ultimoEvento).toBe(dias(-12))
    expect(seloDaConexao(e).texto).toBe('configurada')

    const w = estadoDaConexao(
      { tipo: 'whatsapp', numeros: [{ displayPhoneNumber: '+55 44 99999-0000', desembarcadoEm: null }], ultimoEvento: null },
      AGORA,
    )
    expect(w.falha).toBeNull()
    expect(w.autorizacao).toBe('nao_se_aplica')
  })

  it('token vencido pede reconectar', () => {
    const e = estadoDaConexao(
      { tipo: 'instagram', conta: { igUsername: 'studio', tokenExpiraEm: dias(-1) }, ultimoEvento: null },
      AGORA,
    )
    expect(e.autorizacao).toBe('vencida')
    expect(e.falha).toMatch(/@studio venceu/)
    expect(e.proximaAcao).toEqual({ texto: 'Reconectar o Instagram', href: '/ajustes/instagram' })
    expect(seloDaConexao(e).tom).toBe('perigo')
  })

  it('token que vence em poucos dias avisa sem ser falha', () => {
    const e = estadoDaConexao(
      { tipo: 'instagram', conta: { igUsername: null, tokenExpiraEm: dias(3) }, ultimoEvento: null },
      AGORA,
    )
    expect(e.autorizacao).toBe('vence_em_breve')
    expect(e.falha).toBeNull()
    expect(seloDaConexao(e).texto).toBe('vence em breve')
  })

  it('página de anúncio sem webhook pede reinscrever', () => {
    const e = estadoDaConexao(
      { tipo: 'anuncios', paginas: 1, temToken: true, webhookInscrito: false, ultimoEvento: dias(-2) },
      AGORA,
    )
    expect(e.falha).toMatch(/não está mais inscrita/)
    expect(e.proximaAcao?.texto).toBe('Inscrever a página de novo')
  })

  it('inscrição desconhecida não vira falha', () => {
    const e = estadoDaConexao(
      { tipo: 'anuncios', paginas: 1, temToken: true, webhookInscrito: null, ultimoEvento: null },
      AGORA,
    )
    expect(e.falha).toBeNull()
  })

  it('número desembarcado é falha com reconectar', () => {
    const e = estadoDaConexao(
      { tipo: 'whatsapp', numeros: [{ displayPhoneNumber: '+55 44 1', desembarcadoEm: dias(-1) }], ultimoEvento: null },
      AGORA,
    )
    expect(e.falha).toMatch(/desconectado do celular/)
    expect(e.proximaAcao?.texto).toBe('Reconectar o número')
  })

  it('nada configurado pede conectar, sem falha', () => {
    const e = estadoDaConexao({ tipo: 'whatsapp', numeros: [], ultimoEvento: null }, AGORA)
    expect(e.configurado).toBe(false)
    expect(e.falha).toBeNull()
    expect(seloDaConexao(e).texto).toBe('conectar')
  })
})

describe('a idade do último evento', () => {
  it('escreve minutos, horas e dias', () => {
    expect(idadeDoEvento(null, AGORA)).toBe('nenhuma ainda')
    expect(idadeDoEvento(new Date(AGORA.getTime() - 5 * 60_000).toISOString(), AGORA)).toBe('há 5 min')
    expect(idadeDoEvento(new Date(AGORA.getTime() - 2 * 3_600_000).toISOString(), AGORA)).toBe('há 2 h')
    expect(idadeDoEvento(dias(-3), AGORA)).toBe('há 3 dias')
  })
})

describe('o resumo do catálogo', () => {
  it('conta só o que está disponível, e o indisponível não entra no total', () => {
    const ligado = estadoDaConexao({ tipo: 'cadastro', configurado: true, href: '/x' })
    const desligado = estadoDaConexao({ tipo: 'cadastro', configurado: false, href: '/x' })
    expect(
      resumoDoCatalogo([
        { disponivel: true, estado: ligado },
        { disponivel: true, estado: desligado },
        { disponivel: false, estado: desligado },
      ]),
    ).toEqual({ conectadas: 1, total: 2 })
  })
})
