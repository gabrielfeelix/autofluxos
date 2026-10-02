import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Distribuicao, PassarConversas, type PessoaNaDistribuicao } from '@/components/conta/distribuicao'
import { acharCliente } from '@/server/repos/clientes'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'
import { ajustesDaConta, atendentesDaConta, contarParaPassar } from '@/server/repos/distribuicao'
import { contarAbertasPorAtendente } from '@/server/repos/leads'
import { conferirAcessoAoCliente, podeAdministrarConta } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Quem recebe a conversa quando o bot passa para uma pessoa, e o lote para
 * dar dono ao que chegou antes da regra. Saiu da tela Pessoas em 02/out (ver
 * `conta/distribuicao.tsx`).
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await conferirAcessoAoCliente(clienteId)
  const podeMexer = acesso !== null && podeAdministrarConta(acesso)

  // Fala Postgres direto (ver a tela Pessoas): sem `DATABASE_URL`, cai para vazio.
  let equipe: MembroDaConta[] = []
  try {
    equipe = await membrosDaConta(clienteId)
  } catch (erro) {
    console.error('[distribuicao] não deu para ler a equipe', erro instanceof Error ? erro.message : erro)
  }

  const [ajustes, configurados, abertas, contagem] = await Promise.all([
    ajustesDaConta(clienteId),
    atendentesDaConta(clienteId),
    contarAbertasPorAtendente(clienteId).catch(() => new Map<string, number>()),
    contarParaPassar(clienteId, equipe.map((membro) => membro.id)),
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

  return (
    <AjustesShell cliente={cliente} ativa="distribuicao">
      <Miolo largura="leitura">
        <CabecalhoDaTela
          trilha={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Distribuição' },
          ]}
          titulo={<>Distribuição</>}
          descricao={<>Quem recebe a conversa quando o bot passa para uma pessoa. Cada mudança salva sozinha.</>}
        />
        <div className="flex flex-col gap-6">
          <Distribuicao
            clienteId={clienteId}
            distribuicao={ajustes.distribuicao}
            exigeAssumir={ajustes.exigeAssumir}
            pessoas={pessoas}
            podeMexer={podeMexer}
          />
          {pessoas.length > 0 && (
            <PassarConversas
              clienteId={clienteId}
              pessoas={pessoas.map(({ id, nome }) => ({ id, nome }))}
              contagem={contagem}
              podeMexer={podeMexer}
            />
          )}
        </div>
      </Miolo>
    </AjustesShell>
  )
}
