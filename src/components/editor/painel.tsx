'use client'

import { useId, useRef, useState, type ReactNode } from 'react'
import { Caixa } from '@/components/design/caixa'
import { FERRAMENTAS } from '@/core/ferramentas'
import {
  LIMITE_BOTOES,
  LIMITE_LEGENDA,
  LIMITE_LISTA,
  LIMITE_MENSAGENS_HANDOFF,
  LIMITE_ROTULO,
  LIMITE_TEXTO,
  LIMITE_TEXTO_INTERATIVO,
  MARCA_DE_LISTA,
  METODOS,
  OPERADORES,
  type Operador,
  type Cabecalho,
  type Mapeamento,
  type No,
  type Opcao,
} from '@/core/flow/schema'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import { mensagensDoHandoff, partesDaMensagem } from '@/core/flow/mensagem'
import { Dropdown } from '@/components/design/dropdown'
import { AjudaDoCampo } from '@/components/design/ajuda-do-campo'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { SecaoAvancada } from '@/components/design/secao-avancada'
import { BarraDeFormato, SeletorDeEmoji } from './barra-de-formato'
import { SeletorDeVariavel } from './escolher-variavel'
import { CampoDeVariavel } from './campo-de-variavel'
import { SeletorDeArquivo } from './seletor-de-arquivo'
import { PresetsDeIntegracao } from './presets-de-integracao'
import { PilhaDeMensagem } from './pilha'
import { LegendaDeVariaveis, LinhaComVariaveis, TextoComVariaveis } from './texto-com-variaveis'
import { NOMES } from './nos'
import { contarCaracteres } from '@/core/flow/texto'
import { EXEMPLO_DO_FORMATO, FORMATOS_DE_SAIDA, type FormatoDeSaida } from '@/core/flow/formatos'
import {
  EXEMPLO_PADRONIZADO,
  FORMATOS_DE_RESPOSTA,
  NOME_DO_FORMATO,
  PEDIDO_PADRAO,
} from '@/core/flow/resposta'

/** Os quatro tipos, no nome que quem desenha o fluxo usa. */

/**
 * A explicação do **bloco inteiro**, no “?” ao lado do nome dele.
 *
 * Nem toda explicação é de um campo. "Este bloco pode ser o primeiro do fluxo",
 * "a IA responde com o contexto do negócio", "a régua do NPS é 9-10, 7-8, 0-6":
 * são coisas que valem para o bloco todo, e que antes viviam como cartões de
 * texto empilhados acima dos campos, empurrando o primeiro campo para fora da
 * vista logo na abertura.
 *
 * Ficam aqui, atrás do mesmo “?” de todo o resto, e com isso o painel abre
 * mostrando campos, que é o que alguém veio fazer quando clicou num bloco.
 */
const AJUDA_DO_BLOCO: Partial<
  Record<No['type'], { texto: string; detalhes: ReactNode; secao: string }>
> = {
  nps: {
    texto: 'Pergunta uma nota de 0 a 10 e separa a conversa em três caminhos, na régua do NPS.',
    secao: 'blocos',
    detalhes: (
      <>
        <p>
          A resposta esperada é um número de <strong>0 a 10</strong>. O bloco entende “8”, “8/10” e
          “nota 8”, e pede de novo quando não vier número nenhum.
        </p>
        <p>
          Ele separa sozinho, na régua do NPS: <strong>9 e 10 promotor</strong>,{' '}
          <strong>7 e 8 neutro</strong>, <strong>0 a 6 detrator</strong>. Cada faixa tem a sua
          saída. É o 7 que costuma surpreender: “quase dez” parece bom e conta como neutro.
        </p>
        <p>A nota é guardada com a data, sempre, a de hoje não apaga a do mês passado.</p>
      </>
    ),
  },
  ia: {
    texto:
      'A IA responde com o contexto do negócio e, se você marcar abaixo, com o que ela consultar no sistema.',
    secao: 'blocos',
    detalhes: (
      <>
        <p>
          A IA responde com o que estiver escrito no contexto do negócio, e, se você marcar abaixo,
          com o que ela consultar no sistema do cliente. Quando não souber, passa para uma pessoa.
        </p>
        <p>
          As consultas vêm antes de “guardar resposta em” de propósito: o que a IA pode consultar
          muda o que se escreve na instrução, e as duas coisas se decidem juntas.
        </p>
      </>
    ),
  },
  http: {
    texto:
      'Pode ser o primeiro bloco do fluxo: a conversa já sabe o telefone e o nome antes de perguntar qualquer coisa.',
    secao: 'outros-sistemas',
    detalhes: (
      <>
        <p>
          Este bloco pode ser o <strong>primeiro do fluxo</strong>: a conversa já sabe{' '}
          <code>{'{{telefone}}'}</code> e <code>{'{{nome}}'}</code> antes de perguntar qualquer
          coisa. Dá para procurar a pessoa pelo número e só então dar bom dia pelo nome.
        </p>
        <p>
          A aba Testar chama este endereço <strong>de verdade</strong>. Os disparos vindos dali
          levam o cabeçalho <code>X-AutoFluxos-Teste: 1</code>.
        </p>
      </>
    ),
  },
  voltar: {
    texto: 'Manda a conversa de volta para um passo anterior deste mesmo fluxo.',
    secao: 'blocos',
    detalhes: (
      <>
        <p>
          A conversa continua a partir do bloco escolhido, neste mesmo fluxo. O que já foi guardado{' '}
          <strong>não é apagado</strong>: quem voltou ao menu depois de dizer o nome não quer dizer
          o nome de novo.
        </p>
        <p>
          O próprio bloco fica fora da lista de destinos. Voltar para si mesmo é um ciclo sem nada
          no meio, e ele gira até o motor desistir e chamar uma pessoa.
        </p>
      </>
    ),
  },
  'ir-fluxo': {
    texto: 'Entrega a conversa a outra automação da conta. Ela não volta para esta.',
    secao: 'blocos',
    detalhes: (
      <>
        <p>
          A conversa continua na versão publicada da outra automação, do começo, e{' '}
          <strong>não volta</strong>. O que já foi guardado (nome, assunto, tudo) vai junto.
        </p>
        <p>
          Uma automação nunca publicada não tem o que executar, e uma desligada manda quem chegar lá
          para uma pessoa. A lista diz as duas coisas antes de você escolher.
        </p>
      </>
    ),
  },
  etapa: {
    texto:
      'Move a pessoa de coluna no quadro de acompanhamento, sozinho, conforme a conversa anda.',
    secao: 'blocos',
    detalhes: (
      <>
        <p>
          O quadro é o painel de acompanhamento do atendimento, com colunas como “chegou”,
          “orçamento enviado”, “fechou”. Este bloco move a pessoa de coluna sozinho, conforme a
          conversa anda.
        </p>
        <p>
          Quem passar por aqui entra no quadro nesta etapa, e quem já estava nele é movido para cá.
          O relógio de “parado há quanto tempo” recomeça.
        </p>
      </>
    ),
  },
  etiqueta: {
    texto: 'Põe uma etiqueta no contato, o mesmo gesto de etiquetar à mão no Inbox.',
    secao: 'blocos',
    detalhes: (
      <>
        <p>
          Etiqueta é o que a pessoa <strong>é</strong>: “quer pilates”, “já é aluno”. Ela pode ter
          várias ao mesmo tempo, e é por elas que se filtra a lista de contatos depois.
        </p>
        <p>
          Vale o mesmo que pôr a etiqueta à mão no Inbox, inclusive começar a sequência que ela
          dispara. Quem já tem a etiqueta não a recebe duas vezes.
        </p>
      </>
    ),
  },
  nota: {
    texto: 'Escreve na anotação da ficha. Ninguém do outro lado da conversa lê isto.',
    secao: 'blocos',
    detalhes: (
      <>
        <p>
          Vai para a anotação da ficha, onde a equipe escreve, e <strong>acrescenta</strong>, nunca
          apaga o que já estava lá. Ninguém do outro lado da conversa lê isto.
        </p>
        <p>
          Por isso o campo não tem barra de negrito: a anotação não vira mensagem no WhatsApp, e um{' '}
          <code>*isto*</code> apareceria com os asteriscos para quem lê a ficha.
        </p>
      </>
    ),
  },
}

/** O que o painel precisa saber de uma credencial: o nome, e nada mais. */
export type ConexaoDoCliente = { id: string; nome: string; tipo: string }

/**
 * Os quadros do cliente, achatados em etapas (C1b).
 *
 * Chega achatado de propósito: o bloco escolhe **uma etapa**, e um seletor de
 * dois níveis ("qual quadro?" depois "qual etapa?") custaria dois cliques para
 * uma escolha só. O nome do quadro entra como prefixo, que é o que desambigua
 * duas etapas "Fechado" em funis diferentes.
 */
export type EtapaDoCliente = {
  quadroId: string
  colunaId: string
  rotulo: string
}

/**
 * As etiquetas do cliente, para o bloco de etiqueta (0044).
 *
 * A cor vem junto porque é assim que a etiqueta é reconhecida em toda a casa ,
 * no Inbox, na ficha, no filtro. Um seletor que mostrasse só o nome faria a
 * pessoa escolher às cegas o que ela identifica pela cor no resto do produto.
 */
export type EtiquetaDoCliente = { id: string; nome: string; cor: string }

/**
 * Quem atende nesta conta, para o handoff poder endereçar o aviso.
 *
 * Só id e nome: o painel não tem o que fazer com e-mail nem com papel, e
 * carregar mais do que a tela mostra é dado pessoal viajando de graça até o
 * navegador.
 */
export type MembroDoCliente = { id: string; nome: string }

/**
 * Uma automação da conta, como o bloco "Ir para outra automação" a enxerga.
 *
 * `publicado` e `ativo` vêm junto porque o seletor precisa **dizer o que está
 * errado antes de a pessoa escolher**: mandar conversa para um fluxo que nunca
 * foi publicado é um beco sem saída, e para um desligado é um handoff. Escolher
 * primeiro e descobrir na lista de impedimentos depois é o caminho longo.
 */
export type FluxoDaConta = {
  id: string
  nome: string
  publicado: boolean
  ativo: boolean
}

/**
 * O formulário do bloco selecionado. Tudo que é específico de um cliente é
 * digitado aqui e vai parar no JSON do fluxo, nunca no código.
 */
/**
 * Os prazos que a tela oferece.
 *
 * Lista fechada e não campo livre: prazo é decisão de conversa, não de número.
 * Quem digita "7" numa caixa não sabe se são minutos ou horas, e as opções
 * respondem isso sem uma linha de ajuda. O teto de 24h é a janela do WhatsApp ,
 * passado dela não há como mandar texto livre, e um prazo que dispara para não
 * conseguir falar só gera handoff.
 */
/**
 * O operador escrito como quem fala.
 *
 * O dropdown mostrava a palavra crua do código, "contem", sem acento, e
 * "maior" sem dizer maior o quê. Quem desenha lê a condição inteira como frase:
 * "orcamento é maior que {{preco}}".
 */
const ROTULO_DO_OPERADOR: Record<Operador, string> = {
  igual: 'é igual a',
  diferente: 'é diferente de',
  contem: 'contém',
  vazio: 'está vazia',
  preenchido: 'está preenchida',
  maior: 'é maior que (número)',
  menor: 'é menor que (número)',
}

/** O nome curto de cada formato; o exemplo vem de `EXEMPLO_DO_FORMATO`. */
const NOME_DO_FORMATO_DE_SAIDA: Record<FormatoDeSaida, string> = {
  data: 'data',
  hora: 'hora',
  data_hora: 'data e hora',
  dinheiro: 'dinheiro',
  nomes: 'lista de nomes',
}

/** O que cada método faz, na língua de quem monta o fluxo. */
const METODO_EM_PORTUGUES: Record<string, string> = {
  GET: 'consultar, trazer informação de lá para a conversa',
  POST: 'mandar, entregar ao sistema o que a conversa coletou',
}

const PRAZOS = [
  { valor: '0', rotulo: 'sem prazo', detalhe: 'espera para sempre' },
  { valor: '5', rotulo: '5 minutos' },
  { valor: '15', rotulo: '15 minutos' },
  { valor: '30', rotulo: '30 minutos' },
  { valor: '60', rotulo: '1 hora' },
  { valor: '180', rotulo: '3 horas' },
  { valor: '720', rotulo: '12 horas' },
  {
    valor: '1440',
    rotulo: '24 horas',
    detalhe: 'o teto da janela do WhatsApp',
  },
]

export function Painel({
  no,
  clienteId,
  ehInicio,
  variaveis,
  origensDeVariaveis = {},
  blocos = [],
  valoresDeVariaveis = {},
  conexoes = [],
  iaHabilitada = false,
  etapas = [],
  etiquetas = [],
  equipe = [],
  horarioConfigurado = false,
  fluxos = [],
  aoMudarDados,
  aoDefinirInicio,
  aoApagar,
}: {
  no: No | null
  /** De quem é o fluxo. O upload dos blocos de arquivo precisa saber a pasta. */
  clienteId: string
  ehInicio: boolean
  variaveis: string[]
  /**
   * Que blocos guardam cada variável. É o que separa "reaproveitei a de lá" de
   * "criei outra igual", sem isso o campo do próprio bloco se acusaria de
   * repetir a si mesmo.
   */
  origensDeVariaveis?: Record<string, string[]>
  /**
   * Todos os blocos do desenho. É o que o bloco de Voltar oferece como destino.
   *
   * Vem inteiro e não só os ids porque a lista precisa mostrar o texto de cada
   * um, escolher entre onze uuids não é escolher.
   */
  blocos?: No[]
  /**
   * Que valores cada variável pode ter, quando isso é sabido: são os rótulos
   * dos botões das perguntas que guardam nela. A condição usa para oferecer o
   * valor em vez de cobrar que ele seja digitado igualzinho de memória.
   */
  valoresDeVariaveis?: Record<string, string[]>
  conexoes?: ConexaoDoCliente[]
  /** Este cliente tem o plano de IA. Muda o card inteiro do bloco de IA. */
  iaHabilitada?: boolean
  etapas?: EtapaDoCliente[]
  etiquetas?: EtiquetaDoCliente[]
  /** Quem atende, para escolher a quem endereçar o aviso do handoff. */
  equipe?: MembroDoCliente[]
  /**
   * Esta conta tem horário de atendimento preenchido?
   *
   * Serve para o bloco de handoff contar a verdade sobre si mesmo. Ele **já**
   * manda um aviso quando a transferência cai fora do expediente, com a hora
   * de voltar, e faz isso desde a rodada do `avisoDeForaDoHorario`. Só que nada
   * na tela dizia, e em 16/set/2026 um cliente pediu de novo o recurso que já
   * tinha, propondo montar uma condição na mão para reproduzi-lo.
   *
   * Pior: as seis contas de produção estavam com o horário em branco, então o
   * recurso nunca tinha rodado uma vez. Conta sem horário é conta sempre
   * aberta, e conta sempre aberta nunca manda o aviso. Sem este campo, o bloco
   * prometeria na tela uma coisa que não aconteceria na conversa.
   */
  horarioConfigurado?: boolean
  fluxos?: FluxoDaConta[]
  aoMudarDados: (dados: Record<string, unknown>) => void
  aoDefinirInicio: () => void
  aoApagar: () => void
}) {
  if (!no) {
    return (
      <div className="p-4">
        <div className="rounded-[14px] border border-dashed border-line px-[18px] py-[34px] text-center text-[12.5px] leading-6 text-dim">
          Selecione um bloco na área de desenho
          <br />
          ou adicione um novo pelo catálogo.
        </div>
      </div>
    )
  }

  /*
   * As variáveis que **outros** blocos guardam. A do próprio bloco sai da lista
   * porque escolher o nome que já está no campo não é escolha nenhuma, e
   * porque é ela que faria o campo dizer "reaproveita" para si mesmo.
   *
   * Variável sem nenhuma origem neste desenho **fica**: ela vem de outra
   * automação da conta, e é exatamente a que mais precisa ser oferecida. O que
   * um fluxo guarda fica no contato e continua lá na conversa seguinte, então
   * ler `{{plano}}` gravado pelo fluxo de matrícula é uso certo, e antes disto
   * a única forma era digitar de cabeça, onde errar uma letra não estoura:
   * a variável vira vazia e a mensagem sai com um buraco.
   */
  const deOutrosBlocos = variaveis.filter((v) => {
    const origens = origensDeVariaveis[v] ?? []
    return origens.length === 0 || origens.some((id) => id !== no.id)
  })

  return (
    <div className="space-y-4 p-4">
      {/*
        **Os dois botões não quebram mais linha.**

        "Tornar início" saía com uma palavra em cima da outra, dentro da moldura
        do botão. A causa era o título ao lado poder crescer sem limite: numa
        linha `flex`, o `<h3>` empurrava, e quem cedia era o botão , que tem
        texto e por isso quebra antes de encolher.

        `min-w-0` e `truncate` no título dizem quem cede (ele, cortando o nome
        do bloco), e `whitespace-nowrap` com `shrink-0` nos botões diz que eles
        não cedem nunca. Nome de bloco cortado se lê no card do desenho; botão
        partido ao meio não se lê em lugar nenhum.
      */}
      <div className="flex items-center gap-2">
        <h3 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-[13px] text-primary">
            {NOMES[no.type].slice(0, 1)}
          </span>
          <span className="truncate">{NOMES[no.type]}</span>
          {AJUDA_DO_BLOCO[no.type] && (
            <AjudaDoCampo
              texto={AJUDA_DO_BLOCO[no.type]!.texto}
              detalhes={AJUDA_DO_BLOCO[no.type]!.detalhes}
              secao={AJUDA_DO_BLOCO[no.type]!.secao}
              titulo={NOMES[no.type]}
            />
          )}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          {ehInicio ? (
            <span className="rounded-lg border border-primary/30 bg-primary/[0.12] px-2.5 py-1 text-[10px] font-bold whitespace-nowrap text-primary">
              INÍCIO
            </span>
          ) : (
            <button
              onClick={aoDefinirInicio}
              className="rounded-lg border border-line px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap text-muted transition hover:border-primary/40 hover:text-primary"
            >
              Tornar início
            </button>
          )}
          <button
            onClick={aoApagar}
            className="rounded-lg border border-rose-400/30 px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap text-perigo transition hover:bg-rose-400/10"
          >
            Apagar
          </button>
        </div>
      </div>

      {no.type === 'mensagem' && (
        <PilhaDeMensagem
          variaveis={variaveis}
          no={no}
          clienteId={clienteId}
          aoMudarDados={aoMudarDados}
        />
      )}

      {no.type === 'midia' && (
        <>
          {/*
            Arrastar, escolher do computador, ou reusar o que já está no acervo
           , e o tipo sai do arquivo. O campo pedindo `https://` era o nosso
            problema empurrado para quem usa: a foto da sala está no computador
            da pessoa, não num servidor.
          */}
          <div>
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Arquivo
            </span>
            <SeletorDeArquivo
              clienteId={clienteId}
              url={no.data.url}
              midia={no.data.midia}
              variaveis={variaveis}
              aoEscolher={(escolha) =>
                aoMudarDados({
                  url: escolha.url,
                  midia: escolha.midia,
                  // Áudio não aceita legenda: a Meta recusa a mensagem inteira.
                  // Limpar em vez de deixar guardada e invisível, o campo some
                  // da tela, e um texto que ninguém vê barraria a publicação sem
                  // dizer onde está.
                  ...(escolha.midia === 'audio' ? { legenda: '' } : {}),
                  ...(escolha.midia === 'documento' && escolha.nomeArquivo
                    ? { nomeArquivo: escolha.nomeArquivo }
                    : {}),
                })
              }
            />
          </div>

          {no.data.midia === 'documento' && (
            <Linha
              rotulo="Nome do arquivo"
              valor={no.data.nomeArquivo ?? ''}
              aoMudar={(nomeArquivo) => aoMudarDados({ nomeArquivo })}
              aceitaVariavel
              conhecidas={variaveis}
              dica="É o que a pessoa lê antes de baixar. Vazio, o WhatsApp mostra o fim da URL."
              secao="blocos"
              detalhes={
                <p>
                  O documento chega ao WhatsApp com um nome escrito embaixo do ícone, e é ele que a
                  pessoa lê antes de decidir se baixa. Sem preencher, o WhatsApp usa o último pedaço
                  do endereço do arquivo, normalmente algo como <code>a3f91c2e.pdf</code>, que não
                  diz nada a ninguém.
                </p>
              }
            />
          )}

          {no.data.midia === 'audio' ? (
            <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-[11.5px] leading-5 text-muted">
              Áudio não aceita legenda no WhatsApp, a Meta recusa a mensagem inteira, não ignora o
              campo. Para dizer algo junto, use um bloco de Mensagem antes ou depois deste.
            </p>
          ) : (
            <Area
              conhecidas={variaveis}
              rotulo="Legenda"
              valor={no.data.legenda ?? ''}
              limite={LIMITE_LEGENDA}
              aoMudar={(legenda) => aoMudarDados({ legenda })}
              formatavel
              dica="O texto que vai junto do arquivo, na mesma mensagem. Pode ficar vazio."
              secao="blocos"
              detalhes={
                <>
                  <p>
                    A legenda viaja <strong>na mesma mensagem</strong> do arquivo, e não numa
                    mensagem separada: a foto chega com o texto embaixo, numa notificação só.
                  </p>
                  <p>
                    Aceita <code>{'{{variavel}}'}</code> como qualquer outro texto do fluxo, então
                    dá para mandar a mesma imagem escrevendo o nome de quem recebe.
                  </p>
                </>
              }
            />
          )}
        </>
      )}

      {no.type === 'pergunta' && (
        <>
          <Area
            conhecidas={variaveis}
            rotulo="Pergunta"
            valor={no.data.texto}
            // Com opção, a mensagem sai interativa e o teto cai para um quarto.
            limite={
              no.data.opcoes.length > 0 || (no.data.opcoesDe ?? '').trim() !== ''
                ? LIMITE_TEXTO_INTERATIVO
                : LIMITE_TEXTO
            }
            aoMudar={(texto) => aoMudarDados({ texto })}
            formatavel
            dica="O que o bot escreve. Com opções desenhadas abaixo, o teto de caracteres cai para um quarto."
            secao="perguntas"
            detalhes={
              <>
                <p>
                  É a fala do bot. Sem opções, a pessoa responde escrevendo; com opções, o WhatsApp
                  desenha botões ou uma lista, e aí a mensagem vira <strong>interativa</strong>, o
                  teto de caracteres cai para um quarto, porque é o que a Meta aceita nesse formato.
                </p>
                <p>
                  O contador ao lado do título mostra o teto da vez. Passar dele não corta o que
                  você escreveu: quem recusa é a publicação, onde a recusa vale e vem explicada.
                </p>
              </>
            }
          />
          <CampoDeVariavel
            rotulo="Guardar resposta em"
            secao="variaveis"
            valor={no.data.salvarEm ?? ''}
            variaveis={deOutrosBlocos}
            modo="guarda"
            dica="Nome sem espaço nem acento, ex.: nome, prazo. Ou escolha uma que o fluxo já tem, no {x}."
            aoMudar={(v) => aoMudarDados({ salvarEm: v.trim() === '' ? undefined : v.trim() })}
            nota={
              no.data.opcoes.length > 0 ? (
                <>
                  É <strong className="text-muted">uma variável só</strong>, e ela guarda o rótulo
                  do botão clicado, {no.data.opcoes.map((o) => `“${o.rotulo}”`).join(', ')}. Ou
                  seja: é o caminho que o lead levou, e cada ramo depois daqui guarda o que for dele
                  em variáveis próprias.
                </>
              ) : (
                'Guarda o que a pessoa escrever, do jeito que ela escrever.'
              )
            }
          />
          <CampoDeVariavel
            rotulo="Opções vêm da variável"
            secao="listas"
            valor={no.data.opcoesDe ?? ''}
            variaveis={deOutrosBlocos}
            modo="usa"
            dica="Deixe vazio para desenhar as opções à mão. Preenchido, o menu é montado durante a conversa."
            nota={
              <>
                <p>
                  Serve para o menu que só existe na hora: os horários livres de hoje, as unidades
                  que atendem aquele bairro. Normalmente a variável é preenchida por um bloco de
                  Serviços externos logo antes deste.
                </p>
                <p>
                  As opções saem dela separadas por <code>;</code> ou por quebra de linha. Como só
                  existem durante a conversa, o bloco deixa de ramificar por opção: ligue as saídas{' '}
                  <strong>escolheu</strong> e <strong>veio vazia</strong>, e use um bloco de
                  Condição depois se precisar decidir sobre a escolha.
                </p>
              </>
            }
            aoMudar={(v) => aoMudarDados({ opcoesDe: v.trim() === '' ? undefined : v.trim() })}
          />
          {(no.data.opcoesDe ?? '').trim() === '' ? (
            <>
              <Opcoes
                opcoes={no.data.opcoes}
                mostrarValor={(no.data.salvarValorEm ?? '').trim() !== ''}
                aoMudar={(opcoes) => aoMudarDados({ opcoes })}
              />

              {/*
                O mesmo campo do ramo dinâmico, e pelo mesmo motivo: o que a
                pessoa lê e o que a API entende são coisas diferentes. Ele mora
                aqui embaixo porque é ele que faz a coluna de valor aparecer
                acima, preencher o destino é o que revela os campos de origem,
                e não o contrário.
              */}
              <CampoDeVariavel
                rotulo="Guardar o valor escolhido em"
                valor={no.data.salvarValorEm ?? ''}
                variaveis={deOutrosBlocos}
                modo="guarda"
                secao="listas"
                dica="Deixe vazio se o texto do botão já serve para o resto do fluxo."
                aoMudar={(v) =>
                  aoMudarDados({
                    salvarValorEm: v.trim() === '' ? undefined : v.trim(),
                  })
                }
                nota={
                  <>
                    Com isto preenchido, cada opção ganha um campo de{' '}
                    <strong className="text-muted">valor</strong>: a pessoa lê “Vídeo institucional”
                    e a API recebe <code className="font-mono text-primary">institucional</code>.
                    Sem isto, o fluxo guarda o próprio texto do botão.
                  </>
                }
              />

              {/*
                O formato só faz sentido sem opções.

                Com botão, quem confere a resposta é o casamento com o rótulo
                clicado; oferecer o campo ali seria oferecer uma conferência que
                não roda. Por isso ele mora dentro deste ramo, e não ao lado.
              */}
              {no.data.opcoes.length === 0 && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
                      A resposta precisa ser
                      <AjudaDoCampo
                        titulo="A resposta precisa ser"
                        secao="perguntas"
                        texto="Confere a resposta antes de seguir. Quando não casa, o bot pede de novo sem sair daqui."
                        alinhar="direita"
                        detalhes={
                          <>
                            <p>
                              Com um formato escolhido, o bot confere o que a pessoa escreveu antes
                              de seguir. Quando não casa, ele pede de novo{' '}
                              <strong>sem sair deste bloco</strong>. Na terceira vez a conversa vai
                              para uma pessoa, e isso é de propósito: insistir uma quarta vez é
                              conversar com quem já desistiu de responder.
                            </p>
                            <p>
                              Escolhido um formato, o campo guarda o que a pessoa escreveu do jeito
                              dela. Para ter também a forma que uma API aceita, use “Guardar
                              padronizado em”, que aparece logo abaixo.
                            </p>
                          </>
                        }
                      />
                    </span>
                    <Dropdown
                      valor={no.data.formato ?? ''}
                      aoMudar={(v) =>
                        aoMudarDados({
                          formato: v === '' ? undefined : v,
                          // Sem formato não há o que padronizar, e uma variável
                          // que ficasse para trás gravaria vazio para sempre.
                          ...(v === '' ? { salvarPadraoEm: undefined } : {}),
                        })
                      }
                      rotuloAcessivel="Formato da resposta"
                      opcoes={[
                        {
                          valor: '',
                          rotulo: 'Qualquer texto',
                          detalhe: 'aceita o que a pessoa escrever',
                        },
                        ...FORMATOS_DE_RESPOSTA.map((formato) => ({
                          valor: formato,
                          rotulo: NOME_DO_FORMATO[formato],
                          detalhe: `guarda padronizado como ${EXEMPLO_PADRONIZADO[formato]}`,
                        })),
                      ]}
                    />
                  </label>

                  {no.data.formato && (
                    <>
                      <Area
                        conhecidas={variaveis}
                        rotulo="Mensagem quando não entender"
                        valor={no.data.mensagemDeErro ?? ''}
                        limite={LIMITE_TEXTO}
                        aoMudar={(v) =>
                          aoMudarDados({
                            mensagemDeErro: v.trim() === '' ? undefined : v,
                          })
                        }
                        formatavel
                        dica={`Vazio usa a nossa: “${PEDIDO_PADRAO[no.data.formato]}”`}
                        secao="perguntas"
                        detalhes={
                          <>
                            <p>
                              Deixando vazio, o bot usa a nossa:{' '}
                              <strong>“{PEDIDO_PADRAO[no.data.formato]}”</strong>
                            </p>
                            <p>
                              Se for escrever a sua, diga o que falta{' '}
                              <strong>e dê um exemplo</strong>. “Formato inválido” não ensina
                              ninguém a responder certo, e o que vem depois dela é a mesma resposta
                              errada de novo.
                            </p>
                          </>
                        }
                      />

                      <CampoDeVariavel
                        rotulo="Guardar padronizado em (opcional)"
                        valor={no.data.salvarPadraoEm ?? ''}
                        variaveis={deOutrosBlocos}
                        modo="guarda"
                        secao="perguntas"
                        dica={`Ex.: ${no.data.formato}_padrao, guarda ${EXEMPLO_PADRONIZADO[no.data.formato]}.`}
                        aoMudar={(v) =>
                          aoMudarDados({
                            salvarPadraoEm: v.trim() === '' ? undefined : v.trim(),
                          })
                        }
                        nota={
                          <>
                            “Guardar resposta em” fica com o que a pessoa escreveu, é o que ela quer
                            ler de volta. Esta guarda a forma que uma API aceita. Use quando o bloco
                            seguinte for chamar um sistema.
                          </>
                        }
                      />
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/*
                O rótulo é o que a pessoa lê; o valor é o que o sistema entende.

                Os dois campos abaixo existem porque o menu de horários guardava
                "07:00" e o `POST` seguinte precisava do id da sessão, que não
                estava em lugar nenhum da conversa. Duas mapeadas do mesmo `[]`
                resolvem, e é isso que a dica explica.
              */}
              <CampoDeVariavel
                rotulo="Valores das opções (opcional)"
                valor={no.data.valoresDe ?? ''}
                variaveis={deOutrosBlocos}
                modo="usa"
                secao="listas"
                dica="A variável com os ids, na mesma ordem das opções."
                aoMudar={(v) =>
                  aoMudarDados({
                    valoresDe: v.trim() === '' ? undefined : v.trim(),
                  })
                }
                nota={
                  <>
                    Use quando o que a pessoa lê e o que o sistema entende são coisas diferentes ,
                    ela escolhe <strong className="text-muted">“07:00”</strong> e a API precisa do
                    id daquele horário. No bloco de Serviços externos, mapeie duas vezes a mesma
                    lista: <code className="font-mono text-primary">livres[].hora</code> para as
                    opções e <code className="font-mono text-primary">livres[].sessaoId</code> para
                    os valores. O casamento é <strong className="text-muted">por posição</strong>.
                  </>
                }
              />

              {(no.data.valoresDe ?? '').trim() !== '' && (
                <CampoDeVariavel
                  rotulo="Guardar o valor escolhido em"
                  valor={no.data.salvarValorEm ?? ''}
                  variaveis={deOutrosBlocos}
                  modo="guarda"
                  secao="listas"
                  dica="Ex.: sessao_id. É o que o bloco seguinte manda para a API, no lugar do texto que a pessoa leu."
                  aoMudar={(v) =>
                    aoMudarDados({
                      salvarValorEm: v.trim() === '' ? undefined : v.trim(),
                    })
                  }
                />
              )}
            </>
          )}

          {/*
            A foto como resposta.

            Sem isto, foto, áudio e documento sempre iam para uma pessoa com o
            motivo "o bot só lê texto", e a farmácia que pede a receita, o
            petshop que quer ver o pet e a imobiliária que recebe a planta não
            tinham como dizer que ali o arquivo **é** a resposta certa.
          */}
          {/*
            O fim do bloco, recolhido.

            Aceitar arquivo e prazo para responder são reais e são raros: quem
            monta a primeira pergunta quer escrever a pergunta, listar as opções
            e dizer onde guarda a resposta. Abertos, eles somavam três campos
            e dois avisos na frente disso.

            A seção nasce aberta quando algum deles já está preenchido, então
            ninguém perde de vista o que configurou.
          */}
          <SecaoAvancada
            resumo="arquivo como resposta, prazo"
            temConteudo={!!no.data.aceitaMidia || !!no.data.timeoutMinutos}
          >
            <LinhaLigaDesliga
              titulo="Aceitar foto, áudio ou documento"
              descricao="Cria a saída “mandou arquivo” no bloco."
              marcada={no.data.aceitaMidia ?? false}
              aoMudar={(marcada) =>
                aoMudarDados({
                  aceitaMidia: marcada || undefined,
                  ...(marcada ? {} : { salvarMidiaEm: undefined }),
                })
              }
              ajuda={
                <AjudaDoCampo
                  titulo="Aceitar foto, áudio ou documento"
                  secao="perguntas"
                  texto="Cria a saída “mandou arquivo”. Sem ligar, quem manda foto é passado para uma pessoa."
                  detalhes={
                    <>
                      <p>
                        Ligando, o bloco ganha a saída <strong>“mandou arquivo”</strong>: ali o
                        arquivo <strong>é</strong> a resposta certa, e a conversa segue pelo desenho
                        em vez de parar.
                      </p>
                      <p>
                        É o caso da farmácia que pede a receita, do petshop que quer ver o pet e da
                        imobiliária que recebe a planta. Desligado, foto, áudio e documento sempre
                        passam para uma pessoa, com o motivo “o bot só lê texto”.
                      </p>
                    </>
                  }
                />
              }
            />

            {no.data.aceitaMidia && (
              <CampoDeVariavel
                rotulo="Guardar o arquivo em"
                secao="perguntas"
                valor={no.data.salvarMidiaEm ?? ''}
                variaveis={deOutrosBlocos}
                modo="guarda"
                dica="Ex.: receita. Dá um nome ao arquivo para usar depois na conversa."
                nota={
                  <>
                    Guarda uma etiqueta do arquivo que a pessoa mandou, não o arquivo em si. Serve
                    para mandar a foto ao seu sistema, se você tiver um, e, se não tiver, pode
                    deixar em branco: a foto continua aparecendo na conversa de quem atende.
                  </>
                }
                aoMudar={(v) =>
                  aoMudarDados({
                    salvarMidiaEm: v.trim() === '' ? undefined : v.trim(),
                  })
                }
              />
            )}

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
                Prazo para responder
                <AjudaDoCampo
                  titulo="Prazo para responder"
                  secao="perguntas"
                  texto="Quanto tempo o bot espera antes de sair pela saída “não respondeu”."
                  detalhes={
                    <>
                      <p>
                        Com um prazo, a conversa sai pela saída <strong>“não respondeu”</strong>.
                        Sem nada ligado nela, ela vai para uma pessoa: quem parou no meio da triagem
                        é o lead que mais vale resgatar. Sem prazo, a conversa espera para sempre, é
                        como o produto sempre funcionou.
                      </p>
                      <p>
                        O disparo é por fila, não por despertador: ele acontece{' '}
                        <strong>a partir</strong> do prazo, nunca antes, mas não no minuto exato.
                      </p>
                      <p>
                        A lista é fechada porque prazo é decisão de conversa, não de número: quem
                        digita “7” numa caixa não sabe se são minutos ou horas. O teto de 24h é a
                        janela do WhatsApp, passado dela não há como mandar texto livre.
                      </p>
                    </>
                  }
                />
              </span>
              <Dropdown
                valor={String(no.data.timeoutMinutos ?? 0)}
                aoMudar={(v) =>
                  aoMudarDados({
                    timeoutMinutos: Number(v) === 0 ? undefined : Number(v),
                  })
                }
                rotuloAcessivel="Prazo para responder"
                opcoes={PRAZOS}
              />
              {/*
                **O aviso que só existia depois do estrago.**

                A janela do WhatsApp fecha 24h depois da última mensagem *dela*, e
                o prazo aqui conta a partir da pergunta, que é sempre depois. Num
                prazo de 12h ou mais, o disparo por fila (que acontece "a partir
                do prazo", nunca antes) tem chance real de cair já fora da janela:
                a Meta recusa com `(#131047)`, a retomada não chega e a conversa
                vira handoff.

                Nada disso aparecia no editor. Quem desenhava só descobria em
                produção, e o sintoma, "a mensagem não chegou", não aponta para
                o campo que a causou.
              */}
              {(no.data.timeoutMinutos ?? 0) >= 720 && (
                <span className="mt-1.5 block rounded-[8px] border border-amber-300/25 bg-amber-300/[0.06] px-2.5 py-2 text-[11px] leading-4 text-aviso">
                  Prazo longo: a janela do WhatsApp fecha 24h depois da{' '}
                  <strong>última mensagem dela</strong>, e este prazo conta da pergunta. Perto do
                  teto, a retomada pode ser recusada pela Meta e a conversa vai para uma pessoa em
                  vez de receber o texto.
                </span>
              )}
            </label>
          </SecaoAvancada>
        </>
      )}

      {no.type === 'condicao' && (
        <>
          <CampoDeVariavel
            rotulo="Variável"
            valor={no.data.variavel}
            variaveis={deOutrosBlocos}
            modo="usa"
            secao="blocos"
            dica="O nome cru, sem chaves: prazo, e não {{prazo}}."
            nota={
              <p>
                Aqui se escreve o <strong>nome</strong> da variável, não a citação dela. Nas
                mensagens você escreve <code>{'{{prazo}}'}</code> porque ali o texto é lido junto
                com o resto da frase; neste campo o fluxo já sabe que é uma variável, e as chaves
                virariam parte do nome.
              </p>
            }
            aoMudar={(variavel) => aoMudarDados({ variavel })}
          />
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Operador
              <AjudaDoCampo
                titulo="Operador"
                secao="blocos"
                texto="Como a condição compara. A frase inteira se lê em voz alta: “orcamento é maior que 500”."
                detalhes={
                  <>
                    <p>
                      A condição separa os caminhos do fluxo em dois: a saída <strong>sim</strong> e
                      a saída <strong>não</strong>. As duas precisam estar ligadas, senão a conversa
                      morre num dos lados.
                    </p>
                    <p>
                      Leia a linha inteira em voz alta para conferir:{' '}
                      <code>orcamento é maior que 500</code>. <strong>Vazio</strong> e{' '}
                      <strong>preenchido</strong> não pedem valor nenhum, servem para perguntar se o
                      fluxo já guardou aquilo.
                    </p>
                  </>
                }
              />
            </span>
            <Dropdown
              valor={no.data.operador}
              aoMudar={(operador) => aoMudarDados({ operador })}
              rotuloAcessivel="Operador"
              opcoes={OPERADORES.map((operador) => ({
                valor: operador,
                rotulo: ROTULO_DO_OPERADOR[operador],
              }))}
            />
          </label>
          {no.data.operador !== 'vazio' && no.data.operador !== 'preenchido' && (
            <div className="space-y-1.5">
              <Linha
                rotulo="Valor"
                valor={no.data.valor}
                dica="Com o que comparar: um texto que você escreve, ou outra informação da conversa."
                secao="blocos"
                detalhes={
                  <p>
                    Quando a variável vem de uma pergunta com botões, os valores possíveis aparecem
                    clicáveis logo abaixo deste campo. Use-os: digitar “Agendar aula” de memória
                    cria um erro que <strong>não estoura em lugar nenhum</strong>, a comparação
                    falha calada, todo mundo desce pelo ramo errado, e o desenho continua parecendo
                    certo.
                  </p>
                }
                aoMudar={(valor) => aoMudarDados({ valor })}
                aceitaVariavel
                conhecidas={variaveis}
              />
              <ValoresConhecidos
                valores={valoresDeVariaveis[no.data.variavel] ?? []}
                escolhido={no.data.valor}
                aoEscolher={(valor) => aoMudarDados({ valor })}
              />
            </div>
          )}
        </>
      )}

      {no.type === 'salvar-campo' && (
        <>
          <CampoDeVariavel
            rotulo="Campo"
            valor={no.data.campo}
            variaveis={deOutrosBlocos}
            modo="guarda"
            secao="variaveis"
            dica="Nome sem espaço nem acento. Ou escolha uma que o fluxo já tem, no {x}."
            aoMudar={(campo) => aoMudarDados({ campo })}
          />
          <Linha
            rotulo="Valor"
            valor={no.data.valor}
            secao="variaveis"
            dica="O que guardar: um texto que você escreve, ou outra informação da conversa."
            detalhes={
              <p>
                Guarda um valor na conversa sem perguntar nada a ninguém, é o jeito de marcar por
                onde o fluxo passou. Aceita <code>{'{{variavel}}'}</code>, então também serve para
                copiar o que já foi guardado sob outro nome.
              </p>
            }
            aoMudar={(valor) => aoMudarDados({ valor })}
            aceitaVariavel
            conhecidas={variaveis}
          />
        </>
      )}

      {no.type === 'etapa' && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Etapa do quadro
            <AjudaDoCampo
              titulo="Etapa do quadro"
              secao="blocos"
              texto="Para qual coluna do quadro a pessoa vai quando passar por aqui."
              detalhes={
                <>
                  <p>
                    O quadro é o painel de acompanhamento do atendimento, com colunas como “chegou”,
                    “orçamento enviado”, “fechou”.
                  </p>
                  <p>
                    Quem passar por aqui entra no quadro nesta etapa, e quem já estava nele é movido
                    para cá. O relógio de “parado há quanto tempo” recomeça.
                  </p>
                </>
              }
            />
          </span>
          {etapas.length === 0 ? (
            <span className="block rounded-lg border border-dashed border-strong px-3 py-3 text-[11.5px] leading-5 text-dim">
              Este cliente ainda não tem quadro nenhum. Crie um em Quadros, na tela do cliente, sem
              etapa para escolher, este bloco não tem o que fazer.
            </span>
          ) : (
            <>
              <Dropdown
                valor={no.data.colunaId}
                aoMudar={(colunaId) => {
                  const escolhida = etapas.find((etapa) => etapa.colunaId === colunaId)
                  // `rotulo` viaja junto só para o desenho: o bloco no canvas
                  // precisa dizer alguma coisa, e um uuid não diz. O motor
                  // ignora, e `validar()` também.
                  aoMudarDados({
                    colunaId,
                    quadroId: escolhida?.quadroId ?? '',
                    rotulo: escolhida?.rotulo ?? '',
                  })
                }}
                rotuloAcessivel="Etapa do quadro"
                opcoes={[
                  { valor: '', rotulo: 'Nenhuma, o bloco não faz nada' },
                  ...etapas.map((etapa) => ({
                    valor: etapa.colunaId,
                    rotulo: etapa.rotulo,
                  })),
                ]}
              />
            </>
          )}
        </label>
      )}

      {no.type === 'etiqueta' && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Etiqueta no contato
            <AjudaDoCampo
              titulo="Etiqueta no contato"
              secao="blocos"
              texto="Qual etiqueta o contato recebe ao passar por aqui. Ele pode ter várias ao mesmo tempo."
              detalhes={
                <>
                  <p>
                    Etiqueta é o que a pessoa <strong>é</strong>: “quer pilates”, “já é aluno”. Ela
                    pode ter várias ao mesmo tempo, e é por elas que se filtra a lista de contatos
                    depois.
                  </p>
                  <p>
                    Vale o mesmo que pôr a etiqueta à mão no Inbox, inclusive começar a sequência
                    que ela dispara. Quem já tem a etiqueta não a recebe duas vezes.
                  </p>
                </>
              }
            />
          </span>
          {etiquetas.length === 0 ? (
            <span className="block rounded-lg border border-dashed border-strong px-3 py-3 text-[11.5px] leading-5 text-dim">
              Este cliente ainda não tem etiqueta nenhuma. Crie uma em Ajustes → Etiquetas, sem
              etiqueta para escolher, este bloco não tem o que fazer.
            </span>
          ) : (
            <>
              <Dropdown
                valor={no.data.etiquetaId}
                aoMudar={(etiquetaId) => aoMudarDados({ etiquetaId })}
                rotuloAcessivel="Etiqueta"
                opcoes={[
                  { valor: '', rotulo: 'Nenhuma, o bloco não faz nada' },
                  ...etiquetas.map((e) => ({ valor: e.id, rotulo: e.nome })),
                ]}
              />
            </>
          )}
        </label>
      )}

      {no.type === 'nota' && (
        <>
          {/*
            `formatavel` fica de fora, e é decisão e não esquecimento: a
            anotação **não** vira mensagem no WhatsApp. Oferecer a barra de
            negrito aqui ensinaria a escrever `*isto*` num campo que ninguém
            renderiza, o asterisco apareceria literal para quem lê a ficha.
          */}
          <Area
            rotulo="Anotação"
            valor={no.data.texto}
            limite={LIMITE_DA_NOTA}
            aoMudar={(texto) => aoMudarDados({ texto })}
            conhecidas={variaveis}
            exemplo="pediu {{servico}} para {{dia}}"
            secao="blocos"
            dica="Vai para a anotação da ficha e acrescenta, nunca apaga o que já estava lá."
            detalhes={
              <>
                <p>
                  Vai para a anotação da ficha, onde a equipe escreve, e <strong>acrescenta</strong>
                  , nunca apaga o que já estava lá.
                </p>
                <p>
                  Ninguém do outro lado da conversa lê isto. Por isso o campo não tem barra de
                  negrito: um <code>*isto*</code> apareceria com os asteriscos para quem lê a ficha.
                </p>
              </>
            }
          />
        </>
      )}

      {no.type === 'nps' && (
        <>
          <Area
            rotulo="A pergunta da nota"
            valor={no.data.texto}
            limite={LIMITE_TEXTO}
            aoMudar={(texto) => aoMudarDados({ texto })}
            conhecidas={variaveis}
            formatavel
            secao="blocos"
            dica="A resposta esperada é um número de 0 a 10. O bloco entende “8”, “8/10” e “nota 8”."
            detalhes={
              <>
                <p>
                  A resposta esperada é um número de <strong>0 a 10</strong>. O bloco entende “8”,
                  “8/10” e “nota 8”, e pede de novo quando não vier número nenhum.
                </p>
                <p>
                  Ele separa sozinho, na régua do NPS: <strong>9 e 10 promotor</strong>,{' '}
                  <strong>7 e 8 neutro</strong>, <strong>0 a 6 detrator</strong>. Cada faixa tem a
                  sua saída, e é o 7 que costuma surpreender, “quase dez” parece bom e conta como
                  neutro.
                </p>
                <p>A nota é guardada com a data, sempre: a de hoje não apaga a do mês passado.</p>
              </>
            }
          />

          {/*
            A régua escrita, porque ela é fixa e ninguém a vê no desenho.

            As três saídas saem iguais do bloco; sem esta linha, descobrir onde
            a nota 7 cai exigiria testar. E é justamente o 7 que surpreende
            quem nunca leu sobre NPS, "quase dez" parece bom e conta como
            neutro.
          */}
          <CampoDeVariavel
            rotulo="Guardar a nota em"
            valor={no.data.salvarEm ?? ''}
            variaveis={deOutrosBlocos}
            modo="guarda"
            secao="variaveis"
            dica="Ex.: nota, para escrever “obrigado pelo {{nota}}” no bloco seguinte."
            nota={
              <p>
                Opcional. A nota vai para o relatório de qualquer jeito; isto serve só para os
                blocos seguintes poderem citá-la.
              </p>
            }
            aoMudar={(v) => aoMudarDados({ salvarEm: v.trim() === '' ? undefined : v.trim() })}
          />

          <Area
            rotulo="Perguntar o motivo depois (opcional)"
            valor={no.data.perguntaAberta}
            limite={LIMITE_TEXTO}
            aoMudar={(perguntaAberta) => aoMudarDados({ perguntaAberta })}
            conhecidas={variaveis}
            formatavel
            exemplo="O que faltou para ser uma boa experiência?"
            secao="blocos"
            dica="Vazio, a pesquisa acaba na nota, e é a que mais gente responde até o fim."
            detalhes={
              <>
                <p>
                  Vazio, a pesquisa acaba na nota, e é a que mais gente responde até o fim. Com
                  texto, o bloco faz esta segunda pergunta <strong>antes</strong> de seguir pela
                  faixa da nota.
                </p>
                <p>
                  A nota já está guardada quando esta pergunta sai: quem responder o número e sumir
                  continua contando no relatório.
                </p>
              </>
            }
          />

          {no.data.perguntaAberta.trim() !== '' && (
            <CampoDeVariavel
              rotulo="Guardar o motivo em"
              valor={no.data.comentarioEm ?? ''}
              variaveis={deOutrosBlocos}
              modo="guarda"
              secao="variaveis"
              dica="Ex.: motivo, para repetir o que a pessoa escreveu."
              aoMudar={(v) =>
                aoMudarDados({
                  comentarioEm: v.trim() === '' ? undefined : v.trim(),
                })
              }
            />
          )}

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Prazo para responder
              <AjudaDoCampo
                titulo="Prazo para responder"
                secao="blocos"
                texto="Quanto tempo esperar pela nota antes de sair pela saída “não respondeu”."
                detalhes={
                  <p>
                    Pesquisa sem resposta <strong>encerra</strong>, e não chama ninguém: quem
                    ignorou uma pesquisa não vira fila de atendimento. É o desfecho oposto ao da
                    Pergunta, de propósito, pôr na fila quem só ignorou uma pesquisa enche de dívida
                    falsa a tela onde o time vê o que deve.
                  </p>
                }
              />
            </span>
            <Dropdown
              valor={String(no.data.timeoutMinutos ?? 0)}
              aoMudar={(v) =>
                aoMudarDados({
                  timeoutMinutos: Number(v) === 0 ? undefined : Number(v),
                })
              }
              rotuloAcessivel="Prazo para responder"
              opcoes={PRAZOS}
            />
            {/*
              O texto diz o desfecho **oposto** ao da pergunta, e de propósito:
              pesquisa sem resposta encerra em vez de chamar uma pessoa. Quem
              leu a explicação da pergunta vai supor a fila se a gente não
              disser, e pôr na fila quem só ignorou uma pesquisa enche de
              dívida falsa a tela onde o time vê o que deve.
            */}
            <span className="mt-1.5 block text-[11px] leading-4 text-dim">
              {no.data.timeoutMinutos
                ? 'Passado o prazo, a conversa sai pela saída “não respondeu”. Sem nada ligado nela, a conversa encerra, quem ignorou uma pesquisa não vira fila de atendimento.'
                : 'Sem prazo, a conversa espera para sempre pela nota.'}
            </span>
          </label>
        </>
      )}

      {no.type === 'ir-fluxo' && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Continuar em qual automação
            <AjudaDoCampo
              titulo="Continuar em qual automação"
              secao="blocos"
              texto="Para qual outra automação da conta a conversa vai. Ela não volta para esta."
              detalhes={
                <>
                  <p>
                    A conversa continua na versão publicada da outra automação, do começo, e{' '}
                    <strong>não volta</strong>. O que já foi guardado (nome, assunto, tudo) vai
                    junto.
                  </p>
                  <p>
                    A lista avisa o que está errado antes de você escolher: automação nunca
                    publicada não tem o que executar, e desligada manda quem chegar lá para uma
                    pessoa.
                  </p>
                </>
              }
            />
          </span>
          {fluxos.length === 0 ? (
            <span className="block rounded-lg border border-dashed border-strong px-3 py-3 text-[11.5px] leading-5 text-dim">
              Esta conta ainda não tem automação para escolher. Crie outra em Automações, sem um
              destino, este bloco não tem para onde mandar a conversa.
            </span>
          ) : (
            <>
              <Dropdown
                valor={no.data.fluxoId}
                aoMudar={(fluxoId) => {
                  const escolhido = fluxos.find((f) => f.id === fluxoId)
                  // `rotulo` viaja junto pelo mesmo motivo do bloco de etapa: o
                  // desenho precisa dizer alguma coisa, e um uuid não diz. Quem
                  // manda é `fluxoId`, o motor e o `validar()` ignoram o rótulo.
                  aoMudarDados({ fluxoId, rotulo: escolhido?.nome ?? '' })
                }}
                rotuloAcessivel="Automação de destino"
                opcoes={[
                  { valor: '', rotulo: 'Nenhuma, a conversa pararia aqui' },
                  ...fluxos.map((f) => ({
                    valor: f.id,
                    rotulo: f.nome,
                    // O estado entra no próprio item: escolher e só depois
                    // descobrir na lista de impedimentos que o destino não
                    // publica é o caminho longo para a mesma informação.
                    detalhe: !f.publicado
                      ? 'nunca publicada, não há o que executar lá'
                      : !f.ativo
                        ? 'desligada, quem chegar aqui vai para uma pessoa'
                        : undefined,
                  })),
                ]}
              />
            </>
          )}
        </label>
      )}

      {/*
        O bloco de Voltar.
        Ver `noVoltarSchema` para por que ele existe ao lado da seta.
      */}
      {no.type === 'voltar' && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Voltar para qual passo
            <AjudaDoCampo
              titulo="Voltar para qual passo"
              secao="blocos"
              texto="De onde a conversa continua. O que já foi guardado não é apagado."
              detalhes={
                <>
                  <p>
                    A conversa continua a partir do bloco escolhido, neste mesmo fluxo. O que já foi
                    guardado <strong>não é apagado</strong>: quem voltou ao menu depois de dizer o
                    nome não quer dizer o nome de novo.
                  </p>
                  <p>
                    A lista mostra o texto que está escrito no desenho, e não o tipo nem o id , você
                    está procurando “Podemos ajudar em algo mais?”, que é o que se lê na tela.
                  </p>
                </>
              }
            />
          </span>
          <Dropdown
            valor={no.data.destino}
            aoMudar={(destino) => {
              const alvo = blocos.find((b) => b.id === destino)
              // `rotulo` viaja junto pelo mesmo motivo do bloco de etapa e do
              // de ir-fluxo: o desenho precisa dizer alguma coisa, e um uuid
              // não diz. Quem manda é `destino`.
              aoMudarDados({
                destino,
                rotulo: alvo ? resumoDoBloco(alvo) : '',
              })
            }}
            rotuloAcessivel="Bloco de destino"
            opcoes={[
              {
                valor: '',
                rotulo: 'O início do fluxo',
                detalhe: 'o "voltar ao menu" de sempre',
              },
              ...blocos
                // O próprio bloco fora da lista: voltar para si mesmo é um
                // ciclo sem nada no meio, e ele gira até o motor desistir e
                // chamar uma pessoa.
                .filter((b) => b.id !== no.id)
                .map((b) => ({
                  valor: b.id,
                  rotulo: resumoDoBloco(b),
                  detalhe: NOMES[b.type],
                })),
            ]}
          />
        </label>
      )}

      {no.type === 'ia' && (
        <>
          {/*
            O aviso do plano vem **primeiro e só quando é verdade**.
            
            Antes ele era o último parágrafo do card e aparecia sempre, inclusive
            para quem tinha contratado, um aviso que mente metade das vezes é um
            aviso que ninguém lê na vez em que importa. E ele vem no topo porque
            muda se o que está abaixo vale alguma coisa.
          */}
          {!iaHabilitada && (
            <p className="rounded-[10px] border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-aviso">
              Este cliente ainda não tem IA contratada. Dá para desenhar e salvar, mas na conversa
              real o bloco passa direto para uma pessoa.
            </p>
          )}

          {/*
            O que o bloco é foi para o “?” ao lado do nome dele, no topo do
            painel: era um cartão de texto que empurrava o primeiro campo para
            fora da vista logo na abertura. Ver `AJUDA_DO_BLOCO`.
          */}
          <Area
            conhecidas={variaveis}
            rotulo="Instrução para a IA"
            valor={no.data.instrucao}
            aoMudar={(instrucao) => aoMudarDados({ instrucao })}
            secao="blocos"
            dica="O que a IA deve fazer nesta conversa, escrito como se fosse para uma pessoa nova no time."
            detalhes={
              <>
                <p>
                  Escreva o papel e os limites: quem ela é, o que pode responder, e o que fazer
                  quando não souber. Ela já tem o contexto do negócio da conta; aqui vai o que é
                  específico <strong>deste ponto do fluxo</strong>.
                </p>
                <p>
                  Aceita <code>{'{{variavel}}'}</code>, então dá para passar o que a conversa já
                  guardou. Não tem barra de negrito de propósito: a instrução não vira mensagem no
                  WhatsApp, e o asterisco só confundiria o modelo.
                </p>
              </>
            }
          />

          {/*
            As consultas vêm **antes** de "guardar resposta em", e isso inverte a
            ordem antiga de propósito: o que a IA pode consultar muda o que se
            escreve na instrução, então as duas coisas se decidem juntas. Guardar
            a resposta é opcional e avançado, e estava separando as duas.
          */}
          <ConsultasDaIa
            // `?? []` porque um bloco recém-arrastado ainda não passou pelo
            // Zod: o `default([])` do schema só age ao salvar o rascunho.
            escolhidas={no.data.ferramentas ?? []}
            conexaoId={no.data.conexaoId ?? ''}
            conexoes={conexoes}
            clienteId={clienteId}
            aoMudar={aoMudarDados}
          />

          <CampoDeVariavel
            rotulo="Guardar resposta em"
            secao="variaveis"
            valor={no.data.salvarEm ?? ''}
            variaveis={deOutrosBlocos}
            modo="guarda"
            dica="Opcional. Só se outro bloco precisar usar o que a IA respondeu."
            aoMudar={(v) => aoMudarDados({ salvarEm: v.trim() === '' ? undefined : v.trim() })}
          />
        </>
      )}

      {no.type === 'handoff' && (
        <>
          {/*
            **O bloco conta o que ele já faz sozinho.**

            Transferir para uma pessoa às 3h da manhã é prometer uma coisa que
            ninguém cumpre até de manhã, e o motor já resolve isso: fora do
            expediente ele acrescenta um aviso com a hora de voltar, depois das
            mensagens escritas aqui. Ver `avisoDeForaDoHorario`.

            Isso não aparecia em lugar nenhum, e o resultado foi um cliente
            pedindo o recurso que já existia e se oferecendo para montar uma
            condição na mão. Ele mesmo escreveu que parecia "um passo extra".
            Estava certo: era um passo extra para refazer o que o produto já
            fazia de graça.

            Quando a conta está sem horário, o aviso muda de tom e vira o
            caminho: sem horário preenchido a conta é sempre aberta, e nada
            disto acontece.
          */}
          <div
            className={`rounded-[10px] border px-3 py-2.5 text-[11.5px] leading-[1.6] ${
              horarioConfigurado
                ? 'border-line bg-white/[0.02] text-dim'
                : 'border-amber-400/25 bg-amber-400/[0.06] text-muted'
            }`}
          >
            {horarioConfigurado ? (
              <>
                Fora do horário de atendimento, este bloco manda sozinho um aviso com a hora de
                voltar, depois das mensagens acima. Não precisa de condição.
              </>
            ) : (
              <>
                <strong className="text-aviso">Esta conta está como sempre aberta.</strong> Com um
                horário preenchido, este bloco passa a avisar sozinho quem escrever fora do
                expediente, dizendo quando vocês voltam.{' '}
                {clienteId && (
                  <a
                    href={`/clientes/${clienteId}/ajustes/horario`}
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Preencher o horário
                  </a>
                )}
              </>
            )}
          </div>
          <MensagensDoHandoff
            mensagens={mensagensDoHandoff(no)}
            conhecidas={variaveis}
            aoMudar={(mensagens) => aoMudarDados({ mensagens })}
          />
          <Linha
            rotulo="Motivo (interno)"
            valor={no.data.motivo}
            secao="blocos"
            dica="Aparece no painel de quem atende. Aceita {{variavel}}."
            detalhes={
              <p>
                É o que a equipe lê ao receber a conversa, para saber do que se trata antes de
                abrir. <strong>Não vai para o WhatsApp</strong>, escreva para quem atende, não para
                quem está do outro lado.
              </p>
            }
            aoMudar={(motivo) => aoMudarDados({ motivo })}
            aceitaVariavel
            conhecidas={variaveis}
          />
          {/*
            **Avisar a equipe toda é o padrão, e continua sendo o certo na
            maioria dos handoffs**: quem estiver disponível pega. Escolher uma
            pessoa é para quando o bloco já sabe de quem é o assunto ,
            "cancelamento é com o dono", "orçamento acima de X é com a Marina".

            Só aparece com mais de uma pessoa na conta: num time de um, o campo
            ofereceria uma escolha que não existe.
          */}
          {equipe.length > 1 && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
                Avisar quem
                <AjudaDoCampo
                  titulo="Avisar quem"
                  secao="blocos"
                  texto="A equipe toda, ou uma pessoa específica quando o bloco já sabe de quem é o assunto."
                  alinhar="direita"
                  detalhes={
                    <p>
                      Avisar a equipe toda é o padrão, e continua sendo o certo na maioria dos
                      handoffs: quem estiver disponível pega. Escolher uma pessoa é para quando o
                      bloco já sabe de quem é o assunto, “cancelamento é com o dono”, “orçamento
                      acima de X é com a Marina”.
                    </p>
                  }
                />
              </span>
              <Dropdown
                valor={no.data.avisarUsuarioId ?? ''}
                aoMudar={(v) => aoMudarDados({ avisarUsuarioId: v === '' ? undefined : v })}
                rotuloAcessivel="Quem recebe o aviso deste handoff"
                opcoes={[
                  {
                    valor: '',
                    rotulo: 'a equipe',
                    detalhe: 'quem estiver disponível',
                  },
                  ...equipe.map((membro) => ({
                    valor: membro.id,
                    rotulo: membro.nome,
                  })),
                ]}
              />
              <span className="mt-1.5 block text-[11px] leading-4 text-dim">
                {no.data.avisarUsuarioId
                  ? 'Se essa pessoa sair da conta ou estiver ausente, o aviso volta a ser da equipe, aviso endereçado a quem não está é aviso que ninguém recebe.'
                  : 'Todo mundo que estiver disponível recebe, respeitando o horário de atendimento.'}
              </span>
            </label>
          )}
        </>
      )}

      {no.type === 'http' && (
        <>
          {/*
            Preset, e não tipo de nó novo (§3.11).
            
            Ele preenche os campos abaixo **uma vez** e some do caminho: o que
            fica gravado no fluxo é o bloco resolvido, não uma referência viva.
            Se fosse referência, mudar o endereço da RD amanhã mudaria por baixo
            o que uma conversa em andamento vai chamar, e versão publicada é
            imutável aqui também.
          */}
          <PresetsDeIntegracao
            aoAplicar={aoMudarDados}
            bloco={{
              metodo: no.data.metodo,
              url: no.data.url,
              // O mapeamento desempata os presets que dividem o mesmo endereço.
              mapear: no.data.mapear,
              temCredencial: (no.data.conexaoId ?? '') !== '',
            }}
            semCredenciais={conexoes.length === 0}
          />

          {/*
            A pergunta que travou quem montou o primeiro fluxo de agendamento,
            *"ele consegue ser o primeiro bloco? ele já reconhece com quem
            estou falando pelo número?"*, é respondida no “?” ao lado do nome
            do bloco. Ver `AJUDA_DO_BLOCO`.
          */}
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Método
              <AjudaDoCampo
                titulo="Método"
                secao="outros-sistemas"
                texto="GET consulta o sistema e traz a resposta. POST entrega a ele o que a conversa coletou."
                detalhes={
                  <>
                    <p>
                      <strong>GET</strong> é consultar: pergunta alguma coisa ao sistema e traz a
                      resposta para a conversa, os horários livres, o cadastro de quem está falando.
                    </p>
                    <p>
                      <strong>POST</strong> é mandar: entrega ao sistema o que a conversa coletou ,
                      um pedido, um agendamento, um cadastro. Quem fez o sistema diz qual dos dois
                      aquele endereço espera.
                    </p>
                  </>
                }
              />
            </span>
            <Dropdown
              valor={no.data.metodo}
              aoMudar={(metodo) => aoMudarDados({ metodo })}
              rotuloAcessivel="Método HTTP"
              opcoes={METODOS.map((metodo) => ({
                valor: metodo,
                rotulo: metodo,
                detalhe: METODO_EM_PORTUGUES[metodo],
              }))}
            />
            <span className="mt-1.5 block text-[11px] leading-4 text-dim">
              {no.data.metodo === 'GET'
                ? 'Consultar: pergunta alguma coisa ao sistema e traz a resposta para a conversa.'
                : 'Mandar: entrega ao sistema o que a conversa coletou, um pedido, um agendamento, um cadastro.'}
            </span>
          </label>

          <Linha
            rotulo="Endereço"
            valor={no.data.url}
            dica="O link que quem fez o sistema te passou. Começa com https://"
            secao="outros-sistemas"
            detalhes={
              <>
                <p>
                  É o endereço que quem fez o sistema passou, e ele vem de lá pronto, não há como
                  descobri-lo pela tela. Começa com <code>https://</code>.
                </p>
                <p>
                  Aceita <code>{'{{variavel}}'}</code> no meio, então dá para montar endereços como{' '}
                  <code>{'https://api.exemplo.com/alunos/{{aluno_id}}'}</code>.
                </p>
              </>
            }
            aoMudar={(url) => aoMudarDados({ url })}
            aceitaVariavel
            conhecidas={variaveis}
          />

          {no.data.metodo === 'POST' && (
            <Area
              conhecidas={variaveis}
              rotulo="O que mandar para o sistema"
              valor={no.data.corpo}
              aoMudar={(corpo) => aoMudarDados({ corpo })}
              exemplo={'{\n  "nome": "{{nome}}",\n  "telefone": "{{telefone}}"\n}'}
              secao="outros-sistemas"
              dica="Os dados que a conversa já tem, no formato que o seu sistema espera."
              detalhes={
                <>
                  <p>
                    Quem faz o sistema diz quais campos ele quer e como se chamam. Aqui você monta
                    esse pacote com o que a conversa já guardou.
                  </p>
                  <p>
                    Cada valor entre aspas, <strong>e as variáveis também</strong>:{' '}
                    <code>{'"telefone": "{{telefone}}"'}</code>, nunca{' '}
                    <code>{'"telefone": {{telefone}}'}</code>.
                  </p>
                </>
              }
            />
          )}

          <Mapeamentos mapear={no.data.mapear} aoMudar={(mapear) => aoMudarDados({ mapear })} />

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Credencial
              <AjudaDoCampo
                titulo="Credencial"
                secao="outros-sistemas"
                texto="A chave que o endereço pede, guardada no cofre. Muitos endereços não pedem nenhuma."
                alinhar="direita"
                detalhes={
                  <>
                    <p>
                      Credencial é a chave que prova ao sistema do outro lado que o pedido é seu.
                      Nem todo endereço pede uma: se ninguém te deu chave nenhuma, deixe em
                      “Nenhuma” e o bloco já está pronto.
                    </p>
                    <p>
                      O valor fica no cofre, e o fluxo guarda só a referência. Por isso trocar a
                      chave depois <strong>não exige republicar</strong>, e por isso a chave nunca
                      deve ser digitada num cabeçalho, onde ela ficaria gravada na versão publicada.
                    </p>
                  </>
                }
              />
            </span>

            {/*
              Sem nenhuma cadastrada, o campo virava um beco, e foi assim que
              ele foi encontrado, montando o primeiro fluxo de agendamento.

              O que havia aqui era um dropdown de uma opção só, "Nenhuma, o
              endereço não pede chave", com a integração pronta logo acima
              mandando escolher a credencial abaixo. Quem lê a única opção lê
              uma afirmação, não uma escolha: *"nenhum endereço pede chave; mas
              se nenhum pede, por que ele pede pra escolher credencial?"*. O
              bloco de IA já tinha ganhado este mesmo aviso com o link, este
              aqui não, e é o bloco por onde todo fluxo de agenda começa.
            */}
            {/*
              A caixa substitui o campo, **menos** quando o bloco já aponta para
              uma credencial: aí a lista está vazia porque a credencial escolhida
              foi apagada, e esconder o campo tiraria o único jeito de desfazer a
              escolha, o `validar()` recusaria publicar e a tela não ofereceria
              saída nenhuma.
            */}
            {conexoes.length === 0 && !no.data.conexaoId ? (
              <p className="rounded-[10px] border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-aviso">
                Este cliente ainda não tem credencial cadastrada. Se o endereço acima pedir chave,
                cadastre em{' '}
                <a
                  className="underline underline-offset-2 hover:text-aviso"
                  href={`/clientes/${clienteId}/ajustes/chaves`}
                >
                  Credenciais
                </a>{' '}
                e volte aqui para escolher. Se ele não pedir nada, o bloco já está pronto, não há o
                que preencher.
              </p>
            ) : (
              <>
                <Dropdown
                  valor={no.data.conexaoId ?? ''}
                  aoMudar={(conexaoId) =>
                    aoMudarDados({
                      conexaoId: conexaoId === '' ? undefined : conexaoId,
                    })
                  }
                  rotuloAcessivel="Credencial"
                  opcoes={[
                    { valor: '', rotulo: 'Nenhuma, o endereço não pede chave' },
                    ...conexoes.map((conexao) => ({
                      valor: conexao.id,
                      rotulo: conexao.nome,
                    })),
                  ]}
                />
              </>
            )}
          </label>

          {/*
            Cabeçalhos e "se falhar", recolhidos.

            Os dois são de quem já sabe. Cabeçalho é quase sempre vazio (o
            próprio texto do campo diz isso), e "se falhar" tem um padrão que
            serve à esmagadora maioria dos blocos: passar para uma pessoa. Na
            frente, eles empurravam para fora da vista os três campos que
            realmente se preenchem , endereço, credencial e o que guardar.

            Cabeçalhos desceu para cá do meio do formulário, onde ficava entre o
            corpo e o "guardar da resposta". A ajuda da Credencial deixou de
            dizer "logo abaixo" por causa disso.
          */}
          <SecaoAvancada
            resumo="cabeçalhos, o que fazer se falhar"
            temConteudo={no.data.cabecalhos.length > 0 || no.data.aoFalhar !== 'humano'}
          >
            <Cabecalhos
              cabecalhos={no.data.cabecalhos}
              conhecidas={variaveis}
              aoMudar={(cabecalhos) => aoMudarDados({ cabecalhos })}
            />

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
                Se falhar
                <AjudaDoCampo
                  titulo="Se falhar"
                  secao="erros"
                  texto="O que fazer quando o sistema do outro lado não responde, ou responde erro."
                  detalhes={
                    <>
                      <p>
                        <strong>Passa para uma pessoa</strong> é o certo quando a conversa depende
                        da resposta: sem os horários livres não há menu para mostrar, e seguir em
                        frente só produziria uma mensagem vazia.
                      </p>
                      <p>
                        <strong>Continua a conversa mesmo assim</strong> serve quando a chamada é um
                        extra, registrar o lead num CRM, por exemplo. O que o bloco guardaria fica
                        vazio, e os blocos seguintes precisam aguentar isso.
                      </p>
                    </>
                  }
                />
              </span>
              <Dropdown
                valor={no.data.aoFalhar}
                aoMudar={(aoFalhar) => aoMudarDados({ aoFalhar })}
                rotuloAcessivel="Se falhar"
                opcoes={[
                  { valor: 'humano', rotulo: 'passa para uma pessoa' },
                  {
                    valor: 'seguir',
                    rotulo: 'continua a conversa mesmo assim',
                  },
                ]}
              />
            </label>
          </SecaoAvancada>
        </>
      )}
    </div>
  )
}

/**
 * Os valores que a variável desta condição pode ter, clicáveis.
 *
 * Quando ela vem de uma pergunta com botões, a lista de valores possíveis é
 * fechada e conhecida: são os rótulos dos botões. Cobrar que alguém digite
 * "Agendar aula" de memória é criar um erro que **não estoura em lugar
 * nenhum**: a comparação falha calada, todo mundo desce pelo ramo errado, e o
 * desenho na tela continua parecendo certo.
 *
 * Some sozinho quando não há o que oferecer (variável de resposta livre, ou
 * opções que só existem durante a conversa).
 */
function ValoresConhecidos({
  valores,
  escolhido,
  aoEscolher,
}: {
  valores: string[]
  escolhido: string
  aoEscolher: (valor: string) => void
}) {
  if (valores.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10.5px] text-dim">a pergunta oferece:</span>
      {valores.map((valor) => {
        const igual = valor === escolhido
        return (
          <button
            key={valor}
            type="button"
            onClick={() => aoEscolher(valor)}
            title={igual ? 'é o valor deste ramo' : `usar “${valor}”`}
            className={`max-w-full truncate rounded-lg border px-2 py-0.5 text-[11px] transition ${
              igual
                ? 'border-primary/40 bg-primary/[0.12] text-primary'
                : 'border-line text-muted hover:border-primary/40 hover:text-primary'
            }`}
          >
            {valor}
          </button>
        )
      })}
    </div>
  )
}

/**
 * As mensagens que o bloco de "falar com humano" manda antes de transferir.
 *
 * O bloco sempre foi a última fala do bot, e por muito tempo essa fala foi uma
 * frase só, "vou te passar para um atendente". Quem monta fluxo pediu o que
 * faltava: agradecer e pedir uma avaliação do atendimento **do bot**, que é
 * outra frase e não cabe grudada no aviso. Bloco de mensagem depois deste não
 * resolve, porque a transferência acontece aqui: o que vier depois já chega com
 * a conversa nas mãos do time.
 *
 * Por isso a lista mora dentro do card: continua sendo um encerramento só, com
 * as falas na ordem em que saem.
 */
function MensagensDoHandoff({
  mensagens,
  conhecidas,
  aoMudar,
}: {
  mensagens: string[]
  conhecidas: string[]
  aoMudar: (mensagens: string[]) => void
}) {
  const trocar = (i: number, texto: string) =>
    aoMudar(mensagens.map((m, j) => (j === i ? texto : m)))

  return (
    <div className="space-y-3">
      {mensagens.map((mensagem, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              {i === 0 ? 'Mensagem antes de passar' : `Mensagem ${i + 1}`}
              {i === 0 && (
                <AjudaDoCampo
                  titulo="Mensagem antes de passar"
                  secao="blocos"
                  texto="A última fala do bot. Saem em ordem, e só depois a conversa passa para uma pessoa."
                  detalhes={
                    <>
                      <p>
                        Saem em ordem, uma atrás da outra, e só depois a conversa passa para uma
                        pessoa. É o lugar do “obrigado” e do pedido de avaliação do atendimento do
                        bot.
                      </p>
                      <p>
                        Um bloco de Mensagem depois deste não resolve o mesmo: a transferência
                        acontece aqui, e o que vier depois já chega com a conversa nas mãos do time.
                      </p>
                      <p>
                        O teto é {LIMITE_MENSAGENS_HANDOFF}, porque cada uma vira uma notificação no
                        celular de quem já está esperando alguém responder.
                      </p>
                    </>
                  }
                />
              )}
            </span>
            {mensagens.length > 1 && (
              <button
                type="button"
                onClick={() => aoMudar(mensagens.filter((_, j) => j !== i))}
                title="remover esta mensagem"
                className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-perigo"
              >
                Remover
              </button>
            )}
          </div>
          <Area
            conhecidas={conhecidas}
            rotulo=""
            valor={mensagem}
            limite={LIMITE_TEXTO}
            aoMudar={(texto) => trocar(i, texto)}
            formatavel
          />
        </div>
      ))}

      {mensagens.length < LIMITE_MENSAGENS_HANDOFF ? (
        <button
          type="button"
          onClick={() => aoMudar([...mensagens, ''])}
          className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-[11.5px] text-muted transition hover:border-primary/40 hover:text-primary"
        >
          + outra mensagem antes de transferir
        </button>
      ) : (
        <p className="text-[10.5px] leading-4 text-dim">
          {LIMITE_MENSAGENS_HANDOFF} é o teto: cada uma vira uma notificação no celular de quem já
          está esperando alguém responder.
        </p>
      )}
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  dica,
  detalhes,
  secao,
  aoMudar,
  aceitaVariavel = false,
  conhecidas,
}: {
  rotulo: string
  valor: string
  /** A frase curta do balão do “?”. Era o parágrafo cinza embaixo do campo. */
  dica?: string
  /** A explicação com exemplo, no modal do “?”. */
  detalhes?: ReactNode
  /** A seção de `/ajuda` para o rodapé do modal. */
  secao?: string
  aoMudar: (valor: string) => void
  aceitaVariavel?: boolean
  /** Para o realce distinguir variável conhecida de erro de digitação. */
  conhecidas?: string[]
}) {
  // Sem `<label>` envolvendo quando há realce: o campo real fica por cima de um
  // espelho, e o clique do `<label>` no espelho moveria o cursor para o fim.
  const Moldura = aceitaVariavel ? 'div' : 'label'

  return (
    <Moldura className="block">
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
        {rotulo}
        {dica && <AjudaDoCampo texto={dica} detalhes={detalhes} secao={secao} titulo={rotulo} />}
      </span>
      {aceitaVariavel ? (
        <LinhaComVariaveis
          valor={valor}
          aoMudar={aoMudar}
          conhecidas={conhecidas}
          variaveis={conhecidas ?? []}
        />
      ) : (
        <input
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className="app-field px-3 py-2.5 text-[13px]"
        />
      )}
      {/*
        Só o aviso fica embaixo: `{{preco}}` que nenhum bloco preenche, ou a
        chave simples que sai escrita na conversa. A explicação do campo subiu
        para o “?”, o aviso não pode subir junto, porque ele fala do que está
        digitado agora.
      */}
      {aceitaVariavel && <LegendaDeVariaveis valor={valor} conhecidas={conhecidas} semPadrao />}
    </Moldura>
  )
}

/**
 * `limite` não corta o que a pessoa digita, mostra. Cortar no meio de uma frase
 * enquanto alguém escreve é pior do que deixar passar: o validador barra a
 * publicação, e é lá que a recusa vale.
 */
function Area({
  rotulo,
  valor,
  limite,
  aoMudar,
  conhecidas,
  formatavel = false,
  dica,
  detalhes,
  secao,
  exemplo,
}: {
  rotulo: string
  valor: string
  limite?: number
  aoMudar: (valor: string) => void
  /**
   * A frase curta do balão do “?”. Era o parágrafo embaixo do campo, que
   * empurrava o campo seguinte para fora da vista.
   */
  dica?: string
  /** A explicação com exemplo, no modal do “?”. */
  detalhes?: ReactNode
  /** A seção de `/ajuda` para o rodapé do modal. */
  secao?: string
  /** O texto cinza dentro do campo vazio: ensina o formato sem precisar ler nada. */
  exemplo?: string
  /** Para o realce distinguir variável conhecida de erro de digitação. */
  conhecidas?: string[]
  /**
   * Este texto vira mensagem no WhatsApp?
   *
   * Só quem responde sim ganha a barra de formatação. `*negrito*` num campo que
   * a Meta não renderiza, a instrução da IA, o motivo interno do handoff, não
   * fica em negrito: fica com asterisco, literal, na frente de quem lê. Oferecer
   * o botão ali seria ensinar a estragar o dado.
   */
  formatavel?: boolean
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  // `useId` e não o rótulo: "Mensagem antes de passar" tem espaço, e espaço em
  // `id` é HTML inválido, o `htmlFor` simplesmente não acha o campo.
  const id = useId()
  const estourou = limite !== undefined && valor.length > limite

  const contador =
    limite !== undefined ? (
      <span
        className={`font-mono text-[10px] normal-case ${estourou ? 'font-bold text-perigo' : 'text-dim'}`}
      >
        {valor.length}/{limite}
      </span>
    ) : null

  return (
    // Sem `<label>` quando há barra: o `<label>` põe o foco no campo a cada
    // clique dentro dele, e clicar em "negrito" passaria a mover o cursor para
    // o fim do texto antes de a marca ser aplicada.
    <div className="block">
      {/* Rótulo vazio some junto com a linha dele: quem chama assim já
          desenhou o próprio cabeçalho em cima (é o caso da lista de mensagens
          do handoff, que precisa do botão "remover" ao lado do nome). */}
      {rotulo !== '' && (
        <span className="mb-1.5 flex items-baseline text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          <label htmlFor={id}>{rotulo}</label>
          {dica && <AjudaDoCampo texto={dica} detalhes={detalhes} secao={secao} titulo={rotulo} />}
          {!formatavel && contador && <span className="ml-auto">{contador}</span>}
        </span>
      )}

      {/*
        A barra completa quando o texto vira mensagem; só o botão de variável
        quando não vira. Todo campo que interpola tem por onde inserir uma
        variável, era esse o ponto da lista que saiu do rodapé, e agora ele
        vale por campo, ao lado do que se está escrevendo.
      */}
      {formatavel ? (
        <BarraDeFormato area={area} aoMudar={aoMudar} variaveis={conhecidas}>
          {contador}
        </BarraDeFormato>
      ) : (
        conhecidas && (
          <div className="mb-1.5 flex items-center">
            <SeletorDeVariavel campo={area} variaveis={conhecidas} aoMudar={aoMudar} />
          </div>
        )
      )}

      <TextoComVariaveis
        id={id}
        area={area}
        valor={valor}
        aoMudar={aoMudar}
        erro={estourou}
        conhecidas={conhecidas}
        {...(exemplo ? { placeholder: exemplo } : {})}
      />
      {estourou ? (
        <span className="mt-1 block text-[10.5px] text-perigo">
          O WhatsApp recusa acima de {limite} caracteres, publicar fica barrado até encurtar.
        </span>
      ) : (
        <LegendaDeVariaveis valor={valor} conhecidas={conhecidas} semPadrao />
      )}
    </div>
  )
}

function Opcoes({
  opcoes,
  aoMudar,
  mostrarValor = false,
}: {
  opcoes: Opcao[]
  aoMudar: (opcoes: Opcao[]) => void
  /** Só quando a pergunta guarda o valor: campo que ninguém usa é campo que atrapalha. */
  mostrarValor?: boolean
}) {
  const cheio = opcoes.length >= LIMITE_LISTA

  return (
    <div>
      <div className="mb-1.5 flex items-baseline">
        <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          Opções
          <AjudaDoCampo
            titulo="Opções"
            secao="perguntas"
            texto="Cada opção vira um botão no WhatsApp e ganha a própria saída no bloco."
            detalhes={
              <>
                <p>
                  Cada opção tem a <strong>própria saída</strong> no bloco. Ligue todas: o validador
                  cobra, e uma saída solta é uma conversa que morre calada.
                </p>
                <p>
                  Até {LIMITE_BOTOES} opções o WhatsApp mostra como botões; acima disso vira lista
                  suspensa, e o teto dele é {LIMITE_LISTA}. Fluxo bom cabe em {LIMITE_BOTOES}{' '}
                  botões, a lista suspensa esconde as opções atrás de um toque a mais.
                </p>
                <p>
                  Sem opção nenhuma, a pessoa responde escrevendo. O contador não corta o que você
                  digita: quem recusa é a publicação.
                </p>
              </>
            }
          />
        </span>
        <span className="ml-auto font-mono text-[10px] text-dim">
          {opcoes.length}/{LIMITE_LISTA}
        </span>
      </div>

      <div className="space-y-1.5">
        {opcoes.map((opcao, i) => (
          <LinhaDeOpcao
            key={opcao.id}
            opcao={opcao}
            aoMudarRotulo={(rotulo) => {
              const copia = [...opcoes]
              copia[i] = { ...opcao, rotulo }
              aoMudar(copia)
            }}
            mostrarValor={mostrarValor}
            aoMudarValor={(valor) => {
              const copia = [...opcoes]
              copia[i] = {
                ...opcao,
                valor: valor.trim() === '' ? undefined : valor,
              }
              aoMudar(copia)
            }}
            aoRemover={() => aoMudar(opcoes.filter((o) => o.id !== opcao.id))}
          />
        ))}
      </div>

      <button
        disabled={cheio}
        onClick={() =>
          aoMudar([...opcoes, { id: crypto.randomUUID().slice(0, 8), rotulo: 'Nova opção' }])
        }
        className="mt-2 w-full rounded-lg border border-dashed border-strong py-2 text-xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
      >
        + adicionar opção
      </button>

      <p className="mt-2 text-[10.5px] leading-4 text-dim">
        {opcoes.length === 0
          ? 'Sem opções, a pessoa responde escrevendo.'
          : opcoes.length <= LIMITE_BOTOES
            ? `${opcoes.length} de até ${LIMITE_BOTOES}, o WhatsApp mostra como botões.`
            : `${opcoes.length} opções, vira lista suspensa. Fluxo bom cabe em ${LIMITE_BOTOES} botões.`}
        {cheio && ` Limite do WhatsApp é ${LIMITE_LISTA}.`}
      </p>
    </div>
  )
}

/**
 * Uma opção: o rótulo, o emoji e o contador.
 *
 * **Aqui morava o `maxLength={20}` que produziu três defeitos de uma vez.**
 * `maxLength` conta unidades UTF-16, e emoji fora do plano básico ocupa duas ,
 * então um rótulo de 19 letras recusava qualquer emoji sem dizer por quê, e
 * colar texto longo cortava no meio do par substituto. O pedaço solto que
 * sobrava atravessava o `JSON.stringify` e **derrubava o salvamento no
 * Postgres**, que recusa `\ud83d` dentro de `jsonb`: o rascunho não gravava, e
 * ao recarregar a opção e os emojis tinham sumido.
 *
 * A troca é a mesma que o bloco de Mensagem já fazia: **contar não é cortar.**
 * O campo aceita o que a pessoa escrever, o contador mostra quanto passou, e
 * quem recusa é o validador na hora de publicar, onde a recusa vale e tem
 * explicação junto.
 *
 * O seletor de emoji entra junto porque era a outra metade do relato: sem ele,
 * a única forma de pôr um 📅 numa opção era colar do teclado do sistema.
 * Formatação não entra, rótulo de botão a Meta manda como texto puro, e o
 * asterisco apareceria literal para quem lê.
 */
function LinhaDeOpcao({
  opcao,
  aoMudarRotulo,
  aoMudarValor,
  aoRemover,
  mostrarValor = false,
}: {
  opcao: Opcao
  aoMudarRotulo: (rotulo: string) => void
  aoMudarValor: (valor: string) => void
  aoRemover: () => void
  mostrarValor?: boolean
}) {
  const campo = useRef<HTMLInputElement>(null)
  const [emojisAbertos, setEmojisAbertos] = useState(false)
  const usados = contarCaracteres(opcao.rotulo)
  const estourou = usados > LIMITE_ROTULO

  return (
    <div>
      <div className="flex items-center gap-1">
        <input
          ref={campo}
          value={opcao.rotulo}
          onChange={(e) => aoMudarRotulo(e.target.value)}
          className={`app-field min-w-0 flex-1 px-3 py-2 text-[12.5px] ${estourou ? '!border-rose-400/40' : ''}`}
        />
        <SeletorDeEmoji
          aberto={emojisAbertos}
          aoAbrir={setEmojisAbertos}
          aoEscolher={(emoji) => {
            const elemento = campo.current
            if (!elemento) return
            const de = elemento.selectionStart ?? elemento.value.length
            const ate = elemento.selectionEnd ?? elemento.value.length
            aoMudarRotulo(elemento.value.slice(0, de) + emoji + elemento.value.slice(ate))
            setEmojisAbertos(false)
            // O campo é controlado: esperar um quadro devolve foco e cursor
            // depois de o valor novo chegar ao DOM.
            requestAnimationFrame(() => {
              elemento.focus()
              const cursor = de + emoji.length
              elemento.setSelectionRange(cursor, cursor)
            })
          }}
        />
        <span
          className={`w-9 shrink-0 text-right font-mono text-[10px] ${estourou ? 'font-bold text-perigo' : 'text-dim'}`}
        >
          {usados}/{LIMITE_ROTULO}
        </span>
        <button
          onClick={aoRemover}
          title="remover opção"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-perigo"
        >
          ×
        </button>
      </div>
      {mostrarValor && (
        <div className="mt-1 flex items-center gap-1.5 pl-3">
          <span className="shrink-0 text-[10.5px] text-dim">vale</span>
          <input
            value={opcao.valor ?? ''}
            onChange={(e) => aoMudarValor(e.target.value)}
            placeholder="ex.: institucional"
            className="app-field min-w-0 flex-1 px-2.5 py-1.5 font-mono text-[11.5px]"
          />
        </div>
      )}
      {estourou && (
        <p className="mt-1 text-[10.5px] leading-4 text-perigo">
          O WhatsApp corta em {LIMITE_ROTULO} caracteres, publicar fica barrado até encurtar.
        </p>
      )}
    </div>
  )
}

function Cabecalhos({
  cabecalhos,
  aoMudar,
  conhecidas,
}: {
  cabecalhos: Cabecalho[]
  aoMudar: (c: Cabecalho[]) => void
  conhecidas?: string[]
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
        Cabeçalhos
        <AjudaDoCampo
          titulo="Cabeçalhos"
          secao="outros-sistemas"
          texto="Quase sempre vazio. Se ninguém te pediu um, deixe em branco."
          detalhes={
            <>
              <p>
                São informações extras que alguns sistemas exigem junto do pedido. Quem fez o
                sistema diz se precisa e o que escrever; se ninguém te pediu, deixe em branco.
              </p>
              <p>
                <strong>Não coloque token aqui.</strong> Publicar tira uma foto do fluxo que o banco
                se recusa a alterar, e o valor ficaria guardado nela para sempre. Chave vai no campo{' '}
                <strong>Credencial</strong>: o valor mora no cofre e o fluxo guarda só a referência.
              </p>
            </>
          }
        />
      </span>

      <div className="space-y-1.5">
        {cabecalhos.map((c, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={c.chave}
              placeholder="nome"
              onChange={(e) => {
                const copia = [...cabecalhos]
                copia[i] = { ...c, chave: e.target.value }
                aoMudar(copia)
              }}
              className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
            />
            {/* O valor do cabeçalho interpola, é onde entra `{{token}}` ,
                então ele é campo com realce e com botão de variável, como todo
                campo que aceita uma. O nome do cabeçalho não interpola. */}
            <span className="min-w-0 flex-1">
              <LinhaComVariaveis
                valor={c.valor}
                placeholder="valor"
                conhecidas={conhecidas}
                variaveis={conhecidas ?? []}
                aoMudar={(valor) => {
                  const copia = [...cabecalhos]
                  copia[i] = { ...c, valor }
                  aoMudar(copia)
                }}
              />
            </span>
            <button
              onClick={() => aoMudar(cabecalhos.filter((_, j) => j !== i))}
              title="remover cabeçalho"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-perigo"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => aoMudar([...cabecalhos, { chave: '', valor: '' }])}
        className="mt-2 w-full rounded-lg border border-dashed border-strong py-2 text-xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
      >
        + adicionar cabeçalho
      </button>
    </div>
  )
}

/**
 * Como um bloco se chama na lista de destinos do Voltar.
 *
 * É o **texto que se lê no desenho**, e não o tipo nem o id: quem escolhe para
 * onde voltar está procurando "Podemos ajudar em algo mais?", que é o que está
 * escrito na tela. Uma lista de onze uuids, ou de onze "Pergunta", não é uma
 * escolha, é um sorteio.
 *
 * Deliberadamente separada da `descrever()` do validador e da `textoDoBloco()`
 * do compartilhamento: aquelas respondem "qual bloco tem o problema" e "o que
 * mostrar numa página pública", e as três divergiriam na primeira mudança de
 * qualquer uma. Esta responde só "como escolher este numa lista".
 */
function resumoDoBloco(no: No): string {
  const curto = (texto: string) => {
    const limpo = texto.trim().replace(/\s+/g, ' ')
    return limpo.length > 42 ? `${limpo.slice(0, 42)}…` : limpo
  }

  switch (no.type) {
    case 'mensagem': {
      const texto = partesDaMensagem(no).find((parte) => parte.tipo === 'texto')?.texto ?? ''
      return curto(texto) || 'Mensagem sem texto'
    }
    case 'pergunta':
      return curto(no.data.texto) || 'Pergunta sem texto'
    case 'midia':
      return curto(no.data.legenda ?? '') || `Envia ${no.data.midia}`
    case 'condicao':
      return curto(`Se ${no.data.variavel} ${no.data.operador} ${no.data.valor}`)
    case 'salvar-campo':
      return curto(`Guarda ${no.data.campo}`)
    case 'nps':
      return curto(no.data.texto) || 'Pesquisa de satisfação'
    case 'ia':
      return curto(no.data.instrucao) || 'IA sem instrução'
    case 'handoff':
      return curto(mensagensDoHandoff(no)[0] ?? '') || 'Falar com humano'
    case 'http':
      return curto(no.data.url) || 'Serviços externos'
    case 'etapa':
      return 'Move no quadro'
    case 'etiqueta':
      return 'Põe uma etiqueta'
    case 'nota':
      return curto(no.data.texto) || 'Escreve na anotação'
    case 'ir-fluxo':
      return curto(no.data.rotulo) || 'Ir para outra automação'
    case 'voltar':
      return no.data.destino === '' ? 'Volta ao início' : 'Volta a um passo'
  }
}

function Mapeamentos({
  mapear,
  aoMudar,
}: {
  mapear: Mapeamento[]
  aoMudar: (m: Mapeamento[]) => void
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
        Guardar da resposta
        <AjudaDoCampo
          titulo="Guardar da resposta"
          secao="listas"
          texto="O sistema respondeu vários campos. Aqui se escolhe quais a conversa guarda, e com que nome."
          detalhes={
            <>
              <p>
                O sistema respondeu vários campos. Escolha quais a conversa guarda, e com que nome,
                é assim que <code>{'{{cidade}}'}</code> passa a existir nas mensagens seguintes.
              </p>
              <p>
                Os dois campos <strong>não são a mesma coisa duas vezes</strong>: o da esquerda é o
                nome que <em>você</em> escolhe e vai usar na conversa; o da direita é como a{' '}
                <em>API</em> chama aquele campo, e esse nome é de quem fez a API. Trocar os dois de
                lugar publica e nunca preenche.
              </p>
              <p>
                O caminho usa ponto e índice: <code>pedido.status</code>, <code>itens.0.nome</code>.
                O que você guardar vira coluna na tela de leads sozinho.
              </p>
              <p>
                Para percorrer uma lista inteira, use <code>[]</code>: <code>livres[].hora</code>{' '}
                guarda <code>07:00;10:00;15:00</code>, que é o formato que a Pergunta lê para virar
                menu. Um <code>[]</code> por caminho.
              </p>
            </>
          }
        />
      </span>

      {/*
        O que a seção faz mora no “?” do título.

        Quem monta fluxo chegou aqui e disse "essa parte aqui eu não entendi" ,
        e tinha razão: "Guardar da resposta" nomeia a seção mas não explica que
        o sistema respondeu um monte de campos e que aqui se escolhe **quais**
        entram na conversa. A explicação continua inteira, atrás do ícone.
      */}
      <div className="space-y-2.5">
        {mapear.map((m, i) => {
          const percorreLista = m.caminho.includes(MARCA_DE_LISTA)
          const trocar = (mudanca: Partial<Mapeamento>) => {
            const copia = [...mapear]
            copia[i] = { ...m, ...mudanca }
            aoMudar(copia)
          }

          return (
            <div key={i}>
              {/*
                O rótulo aparece **uma vez**, na primeira linha.

                Repetido em cada uma ele vira ruído: quatro campos guardados
                empilhavam quatro pares de "guardar em / campo da resposta",
                e a coluna já é a mesma nas quatro.

                Os dois campos ganharam rótulo depois de quem monta fluxo
                apontar para eles e dizer "essa parte aqui eu não entendi".

                Duas caixas do mesmo tamanho, lado a lado, com `cidade` numa e
                `localidade` na outra, não dizem qual é qual, e a diferença é
                justamente a que importa: a da esquerda é o **nome que você
                escolhe** e vai usar em `{{cidade}}` na conversa; a da direita é
                o **campo que a API devolveu**, e o nome dele é de quem fez a
                API. Trocar as duas de lugar publica e nunca preenche.

                A seta no meio é o que se lê sem ler: vem de lá, guarda aqui.
              */}
              {i === 0 && (
                <div className="mb-1 flex gap-1.5 pl-1">
                  <span className="min-w-0 flex-1 text-[9.5px] font-semibold tracking-[0.06em] text-dim/70 uppercase">
                    guardar em
                  </span>
                  <span className="min-w-0 flex-1 text-[9.5px] font-semibold tracking-[0.06em] text-dim/70 uppercase">
                    como o sistema chama
                  </span>
                  <span className="size-8 shrink-0" aria-hidden />
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <input
                  value={m.variavel}
                  placeholder="cidade"
                  aria-label="nome da variável que vai guardar o valor"
                  onChange={(e) => trocar({ variavel: e.target.value })}
                  className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
                />
                <input
                  value={m.caminho}
                  placeholder="localidade"
                  aria-label="o nome que o sistema usa para esse campo"
                  onChange={(e) => trocar({ caminho: e.target.value })}
                  className="app-field min-w-0 flex-1 px-3 py-2 font-mono text-[12.5px]"
                />
                <button
                  onClick={() => aoMudar(mapear.filter((_, j) => j !== i))}
                  title="remover"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-perigo"
                >
                  ×
                </button>
              </div>

              {/*
                A caixa só aparece quando o caminho percorre lista.

                Fora daí ela não faria nada, e uma caixa que não faz nada ensina
                a não confiar na tela. Dentro daí ela é o que separa um menu de
                dias de um menu com a mesma data quatro vezes.
              */}
              {percorreLista && (
                <>
                  {/*
                    O modelo só aparece quando o caminho para no `[]`.

                    Com um campo depois dele (`livres[].hora`) o valor de cada
                    item já está escolhido, e um modelo ali não teria de onde
                    tirar `{servico}`, oferecer o campo seria oferecer uma
                    montagem que não roda.
                  */}
                  {m.caminho.trim().endsWith(MARCA_DE_LISTA) && (
                    <div className="mt-1 pl-1">
                      <span className="mb-1 block text-[10.5px] leading-4 text-dim">
                        mostrar cada item como
                        <AjudaDoCampo
                          titulo="Mostrar cada item como"
                          secao="listas"
                          texto="O modelo de uma linha do menu. Campo entre chaves vem da resposta."
                          detalhes={
                            <p>
                              Campo entre chaves vem da resposta do sistema:{' '}
                              <code>{'{hora} · {servico}'}</code> produz{' '}
                              <code>07:00 · Pilates solo</code>. Sem modelo, o menu só mostra um
                              campo por item, que é o bastante para uma lista de horários, e pouco
                              para uma de horários com nome de aula.
                            </p>
                          }
                        />
                      </span>
                      <input
                        value={m.rotulo ?? ''}
                        placeholder="{hora} · {servico}"
                        onChange={(e) => trocar({ rotulo: e.target.value || undefined })}
                        className="app-field w-full px-3 py-1.5 font-mono text-[11.5px]"
                      />
                    </div>
                  )}

                  <div className="mt-1.5 pl-1">
                    <LinhaLigaDesliga
                      titulo="Sem repetir"
                      descricao="Cada valor aparece uma vez só no menu."
                      marcada={m.unicos ?? false}
                      aoMudar={(marcada) => trocar({ unicos: marcada || undefined })}
                      ajuda={
                        <AjudaDoCampo
                          titulo="Sem repetir"
                          secao="listas"
                          alinhar="direita"
                          texto="Cada valor aparece uma vez só. Serve para menu de dias."
                          detalhes={
                            <>
                              <p>
                                A lista de horários livres traz a mesma data várias vezes, uma por
                                horário. Para um menu de <strong>dias</strong>, isso vira “quinta,
                                quinta, quinta”. Ligando, cada valor aparece uma vez só.
                              </p>
                              <p>
                                <strong>Não ligue quando esta lista for o par de outra.</strong> O
                                casamento entre opções e valores é por posição, e tirar repetidos de
                                um lado só desalinha os dois.
                              </p>
                            </>
                          }
                        />
                      }
                    />
                  </div>

                  {/*
                    Contar em vez de listar.

                    Veio do pedido de quem opera: para o bot abrir a conversa com
                    "você tem 3 aulas para repor", ele precisa do número. Sem
                    isto a variável trazia a lista inteira e a mensagem saía com
                    as datas todas no meio da frase.
                  */}
                  {/*
                    O formato de saída.

                    A API devolve `2026-09-01` porque é assim que sistema fala
                    com sistema; quem lê no WhatsApp lê `01/09/2026`. Sem isto,
                    a única saída era pedir para o cliente mudar a API dele.
                  */}
                  {!m.quantos && (
                    <label className="mt-1 block pl-1">
                      <span className="mb-1 block text-[10.5px] leading-4 text-dim">
                        mostrar como
                        <AjudaDoCampo
                          titulo="Mostrar como"
                          secao="datas"
                          texto="Traduz o que a API devolveu para o jeito que se lê no WhatsApp."
                          detalhes={
                            <p>
                              A API devolve <code>2026-09-01</code> porque é assim que sistema fala
                              com sistema; quem lê no WhatsApp lê <code>01/09/2026</code>. Sem isto,
                              a única saída seria pedir para quem fez a API mudar a API.
                            </p>
                          }
                        />
                      </span>
                      <Dropdown
                        valor={m.formato ?? ''}
                        aoMudar={(v) =>
                          trocar({
                            formato: v === '' ? undefined : (v as FormatoDeSaida),
                          })
                        }
                        rotuloAcessivel="Formato de saída"
                        opcoes={[
                          { valor: '', rotulo: 'como veio da API' },
                          ...FORMATOS_DE_SAIDA.map((f) => ({
                            valor: f,
                            rotulo: NOME_DO_FORMATO_DE_SAIDA[f],
                            detalhe: EXEMPLO_DO_FORMATO[f],
                          })),
                        ]}
                      />
                    </label>
                  )}

                  {/*
                    Era aqui o defeito do print: um `<label>` `flex` com a
                    frase solta ao lado da caixa. Texto solto dentro de um
                    contêiner `flex` vira item anônimo, e o `<code>3</code>` no
                    meio virava um terceiro item com espaçamento de irmão , a
                    frase saía partida em três pedaços desalinhados. A linha
                    pronta resolve porque o texto passa a ser um bloco só.
                  */}
                  <div className="mt-1.5 pl-1">
                    <LinhaLigaDesliga
                      titulo="Contar quantos"
                      descricao="Guarda o número de itens da lista, e não a lista."
                      marcada={m.quantos ?? false}
                      aoMudar={(marcada) => trocar({ quantos: marcada || undefined })}
                      ajuda={
                        <AjudaDoCampo
                          titulo="Contar quantos"
                          secao="listas"
                          alinhar="direita"
                          texto="Guarda o número de itens, e não a lista inteira."
                          detalhes={
                            <p>
                              Veio do pedido de quem opera: para o bot abrir a conversa com “você
                              tem 3 aulas para repor”, ele precisa do <strong>número</strong>. Sem
                              isto a variável traz a lista inteira e a mensagem sai com as datas
                              todas no meio da frase.
                            </p>
                          }
                        />
                      }
                    />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={() => aoMudar([...mapear, { variavel: '', caminho: '' }])}
        className="mt-2 w-full rounded-lg border border-dashed border-strong py-2 text-xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
      >
        + guardar um campo
      </button>
    </div>
  )
}

/**
 * Quais consultas este bloco de IA pode fazer no sistema do cliente.
 *
 * **A tela separa ler de gravar, e essa é a decisão inteira.** Marcar "ver
 * horários" é deixar a IA saber; marcar "marcar em um horário" é deixar a IA
 * agir na agenda de alguém, sozinha, a partir do que um estranho escreveu no
 * WhatsApp. As duas caberiam na mesma lista corrida, e é justamente por caberem
 * que elas não podem, quem marca dez caixinhas seguidas não pesa a décima.
 *
 * Nada vem marcado. Bloco de IA sem consulta é o que sempre existiu, e continua
 * sendo a escolha certa para tirar dúvida sobre preço e horário de
 * funcionamento, o que já está escrito no contexto do negócio não precisa de
 * chamada nenhuma.
 */
function ConsultasDaIa({
  escolhidas,
  conexaoId,
  conexoes,
  clienteId,
  aoMudar,
}: {
  escolhidas: string[] | undefined
  conexaoId: string
  conexoes: ConexaoDoCliente[]
  clienteId: string
  aoMudar: (dados: { ferramentas?: string[]; conexaoId?: string | undefined }) => void
}) {
  /*
   * Tolera `undefined`, e isso não é paranoia, é o que já quebrou.
   *
   * Bloco arrastado agora existe só na memória do navegador, com o `data` que a
   * fábrica do editor escreveu; o `default([])` do Zod só age quando o rascunho
   * volta para o banco. Faltando o campo, `escolhidas.some()` estoura no meio
   * do render e o editor inteiro vira tela de erro, o pior desfecho possível
   * para quem estava desenhando.
   */
  const lista = escolhidas ?? []
  const marcadas = new Set(lista)
  const grava = lista.some((nome) => FERRAMENTAS.find((f) => f.nome === nome)?.escreve)

  const alternar = (nome: string, marcada: boolean) => {
    // A ordem do catálogo, e não a de clique: ela conta a conversa (catálogo,
    // horários, marcar) e o fluxo é lido por gente depois.
    const proximas = FERRAMENTAS.filter((f) =>
      f.nome === nome ? marcada : marcadas.has(f.nome),
    ).map((f) => f.nome)

    aoMudar({ ferramentas: proximas })
  }

  const grupos = [
    { titulo: 'Pode consultar', escreve: false },
    { titulo: 'Pode agir na agenda', escreve: true },
  ] as const

  return (
    <div>
      <span className="mb-1 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
        O que a IA pode fazer na Verandi
        <AjudaDoCampo
          titulo="O que a IA pode fazer na Verandi"
          secao="verandi"
          texto="Nada marcado: a IA só responde com o contexto do negócio."
          detalhes={
            <>
              <p>
                Nada vem marcado, e bloco de IA sem consulta continua sendo a escolha certa para
                tirar dúvida sobre preço e horário de funcionamento, o que já está escrito no
                contexto do negócio não precisa de chamada nenhuma.
              </p>
              <p>
                A lista separa <strong>ler</strong> de <strong>gravar</strong>, e essa é a decisão
                inteira. Marcar “ver horários” é deixar a IA saber; marcar “marcar em um horário” é
                deixar a IA agir na agenda de alguém, sozinha, a partir do que um estranho escreveu
                no WhatsApp. As duas caberiam na mesma lista corrida, e é justamente por caberem que
                não podem: quem marca dez caixinhas seguidas não pesa a décima.
              </p>
              <p>
                Antes de gravar, a IA pergunta “posso?” e espera a resposta. Ela só age sobre quem
                está conversando, e só em horários que ela mesma acabou de consultar.
              </p>
            </>
          }
        />
      </span>

      {grupos.map((grupo) => (
        <fieldset key={grupo.titulo} className="mb-2.5 last:mb-0">
          <legend className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.04em] text-muted uppercase">
            {grupo.titulo}
            {grupo.escreve && (
              <span className="rounded-full bg-amber-400/15 px-1.5 py-px text-[9.5px] font-bold tracking-normal text-aviso normal-case">
                grava de verdade
              </span>
            )}
          </legend>

          {FERRAMENTAS.filter((f) => f.escreve === grupo.escreve).map((f) => (
            <label
              key={f.nome}
              className="mb-1 flex items-center gap-2.5 rounded-[7px] px-1.5 py-1 last:mb-0 hover:bg-surface"
            >
              <Caixa
                marcada={marcadas.has(f.nome)}
                aoMudar={(marcada) => alternar(f.nome, marcada)}
              />
              <span className="text-[12.5px] leading-4">{f.rotulo}</span>
            </label>
          ))}
        </fieldset>
      ))}

      {lista.length > 0 && (
        <label className="mt-2.5 block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Credencial das consultas
            <AjudaDoCampo
              titulo="Credencial das consultas"
              secao="verandi"
              texto="A chave que a IA usa para consultar. Sem ela, a consulta volta negada e a IA diz “não sei”."
              alinhar="direita"
              detalhes={
                <p>
                  É a mesma credencial do bloco de Serviços externos: o valor fica no cofre e o
                  desenho guarda só a referência. Sem escolher uma, toda consulta volta negada e a
                  IA responde <strong>“não sei”</strong> para tudo, que é o sintoma mais difícil de
                  ligar à causa.
                </p>
              }
            />
          </span>

          {/*
            Sem credencial cadastrada, um dropdown vazio é um beco sem saída:
            a pessoa vê que falta alguma coisa e não tem como saber onde
            resolver. O link é a diferença entre um aviso e uma instrução.
          */}
          {conexoes.length === 0 ? (
            <p className="rounded-[10px] border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-aviso">
              Este cliente ainda não tem credencial cadastrada, e sem ela a consulta volta negada.
              Cadastre em{' '}
              <a
                className="underline underline-offset-2 hover:text-aviso"
                href={`/clientes/${clienteId}/ajustes/chaves`}
              >
                Credenciais
              </a>
              .
            </p>
          ) : (
            <>
              <Dropdown
                valor={conexaoId}
                aoMudar={(id) => aoMudar({ conexaoId: id === '' ? undefined : id })}
                rotuloAcessivel="Credencial das consultas da IA"
                opcoes={[
                  { valor: '', rotulo: 'Escolha uma credencial' },
                  ...conexoes.map((conexao) => ({
                    valor: conexao.id,
                    rotulo: conexao.nome,
                  })),
                ]}
              />
              <span className="mt-1 block text-[10.5px] leading-4 text-dim">
                {/*
                  Dizer o que acontece sem ela, e não só que é obrigatória: sem
                  credencial a consulta volta negada e a IA diz "não sei" para
                  tudo, que é o sintoma mais difícil de ligar à causa.
                */}
                {conexaoId === ''
                  ? 'Sem escolher, a consulta volta negada e a IA responde “não sei”.'
                  : 'O valor fica no cofre; o desenho guarda só a referência.'}
              </span>
            </>
          )}
        </label>
      )}

      {grava && (
        <p className="mt-2.5 rounded-[10px] border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-aviso">
          Antes de gravar, a IA pergunta “posso?” e espera a resposta. Ela só age sobre quem está
          conversando, e só em horários que ela mesma acabou de consultar.
        </p>
      )}
    </div>
  )
}
