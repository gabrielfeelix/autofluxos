import Link from 'next/link'
import { BarraDeLista } from '@/components/design/barra-de-lista'
import { lerParametros, ordenar, SemResultado, TelaDaAdministracao, Th, ThOrdenavel } from '@/components/admin/partes'
import { TabelaDeUsuarios } from '@/components/admin/tabela-de-usuarios'
import { usuariosDaPlataforma, type UsuarioDaPlataforma } from '@/server/repos/usuarios-da-plataforma'
import { exigirAdminDaPlataforma } from '@/server/sessao'
import { listarOrganizacoes } from '@/server/repos/organizacoes'

export const dynamic = 'force-dynamic'

const BASE = '/admin/usuarios'

const SITUACOES = [
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'suspenso', rotulo: 'Suspensos' },
  { valor: 'sem-organizacao', rotulo: 'Sem organização' },
  { valor: 'nunca-entrou', rotulo: 'Nunca entraram' },
]

function passa(usuario: UsuarioDaPlataforma, situacao: string): boolean {
  if (situacao === 'ativo') return !usuario.suspenso
  if (situacao === 'suspenso') return usuario.suspenso
  if (situacao === 'sem-organizacao') return usuario.organizacoes.length === 0
  if (situacao === 'nunca-entrou') return usuario.ultimoAcesso === null
  return true
}

/**
 * Usuários: os logins da plataforma, e não as pessoas de uma organização.
 *
 * Um login pode estar em várias organizações com função diferente em cada; a
 * coluna Organizações mostra as duas primeiras com a função, e o resto no
 * "+N". Mudar a função é na aba Pessoas da organização, onde o clique leva.
 */
export default async function Usuarios({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = lerParametros(await searchParams)
  const [sessao, todos, organizacoes] = await Promise.all([exigirAdminDaPlataforma(), usuariosDaPlataforma(), listarOrganizacoes()])

  const busca = (parametros.busca ?? '').trim().toLocaleLowerCase('pt-BR')
  const filtrados = todos.filter((usuario) => {
    if (busca && ![usuario.nome, usuario.email, ...usuario.organizacoes.map((o) => o.nome)].some((texto) => texto.toLocaleLowerCase('pt-BR').includes(busca))) return false
    if (parametros.tipo === 'admin' && !usuario.adminDaPlataforma) return false
    if (parametros.tipo === 'usuario' && usuario.adminDaPlataforma) return false
    if (parametros.situacao && !passa(usuario, parametros.situacao)) return false
    return true
  })
  const lista = ordenar(
    filtrados,
    parametros,
    {
      nome: (u) => u.nome,
      organizacoes: (u) => u.organizacoes.length,
      sessoes: (u) => u.sessoesAtivas,
      ultimo: (u) => (u.ultimoAcesso ? Date.parse(u.ultimoAcesso) : null),
      criado: (u) => Date.parse(u.criadoEm),
    },
    { ordem: 'ultimo', direcao: 'desc' },
  )
  const temFiltro = !!(parametros.busca || parametros.tipo || parametros.situacao)

  return (
    <TelaDaAdministracao
      titulo="Usuários"
      descricao="Os logins da plataforma, as organizações de cada um e a função em cada uma. Convite por e-mail ainda não existe: a senha provisória é combinada fora daqui."
      acoes={
        <Link href="/criar-conta" className="app-primary-button px-[18px] py-2.5 text-[13px]">
          + Cadastrar usuário
        </Link>
      }
    >
      <div className="mb-3">
        <BarraDeLista
          base={BASE}
          parametros={parametros}
          busca={{ chave: 'busca', placeholder: 'Exemplo: nome, e-mail ou organização', rotulo: 'Buscar usuário' }}
          grupos={[
            { chave: 'situacao', titulo: 'Situação', opcoes: SITUACOES },
            { chave: 'tipo', titulo: 'Tipo', opcoes: [{ valor: 'admin', rotulo: 'Administradores da plataforma' }, { valor: 'usuario', rotulo: 'Usuários' }] },
          ]}
          resumo={temFiltro ? `${lista.length} de ${todos.length}` : `${todos.length} ${todos.length === 1 ? 'login' : 'logins'}`}
        />
      </div>
      {lista.length === 0 ? (
        <SemResultado titulo={temFiltro ? 'Nenhum usuário com estes filtros' : 'Nenhum usuário ainda'} limpar={temFiltro ? BASE : undefined} />
      ) : (
        <TabelaDeUsuarios
          key={JSON.stringify(parametros)}
          usuarios={lista.map((usuario) => ({ ...usuario, voce: usuario.id === sessao.usuario.id }))}
          organizacoes={organizacoes.map(({ id, nome }) => ({ id, nome }))}
          cabecalhos={
            <>
              <ThOrdenavel base={BASE} parametros={parametros} chave="nome" fixa>
                Usuário
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="organizacoes">
                Organizações e função
              </ThOrdenavel>
              <Th>Tipo</Th>
              <Th>Status</Th>
              <ThOrdenavel base={BASE} parametros={parametros} chave="sessoes" className="text-right">
                Sessões
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="ultimo">
                Último acesso
              </ThOrdenavel>
              <ThOrdenavel base={BASE} parametros={parametros} chave="criado">
                Criado
              </ThOrdenavel>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </>
          }
        />
      )}
    </TelaDaAdministracao>
  )
}
