import { notFound } from 'next/navigation'
import { mercadoPagoConfigurado } from '@/channels/mercado-pago'
import { ambienteDoPagBank, pagbankConfigurado } from '@/channels/pagbank'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { CartaoDeConexao, GRADE_DE_CONEXOES } from '@/components/conexoes/cartao'
import { LogoAsaas, LogoInfinitePay, LogoMercadoPago, LogoPagBank } from '@/components/design/logos-de-marca'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { ConectarAsaas } from '@/components/pagamentos/conectar-asaas'
import { ConectarInfinitePay } from '@/components/pagamentos/conectar-infinitepay'
import { NOME_DO_GATEWAY, type Gateway } from '@/channels/pagamento'
import { CriarModeloDeLembrete } from '@/components/pagamentos/modelo-de-lembrete'
import { NOME_DO_MODELO_DE_COBRANCA } from '@/core/mensalidade'
import { listarTemplates } from '@/server/repos/templates'
import { DesconectarPagamento } from '@/components/pagamentos/desconectar'
import { dataCurta } from '@/lib/quando'
import { acaoConectarMercadoPago, acaoConectarPagBank } from '@/server/acoes-pagamentos'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { acharCliente } from '@/server/repos/clientes'
import { conexaoAtiva } from '@/server/repos/pagamentos'

export const dynamic = 'force-dynamic'

/**
 * Pagamentos: onde o dono liga a conta em que o Pix da conversa cai
 * (docs/PLANO-COBRANCA-CAMADA-1.md, etapa A).
 *
 * **A frase de cima responde o medo antes da pergunta**: o dinheiro vai
 * direto para a conta dele, e o AutoFluxos não fica com nada no meio. É a
 * primeira coisa que um dono de negócio quer saber antes de ligar a conta do
 * banco em qualquer sistema.
 *
 * **Uma conta de recebimento por vez** (`conexaoAtiva`): com a outra ligada, o
 * cartão diz o que fazer em vez de mostrar um botão que não funcionaria.
 */

const RESULTADOS: Record<string, { texto: string; ok: boolean }> = {
  conectado: { texto: 'Mercado Pago conectado. As cobranças pela conversa já podem sair desta conta.', ok: true },
  cancelado: { texto: 'A conexão foi cancelada na tela do Mercado Pago. Nada mudou.', ok: false },
  outra_conta: { texto: 'Esta conta do Mercado Pago já está ligada a outra organização.', ok: false },
  falhou: { texto: 'Não foi possível conectar o Mercado Pago. Tente de novo.', ok: false },
  pagbank_conectado: { texto: 'PagBank conectado. As cobranças pela conversa já podem sair desta conta.', ok: true },
  pagbank_cancelado: { texto: 'A conexão foi cancelada na tela do PagBank. Nada mudou.', ok: false },
  pagbank_outra_conta: { texto: 'Esta conta do PagBank já está ligada a outra organização.', ok: false },
  pagbank_em_liberacao: { texto: 'O PagBank está sendo liberado pela equipe da 4YU. Nada mudou.', ok: false },
  pagbank_falhou: { texto: 'Não foi possível conectar o PagBank. Tente de novo.', ok: false },
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

  const [ativa, recusa] = await Promise.all([conexaoAtiva(clienteId), recusaDoPlano(clienteId, 'integracoes')])
  const conexao = ativa?.gateway === 'mercado_pago' ? ativa : null
  const asaas = ativa?.gateway === 'asaas' ? ativa : null
  const infinitepay = ativa?.gateway === 'infinitepay' ? ativa : null
  const pagbank = ativa?.gateway === 'pagbank' ? ativa : null
  // O dinheiro cai numa conta por vez: com outro gateway ligado, cada cartão diz qual e esconde o botão.
  const outro = (gateway: Gateway) => (ativa && ativa.gateway !== gateway ? ativa : null)
  const avisoDeOutro = ativa
    ? `As cobranças saem pelo ${NOME_DO_GATEWAY[ativa.gateway]}. Para receber por aqui, desconecte o ${NOME_DO_GATEWAY[ativa.gateway]} antes.`
    : ''
  const liberado = mercadoPagoConfigurado()
  const pagbankLiberado = pagbankConfigurado()
  const resultado = busca.resultado ? RESULTADOS[busca.resultado] : undefined
  const modelo = ativa
    ? ((await listarTemplates(clienteId).catch(() => [])).find((t) => t.nome === NOME_DO_MODELO_DE_COBRANCA) ?? null)
    : null

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
                Conecte a conta da empresa no Mercado Pago, no Asaas, na InfinitePay ou no PagBank para cobrar pela conversa, com Pix e link
                de pagamento. O dinheiro cai direto na sua conta, e o AutoFluxos não cobra porcentagem.
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
              ) : outro('mercado_pago') ? null : liberado ? (
                <Pilula>não conectado</Pilula>
              ) : (
                <Pilula tom="aviso">em liberação</Pilula>
              )
            }
            titulo="Mercado Pago"
            categoria="Pix, cartão e boleto"
            rodape={
              recusa || outro('mercado_pago') ? null : (
                <>
                  {liberado && (
                    <form action={acaoConectarMercadoPago.bind(null, clienteId)}>
                      <button type="submit" className={conexao ? 'botao-secundario botao-sm' : 'botao-primario botao-sm'}>
                        {conexao ? 'Reconectar' : 'Conectar com Mercado Pago'}
                      </button>
                    </form>
                  )}
                  {conexao && <DesconectarPagamento clienteId={clienteId} gateway="mercado_pago" />}
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
            ) : outro('mercado_pago') ? (
              avisoDeOutro
            ) : liberado ? (
              'Você entra na sua conta do Mercado Pago e autoriza. Nenhuma chave para copiar.'
            ) : (
              'A conexão com o Mercado Pago está sendo liberada pela equipe da 4YU.'
            )}
          </CartaoDeConexao>

          <CartaoDeConexao
            logo={<LogoAsaas />}
            selo={
              recusa ? (
                <Pilula>fora do plano</Pilula>
              ) : asaas ? (
                <Pilula tom={asaas.ambiente === 'teste' ? 'aviso' : 'ok'}>
                  {asaas.ambiente === 'teste' ? 'conectado em teste' : 'conectado'}
                </Pilula>
              ) : outro('asaas') ? null : (
                <Pilula>não conectado</Pilula>
              )
            }
            titulo="Asaas"
            categoria="Pix, cartão, boleto e nota fiscal"
            rodape={
              recusa || outro('asaas') ? null : (
                <>
                  <ConectarAsaas clienteId={clienteId} trocar={Boolean(asaas)} />
                  {asaas && <DesconectarPagamento clienteId={clienteId} gateway="asaas" />}
                </>
              )
            }
          >
            {recusa ? (
              recusa
            ) : asaas ? (
              <>
                Conectado como <strong className="text-soft">{asaas.apelido ?? 'conta do Asaas'}</strong>.
                {asaas.ambiente === 'teste'
                  ? ' Chave de sandbox: as cobranças são de teste e nenhum dinheiro de verdade se move.'
                  : ' A nota fiscal de serviço sai pelo próprio Asaas, se estiver ligada lá.'}
              </>
            ) : outro('asaas') ? (
              avisoDeOutro
            ) : (
              'Cole a chave de API da sua conta. O Asaas também emite a nota fiscal de serviço da cobrança paga.'
            )}
          </CartaoDeConexao>

          <CartaoDeConexao
            logo={<LogoInfinitePay />}
            selo={
              recusa ? (
                <Pilula>fora do plano</Pilula>
              ) : infinitepay ? (
                <Pilula tom="ok">conectado</Pilula>
              ) : outro('infinitepay') ? null : (
                <Pilula>não conectado</Pilula>
              )
            }
            titulo="InfinitePay"
            categoria="Pix sem taxa e cartão em até 12x"
            rodape={
              recusa || outro('infinitepay') ? null : (
                <>
                  <ConectarInfinitePay clienteId={clienteId} trocar={Boolean(infinitepay)} />
                  {infinitepay && <DesconectarPagamento clienteId={clienteId} gateway="infinitepay" />}
                </>
              )
            }
          >
            {recusa ? (
              recusa
            ) : infinitepay ? (
              <>
                Conectado como <strong className="text-soft">{infinitepay.apelido ?? 'conta da InfinitePay'}</strong>. A cobrança vai como
                link de pagamento: a pessoa escolhe Pix ou cartão na página da InfinitePay.
              </>
            ) : outro('infinitepay') ? (
              avisoDeOutro
            ) : (
              'Digite a InfiniteTag da empresa. Pix sem taxa para quem recebe; a cobrança vai como link, sem Pix copia e cola na conversa.'
            )}
          </CartaoDeConexao>

          <CartaoDeConexao
            logo={<LogoPagBank />}
            selo={
              recusa ? (
                <Pilula>fora do plano</Pilula>
              ) : pagbank ? (
                <Pilula tom={pagbank.ambiente === 'teste' ? 'aviso' : 'ok'}>
                  {pagbank.ambiente === 'teste' ? 'conectado em teste' : 'conectado'}
                </Pilula>
              ) : outro('pagbank') ? null : pagbankLiberado ? (
                <Pilula>não conectado</Pilula>
              ) : (
                <Pilula tom="aviso">em liberação</Pilula>
              )
            }
            titulo="PagBank"
            categoria="Pix copia e cola na conversa"
            rodape={
              recusa || outro('pagbank') ? null : (
                <>
                  {pagbankLiberado && (
                    <form action={acaoConectarPagBank.bind(null, clienteId)}>
                      <button type="submit" className={pagbank ? 'botao-secundario botao-sm' : 'botao-primario botao-sm'}>
                        {pagbank ? 'Reconectar' : 'Conectar com PagBank'}
                      </button>
                    </form>
                  )}
                  {pagbank && <DesconectarPagamento clienteId={clienteId} gateway="pagbank" />}
                </>
              )
            }
          >
            {recusa ? (
              recusa
            ) : pagbank ? (
              <>
                Conectado como <strong className="text-soft">{pagbank.apelido ?? `conta ${pagbank.contaNoGateway}`}</strong>.
                {pagbank.ambiente === 'teste' ? (
                  ' Conta de sandbox: as cobranças são de teste e nenhum dinheiro de verdade se move.'
                ) : pagbank.expiraEm ? (
                  <> O acesso se renova sozinho; o atual vale até {dataCurta(pagbank.expiraEm)}.</>
                ) : null}
              </>
            ) : outro('pagbank') ? (
              avisoDeOutro
            ) : pagbankLiberado ? (
              ambienteDoPagBank() === 'teste' ? (
                'Você entra na conta de sandbox do PagBank e autoriza. As cobranças serão de teste.'
              ) : (
                'Você entra na sua conta do PagBank e autoriza. Nenhuma chave para copiar. O PagBank pede o CPF ou CNPJ de quem paga.'
              )
            ) : (
              'A conexão com o PagBank está sendo liberada pela equipe da 4YU.'
            )}
          </CartaoDeConexao>
        </div>

        {ativa && !recusa && (
          <section className="app-card mt-[30px] px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[13.5px] font-bold">Lembrete de cobrança fora das 24 horas</h2>
              {modelo?.status === 'aprovado' ? (
                <Pilula tom="ok">aprovado</Pilula>
              ) : modelo?.status === 'pendente' ? (
                <Pilula tom="aviso">em análise na Meta</Pilula>
              ) : modelo?.status === 'recusado' ? (
                <Pilula tom="perigo">recusado</Pilula>
              ) : modelo && modelo.status !== 'rascunho' ? (
                <Pilula>{modelo.status}</Pilula>
              ) : (
                <Pilula>não criado</Pilula>
              )}
            </div>
            <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-5 text-soft">
              O WhatsApp só deixa mandar mensagem comum até 24 horas depois da última mensagem da pessoa. Para a mensalidade chegar a quem
              está quieto, ela vai por um modelo aprovado pela Meta, com o botão Pagar que abre o Pix. É um modelo de utilidade, cobrado
              pela Meta a cada envio.
            </p>
            {modelo?.status === 'recusado' && modelo.motivoRecusa && (
              <p className="mt-1.5 text-[12px] text-perigo">Motivo da Meta: {modelo.motivoRecusa}</p>
            )}
            {(!modelo || modelo.status === 'recusado' || modelo.status === 'rascunho') && (
              <div className="mt-3">
                <CriarModeloDeLembrete clienteId={clienteId} deNovo={Boolean(modelo)} />
              </div>
            )}
          </section>
        )}
      </Miolo>
    </AjustesShell>
  )
}
