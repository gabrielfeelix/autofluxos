import { describe, expect, it } from 'vitest'
import {
  conferirFaixas,
  diasDesde,
  FAIXAS_PADRAO,
  nivelPor,
  oQueFazer,
  recenciaPor,
  relacionamentoDe,
} from './relacionamento'

const AGORA = new Date('2026-09-18T12:00:00Z')

/** Há N dias, em ISO, para não espalhar aritmética de data pelos testes. */
function haDias(n: number): string {
  return new Date(AGORA.getTime() - n * 86_400_000).toISOString()
}

describe('o nível pelo que já gastou', () => {
  it('usa faixa em reais, e não posição na base', () => {
    expect(nivelPor(5000)).toBe('ouro')
    expect(nivelPor(4999.99)).toBe('prata')
    expect(nivelPor(1000)).toBe('prata')
    expect(nivelPor(999.99)).toBe('bronze')
    expect(nivelPor(1)).toBe('bronze')
  })

  /*
   * O caso que separa este desenho do RFM de varejo: numa base de trinta
   * pessoas, o quintil de cima seria "ouro" mesmo gastando trinta reais. Aqui
   * quem gastou pouco é bronze, e continua bronze quando entrar um cliente
   * grande — o chão não se move sozinho.
   */
  it('não promove ninguém só por ser o melhor de uma base pequena', () => {
    const baseInteira = [30, 45, 60].map((v) => nivelPor(v))
    expect(baseInteira).toEqual(['bronze', 'bronze', 'bronze'])
  })

  it('quem nunca comprou não é bronze, é sem_compra', () => {
    // Misturar os dois na mesma faixa junta o cliente pequeno e o desconhecido,
    // que são duas conversas diferentes.
    expect(nivelPor(0)).toBe('sem_compra')
    expect(nivelPor(-10)).toBe('sem_compra')
  })

  it('respeita faixa escolhida pelo dono', () => {
    const faixas = { ouro: 300, prata: 100 }
    expect(nivelPor(300, faixas)).toBe('ouro')
    expect(nivelPor(150, faixas)).toBe('prata')
    expect(nivelPor(150)).toBe('bronze') // o padrão é outro
  })

  it('recusa faixa que faria a tela mentir', () => {
    expect(conferirFaixas(FAIXAS_PADRAO).ok).toBe(true)
    expect(conferirFaixas({ ouro: 100, prata: 500 }).ok).toBe(false)
    expect(conferirFaixas({ ouro: 100, prata: 100 }).ok).toBe(false)
    expect(conferirFaixas({ ouro: -1, prata: 0 }).ok).toBe(false)
    expect(conferirFaixas({ ouro: Number.NaN, prata: 0 }).ok).toBe(false)
  })
})

describe('a recência', () => {
  it('corta em mês, trimestre e semestre', () => {
    expect(recenciaPor(haDias(0), AGORA)).toBe('ativo')
    expect(recenciaPor(haDias(29), AGORA)).toBe('ativo')
    expect(recenciaPor(haDias(30), AGORA)).toBe('esfriando')
    expect(recenciaPor(haDias(89), AGORA)).toBe('esfriando')
    expect(recenciaPor(haDias(90), AGORA)).toBe('sumido')
    expect(recenciaPor(haDias(180), AGORA)).toBe('perdido')
  })

  it('quem nunca falou não é "perdido", é "nunca falou"', () => {
    // Afirmar que sumiu quem nunca chegou é mentira de tela.
    expect(recenciaPor(null, AGORA)).toBe('sem_contato')
    expect(recenciaPor('data que não existe', AGORA)).toBe('sem_contato')
  })

  it('data futura não vira dia negativo', () => {
    // Relógio de servidor adiantado é real, e "há -1 dias" é pior que "hoje".
    const amanha = new Date(AGORA.getTime() + 86_400_000).toISOString()
    expect(diasDesde(amanha, AGORA)).toBe(0)
    expect(recenciaPor(amanha, AGORA)).toBe('ativo')
  })
})

describe('o retrato do relacionamento', () => {
  /*
   * A decisão que este teste protege: a recência é da **conversa**, não da
   * compra. Quem comprou há um mês e sumiu depois está indo embora, e medir pela
   * compra faria esse caso parecer saudável até a renovação — que é quando já
   * não dá para fazer nada.
   */
  it('mede presença pela conversa, não pela compra', () => {
    const r = relacionamentoDe(
      {
        total: 6000,
        compras: 3,
        ultimaCompraEm: haDias(20),
        ultimaConversaEm: haDias(120),
      },
      FAIXAS_PADRAO,
      AGORA,
    )

    expect(r.nivel).toBe('ouro')
    expect(r.recencia).toBe('sumido')
    expect(r.diasDaUltimaCompra).toBe(20)
    expect(r.diasDaUltimaConversa).toBe(120)
  })

  it('cliente bom sumindo é o primeiro aviso, e fala em meses', () => {
    const r = relacionamentoDe(
      { total: 6000, compras: 3, ultimaCompraEm: haDias(200), ultimaConversaEm: haDias(120) },
      FAIXAS_PADRAO,
      AGORA,
    )
    const frase = oQueFazer(r)
    expect(frase).toContain('ouro')
    expect(frase).toContain('4 meses')
    expect(frase).not.toContain('120')
  })

  it('não inventa tarefa para desconhecido que sumiu', () => {
    // Cobrar o time de correr atrás de quem nunca comprou e sumiu é encher a
    // tela de trabalho que ninguém vai fazer.
    const r = relacionamentoDe(
      { total: 0, compras: 0, ultimaCompraEm: null, ultimaConversaEm: haDias(200) },
      FAIXAS_PADRAO,
      AGORA,
    )
    expect(r.nivel).toBe('sem_compra')
    expect(oQueFazer(r)).toBeNull()
  })

  it('quem conversa e nunca fechou vira oferta', () => {
    const r = relacionamentoDe(
      { total: 0, compras: 0, ultimaCompraEm: null, ultimaConversaEm: haDias(2) },
      FAIXAS_PADRAO,
      AGORA,
    )
    expect(oQueFazer(r)).toContain('Falta uma oferta')
  })
})
