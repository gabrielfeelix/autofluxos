import { describe, expect, it } from 'vitest'
import { automacaoNoAr, trilhaDeConfiguracao, type FatosDaTrilha } from './trilha-de-configuracao'

const nova: FatosDaTrilha = {
  empresa: { responsavel: '', telefone: '', email: '' },
  canais: 0,
  temHorario: false,
  temConhecimento: false,
  publicados: 0,
  atendendo: 0,
  temContato: false,
}

const estados = (f: FatosDaTrilha) => trilhaDeConfiguracao(f).map((p) => `${p.chave}:${p.estado}`)

describe('automacaoNoAr', () => {
  it('conta só canal que aponta para automação publicada', () => {
    const fluxos = [
      { id: 'a', versaoPublicadaId: 'v1' },
      { id: 'b', versaoPublicadaId: null },
    ]
    expect(automacaoNoAr(fluxos, [{ flowId: 'a' }, { flowId: 'b' }, { flowId: null }])).toEqual({
      publicados: 1,
      atendendo: 1,
    })
  })
})

describe('trilhaDeConfiguracao', () => {
  it('conta sem canal: vê o primeiro passo e o motivo dos seguintes (aceite do S01)', () => {
    const trilha = trilhaDeConfiguracao(nova)
    expect(estados(nova)).toEqual([
      'empresa:pendente',
      'canal:pendente',
      'horario:pendente',
      'automacao:bloqueado',
      'teste:bloqueado',
    ])
    expect(trilha[3]?.motivo).toContain('Depende do canal')
    expect(trilha[4]?.motivo).toBe('Depende da automação no ar')
  })

  it('contato sem automação no ar não conta como teste feito', () => {
    expect(estados({ ...nova, temContato: true }).at(-1)).toBe('teste:bloqueado')
  })

  it('canal sem automação publicada: pendência leva a Automações (aceite do S01)', () => {
    const [, , , automacao] = trilhaDeConfiguracao({ ...nova, canais: 1 })
    expect(automacao).toMatchObject({ estado: 'pendente', href: '/fluxos', motivo: 'Publique uma automação' })
  })

  it('publicada mas o canal aponta para outra: leva ao canal', () => {
    const [, , , automacao] = trilhaDeConfiguracao({ ...nova, canais: 1, publicados: 1 })
    expect(automacao).toMatchObject({ href: '/ajustes/whatsapp' })
  })

  it('horário e conhecimento dizem o que falta', () => {
    const so = (f: Partial<FatosDaTrilha>) => trilhaDeConfiguracao({ ...nova, ...f })[2]
    expect(so({ temHorario: true })).toMatchObject({ motivo: 'Falta contar à IA o que o negócio faz', href: '/ajustes/contexto' })
    expect(so({ temConhecimento: true })).toMatchObject({ href: '/ajustes/horario' })
    expect(so({ temHorario: true, temConhecimento: true })?.estado).toBe('feito')
  })

  it('tudo feito', () => {
    const f: FatosDaTrilha = {
      empresa: { responsavel: 'Daniel', telefone: '', email: 'd@x.com' },
      canais: 1,
      temHorario: true,
      temConhecimento: true,
      publicados: 1,
      atendendo: 1,
      temContato: true,
    }
    expect(trilhaDeConfiguracao(f).every((p) => p.estado === 'feito' && p.motivo === null)).toBe(true)
  })
})
