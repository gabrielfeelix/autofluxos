import type { ReactNode } from 'react'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { PainelVoce, PerfilDaSessao } from '@/components/conta/voce'
import { BarraLateral } from '@/components/design/barra-lateral'
import { ContextoDaAdministracao, MarcaDaAdministracao } from '@/components/admin/marca-da-administracao'
import { ITENS_DA_ADMINISTRACAO } from '@/components/design/secoes-da-administracao'
import { contarAlertasAbertos } from '@/server/repos/alertas'
import { exigirAdminDaPlataforma } from '@/server/sessao'
import { Badge, teto } from '@/components/design/pilula'

/**
 * A administração da plataforma: uma casca só, a mesma `BarraLateral` do app
 * da organização (ícones, grupos, recolher, tema, celular), com os itens da
 * plataforma no lugar das seções da organização.
 *
 * **Aqui `layout.tsx` é a escolha certa**, ao contrário do que acontece nas
 * telas da organização. `exigirAdminDaPlataforma()` roda uma vez, aqui, e
 * **toda** rota abaixo herda a conferência: uma tela nova nasce protegida sem
 * ninguém lembrar de protegê-la. As ações continuam conferindo por conta
 * própria, porque layout não roda de novo na navegação.
 */
export default async function LayoutDoAdmin({ children }: { children: ReactNode }) {
  const sessao = await exigirAdminDaPlataforma()
  const alertas = await contarAlertasAbertos().catch(() => 0)

  return (
    <PerfilDaSessao inicial={{ nome: sessao.usuario.nome, imagem: sessao.usuario.imagem ?? null }}>
      <div className="app-casca flex min-h-screen flex-col md:h-dvh md:flex-row md:overflow-hidden">
        <BarraLateral
          base="/admin"
          area="administracao"
          marca={<MarcaDaAdministracao />}
          voltar={null}
          contaNoTopo={<ContextoDaAdministracao />}
          itens={ITENS_DA_ADMINISTRACAO.map((item) => ({
            ...item,
            contador:
              item.chave === 'alertas' && alertas > 0 ? (
                <Badge tom="alerta" rotulo={`${alertas} alertas não vistos`}>
                  {teto(alertas)}
                </Badge>
              ) : undefined,
          }))}
          rodape={
            <PainelVoce email={sessao.usuario.email} papel="Administrador da plataforma" suporte={false} configuracoesHref={null} outrasContas={0} duasEtapas={sessao.usuario.duasEtapas === true}>
              {null}
            </PainelVoce>
          }
        />
        {/* Sem cabeçalho na administração: o quadro encosta no topo com a mesma folga da barra. */}
        <div className="app-quadro flex min-h-0 min-w-0 flex-1 flex-col md:mt-3">
          <div className="app-miolo-com-barra relative min-w-0 flex-1 md:overflow-auto">
            <FaixaDeImpersonacao />
            <div className="app-page-enter flex min-h-full flex-col md:h-full">{children}</div>
          </div>
        </div>
      </div>
    </PerfilDaSessao>
  )
}
