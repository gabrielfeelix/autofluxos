import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { ClienteShell } from '@/components/design/cliente-shell'
import { FormularioSalvar } from '@/components/design/formulario-salvar'
import { Quadro } from '@/components/quadros/quadro'
import { LIMITE_DE_ETAPAS, LIMITE_DO_NOME } from '@/core/quadros'
import { acaoApagarQuadro, acaoCriarEtapa, acaoCriarQuadro } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarCartoes, listarQuadros } from '@/server/repos/quadros'

export const dynamic = 'force-dynamic'

/**
 * O relógio, lido **uma vez por render do servidor**.
 *
 * Fica fora do componente porque o compilador do React trata `Date.now()` em
 * render como impureza — e ele tem razão em geral. Aqui a rota é
 * `force-dynamic` e o valor é passado adiante como número, exatamente para o
 * cliente **não** ler o relógio dele: "parado há 6 dias" calculado no navegador
 * divergiria do HTML que o servidor mandou, que é a divergência de hidratação
 * que já mordeu a lista de contatos.
 */
function agoraDoServidor(): number {
  return Date.now()
}

/**
 * Quadros — a etapa em que cada contato está (C1).
 *
 * **O seletor de quadro só aparece com mais de um.** É a mesma decisão de
 * `destinoAposEntrar`: mandar quem tem uma conta só para um seletor de um item
 * é fazer a pessoa clicar para confirmar o óbvio.
 *
 * O quadro aberto vem por `?q=<id>`, e não por rota própria: uma rota
 * `/quadros/[id]` seria uma tela nova para a mesma tela, e cada tela nova é
 * superfície que custa manutenção para sempre.
 */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { clienteId } = await params
  const { q } = await searchParams

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const agora = agoraDoServidor()
  const quadros = await listarQuadros(cliente.id)
  // Id de quadro que não é deste cliente cai no primeiro em vez de dar erro: o
  // valor vem da URL, e link velho não pode virar tela quebrada.
  const aberto = quadros.find((quadro) => quadro.id === q) ?? quadros[0] ?? null
  const cartoes = aberto ? await listarCartoes(cliente.id, aberto.id) : []

  const criarQuadroComCliente = acaoCriarQuadro.bind(null, cliente.id)

  return (
    <ClienteShell cliente={cliente} ativa="quadros">
      <main className="max-w-[1400px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Quadros</h1>
          {aberto && (
            <BotaoPerigo
              rotulo="Apagar quadro"
              titulo="Apaga o quadro e as etapas. Nenhum contato é apagado."
              pergunta={`Apagar o quadro “${aberto.nome}”? Some a posição das ${cartoes.length} pessoa(s) no funil — os contatos, as conversas e as etiquetas ficam.`}
              acao={acaoApagarQuadro.bind(null, cliente.id, aberto.id)}
            />
          )}
        </div>
        <p className="mb-5 max-w-[620px] text-[12.5px] leading-[1.7] text-dim">
          Em que etapa cada contato está. Cada cartão <strong className="text-muted">é</strong> um
          contato — não existe cartão avulso, senão em três meses são duas listas de gente que
          divergem.
          <br />
          Etiqueta é um fato sobre a pessoa e ela pode ter várias; etapa é onde ela está no funil, e
          é uma só.
        </p>

        {quadros.length > 1 && (
          <nav className="mb-4 flex flex-wrap gap-1.5">
            {quadros.map((quadro) => (
              <Link
                key={quadro.id}
                href={`/clientes/${cliente.id}/quadros?q=${quadro.id}`}
                className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                  quadro.id === aberto?.id
                    ? 'border-accent/40 bg-accent/[0.1] text-accent'
                    : 'border-white/[0.09] bg-white/[0.03] text-muted hover:border-white/20'
                }`}
              >
                {quadro.nome}
              </Link>
            ))}
          </nav>
        )}

        {!aberto ? (
          <section className="app-card px-5 py-14 text-center">
            <p className="text-[13.5px] font-semibold text-soft">Nenhum quadro ainda</p>
            <p className="mx-auto mt-1 max-w-[430px] text-xs leading-5 text-dim">
              Um quadro é o seu funil desenhado: as etapas por onde um contato passa, do primeiro
              contato até o desfecho. Ele nasce com três etapas para você renomear.
            </p>
            <div className="mx-auto mt-6 max-w-[360px] text-left">
              <FormularioSalvar action={criarQuadroComCliente} rotulo="Criar quadro">
                <input
                  name="nome"
                  required
                  maxLength={LIMITE_DO_NOME}
                  placeholder="Nome do quadro (ex.: Comercial)"
                  aria-label="Nome do quadro"
                  className="app-field px-3 py-2.5 text-[12.5px]"
                />
              </FormularioSalvar>
            </div>
          </section>
        ) : (
          <>
            <Quadro
              clienteId={cliente.id}
              quadroId={aberto.id}
              etapas={aberto.etapas}
              cartoesIniciais={cartoes}
              agora={agora}
            />

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {aberto.etapas.length < LIMITE_DE_ETAPAS && (
                <section className="app-card p-4">
                  <h2 className="text-[13px] font-bold">Nova etapa</h2>
                  <p className="mt-0.5 mb-3 text-[11.5px] leading-5 text-dim">
                    Entra no fim do funil. Renomeie clicando no título de qualquer coluna.
                  </p>
                  <FormularioSalvar
                    action={acaoCriarEtapa.bind(null, cliente.id, aberto.id)}
                    rotulo="Adicionar etapa"
                  >
                    <input
                      name="nome"
                      required
                      maxLength={LIMITE_DO_NOME}
                      placeholder="ex.: Aula experimental agendada"
                      aria-label="Nome da etapa"
                      className="app-field px-3 py-2.5 text-[12.5px]"
                    />
                  </FormularioSalvar>
                </section>
              )}

              <section className="app-card p-4">
                <h2 className="text-[13px] font-bold">Novo quadro</h2>
                <p className="mt-0.5 mb-3 text-[11.5px] leading-5 text-dim">
                  Um funil por assunto — comercial e suporte não têm as mesmas etapas. A mesma
                  pessoa pode estar em vários, cada um na sua etapa.
                </p>
                <FormularioSalvar action={criarQuadroComCliente} rotulo="Criar quadro">
                  <input
                    name="nome"
                    required
                    maxLength={LIMITE_DO_NOME}
                    placeholder="Nome do quadro (ex.: Suporte)"
                    aria-label="Nome do quadro"
                    className="app-field px-3 py-2.5 text-[12.5px]"
                  />
                </FormularioSalvar>
              </section>
            </div>

            {cartoes.length === 0 && (
              <p className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-[12px] leading-[1.7] text-dim">
                O quadro está vazio. Vá em{' '}
                <Link
                  href={`/clientes/${cliente.id}/leads`}
                  className="text-muted underline underline-offset-2 transition hover:text-accent"
                >
                  Contatos
                </Link>
                , selecione quem entra no funil e use <strong className="text-muted">Pôr no
                quadro</strong>.
              </p>
            )}
          </>
        )}
      </main>
    </ClienteShell>
  )
}
