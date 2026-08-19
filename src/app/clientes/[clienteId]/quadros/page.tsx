import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { ClienteShell } from '@/components/design/cliente-shell'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { Quadro } from '@/components/quadros/quadro'
import { LIMITE_DO_NOME } from '@/core/quadros'
import { acaoApagarQuadro, acaoCriarQuadro } from '@/server/acoes'
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
 * divergiria do HTML que o servidor mandou.
 */
function agoraDoServidor(): number {
  return Date.now()
}

/**
 * Quadros — a etapa em que cada contato está (C1).
 *
 * **A tela é o quadro.** A primeira versão punha os formulários de criação como
 * blocos no fim da página, e eles ocupavam mais espaço que o próprio quadro:
 * criar etapa e criar quadro são atos raros, e o que se olha o tempo todo são as
 * colunas. Agora criar é modal, e o quadro ocupa a altura toda com as colunas
 * rolando por dentro.
 *
 * O seletor de quadro só aparece com mais de um, pela mesma razão de
 * `destinoAposEntrar`: mandar quem tem um só para um seletor de um item é fazer
 * a pessoa clicar para confirmar o óbvio.
 *
 * O quadro aberto vem por `?q=<id>`, e não por rota própria: `/quadros/[id]`
 * seria uma tela nova para a mesma tela.
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
  // Id que não é deste cliente cai no primeiro em vez de dar erro: o valor vem
  // da URL, e link velho não pode virar tela quebrada.
  const aberto = quadros.find((quadro) => quadro.id === q) ?? quadros[0] ?? null
  const cartoes = aberto ? await listarCartoes(cliente.id, aberto.id) : []

  const novoQuadro = (
    <ModalFormulario
      botao="+ Novo quadro"
      titulo="Novo quadro"
      descricao="Um funil por assunto — comercial e suporte não têm as mesmas etapas. A mesma pessoa pode estar em vários, cada um na sua etapa. Ele nasce com três etapas para você renomear."
      rotuloEnviar="Criar quadro"
      variante={quadros.length === 0 ? 'primario' : 'secundario'}
      action={acaoCriarQuadro.bind(null, cliente.id, {})}
    >
      <label>
        <RotuloCampo>Nome do quadro</RotuloCampo>
        <input
          name="nome"
          required
          autoFocus
          maxLength={LIMITE_DO_NOME}
          placeholder="ex.: Comercial"
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
      </label>
    </ModalFormulario>
  )

  return (
    <ClienteShell cliente={cliente} ativa="quadros">
      {/* A tela inteira, e não um `max-w` no meio dela: um quadro que não usa a
          largura disponível mostra menos colunas do que caberia, que é o oposto
          do que ele existe para fazer. */}
      <main className="flex h-full min-h-0 flex-col px-4 pt-[26px] pb-5 md:px-[42px]">
        <header className="mb-4 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Quadros</h1>

          {quadros.length > 1 && (
            <nav className="flex flex-wrap gap-1.5">
              {quadros.map((quadro) => (
                <Link
                  key={quadro.id}
                  href={`/clientes/${cliente.id}/quadros?q=${quadro.id}`}
                  className={`rounded-full border px-3 py-1 text-[12px] transition ${
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

          <span className="ml-auto flex items-center gap-2">
            {novoQuadro}
            {aberto && (
              <BotaoPerigo
                rotulo="Apagar quadro"
                titulo="Apaga o quadro e as etapas. Nenhum contato é apagado."
                pergunta={`Apagar o quadro “${aberto.nome}”? Some a posição das ${cartoes.length} pessoa(s) no funil — os contatos, as conversas e as etiquetas ficam.`}
                acao={acaoApagarQuadro.bind(null, cliente.id, aberto.id)}
              />
            )}
          </span>
        </header>

        {!aberto ? (
          <section className="app-card px-5 py-16 text-center">
            <p className="text-[13.5px] font-semibold text-soft">Nenhum quadro ainda</p>
            <p className="mx-auto mt-1.5 max-w-[440px] text-xs leading-5 text-dim">
              Um quadro é o seu funil desenhado: as etapas por onde um contato passa, do primeiro
              contato até o desfecho. Etiqueta é um fato sobre a pessoa e ela pode ter várias; etapa
              é onde ela está, e é uma só.
            </p>
            <span className="mt-6 inline-block">{novoQuadro}</span>
          </section>
        ) : (
          <Quadro
            clienteId={cliente.id}
            quadroId={aberto.id}
            etapas={aberto.etapas}
            cartoesIniciais={cartoes}
            agora={agora}
          />
        )}
      </main>
    </ClienteShell>
  )
}
