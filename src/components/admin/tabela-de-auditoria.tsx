import Link from 'next/link'
import { BarraDeLista } from '@/components/design/barra-de-lista'
import { TIPOS_DE_ATO, verboDoAto } from '@/core/atos-da-auditoria'
import { horaExata, quando } from '@/lib/quando'
import type { LinhaDeAuditoria } from '@/server/repos/auditoria'
import { SemResultado, Selo, Tabela, Th } from './partes'

/**
 * O registro de auditoria em tabela, com busca e filtro por tipo de ato.
 *
 * Serve à tela Auditoria (a plataforma inteira, com a coluna Organização) e à
 * aba Auditoria do detalhe (uma organização só, sem ela). O filtro é feito
 * sobre as últimas linhas lidas, e o teto está escrito na tela: auditoria
 * cresce para sempre, e ninguém lê mil linhas.
 */
export function TabelaDeAuditoria({
  base,
  parametros,
  atos,
  comOrganizacao,
  teto,
}: {
  base: string
  parametros: Record<string, string>
  atos: LinhaDeAuditoria[]
  comOrganizacao: boolean
  teto: number
}) {
  const busca = (parametros.busca ?? '').trim().toLocaleLowerCase('pt-BR')
  const tipo = TIPOS_DE_ATO.find((item) => item.valor === parametros.tipo)
  const filtrados = atos.filter((ato) => {
    if (tipo && !tipo.acoes.includes(ato.acao)) return false
    if (parametros.suporte === 'sim' && ato.acao !== 'entrou_como' && !ato.impersonadoPor) return false
    if (busca && ![ato.autorEmail, ato.alvoNome, ato.contaNome, verboDoAto(ato.acao)].some((texto) => (texto ?? '').toLocaleLowerCase('pt-BR').includes(busca))) return false
    return true
  })
  const temFiltro = !!(parametros.busca || parametros.tipo || parametros.suporte)

  return (
    <>
      <div className="mb-3">
        <BarraDeLista
          base={base}
          parametros={parametros}
          busca={{ chave: 'busca', placeholder: comOrganizacao ? 'Exemplo: e-mail, pessoa ou organização' : 'Exemplo: e-mail ou pessoa', rotulo: 'Buscar na auditoria' }}
          grupos={[
            { chave: 'tipo', titulo: 'Tipo de ato', opcoes: TIPOS_DE_ATO.map(({ valor, rotulo }) => ({ valor, rotulo })) },
            { chave: 'suporte', titulo: 'Feito pelo suporte', opcoes: [{ valor: 'sim', rotulo: 'Só "entrar como"' }] },
          ]}
          resumo={temFiltro ? `${filtrados.length} de ${atos.length}` : `${atos.length === teto ? `últimos ${teto}` : atos.length} ${atos.length === 1 ? 'ato' : 'atos'}`}
        />
      </div>
      {filtrados.length === 0 ? (
        <SemResultado titulo={temFiltro ? 'Nenhum ato com estes filtros' : 'Nada registrado ainda'} limpar={temFiltro ? base : undefined} />
      ) : (
        <Tabela largura={comOrganizacao ? 900 : 720}>
          <thead>
            <tr className="border-b border-line">
              <Th className="w-[140px]">Quando</Th>
              <Th>Quem</Th>
              <Th>O que fez</Th>
              {comOrganizacao && <Th>Organização</Th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((ato) => {
              const suporte = ato.acao === 'entrou_como' || ato.impersonadoPor !== null
              return (
                <tr key={ato.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted">
                    <time dateTime={ato.quando} title={horaExata(ato.quando)}>
                      {quando(ato.quando)}
                    </time>
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    <span className="block truncate text-[12.5px] font-semibold">{ato.autorEmail || 'alguém'}</span>
                    {suporte && (
                      <span className="mt-1 inline-block">
                        <Selo tom="aviso">{ato.acao === 'entrou_como' ? 'entrar como' : 'dentro de um "entrar como"'}</Selo>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12.5px]">
                    <span className="text-muted">{verboDoAto(ato.acao)}</span> {ato.alvoNome && <strong className="font-semibold">{ato.alvoNome}</strong>}
                    <Detalhes detalhes={ato.detalhes} />
                  </td>
                  {comOrganizacao && (
                    <td className="max-w-[220px] px-4 py-3 text-[12.5px]">
                      {ato.contaId ? (
                        <Link href={`/admin/organizacoes/${ato.contaId}`} className="block truncate font-semibold hover:text-primary">
                          {ato.contaNome || 'ver organização'}
                        </Link>
                      ) : (
                        <span className="text-dim">{ato.contaNome || 'plataforma'}</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </Tabela>
      )}
      <p className="mt-3 text-[11.5px] text-dim">Mostra os últimos {teto} atos. Não dá para editar nem apagar, nem por aqui, nem pelo código.</p>
    </>
  )
}

/** Os detalhes que dizem alguma coisa a quem lê (plano de/para, função). */
function Detalhes({ detalhes }: { detalhes?: Record<string, unknown> }) {
  if (!detalhes) return null
  const partes: string[] = []
  if (typeof detalhes.de === 'string' && typeof detalhes.para === 'string') partes.push(`de ${detalhes.de} para ${detalhes.para}`)
  if (typeof detalhes.funcao === 'string') partes.push(`função: ${detalhes.funcao}`)
  if (typeof detalhes.papel === 'string') partes.push(`papel: ${detalhes.papel}`)
  if (partes.length === 0) return null
  return <span className="mt-0.5 block text-[11px] text-dim">{partes.join(' · ')}</span>
}
