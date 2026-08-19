import Link from 'next/link'
import type { Metadata } from 'next'
import { Marca } from '@/components/design/marca'
import { ImportarFluxo, type DestinoDaImportacao } from '@/components/compartilhar/importar'
import { resumirFluxo, roteiroDoFluxo, type LinhaDoRoteiro } from '@/core/compartilhar'
import { acharPorToken, contarAbertura } from '@/server/repos/compartilhar'
import { listarClientes } from '@/server/repos/clientes'
import {
  contasDoUsuario,
  ehAdminDaPlataforma,
  sessaoAtual,
  temSessaoDePainel,
} from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * A página de um fluxo compartilhado (0030).
 *
 * **É a única tela do sistema que abre sem sessão nenhuma.** Tudo o que ela
 * mostra vem de um token que alguém gerou de propósito, sobre uma versão
 * publicada, com prazo e botão de revogar — e nada aqui consulta a conta de
 * origem além do nome dela.
 *
 * O que ela deliberadamente **não** faz: desenhar o grafo. Quem chega aqui está
 * decidindo se importa, e para isso precisa ler o atendimento em ordem. Montar
 * o canvas custaria o bundle do editor numa rota pública para entregar menos.
 */
export const metadata: Metadata = {
  // Link compartilhado não é conteúdo para busca — e o `robots.ts` já proíbe o
  // site inteiro. Isto é o cinto junto do suspensório, porque aqui o custo de
  // errar é o fluxo de um cliente indexado.
  robots: { index: false, follow: false },
}

const ROTULO_DO_BLOCO: Record<LinhaDoRoteiro['tipo'], string> = {
  mensagem: 'Mensagem',
  midia: 'Arquivo',
  pergunta: 'Pergunta',
  condicao: 'Condição',
  'salvar-campo': 'Guardar',
  ia: 'IA',
  handoff: 'Chama uma pessoa',
  http: 'API',
}

export default async function Pagina({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Sem `decodeURIComponent`: o token é `base64url`, que não tem nenhum
  // caractere que precise de escape — e um `%` solto vindo de um link truncado
  // faria `decodeURIComponent` estourar com `URIError` numa rota pública, o que
  // é uma página de erro genérica no lugar de "este link não existe".
  const link = await acharPorToken(token)

  if (!link) return <Aviso titulo="Este link não existe" texto="Confira se ele foi copiado inteiro." />

  if (link.estado === 'revogado') {
    return (
      <Aviso
        titulo="Este link foi fechado"
        texto="Quem compartilhou revogou o acesso. Peça um link novo."
      />
    )
  }
  if (link.estado === 'expirado' || !link.grafo) {
    return (
      <Aviso
        titulo="O prazo deste link acabou"
        texto="Links de fluxo têm validade. Peça um link novo a quem compartilhou."
      />
    )
  }

  // Depois de decidir que a página abre, e nunca antes: contar visita de link
  // morto inflaria o número que responde "adiantou compartilhar?".
  await contarAbertura(link.id)

  const resumo = resumirFluxo(link.grafo)
  const roteiro = roteiroDoFluxo(link.grafo)
  const destinos = await destinosPossiveis()

  return (
    <main className="mx-auto min-h-screen w-full max-w-[760px] px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 flex items-center gap-2.5">
        <Marca compacta />
        <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-dim">
          fluxo compartilhado
        </span>
      </div>

      <header className="app-card p-6 md:p-7">
        <p className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          {link.origem} compartilhou
        </p>
        <h1 className="mt-1.5 text-[24px] leading-[1.15] font-bold tracking-[-0.02em] md:text-[28px]">
          {link.nome}
        </h1>
        <p className="mt-2 text-[12px] text-dim">
          Versão {link.versao}, publicada — o desenho aqui não muda mais.
        </p>

        <ul className="mt-5 flex flex-wrap gap-2">
          <Selo>{resumo.blocos} blocos</Selo>
          {resumo.perguntas > 0 && <Selo>{resumo.perguntas} pergunta(s)</Selo>}
          {resumo.temMidia && <Selo>envia arquivo</Selo>}
          {resumo.temApi && <Selo>chama API</Selo>}
          {resumo.temIa && <Selo>usa IA</Selo>}
          <Selo destaque={resumo.temHandoff}>
            {resumo.temHandoff ? 'passa para uma pessoa' : 'não chama ninguém'}
          </Selo>
        </ul>

        <div className="mt-6 border-t border-white/[0.06] pt-5">
          {destinos.length > 0 ? (
            <ImportarFluxo token={token} destinos={destinos} />
          ) : (
            <p className="text-[12.5px] leading-[1.7] text-dim">
              Para trazer este fluxo para uma conta,{' '}
              <Link
                href="/entrar"
                className="text-muted underline underline-offset-2 transition hover:text-accent"
              >
                entre no AutoFluxos
              </Link>{' '}
              e abra este link de novo. Sem conta, dá para ler o desenho inteiro aqui embaixo.
            </p>
          )}
        </div>
      </header>

      <section className="app-card mt-[18px] overflow-hidden">
        <header className="border-b border-white/[0.06] px-5 py-4 md:px-6">
          <h2 className="text-[14.5px] font-bold">O atendimento, na ordem</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-dim">
            Como a conversa acontece, do primeiro bloco em diante.
          </p>
        </header>

        <ol>
          {roteiro.map((linha, indice) => (
            <li
              key={linha.id}
              className="flex gap-3.5 border-b border-white/[0.045] px-5 py-4 last:border-0 md:px-6"
            >
              <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[11px] text-dim">
                {indice + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-[11px] font-bold tracking-[0.04em] text-muted uppercase">
                    {ROTULO_DO_BLOCO[linha.tipo]}
                  </strong>
                  {!linha.alcancavel && (
                    <span
                      title="Nenhuma seta chega até aqui. Quem importar precisa ligá-lo ou apagá-lo."
                      className="rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-2 py-0.5 text-[10px] font-bold text-amber-200"
                    >
                      solto
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-[13px] leading-[1.65] whitespace-pre-wrap text-soft">
                  {linha.texto}
                </span>
                {linha.saidas.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {linha.saidas.map((saida, i) => (
                      <span
                        key={`${linha.id}-${i}`}
                        className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] text-dim"
                      >
                        {saida}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-6 text-center text-[11px] leading-[1.7] text-dim">
        Feito no <strong className="font-semibold text-muted">AutoFluxos</strong>, da 4YU —
        atendimento no WhatsApp desenhado bloco a bloco.
      </p>
    </main>
  )
}

function Selo({ children, destaque = false }: { children: React.ReactNode; destaque?: boolean }) {
  return (
    <li
      className={`rounded-full border px-2.5 py-1 text-[11px] ${
        destaque
          ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300'
          : 'border-white/[0.09] bg-white/[0.03] text-muted'
      }`}
    >
      {children}
    </li>
  )
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <Marca compacta />
      <h1 className="mt-7 text-[20px] font-bold tracking-[-0.02em]">{titulo}</h1>
      <p className="mt-2 text-[13px] leading-[1.7] text-dim">{texto}</p>
    </main>
  )
}

/**
 * Para quais contas esta pessoa consegue importar.
 *
 * É a mesma árvore de decisão de `conferirAcessoAoCliente`, e de propósito:
 * membro vê as contas dele; administrador da plataforma e senha única do time
 * alcançam a carteira inteira, que é o que eles já alcançam hoje. Uma lista
 * mais generosa do que a conferência da ação seria um seletor cheio de opções
 * que dão erro ao clicar; uma mais restrita esconderia contas de quem entra
 * pela porta principal de hoje.
 *
 * A lista **não decide nada** — quem decide é `exigirAcessoAoCliente` dentro da
 * ação, com o id que o navegador mandou.
 */
async function destinosPossiveis(): Promise<DestinoDaImportacao[]> {
  const sessao = await sessaoAtual()

  if (sessao) {
    if (ehAdminDaPlataforma(sessao)) return todosOsClientes()
    return (await contasDoUsuario(sessao.usuario.id)).map((conta) => ({
      id: conta.id,
      nome: conta.nome,
    }))
  }

  if (await temSessaoDePainel()) return todosOsClientes()
  return []
}

async function todosOsClientes(): Promise<DestinoDaImportacao[]> {
  return (await listarClientes()).map((cliente) => ({ id: cliente.id, nome: cliente.nome }))
}
