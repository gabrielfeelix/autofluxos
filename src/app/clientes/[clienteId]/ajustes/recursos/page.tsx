import Link from 'next/link'
import { capacidadeNaPagina } from '@/server/permissoes'
import { SemAcesso } from '@/components/design/sem-acesso'
import { onboardingDaConta } from '@/server/repos/onboarding'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Trilha } from '@/components/design/trilha'
import { EscolherObjetivo } from '@/components/recursos/escolher-objetivo'
import { EscolherTipoDeNegocio } from '@/components/recursos/escolher-tipo-de-negocio'
import { InterruptorDaLoja } from '@/components/recursos/interruptor-da-loja'
import { InterruptorDoCrm } from '@/components/recursos/interruptor-do-crm'
import { acharCliente } from '@/server/repos/clientes'
import { listarQuadros } from '@/server/repos/quadros'
import { lojaDaConta } from '@/server/repos/lojas'
import { lojaVisivel, nichoDaConta, recursosDaConta } from '@/server/repos/recursos'

export const dynamic = 'force-dynamic'

/**
 * Recursos: o que esta empresa usa do produto (UI-19, T7.1).
 *
 * ---------------------------------------------------------------------------
 * Por que esta tela existe
 * ---------------------------------------------------------------------------
 *
 * O CRM era obrigatório de fato. Não por trava: por tela. Os "primeiros passos"
 * cobravam "Organizar no funil" de toda conta, então quem abriu o produto para
 * atender no WhatsApp com a própria equipe terminava o que queria e a tela
 * continuava dizendo que faltava um passo, para sempre.
 *
 * O §4.2 da proposta pede o contrário: "empresa nova começa com
 * chatbot/inbox/contatos; CRM fica disponível em Configurações → Recursos, com
 * explicação e botão Ativar CRM para gestores".
 *
 * As duas escolhas moram juntas porque são a mesma pergunta vista de dois
 * lados: o objetivo diz **o que o produto vai cobrar de você**, e o interruptor
 * diz **o que ele vai mostrar**. Separá-las em duas telas faria a pessoa
 * responder duas vezes sem saber que eram a mesma conversa.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  if (!(await capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos'))) {
    const cliente = await acharCliente(clienteId)
    if (!cliente) notFound()
    return (
      <AjustesShell cliente={cliente} ativa="recursos">
        <SemAcesso clienteId={clienteId} oQue="Objetivo e recursos" />
      </AjustesShell>
    )
  }
  const onboarding = await onboardingDaConta(clienteId)
  const [cliente, recursos, quadros, lojaNoMenu, loja, nicho, podeTrocarTipo] = await Promise.all([
    acharCliente(clienteId),
    recursosDaConta(clienteId),
    listarQuadros(clienteId),
    lojaVisivel(clienteId),
    lojaDaConta(clienteId),
    nichoDaConta(clienteId),
    capacidadeNaPagina(clienteId, 'configurar_empresa', 'todos'),
  ])
  if (!cliente) notFound()

  return (
    <AjustesShell cliente={cliente} ativa="recursos">
      <main className="w-full max-w-[1100px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Objetivo e recursos' },
          ]}
        />
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Objetivo e recursos</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          O que esta conta usa do produto. Ninguém precisa de tudo: quem só quer
          atender mais rápido não precisa montar funil nem desenhar chatbot, e o
          produto não deveria ficar cobrando isso para sempre.
        </p>

        <section className="mb-6 rounded-xl border border-primary/20 bg-primary-weak p-5">
          <h2 className="text-base font-bold">Um começo pensado para sua organização</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Escolha sua forma de atender e confira os modelos recomendados. Seus funis e automações existentes são preservados.</p>
          <Link href={`/clientes/${cliente.id}/configurar`} className="app-primary-button mt-4 inline-flex px-4 py-2.5 text-sm">{onboarding?.status === 'concluido' ? 'Ver preparação e próximos passos' : onboarding ? 'Continuar preparação' : 'Abrir assistente de configuração'} →</Link>
        </section>

        <section className="app-card mb-5 overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Tipo de negócio</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-dim">
              Adapta o sistema ao seu ramo: nomes do menu, modelos prontos e as
              perguntas da ficha do assistente.
            </p>
          </header>
          <div className="px-5 py-4">
            <EscolherTipoDeNegocio clienteId={cliente.id} atual={nicho} podeTrocar={Boolean(podeTrocarTipo)} />
          </div>
        </section>

        <section className="app-card mb-5 overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Para que você usa o AutoFluxos</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-dim">
              É o que decide quais passos a tela inicial cobra. Dá para trocar
              quando quiser, e trocar não apaga nem cria nada.
            </p>
          </header>
          <div className="px-5 py-4">
            <EscolherObjetivo clienteId={cliente.id} atual={recursos.objetivo} />
          </div>
        </section>

        <section className="app-card overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[14.5px] font-bold">CRM</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-dim">
              Funis, negociações com valor e vendas. É opcional: o
              atendimento, o Inbox e os contatos funcionam sem ele.
            </p>
          </header>
          <div className="px-5 py-4">
            <InterruptorDoCrm
              clienteId={cliente.id}
              ativo={recursos.crmAtivo}
              temQuadro={quadros.length > 0}
            />
          </div>
        </section>

        <section className="app-card mt-5 overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Comércio</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-dim">
              Produtos e integração com a loja on-line, para o bot responder com
              o produto certo, o preço e o link. É opcional: quem atende sem
              vender produto pode esconder.
            </p>
          </header>
          <div className="px-5 py-4">
            <InterruptorDaLoja clienteId={cliente.id} ativo={lojaNoMenu} lojaConectada={Boolean(loja?.ativa)} />
          </div>
        </section>
      </main>
    </AjustesShell>
  )
}
