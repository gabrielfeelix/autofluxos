import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AjudaDaTela, type PassoDaAjuda } from '@/components/design/ajuda-da-tela'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Trilha } from '@/components/design/trilha'
import { Dropdown } from '@/components/design/dropdown'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { BotaoArquivar } from '@/components/produtos/botao-arquivar'
import { ImportarPlanilha } from '@/components/produtos/importar-planilha'
import { comoDinheiro } from '@/core/crm'
import {
  ESPECIES,
  NOME_DA_ESPECIE,
  agruparPorCategoria,
  categoriasUsadas,
  estaAtivo,
  type Produto,
} from '@/core/produtos'
import {
  acaoCriarProduto,
  acaoDefinirCategoria,
  acaoDefinirPreco,
  acaoRenomearProduto,
} from '@/server/acoes-produtos'
import { acharCliente } from '@/server/repos/clientes'
import { nichoDaConta } from '@/server/repos/recursos'
import { pacoteDo, rotuloNaBarra, visaoDoCatalogo } from '@/core/nichos'
import { lojaDaConta } from '@/server/repos/lojas'
import { listarMateriais } from '@/server/repos/materiais'
import { listarProdutos } from '@/server/repos/produtos'
import { IlustracaoProdutos } from '@/components/design/ilustracoes'
import { BotoesDeOrdem } from '@/components/produtos/botoes-de-ordem'
import { CardapioEmArquivo } from '@/components/produtos/cardapio-em-arquivo'

export const dynamic = 'force-dynamic'

const OPCOES_DE_ESPECIE = ESPECIES.map((especie) => ({
  valor: especie,
  rotulo: NOME_DA_ESPECIE[especie],
}))

const PASSOS_DA_AJUDA: PassoDaAjuda[] = [
  {
    titulo: 'Cadastre um item ou importe a lista inteira',
    texto:
      'Em “+ Novo item”, um por vez: nome, tipo (produto ou serviço) e, se quiser, preço. Para muitos itens, use “Importar”.',
  },
  {
    titulo: 'Importar: baixe o modelo e preencha',
    texto:
      'Em “Importar”, baixe o modelo em Excel ou CSV. Uma linha por item. Só a coluna nome é obrigatória; tipo, categoria, sku, preço, descrição, link e foto são opcionais. Preço aceita 1.299,90 ou 1299.90.',
  },
  {
    titulo: 'Arraste o arquivo e confira a prévia',
    texto:
      'Arraste a planilha para a janela ou clique para escolher. Antes de gravar, a prévia mostra quantos itens entram, quantos são atualizados e qual linha tem erro e por quê. Linha com erro fica de fora e o resto entra.',
  },
  {
    titulo: 'Reimportar atualiza, não duplica',
    texto:
      'O item que já existe é reconhecido pelo SKU ou, sem SKU, pelo nome, e é atualizado. Célula em branco não apaga o que já estava lá: para tirar um preço, use o botão “Preço” do item.',
  },
  {
    titulo: 'Foto e link viram o card',
    texto:
      'Com foto e link (os dois começando com https://), o item vai para o WhatsApp como card, com a imagem e o botão para abrir a página. Sem foto, vai como texto com o link. Serviço sem foto funciona igual.',
  },
  {
    titulo: 'Ligue no bot',
    texto:
      'No editor da automação, no bloco de IA, marque “Buscar produto na loja” e “Mandar o card do produto”. O bot passa a achar os itens por nome, SKU ou descrição, responder o preço e mandar o card.',
  },
  {
    titulo: 'Mande pelo Inbox',
    texto:
      'Na conversa, o botão de produtos busca por nome ou SKU e manda o card para a pessoa, do mesmo jeito que o bot.',
  },
]

/**
 * O catálogo mínimo (T5.1), com preço desde a 0091.
 *
 * Esta tela dizia que a ausência de preço era a decisão, e o argumento era
 * bom: o valor de uma venda é o valor **daquela** venda, em `venda_itens`, e
 * preço de tabela vira segunda verdade que ninguém atualiza.
 *
 * O que mudou foi o leitor. O preço existe para o bot conseguir dizer quanto
 * custa; o histórico continua em `venda_itens` e ninguém o reescreve daqui.
 * Por isso a tela mostra o preço como **oferta**, e não como o que foi
 * cobrado, e por isso item sem preço aparece como "sem preço" em vez de R$ 0.
 */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ visao?: string }>
}) {
  const [{ clienteId }, busca] = await Promise.all([params, searchParams])
  const [cliente, produtos, loja, nicho] = await Promise.all([
    acharCliente(clienteId),
    listarProdutos(clienteId),
    lojaDaConta(clienteId),
    nichoDaConta(clienteId),
  ])
  if (!cliente) notFound()
  // As palavras do ramo, as mesmas da barra lateral (`core/nichos.ts`).
  const pacote = pacoteDo(nicho)
  const secao = rotuloNaBarra(pacote, 'loja', 'Comércio')
  const titulo = rotuloNaBarra(pacote, 'catalogo', 'Produtos')

  const ativos = produtos.filter(estaAtivo)
  const arquivados = produtos.filter((p) => !estaAtivo(p))
  // A visão que o ramo pede (restaurante abre em grade), trocável pelo endereço.
  const visao = visaoDoCatalogo(pacote, busca.visao)
  const categorias = categoriasUsadas(ativos)
  // O cardápio em arquivo só aparece para o ramo que pede (`materiais`).
  const materiais = pacote?.materiais ? await listarMateriais(clienteId) : null

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <main className="w-full max-w-[1440px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Trilha
          caminho={[
            { rotulo: secao },
            { rotulo: titulo },
          ]}
        />
        <div className="flex items-center gap-2.5">
          <h1 className="text-[25px] font-bold tracking-[-0.02em]">{titulo}</h1>
          <AjudaDaTela
            titulo="Como funciona Produtos"
            resumo="O catálogo é a lista do que a organização vende. Ele serve a três leitores: o bot, a equipe no Inbox e o funil de vendas."
            passos={PASSOS_DA_AJUDA}
          >
            <p>
              <strong className="text-ink">Preço é a oferta de hoje, não o histórico.</strong> Mudar o preço
              aqui não reescreve venda nenhuma: cada venda guarda o valor daquela venda. Em branco quer dizer
              “não informado”, e o bot não anuncia preço que ninguém cadastrou. Para item de graça, escreva 0.
            </p>
            <p>
              <strong className="text-ink">Com loja Magento ligada</strong>, o bot e o Inbox buscam na loja, ao
              vivo, e esta lista não é preenchida com os produtos dela: copiar deixaria preço e estoque velhos.
              Ela continua servindo ao funil.
            </p>
            <p>
              <strong className="text-ink">Arquivar não apaga.</strong> O item some da escolha e do bot, mas as
              vendas antigas continuam apontando para ele. Estoque e imposto ficam de fora de propósito.
            </p>
          </AjudaDaTela>
        </div>
        <p className="mt-1.5 mb-6 text-[13px] leading-6 text-dim">
          O que a empresa vende, com preço, foto e link. O bot usa esta lista para dizer quanto custa e mandar
          o card do produto na conversa, e a equipe manda o mesmo card pelo Inbox.
        </p>

        {loja?.ativa && (
          /*
           * Com Magento ligada, o bot e o Inbox buscam na loja, ao vivo, e esta
           * lista não é preenchida com os produtos dela: 600 itens copiados
           * seriam 600 preços e estoques envelhecendo. Ela segue sendo o
           * vocabulário do funil.
           */
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] border border-primary/25 bg-primary/[0.06] px-4 py-3 text-[12.5px] leading-6">
            <span className="flex-1">
              <strong>O catálogo desta organização vem da loja Magento.</strong>{' '}
              <span className="text-muted">
                O bot e o Inbox buscam os produtos lá, ao vivo. Esta lista serve ao funil de vendas.
              </span>
            </span>
            <Link
              href={`/clientes/${cliente.id}/loja/magento`}
              className="app-secondary-button px-3 py-1.5 text-[11.5px]"
            >
              Ver a loja
            </Link>
          </div>
        )}

        {materiais && <CardapioEmArquivo clienteId={cliente.id} materiais={materiais} />}

        <section className="app-card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[14.5px] font-bold">
                {ativos.length} {ativos.length === 1 ? 'item ativo' : 'itens ativos'}
              </h2>
              <div role="group" aria-label="Como ver o catálogo" className="flex rounded-lg border border-line bg-panel p-0.5">
                {(
                  [
                    { valor: 'grade', rotulo: 'Grade' },
                    { valor: 'lista', rotulo: 'Lista' },
                  ] as const
                ).map((opcao) => (
                  <Link
                    key={opcao.valor}
                    href={`/clientes/${cliente.id}/loja/catalogo?visao=${opcao.valor}`}
                    aria-current={visao === opcao.valor ? 'page' : undefined}
                    className={`rounded-md px-3 py-1 text-[12px] font-semibold transition ${
                      visao === opcao.valor ? 'bg-primary-weak text-primary' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {opcao.rotulo}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ImportarPlanilha clienteId={cliente.id} />
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
              <label>
                <RotuloCampo>Categoria (opcional)</RotuloCampo>
                <input
                  name="categoria"
                  list={ID_DAS_CATEGORIAS}
                  maxLength={60}
                  placeholder="ex.: Pizzas, Bebidas"
                  className="app-field px-[13px] py-[11px] text-[13.5px]"
                />
              </label>
              <label>
                <RotuloCampo>Preço (opcional)</RotuloCampo>
                <input
                  name="preco"
                  inputMode="decimal"
                  placeholder="ex.: 150,00"
                  className="app-field px-[13px] py-[11px] text-[13.5px]"
                />
                <span className="mt-1.5 block text-[11px] leading-5 text-dim">
                  Em branco é “não informado”: o bot não anuncia preço que
                  ninguém cadastrou. Para item de graça, escreva 0.
                </span>
              </label>
              </ModalFormulario>
            </div>
          </header>

          {ativos.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <IlustracaoProdutos />
              <p className="mt-6 text-[13.5px] font-semibold text-soft">Nenhum item ainda</p>
              <p className="mx-auto mt-1.5 max-w-[440px] text-xs leading-5 text-dim">
                Sem catálogo, a venda ainda pode ser registrada com valor e nota: o item só é
                obrigatório para quem quiser segmentar por produto depois.
              </p>
            </div>
          ) : visao === 'grade' ? (
            /*
             * A grade: foto grande, agrupada por categoria, como se lê um
             * cardápio. A ordem dentro do grupo é a do dono, pelos botões de
             * subir e descer; entre grupos, a ordem alfabética da categoria.
             */
            <div className="space-y-7 p-5">
              {agruparPorCategoria(ativos).map((grupo) => (
                <section key={grupo.categoria ?? ''} aria-label={grupo.categoria ?? 'Sem categoria'}>
                  <h3 className="mb-3 flex items-baseline gap-2 text-[13px] font-bold">
                    {grupo.categoria ?? 'Sem categoria'}
                    <span className="text-[11px] font-normal text-dim tabular-nums">{grupo.itens.length}</span>
                  </h3>
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-3.5">
                    {grupo.itens.map((produto, i) => (
                      <li
                        key={produto.id}
                        className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-panel"
                      >
                        <div className="flex aspect-[4/3] items-center justify-center bg-black/25">
                          {produto.foto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={produto.foto} alt={produto.nome} className="size-full object-cover" />
                          ) : (
                            <span className="px-4 text-center text-[11px] leading-4 text-dim">
                              Sem foto: vai como texto
                            </span>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-2.5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-[13px] leading-5 font-semibold">{produto.nome}</p>
                            <BotoesDeOrdem
                              clienteId={cliente.id}
                              produtoId={produto.id}
                              nome={produto.nome}
                              primeiro={i === 0}
                              ultimo={i === grupo.itens.length - 1}
                            />
                          </div>
                          <Preco produto={produto} />
                          <div className="mt-auto flex flex-wrap items-center gap-1.5">
                            <AcoesDoItem clienteId={cliente.id} produto={produto} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul>
              {ativos.map((produto) => (
                <li
                  key={produto.id}
                  className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 last:border-0"
                >
                  <span className="flex-1 text-[13.5px] font-medium">
                    {produto.nome}
                    {produto.sku && (
                      <span className="ml-2 text-[11px] font-normal text-dim tabular-nums">{produto.sku}</span>
                    )}
                  </span>
                  {produto.categoria && <span className="text-[11px] text-dim">{produto.categoria}</span>}
                  <span className="text-[11px] text-dim">{NOME_DA_ESPECIE[produto.especie]}</span>
                  <Preco produto={produto} />
                  <AcoesDoItem clienteId={cliente.id} produto={produto} />
                </li>
              ))}
            </ul>
          )}
          {/* As sugestões do campo categoria, nos formulários de criar e de trocar. */}
          <datalist id={ID_DAS_CATEGORIAS}>
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
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
                  <span className="text-[12.5px] text-dim tabular-nums">
                    {produto.preco === null ? '' : comoDinheiro(produto.preco)}
                  </span>
                  <BotaoArquivar clienteId={cliente.id} produto={produto} arquivar={false} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </ClienteShell>
  )
}

/** O `id` da lista de sugestões de categoria. Um só por página. */
const ID_DAS_CATEGORIAS = 'categorias-do-catalogo'

/**
 * "sem preço" em vez de R$ 0,00: são estados diferentes, e o segundo é uma
 * oferta que ninguém fez.
 */
function Preco({ produto }: { produto: Produto }) {
  return (
    <span
      className={
        produto.preco === null ? 'text-[11px] text-dim italic' : 'text-[12.5px] font-medium tabular-nums'
      }
    >
      {produto.preco === null ? 'sem preço' : comoDinheiro(produto.preco)}
    </span>
  )
}

/** Preço, categoria, nome e arquivar: os mesmos na grade e na lista. */
function AcoesDoItem({ clienteId, produto }: { clienteId: string; produto: Produto }) {
  return (
    <>
      <ModalFormulario
        botao="Preço"
        titulo={`Preço de “${produto.nome}”`}
        descricao="É a oferta de hoje. As vendas já registradas guardam o valor da época e não mudam."
        rotuloEnviar="Salvar"
        variante="secundario"
        action={acaoDefinirPreco.bind(null, clienteId, produto.id, {})}
      >
        <label>
          <RotuloCampo>Preço</RotuloCampo>
          <input
            name="preco"
            autoFocus
            inputMode="decimal"
            defaultValue={produto.preco === null ? '' : produto.preco.toFixed(2).replace('.', ',')}
            placeholder="ex.: 150,00"
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
          <span className="mt-1.5 block text-[11px] leading-5 text-dim">
            Apagar o campo volta para “não informado”, e aí o bot
            deixa de anunciar preço em vez de anunciar um antigo.
          </span>
        </label>
      </ModalFormulario>
      <ModalFormulario
        botao="Categoria"
        titulo={`Categoria de “${produto.nome}”`}
        descricao="Agrupa o item na grade e deixa o bot procurar só dentro dela. Trocar de categoria leva o item para o fim do grupo novo."
        rotuloEnviar="Salvar"
        variante="secundario"
        action={acaoDefinirCategoria.bind(null, clienteId, produto.id, {})}
      >
        <label>
          <RotuloCampo>Categoria</RotuloCampo>
          <input
            name="categoria"
            autoFocus
            list={ID_DAS_CATEGORIAS}
            maxLength={60}
            defaultValue={produto.categoria ?? ''}
            placeholder="ex.: Pizzas, Bebidas"
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
          <span className="mt-1.5 block text-[11px] leading-5 text-dim">
            Em branco tira a categoria, e o item vai para “Sem categoria”.
          </span>
        </label>
      </ModalFormulario>
      <ModalFormulario
        botao="Renomear"
        titulo={`Renomear “${produto.nome}”`}
        descricao="As vendas já registradas guardam o nome da época, e não mudam: renomear vale daqui para a frente."
        rotuloEnviar="Salvar"
        variante="secundario"
        action={acaoRenomearProduto.bind(null, clienteId, produto.id, {})}
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
      <BotaoArquivar clienteId={clienteId} produto={produto} arquivar />
    </>
  )
}
