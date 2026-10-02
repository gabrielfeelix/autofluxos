import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { notFound } from "next/navigation";
import { AjustesShell } from "@/components/design/ajustes-shell";
import {
  ModalFormulario,
  RotuloCampo,
} from "@/components/design/modal-formulario";
import { CartaoDaPagina } from "@/components/anuncios/cartao-da-pagina";
import { PaginasParaLigar } from "@/components/anuncios/paginas-para-ligar";
import { LogoMeta } from "@/components/design/logos-de-marca";
import { acaoConectarComFacebook, acaoLigarAds } from "@/server/acoes-lead-ads";
import { acharCliente } from "@/server/repos/clientes";
import { listarConexoes } from "@/server/repos/conexoes";
import { paginasDaConta } from "@/server/repos/paginas-de-lead";
import {
  NOME_DA_CONEXAO_DE_ADS,
  tokenDeAnuncios,
} from "@/server/token-de-anuncios";
import { listarPaginasDoToken } from "@/channels/marketing-api";
import { ultimaChegadaDeAnuncio } from "@/server/repos/ultimos-eventos";
import { CamadasDaConexao } from "@/components/conexoes/camadas";
import { estadoDaConexao } from "@/core/conexoes";
import { IlustracaoAnuncios } from "@/components/design/ilustracoes";

export const dynamic = "force-dynamic";

/**
 * Anúncios, onde o cliente liga a conta da Meta.
 *
 * ---------------------------------------------------------------------------
 * Por que esta tela existe, e por que separada de Credenciais
 * ---------------------------------------------------------------------------
 *
 * A credencial do Ads **é** uma Conexão comum, guardada no mesmo cofre. Mas
 * pedir que o cliente vá em "Credenciais → Nova" e digite o nome exato
 * `meta-ads`, tipo `bearer`, é instrução de quem conhece o código, erra uma
 * letra e nada funciona, sem nenhum aviso. Aqui ele aperta um botão que já sabe
 * o nome.
 *
 * A outra razão é que **conectar o Ads não é uma coisa, são duas**: o token diz
 * *quem pode ler*, e a Página diz *de onde vêm os leads*. As duas podem estar
 * certas, erradas, ou uma sem a outra, e nesse último caso nada chega, com
 * tudo parecendo configurado. Uma tela que mostra as duas lado a lado é o que
 * transforma "não está chegando lead" numa resposta em vez de uma caça.
 */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const [{ clienteId }, busca] = await Promise.all([params, searchParams]);
  const cliente = await acharCliente(clienteId);
  if (!cliente) notFound();

  const [conexoes, paginas, ultimaChegada] = await Promise.all([
    listarConexoes(clienteId),
    paginasDaConta(clienteId),
    ultimaChegadaDeAnuncio(clienteId),
  ]);

  const temToken = conexoes.some(
    (c) =>
      c.nome.trim().toLowerCase() === NOME_DA_CONEXAO_DE_ADS &&
      c.tipo === "bearer",
  );
  // As Páginas que o token enxerga, menos as já ligadas: a pessoa escolhe numa
  // lista em vez de procurar o id. `null` quando a Meta não respondeu.
  const token = temToken ? await tokenDeAnuncios(clienteId) : null;
  const doToken = token ? await listarPaginasDoToken(token) : null;
  const paraLigar = (doToken ?? []).filter(
    (p) => !paginas.some((l) => l.pageId === p.id),
  );
  const estado = estadoDaConexao({
    tipo: "anuncios",
    paginas: paginas.length,
    temToken,
    // A inscrição da página no webhook não é gravada hoje: desconhecida.
    webhookInscrito: null,
    ultimoEvento: ultimaChegada,
  });

  return (
    <AjustesShell cliente={cliente} ativa="anuncios">
      <Miolo largura="larga">
        {busca.ok === "1" && (
          <p className="mb-4 rounded-[10px] border border-primary/30 bg-primary/[0.08] px-4 py-3 text-[12px] text-soft">
            Conta de anúncios ligada. Agora ligue a página de onde vêm os leads,
            abaixo.
          </p>
        )}
        {busca.erro && (
          <p className="mb-4 rounded-[10px] border border-line bg-surface px-4 py-3 text-[12px] text-soft">
            {busca.erro === "cancelado"
              ? "A conexão foi cancelada na tela da Meta. Nada mudou."
              : "Não deu para ligar a conta de anúncios. Tente de novo."}
          </p>
        )}

        <div className="mb-[30px]">
          <CabecalhoDaTela
          trilha={[
              {
                rotulo: "Configurações",
                href: `/clientes/${cliente.id}/ajustes`,
              },
              { rotulo: "Anúncios" },
            ]}
          titulo={<>Anúncios</>}
          descricao={<>Quem preenche o formulário de um anúncio no Facebook ou no Instagram
            entra aqui como lead, com o telefone e a campanha de onde veio, sem
            planilha e sem intermediário no meio.</>}
        />
        </div>

        <div className="mb-4">
          <CamadasDaConexao
            clienteId={cliente.id}
            estado={estado}
            rotuloDoEvento="Último contato vindo de anúncio"
          />
        </div>

        {/*
          O token vem primeiro porque sem ele a Página não adianta: a Meta avisa
          que houve lead, e é o token que busca o dado. Ligar a Página antes
          seria dizer de onde vêm leads que ninguém consegue ler.
        */}
        <div className="app-card mb-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <LogoMeta />
            <div className="min-w-0 flex-1 basis-[calc(100%-56px)] sm:basis-auto">
              <p className="text-[13.5px] font-bold">Conta da Meta</p>
              <p className="mt-0.5 text-[11.5px] leading-4 text-dim">
                {temToken ? (
                  doToken === null ? (
                    "Ligada, mas a Meta não respondeu agora. Se continuar, troque o token."
                  ) : (
                    <>
                      Ligada. Enxerga{" "}
                      <strong className="text-soft">
                        {doToken.length === 1
                          ? "1 Página"
                          : `${doToken.length} Páginas`}
                      </strong>
                      {doToken.length > 0 &&
                        `: ${doToken.map((p) => p.nome).join(", ")}`}
                      .
                    </>
                  )
                ) : (
                  "Conecte a conta da Meta para os leads dos formulários entrarem aqui, com a campanha de onde vieram."
                )}
              </p>
            </div>

            {/*
              O botão da Meta vem primeiro, e o de colar token vira segunda via.

              É o caminho que o cliente consegue seguir sozinho, e o único que
              mostra o diálogo de autorização, que é o que a Meta exige ver no
              vídeo do App Review. Colar token continua existindo para quem quer
              um acesso que nunca vence (usuário do sistema).
            */}
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <form action={acaoConectarComFacebook.bind(null, clienteId)}>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-primary-strong"
                >
                  {temToken
                    ? "Reconectar com Facebook"
                    : "Conectar com Facebook"}
                </button>
              </form>

              <ModalFormulario
                botao={temToken ? "Trocar o token" : "Colar um token"}
                variante="secundario"
                titulo="Ligar a conta de anúncios da Meta"
                descricao="O token fica guardado num cofre e não volta para esta tela. Antes de guardar, o token é validado com a Meta; token recusado não é salvo."
                rotuloEnviar="Conferir e guardar"
                action={acaoLigarAds.bind(null, clienteId)}
              >
                {/*
                O passo a passo mora aqui, e não num link.

                Quem abre este modal está com o Business Manager aberto na outra
                aba, no meio da tarefa. Mandar ler documentação em outro lugar é
                onde a pessoa desiste, e o caminho tem cinco cliques em telas
                que ela não visita nunca.
              */}
                <div className="rounded-[10px] border border-line bg-panel px-3.5 py-3">
                  <p className="text-[11px] font-bold text-soft">
                    Onde gerar este token
                  </p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] leading-[17px] text-dim">
                    <li>
                      No Gerenciador de Negócios, abra{" "}
                      <strong className="text-soft">Usuários do sistema</strong>{" "}
                      e escolha um (ou crie).
                    </li>
                    <li>
                      Em <strong className="text-soft">Adicionar ativos</strong>
                      , dê a ele a Página e a conta de anúncios deste cliente.
                    </li>
                    <li>
                      Clique em{" "}
                      <strong className="text-soft">Gerar token</strong>,
                      escolha o app AutoFluxos e marque as permissões de leads e
                      de anúncios.
                    </li>
                    <li>Copie e cole abaixo, ele aparece uma vez só.</li>
                  </ol>
                  <p className="mt-2 text-[10.5px] leading-4 text-dim">
                    Use{" "}
                    <strong className="text-soft">usuário do sistema</strong>,
                    não seu login pessoal: o token pessoal vence a cada 60 dias
                    e para de trazer lead sem avisar.
                  </p>
                </div>

                <label className="block">
                  <RotuloCampo>Token</RotuloCampo>
                  <input
                    name="token"
                    type="password"
                    required
                    autoComplete="off"
                    className="app-field px-3 py-2.5 font-mono text-[13px]"
                  />
                </label>
              </ModalFormulario>
            </div>
          </div>
        </div>

        {paraLigar.length > 0 && (
          <>
            <div className="mb-3 mt-7">
              <h2 className="text-[15px] font-bold">Páginas para ligar</h2>
              <p className="mt-1 max-w-[560px] text-[12px] leading-5 text-dim">
                Os leads dos formulários da Página passam a entrar nesta conta.
              </p>
            </div>
            <PaginasParaLigar clienteId={clienteId} paginas={paraLigar} />
          </>
        )}

        <div className="mb-3 mt-7">
          <h2 className="text-[15px] font-bold">Páginas ligadas</h2>
          <p className="mt-1 max-w-[560px] text-[12px] leading-5 text-dim">
            Os leads dos formulários destas Páginas entram aqui, com o telefone
            e a campanha de onde vieram.
          </p>
        </div>

        {paginas.length === 0 ? (
          <div className="app-card px-5 py-12 text-center">
            <IlustracaoAnuncios />
            <p className="mt-6 text-[13px] font-bold">
              Nenhuma Página ligada ainda
            </p>
            <p className="mx-auto mt-1.5 max-w-[420px] text-[11.5px] leading-5 text-dim">
              {temToken
                ? "Ligue uma das Páginas acima. Enquanto isso, os leads de formulário não entram; o WhatsApp segue normal."
                : "Ligue a conta da Meta acima e as Páginas dela aparecem aqui para escolher."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {paginas.map((pagina) => (
              <CartaoDaPagina
                key={pagina.pageId}
                clienteId={clienteId}
                pageId={pagina.pageId}
                nome={pagina.nome}
                temToken={temToken}
                foto={
                  doToken?.find((p) => p.id === pagina.pageId)?.foto ?? null
                }
              />
            ))}
          </div>
        )}
      </Miolo>
    </AjustesShell>
  );
}
