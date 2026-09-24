import 'server-only'
import { funcaoDerivada, type IdDaFuncao } from '@/core/funcoes'
import { CAPACIDADES, POLITICAS, ehCapacidade, ehEscopo, ehPapelDaConta, type Politica } from '@/core/permissoes'
import { bancoDoLogin } from '../auth'
import { funcoesVigentes } from './funcoes'

/**
 * Os logins da plataforma, com as organizações e a função em cada uma.
 *
 * Usuário e pessoa da organização não são a mesma coisa: um login pode estar
 * em várias organizações, com função diferente em cada (o grupo de empresas).
 * Esta lista é a dos logins; a função de cada vínculo sai da mesma regra da
 * tela Pessoas (`funcaoDerivada`, ou a função gravada quando a tabela existe),
 * numa consulta só, com as exceções agregadas.
 */

export type VinculoDoUsuario = { id: string; nome: string; funcao: IdDaFuncao }

export type UsuarioDaPlataforma = {
  id: string
  nome: string
  email: string
  imagem: string | null
  adminDaPlataforma: boolean
  suspenso: boolean
  criadoEm: string
  sessoesAtivas: number
  ultimoAcesso: string | null
  organizacoes: VinculoDoUsuario[]
}

type Vinculo = { id: string; nome: string; papel: string; funcao_id: string | null; excecoes: Record<string, string> | null }

export async function usuariosDaPlataforma(): Promise<UsuarioDaPlataforma[]> {
  const [{ rows }, funcoes] = await Promise.all([
    bancoDoLogin().query(
      `select u.id,
              u."name" as nome,
              u.email,
              u.image as imagem,
              coalesce(u."role", '') as papel,
              coalesce(u."banned", false) as banido,
              u."createdAt" as criado_em,
              (select count(*)::int from public.af_sessoes s where s."userId" = u.id and s."expiresAt" > now()) as sessoes,
              (select max(s."createdAt") from public.af_sessoes s where s."userId" = u.id) as ultimo,
              coalesce(
                (select json_agg(json_build_object(
                          'id', c.id,
                          'nome', c.nome,
                          'papel', m."role",
                          'funcao_id', to_jsonb(m) ->> 'funcao_id',
                          'excecoes', (select json_object_agg(mc.capacidade, mc.escopo)
                                         from public.membro_capacidades mc
                                        where mc.client_id = c.id and mc.usuario_id = u.id)
                        ) order by c.nome)
                   from public.af_membros m
                   join public.clients c on c.id = m."organizationId"
                  where m."userId" = u.id),
                '[]'
              ) as vinculos
         from public.af_usuarios u
        order by u."createdAt"`,
    ),
    funcoesVigentes(),
  ])

  return rows.map((linha) => ({
    id: String(linha.id),
    nome: String(linha.nome),
    email: String(linha.email),
    imagem: linha.imagem ? String(linha.imagem) : null,
    adminDaPlataforma: String(linha.papel).split(',').includes('admin'),
    suspenso: Boolean(linha.banido),
    criadoEm: new Date(linha.criado_em).toISOString(),
    sessoesAtivas: Number(linha.sessoes),
    ultimoAcesso: linha.ultimo ? new Date(linha.ultimo).toISOString() : null,
    organizacoes: (linha.vinculos as Vinculo[]).map((vinculo) => {
      const papel = ehPapelDaConta(vinculo.papel) ? vinculo.papel : 'member'
      const gravada = funcoes.daTabela && vinculo.funcao_id && vinculo.funcao_id in funcoes.porId ? (vinculo.funcao_id as IdDaFuncao) : null
      const base: Politica = gravada ? funcoes.porId[gravada].capacidades : POLITICAS[papel]
      const politica = Object.fromEntries(
        CAPACIDADES.map((capacidade) => {
          const excecao = vinculo.excecoes?.[capacidade]
          return [capacidade, excecao && ehCapacidade(capacidade) && ehEscopo(excecao) ? excecao : base[capacidade]]
        }),
      ) as Politica
      return { id: String(vinculo.id), nome: String(vinculo.nome), funcao: gravada ?? funcaoDerivada(papel, politica, funcoes.porId) }
    }),
  }))
}
