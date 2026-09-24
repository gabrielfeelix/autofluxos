"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { comoFalta, dentroDaPortaDeEntrada, restaDaJanela } from "@/channels/janela";
import { Dica } from "@/components/design/dica";
import { LARGURA_DA_FILA } from "@/components/design/tema";
import { chavesDoTelefone } from "@/core/contatos/telefone";
import { Avatar } from "@/components/inbox/avatar";
import { RailsLocais } from "@/components/inbox/fila-local";
import {
  ESTADOS_DA_FILA,
  PilulaInterruptor,
  PilulaMenu,
  type OpcaoDaPilula,
} from "@/components/inbox/pilulas";
import { TETO_DA_INSIGNIA } from "@/core/insignia";
import { TETO_DE_FIXADAS } from "@/core/marcadores";
import {
  acaoFixarConversa,
  acaoMarcarNaoLida,
} from "@/server/acoes-marcadores";
import { nomeDoTipo } from "@/core/tipo-da-mensagem";
import { quando } from "@/lib/quando";
import type { FiltroDeEstado, Lead } from "@/server/repos/leads";
import type { MembroDaConta } from "@/server/repos/usuarios";
import { ContadorDeAgendadas } from "@/components/inbox/contador-de-agendadas";
import type { MensagemAgendada } from "@/server/repos/mensagens-agendadas";

export type Contagem = {
  total: number;
  semDono: number;
  porUsuario: Map<string, number>;
};

/**
 * A coluna da esquerda do Inbox: busca, os dois rails e a lista de conversas.
 *
 * ---------------------------------------------------------------------------
 * Por que ela mora fora do `page.tsx`, e por que é `'use client'`
 * ---------------------------------------------------------------------------
 *
 * Os rails filtram campos que **já vêm em cada `Lead`**, `estadoEfetivo` e
 * `atribuidoA`. Enquanto cada ficha era um `<Link>` para a mesma rota com outro
 * `?estado=`, clicar refazia a página no servidor, sete consultas, e a tela
 * ficava parada até a resposta: dois segundos para mostrar um subconjunto do
 * que já estava na tela.
 *
 * Filtrar no navegador exige estado, e estado exige componente de cliente. A
 * `Fila` inteira veio junto porque os rails vivem dentro do `<header>` e a
 * lista fora dele: sem um pai cliente envolvendo os dois, o recorte escolhido
 * lá em cima não tem como chegar aqui embaixo. Duas tentativas de atalho,
 * manter a `Fila` no servidor e enfiar só os rails num cliente, falharam
 * exatamente aí.
 *
 * Ela é elegível: não usa `await`, nem `async`, nem Server Action. O último
 * bloqueio era `TETO_DA_INSIGNIA`, que morava em `repos/leituras.ts`
 * (`server-only`) e foi para `core/insignia.ts`.
 *
 * ---------------------------------------------------------------------------
 * Os dois modos, e por que o servidor continua existindo
 * ---------------------------------------------------------------------------
 *
 * `filaInteira` (`local`) só vem abaixo de `TETO_DA_FILA_LOCAL`. Acima dele a
 * lista é paginada, e filtrar o que está carregado **mente**: "Adiadas 40"
 * mostrando três porque as outras 37 estão na página 2. Aí os rails voltam a
 * ser `<Link>` e quem filtra é o servidor, como sempre fez.
 */
export function Fila({
  clienteId,
  leads,
  local,
  selecionado,
  esperando,
  equipe,
  contagem,
  porEstado,
  atribuicao,
  estado,
  termo,
  usuarioId,
  naoLidas,
  fixadas,
  pagina,
  paginas,
  agendadas,
  doInstagram,
  rotuloDeTodos = "Todos os atendentes",
}: {
  clienteId: string;
  /** A página que o servidor filtrou. É o que a lista mostra no modo paginado. */
  leads: Lead[];
  /**
   * A fila inteira, sem filtro de estado nem de dono, ou `null` quando a conta
   * passou de `TETO_DA_FILA_LOCAL` e a tela precisa continuar paginando.
   */
  local: Lead[] | null;
  selecionado: Lead | null;
  esperando: number;
  /**
   * O nome do "todos" do filtro de dono. Para quem vê a conta inteira são
   * todos os atendentes; para o atendente restrito, "todos" é o que ele
   * alcança, e chamar isso de "Todos os atendentes" prometeria o que não há.
   */
  rotuloDeTodos?: string;
  equipe: MembroDaConta[];
  contagem: Contagem;
  porEstado: { aberta: number; adiada: number; resolvida: number };
  atribuicao: string;
  estado: FiltroDeEstado;
  termo: string;
  usuarioId: string | null;
  naoLidas: Map<string, number>;
  /**
   * As conversas que **esta pessoa** grudou no topo, e quando grudou.
   *
   * Vem do servidor em vez de nascer aqui porque é dado de banco (a 0063), e
   * chega como `Map` de contato para `fixada_em`: a tela precisa das duas
   * coisas, quem está fixado e em que ordem. Ordenar por última mensagem
   * dentro do bloco fixado faria o topo se reembaralhar a cada mensagem que
   * chega, o oposto do que o alfinete promete.
   */
  fixadas: Map<string, string>;
  pagina: number;
  paginas: number;
  /**
   * Tudo o que ainda vai sair nesta conta, com o nome do contato junto.
   *
   * Vem inteiro e não só contado porque o número é um botão: clicar abre a
   * lista com o cancelar. Buscar de novo ao abrir daria uma espera no clique
   * para carregar o que já cabia na mesma consulta.
   */
  agendadas: (MensagemAgendada & { nomeDoContato: string | null })[];
  /** Quem fala pelo Instagram. Todo o resto é WhatsApp. Ver `contatosDoInstagram`. */
  doInstagram: Set<string>;
}) {
  /*
   * O recorte que os rails locais publicam. Começa na página do servidor para
   * o primeiro quadro já mostrar a lista certa: `RailsLocais` só publica depois
   * da pintura, e nascer vazio piscaria "nenhuma conversa" antes do efeito
   * rodar.
   */
  const [recorte, setRecorte] = useState<Lead[]>(leads);

  /*
   * `useCallback` porque `RailsLocais` tem o callback entre as dependências do
   * efeito que publica o recorte. Uma função nova a cada render faria o efeito
   * rodar a cada render, e cada rodada chama `setRecorte`, laço infinito.
   */
  const aoRecortar = useCallback((novo: Lead[]) => setRecorte(novo), []);

  /*
   * Os dois filtros que moram aqui em cima, e **só existem no modo local**.
   *
   * Eles trabalham sobre a lista que está na memória. No modo paginado essa
   * lista é uma página de cinquenta, e filtrar ou ordenar cinquenta de cinco
   * mil é pior do que não oferecer: "Não lidas 3" mostrando três porque as
   * outras trinta estão na página 4 é um número que mente sem avisar.
   *
   * A mesma regra que decide se os rails filtram no navegador decide se estas
   * pílulas aparecem, ver `TETO_DA_FILA_LOCAL`.
   */
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>("recentes");

  /*
   * O que está escrito na busca **agora**, que não é o mesmo que `termo`.
   *
   * `termo` é o que o servidor já filtrou e está no endereço; este é o que a
   * pessoa está digitando. No modo local os dois divergem entre a primeira
   * letra e o Enter, e é justamente nesse intervalo que a lista precisa
   * responder.
   */
  const [digitado, setDigitado] = useState(termo);

  /*
   * ---------------------------------------------------------------------------
   * As marcações desta pessoa, e por que elas são **correções** do que o
   * servidor mandou, e não uma cópia dele
   * ---------------------------------------------------------------------------
   *
   * Fixar e marcar como não lida precisam acontecer no clique: são gestos de
   * organizar a própria fila, e esperar o servidor faria cada um parecer que não
   * funcionou (ver `acao-otimista.ts`).
   *
   * O caminho errado seria espelhar `naoLidas` e `fixadas` em estado. Estado
   * inicial só vale na montagem, e esta lista **é atualizada pelo servidor o
   * tempo todo**, o pulso do Inbox refaz a página a cada mensagem que chega.
   * Um espelho congelaria a insígnia no valor da primeira pintura, e a fila
   * pararia de contar mensagem nova.
   *
   * Por isso o que mora aqui é só o **remendo**: o que esta aba mexeu e o
   * servidor ainda não confirmou. Quando props novas chegam, e elas chegam a
   * cada revalidação, o remendo é jogado fora, porque a partir dali quem sabe
   * a verdade é o servidor, inclusive quando a verdade é que a escrita falhou.
   */
  const [remendoDeNaoLidas, setRemendoDeNaoLidas] = useState<Map<string, number>>(new Map());
  const [remendoDeFixadas, setRemendoDeFixadas] = useState<Map<string, string | null>>(new Map());
  const [erroDaMarcacao, setErroDaMarcacao] = useState<string | null>(null);
  const [marcando, marcar] = useTransition();

  useEffect(() => {
    setRemendoDeNaoLidas(new Map());
    setRemendoDeFixadas(new Map());
  }, [naoLidas, fixadas]);

  const semLerDe = useCallback(
    (contatoId: string) =>
      remendoDeNaoLidas.get(contatoId) ?? naoLidas.get(contatoId) ?? 0,
    [remendoDeNaoLidas, naoLidas],
  );

  /** Quando esta pessoa fixou a conversa, ou `null` se ela não está fixada. */
  const fixadaEm = useCallback(
    (contatoId: string) => {
      const remendada = remendoDeFixadas.get(contatoId);
      if (remendada !== undefined) return remendada;
      return fixadas.get(contatoId) ?? null;
    },
    [remendoDeFixadas, fixadas],
  );

  /** Quantas estão fixadas agora, contando o que esta aba acabou de mexer. */
  const quantasFixadas = useMemo(() => {
    const ids = new Set(fixadas.keys());
    for (const [id, quando] of remendoDeFixadas) {
      if (quando === null) ids.delete(id);
      else ids.add(id);
    }
    return ids.size;
  }, [fixadas, remendoDeFixadas]);

  /** Aplica o remendo, chama o servidor, e desfaz o remendo se ele recusar. */
  const comRemendo = useCallback(
    (aplicar: () => void, desfazer: () => void, acao: () => Promise<{ ok: boolean; erro?: string }>) => {
      setErroDaMarcacao(null);
      aplicar();
      marcar(async () => {
        try {
          const r = await acao();
          if (!r.ok) {
            desfazer();
            setErroDaMarcacao(r.erro ?? "não deu para marcar");
          }
        } catch {
          desfazer();
          setErroDaMarcacao("sem conexão com o servidor");
        }
      });
    },
    [],
  );

  const alternarFixada = useCallback(
    (contatoId: string) => {
      const estava = fixadaEm(contatoId);
      const grudar = estava === null;
      comRemendo(
        () =>
          setRemendoDeFixadas((antes) =>
            new Map(antes).set(contatoId, grudar ? new Date().toISOString() : null),
          ),
        () => setRemendoDeFixadas((antes) => new Map(antes).set(contatoId, estava)),
        () => acaoFixarConversa(clienteId, contatoId, grudar),
      );
    },
    [clienteId, comRemendo, fixadaEm],
  );

  const marcarNaoLida = useCallback(
    (contatoId: string) => {
      const antes = semLerDe(contatoId);
      comRemendo(
        () => setRemendoDeNaoLidas((mapa) => new Map(mapa).set(contatoId, Math.max(antes, 1))),
        () => setRemendoDeNaoLidas((mapa) => new Map(mapa).set(contatoId, antes)),
        () => acaoMarcarNaoLida(clienteId, contatoId),
      );
    },
    [clienteId, comRemendo, semLerDe],
  );

  const naTela = useMemo(() => {
    const base = local ? recorte : leads;
    if (!local) return comFixadasNoTopo(base, fixadaEm);
    const recortada = soNaoLidas
      ? base.filter((lead) => semLerDe(lead.contatoId) > 0)
      : base;
    return comFixadasNoTopo(ordenar(procurar(recortada, digitado), ordem), fixadaEm);
  }, [local, recorte, leads, soNaoLidas, semLerDe, ordem, digitado, fixadaEm]);

  const nomeDe = (id: string | null) =>
    id
      ? (equipe.find((membro) => membro.id === id)?.nome.split(" ")[0] ??
        "alguém")
      : null;

  /**
   * A coluna é flex, e não tem altura calculada.
   *
   * A lista usava `max-h-[calc(100vh-264px)]`: um número mágico amarrado à
   * altura exata do cabeçalho da página. O rail e a paginação mudaram essa
   * altura, e um `calc` desses erra em silêncio, a lista some por baixo ou
   * sobra espaço em branco, sem nada quebrar para avisar. Com `flex-1` e
   * `min-h-0`, quem decide é o próprio layout.
   */

  /** O endereço de uma aba do rail, preservando a conversa aberta. */
  const comBusca = termo === "" ? "" : `&busca=${encodeURIComponent(termo)}`;
  const conversaAberta = selecionado
    ? `&conversa=${encodeURIComponent(selecionado.contatoId)}`
    : "";
  /*
   * Os dois eixos convivem no endereço: trocar de dono não pode jogar a pessoa
   * de volta para a fila aberta, nem trocar de estado perder o filtro de quem
   * atende. Cada link mexe num e carrega o outro.
   */
  const linkDe = (valor: string) =>
    `/clientes/${clienteId}/inbox?de=${encodeURIComponent(valor)}&estado=${estado}${comBusca}${conversaAberta}`;
  const linkDoEstado = (valor: FiltroDeEstado) =>
    `/clientes/${clienteId}/inbox?de=${encodeURIComponent(atribuicao)}&estado=${valor}${comBusca}${conversaAberta}`;
  /** As opções do eixo "de quem é", montadas da equipe da conta. */
  const opcoesDeDono: OpcaoDaPilula[] = [
    {
      chave: "todos",
      rotulo: rotuloDeTodos,
      contagem: contagem.total,
      href: linkDe("todos"),
    },
    {
      chave: "sem-dono",
      rotulo: "Sem dono",
      descricao: "Ninguém assumiu ainda",
      contagem: contagem.semDono,
      href: linkDe("sem-dono"),
    },
    ...(usuarioId
      ? [
          {
            chave: usuarioId,
            rotulo: "Meus atendimentos",
            contagem: contagem.porUsuario.get(usuarioId) ?? 0,
            href: linkDe(usuarioId),
          },
        ]
      : []),
    ...equipe
      .filter((membro) => membro.id !== usuarioId)
      .map((membro) => ({
        chave: membro.id,
        rotulo: membro.nome,
        contagem: contagem.porUsuario.get(membro.id) ?? 0,
        ausente: membro.presenca !== "disponivel",
        href: linkDe(membro.id),
      })),
  ];

  return (
    <>
      {/*
        A barra atravessa a moldura inteira, ver `MolduraDoInbox`. Ela e a
        lista são **irmãs** num fragmento, e não pai e filho: envolvê-las num
        `<div>` tiraria as duas da grade e a barra deixaria de atravessar.
      */}
      <header className="col-span-full border-b border-line">
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
          <h2 className="shrink-0 text-[17px] font-bold tracking-[-0.02em]">
            Caixa de Entrada
          </h2>
          <span
            title={`${contagem.total} conversa(s) nesta conta`}
            className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[11px] text-muted"
          >
            {contagem.total}
          </span>

          {/*
            A engrenagem leva para os ajustes de atendimento, etiquetas,
            respostas rápidas, horário, equipe. Ela fica aqui e não num menu
            porque é o caminho que se percorre no meio do trabalho: alguém
            precisa de uma etiqueta nova enquanto atende, não numa sessão
            separada de configuração.
          */}
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            {/*
              A porta das guardadas fica aqui, e não na barra lateral.

              Guardar mensagem é um bolso do Inbox, não uma seção do produto:
              quem vai ver o que guardou veio desta tela e volta para ela. Um
              item próprio na lateral daria à lista o mesmo peso de Funis e
              Automações, que é peso que ela não tem.
            */}
            <Dica texto="Mensagens que você guardou" lado="baixo">
              <Link
                href={`/clientes/${clienteId}/favoritas`}
                aria-label="Mensagens que você guardou"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-dim transition hover:bg-surface hover:text-ink"
              >
                <Estrela />
              </Link>
            </Dica>

            <Dica texto="Ajustes do atendimento" lado="baixo">
              <Link
                href={`/clientes/${clienteId}/ajustes`}
                aria-label="Ajustes do atendimento"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-dim transition hover:bg-surface hover:text-ink"
              >
                <Engrenagem />
              </Link>
            </Dica>
          </span>
        </div>

        {/*
          Os filtros numa linha só, atravessando.

          O eixo do estado vem primeiro porque "o que precisa de mim agora" é a
          primeira pergunta de quem abre a tela; "de quem é" só faz sentido
          depois de respondida.
        */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
          {local ? (
            <RailsLocais
              clienteId={clienteId}
              leads={local}
              estadoInicial={estado}
              atribuicaoInicial={atribuicao}
              busca={termo}
              conversaAberta={selecionado?.contatoId ?? null}
              equipe={equipe}
              usuarioId={usuarioId}
              rotuloDeTodos={rotuloDeTodos}
              aoRecortar={aoRecortar}
            />
          ) : (
            <>
              <PilulaMenu
                aria="Estado da conversa"
                escolhida={estado}
                rotulo={
                  ESTADOS_DA_FILA.find((e) => e.chave === estado)?.rotulo ??
                  "Conversas"
                }
                opcoes={ESTADOS_DA_FILA.map((opcao) => ({
                  ...opcao,
                  contagem: porEstado[opcao.chave],
                  href: linkDoEstado(opcao.chave),
                }))}
              />
              {(equipe.length > 0 || contagem.semDono < contagem.total) && (
                <PilulaMenu
                  aria="Filtrar por quem atende"
                  escolhida={atribuicao}
                  rotulo={
                    opcoesDeDono.find((o) => o.chave === atribuicao)?.rotulo ??
                    rotuloDeTodos
                  }
                  opcoes={opcoesDeDono}
                />
              )}
            </>
          )}

          {local && (
            <>
              <PilulaInterruptor
                rotulo="Não lidas"
                ligada={soNaoLidas}
                aoAlternar={() => setSoNaoLidas((x) => !x)}
                contagem={naoLidas.size}
              />
              <PilulaMenu
                aria="Ordem da lista"
                escolhida={ordem}
                rotulo={`Classificar: ${ORDENS.find((o) => o.chave === ordem)?.curto ?? ""}`}
                opcoes={ORDENS.map(({ chave, rotulo, descricao }) => ({
                  chave,
                  rotulo,
                  descricao,
                }))}
                aoEscolher={(chave) => setOrdem(chave as Ordem)}
              />
            </>
          )}

          {/*
            O estado da fila no canto: é a única linha desta barra que não é um
            controle, e por isso fica do outro lado, sem competir com as
            pílulas por atenção.
          */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <p className="text-[12px] text-dim">
              {esperando > 0
                ? `${esperando} esperando uma pessoa`
                : "Todas as conversas estão com o bot"}
            </p>
            {/*
              O contador de agendadas vem depois do estado da fila porque a
              ordem é a da urgência: quem está esperando agora vem antes do que
              vai sair amanhã. Ele some sozinho quando não há nenhuma.
            */}
            <ContadorDeAgendadas
              clienteId={clienteId}
              quantas={agendadas.length}
              lista={agendadas}
            />
          </div>
        </div>
      </header>

      <aside className="relative flex min-h-0 min-w-0 flex-col border-r border-line bg-panel">
        {/*
          A busca mora **na coluna da lista**, encostada no primeiro contato.

          Ela nasceu na barra de cima, centrada e atravessando a moldura inteira.
          Lá ela ficava longe do que filtra: a pessoa digitava num campo à
          direita do título e o resultado acontecia numa coluna de 320px lá
          embaixo à esquerda, com a conversa aberta no meio do caminho entre os
          dois. Controle e efeito precisam estar encostados, o campo sobre a
          lista diz, sem legenda, que é a lista que ele encolhe.

          O que ela filtra não mudou, e é o que os comentários abaixo defendem:
          formulário `GET`, filtro local enquanto se digita, Enter indo ao
          servidor. Só o lugar na tela é outro.

          A largura larga (`max-w-[680px]`) foi embora junto com o centro: aqui a
          medida é a da coluna, e a coluna é redimensionável pela pessoa.
        */}
        {/*
          A busca é o "[+] iniciar conversa" do desenho de referência, na
          forma que faz sentido aqui.

          Escrever primeiro para alguém só é possível **dentro da janela de 24
          horas**, fora dela a Meta exige modelo aprovado, que este produto
          ainda não tem. E quem está dentro da janela já está nesta lista: o
          que falta não é um botão de começar, é achar a pessoa quando a
          conversa dela já rolou para baixo.

          Formulário `GET`: a busca vira endereço, e endereço de busca dá para
          guardar e recarregar. **Continua indo ao servidor mesmo no modo
          local**, e de propósito: a busca casa telefone por formas
          normalizadas (`chavesDoTelefone`), e repetir essa regra aqui seria
          duplicar justamente a parte que erra sozinha, quem procura
          "(11) 98765-4321" não acha `551187654321` com comparação de texto.
        */}
        {/*
          **Filtra enquanto se digita, e ainda assim é um formulário `GET`.**

          No modo local a fila inteira está no navegador: filtrar é um
          `filter()` e não há razão para esperar o Enter, quem procura alguém
          numa lista de trezentas quer ver a lista encolher na terceira letra.

          O formulário continua existindo, e o Enter continua indo ao
          servidor, por dois motivos. No modo paginado ele é a única busca que
          existe, porque filtrar uma página de cinquenta de cinco mil acharia
          só quem por acaso estava carregado. E mesmo no local, a busca do
          servidor casa telefone por formas normalizadas do banco, o Enter é
          como se pede a resposta autoritativa, e o endereço resultante dá
          para guardar e mandar para alguém.
        */}
        <div className="shrink-0 border-b border-line px-3 py-2.5">
          <form method="get" className="relative">
            <input type="hidden" name="de" value={atribuicao} />
            <input type="hidden" name="estado" value={estado} />
            {selecionado && (
              <input
                type="hidden"
                name="conversa"
                value={selecionado.contatoId}
              />
            )}
            <Lupa />
            <input
              type="search"
              name="busca"
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              placeholder="Pesquisar em conversas"
              aria-label="Pesquisar em conversas"
              className="app-field rounded-full py-2 pr-9 pl-9 text-[13px]"
            />
            {digitado !== "" && (
              <button
                type="button"
                onClick={() => setDigitado("")}
                aria-label="Limpar a busca"
                className="absolute top-1/2 right-2.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-dim transition hover:bg-surface hover:text-ink"
              >
                <span aria-hidden className="text-[13.5px] leading-none">
                  ×
                </span>
              </button>
            )}
            {/* O Enter já envia. O botão existe para o comando estar dito em
              algum lugar para quem usa leitor de tela. */}
            <button type="submit" className="sr-only">
              Buscar
            </button>
          </form>

          {/*
            **O "marcar as N conversas à vista como lidas" saiu daqui**, e o
            motivo é o do dono: *"nem dá para entender. Por que a vista?"*.

            O rótulo tentava ser honesto sobre o recorte (rail mais busca) e o
            preço disso era uma frase que ninguém lê como ação. Pior: era a única
            ação em lote do Inbox, e ela agia numa seleção invisível, que a
            pessoa não montou e não vê.

            O caminho combinado é o do WhatsApp: selecionar conversas e então
            agir sobre elas, com arquivar e marcar como lida na mesma barra. Até
            isso existir, marcar como lida continua acontecendo pelo caminho de
            sempre, que é abrir a conversa.

            `acaoMarcarTodasComoLidas` continua existindo e recebe uma lista de
            ids, então a seleção em lote encaixa nela sem servidor novo. Ver
            `server/acoes-marcadores.ts`.
          */}

          {erroDaMarcacao && (
            <p role="alert" className="mt-1.5 text-[11.5px] leading-4 text-perigo">
              {erroDaMarcacao}
            </p>
          )}
        </div>

        {/*
          A conversa aberta que a lista não mostra (8.5, X01): veio de um link,
          de um aviso ou da ficha, e não cabe no filtro escolhido. A conversa
          abre do mesmo jeito; o aviso diz por que ela não está marcada na
          lista, e some quando o filtro passa a incluí-la. No modo paginado a
          lista é uma página só, e aí a frase não pode afirmar "filtro".
        */}
        {selecionado &&
          !naTela.some((lead) => lead.contatoId === selecionado.contatoId) && (
            <p
              role="status"
              className="mx-3 mt-2 shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/[0.08] px-3 py-2 text-[11.5px] leading-4 text-soft"
            >
              <strong className="font-semibold">
                {selecionado.nome ?? "Esta conversa"}
              </strong>{" "}
              {local
                ? "está fora do filtro atual. Ela continua aberta ao lado."
                : "não está nesta página da lista. Ela continua aberta ao lado."}
            </p>
          )}

        <nav
          aria-label="Conversas"
          className="min-h-0 flex-1 overflow-y-auto py-1.5"
        >
          {naTela.map((lead) => {
            const ativa = lead.contatoId === selecionado?.contatoId;
            const nome = lead.nome ?? "sem nome";
            const semLer = semLerDe(lead.contatoId);
            const presa = fixadaEm(lead.contatoId) !== null;
            return (
              /*
                A linha virou `div` com o `Link` dentro, e não é reorganização
                à toa: os dois botões de marcação **não podem** ser filhos do
                `Link`. Botão dentro de link é HTML inválido, e o efeito prático
                é o pior possível, clicar no alfinete navegaria para a conversa
                antes de o `onClick` decidir qualquer coisa.

                O `group` sobe junto com o `relative`, porque é o hover da linha
                inteira que revela os botões.
              */
              <div
                key={lead.contatoId}
                className={`group relative mx-1.5 mb-0.5 rounded-[10px] transition pointer-coarse:flex pointer-coarse:items-start ${
                  ativa ? "bg-primary/[0.16]" : "hover:bg-surface"
                }`}
              >
              {/*
                `prefetch` ligado: sem ele o Next só pré-carrega o `loading` da
                rota, e a conversa inteira começa do zero no clique. Com ele, a
                navegação já encontra parte do trabalho feito.

                A fila tem no máximo `CONVERSAS_POR_PAGINA` itens visíveis e o
                prefetch acontece quando o link entra em viewport, então o custo
                é limitado à página que a pessoa está vendo.
              */}
              <Link
                href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(lead.contatoId)}`}
                aria-current={ativa ? "page" : undefined}
                scroll={false}
                prefetch
                className="flex min-w-0 flex-1 items-start gap-3 rounded-[10px] px-3 py-2.5"
              >
                <Avatar
                  nome={lead.nome}
                  alerta={Boolean(lead.aguardando)}
                  tamanho={44}
                  canal={doInstagram.has(lead.contatoId) ? "instagram" : "whatsapp"}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <strong
                      className={`min-w-0 flex-1 truncate text-[15px] leading-5 tracking-[-0.01em] text-ink ${semLer > 0 ? "font-bold" : "font-semibold"}`}
                    >
                      {nome}
                    </strong>
                    {/*
                      O alfinete deitado fica **sempre** visível na fixada, e os
                      botões de ação só no hover. São papéis diferentes: este diz
                      um estado (por que esta conversa está no topo), aqueles
                      oferecem uma ação. Sem ele, o bloco do topo seria um grupo
                      de conversas fora de ordem sem explicação nenhuma.
                    */}
                    {presa && (
                      <span
                        aria-label="Conversa fixada"
                        title="Você fixou esta conversa"
                        className="shrink-0 text-dim group-hover:opacity-0"
                      >
                        <Alfinete preso />
                      </span>
                    )}
                    <small
                      className={`shrink-0 text-[12px] group-hover:opacity-0 ${semLer > 0 ? "font-semibold text-primary" : "text-muted"}`}
                    >
                      {lead.ultimaEm ? quando(lead.ultimaEm) : ""}
                    </small>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    {/*
                    O `title` existe porque o motivo do handoff **é a
                    informação que resolve o problema**, "a chamada respondeu
                    500", "o modelo demorou demais", e ele chega a 75
                    caracteres numa coluna de 292px. Truncado e sem `title`, a
                    linha vermelha só dizia que havia algo errado e escondia o
                    quê: nem o mouse, nem outra tela contavam.
                  */}
                    <span
                      title={
                        lead.aguardando
                          ? `Aguardando pessoa: ${lead.aguardando.motivo}`
                          : undefined
                      }
                      className={`min-w-0 flex-1 truncate text-[13.5px] leading-5 ${semLer > 0 ? "font-medium text-ink" : "text-soft"}`}
                    >
                      {/*
                        Só o rótulo em vermelho, o motivo em cinza: o rótulo
                        diz "precisa de gente", e é o único ponto vermelho que
                        a linha precisa. Motivo inteiro em vermelho competia com
                        o nome pela atenção.
                      */}
                      {lead.aguardando ? (
                        <>
                          <span className="font-semibold text-perigo">Pessoa: </span>
                          {lead.aguardando.motivo}
                        </>
                      ) : (
                        <ResumoDaConversa lead={lead} />
                      )}
                    </span>
                    {/*
                    A insígnia é **minha**, não da conversa: ela conta o que
                    entrou depois da última vez que *eu* abri. "Alguém leu" é
                    exatamente a informação que não ajuda ninguém a decidir o
                    que abrir agora.
                  */}
                    {semLer > 0 && (
                      <span
                        title={`${semLer} ${semLer === 1 ? "mensagem nova" : "mensagens novas"} desde a última vez que você abriu`}
                        aria-label={`${semLer} não ${semLer === 1 ? "lida" : "lidas"} para você`}
                        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11.5px] font-bold text-white"
                      >
                        {semLer > TETO_DA_INSIGNIA
                          ? `${TETO_DA_INSIGNIA}+`
                          : semLer}
                      </span>
                    )}
                  </span>
                  {lead.aguardando && (
                    <RelogioDaJanela
                      ultimaEntradaEm={lead.ultimaEntradaEm}
                      portaDeEntradaEm={lead.portaDeEntradaEm}
                    />
                  )}
                  {/*
                  Quem assumiu aparece na fila, e não só na conversa aberta: a
                  fila é onde se decide o que pegar, e pegar o que já tem dono é
                  o trabalho duplicado que a atribuição existe para evitar.
                */}
                  {/*
                    Responsável é da conversa; a insígnia acima é só sua (8.1).
                    Abrir a conversa zera a sua insígnia e **não** muda esta
                    linha: ler nunca atribui.
                  */}
                  {nomeDe(lead.atribuidoA) && (
                    <span className="mt-0.5 block truncate text-[12px] text-dim">
                      {lead.atribuidoA === usuarioId
                        ? "responsável: você"
                        : `responsável: ${nomeDe(lead.atribuidoA)}`}
                    </span>
                  )}
                  {/*
                    O bot calado aparece **na fila**, e não só na conversa
                    aberta.

                    Veio de um relato de uso: o bot "não estava indo" e ninguém
                    entendia por quê. Não era defeito, era handoff: alguém
                    tinha assumido a conversa, e assumir cala o bot naquele
                    contato. A informação existia só dentro da conversa aberta,
                    e a fila, que é onde se decide o que abrir, não dizia nada.

                    Separado de `aguardando`: aquilo é a fila formal de quem
                    pediu atendente e tem relógio correndo. Este é o estado
                    silencioso: ninguém está esperando, mas o robô também não
                    responde, e sem alguém voltar ali a conversa fica muda para
                    sempre. É justamente o que não tem sintoma nenhum.
                  */}
                  {!lead.automacaoAtiva && !lead.aguardando && (
                    <span
                      title="O bot está pausado neste contato. Ele só volta quando alguém religar o bot."
                      className="mt-0.5 flex items-center gap-1 text-[12px] text-amber-700"
                    >
                      <BotMudo />
                      bot pausado
                    </span>
                  )}
                </span>
              </Link>

              {/*
                Os dois gestos da linha, no canto onde o horário estava.

                Eles **substituem** o horário no hover em vez de empurrá-lo: a
                largura da coluna é ajustável e chega a caber pouco mais que o
                nome, e dois botões somados ao horário espremeriam o nome no
                exato momento em que a pessoa está correndo o olho pela lista.
                É o que o WhatsApp faz com o `v` que aparece ao passar o mouse.

                `opacity-0` com `group-hover` e `focus-within`, e não
                `hidden`: quem chega por teclado precisa achar o botão no Tab, e
                um elemento que não existe no DOM não recebe foco.

                No toque não existe hover (o `group-hover` do Tailwind só vale
                com `hover: hover`), então com ponteiro grosso os botões saem
                do canto sobreposto e viram uma coluna fixa à direita da linha,
                sempre visível e com alvo de 32 px. O horário continua no lugar.
              */}
              <span className="pointer-events-none absolute top-3 right-3 flex items-center gap-0.5 opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:static pointer-coarse:flex-col pointer-coarse:gap-1 pointer-coarse:py-2 pointer-coarse:pr-1 pointer-coarse:opacity-100">
                <BotaoDaLinha
                  rotulo={presa ? `Soltar ${nome} do topo` : `Fixar ${nome} no topo`}
                  dica={
                    presa
                      ? "Soltar do topo"
                      : quantasFixadas >= TETO_DE_FIXADAS
                        ? `Você já fixou ${TETO_DE_FIXADAS} conversas. Solte uma para fixar outra.`
                        : "Fixar no topo"
                  }
                  /*
                    Desabilitado no teto, e o `title` diz por quê, campo que
                    some sem explicar é pior que campo desabilitado. Soltar
                    nunca é bloqueado, senão quem chega ao teto fica preso nele.
                  */
                  desabilitado={marcando || (!presa && quantasFixadas >= TETO_DE_FIXADAS)}
                  aceso={presa}
                  aoClicar={() => alternarFixada(lead.contatoId)}
                >
                  <Alfinete preso={presa} />
                </BotaoDaLinha>

                {/*
                  Marcar como não lida **não aparece na conversa aberta**, e
                  isso não é economia de espaço: abrir a conversa marca como
                  lida ao desenhar (ver `marcarComoLida` no `page.tsx`), então
                  o gesto seria desfeito no quadro seguinte. Um botão que se
                  desfaz sozinho ensina que a tela está quebrada.
                */}
                {!ativa && semLer === 0 && (
                  <BotaoDaLinha
                    rotulo={`Marcar a conversa de ${nome} como não lida`}
                    dica="Marcar como não lida"
                    desabilitado={marcando}
                    aoClicar={() => marcarNaoLida(lead.contatoId)}
                  >
                    <Envelope />
                  </BotaoDaLinha>
                )}
              </span>
              </div>
            );
          })}

          {naTela.length === 0 && (
            <p className="px-4 py-8 text-center text-[12.5px] leading-5 text-dim">
              {(local ? digitado : termo) === ""
                ? "Nenhuma conversa neste filtro."
                : `Ninguém com “${local ? digitado : termo}” aqui. Enter procura no servidor.`}
            </p>
          )}
        </nav>

        {/*
        No modo local não há paginação: a fila inteira está aqui, e trocar de
        aba não muda isso. Os `paginas > 1` só acontecem do outro lado do teto.
      */}
        {!local && paginas > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
            <PassoDaPagina
              href={`/clientes/${clienteId}/inbox?de=${encodeURIComponent(atribuicao)}${comBusca}&pagina=${pagina - 1}`}
              desabilitado={pagina <= 1}
              rotulo="Página anterior"
            >
              ‹
            </PassoDaPagina>
            <span className="font-mono text-[11px] text-dim">
              {pagina} / {paginas}
            </span>
            <PassoDaPagina
              href={`/clientes/${clienteId}/inbox?de=${encodeURIComponent(atribuicao)}${comBusca}&pagina=${pagina + 1}`}
              desabilitado={pagina >= paginas}
              rotulo="Próxima página"
            >
              ›
            </PassoDaPagina>
          </div>
        )}

        <PuxadorDaFila />
      </aside>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* A borda que se arrasta                                                     */
/* -------------------------------------------------------------------------- */

/**
 * O puxador que muda a largura da coluna de conversas.
 *
 * ---------------------------------------------------------------------------
 * Por que ele existe
 * ---------------------------------------------------------------------------
 *
 * 320px é um bom padrão e não serve a todo mundo. Quem trabalha com nomes
 * longos e prévia de mensagem quer mais; quem passa o dia lendo a conversa
 * quer menos. É a mesma escolha que todo cliente de e-mail e de chat oferece, e
 * pela mesma razão: a proporção certa depende do trabalho, não do produto.
 *
 * ---------------------------------------------------------------------------
 * Por que o arrasto não passa pelo React
 * ---------------------------------------------------------------------------
 *
 * O `pointermove` escreve direto na variável de CSS do `<html>`. Um `setState`
 * por quadro renderizaria a lista inteira, que pode ter quinhentas conversas,
 * sessenta vezes por segundo, para mudar uma medida que o CSS resolve sozinho.
 * O React só volta a participar no `pointerup`, para gravar.
 *
 * `setPointerCapture` é o que faz o arrasto sobreviver ao ponteiro sair de cima
 * da faixa de 5px, sem ele, mover rápido solta o puxador no meio do gesto.
 */
function PuxadorDaFila() {
  const arrasto = useRef<{ x: number; largura: number } | null>(null);

  const larguraAtual = () => {
    const escrita = getComputedStyle(document.documentElement).getPropertyValue(
      LARGURA_DA_FILA.variavel,
    );
    return parseInt(escrita, 10) || LARGURA_DA_FILA.padrao;
  };

  const aplicar = (px: number) => {
    const preso = Math.min(
      Math.max(px, LARGURA_DA_FILA.minimo),
      LARGURA_DA_FILA.maximo,
    );
    document.documentElement.style.setProperty(
      LARGURA_DA_FILA.variavel,
      `${preso}px`,
    );
    return preso;
  };

  return (
    /*
      Faixa de 5px sobre a borda, meio para cada lado, é a área de acerto, e a
      borda continua sendo o que se vê. `touch-none` impede o navegador de
      entender o arrasto como rolagem no celular.

      `aria-hidden` porque o teclado tem o próprio caminho logo abaixo: o botão
      invisível que só aparece no foco. Uma faixa arrastável não é operável por
      teclado, e anunciar uma não ajuda ninguém.
    */
    <div
      aria-hidden
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        arrasto.current = { x: e.clientX, largura: larguraAtual() };
      }}
      onPointerMove={(e) => {
        if (!arrasto.current) return;
        aplicar(arrasto.current.largura + (e.clientX - arrasto.current.x));
      }}
      onPointerUp={(e) => {
        if (!arrasto.current) return;
        const final = aplicar(
          arrasto.current.largura + (e.clientX - arrasto.current.x),
        );
        arrasto.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        try {
          localStorage.setItem(LARGURA_DA_FILA.chave, String(final));
        } catch {
          // Sem onde gravar, a largura vale só para esta aba.
        }
      }}
      className="absolute top-0 -right-[2px] bottom-0 z-20 hidden w-[5px] cursor-col-resize touch-none md:block hover:bg-primary/25 active:bg-primary/40"
    />
  );
}

function PassoDaPagina({
  href,
  desabilitado,
  rotulo,
  children,
}: {
  href: string;
  desabilitado: boolean;
  rotulo: string;
  children: string;
}) {
  if (desabilitado) {
    return (
      <span
        aria-disabled
        className="rounded-md px-2 py-0.5 text-[13.5px] text-ink/15"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={rotulo}
      scroll={false}
      className="rounded-md px-2 py-0.5 text-[13.5px] text-muted transition hover:bg-surface-strong hover:text-ink"
    >
      {children}
    </Link>
  );
}

/**
 * Quanto tempo ainda dá para responder em texto livre.
 *
 * **Só aparece em quem espera uma pessoa**, e isso é decisão de desenho: a
 * fila já carrega nome, horário e prévia, e um quarto dado em toda linha vira
 * ruído. Onde o relógio decide alguma coisa é exatamente aqui, quem escolhe o
 * que atender primeiro precisa saber de quem a janela está fechando, não de
 * quem está conversando com o bot.
 *
 * §3.10.1: *"a fila precisa mostrar quanto tempo resta, não só que alguém
 * espera"*. Passada a janela, a Meta só aceita modelo aprovado, que este
 * produto ainda não tem, então "fechada" quer dizer que não dá para
 * responder por texto, e é a informação mais importante da linha.
 */
function RelogioDaJanela({
  ultimaEntradaEm,
  portaDeEntradaEm,
}: {
  ultimaEntradaEm: string | null;
  portaDeEntradaEm: string | null;
}) {
  const janela = { ultimaEntradaEm, portaDeEntradaEm };
  const restante = restaDaJanela(janela);

  /*
   * Quem chegou por anúncio e ainda não escreveu não tem janela de texto livre,
   * e **tem** a gratuidade: a linha certa é "só modelo aprovado, e sai de
   * graça". Antes da T3.3 isto aparecia como três dias de janela aberta, e
   * quem confiasse na fila escrevia um parágrafo para receber um erro.
   */
  if (restante === null) {
    return dentroDaPortaDeEntrada(janela) ? (
      <span className="mt-0.5 block text-[12px] text-dim">
        só modelo aprovado<span className="text-dim"> · grátis, veio de anúncio</span>
      </span>
    ) : null;
  }

  /*
   * Quem chegou por anúncio tem 72h de envio gratuito, e elas não custam nada.
   * Dizer isso na fila muda a decisão de quem escolhe o que pegar: é a conversa
   * que dá para resolver sem gastar modelo.
   */
  const gratis = dentroDaPortaDeEntrada(janela);

  if (restante === 0) {
    return (
      /*
        Cinza, não vermelho (24/set). Numa conversa esperando pessoa, a linha
        de cima já é o alerta; as duas em vermelho, e em negrito, gritavam
        juntas e a fila inteira parecia estar pegando fogo. O vermelho fica só
        onde está a ação: alguém precisa atender.
      */
      <span className="mt-0.5 block text-[12px] text-dim">
        janela fechada, só modelo aprovado
      </span>
    );
  }

  // Duas horas é o limite em que avisar ainda muda a decisão de alguém. Acima
  // disso, cor de alerta em toda linha treina a pessoa a ignorar a cor.
  const apertado = restante < 2 * 60 * 60 * 1000;

  return (
    <span
      className={`mt-0.5 block text-[12px] ${apertado ? "font-semibold text-aviso" : "text-dim"}`}
    >
      responder em {comoFalta(restante)}
      {gratis && <span className="text-dim"> · grátis, veio de anúncio</span>}
    </span>
  );
}

/**
 * Quem falou, para o prefixo da linha.
 *
 * Antes toda saída virava **"atendimento:"**, e "atendimento" não é ninguém:
 * numa conta com quatro pessoas respondendo, a linha não dizia qual delas
 * falou, que é o que se quer saber ao correr o olho pela fila.
 *
 * São três casos, e o terceiro é comum o bastante para não ser exceção:
 *
 * - **pessoa**: o primeiro nome, que é o que o colega reconhece;
 * - **automação**: a palavra, em minúscula, porque é estado e não nome próprio;
 * - **saiu daqui e não sabemos por quem**: volta a ser "atendimento". É o eco
 *   da coexistência, quando alguém respondeu pelo **celular** em vez do painel:
 *   a mensagem chega pelo webhook sem passar por `registrarSaida`, e não tem
 *   autor nenhum. Em 16/set eram 496 das 568 saídas da produção, então tratar
 *   isso como raro deixaria a maioria das linhas sem rótulo.
 */
function quemFalou(lead: Lead): string | null {
  if (lead.ultimaDirecao !== "saida") return null;
  if (lead.ultimoAutorTipo === "automacao") return "automação";
  const nome = (lead.ultimoAutorNome ?? "").trim();
  if (nome) return nome.split(/\s+/)[0]!;
  return "atendimento";
}

/**
 * A prévia da conversa: quem falou, numa cor, e o que disse, noutra.
 *
 * A cor separada existe para o olho pular o nome quando ele não interessa. Com
 * tudo na mesma cor, "Gabriel: Beleza" lê-se como uma frase só, e o nome
 * compete com o texto pela atenção em toda linha da fila.
 */
function ResumoDaConversa({ lead }: { lead: Lead }) {
  const quem = quemFalou(lead);
  return (
    <>
      {quem && <span className="font-semibold text-primary/80">{quem}: </span>}
      {textoDaConversa(lead)}
    </>
  );
}

/** O texto da última mensagem, sem quem falou. */
function textoDaConversa(lead: Lead): string {
  if (lead.ultimoTexto) return lead.ultimoTexto;
  if (!lead.ultimaEm) return "sem mensagem";

  // O tipo quando ele existe, a frase genérica quando não. Ver
  // `core/tipo-da-mensagem.ts` sobre por que "mídia ou mensagem sem texto"
  // sozinho era pior do que nada.
  return nomeDoTipo(lead.ultimoTipo) ?? "mensagem sem texto";
}

/* -------------------------------------------------------------------------- */
/* A busca enquanto se digita                                                 */
/* -------------------------------------------------------------------------- */

/** Sem acento e em minúsculas: quem digita "fabricio" tem que achar "Fabrício". */
const achatar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * O recorte por texto, feito no navegador.
 *
 * **O telefone usa `chavesDoTelefone`, a mesma função do servidor.** Ela mora
 * em `core/`, sem banco e sem rede, justamente para os dois lados poderem
 * chamá-la: quem digita "(11) 98765-4321" precisa achar `5511987654321`, e
 * resolver isso com comparação de texto erraria em todo número com nono dígito.
 *
 * O que sobra é comparação de nome e da última mensagem, que é o que se procura
 * quando não se está procurando um número.
 */
function procurar(leads: Lead[], termo: string): Lead[] {
  const alvo = achatar(termo.trim());
  if (alvo === "") return leads;

  const so = termo.replace(/\D/g, "");
  const chaves = so === "" ? [] : chavesDoTelefone(termo);

  return leads.filter((lead) => {
    if (achatar(lead.nome ?? "").includes(alvo)) return true;
    if (achatar(lead.ultimoTexto ?? "").includes(alvo)) return true;
    // `includes` e não igualdade: digitar só o DDD e o começo do número já
    // recorta, que é como se busca telefone de cabeça.
    if (so !== "" && lead.waId.includes(so)) return true;
    return chaves.some((chave) => lead.waId === chave);
  });
}

/* -------------------------------------------------------------------------- */
/* Ordem da lista                                                             */
/* -------------------------------------------------------------------------- */

type Ordem = "recentes" | "antigas" | "espera";

/**
 * As três ordens, e o que cada uma responde.
 *
 * `espera` é a que justifica o menu existir: as outras duas são a mesma
 * pergunta invertida, e "quem está esperando há mais tempo" é uma pergunta
 * diferente, é a fila pela ordem em que ela deveria ser atendida, e não pela
 * ordem em que as mensagens chegaram.
 */
const ORDENS = [
  {
    chave: "recentes",
    curto: "Mais recentes",
    rotulo: "Mais recentes",
    descricao: "A última mensagem no topo",
  },
  {
    chave: "antigas",
    curto: "Mais antigas",
    rotulo: "Mais antigas",
    descricao: "A conversa parada há mais tempo no topo",
  },
  {
    chave: "espera",
    curto: "Esperando há mais tempo",
    rotulo: "Esperando há mais tempo",
    descricao: "Quem pediu gente primeiro vem primeiro; o resto segue por data",
  },
] as const;

/**
 * Copia antes de ordenar. A lista vem do recorte dos rails, e `sort` no lugar
 * mutaria um array que o React considera imutável, o sintoma é a lista
 * trocando de ordem sozinha ao voltar de outra aba. (`toSorted` faria isso
 * numa linha, mas o `lib` deste projeto ainda é anterior ao ES2023.)
 */
function ordenar(leads: Lead[], ordem: Ordem): Lead[] {
  const data = (lead: Lead) => (lead.ultimaEm ? Date.parse(lead.ultimaEm) : 0);

  if (ordem === "antigas") return [...leads].sort((a, b) => data(a) - data(b));

  if (ordem === "espera") {
    return [...leads].sort((a, b) => {
      // Quem tem handoff aberto sobe, e entre eles ganha quem espera há mais
      // tempo. `desde` é a hora em que o bot desistiu, que é quando a espera
      // dessa pessoa realmente começou.
      const esperaA = a.aguardando ? Date.parse(a.aguardando.desde) : null;
      const esperaB = b.aguardando ? Date.parse(b.aguardando.desde) : null;
      if (esperaA !== null && esperaB !== null) return esperaA - esperaB;
      if (esperaA !== null) return -1;
      if (esperaB !== null) return 1;
      return data(b) - data(a);
    });
  }

  return [...leads].sort((a, b) => data(b) - data(a));
}

/* -------------------------------------------------------------------------- */
/* O bloco fixado                                                             */
/* -------------------------------------------------------------------------- */

/**
 * As fixadas no topo, na ordem em que foram fixadas; o resto como estava.
 *
 * **Roda depois de todo o resto**, e é por isso que ela recebe a lista já
 * ordenada em vez de virar mais um caso dentro de `ordenar`. O alfinete não é
 * uma quarta ordem: ele vale junto com qualquer uma delas. Quem escolheu
 * "esperando há mais tempo" continua vendo essa ordem embaixo do bloco fixado,
 * que é o que fixar quer dizer.
 *
 * A mais recente fixada vem primeiro, como no WhatsApp. É a única ordem que não
 * se mexe sozinha: por última mensagem, o bloco do topo se reembaralharia a
 * cada resposta, e a conversa que a pessoa grudou ali para não perder de vista
 * mudaria de lugar exatamente quando algo acontece nela.
 */
function comFixadasNoTopo(
  leads: Lead[],
  fixadaEm: (contatoId: string) => string | null,
): Lead[] {
  const fixadas: Lead[] = [];
  const resto: Lead[] = [];

  for (const lead of leads) {
    if (fixadaEm(lead.contatoId) !== null) fixadas.push(lead);
    else resto.push(lead);
  }

  if (fixadas.length === 0) return leads;

  fixadas.sort(
    (a, b) =>
      Date.parse(fixadaEm(b.contatoId) ?? "") - Date.parse(fixadaEm(a.contatoId) ?? ""),
  );

  return [...fixadas, ...resto];
}

/* -------------------------------------------------------------------------- */
/* Os botões que aparecem na linha                                            */
/* -------------------------------------------------------------------------- */

/**
 * Um dos gestos do canto da linha: alfinete ou envelope.
 *
 * `stopPropagation` e `preventDefault` porque o botão está **sobre** o `Link`
 * que ocupa a linha inteira. Sem os dois, o clique escapava para a navegação e
 * fixar a conversa abria a conversa junto, o que é o contrário de fixar, que
 * existe justamente para não precisar abrir agora.
 */
function BotaoDaLinha({
  rotulo,
  dica,
  desabilitado,
  aceso = false,
  aoClicar,
  children,
}: {
  /** O que o leitor de tela anuncia: verbo e nome, porque a linha não tem contexto. */
  rotulo: string;
  /** O que o mouse mostra. Curto, e é onde a recusa do teto é explicada. */
  dica: string;
  desabilitado: boolean;
  aceso?: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={dica}
      disabled={desabilitado}
      onClick={(evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        aoClicar();
      }}
      className={`flex size-6 items-center justify-center rounded-md transition disabled:opacity-30 pointer-coarse:size-8 ${
        aceso
          ? "text-primary hover:bg-primary/15"
          : "text-dim hover:bg-surface-strong hover:text-soft"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Ícones                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * O alfinete. Deitado quando a conversa está presa, em pé quando é o convite
 * para prender, a mesma gramática do WhatsApp, e a inclinação é a única pista
 * de estado que se lê sem parar para ler.
 */
/**
 * O robô com a boca riscada: ele está ali e não fala.
 *
 * Um ícone de "pausa" diria que alguém apertou um botão e vai despausar. O
 * ponto deste estado é o contrário: ninguém vai, a menos que perceba. Por
 * isso o traço cortando, que é como se marca canal mudo em qualquer tela.
 */
function BotMudo() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="4" y="8" width="16" height="11" rx="2.5" />
      <path d="M12 8V5" />
      <circle cx="9" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <path d="M3 21 21 3" />
    </svg>
  );
}

function Alfinete({ preso = false }: { preso?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={preso ? "rotate-45" : ""}
    >
      <path d="M12 17v5" />
      <path d="M9 10.5V4h6v6.5l2.5 3.5h-11L9 10.5Z" />
    </svg>
  );
}

/** O envelope fechado: "volta a ser algo por abrir". */
function Envelope() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

/** Dentro do campo de busca, e por isso `pointer-events-none`: clicar na lupa
    tem que focar o campo, não parar no ícone. */
function Lupa() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

/** A estrela vazada da barra do topo: leva às guardadas, não guarda nada. */
function Estrela() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17l-5.25 2.75 1-5.85L3.5 9.75l5.9-.85L12 3.6Z" />
    </svg>
  )
}

function Engrenagem() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.35.4.65.73.85.3.18.64.27 1 .26H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
