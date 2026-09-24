import Link from 'next/link'
import { BarraDeLista } from '@/components/design/barra-de-lista'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { LinhaClicavel } from '@/components/lead/linha-clicavel'
import {
  COLUNA_FIXA,
  FUNDO_DA_FIXA,
  FUNDO_DA_LINHA,
  lerParametros,
  ordenar,
  SemResultado,
  Selo,
  Tabela,
  TelaDaAdministracao,
  Th,
  ThOrdenavel,
} from '@/components/admin/partes'
import { dataCurta, horaExata, quando } from '@/lib/quando'
import { NovaOrganizacao } from '@/components/admin/nova-organizacao'
import { listarOrganizacoes, type OrganizacaoListada } from '@/server/repos/organizacoes'
import { planosVigentes } from '@/server/repos/planos'

export const dynamic = 'force-dynamic'

const BASE = '/admin/organizacoes'

const SITUACOES = [
  { valor: 'esperando', rotulo: 'Com gente esperando' },
  { valor: 'ativa', rotulo: 'Com conversa no mês' },
  { valor: 'parada', rotulo: 'Sem conversa no mês' },
  { valor: 'sem-pessoas', rotulo: 'Sem ninguém com acesso' },
  { valor: 'suspensa', rotulo: 'Suspensa' },
]

function situacaoDe(organizacao: OrganizacaoListada): string[] {
  const lista: string[] = []
  if (organizacao.suspensaEm) lista.push('suspensa')
  if (organizacao.esperando > 0) lista.push('esperando')
  lista.push(organizacao.conversasNoMes > 0 ? 'ativa' : 'parada')
  if (organizacao.pessoas === 0) lista.push('sem-pessoas')
  return lista
}

/**
 * Todas as organizações, em tabela.
 *
 * Era uma grade de cartões, e cartão não escala: com
 * quinze organizações a pergunta "qual está parada?" exigia ler quinze
 * cartões. Aqui cada coluna responde uma pergunta e ordena por ela, e o
 * filtro mora no endereço, como em Contatos.
 */
export default async function Organizacoes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const parametros = lerParametros(await searchParams)
  const [todas, planos] = await Promise.all([listarOrganizacoes(), planosVigentes()])
  const nomeDoPlano = new Map<string, string>(planos.map((plano) => [plano.id, plano.nome]))

  const busca = (parametros.busca ?? '').trim().toLocaleLowerCase('pt-BR')
  const filtradas = todas.filter((organizacao) => {
    if (busca && ![organizacao.nome, organizacao.responsavel, organizacao.email].some((texto) => texto.toLocaleLowerCase('pt-BR').includes(busca))) return false
    if (parametros.plano && (organizacao.plano || 'essencial') !== parametros.plano) return false
    if (parametros.situacao && !situacaoDe(organizacao).includes(parametros.situacao)) return false
    return true
  })
  const lista = ordenar(
    filtradas,
    parametros,
    {
      nome: (o) => o.nome,
      plano: (o) => nomeDoPlano.get(o.plano) ?? o.plano,
      pessoas: (o) => o.pessoas,
      esperando: (o) => o.esperando,
      conversas: (o) => o.conversasNoMes,
      automacoes: (o) => o.automacoesNoAr,
      ultima: (o) => (o.ultimaAtividade ? Date.parse(o.ultimaAtividade) : null),
      criada: (o) => Date.parse(o.criadaEm),
    },
    { ordem: 'esperando', direcao: 'desc' },
  )
  const temFiltro = !!(parametros.busca || parametros.plano || parametros.situacao)

  return (
    <TelaDaAdministracao
      titulo="Organizações"
      descricao="Quem usa o AutoFluxos: plano, quem tem acesso, quem espera e o uso do mês. Clique numa linha para abrir o detalhe."
      acoes={
        <NovaOrganizacao planos={planos} />
      }
    >
      <div className="mb-3">
        <BarraDeLista
          base={BASE}
          parametros={parametros}
          busca={{ chave: 'busca', placeholder: 'Exemplo: nome, responsável ou e-mail', rotulo: 'Buscar organização' }}
          grupos={[
            { chave: 'situacao', titulo: 'Situação', opcoes: SITUACOES },
            { chave: 'plano', titulo: 'Plano', opcoes: planos.map((plano) => ({ valor: plano.id, rotulo: plano.nome })) },
          ]}
          resumo={temFiltro ? `${lista.length} de ${todas.length}` : `${todas.length} ${todas.length === 1 ? 'organização' : 'organizações'}`}
        />
      </div>

      {lista.length === 0 ? (
        <SemResultado titulo={temFiltro ? 'Nenhuma organização com estes filtros' : 'Nenhuma organização ainda'} limpar={temFiltro ? BASE : undefined} />
      ) : (
        <Tabela largura={1080}>
          <thead>
            <tr className="border-b border-line">
              <ThOrdenavel base={BASE} parametros={parametros} chave="nome" fixa>
                Organização
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="plano">
                Plano
              </ThOrdenavel>
              <Th>Situação</Th>
              <ThOrdenavel base={BASE} parametros={parametros} chave="pessoas" className="text-right">
                Pessoas
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="esperando" className="text-right">
                Esperando
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="conversas" className="text-right">
                Conversas
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="automacoes" className="text-right">
                No ar
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="ultima">
                Última
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="criada">
                Criada
              </ThOrdenavel>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((organizacao) => (
              <LinhaClicavel key={organizacao.id} href={`${BASE}/${organizacao.id}`} className={`group cursor-pointer border-b border-line last:border-0 ${FUNDO_DA_LINHA}`}>
                <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} px-4 py-3`}>
                  <div className="flex items-center gap-3">
                    <LogoDoCliente cliente={organizacao} tamanho={32} />
                    <div className="min-w-0">
                      <Link href={`${BASE}/${organizacao.id}`} className="block truncate text-[13px] font-bold transition hover:text-primary">
                        {organizacao.nome}
                      </Link>
                      <span className="block truncate text-[11px] text-dim">{organizacao.responsavel || organizacao.email || 'sem responsável no cadastro'}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Selo tom="destaque">{nomeDoPlano.get(organizacao.plano) ?? nomeDoPlano.get('essencial') ?? 'Essencial'}</Selo>
                </td>
                <td className="px-4 py-3">
                  <Situacao organizacao={organizacao} />
                </td>
                <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">
                  {organizacao.pessoas === 0 ? <span className="text-aviso">0</span> : organizacao.pessoas}
                </td>
                <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">
                  {organizacao.esperando > 0 ? <strong className="text-aviso">{organizacao.esperando}</strong> : <span className="text-dim">0</span>}
                </td>
                <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{organizacao.conversasNoMes.toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{organizacao.automacoesNoAr}</td>
                <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted">
                  {organizacao.ultimaAtividade ? <span title={horaExata(organizacao.ultimaAtividade)}>{quando(organizacao.ultimaAtividade)}</span> : <span className="text-dim">sem conversa</span>}
                </td>
                <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted">
                  <span title={horaExata(organizacao.criadaEm)}>{dataCurta(organizacao.criadaEm)}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <Link href={`/clientes/${organizacao.id}`} className="app-secondary-button px-2.5 py-1 text-[11.5px] whitespace-nowrap" title="Abrir como Suporte 4YU">
                    Abrir
                  </Link>
                </td>
              </LinhaClicavel>
            ))}
          </tbody>
        </Tabela>
      )}
    </TelaDaAdministracao>
  )
}

function Situacao({ organizacao }: { organizacao: OrganizacaoListada }) {
  if (organizacao.suspensaEm) return <Selo tom="alerta">Suspensa</Selo>
  if (organizacao.pessoas === 0) return <Selo tom="aviso">Sem ninguém com acesso</Selo>
  if (organizacao.esperando > 0) return <Selo tom="aviso">Gente esperando</Selo>
  if (organizacao.conversasNoMes > 0) return <Selo tom="ok">Ativa</Selo>
  return <Selo>Sem conversa no mês</Selo>
}
