import Link from 'next/link'
import { Suspense, cache } from 'react'
import { acessoCompleto, filtroDoAcesso } from '@/server/permissoes'
import { resumoDoAcesso } from '@/core/permissoes'
import { PainelVoce, PerfilDaSessao } from '@/components/conta/voce'
import { contagensDaAgenda } from '@/server/repos/atividades'
import { lerFiltroDaAgenda } from '@/core/atividades'
import { ContadorDaAgenda } from '@/components/atividades/contador-da-agenda'
import { NotificacoesDaFila } from '@/components/inbox/notificacoes-da-fila'
import { acaoDefinirPresenca } from '@/server/acoes-conta'
import type { Cliente } from '@/server/repos/clientes'
import { crmVisivel } from '@/server/repos/recursos'
import { presencaDoUsuario } from '@/server/repos/usuarios'
import { contasDoUsuario, ehAdminDaPlataforma } from '@/server/sessao'
import { BarraLateral } from './barra-lateral'
import { liberaSecao, secoesVisiveis } from './secoes-do-cliente'
import { LogoDoCliente } from './logo-cliente'
import { MarcaDeAdmin } from './marca-de-admin'
import { Marca } from './marca'

/**
 * A barra lateral da conta, montada **uma vez** pelo `layout.tsx`.
 *
 * Ela morava dentro da `ClienteShell`, que cada página desenhava de novo, e o
 * efeito era o que o dono descreveu: *"toda vez que eu mudo de página, a sidebar
 * atualiza junto"*. Trocar de tela desmontava a barra, o `loading.tsx` punha uma
 * barra falsa no lugar e a página montava outra real. No layout, o Next a
 * mantém entre as páginas e só o miolo troca.
 *
 * O item aceso não vem mais da página: a `BarraLateral` lê o caminho
 * (`aba-do-caminho.ts`).
 */
export async function BarraDoCliente({ cliente }: { cliente: Cliente }) {
  const acesso = await acessoCompleto(cliente.id)
  const [contas, presenca, mostraCrm] = await Promise.all([
    contasDoUsuario(acesso.sessao.usuario.id),
    presencaDoUsuario(acesso.sessao.usuario.id),
    crmVisivel(cliente.id),
  ])
  // O administrador da plataforma veio da lista de clientes e precisa do
  // caminho de volta. O dono do negócio, não: para ele não existe "todos os
  // clientes", existe a conta dele.
  const podeVerTodosOsClientes = ehAdminDaPlataforma(acesso.sessao)
  const base = `/clientes/${cliente.id}`

  return (
    <>
      {/*
        Grava no navegador quem é administrador, para o esqueleto de quem chega
        de fora reservar o espaço do "‹ Todos os clientes". Ver `MarcaDeAdmin`.
      */}
      <MarcaDeAdmin admin={podeVerTodosOsClientes} />
      <PerfilDaSessao
        inicial={{ nome: acesso.sessao.usuario.nome, imagem: acesso.sessao.usuario.imagem ?? null }}
      >
        <BarraLateral
          base={base}
          marca={<Marca />}
          voltarHref={podeVerTodosOsClientes ? '/painel' : undefined}
          presenca={presenca ?? undefined}
          conta={cliente.nome}
          contaNoTopo={<SeletorDeConta cliente={cliente} outrasContas={contas.length} />}
          voltar={
            podeVerTodosOsClientes ? (
              <Link
                href="/painel"
                className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-dim transition hover:text-primary md:mb-1.5 md:flex"
              >
                <span aria-hidden>‹</span> Todos os clientes
              </Link>
            ) : null
          }
          itens={secoesVisiveis({ crmVisivel: mostraCrm, regras: acesso.regras }).map((item) => ({
            chave: item.chave,
            rotulo: item.rotulo,
            href: `${base}${item.href}`,
            icone: item.icone,
            contador: item.chave === 'atividades' ? <Suspense fallback={null}><Pendencias clienteId={cliente.id} /></Suspense> : undefined,
          }))}
          rodape={
            <PainelVoce
              email={acesso.sessao.usuario.email}
              papel={`${resumoDoAcesso(acesso.regras).perfil} · ${cliente.nome}`}
              suporte={acesso.papel === null}
              configuracoesHref={liberaSecao(acesso.regras, 'ajustes') ? `${base}/ajustes` : null}
              outrasContas={contas.length}
            >
              {presenca && <Presenca atual={presenca} />}

              {/*
                O aviso de fila vive **aqui**, e não só no Inbox.

                Era o buraco do §3.10.1: o handoff acontecia e ninguém percebia, a
                não ser que a pessoa estivesse com o Inbox aberto. Quem está
                desenhando um fluxo ou conferindo contatos está no painel do mesmo
                jeito, e é justamente quem dá para avisar de graça.
              */}
              <NotificacoesDaFila clienteId={cliente.id} compacto />
            </PainelVoce>
          }
        />
      </PerfilDaSessao>
    </>
  )
}

/**
 * A conta atual no topo da barra, e o caminho para as outras.
 *
 * Morava no rodapé; subiu quando o rodapé passou a ser da pessoa (7.5). Vira
 * link para o seletor só quando a pessoa tem mais de uma companhia. Um botão
 * que abre uma lista de um item é atrito puro, e conta única é o caso comum.
 */
function SeletorDeConta({ cliente, outrasContas }: { cliente: Cliente; outrasContas: number }) {
  const miolo = (
    <>
      <LogoDoCliente cliente={cliente} tamanho={24} />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-muted">{cliente.nome}</span>
      {outrasContas > 1 && (
        <span aria-hidden className="text-[11px] text-dim">
          trocar
        </span>
      )}
    </>
  )

  if (outrasContas > 1) {
    return (
      <Link
        href="/contas"
        title="Trocar de conta"
        className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 transition hover:bg-surface"
      >
        {miolo}
      </Link>
    )
  }

  return <div className="flex items-center gap-2 px-2 py-1.5">{miolo}</div>
}

/**
 * Disponível ou ausente.
 *
 * Fica ao lado da conta, no rodapé, e não escondido num menu de perfil: é um
 * estado que a pessoa precisa **ver sem procurar**. Quem esquece de voltar de
 * "ausente" some da lista de quem pode receber conversa, e some sem erro nenhum
 * aparecer em lugar nenhum.
 */
function Presenca({ atual }: { atual: string }) {
  const disponivel = atual === 'disponivel'

  return (
    <form action={acaoDefinirPresenca.bind(null, disponivel ? 'ausente' : 'disponivel')}>
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left transition hover:bg-surface"
      >
        {/* Ponto **e** palavra: quem não distingue as duas cores lê o estado
            do mesmo jeito (WCAG 1.4.1). */}
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${disponivel ? 'bg-emerald-400' : 'bg-dim'}`}
        />
        <span className="flex-1 text-[13px] font-semibold text-muted">
          {disponivel ? 'Disponível' : 'Ausente'}
        </span>
        <span className="text-[11px] text-dim">trocar</span>
      </button>
    </form>
  )
}



/*
 * O contador aparece duas vezes na mesma resposta (barra do computador e barra
 * de baixo do celular): `cache` faz as duas lerem uma consulta só.
 */
const contarPendencias = cache(async (clienteId: string) => {
  try {
    const acesso = await acessoCompleto(clienteId)
    // Mesma regra dos atalhos da agenda: o número do menu e os da tela batem.
    return await contagensDaAgenda(
      clienteId,
      filtroDoAcesso(acesso, 'atender'),
      acesso.sessao.usuario.id,
      { ...lerFiltroDaAgenda({}), alcance: 'equipe' },
      Date.now(),
    )
  } catch {
    return null
  }
})

async function Pendencias({ clienteId }: { clienteId: string }) {
  const contagens = await contarPendencias(clienteId)
  const quantidade = contagens ? contagens.vencidas + contagens.hoje : 0
  if (!quantidade) return null
  const recorte = contagens!.vencidas > 0 ? 'vencidas' : 'hoje'
  return (
    <ContadorDaAgenda
      quantidade={quantidade}
      destino={`/clientes/${clienteId}/atividades?recorte=${recorte}&alcance=equipe`}
    />
  )
}
