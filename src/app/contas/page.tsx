import Link from 'next/link'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { Marca } from '@/components/design/marca'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { acaoCriarCompanhia, acaoSair, acaoTrocarDeCompanhia } from '@/server/acoes-conta'
import { contasDoUsuario, ehAdminDaPlataforma, exigirUsuario } from '@/server/sessao'
import { ROTULO_DO_PAPEL } from '@/core/permissoes'
import { quando } from '@/lib/quando'
import { resumoDasContas, type ResumoDeAtendimento } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/** O que cada papel do plugin de organização quer dizer em português. */
const PAPEIS: Record<string, string> = ROTULO_DO_PAPEL

/**
 * As companhias desta pessoa, cada uma com o estado do atendimento.
 *
 * Era uma lista de nomes. Quem cuida de um grupo de empresas abre esta tela
 * para decidir **por onde começar**, e o nome não responde isso: o número de
 * conversas esperando, sim. Por isso cada cartão mostra quem espera, quantos
 * contatos e o último movimento, e o cabeçalho soma tudo numa frase.
 *
 * A ordem é alfabética e não por urgência de propósito: quem volta aqui todo
 * dia acha a empresa pela posição, e uma grade que se reorganiza a cada visita
 * tira isso.
 *
 * **Um usuário pode ter mais de uma**, e isso é estrutural desde a 0020, o dono
 * que tem dois negócios, ou a agência que administra os dois. Quem tem só uma
 * nunca vê esta tela: o login manda direto para a conta dela, porque um seletor
 * de um item é clique para confirmar o óbvio.
 *
 * Trocar de companhia escreve em `af_sessoes."activeOrganizationId"`, e não num
 * cookie próprio. É o que faz o servidor nunca precisar acreditar no navegador
 * sobre em qual conta a pessoa está.
 */
export default async function Contas() {
  const sessao = await exigirUsuario()
  const contas = await contasDoUsuario(sessao.usuario.id)
  const resumos = await resumoDasContas(contas.map((conta) => conta.id))
  const agora = agoraDoServidor()

  const comGenteEsperando = contas.filter((conta) => (resumos.get(conta.id)?.esperandoPessoa ?? 0) > 0)
  const totalEsperando = comGenteEsperando.reduce(
    (soma, conta) => soma + (resumos.get(conta.id)?.esperandoPessoa ?? 0),
    0,
  )

  return (
    <div className="min-h-screen bg-canvas">
      <FaixaDeImpersonacao />

      <main className="app-page-enter mx-auto max-w-[1180px] px-4 pt-[40px] pb-[64px] md:px-8">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Marca />
          <div className="flex items-center gap-1">
            {ehAdminDaPlataforma(sessao) && (
              <Link
                href="/admin"
                className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold text-muted transition hover:bg-surface hover:text-ink"
              >
                Área de administração
              </Link>
            )}
            <form action={acaoSair}>
              <button
                type="submit"
                className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-perigo"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        <header className="mb-8">
          <h1 className="text-[28px] font-bold tracking-[-0.025em]">
            Olá, {sessao.usuario.nome.split(' ')[0]}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {contas.length === 0 ? (
              'Você ainda não está em nenhuma organização.'
            ) : totalEsperando > 0 ? (
              <>
                <span className="font-semibold text-perigo">
                  {totalEsperando === 1 ? '1 conversa esperando' : `${totalEsperando} conversas esperando`}
                </span>{' '}
                {comGenteEsperando.length === 1
                  ? `em ${comGenteEsperando[0]?.nome}.`
                  : `em ${comGenteEsperando.length} companhias.`}{' '}
                Escolha por onde começar.
              </>
            ) : contas.length === 1 ? (
              'Tudo respondido. Escolha a organização para entrar.'
            ) : (
              `Tudo respondido nas suas ${contas.length} companhias. Escolha em qual trabalhar agora.`
            )}
          </p>
        </header>

        {contas.length === 0 ? (
          <section className="app-card border-dashed px-8 py-12 text-center">
            <p className="text-[14px] font-semibold text-soft">Nenhuma organização ainda</p>
            {/*
              O estado vazio conta **o que fazer**, e o que fazer mudou quando o
              cadastro abriu ao público: antes a conta nascia junto com a venda e
              este texto mandava falar com quem administra. Hoje a pessoa cria a
              dela, e mandá-la pedir a alguém seria ensinar o caminho errado,
              que é pior que estado vazio mudo.
            */}
            <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-6 text-dim">
              Crie a companhia do seu negócio para começar, leva menos de um minuto. Se você
              deveria fazer parte de uma que já existe, peça a quem cuida dela para adicionar o
              seu e-mail.
            </p>
            <div className="mt-5 flex justify-center">
              <Link href="/primeiro-acesso" className="app-primary-button px-[18px] py-2.5 text-[13px]">
                Criar minha companhia
              </Link>
            </div>
          </section>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contas.map((conta) => (
              <li key={conta.id}>
                {/*
                  Formulário, e não link: trocar de companhia **escreve** na
                  sessão. Um `GET` que muda estado é o que faz o botão de voltar
                  do navegador desfazer coisas sem avisar.
                */}
                <form action={acaoTrocarDeCompanhia.bind(null, conta.id, null)} className="h-full">
                  <CartaoDaConta
                    nome={conta.nome}
                    logoUrl={conta.logoUrl}
                    papel={PAPEIS[conta.papel] ?? conta.papel}
                    resumo={resumos.get(conta.id)}
                    agora={agora}
                  />
                </form>
              </li>
            ))}
            <li>
              <ModalFormulario
                variante="cartao"
                botao={
                  <>
                    <span
                      aria-hidden
                      className="flex size-10 items-center justify-center rounded-full border border-dashed border-current text-[20px] leading-none transition group-hover:border-solid"
                    >
                      +
                    </span>
                    <span>Nova organização</span>
                    <span className="-mt-1.5 text-[11.5px] font-normal text-dim">Outro negócio ou unidade</span>
                  </>
                }
                titulo="Nova organização"
                descricao="Ela nasce vazia, o primeiro fluxo e o número de WhatsApp vêm depois, na tela dela."
                action={acaoCriarCompanhia}
              >
                <label>
                  <RotuloCampo>Nome da organização</RotuloCampo>
                  <input
                    name="nome"
                    required
                    autoFocus
                    placeholder="Exemplo: Estúdio Vega"
                    className="app-field px-[13px] py-[11px] text-[13.5px]"
                  />
                </label>
              </ModalFormulario>
            </li>
          </ul>
        )}
      </main>
    </div>
  )
}

/** Fora do componente: a regra de pureza do React não aceita relógio no render. */
function agoraDoServidor(): number {
  return Date.now()
}

/**
 * Um cartão por companhia. O número grande é **quem espera**, porque é a
 * pergunta que traz a pessoa até aqui; contatos e último movimento ficam
 * menores, como contexto.
 */
function CartaoDaConta({
  nome,
  logoUrl,
  papel,
  resumo,
  agora,
}: {
  nome: string
  logoUrl: string
  papel: string
  resumo: ResumoDeAtendimento | undefined
  agora: number
}) {
  const esperando = resumo?.esperandoPessoa ?? 0
  const contatos = resumo?.contatos ?? 0
  const ultimo = resumo?.ultimaAtividade

  return (
    <button
      type="submit"
      className={`app-card app-card-interactive group flex h-full w-full flex-col p-5 text-left ${
        esperando > 0 ? 'border-perigo/35! bg-[linear-gradient(180deg,color-mix(in_oklab,var(--perigo)_6%,var(--panel)),var(--panel)_50%)]!' : ''
      }`}
    >
      <span className="flex items-center gap-3.5">
        <LogoDoCliente cliente={{ nome, logoUrl }} tamanho={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-bold tracking-[-0.01em] text-ink">{nome}</span>
          <span className="mt-1 inline-block rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-semibold text-muted">
            {papel}
          </span>
        </span>
      </span>

      <span className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-dim">Esperando</span>
          <span
            className={`mt-1 flex items-center gap-2 text-[24px] font-bold tabular-nums leading-none ${
              esperando > 0 ? 'text-perigo' : 'text-dim'
            }`}
          >
            {esperando > 0 && (
              <span aria-hidden className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-perigo opacity-60 motion-reduce:hidden" />
                <span className="relative size-2 rounded-full bg-perigo" />
              </span>
            )}
            {esperando}
          </span>
        </span>
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-dim">Contatos</span>
          <span className="mt-1 block text-[24px] font-bold tabular-nums leading-none text-ink">
            {contatos.toLocaleString('pt-BR')}
          </span>
        </span>
      </span>

      <span className="mt-auto flex items-center justify-between gap-3 pt-5 text-[11.5px]">
        <span className="truncate text-dim">
          {ultimo ? `Último movimento ${quando(ultimo.toISOString(), agora)}` : 'Nenhuma conversa ainda'}
        </span>
        <span className="flex shrink-0 items-center gap-1 font-semibold text-dim transition group-hover:text-primary">
          Entrar
          <span aria-hidden className="transition group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </span>
    </button>
  )
}
