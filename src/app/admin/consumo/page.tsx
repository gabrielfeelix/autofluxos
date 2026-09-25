import Link from 'next/link'
import { BarraDeLista } from '@/components/design/barra-de-lista'
import { LinhaClicavel } from '@/components/lead/linha-clicavel'
import {
  COLUNA_FIXA,
  FUNDO_DA_FIXA,
  FUNDO_DA_LINHA,
  lerParametros,
  Numero,
  ordenar,
  SemResultado,
  Selo,
  Tabela,
  TelaDaAdministracao,
  ThOrdenavel,
} from '@/components/admin/partes'
import { comoTamanho, fracaoUsada, O_QUE_E_CONVERSA } from '@/core/planos'
import { FRANQUIA_DE_SERVICO, franquiaDoMes } from '@/core/franquia-da-meta'
import { consumoDaMetaDeTodas } from '@/server/consumo-da-meta'
import { chaveDoMes, consumoDeTodasAsContas } from '@/server/repos/plano'
import { planosVigentes } from '@/server/repos/planos'

export const dynamic = 'force-dynamic'

const BASE = '/admin/consumo'

const FAIXAS = [
  { valor: 'acima', rotulo: 'Acima do limite' },
  { valor: 'perto', rotulo: 'Perto do limite (80% ou mais)' },
  { valor: 'folga', rotulo: 'Com folga' },
  { valor: 'parada', rotulo: 'Sem conversa no mês' },
]

/**
 * O que cada organização usou neste mês, contra o que o plano comporta.
 * Nada aqui bloqueia nada: a medição existe para as faixas serem conferidas
 * antes de virarem cobrança.
 */
export default async function Consumo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = lerParametros(await searchParams)
  const [contas, planos, daMeta] = await Promise.all([consumoDeTodasAsContas(), planosVigentes(), consumoDaMetaDeTodas()])
  const mes = chaveDoMes(new Date())
  const planoDe = (id: string) => planos.find((plano) => plano.id === id) ?? planos[0]!
  const linhas = contas.map((conta) => {
    const plano = planoDe(conta.plano)
    // O número mais cheio da conta: a franquia da Meta é por número, e é ele que estoura primeiro.
    const meta = franquiaDoMes(daMeta.get(conta.clienteId) ?? [], mes)[0] ?? null
    return { ...conta, planoNome: plano.nome, limite: plano.conversas, fracao: fracaoUsada(conta.conversas, plano), meta }
  })

  const busca = (parametros.busca ?? '').trim().toLocaleLowerCase('pt-BR')
  const filtradas = linhas.filter((linha) => {
    if (busca && !linha.nome.toLocaleLowerCase('pt-BR').includes(busca)) return false
    if (parametros.plano && linha.plano !== parametros.plano) return false
    if (parametros.faixa === 'acima' && linha.fracao <= 1) return false
    if (parametros.faixa === 'perto' && linha.fracao < 0.8) return false
    if (parametros.faixa === 'folga' && (linha.fracao >= 0.8 || linha.conversas === 0)) return false
    if (parametros.faixa === 'parada' && linha.conversas > 0) return false
    return true
  })
  const lista = ordenar(
    filtradas,
    parametros,
    { nome: (l) => l.nome, plano: (l) => l.planoNome, conversas: (l) => l.conversas, uso: (l) => l.fracao, arquivos: (l) => l.arquivos, bytes: (l) => l.bytes, meta: (l) => l.meta?.usadas ?? -1 },
    { ordem: 'uso', direcao: 'desc' },
  )
  const temFiltro = !!(parametros.busca || parametros.plano || parametros.faixa)
  const total = linhas.reduce((soma, linha) => soma + linha.conversas, 0)
  const bytes = linhas.reduce((soma, linha) => soma + linha.bytes, 0)
  const ativas = linhas.filter((linha) => linha.conversas > 0).length
  const acima = linhas.filter((linha) => linha.fracao > 1).length
  const metaPerto = linhas.filter((linha) => linha.meta && linha.meta.nivel !== 'folga').length

  return (
    <TelaDaAdministracao titulo="Consumo" descricao={`O que cada organização usou neste mês, contra o que o plano comporta. ${O_QUE_E_CONVERSA}`}>
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Numero rotulo="Conversas no mês" valor={total.toLocaleString('pt-BR')} />
        <Numero rotulo="Organizações com conversa" valor={`${ativas} de ${linhas.length}`} />
        <Numero rotulo="Acima do limite" valor={acima} tom={acima > 0 ? 'perigo' : 'normal'} detalhe={acima > 0 ? 'hora de conversar sobre plano' : 'ninguém estourou'} />
        <Numero rotulo="Arquivos recebidos" valor={comoTamanho(bytes)} detalhe="só o que chegou pelas conversas" />
        <Numero rotulo="Grátis da Meta" valor={metaPerto} tom={metaPerto > 0 ? 'perigo' : 'normal'} detalhe={metaPerto > 0 ? `perto ou acima de ${FRANQUIA_DE_SERVICO.toLocaleString('pt-BR')} respostas` : 'todos com folga'} />
      </section>
      <div className="mb-3">
        <BarraDeLista
          base={BASE}
          parametros={parametros}
          busca={{ chave: 'busca', placeholder: 'Exemplo: Studio Vega', rotulo: 'Buscar organização' }}
          grupos={[
            { chave: 'faixa', titulo: 'Uso do plano', opcoes: FAIXAS },
            { chave: 'plano', titulo: 'Plano', opcoes: planos.map((plano) => ({ valor: plano.id, rotulo: plano.nome })) },
          ]}
          resumo={temFiltro ? `${lista.length} de ${linhas.length}` : `${linhas.length} ${linhas.length === 1 ? 'organização' : 'organizações'}`}
        />
      </div>
      {lista.length === 0 ? (
        <SemResultado titulo={temFiltro ? 'Nenhuma organização com estes filtros' : 'Nenhuma organização ainda'} limpar={temFiltro ? BASE : undefined} />
      ) : (
        <Tabela largura={1040}>
          <thead>
            <tr className="border-b border-line">
              <ThOrdenavel base={BASE} parametros={parametros} chave="nome" fixa>
                Organização
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="plano">
                Plano
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="uso" className="w-[260px]">
                Conversas do plano
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="meta" className="w-[180px]">
                Grátis da Meta
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="arquivos" className="text-right">
                Arquivos
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="bytes" className="text-right">
                Tamanho
              </ThOrdenavel>
            </tr>
          </thead>
          <tbody>
            {lista.map((linha) => {
              const estourou = linha.fracao > 1
              const perto = !estourou && linha.fracao >= 0.8
              return (
                <LinhaClicavel key={linha.clienteId} href={`/admin/organizacoes/${linha.clienteId}/plano`} className={`group cursor-pointer border-b border-line last:border-0 ${FUNDO_DA_LINHA}`}>
                  <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} px-4 py-3`}>
                    <Link href={`/admin/organizacoes/${linha.clienteId}/plano`} className="block truncate text-[13px] font-bold hover:text-primary">
                      {linha.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Selo tom="destaque">{linha.planoNome}</Selo>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className={`font-semibold tabular-nums ${estourou ? 'text-perigo' : perto ? 'text-aviso' : 'text-soft'}`}>
                        {linha.conversas.toLocaleString('pt-BR')} de {linha.limite.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-[11px] text-dim tabular-nums">{Math.round(linha.fracao * 100)}%</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface">
                      <span className={`block h-full rounded-full ${estourou ? 'bg-perigo' : perto ? 'bg-aviso' : 'bg-primary'}`} style={{ width: `${Math.min(100, Math.round(linha.fracao * 100))}%` }} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {linha.meta ? (
                      <span className={`text-[12px] font-semibold tabular-nums ${linha.meta.nivel === 'estourou' ? 'text-perigo' : linha.meta.nivel === 'perto' ? 'text-aviso' : 'text-soft'}`}>
                        {linha.meta.usadas.toLocaleString('pt-BR')} de {FRANQUIA_DE_SERVICO.toLocaleString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-[12px] text-dim">sem dado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{linha.arquivos.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right text-[12.5px] tabular-nums text-muted">{comoTamanho(linha.bytes)}</td>
                </LinhaClicavel>
              )
            })}
          </tbody>
        </Tabela>
      )}
      <p className="mt-3 text-[11.5px] text-dim">O tamanho conta só os arquivos que chegaram pelas conversas. O acervo de mídia mora no Storage e não entra nesta soma.</p>
    </TelaDaAdministracao>
  )
}
