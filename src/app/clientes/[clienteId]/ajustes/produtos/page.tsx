import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Trilha } from '@/components/design/trilha'
import { Dropdown } from '@/components/design/dropdown'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { BotaoArquivar } from '@/components/produtos/botao-arquivar'
import { ESPECIES, NOME_DA_ESPECIE, estaAtivo } from '@/core/produtos'
import { acaoCriarProduto, acaoRenomearProduto } from '@/server/acoes-produtos'
import { acharCliente } from '@/server/repos/clientes'
import { listarProdutos } from '@/server/repos/produtos'

export const dynamic = 'force-dynamic'

const OPCOES_DE_ESPECIE = ESPECIES.map((especie) => ({
  valor: especie,
  rotulo: NOME_DA_ESPECIE[especie],
}))

/**
 * O catálogo mínimo (T5.1).
 *
 * Nome e ativo/arquivado. A ausência de preço aqui é a decisão: o valor de uma
 * venda é o valor **daquela** venda, guardado em `venda_itens`, e um preço de
 * tabela nesta tela viraria uma segunda verdade que ninguém atualiza.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, produtos] = await Promise.all([
    acharCliente(clienteId),
    listarProdutos(clienteId),
  ])
  if (!cliente) notFound()

  const ativos = produtos.filter(estaAtivo)
  const arquivados = produtos.filter((p) => !estaAtivo(p))

  return (
    <AjustesShell cliente={cliente} ativa="produtos">
      <main className="w-full max-w-[1100px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Catálogo' },
          ]}
        />
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Catálogo</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          O que a empresa vende, só com nome. Serve para dizer no que uma
          negociação está interessada, o que foi vendido, e para filtrar depois
          por “quem comprou o Plano Ouro”.
          <br />
          Não tem preço, estoque nem imposto de propósito: o valor de uma venda é
          o valor <em>daquela</em> venda, e um preço de tabela aqui viraria uma
          segunda verdade que ninguém lembra de atualizar.
        </p>

        <section className="app-card overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="text-[14.5px] font-bold">
              {ativos.length} {ativos.length === 1 ? 'item ativo' : 'itens ativos'}
            </h2>
            <ModalFormulario
              botao="+ Novo item"
              titulo="Novo item do catálogo"
              descricao="Produto ou serviço é só o vocabulário de quem vende: o sistema trata os dois igual."
              rotuloEnviar="Criar"
              variante="secundario"
              action={acaoCriarProduto.bind(null, cliente.id, {})}
            >
              <label>
                <RotuloCampo>Nome</RotuloCampo>
                <input
                  name="nome"
                  required
                  autoFocus
                  maxLength={120}
                  placeholder="ex.: Plano Ouro"
                  className="app-field px-[13px] py-[11px] text-[13.5px]"
                />
              </label>
              <label>
                <RotuloCampo>Tipo</RotuloCampo>
                <Dropdown
                  nome="especie"
                  rotuloAcessivel="Tipo do item"
                  valorInicial="produto"
                  opcoes={OPCOES_DE_ESPECIE}
                />
              </label>
            </ModalFormulario>
          </header>

          {ativos.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs leading-5 text-dim">
              Nenhum item ainda. Sem catálogo, a venda ainda pode ser registrada
              com valor e nota: o item só é obrigatório para quem quiser
              segmentar por produto depois.
            </p>
          ) : (
            <ul>
              {ativos.map((produto) => (
                <li
                  key={produto.id}
                  className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-0"
                >
                  <span className="flex-1 text-[13.5px] font-medium">{produto.nome}</span>
                  <span className="text-[11px] text-dim">{NOME_DA_ESPECIE[produto.especie]}</span>
                  <ModalFormulario
                    botao="Renomear"
                    titulo={`Renomear “${produto.nome}”`}
                    descricao="As vendas já registradas guardam o nome da época, e não mudam: renomear vale daqui para a frente."
                    rotuloEnviar="Salvar"
                    variante="secundario"
                    action={acaoRenomearProduto.bind(null, cliente.id, produto.id, {})}
                  >
                    <label>
                      <RotuloCampo>Nome</RotuloCampo>
                      <input
                        name="nome"
                        required
                        autoFocus
                        maxLength={120}
                        defaultValue={produto.nome}
                        className="app-field px-[13px] py-[11px] text-[13.5px]"
                      />
                    </label>
                  </ModalFormulario>
                  <BotaoArquivar clienteId={cliente.id} produto={produto} arquivar />
                </li>
              ))}
            </ul>
          )}
        </section>

        {arquivados.length > 0 && (
          <section className="app-card mt-6 overflow-hidden">
            <header className="border-b border-line px-5 py-4">
              <h2 className="text-[14.5px] font-bold">Arquivados</h2>
              <p className="mt-1 text-[11.5px] leading-5 text-dim">
                Não aparecem para escolher numa venda nova. Continuam aqui porque
                as vendas antigas apontam para eles: apagar faria “quem comprou
                isso” responder menos do que a verdade, sem avisar ninguém.
              </p>
            </header>
            <ul>
              {arquivados.map((produto) => (
                <li
                  key={produto.id}
                  className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-0"
                >
                  <span className="flex-1 text-[13.5px] text-dim">{produto.nome}</span>
                  <span className="text-[11px] text-dim">{NOME_DA_ESPECIE[produto.especie]}</span>
                  <BotaoArquivar clienteId={cliente.id} produto={produto} arquivar={false} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </AjustesShell>
  )
}
