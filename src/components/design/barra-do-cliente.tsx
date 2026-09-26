import Link from 'next/link'
import { Suspense, cache } from 'react'
import { acessoCompleto, filtroDoAcesso } from '@/server/permissoes'
import { ROTULO_DO_PAPEL, ROTULO_DO_SUPORTE, resumoDoAcesso, type PapelDaConta } from '@/core/permissoes'
import { SeletorDeConta } from '@/components/conta/seletor-de-conta'
import { PainelVoce, PerfilDaSessao } from '@/components/conta/voce'
import { contagensDaAgenda } from '@/server/repos/atividades'
import { lerFiltroDaAgenda } from '@/core/atividades'
import { NotificacoesDaFila } from '@/components/inbox/notificacoes-da-fila'
import { NumeroDaBarra } from '@/components/design/numero-da-barra'
import { LinhaDePresenca } from '@/components/conta/linha-de-presenca'
import { resumoDasContas, type Cliente, type ResumoDeAtendimento } from '@/server/repos/clientes'
import { crmVisivel, lojaVisivel, nichoDaConta } from '@/server/repos/recursos'
import { contarConversasDaBarra } from '@/server/repos/leads'
import { barraRecolhida } from '@/server/preferencias'
import { presencaDoUsuario } from '@/server/repos/usuarios'
import { contasDoUsuario, ehAdminDaPlataforma } from '@/server/sessao'
import { BarraLateral } from './barra-lateral'
import { liberaSecao, secoesVisiveis, type Contagem } from './secoes-do-cliente'
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
  const [contas, presenca, mostraCrm, mostraLoja, nicho, recolhida] = await Promise.all([
    contasDoUsuario(acesso.sessao.usuario.id),
    presencaDoUsuario(acesso.sessao.usuario.id),
    crmVisivel(cliente.id),
    lojaVisivel(cliente.id),
    nichoDaConta(cliente.id),
    barraRecolhida(),
  ])
  // Só vale a consulta quando existe outra conta para onde ir.
  const esperando = contas.length > 1 ? await resumoDasContas(contas.map((conta) => conta.id)) : new Map<string, ResumoDeAtendimento>()
  const perfil = acesso.regras.nomeDaFuncao ?? resumoDoAcesso(acesso.regras).perfil
  const doSeletor = contas.map((conta) => ({
    id: conta.id,
    nome: conta.nome,
    logoUrl: conta.logoUrl,
    // Na conta aberta, o perfil de verdade (com as exceções da pessoa); nas
    // outras, o nome do papel, que sai sem consulta.
    papel: conta.id === cliente.id ? perfil : (ROTULO_DO_PAPEL[conta.papel as PapelDaConta] ?? conta.papel),
    esperando: esperando.get(conta.id)?.esperandoPessoa ?? 0,
  }))
  const atual = doSeletor.find((conta) => conta.id === cliente.id) ?? {
    // O administrador da 4YU entra sem ser membro: a conta não está na lista dele.
    id: cliente.id,
    nome: cliente.nome,
    logoUrl: cliente.logoUrl,
    papel: acesso.papel === null ? ROTULO_DO_SUPORTE : perfil,
    esperando: 0,
  }
  // O administrador da plataforma veio da administração e precisa do caminho
  // de volta. O dono do negócio, não: para ele não existe administração,
  // existe a organização dele.
  const podeVerTodosOsClientes = ehAdminDaPlataforma(acesso.sessao)
  const base = `/clientes/${cliente.id}`

  return (
    <>
      {/*
        Grava no navegador quem é administrador, para o esqueleto de quem chega
        de fora reservar o espaço do "‹ Administração". Ver `MarcaDeAdmin`.
      */}
      <MarcaDeAdmin admin={podeVerTodosOsClientes} />
      <PerfilDaSessao
        inicial={{ nome: acesso.sessao.usuario.nome, imagem: acesso.sessao.usuario.imagem ?? null }}
      >
        <BarraLateral
          base={base}
          marca={<Marca />}
          voltarHref={podeVerTodosOsClientes ? '/admin' : undefined}
          presenca={presenca ?? undefined}
          conta={cliente.nome}
          contaNoTopo={<SeletorDeConta atual={atual} contas={doSeletor} />}
          voltar={
            podeVerTodosOsClientes ? (
              <Link
                href="/admin"
                className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-dim transition hover:text-primary md:mb-1.5 md:flex"
              >
                <span aria-hidden>‹</span> Administração
              </Link>
            ) : null
          }
          recolhidaInicial={recolhida}
          eu={acesso.sessao.usuario.id}
          secoes={secoesVisiveis({ crmVisivel: mostraCrm, lojaVisivel: mostraLoja, regras: acesso.regras, nicho }).map((secao) => {
            // O ponto da seção junta os números dela: fechada, ela avisa que
            // há o que fazer lá dentro sem ocupar a barra com os números.
            const contagens = secao.itens.flatMap((item) => (item.contagem ? [item.contagem] : []))
            return {
              chave: secao.chave,
              rotulo: secao.rotulo,
              icone: secao.icone,
              solta: secao.solta,
              ponto: contagens.length ? <Suspense fallback={null}><Ponto clienteId={cliente.id} quais={contagens} /></Suspense> : undefined,
              itens: secao.itens.map((item) => ({
                id: item.id,
                rotulo: item.rotulo,
                href: `${base}${item.href}`,
                contador: item.contagem ? <Suspense fallback={null}><Numero clienteId={cliente.id} qual={item.contagem} /></Suspense> : undefined,
              })),
            }
          })}
          rodape={
            <PainelVoce
              email={acesso.sessao.usuario.email}
              papel={`${perfil} · ${cliente.nome}`}
              suporte={acesso.papel === null}
              configuracoesHref={liberaSecao(acesso.regras, 'ajustes') ? `${base}/ajustes` : null}
              outrasContas={contas.length}
            >
              <LinhaDePresenca doServidor={presenca} />

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

/*
 * Os números aparecem mais de uma vez na mesma resposta (subitem, ponto da
 * seção, barra de baixo do celular): `cache` faz todos lerem uma consulta só.
 *
 * Cada número só é contado para quem abre a tela dele: contar conversas para
 * quem não atende seria mostrar, pelo menu, o que a tela recusa.
 */
export const contarDaBarra = cache(async (clienteId: string): Promise<Record<Contagem, number>> => {
  const zeros = { minhas: 0, 'sem-dono': 0, atrasadas: 0 }
  try {
    const acesso = await acessoCompleto(clienteId)
    const usuarioId = acesso.sessao.usuario.id
    const [conversas, agenda] = await Promise.all([
      liberaSecao(acesso.regras, 'inbox') ? contarConversasDaBarra(clienteId, usuarioId) : null,
      // Mesma regra dos atalhos da agenda: o número do menu e os da tela batem.
      liberaSecao(acesso.regras, 'atividades')
        ? contagensDaAgenda(clienteId, filtroDoAcesso(acesso, 'atender'), usuarioId, { ...lerFiltroDaAgenda({}), alcance: 'equipe' }, Date.now())
        : null,
    ])
    return { minhas: conversas?.minhas ?? 0, 'sem-dono': conversas?.semDono ?? 0, atrasadas: agenda?.vencidas ?? 0 }
  } catch {
    // A barra não é lugar de erro: sem número, a tela continua abrindo.
    return zeros
  }
})

async function Numero({ clienteId, qual }: { clienteId: string; qual: Contagem }) {
  // O desenho mora em `NumeroDaBarra`, no cliente, para os gestos mexerem no
  // número sem esperar o layout voltar do servidor.
  return <NumeroDaBarra qual={qual} doServidor={(await contarDaBarra(clienteId))[qual]} />
}

async function Ponto({ clienteId, quais }: { clienteId: string; quais: Contagem[] }) {
  const contagens = await contarDaBarra(clienteId)
  const total = quais.reduce((soma, qual) => soma + contagens[qual], 0)
  if (!total) return null
  const urgente = contagens.atrasadas > 0 && quais.includes('atrasadas')
  return <span role="img" aria-label="Há o que fazer aqui" className={`block size-2 rounded-full ring-2 ring-panel ${urgente ? 'bg-perigo' : 'bg-primary'}`} />
}
