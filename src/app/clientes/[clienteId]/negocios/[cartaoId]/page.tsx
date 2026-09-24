import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { PaginaDoNegocio, type ItemDoHistorico } from '@/components/negocios/pagina-do-negocio'
import { fraseDaAtividade, fraseDoNegocio } from '@/core/negocios'
import { origemDoContato } from '@/core/contatos/origem'
import { pode } from '@/core/permissoes'
import { acharCliente } from '@/server/repos/clientes'
import { acharCartao, acharQuadro, listarQuadros, quadrosDoContato } from '@/server/repos/quadros'
import { historicoDoNegocio } from '@/server/repos/negocios'
import { atividadesDoCartao } from '@/server/repos/atividades'
import { fichaDoContato } from '@/server/repos/crm'
import { etiquetasDeContatos } from '@/server/repos/etiquetas'
import { listarMotivos } from '@/server/repos/motivos-de-perda'
import { membrosDaConta } from '@/server/repos/usuarios'
import { acessoCompleto } from '@/server/permissoes'

export const dynamic = 'force-dynamic'

/** Lido uma vez por render do servidor, pelo mesmo motivo do funil. */
function agoraDoServidor(): number {
  return Date.now()
}

/**
 * A página do negócio (F2, seção 5.1 do plano de 24/09).
 *
 * O diálogo do quadro continua sendo o gesto rápido; aqui é onde se trabalha
 * um negócio: etapa como degrau, histórico dele, contato e atividades ao lado.
 * Mora em CRM > Negócios (`ativa="quadros"`), então a permissão é a do funil.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string; cartaoId: string }>
}) {
  const { clienteId, cartaoId } = await params

  const [cliente, cartao] = await Promise.all([
    acharCliente(clienteId),
    acharCartao(clienteId, cartaoId),
  ])
  if (!cliente || !cartao) notFound()

  const agora = agoraDoServidor()

  const [quadro, quadros, ficha, eventos, atividades, funis, porContato, equipe, motivos, acesso] =
    await Promise.all([
      acharQuadro(clienteId, cartao.quadroId),
      listarQuadros(clienteId),
      fichaDoContato(clienteId, cartao.contatoId),
      historicoDoNegocio(clienteId, cartao.contatoId, cartao.id, cartao.criadoEm),
      atividadesDoCartao(clienteId, cartao.id),
      quadrosDoContato(clienteId, cartao.contatoId),
      etiquetasDeContatos([cartao.contatoId]),
      membrosDaConta(clienteId),
      listarMotivos(clienteId),
      acessoCompleto(clienteId),
    ])
  if (!quadro) notFound()

  /*
   * O histórico é evento **e** atividade. Atividade não vira evento no banco
   * (mora em `atividades`), e a aba "Atividades" do histórico sem elas seria
   * sempre vazia. A atividade entra na data em que foi feita, ou criada.
   */
  const historico: ItemDoHistorico[] = [
    ...eventos.map((evento) => ({
      id: evento.id,
      tipo: evento.tipo,
      frase: fraseDoNegocio(evento),
      autor: evento.autor,
      quando: evento.criadoEm,
    })),
    ...atividades.map((atividade) => ({
      id: `atividade:${atividade.id}`,
      tipo: 'atividade',
      frase: fraseDaAtividade(atividade.tipo, atividade.situacao, atividade.titulo),
      autor: atividade.responsavelNome,
      quando: atividade.concluidaEm ?? atividade.criadoEm,
    })),
  ].sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando))

  const origem = ficha ? origemDoContato(ficha.campos) : null
  const veValores = pode(acesso.regras, 'ler_valores', 'proprios')

  return (
    <ClienteShell cliente={cliente} ativa="quadros">
      <PaginaDoNegocio
        clienteId={clienteId}
        agora={agora}
        autor={acesso.sessao.usuario.nome ?? null}
        negocio={{
          ...cartao,
          valor: veValores ? cartao.valor : null,
          nome: ficha?.nome || cartao.nome,
        }}
        podeVerValor={veValores}
        quadro={{
          id: quadro.id,
          nome: quadro.nome,
          finalidade: quadro.finalidade,
          etapas: quadro.etapas.map(({ id, nome, tipo, cor }) => ({ id, nome, tipo, cor })),
          seguinte: quadros.find((q) => q.id === quadro.seguinteId)?.nome ?? null,
        }}
        outrosFunis={quadros
          .filter((q) => q.id !== quadro.id && q.etapas.length > 0)
          .map(({ id, nome }) => ({ id, nome }))}
        contato={{
          id: cartao.contatoId,
          nome: ficha?.nome || cartao.nome,
          telefone: ficha?.waId ?? cartao.telefone,
          ultimaEntradaEm: ficha?.ultimaEntradaEm ?? null,
          origem: origem ? (origem.deAnuncio && origem.titulo ? `Anúncio: ${origem.titulo}` : origem.rotulo) : null,
          etiquetas: (porContato.get(cartao.contatoId) ?? []).map(({ id, nome, cor }) => ({ id, nome, cor })),
        }}
        historico={historico}
        atividades={atividades
          .filter((a) => a.situacao === 'aberta')
          .map(({ id, tipo, titulo, prazo, horaMarcada }) => ({ id, tipo, titulo, prazo, horaMarcada }))}
        outrosNegocios={funis
          .filter((f) => f.cartaoId !== cartao.id)
          .map((f) => ({
            cartaoId: f.cartaoId,
            titulo: f.titulo,
            quadro: f.quadro,
            etapa: f.etapa,
            situacao: f.situacao,
            valor: veValores ? f.valor : null,
          }))}
        equipe={equipe.map(({ id, nome }) => ({ id, nome }))}
        motivos={motivos.map(({ id, nome }) => ({ id, nome }))}
      />
    </ClienteShell>
  )
}
