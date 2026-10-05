import { Miolo } from '@/components/design/miolo'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import Link from 'next/link'
import { TabelaDePessoas } from '@/components/admin/tabela-de-pessoas'
import { acaoDarAcessoNaOrganizacao, acaoTrocarFuncao } from '@/server/acoes-pessoas'
import { acaoPendenciasDoMembro } from '@/server/acoes-acesso'
import { atorNaOrganizacao, pessoasNaHierarquia } from '@/server/pessoas'
import { funcoesVigentes } from '@/server/repos/funcoes'
import { pessoasDaOrganizacao } from '@/server/repos/organizacoes'
import { funcoesAtribuiveis, podeEditarPessoa, podeGerenciarPessoas, podeVerPessoa } from '@/core/funcoes'
import { acharCliente } from '@/server/repos/clientes'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'
import { conferirAcessoAoCliente, podeAdministrarConta } from '@/server/sessao'
import { capacidadesPorMembro, equipesPorMembro, listarEquipes } from '@/server/repos/equipes'
import { GerenciarEquipes } from '@/components/conta/gerenciar-equipes'
import { ehPapelDaConta, resumoDoAcesso } from '@/core/permissoes'
import { Alternador } from '@/components/design/alternador'

export const dynamic = 'force-dynamic'

const DESCRICAO_DAS_PESSOAS =
  'Quem trabalha nesta organização e com qual função. Você vê e muda só quem está abaixo de você. Só quem está aqui aparece para assumir conversa no Inbox.'
const DESCRICAO_DAS_EQUIPES =
  'Equipes agrupam pessoas para o escopo "da equipe dela" no acesso. Uma pessoa pode estar em mais de uma.'

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const { clienteId } = await params
  const { aba: abaPedida } = await searchParams
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await conferirAcessoAoCliente(clienteId)
  const podeMexer = acesso !== null && podeAdministrarConta(acesso)

  /**
   * A lista fala Postgres direto (as tabelas do login ficam fora da Data API),
   * então ela pode estourar num ambiente sem `DATABASE_URL`. Cair para vazio é
   * o certo: a tela diz "ninguém ainda", que é a verdade enquanto não existe
   * usuário nenhum em produção.
   */
  let equipe: MembroDaConta[] = []
  try {
    equipe = await membrosDaConta(clienteId)
  } catch (erro) {
    console.error('[equipe] não deu para ler a equipe', erro instanceof Error ? erro.message : erro)
  }

  /*
   * As equipes e as sobrescritas entram aqui, e não numa busca por linha: a
   * tela desenha a lista inteira de uma vez, e uma consulta por pessoa daria
   * N+1 idas ao banco para montar a mesma resposta. Todas degradam sozinhas:
   * esta tela não pode parar de abrir porque uma leitura falhou.
   *
   * A distribuição saiu daqui em 02/out (`ajustes/distribuicao`).
   */
  const [equipesDaConta, porMembro, capacidades] =
    await Promise.all([
      listarEquipes(clienteId).catch(() => []),
      equipesPorMembro(clienteId).catch(() => new Map<string, string[]>()),
      capacidadesPorMembro(clienteId).catch(() => new Map()),
    ])

  /*
   * Quem cada equipe leva junto ao ser arquivada (E15). "Fica sem alcance" é
   * quem, sem esta equipe, passa a não alcançar contato nenhum: calculado pela
   * mesma regra do resumo, com a equipe tirada.
   */
  const perdaPorEquipe = Object.fromEntries(
    equipesDaConta.map((time) => {
      const dentro = equipe.filter((membro) => (porMembro.get(membro.id) ?? []).includes(time.id))
      return [
        time.id,
        dentro.map((membro) => ({
          nome: membro.nome,
          semAlcance: resumoDoAcesso({
            papel: ehPapelDaConta(membro.papel) ? membro.papel : null,
            usuarioId: membro.id,
            equipes: (porMembro.get(membro.id) ?? []).filter((id) => id !== time.id),
            sobrescritas: capacidades.get(membro.id) ?? {},
          }).semAlcance,
        })),
      ]
    }),
  )

  // A regra de hierarquia (plano da administração, §2): cada um vê a si e
  // quem está abaixo; o gestor, só os atendentes da equipe dele. O servidor
  // confere de novo em cada ação.
  const [ator, hierarquia, funcoes, datas] = await Promise.all([
    atorNaOrganizacao(clienteId),
    pessoasNaHierarquia(clienteId),
    funcoesVigentes(),
    pessoasDaOrganizacao(clienteId).catch(() => []),
  ])
  const visiveis = equipe.filter((membro) => {
    const alvo = hierarquia.get(membro.id)
    return alvo !== undefined && podeVerPessoa(ator, alvo)
  })
  const nomeDaEquipe = new Map(equipesDaConta.map((time) => [time.id, time.nome]))
  const desdeDe = new Map(datas.map((pessoa) => [pessoa.id, pessoa.desde]))
  const ultimoDe = new Map(datas.map((pessoa) => [pessoa.id, pessoa.ultimoAcesso]))

  /*
   * Usuários e Equipes em abas, cada uma com a própria ação no topo. Equipe só
   * aparece para quem administra a conta, que é quem pode criar e arquivar.
   */
  const aba = podeMexer && abaPedida === 'equipes' ? 'equipes' : 'usuarios'
  const base = `/clientes/${cliente.id}/ajustes/equipe`
  const trilha = [{ rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` }, { rotulo: 'Pessoas' }]
  const abas = podeMexer ? (
    <Alternador
      rotulo="Seções"
      ativa={aba}
      className="mb-5"
      opcoes={[
        { chave: 'usuarios', rotulo: 'Usuários', href: base },
        { chave: 'equipes', rotulo: 'Equipes', href: `${base}?aba=equipes` },
      ]}
    />
  ) : null

  return (
    <AjustesShell cliente={cliente} ativa="equipe">
      <Miolo largura="toda">
        <div className="mb-8 flex min-h-[320px] flex-col">
          {aba === 'equipes' ? (
            <GerenciarEquipes
              key="equipes"
              clienteId={clienteId}
              equipes={equipesDaConta}
              perda={perdaPorEquipe}
              topo={{ trilha, titulo: 'Pessoas', descricao: DESCRICAO_DAS_EQUIPES }}
              abaixoDoTopo={abas}
            />
          ) : (
          <TabelaDePessoas
            key="usuarios"
            topo={{
              trilha,
              titulo: 'Pessoas',
              descricao: DESCRICAO_DAS_PESSOAS,
              acoes: (
                <Link href={`/clientes/${cliente.id}/ajustes/equipe/funcoes`} className="quadro-tool">
                  Funções
                </Link>
              ),
            }}
            abaixoDoTopo={abas}
            clienteId={clienteId}
            pessoas={visiveis.map((membro) => ({
              id: membro.id,
              nome: membro.nome,
              email: membro.email,
              funcao: hierarquia.get(membro.id)?.funcao ?? 'atendente',
              equipes: (porMembro.get(membro.id) ?? []).map((id) => nomeDaEquipe.get(id) ?? 'equipe'),
              suspensa: false,
              voce: membro.id === ator.usuarioId,
              desde: desdeDe.get(membro.id) ?? new Date(0).toISOString(),
              ultimoAcesso: ultimoDe.get(membro.id) ?? null,
              podeEditar: podeEditarPessoa(ator, hierarquia.get(membro.id)!),
            }))}
            funcoes={funcoesAtribuiveis(ator).map((funcao) => ({ valor: funcao, rotulo: funcoes.porId[funcao].nome, detalhe: funcoes.porId[funcao].descricao }))}
            trocarFuncao={acaoTrocarFuncao.bind(null, clienteId)}
            pendencias={acaoPendenciasDoMembro.bind(null, clienteId)}
            darAcesso={podeGerenciarPessoas(ator) ? acaoDarAcessoNaOrganizacao.bind(null, clienteId) : undefined}
            acesso={{
              equipesDaConta,
              porPessoa: Object.fromEntries(
                visiveis
                  .filter((membro) => podeEditarPessoa(ator, hierarquia.get(membro.id)!))
                  .map((membro) => [
                    membro.id,
                    {
                      id: membro.id,
                      nome: membro.nome,
                      papel: membro.papel,
                      equipes: porMembro.get(membro.id) ?? [],
                      sobrescritas: capacidades.get(membro.id) ?? {},
                      base: funcoes.daTabela && hierarquia.get(membro.id) ? funcoes.porId[hierarquia.get(membro.id)!.funcao].capacidades : undefined,
                    },
                  ]),
              ),
            }}
          />
          )}
        </div>
      </Miolo>
    </AjustesShell>
  )
}
