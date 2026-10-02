'use client'

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { EntradaDeAnotacao, ListaDeAnotacoes, ProvedorDeAnotacoes } from '@/components/inbox/anotacoes'
import { Assumir, PassarPara, TravaDaResposta } from '@/components/inbox/assumir'
import { ProvedorDaConversa } from '@/components/inbox/conversa-local'
import { RodapeDeEspiar } from '@/components/inbox/espiar'
import { AcoesRapidas } from '@/components/inbox/acoes-rapidas'
import { Avatar } from '@/components/inbox/avatar'
import { ColunaDaFicha, SoSemFicha } from '@/components/inbox/moldura'
import { AbasDaFicha } from '@/components/inbox/abas-da-ficha'
import { FunilDaConversa } from '@/components/inbox/funil-da-conversa'
import { Historico } from '@/components/inbox/historico'
import { encerrarAberta, semearAberta, useAberta, type Previa } from '@/components/inbox/aberta-local'
import { EtiquetasAplicadas, type EtiquetaEscolhivel } from '@/components/etiquetas/seletor'
import { CartaoDoAtendimento, SeloDoAtendimento } from '@/components/atendimento/estado'
import { Dica } from '@/components/design/dica'
import { Esqueleto } from '@/components/design/esqueleto'
import { CamposColetados } from '@/components/lead/campos-coletados'
import { QuemE } from '@/components/lead/quem-e'
import { CaixaDeResposta } from '@/components/lead/responder'
import { ProvedorDeCitacao } from '@/components/lead/citacao'
import { ProvedorDeEntrega } from '@/components/lead/entrega-de-arquivos'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import { camposSemOrigem } from '@/core/contatos/origem'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { hrefDaFicha } from '@/core/volta-da-ficha'
import { acaoAnotar } from '@/server/acoes-crm'
import {
  acaoAssumirAtendimento,
  acaoAtribuirPara,
  acaoAlternarAutomacaoDoLead,
  acaoEncerrarAtendimento,
  acaoLiberarAtendimento,
  acaoResponderLead,
} from '@/server/acoes'
import type { ConversaAberta } from '@/server/conversa-aberta'
import type { RespostaRapida } from '@/server/repos/respostas-rapidas'
import type { MembroDaConta } from '@/server/repos/usuarios'

type DaConta = {
  clienteId: string
  equipe: MembroDaConta[]
  usuarioId: string | null
  etiquetas: EtiquetaEscolhivel[]
  temAutomacao: boolean
  respostasRapidas: RespostaRapida[]
  /** O nome de quem está sendo espiado, ou `null` fora do modo espiar. */
  espiado: string | null
}

/**
 * A coluna do meio e a ficha: a conversa que está aberta.
 *
 * A página manda a primeira (`inicial`); as próximas vêm de `aberta-local.ts`,
 * sem navegar. Quem decide qual está aberta é a loja do navegador, semeada
 * pela página: quando o servidor troca de conversa (link de notificação, outra
 * tela), ela acompanha; quando só redesenha a mesma, a escolha da pessoa vale.
 */
export function PainelDaConversa({
  inicial,
  ...conta
}: DaConta & { inicial: ConversaAberta | null }) {
  const loja = useAberta()
  const idInicial = inicial?.lead.contatoId ?? null
  const ultimoIdInicial = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // A primeira semeadura de cada montagem vale como troca: a página é a
    // fonte de qual conversa abrir até a pessoa clicar em outra.
    const trocou = ultimoIdInicial.current !== idInicial
    ultimoIdInicial.current = idInicial
    semearAberta(conta.clienteId, inicial, trocou)
  }, [conta.clienteId, inicial, idInicial])

  useEffect(() => encerrarAberta, [])

  // Antes de a loja ser semeada (o primeiro quadro, e o HTML do servidor), quem
  // manda são as props: sem isto a coluna nasceria vazia e piscaria.
  const id = loja.iniciada ? loja.id : idInicial
  const dados = loja.iniciada
    ? maisNova(loja.dados, inicial?.lead.contatoId === loja.id ? inicial : null)
    : inicial

  if (!id) {
    return (
      <section className="flex min-w-0 items-center justify-center p-10 text-center">
        <p className="max-w-[280px] text-[13px] leading-6 text-dim">
          Nenhuma conversa nesta seleção.
          <br />
          Limpe a busca ou escolha outro filtro à esquerda.
        </p>
      </section>
    )
  }

  if (!dados) {
    return <ConversaChegando previa={loja.previa} falhou={loja.falhou} />
  }

  /*
   * A `key` é a conversa, num `Fragment`: nada da conversa antiga (rascunho,
   * rolagem, citação, anexo, remendos) vaza para a nova.
   */
  return (
    <Fragment key={dados.lead.contatoId}>
      <ColunaDaConversa dados={dados} {...conta} />
    </Fragment>
  )
}

function maisNova(a: ConversaAberta | null, b: ConversaAberta | null): ConversaAberta | null {
  if (!a) return b
  if (!b) return a
  return b.lidaEm > a.lidaEm ? b : a
}

/**
 * O clique numa conversa que ainda não veio: o cabeçalho com o que a linha já
 * sabe, e o resto com a forma do que vai chegar.
 *
 * **É uma conversa desenhada, e não três barras.** Balões alternando de lado,
 * com linhas dentro e o horário no canto, a pílula do dia, a caixa de resposta
 * no pé e a ficha ao lado: quando a conversa chega, cada coisa cai no lugar
 * que já estava reservado, e o olho não precisa reler a tela. Sobre o mesmo
 * fundo da conversa (`app-conversa`), senão a espera era um retângulo branco.
 *
 * Segurar a conversa anterior na tela, como antes, deixava a caixa de resposta
 * de outra pessoa aberta enquanto a nova chegava.
 */
const BALOES_DE_ESPERA: { nosso: boolean; linhas: string[] }[] = [
  { nosso: false, linhas: ['w-[220px]'] },
  { nosso: false, linhas: ['w-[300px]', 'w-[180px]'] },
  { nosso: true, linhas: ['w-[260px]'] },
  { nosso: true, linhas: ['w-[320px]', 'w-[240px]', 'w-[150px]'] },
  { nosso: false, linhas: ['w-[160px]'] },
  { nosso: true, linhas: ['w-[210px]'] },
  { nosso: false, linhas: ['w-[280px]', 'w-[120px]'] },
]

function ConversaChegando({ previa, falhou }: { previa: Previa | null; falhou: boolean }) {
  return (
    <>
      <section className="flex min-h-0 min-w-0 flex-col border-r border-line" aria-busy={!falhou}>
        <span role="status" className="sr-only">
          {falhou ? 'Não deu para abrir esta conversa.' : 'Abrindo a conversa…'}
        </span>
        <header className="flex min-h-[62px] items-center gap-3 border-b border-line px-4 py-2">
          {previa ? (
            <Avatar nome={previa.lead.nome} alerta={Boolean(previa.lead.aguardando)} tamanho={40} canal={previa.canal} />
          ) : (
            <Esqueleto className="size-10 rounded-full" />
          )}
          <div className="min-w-[140px] flex-1">
            {previa ? (
              <h2 className="truncate text-[13.5px] font-bold">{previa.lead.nome ?? 'sem nome'}</h2>
            ) : (
              <Esqueleto className="h-3.5 w-[150px]" />
            )}
            <Esqueleto className="mt-1.5 h-[18px] w-[190px] rounded-full" />
          </div>
          <Esqueleto className="hidden h-8 w-[72px] rounded-[10px] sm:block" />
          <span className="hidden gap-1.5 sm:flex">
            {[0, 1, 2, 3].map((i) => (
              <Esqueleto key={i} className="size-8 rounded-lg" />
            ))}
          </span>
        </header>

        <div className="app-conversa flex min-h-0 flex-1 flex-col justify-end overflow-hidden p-5">
          {falhou ? (
            <p className="m-auto rounded-[12px] border border-line bg-panel px-4 py-3 text-[13px] text-dim">
              Não deu para abrir esta conversa. Clique nela de novo.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Esqueleto className="mx-auto mb-2 h-[22px] w-[52px] rounded-full" />
              {BALOES_DE_ESPERA.map((balao, i) => (
                <div
                  key={i}
                  className={`flex max-w-[78%] flex-col gap-1.5 px-3.5 py-2.5 ${
                    balao.nosso
                      ? 'self-end rounded-[15px_15px_4px_15px] bg-primary/[0.12]'
                      : 'bolha-deles self-start rounded-[15px_15px_15px_4px]'
                  }`}
                >
                  {balao.linhas.map((largura, j) => (
                    <Esqueleto key={j} className={`h-2.5 max-w-full ${largura}`} />
                  ))}
                  <Esqueleto className="h-2 w-7 self-end opacity-70" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* A caixa de resposta no pé, com o campo e os botões no lugar deles. */}
        <div className="flex items-center gap-2 border-t border-line px-[18px] py-3">
          <Esqueleto className="size-8 shrink-0 rounded-lg" />
          <Esqueleto className="size-8 shrink-0 rounded-lg" />
          <Esqueleto className="h-10 min-w-0 flex-1 rounded-[12px]" />
          <Esqueleto className="size-10 shrink-0 rounded-full" />
        </div>
      </section>

      <ColunaDaFicha>
        <aside aria-hidden className="min-w-0 overflow-hidden border-l border-line bg-panel">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            {previa ? (
              <Avatar nome={previa.lead.nome} tamanho={40} canal={previa.canal} />
            ) : (
              <Esqueleto className="size-10 rounded-full" />
            )}
            <div className="min-w-0 flex-1">
              {previa ? (
                <p className="truncate text-[14.5px] leading-5 font-semibold">{previa.lead.nome ?? 'sem nome'}</p>
              ) : (
                <Esqueleto className="h-3.5 w-[120px]" />
              )}
              <Esqueleto className="mt-1.5 h-2.5 w-[110px]" />
            </div>
            <Esqueleto className="h-7 w-[52px] rounded-[10px]" />
          </div>
          <div className="flex gap-6 border-b border-line px-4 py-3">
            <Esqueleto className="h-3 w-[54px]" />
            <Esqueleto className="h-3 w-[70px]" />
          </div>
          <div className="flex flex-col gap-5 p-4">
            <Esqueleto className="h-[58px] w-full rounded-[12px]" />
            <div className="flex flex-col gap-2.5 rounded-[12px] border border-line p-3">
              {['w-[70%]', 'w-[55%]', 'w-[62%]'].map((largura, i) => (
                <Esqueleto key={i} className={`h-2.5 ${largura}`} />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Esqueleto className="h-3 w-[110px]" />
              <span className="flex gap-1.5">
                <Esqueleto className="h-6 w-[64px] rounded-full" />
                <Esqueleto className="h-6 w-[82px] rounded-full" />
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <Esqueleto className="h-3 w-[130px]" />
              <Esqueleto className="h-2.5 w-[85%]" />
            </div>
          </div>
        </aside>
      </ColunaDaFicha>
    </>
  )
}

function ColunaDaConversa({
  dados,
  clienteId,
  equipe,
  usuarioId,
  etiquetas,
  temAutomacao,
  respostasRapidas,
  espiado,
}: DaConta & { dados: ConversaAberta }) {
  const { lead, canal } = dados
  const favoritas = useMemo(() => new Set(dados.favoritas), [dados.favoritas])
  const primeiroNome = lead.nome?.split(' ')[0] ?? 'esta pessoa'

  return (
    <ProvedorDeAnotacoes
      iniciais={dados.anotacoes}
      antiga={lead.notas}
      autor={equipe.find((membro) => membro.id === usuarioId)?.nome ?? null}
      anotar={acaoAnotar.bind(null, clienteId, lead.contatoId)}
    >
      <ProvedorDaConversa
        contatoId={lead.contatoId}
        doServidor={{
          estado: lead.estadoEfetivo,
          automacaoAtiva: lead.automacaoAtiva,
          atribuidoA: lead.atribuidoA,
          sessaoComPessoa: dados.comPessoa,
          aguardando: lead.aguardando,
          etiquetas: lead.etiquetasManuais.map((etiqueta) => etiqueta.id),
        }}
        usuarioId={usuarioId}
        temAutomacao={temAutomacao}
        equipe={equipe.map((membro) => ({ id: membro.id, nome: membro.nome }))}
      >
        <section className="flex min-h-0 min-w-0 flex-col border-r border-line">
          <CabecalhoDaConversa
            clienteId={clienteId}
            dados={dados}
            equipe={equipe}
            usuarioId={usuarioId}
            etiquetas={etiquetas}
            temAutomacao={temAutomacao}
            espiando={espiado !== null}
          />
          {/*
            O provedor envolve a conversa **e** a caixa porque a citação nasce
            numa e é usada na outra. A `key` do `Fragment` de cima faz trocar de
            conversa esquecer a citação e o anexo escolhido para outra pessoa.
          */}
          <ProvedorDeCitacao>
            <ProvedorDeEntrega clienteId={clienteId} contatoId={lead.contatoId}>
              {/*
                `flex-col-reverse` faz a conversa abrir na mensagem mais
                recente, por CSS e sem o pulo de um `scrollTo`. O `Historico`
                fica em ordem normal: filho único, a inversão só decide de que
                ponta o scroll nasce.

                `overflow-x-hidden`: uma URL de 180 caracteres sem espaço
                esticava a bolha para fora da coluna. A quebra é resolvida na
                bolha; isto garante que nenhum outro conteúdo largo volte a
                deslocar a conversa de lado.
              */}
              <div className="app-conversa flex min-h-0 flex-1 flex-col-reverse overflow-x-hidden overflow-y-auto p-5">
                <Historico
                  mensagens={dados.mensagens}
                  cortada={dados.cortada}
                  nome={lead.nome}
                  clienteId={clienteId}
                  contatoId={lead.contatoId}
                  favoritas={favoritas}
                />
              </div>
              {espiado !== null ? (
                <RodapeDeEspiar nome={espiado} />
              ) : (
                <TravaDaResposta exigeAssumir={dados.exigeAssumir}>
                  <CaixaDeResposta
                    canal={canal}
                    acao={acaoResponderLead.bind(null, clienteId, lead.contatoId)}
                    restaDaJanela={dados.janela}
                    nome={primeiroNome}
                    respostasRapidas={respostasRapidas}
                    temAutomacao={temAutomacao}
                    anexo={{ clienteId, contatoId: lead.contatoId }}
                    temPedidos={dados.temPedidos}
                  />
                </TravaDaResposta>
              )}
            </ProvedorDeEntrega>
          </ProvedorDeCitacao>
        </section>
        <ColunaDaFicha>
          <DadosDoLead
            clienteId={clienteId}
            dados={dados}
            donoNome={equipe.find((membro) => membro.id === lead.atribuidoA)?.nome ?? null}
            etiquetas={etiquetas}
          />
        </ColunaDaFicha>
      </ProvedorDaConversa>
    </ProvedorDeAnotacoes>
  )
}

function CabecalhoDaConversa({
  clienteId,
  dados,
  equipe,
  usuarioId,
  etiquetas,
  temAutomacao,
  espiando,
}: {
  clienteId: string
  dados: ConversaAberta
  /** No modo espiar o cabeçalho só informa: assumir, passar e as ações somem. */
  espiando: boolean
  equipe: MembroDaConta[]
  usuarioId: string | null
  etiquetas: EtiquetaEscolhivel[]
  temAutomacao: boolean
}) {
  const { lead, canal, atendimento, janela, janelaApertada, fimDaJanela, agendadas } = dados
  const nome = lead.nome ?? 'sem nome'
  const responsavel = equipe.find((membro) => membro.id === lead.atribuidoA) ?? null

  return (
    /*
      Quebra linha quando falta largura. Sem isso, em 1440 px com a coluna do
      contato aberta, o nome encolhia a nada e os ícones da direita passavam
      por baixo da coluna do contato, sem dar para clicar (visto na 5.9).
    */
    <header className="flex min-h-[62px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2">
      <Avatar nome={lead.nome} alerta={Boolean(lead.aguardando)} tamanho={40} canal={canal} />
      <div className="min-w-[140px] flex-1">
        <h2 className="truncate text-[13.5px] font-bold">
          {nome}
          {/* O número mora no topo da coluna do contato; aqui só com ela fechada. */}
          {canal === 'whatsapp' && (
            <SoSemFicha>
              <span className="ml-2 font-mono text-[11.5px] font-normal text-dim">
                {telefoneLegivel(lead.waId)}
              </span>
            </SoSemFicha>
          )}
        </h2>
        {/*
          De quem é a conversa fica **embaixo do nome**: é estado, não ação.
          Estado e dono juntos, pela mesma função da coluna ao lado e da ficha
          (8.1).
        */}
        <p className="mt-0.5 flex items-center gap-2 truncate text-[12px] text-dim">
          <SeloDoAtendimento
            atendimento={atendimento}
            donoNome={responsavel?.nome ?? (lead.atribuidoA ? 'alguém fora da equipe' : null)}
          />
          {/*
            A janela de 24h mora aqui e não no rodapé da caixa: ela limita
            anexar, reagir e agendar, e quem abre a conversa precisa dela antes
            de decidir o que fazer.
          */}
          {janela && canal !== 'site' && (
            <Dica texto="Depois disso o WhatsApp só aceita modelo aprovado pela Meta">
              <span
                className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  janelaApertada ? 'bg-amber-400/15 text-aviso' : 'bg-surface text-muted'
                }`}
              >
                <span aria-hidden>🕐</span>
                {janela}
              </span>
            </Dica>
          )}
        </p>
      </div>

      {/*
        Assumir e passar continuam sendo botão de texto: mudam **de quem é** a
        conversa, a única decisão desta tela que afeta o trabalho de outra
        pessoa. Só aparecem quando há para quem passar.
      */}
      {!espiando && equipe.length > 1 && (
        <PassarPara atribuir={acaoAtribuirPara.bind(null, clienteId, lead.contatoId)} equipe={equipe} />
      )}

      {!espiando && (usuarioId || responsavel) && (
        <Assumir
          assumir={acaoAssumirAtendimento.bind(null, clienteId, lead.contatoId)}
          liberar={acaoLiberarAtendimento.bind(null, clienteId, lead.contatoId)}
          responsavel={responsavel?.nome ?? null}
          souEu={Boolean(usuarioId) && lead.atribuidoA === usuarioId}
        />
      )}

      {!espiando && (
        <AcoesRapidas
          clienteId={clienteId}
          contatoId={lead.contatoId}
          etiquetas={etiquetas}
          temAutomacao={temAutomacao}
          fimDaJanela={fimDaJanela}
          agendadas={agendadas}
          nomeDoContato={lead.nome?.split(' ')[0] ?? 'esta pessoa'}
        />
      )}
    </header>
  )
}

/**
 * A coluna da direita: quem é a pessoa, e tudo que o sistema sabe dela.
 *
 * **Ela é de leitura, e isso é a decisão.** Cada editor guarda estado local
 * semeado pelo servidor, e a mesma etiqueta editável em dois lugares da tela
 * são duas cópias que divergem no primeiro clique. Um editor por informação,
 * nas ações rápidas do cabeçalho; esta coluna mostra o resultado.
 *
 * A ordem é a de quem abre uma conversa: estado do atendimento, quem é a
 * pessoa, e só então o que foi acumulado sobre ela.
 */
function DadosDoLead({
  clienteId,
  dados,
  donoNome,
  etiquetas,
}: {
  clienteId: string
  dados: ConversaAberta
  /** As da conta, para dar nome às aplicadas (inclusive as que se marcam agora). */
  etiquetas: EtiquetaEscolhivel[]
  donoNome: string | null
}) {
  const { lead, canal, atendimento, funis, passagens } = dados
  const nomesDosAnuncios = useMemo(() => new Map(dados.nomesDosAnuncios), [dados.nomesDosAnuncios])
  // Sem as chaves de origem: elas já aparecem em destaque no `QuemE`.
  const campos = camposSemOrigem(Object.entries(lead.campos))

  return (
    // Rola por dentro, como as outras duas colunas.
    <aside className="min-w-0 overflow-y-auto border-l border-line bg-panel">
      {/*
        O topo em uma linha: foto à esquerda, nome em cima e número embaixo. A
        coluna rola, e depois de duas telas de campos nada nela dizia mais de
        quem era aquela ficha.
      */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <Avatar nome={lead.nome} tamanho={40} canal={canal} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14.5px] leading-5 font-semibold">{lead.nome ?? 'sem nome'}</h2>
          <p className="truncate font-mono text-[12px] text-dim">
            {canal === 'whatsapp' ? telefoneLegivel(lead.waId) : canal === 'site' ? 'Chat do site' : 'Instagram'}
          </p>
        </div>
        <Link
          href={hrefDaFicha(clienteId, lead.contatoId, {
            volta: `/clientes/${clienteId}/inbox?conversa=${lead.contatoId}`,
          })}
          title="Abrir a ficha completa"
          className="botao-secundario botao-sm shrink-0"
        >
          Ficha
        </Link>
      </div>

      <AbasDaFicha
        anotacoes={
          <>
            <div className="mb-3">
              <EntradaDeAnotacao limite={LIMITE_DA_NOTA} />
            </div>
            <ListaDeAnotacoes vazio="Ninguém anotou nada sobre esta pessoa ainda." />
          </>
        }
        contato={
          <>
            {/* Sem automação a tag é a resposta inteira: não há bot a ligar. */}
            <CartaoDoAtendimento
              atendimento={atendimento}
              donoNome={donoNome}
              aguardando={lead.aguardando}
              automacaoAtiva={lead.automacaoAtiva}
              finalizar={acaoEncerrarAtendimento.bind(null, clienteId, lead.contatoId)}
              alternarBot={acaoAlternarAutomacaoDoLead.bind(null, clienteId, lead.contatoId)}
            />

            {/* Quem é a pessoa vem antes de tudo que se faz com ela. */}
            <QuemE
              waId={lead.waId}
              criadoEm={lead.criadoEm}
              ultimaEntradaEm={lead.ultimaEntradaEm}
              campos={lead.campos}
              passagens={passagens}
              nomesDosAnuncios={nomesDosAnuncios}
            />

            <Secao titulo="Etiquetas do contato" vazio="Nenhuma etiqueta aplicada.">
              <EtiquetasAplicadas
                contatoId={lead.contatoId}
                aplicadas={lead.etiquetasManuais.map((etiqueta) => etiqueta.id)}
                disponiveis={etiquetas}
                vazio="Nenhuma etiqueta aplicada."
              />
            </Secao>

            <FunilDaConversa clienteId={clienteId} funis={funis} />

            <div className="mt-5">
              <h3 className="text-[12px] font-bold text-soft">O que o fluxo coletou</h3>
              <CamposColetados campos={campos} />
            </div>
          </>
        }
      />
    </aside>
  )
}

/**
 * Uma seção da coluna, com o que dizer quando ela está vazia: "Nenhuma
 * etiqueta aplicada" responde a pergunta; a seção sumindo faz a pessoa
 * procurar onde ficaram as etiquetas.
 */
function Secao({ titulo, vazio, children }: { titulo: string; vazio: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-1.5 text-[12px] font-bold text-soft">{titulo}</h3>
      {children || <p className="text-[12px] text-dim">{vazio}</p>}
    </div>
  )
}

