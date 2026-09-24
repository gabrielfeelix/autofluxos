import { describe, expect, it } from 'vitest'
import { filtrarTransmissoes, proximaAcaoDaTransmissao } from './transmissoes-na-tela'

const AGORA = new Date('2026-09-23T15:00:00Z')

function t(nome: string, estado: string, criadaEm: string, erro: string | null = null) {
  return { id: nome, nome, estado, criadaEm, quando: null, erro }
}

const [outubro, inverno, experimental] = [
  t('Lembrete de outubro', 'concluida', '2026-09-22T10:00:00Z'),
  t('Promoção de inverno', 'falhou', '2026-07-01T10:00:00Z', 'o modelo foi pausado ou reprovado pela Meta'),
  t('Aula experimental', 'agendada', '2026-09-20T10:00:00Z'),
]
const lista = [outubro, inverno, experimental]
const progressos: Record<string, { retida: number; falhou: number; na_fila: number }> = {
  'Lembrete de outubro': { retida: 0, falhou: 3, na_fila: 0 },
  'Promoção de inverno': { retida: 12, falhou: 1, na_fila: 0 },
  'Aula experimental': { retida: 0, falhou: 0, na_fila: 40 },
}
const de = (x: { id: string }) => progressos[x.id]
const nomes = (r: { nome: string }[]) => r.map((x) => x.nome)

describe('o recorte da lista de transmissões', () => {
  it('sem filtro devolve tudo', () => {
    expect(filtrarTransmissoes(lista, de, {}, AGORA)).toHaveLength(3)
  })

  it('busca pelo nome sem acento', () => {
    expect(nomes(filtrarTransmissoes(lista, de, { q: 'promocao' }, AGORA))).toEqual(['Promoção de inverno'])
  })

  it('filtra pelo estado e pelo que aconteceu com os destinatários', () => {
    expect(nomes(filtrarTransmissoes(lista, de, { estado: 'agendada' }, AGORA))).toEqual(['Aula experimental'])
    expect(nomes(filtrarTransmissoes(lista, de, { estado: 'com_retidas' }, AGORA))).toEqual(['Promoção de inverno'])
    expect(nomes(filtrarTransmissoes(lista, de, { estado: 'com_falhas' }, AGORA))).toEqual([
      'Lembrete de outubro',
      'Promoção de inverno',
    ])
  })

  it('filtra pelo período', () => {
    expect(nomes(filtrarTransmissoes(lista, de, { periodo: '7d' }, AGORA))).toEqual([
      'Lembrete de outubro',
      'Aula experimental',
    ])
  })

  it('valor desconhecido no endereço não esvazia a lista', () => {
    expect(filtrarTransmissoes(lista, de, { estado: 'xyz', periodo: '1ano' }, AGORA)).toHaveLength(3)
  })
})

describe('a próxima ação de cada transmissão', () => {
  it('modelo pausado leva aos modelos e diz que as retidas não foram entregues', () => {
    const r = proximaAcaoDaTransmissao(inverno, progressos['Promoção de inverno'], 'c1')
    expect(r?.link?.href).toBe('/clientes/c1/transmissoes?aba=modelos')
    expect(r?.texto).toMatch(/12 retidas não foram entregues/)
  })

  it('número desconectado leva à conexão do WhatsApp, com volta para a transmissão', () => {
    const r = proximaAcaoDaTransmissao(
      t('x', 'falhou', AGORA.toISOString(), 'este cliente não tem um número de WhatsApp conectado'),
      undefined,
      'c1',
    )
    expect(r?.link?.href).toBe(
      `/clientes/c1/ajustes/whatsapp?volta=${encodeURIComponent('/clientes/c1/transmissoes/x')}`,
    )
  })

  it('sem o id da transmissão, a conexão do WhatsApp abre sem volta', () => {
    const { nome, estado, criadaEm, quando, erro } = t(
      'x',
      'falhou',
      AGORA.toISOString(),
      'este cliente não tem um número de WhatsApp conectado',
    )
    const r = proximaAcaoDaTransmissao({ nome, estado, criadaEm, quando, erro }, undefined, 'c1')
    expect(r?.link?.href).toBe('/clientes/c1/ajustes/whatsapp')
  })

  it('falha sem ação possível diz que não há nova tentativa automática', () => {
    const r = proximaAcaoDaTransmissao(t('x', 'falhou', AGORA.toISOString(), 'erro qualquer'), undefined, 'c1')
    expect(r?.texto).toMatch(/não há nova tentativa automática/i)
    expect(r?.link).toBeUndefined()
  })

  it('concluída com falhas avisa que elas não voltam', () => {
    const r = proximaAcaoDaTransmissao(outubro, progressos['Lembrete de outubro'], 'c1')
    expect(r?.texto).toMatch(/3 não receberam, e não há nova tentativa automática/)
  })

  it('agendada sem nada de errado não tem próxima ação', () => {
    expect(proximaAcaoDaTransmissao(experimental, progressos['Aula experimental'], 'c1')).toBeNull()
  })
})
