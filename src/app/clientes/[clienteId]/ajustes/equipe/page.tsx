import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Trilha } from '@/components/design/trilha'
import Link from 'next/link'
import { TabelaDePessoas } from '@/components/admin/tabela-de-pessoas'
import { Distribuicao, type PessoaNaDistribuicao } from '@/components/conta/distribuicao'
import { acaoDarAcessoNaOrganizacao, acaoTrocarFuncao } from '@/server/acoes-pessoas'
import { acaoPendenciasDoMembro } from '@/server/acoes-acesso'
import { atorNaOrganizacao, pessoasNaHierarquia } from '@/server/pessoas'
import { funcoesVigentes } from '@/server/repos/funcoes'
import { pessoasDaOrganizacao } from '@/server/repos/organizacoes'
import { funcoesAtribuiveis, podeEditarPessoa, podeGerenciarPessoas, podeVerPessoa } from '@/core/funcoes'
import { acharCliente } from '@/server/repos/clientes'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'
import { ajustesDaConta, atendentesDaConta } from '@/server/repos/distribuicao'
import { contarAbertasPorAtendente } from '@/server/repos/leads'
import { conferirAcessoAoCliente, podeAdministrarConta } from '@/server/sessao'
import { capacidadesPorMembro, equipesPorMembro, listarEquipes } from '@/server/repos/equipes'
import { GerenciarEquipes } from '@/components/conta/gerenciar-equipes'
import { ehPapelDaConta, resumoDoAcesso } from '@/core/permissoes'

export const dynamic = 'force-dynamic'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
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
   * A distribuição é lida sempre, e não só quando há equipe: uma conta de uma
   * pessoa também pode ter ligado a trava de "só quem assumiu responde", e
   * esconder o cartão nesse caso deixaria a chave ligada sem tela para
   * desligá-la.
   *
   * As equipes e as sobrescritas entram aqui, e não numa busca por linha: a
   * tela desenha a lista inteira de uma vez, e uma consulta por pessoa daria
   * N+1 idas ao banco para montar a mesma resposta.
   *
   * As três primeiras degradam sozinhas (ver os repositórios) e as duas novas
   * também: esta tela não pode parar de abrir porque a leitura de equipe
   * falhou. Sem elas, o editor abre vazio, que é o estado de quem ainda não
   * configurou nada, e é honesto.
   */
  const [ajustes, configurados, abertas, equipesDaConta, porMembro, capacidades] =
    await Promise.all([
      ajustesDaConta(clienteId),
      atendentesDaConta(clienteId),
      contarAbertasPorAtendente(clienteId).catch(() => new Map<string, number>()),
      listarEquipes(clienteId).catch(() => []),
      equipesPorMembro(clienteId).catch(() => new Map<string, string[]>()),
      capacidadesPorMembro(clienteId).catch(() => new Map()),
    ])

  const pessoas: PessoaNaDistribuicao[] = equipe.map((membro) => {
    const ajuste = configurados.get(membro.id)
    return {
      id: membro.id,
      nome: membro.nome,
      papel: membro.papel,
      presenca: membro.presenca,
      entraNoRodizio: ajuste?.entraNoRodizio ?? null,
      tetoSimultaneo: ajuste?.tetoSimultaneo ?? null,
      abertas: abertas.get(membro.id) ?? 0,
    }
  })

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

  return (
    <AjustesShell cliente={cliente} ativa="equipe">
      <main className="w-full px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Pessoas' },
          ]}
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[25px] font-bold tracking-[-0.02em]">Pessoas</h1>
          <Link href={`/clientes/${cliente.id}/ajustes/equipe/funcoes`} className="text-[12.5px] font-semibold text-primary hover:underline">
            O que cada função pode fazer →
          </Link>
        </div>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          Quem trabalha nesta organização e com qual função. Você vê e muda só quem
          está abaixo de você. Só quem está aqui aparece para assumir conversa no Inbox.
        </p>

        <div className="mb-8 flex min-h-[320px] flex-col">
          <TabelaDePessoas
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
        </div>

        {podeMexer && (
          <GerenciarEquipes clienteId={clienteId} equipes={equipesDaConta} perda={perdaPorEquipe} />
        )}

        <Distribuicao
          clienteId={clienteId}
          distribuicao={ajustes.distribuicao}
          exigeAssumir={ajustes.exigeAssumir}
          pessoas={pessoas}
          podeMexer={podeMexer}
        />

      </main>
    </AjustesShell>
  )
}
