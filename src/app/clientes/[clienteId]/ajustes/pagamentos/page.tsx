import { notFound } from 'next/navigation'
import { mercadoPagoConfigurado } from '@/channels/mercado-pago'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { CartaoDeConexao, GRADE_DE_CONEXOES } from '@/components/conexoes/cartao'
import { LogoMercadoPago } from '@/components/design/logos-de-marca'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { DesconectarMercadoPago } from '@/components/pagamentos/desconectar'
import { dataCurta } from '@/lib/quando'
import { acaoConectarMercadoPago } from '@/server/acoes-pagamentos'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { acharCliente } from '@/server/repos/clientes'
import { conexaoDePagamento } from '@/server/repos/pagamentos'

export const dynamic = 'force-dynamic'

/**
 * Pagamentos: onde o dono liga a conta em que o Pix da conversa cai
 * (docs/PLANO-COBRANCA-CAMADA-1.md, etapa A).
 *
 * **A frase de cima responde o medo antes da pergunta**: o dinheiro vai
 * direto para a conta dele, e o AutoFluxos não fica com nada no meio. É a
 * primeira coisa que um dono de negócio quer saber antes de ligar a conta do
 * banco em qualquer sistema.
 */

const RESULTADOS: Record<string, { texto: string; ok: boolean }> = {
  conectado: { texto: 'Mercado Pago conectado. As cobranças pela conversa já podem sair desta conta.', ok: true },
  cancelado: { texto: 'A conexão foi cancelada na tela do Mercado Pago. Nada mudou.', ok: false },
  outra_conta: { texto: 'Esta conta do Mercado Pago já está ligada a outra organização.', ok: false },
  falhou: { texto: 'Não foi possível conectar o Mercado Pago. Tente de novo.', ok: false },
}

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ resultado?: string }>
}) {
  const [{ clienteId }, busca] = await Promise.all([params, searchParams])
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [conexao, recusa] = await Promise.all([
    conexaoDePagamento(clienteId, 'mercado_pago'),
    recusaDoPlano(clienteId, 'integracoes'),
  ])
  const liberado = mercadoPagoConfigurado()
  const resultado = busca.resultado ? RESULTADOS[busca.resultado] : undefined

  return (
    <AjustesShell cliente={cliente} ativa="pagamentos">
      <Miolo largura="larga">
        {resultado && (
          <p
            className={`mb-4 rounded-[10px] border px-4 py-3 text-[12px] text-soft ${
              resultado.ok ? 'border-primary/30 bg-primary/[0.08]' : 'border-line bg-surface'
            }`}
          >
            {resultado.texto}
          </p>
        )}

        <div className="mb-[30px]">
          <CabecalhoDaTela
            trilha={[{ rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` }, { rotulo: 'Pagamentos' }]}
            titulo={<>Pagamentos</>}
            descricao={
              <>
                Conecte a conta do Mercado Pago da empresa para cobrar pela conversa, com Pix e link de
                pagamento. O dinheiro cai direto na sua conta, e o AutoFluxos não cobra porcentagem.
              </>
            }
          />
        </div>

        <div className={GRADE_DE_CONEXOES}>
          <CartaoDeConexao
            logo={<LogoMercadoPago />}
            selo={
              recusa ? (
                <Pilula>fora do plano</Pilula>
              ) : conexao ? (
                <Pilula tom="ok">conectado</Pilula>
              ) : liberado ? (
                <Pilula>não conectado</Pilula>
              ) : (
                <Pilula tom="aviso">em liberação</Pilula>
              )
            }
            titulo="Mercado Pago"
            categoria="Pix, cartão e boleto"
            rodape={
              recusa ? null : (
                <>
                  {liberado && (
                    <form action={acaoConectarMercadoPago.bind(null, clienteId)}>
                      <button type="submit" className={conexao ? 'botao-secundario botao-sm' : 'botao-primario botao-sm'}>
                        {conexao ? 'Reconectar' : 'Conectar com Mercado Pago'}
                      </button>
                    </form>
                  )}
                  {conexao && <DesconectarMercadoPago clienteId={clienteId} />}
                </>
              )
            }
          >
            {recusa ? (
              recusa
            ) : conexao ? (
              <>
                Conectado como <strong className="text-soft">{conexao.apelido ?? `conta ${conexao.contaNoGateway}`}</strong>
                {conexao.expiraEm && <>. O acesso se renova sozinho; o atual vale até {dataCurta(conexao.expiraEm)}.</>}
              </>
            ) : liberado ? (
              'Você entra na sua conta do Mercado Pago e autoriza. Nenhuma chave para copiar.'
            ) : (
              'A conexão com o Mercado Pago está sendo liberada pela equipe da 4YU.'
            )}
          </CartaoDeConexao>
        </div>
      </Miolo>
    </AjustesShell>
  )
}
