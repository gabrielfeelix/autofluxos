import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Cartao, Etapa } from '@/core/quadros'

/*
 * As telas que mudaram com a revisão de 03/10/2026 (funil, negócio e agenda),
 * desenhadas de verdade. O que se prende aqui é o que a pessoa lê, não a
 * aritmética, que está nos testes de `core/`: o resumo aparece com os números
 * certos, o histórico diz data e hora, e "Atrasada" está escrito.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {}, prefetch: () => {} }),
  usePathname: () => '/clientes/c1/quadros',
  useSearchParams: () => new URLSearchParams(),
}))

const { Quadro } = await import('./quadro')
const { PaginaDoNegocio } = await import('@/components/negocios/pagina-do-negocio')
const { LinhaDaAgenda } = await import('@/components/atividades/linha-da-agenda')

/** 03/10/2026, 19:50 em São Paulo. */
const AGORA = Date.parse('2026-10-03T22:50:00Z')
const diasAtras = (dias: number) => new Date(AGORA - dias * 86_400_000).toISOString()

const ETAPAS: Etapa[] = [
  { id: 'novo', nome: 'Novo', ordem: 0, criadoEm: '2026-01-01T00:00:00Z', tipo: 'normal', limiteDeDias: null },
  { id: 'negociacao', nome: 'Negociação', ordem: 1, criadoEm: '2026-01-01T00:00:00Z', tipo: 'normal', limiteDeDias: null },
]

function cartao(id: string, extras: Partial<Cartao> = {}): Cartao {
  return {
    id,
    contatoId: `p-${id}`,
    colunaId: 'novo',
    nome: `Pessoa ${id}`,
    telefone: '5544999990000',
    entrouNaColunaEm: diasAtras(0),
    situacao: 'aberta',
    criadoEm: diasAtras(1),
    agenda: { abertas: 1, atrasadas: 0 },
    ...extras,
  }
}

describe('o funil com o resumo das etapas', () => {
  const html = renderToStaticMarkup(
    <Quadro
      clienteId="c1"
      quadroId="q1"
      etapas={ETAPAS}
      agora={AGORA}
      equipe={[]}
      motivos={[]}
      cartoesIniciais={[
        cartao('a', { entrouNaColunaEm: diasAtras(10) }),
        cartao('b', { agenda: { abertas: 0, atrasadas: 0 } }),
        cartao('c', { agenda: { abertas: 2, atrasadas: 2 } }),
      ]}
    />,
  )

  it('desenha o resumo em cada coluna, escondido até a preferência ligar', () => {
    expect(html.match(/class="resumo-da-etapa /g)).toHaveLength(ETAPAS.length)
    expect(html).toContain('parado')
    expect(html).toContain('sem atividade')
  })

  it('o botão Resumo está na barra, desligado no servidor', () => {
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*Resumo/s)
  })

  it('o cartão com atividade atrasada diz quantas', () => {
    expect(html).toContain('2 atividades atrasadas')
  })
})

describe('a página do negócio', () => {
  const negocio = {
    ...cartao('n1', { titulo: 'Plano anual', criadoEm: '2026-09-17T13:12:00Z' }),
    quadroId: 'q1',
    motivo: null,
    fechadoEm: null,
  }
  const html = renderToStaticMarkup(
    <PaginaDoNegocio
      clienteId="c1"
      agora={AGORA}
      autor="Eduardo"
      negocio={negocio}
      podeVerValor
      quadro={{ id: 'q1', nome: 'Comercial', finalidade: 'comercial', etapas: ETAPAS, seguinte: null }}
      outrosFunis={[{ id: 'q2', nome: 'Pós-venda' }]}
      contato={{ id: 'p-n1', nome: 'Ana', telefone: '5544999990000', ultimaEntradaEm: null, origem: null, etiquetas: [] }}
      historico={[{ id: 'h1', tipo: 'nota', frase: 'pediu desconto', autor: 'Eduardo', quando: '2026-10-03T22:46:00Z' }]}
      atividades={[{ id: 'a1', tipo: 'ligacao', titulo: 'Retornar', prazo: '2026-10-01T15:00:00Z', horaMarcada: true }]}
      outrosNegocios={[]}
      equipe={[]}
      motivos={[]}
    />,
  )

  it('o histórico e a última alteração dizem data e hora, com o relativo ao lado', () => {
    expect(html).toContain('03/10 às 19:46 · há 4 min')
  })

  it('criado em diz o dia e a hora', () => {
    expect(html).toContain('17/09 às 10:12')
  })

  it('a atividade aberta vencida aparece como Atrasada', () => {
    expect(html).toContain('Atrasada')
  })

  it('não nasce com aviso de troca de funil', () => {
    expect(html).not.toContain('Levando para o funil')
  })
})

describe('a linha da agenda', () => {
  const item = {
    id: 'a1',
    contatoId: 'p1',
    cartaoId: null,
    tipo: 'tarefa' as const,
    titulo: 'Mandar proposta',
    nota: null,
    onde: null,
    horaMarcada: false,
    prazo: '2026-09-30T12:00:00Z',
    responsavelId: null,
    responsavelNome: null,
    situacao: 'aberta' as const,
    concluidaEm: null,
    motivoDoCancelamento: null,
    criadoEm: '2026-09-01T10:00:00Z',
    contato: { id: 'p1', nome: 'Ana', telefone: '5544999990000' },
    negocio: null,
  }

  it('o status vem escrito na própria coluna', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <LinhaDaAgenda item={item} agora={AGORA} clienteId="c1" volta="/clientes/c1/atividades" />
        </tbody>
      </table>,
    )
    expect(html).toContain('Atrasada')
    expect(html).toContain('30/09')
  })
})
