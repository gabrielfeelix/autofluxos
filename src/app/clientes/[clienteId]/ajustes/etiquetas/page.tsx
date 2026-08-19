import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Dropdown } from '@/components/design/dropdown'
import { FormularioSalvar } from '@/components/design/formulario-salvar'
import { FichaDeEtiqueta } from '@/components/etiquetas/ficha'
import { CORES_DE_ETIQUETA, LIMITE_DO_NOME, ROTULO_DA_COR } from '@/core/etiquetas'
import { acaoApagarEtiqueta, acaoCriarEtiqueta, acaoEditarEtiqueta } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarEtiquetasComContagem } from '@/server/repos/etiquetas'

export const dynamic = 'force-dynamic'

const OPCOES_DE_COR = CORES_DE_ETIQUETA.map((cor) => ({
  valor: cor,
  rotulo: ROTULO_DA_COR[cor],
}))

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, etiquetas] = await Promise.all([
    acharCliente(clienteId),
    listarEtiquetasComContagem(clienteId),
  ])
  if (!cliente) notFound()

  const criarComCliente = acaoCriarEtiqueta.bind(null, cliente.id)

  return (
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="max-w-[820px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Link
          href={`/clientes/${clienteId}/ajustes`}
          className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-accent"
        >
          ← Ajustes
        </Link>
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Etiquetas</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          As etiquetas que uma pessoa cria e aplica — “cliente antigo”, “orçamento
          enviado”, “não insistir”. Elas viram filtro na lista de contatos.
          <br />
          As outras que você vê por lá (<em>abriu com mídia</em>, <em>foi para
          pessoa</em>, <em>não respondeu</em>) são deduzidas do histórico e não
          aparecem aqui: mudar uma delas na mão faria a tela mentir na próxima
          mensagem.
        </p>

        <section className="app-card mb-[18px] overflow-hidden">
          <header className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Nova etiqueta</h2>
          </header>
          <div className="p-5">
            <FormularioSalvar action={criarComCliente} rotulo="Criar">
              <div className="grid gap-2.5 md:grid-cols-[1fr_160px]">
                <input
                  name="nome"
                  required
                  maxLength={LIMITE_DO_NOME}
                  placeholder="ex.: orçamento enviado"
                  aria-label="Nome da etiqueta"
                  className="app-field px-3 py-2.5 text-[12.5px]"
                />
                <Dropdown
                  nome="cor"
                  rotuloAcessivel="Cor da etiqueta"
                  valorInicial="cinza"
                  opcoes={OPCOES_DE_COR}
                />
              </div>
            </FormularioSalvar>
          </div>
        </section>

        <section className="app-card overflow-hidden">
          <header className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">
              {etiquetas.length} {etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'}
            </h2>
          </header>

          {etiquetas.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs leading-5 text-dim">
              Nenhuma ainda. A primeira normalmente é a que separa quem já recebeu
              proposta de quem não recebeu.
            </p>
          ) : (
            <ul>
              {etiquetas.map((etiqueta) => (
                <li key={etiqueta.id} className="border-b border-white/[0.045] px-5 py-4 last:border-0">
                  <div className="mb-2.5 flex items-center gap-3">
                    <FichaDeEtiqueta nome={etiqueta.nome} cor={etiqueta.cor} />
                    <span className="flex-1 text-[11px] text-dim">
                      {etiqueta.contatos === 0
                        ? 'nenhum contato'
                        : `${etiqueta.contatos} ${etiqueta.contatos === 1 ? 'contato' : 'contatos'}`}
                    </span>
                    <BotaoPerigo
                      titulo="Apaga a etiqueta e a tira de todos os contatos que a têm."
                      pergunta={`Apagar a etiqueta “${etiqueta.nome}”? Ela sai dos ${etiqueta.contatos ?? 0} contato(s) que a têm.`}
                      acao={acaoApagarEtiqueta.bind(null, cliente.id, etiqueta.id)}
                    />
                  </div>

                  {/*
                    Editar no lugar, e não numa tela à parte: renomear é o que
                    mais se faz com etiqueta, e mandar alguém a outra página
                    para corrigir uma letra é caro para o que a tarefa vale.
                  */}
                  <FormularioSalvar
                    action={acaoEditarEtiqueta.bind(null, cliente.id, etiqueta.id)}
                    rotulo="Salvar"
                  >
                    <div className="grid gap-2.5 md:grid-cols-[1fr_160px]">
                      <input
                        name="nome"
                        required
                        maxLength={LIMITE_DO_NOME}
                        defaultValue={etiqueta.nome}
                        aria-label={`Nome de ${etiqueta.nome}`}
                        className="app-field px-3 py-2 text-[12px]"
                      />
                      <Dropdown
                        nome="cor"
                        rotuloAcessivel={`Cor de ${etiqueta.nome}`}
                        valorInicial={etiqueta.cor}
                        opcoes={OPCOES_DE_COR}
                      />
                    </div>
                  </FormularioSalvar>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </ClienteShell>
  )
}
