import { Suspense } from 'react'
import { acessoCompleto } from '@/server/permissoes'
import { resumoDoAcesso, ROTULO_DO_SUPORTE } from '@/core/permissoes'
import { PLANOS } from '@/core/planos'
import { podeAdministrarConta, contasDoUsuario } from '@/server/sessao'
import { presencaDoUsuario } from '@/server/repos/usuarios'
import { pedidosDePlano } from '@/server/repos/pedidos-de-plano'
import { NotificacoesDaFila } from '@/components/inbox/notificacoes-da-fila'
import { PerfilDaSessao } from '@/components/conta/voce'
import { contarDaBarra } from './barra-do-cliente'
import { liberaSecao } from './secoes-do-cliente'
import { Cabecalho, Sino, SinoCarregando, type AvisoDoCabecalho } from './cabecalho'

/**
 * O cabeçalho da organização, montado uma vez pelo `layout.tsx`, ao lado da
 * barra. Decide aqui, no servidor, o que cada papel recebe:
 *
 * - **Uso e plano / Meu plano / avisos de plano**: só quem administra a conta
 *   (proprietário, administrador ou o suporte da 4YU), a mesma régua de
 *   `ajustes/plano/page.tsx`. Consultor nem fica sabendo que existe.
 * - **Configurações**: quem pode abrir a seção (`liberaSecao`).
 */
export async function CabecalhoDoCliente({ clienteId }: { clienteId: string }) {
  const acesso = await acessoCompleto(clienteId)
  const [presenca, contas] = await Promise.all([
    presencaDoUsuario(acesso.sessao.usuario.id),
    contasDoUsuario(acesso.sessao.usuario.id),
  ])
  const base = `/clientes/${clienteId}`
  const administra = podeAdministrarConta(acesso)
  const suporte = acesso.papel === null

  // O provedor do perfil da barra não alcança o cabeçalho, que é irmão dela:
  // este tem o seu, para o nome e a foto aparecerem e a edição valer na hora.
  return (
    <PerfilDaSessao
      inicial={{
        nome: acesso.sessao.usuario.nome,
        imagem: acesso.sessao.usuario.imagem ?? null,
      }}
    >
      <Cabecalho
        base={base}
        email={acesso.sessao.usuario.email}
        papel={suporte ? ROTULO_DO_SUPORTE : (acesso.regras.nomeDaFuncao ?? resumoDoAcesso(acesso.regras).perfil)}
        suporte={suporte}
        presenca={presenca}
        planoHref={administra ? `${base}/ajustes/plano` : null}
        ajustesHref={liberaSecao(acesso.regras, 'ajustes') ? `${base}/ajustes` : null}
        outrasContas={contas.length}
        sino={
          <Suspense fallback={<SinoCarregando />}>
            <SinoDaConta clienteId={clienteId} administra={administra} />
          </Suspense>
        }
        avisosDoNavegador={<NotificacoesDaFila clienteId={clienteId} compacto />}
      />
    </PerfilDaSessao>
  )
}

/** Quantos dias uma resposta de pedido de plano fica no sino. */
const DIAS_NO_SINO = 30

/** A partir de quando uma resposta ainda aparece. Lido a cada visita, de propósito. */
function limiteDoSino(): number {
  return Date.now() - DIAS_NO_SINO * 86_400_000
}

async function SinoDaConta({ clienteId, administra }: { clienteId: string; administra: boolean }) {
  const avisos: AvisoDoCabecalho[] = []
  try {
    const [contagens, pedidos] = await Promise.all([
      contarDaBarra(clienteId),
      administra ? pedidosDePlano({ organizacaoId: clienteId }) : Promise.resolve([]),
    ])

    const limite = limiteDoSino()
    for (const pedido of pedidos) {
      const para = nomeDoPlano(pedido.para)
      if (pedido.situacao === 'aberto') {
        avisos.push({
          id: pedido.id,
          quando: pedido.quando,
          tom: 'info',
          titulo: `Pedido do plano ${para} em análise`,
          texto: 'A 4YU recebeu e responde por aqui. Até lá, o plano atual continua valendo.',
          href: `/clientes/${clienteId}/ajustes/plano`,
        })
      } else if (pedido.respondidoEm && new Date(pedido.respondidoEm).getTime() > limite) {
        const atendido = pedido.situacao === 'atendido'
        avisos.push({
          id: `${pedido.id}:resposta`,
          quando: pedido.respondidoEm,
          tom: atendido ? 'ok' : 'perigo',
          titulo: atendido ? `Plano ${para} aprovado` : `Pedido do plano ${para} recusado`,
          texto: atendido
            ? 'A troca foi feita. Os limites novos já valem para a organização.'
            : 'O plano continua o mesmo. Fale com a 4YU pela Ajuda para entender o motivo.',
          href: `/clientes/${clienteId}/ajustes/plano`,
        })
      }
    }
    avisos.sort((a, b) => (b.quando ?? '').localeCompare(a.quando ?? ''))

    // Atrasada é estado, não novidade: entra na lista, sem acender o ponto.
    if (contagens.atrasadas > 0) {
      avisos.push({
        id: 'atrasadas',
        quando: null,
        tom: 'perigo',
        titulo: contagens.atrasadas === 1 ? '1 atividade atrasada' : `${contagens.atrasadas} atividades atrasadas`,
        texto: 'Passou da hora e ninguém marcou como feita.',
        href: `/clientes/${clienteId}/atividades`,
      })
    }
  } catch {
    // O cabeçalho não é lugar de erro: sem aviso, o sino fica vazio.
  }
  return <Sino avisos={avisos} />
}

/*
 * `acharPlano` cai no Essencial quando não conhece o id, o que aqui diria o
 * plano errado para um plano criado na administração. O id cru é melhor.
 */
function nomeDoPlano(id: string): string {
  return PLANOS.find((plano) => plano.id === id)?.nome ?? id.charAt(0).toUpperCase() + id.slice(1)
}
