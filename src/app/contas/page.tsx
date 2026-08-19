import Link from 'next/link'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { Marca } from '@/components/design/marca'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { acaoCriarCompanhia, acaoSair, acaoTrocarDeCompanhia } from '@/server/acoes-conta'
import { contasDoUsuario, ehAdminDaPlataforma, exigirUsuario } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/** O que cada papel do plugin de organização quer dizer em português. */
const PAPEIS: Record<string, string> = {
  owner: 'dono da conta',
  admin: 'administrador',
  member: 'equipe',
}

/**
 * As companhias desta pessoa.
 *
 * **Um usuário pode ter mais de uma**, e isso é estrutural desde a 0020 — o dono
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

  return (
    <div className="min-h-screen bg-canvas">
      <FaixaDeImpersonacao />

      <main className="app-page-enter mx-auto max-w-[1100px] px-4 pt-[46px] pb-[46px] md:px-6">
        <div className="mb-9 flex items-center justify-between gap-4">
          <Marca />
          <form action={acaoSair}>
            <button
              type="submit"
              className="rounded-[7px] px-1.5 py-1 text-[11.5px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
            >
              Sair
            </button>
          </form>
        </div>

        <header className="mb-6">
          <h1 className="text-[25px] font-bold tracking-[-0.02em]">
            Olá, {sessao.usuario.nome.split(' ')[0]}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {contas.length === 0
              ? 'Você ainda não está em nenhuma companhia.'
              : 'Escolha em qual companhia você vai trabalhar agora.'}
          </p>
        </header>

        {contas.length === 0 ? (
          <section className="app-card border-dashed px-8 py-12 text-center">
            <p className="text-[14px] font-semibold text-soft">Nenhuma companhia ainda</p>
            {/*
              O estado vazio conta **o que fazer**, e o que fazer aqui depende
              de quem está olhando: a conta de um cliente é criada pela 4YU
              junto com o número de WhatsApp dele. Estado vazio que ensina o
              caminho errado é pior que estado vazio mudo.
            */}
            <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-6 text-dim">
              A conta do seu negócio é criada pela 4YU junto com o número de WhatsApp. Se você
              deveria ver alguma coisa aqui, fale com quem administra o painel.
            </p>
          </section>
        ) : (
          <ul className="flex flex-col gap-2">
            {contas.map((conta) => (
              <li key={conta.id}>
                {/*
                  Formulário, e não link: trocar de companhia **escreve** na
                  sessão. Um `GET` que muda estado é o que faz o botão de voltar
                  do navegador desfazer coisas sem avisar.
                */}
                <form action={acaoTrocarDeCompanhia.bind(null, conta.id)}>
                  <button
                    type="submit"
                    className="app-card app-card-interactive flex w-full items-center gap-3.5 p-3.5 text-left"
                  >
                    <LogoDoCliente cliente={{ nome: conta.nome, logoUrl: conta.logoUrl }} tamanho={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold tracking-[-0.01em]">
                        {conta.nome}
                      </span>
                      <span className="block text-[11.5px] text-dim">
                        {PAPEIS[conta.papel] ?? conta.papel}
                      </span>
                    </span>
                    <span aria-hidden className="text-dim">
                      ›
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ModalFormulario
            botao={
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-lg leading-none">
                  +
                </span>
                Nova companhia
              </span>
            }
            titulo="Nova companhia"
            descricao="Ela nasce vazia — o primeiro fluxo e o número de WhatsApp vêm depois, na tela dela."
            action={acaoCriarCompanhia}
          >
            <label>
              <RotuloCampo>Nome da companhia</RotuloCampo>
              <input
                name="nome"
                required
                autoFocus
                placeholder="ex.: Estúdio Vega"
                className="app-field px-[13px] py-[11px] text-[13.5px]"
              />
            </label>
          </ModalFormulario>

          {ehAdminDaPlataforma(sessao) && (
            <Link
              href="/admin/contas"
              className="text-[12.5px] text-muted underline underline-offset-2 transition hover:text-accent"
            >
              Área de administração
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
