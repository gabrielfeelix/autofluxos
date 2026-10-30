import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { enderecoDoAviso } from '@/channels/aviso-por-endereco'
import { vencimentoDoCertificado } from '@/channels/efi'
import { mercadoPagoConfigurado } from '@/channels/mercado-pago'
import { NOME_DO_GATEWAY, type Gateway } from '@/channels/pagamento'
import { ambienteDoPagBank, pagbankConfigurado } from '@/channels/pagbank'
import { stripeConfigurado } from '@/channels/stripe'
import { CartaoDeConexao } from '@/components/conexoes/cartao'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { CampoParaCopiar } from '@/components/design/copiar'
import {
  LogoAsaas,
  LogoEfi,
  LogoInfinitePay,
  LogoIugu,
  LogoMercadoPago,
  LogoPagarme,
  LogoPagBank,
  LogoPagHiper,
  LogoStripe,
  LogoWoovi,
} from '@/components/design/logos-de-marca'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { CatalogoDeGateways, type GrupoDeGateway, type ItemDoCatalogo } from '@/components/pagamentos/catalogo-de-gateways'
import { ConectarAsaas } from '@/components/pagamentos/conectar-asaas'
import { ConectarInfinitePay } from '@/components/pagamentos/conectar-infinitepay'
import { ConectarPorCampos } from '@/components/pagamentos/conectar-por-campos'
import { DesconectarPagamento } from '@/components/pagamentos/desconectar'
import { CriarModeloDeLembrete } from '@/components/pagamentos/modelo-de-lembrete'
import { NOME_DO_MODELO_DE_COBRANCA } from '@/core/mensalidade'
import { dataCurta } from '@/lib/quando'
import { acaoConectarMercadoPago, acaoConectarPagBank, acaoConectarStripe } from '@/server/acoes-pagamentos'
import { GATEWAYS_POR_CAMPOS } from '@/server/gateways-por-campos'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { acharCliente } from '@/server/repos/clientes'
import { acessoDaConexao, conexaoAtiva, type ConexaoDePagamento } from '@/server/repos/pagamentos'
import { listarTemplates } from '@/server/repos/templates'

export const dynamic = 'force-dynamic'

/**
 * Pagamentos: onde o dono liga a conta em que o Pix da conversa cai
 * (docs/PLANO-COBRANCA-CAMADA-1.md e docs/gateways/PLANO-GATEWAYS.md).
 *
 * **A frase de cima responde o medo antes da pergunta**: o dinheiro vai
 * direto para a conta dele, e o Dialogon não fica com nada no meio.
 *
 * **Uma conta de recebimento por vez** (`conexaoAtiva`). A ligada sobe para o
 * topo, sozinha, com o que dá para fazer com ela; as outras ficam no catálogo
 * abaixo, sem botão, com uma frase só dizendo que é preciso desconectar antes.
 * Dez cartões iguais repetindo "desconecte o Asaas" era ruído.
 *
 * **O catálogo é agrupado como o dono pensa** (carteira, maquininha, banco) e
 * tem busca: com dez opções, achar a sua não pode ser caça.
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
  stripe_conectado: { texto: 'Stripe conectado. As cobranças pela conversa já podem sair desta conta.', ok: true },
  stripe_cancelado: { texto: 'A conexão foi cancelada na tela do Stripe. Nada mudou.', ok: false },
  stripe_outra_conta: { texto: 'Esta conta do Stripe já está ligada a outra organização.', ok: false },
  stripe_falhou: { texto: 'Não foi possível conectar o Stripe. Tente de novo.', ok: false },
}

/** O que muda de um gateway para outro na tela. */
type Ficha = {
  gateway: Gateway
  grupo: GrupoDeGateway
  logo: ReactNode
  categoria: string
  termos: string
  /** Sem as credenciais da 4YU no ambiente, o cartão diz "em liberação". */
  liberado: boolean
  /** A frase de quem ainda não ligou. */
  convite: string
  /** O botão de ligar (ou de trocar, com a conexão na mão). */
  acao(conexao: ConexaoDePagamento | null): ReactNode
  /** O que se diz da conta ligada, depois de "Conectado como". */
  sobre?(conexao: ConexaoDePagamento): ReactNode
}

function BotaoDeLogin({ acao, rotulo, trocar }: { acao: () => Promise<void>; rotulo: string; trocar: boolean }) {
  return (
    <form action={acao}>
      <button type="submit" className={trocar ? 'botao-secundario botao-sm' : 'botao-primario botao-sm'}>
        {trocar ? 'Reconectar' : rotulo}
      </button>
    </form>
  )
}

function fichas(clienteId: string): Ficha[] {
  const porCampos = (gateway: Gateway) => (conexao: ConexaoDePagamento | null) => {
    const config = GATEWAYS_POR_CAMPOS[gateway]!
    return (
      <ConectarPorCampos
        clienteId={clienteId}
        gateway={gateway}
        nome={NOME_DO_GATEWAY[gateway]}
        tela={config.tela}
        trocar={Boolean(conexao)}
      />
    )
  }
  const expira = (conexao: ConexaoDePagamento) =>
    conexao.expiraEm ? <> O acesso se renova sozinho; o atual vale até {dataCurta(conexao.expiraEm)}.</> : null

  return [
    {
      gateway: 'mercado_pago',
      grupo: 'carteiras',
      logo: <LogoMercadoPago />,
      categoria: 'Pix, cartão e boleto',
      termos: 'mercadopago pix cartão boleto link',
      liberado: mercadoPagoConfigurado(),
      convite: 'Você entra na sua conta do Mercado Pago e autoriza. Nenhuma chave para copiar.',
      acao: (c) => (
        <BotaoDeLogin acao={acaoConectarMercadoPago.bind(null, clienteId)} rotulo="Conectar com Mercado Pago" trocar={Boolean(c)} />
      ),
      sobre: expira,
    },
    {
      gateway: 'asaas',
      grupo: 'carteiras',
      logo: <LogoAsaas />,
      categoria: 'Pix, cartão, boleto e nota fiscal',
      termos: 'pix cartão boleto nota fiscal recorrência mensalidade',
      liberado: true,
      convite: 'Cole a chave de API da sua conta. O Asaas também emite a nota fiscal de serviço da cobrança paga.',
      acao: (c) => <ConectarAsaas clienteId={clienteId} trocar={Boolean(c)} />,
      sobre: (c) => (c.ambiente === 'teste' ? null : ' A nota fiscal de serviço sai pelo próprio Asaas, se estiver ligada lá.'),
    },
    {
      gateway: 'woovi',
      grupo: 'carteiras',
      logo: <LogoWoovi />,
      categoria: 'Pix',
      termos: 'openpix pix',
      liberado: true,
      convite: 'Cole o AppID da conta. Pix com tarifa baixa, e a Woovi não pede o CPF de quem paga.',
      acao: porCampos('woovi'),
    },
    {
      gateway: 'paghiper',
      grupo: 'carteiras',
      logo: <LogoPagHiper />,
      categoria: 'Pix e boleto',
      termos: 'pix boleto',
      liberado: true,
      convite: 'Cole a apiKey e o token da conta. Pix com tarifa fixa por pagamento recebido; pede o CPF de quem paga.',
      acao: porCampos('paghiper'),
    },
    {
      gateway: 'stripe',
      grupo: 'carteiras',
      logo: <LogoStripe />,
      categoria: 'Cartão, boleto e Pix',
      termos: 'cartão internacional boleto pix link checkout',
      liberado: stripeConfigurado(),
      convite:
        'Você entra na sua conta do Stripe e autoriza. A cobrança vai com link de cartão e boleto, e com Pix quando o Stripe libera para o seu ramo.',
      acao: (c) => <BotaoDeLogin acao={acaoConectarStripe.bind(null, clienteId)} rotulo="Conectar com Stripe" trocar={Boolean(c)} />,
    },
    {
      gateway: 'iugu',
      grupo: 'carteiras',
      logo: <LogoIugu />,
      categoria: 'Pix e fatura',
      termos: 'pix fatura boleto cartão',
      liberado: true,
      convite: 'Cole um token de API da conta. A Iugu pede que um administrador aprove o token antes de ele funcionar.',
      acao: porCampos('iugu'),
    },
    {
      gateway: 'infinitepay',
      grupo: 'maquininhas',
      logo: <LogoInfinitePay />,
      categoria: 'Pix sem taxa e cartão em até 12x',
      termos: 'maquininha infinitetag pix cartão link',
      liberado: true,
      convite:
        'Digite a InfiniteTag da empresa. Pix sem taxa para quem recebe; a cobrança vai como link, sem Pix copia e cola na conversa.',
      acao: (c) => <ConectarInfinitePay clienteId={clienteId} trocar={Boolean(c)} />,
      sobre: () => ' A cobrança vai como link de pagamento: a pessoa escolhe Pix ou cartão na página da InfinitePay.',
    },
    {
      gateway: 'pagbank',
      grupo: 'maquininhas',
      logo: <LogoPagBank />,
      categoria: 'Pix copia e cola na conversa',
      termos: 'pagseguro maquininha pix',
      liberado: pagbankConfigurado(),
      convite:
        ambienteDoPagBank() === 'teste'
          ? 'Você entra na conta de sandbox do PagBank e autoriza. As cobranças serão de teste.'
          : 'Você entra na sua conta do PagBank e autoriza. Nenhuma chave para copiar. O PagBank pede o CPF ou CNPJ de quem paga.',
      acao: (c) => <BotaoDeLogin acao={acaoConectarPagBank.bind(null, clienteId)} rotulo="Conectar com PagBank" trocar={Boolean(c)} />,
      sobre: expira,
    },
    {
      gateway: 'pagarme',
      grupo: 'maquininhas',
      logo: <LogoPagarme />,
      categoria: 'Pix, para quem tem Stone',
      termos: 'stone ton pagarme pix',
      liberado: true,
      convite: 'Para quem recebe pela Stone: cole a chave secreta do Pagar.me. Pede o CPF de quem paga.',
      acao: porCampos('pagarme'),
    },
    {
      gateway: 'efi',
      grupo: 'bancos',
      logo: <LogoEfi />,
      categoria: 'Pix direto no banco',
      termos: 'efi gerencianet banco pix certificado',
      liberado: true,
      convite: 'Conta Efí Empresas: envie o certificado e as credenciais da aplicação. O Pix cai direto no banco, sem intermediário.',
      acao: porCampos('efi'),
    },
  ]
}

function Selo({ conexao, liberado }: { conexao: ConexaoDePagamento | null; liberado: boolean }) {
  if (conexao)
    return (
      <Pilula tom={conexao.ambiente === 'teste' ? 'aviso' : 'ok'}>
        {conexao.ambiente === 'teste' ? 'conectado em teste' : 'conectado'}
      </Pilula>
    )
  return liberado ? <Pilula>não conectado</Pilula> : <Pilula tom="aviso">em liberação</Pilula>
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
  const resultado = busca.resultado ? RESULTADOS[busca.resultado] : undefined
  const modelo = ativa
    ? ((await listarTemplates(clienteId).catch(() => [])).find((t) => t.nome === NOME_DO_MODELO_DE_COBRANCA) ?? null)
    : null
  const todas = fichas(clienteId)
  const daAtiva = ativa ? todas.find((f) => f.gateway === ativa.gateway) : undefined

  // O que só existe com a conta ligada: o endereço que o dono cola no Pagar.me, e quando vence o certificado da Efí.
  const avisoManual = ativa && GATEWAYS_POR_CAMPOS[ativa.gateway]?.tela.avisoManual ? enderecoDoAviso(ativa.gateway, clienteId) : null
  const certificadoVence =
    ativa?.gateway === 'efi'
      ? await acessoDaConexao(clienteId, 'efi')
          .then((a) => (a ? vencimentoDoCertificado(a) : null))
          .catch(() => null)
      : null

  const itens: ItemDoCatalogo[] = todas
    .filter((f) => f.gateway !== ativa?.gateway)
    .map((f) => ({
      id: f.gateway,
      nome: NOME_DO_GATEWAY[f.gateway],
      grupo: f.grupo,
      termos: `${f.categoria} ${f.termos}`,
      cartao: (
        <CartaoDeConexao
          logo={f.logo}
          selo={recusa ? <Pilula>fora do plano</Pilula> : ativa ? null : <Selo conexao={null} liberado={f.liberado} />}
          titulo={NOME_DO_GATEWAY[f.gateway]}
          categoria={f.categoria}
          rodape={recusa || ativa || !f.liberado ? null : f.acao(null)}
        >
          {recusa
            ? recusa
            : f.liberado
              ? f.convite
              : `A conexão com o ${NOME_DO_GATEWAY[f.gateway]} está sendo liberada pela equipe da 4YU.`}
        </CartaoDeConexao>
      ),
    }))

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
                Conecte a conta em que a empresa já recebe para cobrar pela conversa, com Pix e link de pagamento. O dinheiro cai direto na
                sua conta, e o Dialogon não cobra porcentagem.
              </>
            }
          />
        </div>

        {ativa && daAtiva && (
          <section aria-label="Conta de recebimento" className="mb-[30px]">
            <h2 className="mb-2.5 text-[11px] font-bold tracking-[0.06em] text-dim uppercase">Conta de recebimento</h2>
            <div className="app-card flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
              {daAtiva.logo}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-bold tracking-[-0.01em]">{NOME_DO_GATEWAY[ativa.gateway]}</p>
                  {recusa ? <Pilula>fora do plano</Pilula> : <Selo conexao={ativa} liberado />}
                </div>
                <p className="mt-0.5 text-[11px] font-semibold text-dim">{daAtiva.categoria}</p>
                <p className="mt-2 max-w-[720px] text-[12.5px] leading-5 text-muted">
                  {recusa ? (
                    recusa
                  ) : (
                    <>
                      Conectado como <strong className="text-soft">{ativa.apelido ?? `conta ${ativa.contaNoGateway}`}</strong>.
                      {ativa.ambiente === 'teste'
                        ? ' Conta de teste: as cobranças são de mentira e nenhum dinheiro de verdade se move.'
                        : daAtiva.sobre?.(ativa)}
                      {certificadoVence && (
                        <> O certificado vence em {dataCurta(certificadoVence.toISOString())}; gere outro na Efí antes disso.</>
                      )}
                    </>
                  )}
                </p>
                {avisoManual && !recusa && (
                  <div className="mt-3 max-w-[720px]">
                    <p className="mb-1.5 text-[12px] leading-5 text-soft">{GATEWAYS_POR_CAMPOS[ativa.gateway]?.tela.avisoManual}</p>
                    <CampoParaCopiar
                      valor={avisoManual}
                      rotuloAcessivel={`Endereço do aviso de pagamento para o ${NOME_DO_GATEWAY[ativa.gateway]}`}
                    />
                  </div>
                )}
                {!recusa && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {daAtiva.acao(ativa)}
                    <DesconectarPagamento clienteId={clienteId} gateway={ativa.gateway} />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {ativa && !recusa && (
          <p className="mb-3 text-[12px] leading-5 text-muted">
            O dinheiro cai numa conta por vez. Para receber por outra, desconecte o {NOME_DO_GATEWAY[ativa.gateway]} antes.
          </p>
        )}
        <CatalogoDeGateways itens={itens} />

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
