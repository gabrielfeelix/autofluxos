import Link from 'next/link'
import { ContasAdmin } from '@/components/conta/contas-admin'
import { acaoVincularMembro } from '@/server/acoes-conta'
import { listarContasComMembros, listarUsuarios } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * As contas, para quem administra o painel.
 *
 * A tela é de operação, não de leitura: quem abre aqui quer entrar numa conta,
 * ou descobrir em qual delas ninguém consegue entrar. Busca, filtro, ordem e
 * cartão vivem em `components/conta/contas-admin.tsx`, que é cliente porque
 * busca e filtro são estado de tela — a página continua servindo os dados.
 */
export default async function Contas() {
  const [contas, usuarios] = await Promise.all([listarContasComMembros(), listarUsuarios()])
  const noAr = contas.filter((conta) => conta.noAr > 0).length

  return (
    <main className="w-full px-4 pt-[38px] pb-[46px] md:px-[46px]">
      <header className="mb-6">
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Contas</h1>
        {/*
          O resumo diz o tamanho da operação, e não o alarme.
          O que precisa de ação virou o chip "sem acesso", que além de contar
          filtra — aviso que não dá o que fazer só ensina a ignorar aviso.
        */}
        <p className="mt-1 text-[13px] text-muted">
          {contas.length} {contas.length === 1 ? 'conta' : 'contas'}
          {noAr > 0 && (
            <>
              {' · '}
              <span className="text-emerald-300/90">
                {noAr} atendendo {noAr === 1 ? 'gente' : 'gente'} agora
              </span>
            </>
          )}
        </p>
      </header>

      {usuarios.length === 0 && (
        <p className="app-card mb-4 px-5 py-4 text-[12.5px] leading-6 text-muted">
          Não existe nenhum usuário ainda.{' '}
          <Link
            href="/criar-conta"
            className="text-soft underline underline-offset-2 transition hover:text-accent"
          >
            Cadastre alguém
          </Link>{' '}
          antes de dar acesso a uma conta.
        </p>
      )}

      <ContasAdmin contas={contas} usuarios={usuarios} acaoVincular={acaoVincularMembro} />
    </main>
  )
}
