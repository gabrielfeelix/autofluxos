import { describe, expect, it } from 'vitest'
import { quemAvisar, textoDoAviso, type CandidatoAoAviso } from './aviso-de-handoff'
import { SEMPRE_ABERTO, type HorarioDeAtendimento } from './horario'

const membro = (over: Partial<CandidatoAoAviso> = {}): CandidatoAoAviso => ({
  usuarioId: 'u1',
  email: 'quem@atende.com',
  nome: 'Quem Atende',
  papel: 'owner',
  presenca: 'disponivel',
  ...over,
})

/** Segunda a sexta, 08:00–18:00, em São Paulo. */
const COMERCIAL: HorarioDeAtendimento = {
  fuso: 'America/Sao_Paulo',
  dias: [[], ...Array.from({ length: 5 }, () => [{ de: '08:00', ate: '18:00' }]), []],
}

// Quarta-feira, 10h em São Paulo (13h UTC).
const NO_EXPEDIENTE = new Date('2026-09-09T13:00:00Z')
// Mesma quarta, 3h da manhã em São Paulo (06h UTC).
const MADRUGADA = new Date('2026-09-09T06:00:00Z')

describe('quemAvisar', () => {
  it('no expediente, com gente disponível, avisa', () => {
    const decisao = quemAvisar([membro()], COMERCIAL, NO_EXPEDIENTE)
    expect(decisao).toMatchObject({ avisar: true })
    if (decisao.avisar) expect(decisao.destinatarios).toHaveLength(1)
  })

  // Avisar às 3h da manhã é a forma mais rápida de fazer alguém desligar o
  // aviso — e aí o produto volta a ter o buraco, agora sem ninguém saber.
  it('fora do horário não avisa, mesmo com todo mundo marcado como disponível', () => {
    expect(quemAvisar([membro()], COMERCIAL, MADRUGADA)).toEqual({
      avisar: false,
      motivo: 'fora-do-horario',
    })
  })

  it('quem marcou ausente não recebe', () => {
    expect(quemAvisar([membro({ presenca: 'ausente' })], COMERCIAL, NO_EXPEDIENTE)).toEqual({
      avisar: false,
      motivo: 'ninguem-disponivel',
    })
  })

  /*
   * A maioria das contas nunca abriu o seletor de presença. Tratar `null` como
   * ausência entregaria a rodada inteira sem avisar ninguém — e o teste
   * passaria.
   */
  it('presença nunca marcada NÃO é ausência', () => {
    const decisao = quemAvisar([membro({ presenca: null })], COMERCIAL, NO_EXPEDIENTE)
    expect(decisao.avisar).toBe(true)
  })

  it('avisa só quem está, quando parte da equipe saiu', () => {
    const decisao = quemAvisar(
      [
        membro({ usuarioId: 'fica', presenca: 'disponivel' }),
        membro({ usuarioId: 'saiu', presenca: 'ausente' }),
      ],
      COMERCIAL,
      NO_EXPEDIENTE,
    )
    expect(decisao.avisar).toBe(true)
    if (decisao.avisar) expect(decisao.destinatarios.map((d) => d.usuarioId)).toEqual(['fica'])
  })

  /*
   * Os papéis vêm do Better Auth e são em inglês. Em produção os quatro
   * membros que existem são `owner`: uma lista escrita em português calaria a
   * conta inteira, e o defeito só apareceria como lead sem resposta.
   */
  it('os três papéis reais atendem — owner, admin e member', () => {
    for (const papel of ['owner', 'admin', 'member']) {
      const decisao = quemAvisar([membro({ papel })], COMERCIAL, NO_EXPEDIENTE)
      expect(decisao.avisar, `papel ${papel} devia receber aviso`).toBe(true)
    }
  })

  it('papel desconhecido avisa: errar calando é pior que errar avisando', () => {
    expect(quemAvisar([membro({ papel: null })], COMERCIAL, NO_EXPEDIENTE).avisar).toBe(true)
    expect(quemAvisar([membro({ papel: 'papel_que_nao_existe' })], COMERCIAL, NO_EXPEDIENTE)).toEqual(
      { avisar: false, motivo: 'conta-sem-membro' },
    )
  })

  it('conta sem membro nenhum não avisa, e diz por quê', () => {
    expect(quemAvisar([], COMERCIAL, NO_EXPEDIENTE)).toEqual({
      avisar: false,
      motivo: 'conta-sem-membro',
    })
  })

  // A mesma regra de `atendimentoAberto`: ninguém configurou ≠ configuraram
  // para não atender nunca.
  it('conta sem horário configurado avisa a qualquer hora', () => {
    expect(quemAvisar([membro()], SEMPRE_ABERTO, MADRUGADA).avisar).toBe(true)
  })
})

/*
 * Endereçar o aviso a uma pessoa é decisão do bloco de handoff, mas **quem
 * ainda atende** continua sendo decisão daqui. Estes casos existem porque o
 * modo de falhar é silencioso: um aviso mandado para quem saiu da conta não dá
 * erro nenhum — só não chega, e o lead segue esperando.
 */
describe('quemAvisar, com o handoff endereçado a alguém', () => {
  const marina = membro({ usuarioId: 'marina', nome: 'Marina' })
  const dono = membro({ usuarioId: 'dono', nome: 'Dono' })

  it('a pessoa escolhida está entre quem seria avisado', () => {
    const decisao = quemAvisar([marina, dono], COMERCIAL, NO_EXPEDIENTE)
    expect(decisao.avisar).toBe(true)
    if (decisao.avisar) {
      expect(decisao.destinatarios.map((d) => d.usuarioId)).toContain('marina')
    }
  })

  // O filtro por pessoa acontece no servidor, DEPOIS desta decisão — então
  // alguém ausente nunca chega lá, e o aviso volta a ser da equipe.
  it('quem está ausente não entra na lista, mesmo sendo a escolhida', () => {
    const decisao = quemAvisar(
      [membro({ usuarioId: 'marina', presenca: 'ausente' }), dono],
      COMERCIAL,
      NO_EXPEDIENTE,
    )
    expect(decisao.avisar).toBe(true)
    if (decisao.avisar) {
      expect(decisao.destinatarios.map((d) => d.usuarioId)).toEqual(['dono'])
    }
  })

  // Escolher uma pessoa no desenho do fluxo não autoriza tocar o telefone dela
  // às 3h da manhã: o horário vem antes de tudo.
  it('fora do horário não avisa ninguém, nem a pessoa escolhida', () => {
    expect(quemAvisar([marina, dono], COMERCIAL, MADRUGADA)).toEqual({
      avisar: false,
      motivo: 'fora-do-horario',
    })
  })
})

describe('textoDoAviso', () => {
  it('o nome de quem espera vem primeiro — é o que faz largar o que se está fazendo', () => {
    expect(textoDoAviso('Marina', 'o bot não entendeu 3 vezes')).toEqual({
      titulo: 'Marina está esperando atendimento',
      corpo: 'o bot não entendeu 3 vezes',
    })
  })

  it('contato sem nome não vira título quebrado', () => {
    expect(textoDoAviso(null, 'pediu para falar com alguém').titulo).toBe(
      'Um contato está esperando atendimento',
    )
    expect(textoDoAviso('   ', 'x').titulo).toBe('Um contato está esperando atendimento')
  })

  it('motivo vazio não deixa a notificação sem corpo', () => {
    expect(textoDoAviso('Marina', '  ').corpo).toBe('o bot passou a conversa para uma pessoa')
  })
})
