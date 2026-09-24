import { notFound } from 'next/navigation'
import { TabelaDePessoas } from '@/components/admin/tabela-de-pessoas'
import { NIVEL_DO_SUPORTE, funcoesAtribuiveis } from '@/core/funcoes'
import { acaoAdminDarAcesso, acaoAdminDefinirFuncao, acaoAdminPendencias, acaoAdminRemoverPessoa } from '@/server/acoes-admin'
import { listarEquipes } from '@/server/repos/equipes'
import { funcoesVigentes } from '@/server/repos/funcoes'
import { acharOrganizacao, pessoasDaOrganizacao } from '@/server/repos/organizacoes'
import { pessoasNaHierarquia } from '@/server/pessoas'
import { exigirAdminDaPlataforma } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Pessoas da organização, vistas pelo suporte.
 *
 * O suporte está fora da escada de funções (nível 5): vê todo mundo, troca
 * qualquer função e passa a posse. As ações conferem a plataforma no servidor.
 */
export default async function Pessoas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [sessao, organizacao] = await Promise.all([exigirAdminDaPlataforma(), acharOrganizacao(id)])
  if (!organizacao) notFound()

  const [pessoas, hierarquia, equipes, funcoes] = await Promise.all([
    pessoasDaOrganizacao(id),
    pessoasNaHierarquia(id),
    listarEquipes(id).catch(() => []),
    funcoesVigentes(),
  ])
  const nomeDaEquipe = new Map(equipes.map((equipe) => [equipe.id, equipe.nome]))

  return (
    <TabelaDePessoas
      clienteId={id}
      pessoas={pessoas.map((pessoa) => {
        const naHierarquia = hierarquia.get(pessoa.id)
        return {
          id: pessoa.id,
          nome: pessoa.nome,
          email: pessoa.email,
          funcao: naHierarquia?.funcao ?? 'atendente',
          equipes: (naHierarquia?.equipes ?? []).map((equipe) => nomeDaEquipe.get(equipe) ?? 'equipe'),
          suspensa: pessoa.banido,
          voce: pessoa.id === sessao.usuario.id,
          desde: pessoa.desde,
          ultimoAcesso: pessoa.ultimoAcesso,
          podeEditar: true,
        }
      })}
      funcoes={funcoesAtribuiveis({ nivel: NIVEL_DO_SUPORTE }).map((funcao) => ({
        valor: funcao,
        rotulo: funcoes.porId[funcao].nome,
        detalhe: funcoes.porId[funcao].descricao,
      }))}
      trocarFuncao={acaoAdminDefinirFuncao.bind(null, id)}
      pendencias={acaoAdminPendencias.bind(null, id)}
      remover={acaoAdminRemoverPessoa}
      darAcesso={acaoAdminDarAcesso.bind(null, id)}
    />
  )
}
