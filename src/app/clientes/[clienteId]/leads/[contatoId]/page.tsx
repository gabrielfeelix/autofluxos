import { meuAlcance } from '@/server/permissoes'
import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { ProvedorDaConversa } from '@/components/inbox/conversa-local'
import { Suspense } from 'react'
import { comoFalta, podeReagir, restaDaJanela } from '@/channels/janela'
import { Dica } from '@/components/design/dica'
import { CartaoDoAtendimento, SeloDoAtendimento } from '@/components/atendimento/estado'
import { estadoDoAtendimento } from '@/core/estado-do-atendimento'
import { clienteTemAutomacao } from '@/server/repos/fluxos'
import { CaixaDeResposta } from '@/components/lead/responder'
import { RodapeDaMensagem } from '@/components/lead/rodape-da-mensagem'
import { favoritasEntre } from '@/server/repos/marcadores'
import { sessaoAtual } from '@/server/sessao'
import { assinaturaDasReacoes } from '@/core/reacoes'
import { ProvedorDeCitacao } from '@/components/lead/citacao'
import {
  acaoApagarContato,
  acaoCorrigirNome,
  acaoAlternarAutomacaoDoLead,
  acaoEncerrarAtendimento,
  acaoResponderLead,
} from '@/server/acoes'
import { acaoAnotar, acaoAnotarNoDiario } from '@/server/acoes-crm'
import { acharCliente } from '@/server/repos/clientes'
import { contextoDeResposta, sessaoComPessoa } from '@/server/repos/conversas'
import { acharLead, lerConversa, LIMITE_DA_NOTA } from '@/server/repos/leads'
import { listarRespostasRapidas } from '@/server/repos/respostas-rapidas'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { quadrosDoContato } from '@/server/repos/quadros'
import { estagioDoContato, resumoDoContato } from '@/server/repos/crm'
import { acompanhamentosDoContato } from '@/server/repos/sequencias'
import { faixasDaConta } from '@/server/repos/relacionamento'
import { FAIXAS_PADRAO, relacionamentoDe } from '@/core/relacionamento'
import { linhaDoTempo } from '@/server/repos/eventos'
import { atividadesDoContato } from '@/server/repos/atividades'
import { Acompanhamentos } from '@/components/lead-crm/acompanhamentos'
import { Atividades } from '@/components/lead-crm/atividades'
import { membrosDaConta } from '@/server/repos/usuarios'
import { listarMotivos } from '@/server/repos/motivos-de-perda'
import { agendadasDoContato } from '@/server/repos/mensagens-agendadas'
import { passagensDoContato } from '@/server/repos/passagens'
import { resolverAnuncios } from '@/server/resolver-anuncios'
import { tokenDeAnuncios } from '@/server/token-de-anuncios'
import type { AnuncioEmCache, Passagem } from '@/core/anuncios'
import { origemDoContato } from '@/core/contatos/origem'
import { Avatar } from '@/components/inbox/avatar'
import { Abas, IrParaAba } from '@/components/lead-crm/abas'
import { abaDaFicha, voltaDaFicha } from '@/core/volta-da-ficha'
import { CabecalhoDoTipo } from '@/components/lead-crm/tipo-do-passo'
import { prazoEmPalavras, proximaAcao } from '@/core/atividades'
import { EstagioDoContato } from '@/components/lead-crm/estagio-do-contato'
import { Historico as HistoricoDoContato } from '@/components/lead-crm/historico'
import { Negociacoes } from '@/components/lead-crm/negociacoes'
import { ResponsavelDoContato } from '@/components/lead-crm/responsavel-do-contato'
import { ResumoDoContato } from '@/components/lead-crm/resumo-do-contato'
import { AcoesDaFicha } from '@/components/lead-crm/acoes-da-ficha'
import { Agendadas } from '@/components/lead-crm/agendadas'
import { Diario } from '@/components/lead-crm/diario'
import { Informacoes } from '@/components/lead-crm/informacoes'
import { Jornada } from '@/components/lead-crm/jornada'
import { DadosColetados } from '@/components/lead-crm/dados-coletados'
import { ProximosPassos } from '@/components/lead-crm/proximos-passos'
import { ApagarContato } from '@/components/lead-crm/apagar-contato'
import { AjudaDoCampo } from '@/components/design/ajuda-do-campo'
import {
  IconeDaSecao,
  IconeWhatsApp,
  iconeAlvo,
  iconeEtiqueta,
  iconeLapis,
  iconeLinhaDoTempo,
} from '@/components/lead-crm/icones'
import { SeletorDeEtiquetas } from '@/components/etiquetas/seletor'
import {
  AnexoNaConversa,
  ArquivoSemCopia,
  MensagemNaoSuportada,
  CartoesNaBolha,
  CitacaoNaBolha,
  LocalNaBolha,
  SemTexto,
} from '@/components/lead/anexo'
import { NomeDoContato } from '@/components/lead/identidade'
import { CartaoDeAnotacoes } from '@/components/inbox/anotacoes'
import { anotacoesDoContato } from '@/server/repos/eventos'
import { etiquetasDeDia, horaComFuso, horaDoRelogio, horaExata, quando } from '@/lib/quando'
import { MenuNaConversa } from '@/components/inbox/historico'
import { TextoDoWhatsApp } from '@/components/texto-do-whatsapp'

export const dynamic = 'force-dynamic'

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string; contatoId: string }>
  searchParams: Promise<{ aba?: string | string[]; volta?: string | string[] }>
}) {
  const { clienteId, contatoId } = await params
  // De onde a pessoa veio e em que aba ela quer cair (8.5). `volta` é conferido
  // em `voltaDaFicha`: só endereço desta conta vira link.
  const pedido = await searchParams
  const abaInicial = abaDaFicha(pedido.aba)
  const volta = voltaDaFicha(pedido.volta, clienteId)
  const [
    cliente,
    lead,
    respostasRapidas,
    etiquetas,
    noQuadro,
    /*
     * O CRM da ficha (0058), tudo na mesma leva.
     *
     * São cinco consultas curtas e independentes, e nenhuma delas vale uma
     * espera própria: a tela só existe inteira. Equipe e motivos vêm com a
     * página pelo mesmo motivo do quadro, são listas que mudam uma vez por
     * mês, e buscá-las ao abrir cada menu seria uma ida ao banco por clique.
     */
    estagio,
    resumo,
    eventos,
    equipe,
    motivos,
    agendadas,
    faixas,
    temAutomacao,
    atividades,
    acompanhamentos,
    anotacoes,
    sessaoDaFicha,
    comPessoa,
  ] = await Promise.all([
    acharCliente(clienteId),
    // Contato de outra pessoa, fora do alcance, cai no `notFound` abaixo.
    meuAlcance(clienteId).then((alcance) => acharLead(clienteId, contatoId, alcance)),
    listarRespostasRapidas(clienteId),
    listarEtiquetas(clienteId),
    quadrosDoContato(clienteId, contatoId),
    estagioDoContato(clienteId, contatoId),
    resumoDoContato(clienteId, contatoId),
    linhaDoTempo(clienteId, contatoId),
    membrosDaConta(clienteId),
    listarMotivos(clienteId),
    agendadasDoContato(clienteId, contatoId),
    faixasDaConta(clienteId),
    /*
     * Sem fluxo ligado a papel nem gatilho ativo, **não existe bot**, e o
     * cartão abaixo dizia "Bot respondendo este contato" assim mesmo, com um
     * botão para pausar o que não existe. Ver `clienteTemAutomacao`.
     */
    clienteTemAutomacao(clienteId),
    // A agenda humana (0081). Entra na mesma leva pelo motivo das outras: a
    // tela só existe inteira, e uma consulta curta não vale uma espera própria.
    atividadesDoContato(clienteId, contatoId),
    // Os acompanhamentos automáticos (UI-23/UI-24). Na mesma leva pelo mesmo
    // motivo: a ficha só existe inteira.
    acompanhamentosDoContato(clienteId, contatoId),
    anotacoesDoContato(clienteId, contatoId),
    sessaoAtual(),
    sessaoComPessoa(contatoId),
  ])
  if (!cliente || !lead) notFound()

  // O mesmo estado do Inbox (8.1), pela mesma função.
  const atendimento = estadoDoAtendimento({
    automacaoAtiva: lead.automacaoAtiva,
    aguardando: lead.aguardando,
    atribuidoA: lead.atribuidoA,
    sessaoComPessoa: comPessoa,
    estado: lead.estadoEfetivo,
    temAutomacao,
    usuarioId: sessaoDaFicha?.usuario.id ?? null,
  })
  const donoNome = equipe.find((membro) => membro.id === lead.atribuidoA)?.nome ?? null

  const agoraDaFicha = agoraDoServidor()

  /*
   * O resumo do topo (8.3): a próxima atividade e a próxima mensagem, as duas
   * contas feitas aqui para as abas não precisarem ser abertas para responder
   * "o que vem agora com esta pessoa".
   */
  const proxima = proximaAcao(atividades)
  const prazoDaProxima = proxima ? prazoEmPalavras(proxima, agoraDaFicha) : null
  const proximaMensagem =
    agendadas
      .filter((a) => a.estado === 'agendada' || a.estado === 'enviando')
      .sort((a, b) => a.quando.localeCompare(b.quando))[0] ?? null
  const mensagemFalhou = agendadas.some((a) => a.estado === 'falhou')
  const abertas = atividades.filter((a) => a.situacao === 'aberta').length
  const aSair = agendadas.filter((a) => a.estado === 'agendada' || a.estado === 'enviando').length
  const sequenciasAtivas = acompanhamentos.filter((a) => a.estado === 'ativa').length
  const pendentesDaAba = abertas + aSair + sequenciasAtivas

  const campos = Object.entries(lead.campos)
  const nome = lead.nome ?? 'sem nome'
  /* De onde a pessoa veio, quando isso foi medido. Quem não tem origem não
     ganha linha, escrever "Direto" seria afirmar o que ninguém mediu. */
  const origem = origemDoContato(lead.campos)

  // O primeiro nome basta na caixa de resposta: "Responder Maria Aparecida da
  // Silva pelo WhatsApp…" não cabe e não ajuda.
  const primeiroNome = lead.nome?.split(' ')[0] ?? 'esta pessoa'

  // Quanto ainda dá para responder em texto livre. `null` fecha a caixa, e a
  // conta é feita aqui, no servidor, porque o relógio do navegador de quem abre
  // a tela não é fonte de verdade para uma regra da Meta.
  /*
   * A jornada por anúncio, e só dela: as passagens são baratas, mas resolver o
   * nome de cada anúncio fala com a Meta. Sem token, a lista volta igual com o
   * título que a pessoa leu no dia, ver `jornadaDoContato`.
   */
  const jornada = await jornadaDoContato(clienteId, contatoId)

  const contexto = await contextoDeResposta(clienteId, contatoId)
  const restante = restaDaJanela(contexto ?? { ultimaEntradaEm: null })
  const janela = restante && restante > 0 ? comoFalta(restante) : null
  /** Menos de duas horas, a contagem muda de cor. Mesma régua do Inbox. */
  const apertado = restante !== null && restante > 0 && restante < 2 * 60 * 60 * 1000

  return (
    <ClienteShell cliente={cliente} ativa="leads">
      {/*
        O mesmo store do Inbox (`inbox/conversa-local.ts`): finalizar, pausar o
        bot ou marcar etiqueta aqui muda o cartão, o selo e as etiquetas no
        clique, sem a ficha voltar do servidor.
      */}
      <ProvedorDaConversa
        contatoId={contatoId}
        doServidor={{
          estado: lead.estadoEfetivo,
          automacaoAtiva: lead.automacaoAtiva,
          atribuidoA: lead.atribuidoA,
          sessaoComPessoa: comPessoa,
          aguardando: lead.aguardando,
          etiquetas: lead.etiquetasManuais.map((etiqueta) => etiqueta.id),
        }}
        usuarioId={sessaoDaFicha?.usuario.id ?? null}
        temAutomacao={temAutomacao}
        equipe={equipe.map((membro) => ({ id: membro.id, nome: membro.nome }))}
      >
      <main className="w-full max-w-[1440px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Link
          href={volta.href}
          className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-primary"
        >
          ← {volta.rotulo}
        </Link>

        <header className="mb-[18px] flex flex-wrap items-center gap-3.5">
          <Avatar nome={lead.nome} tamanho={52} />
          <div className="min-w-0">
            <NomeDoContato
              nome={lead.nome}
              nomeDoPerfil={lead.nomeDoPerfil}
              nomeReal={lead.nomeReal}
              waId={lead.waId}
              salvar={acaoCorrigirNome.bind(null, clienteId, contatoId)}
            />
            {/* Canal e origem embaixo do nome. **O telefone não entra aqui**:
                `NomeDoContato` já o imprime, e o mesmo número duas vezes em
                duas linhas seguidas é ruído que parece defeito. */}
            <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-dim">
              {/* O logo do canal, não só a palavra: é o que identifica de onde
                  a conversa vem antes de ler. Verde, porque é a marca. */}
              <IconeWhatsApp className="size-[13px] text-[#25D366]" />
              WhatsApp
              {origem &&
                (origem.deAnuncio && origem.titulo
                  ? ` · veio do anúncio “${origem.titulo}”`
                  : origem.rotulo.toLowerCase() === 'direto'
                    ? ' · veio direto'
                    : ` · veio de ${origem.rotulo.toLowerCase()}`)}
            </p>
          </div>
          <span className="flex-1" />
          {/* As ações sobre o contato, no alto e à direita, o lugar em que a
              ficha do Brevo e a do RD as põem, e pelo mesmo motivo: é onde o
              olho chega depois de ler quem é a pessoa. */}
          <AcoesDaFicha
            clienteId={clienteId}
            contatoId={contatoId}
            nome={nome}
            fimDaJanela={contexto?.ultimaEntradaEm ?? null}
            agendadas={agendadas}
          />
          {/* O pedido de exclusão da LGPD vira este botão. A pergunta diz o que
              some junto porque não existe desfazer: a conversa não está copiada
              em lugar nenhum. Mesma forma dos três vizinhos: ícone em cima,
              palavra embaixo, o vermelho aparece no hover. */}
          <ApagarContato
            acao={acaoApagarContato.bind(null, clienteId, contatoId)}
            titulo="Apaga a pessoa, a conversa inteira e o que o fluxo coletou. Não dá para desfazer."
            pergunta={`Somem ${nome}, a conversa inteira, o que o fluxo coletou e o histórico de atendimento. Não dá para desfazer.`}
          />
        </header>

        {/*
          **A faixa de contexto: em que pé está, com quem, e quem responde.**
          Os três controles estavam soltos no cabeçalho, sem rótulo, disputando
          a linha com o nome e com os botões: dois dropdowns cinzas e um selo em
          caps lock que ninguém sabia dizer se era estado do bot ou do negócio.
          Rotulados e agrupados, cada um diz o que é antes de dizer o valor.
        */}
        <section className="mb-[18px] grid grid-cols-1 gap-x-5 gap-y-3.5 rounded-[13px] border border-line bg-panel px-[18px] py-4 sm:grid-cols-3">
          <div className="crm-field">
            <span>Estágio do contato</span>
            <EstagioDoContato
              expandido
              clienteId={clienteId}
              contatoId={contatoId}
              estagio={estagio?.estagio ?? 'novo'}
            />
          </div>
          <div className="crm-field">
            <span>Responsável</span>
            <ResponsavelDoContato
              expandido
              clienteId={clienteId}
              contatoId={contatoId}
              equipe={equipe.map(({ id, nome: comoSeChama }) => ({ id, nome: comoSeChama }))}
              responsavelId={lead.atribuidoA}
            />
          </div>
          <div className="crm-field">
            <span>Atendimento</span>
            {/*
              Altura igual à dos dois dropdowns ao lado para as três colunas
              assentarem na mesma linha de base. O selo diz quem está com a
              conversa agora; o que fazer a respeito continua nas faixas
              abaixo, que é onde mora o botão.
            */}
            <span className="flex h-[38px] items-center">
              <SeloDoAtendimento atendimento={atendimento} donoNome={donoNome} />
            </span>
          </div>
          {/*
            A segunda linha do resumo (8.3): o que já passou e o que vem. Fica
            acima das abas para responder em qualquer uma delas; cada valor leva
            à aba onde ele mora.
          */}
          <div className="crm-field">
            <span>Última mensagem da pessoa</span>
            <span className="text-[12.5px] text-ink">
              {lead.ultimaEntradaEm ? (
                <span title={horaExata(lead.ultimaEntradaEm)}>
                  {quando(lead.ultimaEntradaEm, agoraDaFicha)}
                </span>
              ) : (
                <span className="text-dim">nunca escreveu</span>
              )}
            </span>
          </div>
          <div className="crm-field">
            <span>Próxima atividade</span>
            {proxima && prazoDaProxima ? (
              <IrParaAba aba="atividades" className="truncate text-left text-[12.5px] text-ink hover:text-primary">
                <strong className={prazoDaProxima.atrasada ? 'text-perigo' : 'text-soft'}>
                  {prazoDaProxima.texto}
                </strong>
                {' · '}
                {proxima.titulo}
              </IrParaAba>
            ) : (
              <span className="text-[12.5px] text-dim">nenhuma aberta</span>
            )}
          </div>
          <div className="crm-field">
            <span>Mensagem agendada</span>
            {mensagemFalhou ? (
              <IrParaAba aba="atividades" className="text-left text-[12.5px] font-semibold text-perigo">
                uma mensagem não saiu
              </IrParaAba>
            ) : proximaMensagem ? (
              <IrParaAba aba="atividades" className="text-left text-[12.5px] text-ink hover:text-primary">
                sai em {horaComFuso(proximaMensagem.quando)}
              </IrParaAba>
            ) : (
              <span className="text-[12.5px] text-dim">nenhuma</span>
            )}
          </div>
        </section>

        {/*
          Um cartão só para o estado do atendimento (8.1), o mesmo da coluna do
          Inbox. Eram duas faixas: uma para quem pediu pessoa, com "Atendimento
          finalizado", e outra com o interruptor do bot, que dizia "Bot
          respondendo" mesmo com a sessão nas mãos de alguém.
        */}
        <div className="mb-[18px]">
          <CartaoDoAtendimento
            largo
            atendimento={atendimento}
            donoNome={donoNome}
            aguardando={lead.aguardando}
            automacaoAtiva={lead.automacaoAtiva}
            finalizar={acaoEncerrarAtendimento.bind(null, clienteId, contatoId)}
            alternarBot={acaoAlternarAutomacaoDoLead.bind(null, clienteId, contatoId)}
          />
        </div>

        {/*
          **A ficha é um documento, não um chat com notas na margem.** Ela era um
          grid de `280px` + conversa: os fatos da pessoa espremidos numa coluna
          onde todo valor virava reticências, e o chat ocupando o resto de uma
          tela cujo trabalho é responder "quem é esta pessoa e em que pé está".
          Para conduzir a conversa existe o Inbox, que é a tela feita para isso.
          Aqui as abas dividem o assunto e a conversa é a última, disponível sem
          ser imposta.
        */}
        <Abas
          inicial={abaInicial}
          extra={
            /*
              A contagem da janela de 24h fica aqui, e não no rodapé da caixa
              de resposta. Mesma decisão do Inbox, pelo mesmo motivo: ela é
              estado da conversa e não consequência de responder, e as duas
              telas precisam dizer a mesma coisa no mesmo lugar, senão quem
              usa as duas aprende dois produtos.
            */
            janela ? (
              <Dica alinhar="direita" texto="Depois disso o WhatsApp só aceita modelo aprovado pela Meta">
                <span
                  className={`mb-1.5 flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    apertado ? 'bg-amber-400/15 text-aviso' : 'bg-surface text-muted'
                  }`}
                >
                  <span aria-hidden>🕐</span>
                  {janela}
                </span>
              </Dica>
            ) : null
          }
          abas={[
            {
              chave: 'visao',
              rotulo: 'Visão geral',
              conteudo: (
                /*
                  Duas colunas: o que está em jogo à esquerda, o que apoia a
                  decisão à direita. `items-start` impede que um cartão curto de
                  apoio estique até a altura da coluna principal, que foi o que
                  deixou a coluna de 280px cheia de caixas ocas.
                */
                <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <div className="flex flex-col gap-[18px]">
                    <Negociacoes
                      clienteId={clienteId}
                      nome={nome}
                      negociacoes={noQuadro.map((posicao) => ({
                        cartaoId: posicao.cartaoId,
                        quadro: posicao.quadro,
                        etapa: posicao.etapa,
                        entrouEm: posicao.entrouEm,
                        titulo: posicao.titulo,
                        valor: posicao.valor,
                        situacao: posicao.situacao,
                      }))}
                      motivos={motivos.map(({ id, nome: comoSeChama }) => ({ id, nome: comoSeChama }))}
                    />
                    <Informacoes
                      waId={lead.waId}
                      campos={lead.campos}
                      criadoEm={lead.criadoEm}
                      ultimaEntradaEm={lead.ultimaEntradaEm}
                      estagioDesde={estagio?.desde ?? null}
                      estado={lead.estadoEfetivo}
                      adiadaAte={lead.adiadaAte}
                      adiadaNota={lead.adiadaNota}
                    />
                  </div>

                  <div className="flex flex-col gap-[18px]">
                    <ProximosPassos
                      atividades={atividades}
                      agendadas={agendadas}
                      agora={agoraDaFicha}
                    />
                    {/*
                      Montado aqui, e não com uma consulta a mais: `resumo` já
                      trouxe total, compras e última compra, e
                      `lead.ultimaEntradaEm` já trouxe a última vez que a pessoa
                      falou. Os quatro fatos que o relacionamento pede já
                      estavam na tela: faltava alguém lê-los juntos.
                    */}
                    <ResumoDoContato
                      resumo={resumo}
                      relacionamento={relacionamentoDe(
                        {
                          total: resumo.total,
                          compras: resumo.compras,
                          ultimaCompraEm: resumo.ultimaEm,
                          ultimaConversaEm: lead.ultimaEntradaEm,
                        },
                        faixas ?? FAIXAS_PADRAO,
                      )}
                    />
                    <div id="anotacao">
                      <CartaoDeAnotacoes
                        iniciais={anotacoes}
                        antiga={lead.notas}
                        autor={sessaoDaFicha?.usuario.nome ?? null}
                        anotar={acaoAnotar.bind(null, clienteId, contatoId)}
                        limite={LIMITE_DA_NOTA}
                        titulo={
                          <h2 className="flex items-center gap-2 text-[13px] font-bold">
                            <IconeDaSecao>{iconeLapis}</IconeDaSecao>
                            Anotações da equipe
                          </h2>
                        }
                      />
                    </div>
                    <section id="etiquetas" className="app-card overflow-hidden">
                      <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
                        <IconeDaSecao tom="aviso">{iconeEtiqueta}</IconeDaSecao>
                        Etiquetas
                        <AjudaDoCampo
                          titulo="Etiquetas"
                          secao="blocos"
                          texto="Marcas que a equipe põe à mão para agrupar pessoas."
                          detalhes={
                            <p>
                              Etiqueta é o que a pessoa <strong>é</strong>: “quer pilates”, “já é
                              aluno”. A equipe põe à mão, e o fluxo também etiqueta sozinho pelo
                              bloco de Etiqueta, as duas aparecem juntas aqui, sem distinção.
                            </p>
                          }
                        />
                      </h2>
                      <div className="px-[18px] py-4">
                        <SeletorDeEtiquetas
                          clienteId={clienteId}
                          contatoId={contatoId}
                          disponiveis={etiquetas}
                          aplicadas={lead.etiquetasManuais.map((etiqueta) => etiqueta.id)}
                        />
                      </div>
                    </section>
                  </div>
                </div>
              ),
            },
            {
              chave: 'atividades',
              rotulo: 'Atividades',
              contagem: pendentesDaAba,
              contagemRotulo: [
                `${abertas} ${abertas === 1 ? 'atividade aberta' : 'atividades abertas'}`,
                `${aSair} ${aSair === 1 ? 'mensagem a sair' : 'mensagens a sair'}`,
                `${sequenciasAtivas} ${sequenciasAtivas === 1 ? 'sequência em andamento' : 'sequências em andamento'}`,
              ].join(', '),
              conteudo: (
                /*
                 * Três tipos, três cartões, cada um dizendo quem faz (8.3):
                 * a atividade é de uma pessoa, a mensagem sai sozinha na hora
                 * marcada, o acompanhamento é de uma sequência. A contagem da
                 * aba soma o que está pendente nos três e a dica diz quanto
                 * de cada.
                 */
                <div className="flex flex-col gap-[18px]">
                  <section className="app-card overflow-hidden">
                    <CabecalhoDoTipo
                      titulo="Atividades da equipe"
                      quemFaz="uma pessoa da equipe"
                      contagem={abertas}
                      descricao="Lembretes do que alguém precisa fazer: ligar, mandar proposta, visitar."
                    />
                    <div className="px-5 py-4">
                      <Atividades
                        clienteId={clienteId}
                        contatoId={contatoId}
                        atividadesIniciais={atividades}
                        agora={agoraDaFicha}
                      />
                    </div>
                  </section>
                  <Agendadas agendadas={agendadas} contatoId={contatoId} />
                  <Acompanhamentos acompanhamentos={acompanhamentos} />
                </div>
              ),
            },
            {
              chave: 'historico',
              rotulo: 'Histórico',
              contagem: eventos.length,
              conteudo: (
                /*
                  A linha do tempo é registro e o diário é escrita da equipe.
                  Ficam lado a lado no desktop e empilhados no mobile, com o
                  diário primeiro na ordem do DOM para que quem vem do atalho
                  "Anotar" caia no campo, e não no fim de uma lista longa.
                */
                <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div id="diario">
                    <Diario
                      eventos={eventos}
                      limite={LIMITE_DA_NOTA}
                      anotar={acaoAnotarNoDiario.bind(null, clienteId, contatoId)}
                    />
                  </div>
                  <section className="app-card overflow-hidden">
                    <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
                      <IconeDaSecao>{iconeLinhaDoTempo}</IconeDaSecao>
                      Linha do tempo
                      <AjudaDoCampo
                        titulo="Histórico"
                        secao="duvidas"
                        texto="Tudo o que aconteceu com esta pessoa, em ordem."
                        detalhes={
                          <p>
                            Mudanças de estágio, de responsável, de etiqueta e as anotações, na
                            ordem em que aconteceram. É <strong>registro</strong>, não campo
                            editável: serve para responder “por que esta pessoa está aqui?” sem
                            depender da memória de quem atendeu.
                          </p>
                        }
                      />
                    </h2>
                    <div className="p-[18px]">
                      <HistoricoDoContato eventos={eventos} />
                    </div>
                  </section>
                </div>
              ),
            },
            {
              chave: 'dados',
              rotulo: 'Dados e origem',
              conteudo: (
                <div className="flex flex-col gap-[18px]">
                  <DadosColetados campos={campos} />
                  <section className="app-card overflow-hidden">
                    <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
                      <IconeDaSecao>{iconeAlvo}</IconeDaSecao>
                      Jornada de anúncios
                      <AjudaDoCampo
                        titulo="Jornada"
                        secao="duvidas"
                        texto="Por quais anúncios esta pessoa passou antes de falar com a gente."
                        detalhes={
                          <p>
                            Vazio significa que ela chegou <strong>direto</strong>, sem anúncio,
                            e não que a informação se perdeu. É o que separa o lead que custou
                            dinheiro do que veio de graça.
                          </p>
                        }
                      />
                    </h2>
                    <div className="p-[18px]">
                      <Jornada
                        passagens={jornada.passagens}
                        nomesDosAnuncios={jornada.nomesDosAnuncios}
                      />
                    </div>
                  </section>
                </div>
              ),
            },
            {
              chave: 'conversa',
              rotulo: 'Conversa',
              solta: true,
              conteudo: (
                <ProvedorDeCitacao>
                  {/*
                    `overflow-x-hidden`, e não `overflow-auto` nos dois eixos:
                    a mesma lição que o Inbox já tinha aprendido e escrito (ver
                    o comentário equivalente em `inbox/page.tsx`). Uma URL de
                    anúncio com 180 caracteres e nenhum espaço não tem onde
                    quebrar, estica a bolha além da coluna e o contêiner ganha
                    rolagem horizontal: arrastar de lado desloca a conversa
                    inteira para fora da moldura. A quebra é resolvida na bolha;
                    isto aqui garante que nenhum outro conteúdo largo traga o
                    defeito de volta.
                  */}
                  <div className="app-conversa min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-[18px]">
                    <Suspense fallback={<HistoricoEsqueleto />}>
                      <Historico
                        contatoId={contatoId}
                        nomeDoLead={lead.nome}
                        clienteId={clienteId}
                      />
                    </Suspense>
                  </div>
                  <CaixaDeResposta
                    acao={acaoResponderLead.bind(null, clienteId, contatoId)}
                    restaDaJanela={janela}
                    nome={primeiroNome}
                    respostasRapidas={respostasRapidas}
                    temAutomacao={temAutomacao}
                    conversa={{ clienteId, contatoId }}
                  />
                </ProvedorDeCitacao>
              ),
            },
          ]}
        />
      </main>
      </ProvedorDaConversa>
    </ClienteShell>
  )
}

/**
 * O relógio, lido **uma vez por render do servidor**.
 *
 * Fica fora do componente porque o compilador do React trata `Date.now()` em
 * render como impureza, e tem razão. O valor é passado adiante como número,
 * exatamente para o cliente **não** ler o relógio dele: "vencida" calculada no
 * navegador divergiria do HTML que o servidor mandou. Mesma decisão de
 * `quadros/page.tsx`.
 */
function agoraDoServidor(): number {
  return Date.now()
}

function HistoricoEsqueleto() {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      <div className="h-9 w-[46%] self-end rounded-[13px_13px_4px_13px] bg-primary/[0.07]" />
      <div className="h-9 w-[34%] rounded-[13px_13px_13px_4px] bg-surface" />
      <div className="h-9 w-[52%] self-end rounded-[13px_13px_4px_13px] bg-primary/[0.07]" />
      <span className="sr-only">Carregando a conversa…</span>
    </div>
  )
}

async function Historico({
  contatoId,
  nomeDoLead,
  clienteId,
}: {
  contatoId: string
  nomeDoLead: string | null
  clienteId: string
}) {
  const conversa = await lerConversa(contatoId)

  /*
   * Quais destas bolhas **eu** guardei. Mesma leitura do Inbox, e é ela que faz
   * a estrela ser a mesma nos dois lugares: guardar na ficha e ver cheia no
   * Inbox é o mínimo que se espera de uma marcação que é da pessoa.
   */
  const sessao = await sessaoAtual()
  const favoritas = await favoritasEntre(
    sessao?.usuario.id ?? null,
    conversa.mensagens.map((mensagem) => mensagem.id),
  )

  if (conversa.mensagens.length === 0) {
    return <p className="py-10 text-center text-xs text-dim">Nenhuma mensagem registrada.</p>
  }

  /* Onde cada dia começa, mesma regra do Inbox, ver `lib/quando.ts`. */
  const diasDaConversa = etiquetasDeDia(conversa.mensagens, (m) => m.ts)

  return (
    <div className="flex flex-col gap-2.5">
      {conversa.cortada && (
        <p className="self-center rounded-xl border border-dashed border-strong px-3.5 py-2 text-center font-mono text-[10px] text-muted">
          conversa longa, mostrando só as mensagens mais recentes
        </p>
      )}
      {conversa.mensagens.map((mensagem, indice) => {
        const nossa = mensagem.direcao === 'saida'
        const etiqueta = diasDaConversa[indice]
        return (
          /* O `Fragment` deixa a etiqueta de dia ser irmã da bolha, ver o Inbox. */
          <Fragment key={mensagem.id}>
            {etiqueta && <EtiquetaDoDia rotulo={etiqueta} />}
            {/* A coluna é o que dá lugar à reação embaixo da bolha, ver o Inbox. */}
            <div className={`flex flex-col gap-0 ${nossa ? 'items-end' : 'items-start'}`}>
            {/* Mesma fonte e mesmo corpo do Inbox, ver o comentário de lá. */}
            <p className={`max-w-[78%] px-3 py-2 font-texto text-[14.5px] leading-[1.45] whitespace-pre-wrap ${nossa ? 'rounded-[13px_13px_4px_13px] border border-primary/[0.22] bg-primary/[0.13]' : mensagem.toque ? 'bolha-toque rounded-[13px_13px_13px_4px]' : 'rounded-[13px_13px_13px_4px] border border-line bg-surface'}`}>
              {mensagem.cita && <CitacaoNaBolha cita={mensagem.cita} nome={nomeDoLead} />}
              {mensagem.anexo && <AnexoNaConversa anexo={mensagem.anexo} />}
              {/*
                O arquivo que a pessoa mandou. Mesma bolha do que sai, e a
                diferença está em quem produziu a URL: aqui ela é assinada e
                morre em cinco minutos.
              */}
              {mensagem.recebido && <AnexoNaConversa anexo={mensagem.recebido} />}
              {mensagem.semCopia && <ArquivoSemCopia />}
              {mensagem.naoSuportada && <MensagemNaoSuportada motivo={mensagem.motivoNaoSuportada} />}
              {mensagem.local && <LocalNaBolha local={mensagem.local} />}
              {mensagem.cartoes && <CartoesNaBolha cartoes={mensagem.cartoes} />}
              {/*
                Lugar e cartão **substituem** o "(áudio, imagem ou documento)".
                Eles são a mensagem inteira, e quase nunca vêm com legenda,
                deixar a frase genérica embaixo diria que falta algo que não
                falta.
              */}
              {mensagem.texto !== null ? (
                <TextoDoWhatsApp texto={mensagem.texto} />
              ) : (
                !mensagem.local &&
                !mensagem.cartoes &&
                !mensagem.semCopia &&
                !mensagem.naoSuportada && <SemTexto />
              )}
              {/*
                Mesma regra do Inbox: a hora sempre, o autor só na saída e só
                quando ele é sabido. "bot" estava fixo aqui e mentia toda vez
                que quem respondeu foi gente, ver `core/autor-da-mensagem.ts`.
              */}
              <span className="ml-2 text-[9.5px] text-muted" title={horaExata(mensagem.ts)}>
                {nossa && mensagem.autor ? `${mensagem.autor} · ` : ''}
                {horaDoRelogio(mensagem.ts)}
              </span>
              {nossa && !mensagem.entregue && (
                <span className="ml-2 text-[9.5px] text-aviso">envio não confirmado</span>
              )}
            </p>
            {/* Os botões que o bot mandou e o que a pessoa tocou, ver o Inbox. */}
            {mensagem.menu && (
              <MenuNaConversa menu={mensagem.menu} respondido={indice < conversa.mensagens.length - 1} />
            )}
            {/* Em toda bolha, e não só nas com id da Meta: a estrela guarda pelo
                id interno, que a saída ainda não confirmada também tem. */}
            {(
              /* A `key` devolve a palavra final ao servidor, ver o Inbox. */
              <RodapeDaMensagem
                key={assinaturaDasReacoes(mensagem.reacoes)}
                clienteId={clienteId}
                contatoId={contatoId}
                waMessageId={mensagem.waMessageId ?? null}
                podeReagir={podeReagir(mensagem.ts)}
                reacoes={mensagem.reacoes ?? []}
                nome={nomeDoLead}
                texto={mensagem.texto}
                deQuem={nossa ? 'ao atendimento' : `a ${nomeDoLead ?? 'cliente'}`}
                nossa={nossa}
                mensagemId={mensagem.id}
                favorita={favoritas.has(mensagem.id)}
              />
            )}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

/** A etiqueta de dia. Gêmea da do Inbox, a bolha vive duplicada nas duas telas. */
function EtiquetaDoDia({ rotulo }: { rotulo: string }) {
  return (
    <p className="my-1 self-center rounded-full border border-line bg-surface px-3 py-1 text-center text-[10px] font-medium text-dim">
      {rotulo}
    </p>
  )
}

/**
 * Por onde a pessoa passou antes de escrever.
 *
 * Gêmeo do que o Inbox faz, e duplicado de propósito: importar de dentro da
 * página do Inbox amarraria duas telas que o handoff pede para manter
 * separadas. As duas chamam os mesmos dois repositórios.
 *
 * **Sem o Ads conectado a lista volta igual**, com o título que a pessoa leu no
 * dia. Resolver o nome atual do anúncio é um luxo; o histórico não é.
 */
async function jornadaDoContato(
  clienteId: string,
  contatoId: string,
): Promise<{ passagens: Passagem[]; nomesDosAnuncios: Map<string, AnuncioEmCache> }> {
  const passagens = await passagensDoContato(contatoId)
  if (passagens.length === 0) return { passagens: [], nomesDosAnuncios: new Map() }

  const token = await tokenDeAnuncios(clienteId)
  if (!token) return { passagens, nomesDosAnuncios: new Map() }

  const nomesDosAnuncios = await resolverAnuncios({
    clienteId,
    adIds: passagens.map((passagem) => passagem.adId),
    token,
  })

  return { passagens, nomesDosAnuncios }
}
