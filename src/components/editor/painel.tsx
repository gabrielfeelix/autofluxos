'use client'

import { useId, useRef, useState, type ReactNode } from 'react'
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
import { mensagensDoHandoff, partesDaMensagem } from '@/core/flow/mensagem'
import { Dropdown } from '@/components/design/dropdown'
import { BarraDeFormato, SeletorDeEmoji } from './barra-de-formato'
import { SeletorDeVariavel } from './escolher-variavel'
import { CampoDeVariavel } from './campo-de-variavel'
import { SeletorDeArquivo } from './seletor-de-arquivo'
import { PresetsDeIntegracao } from './presets-de-integracao'
import { PilhaDeMensagem } from './pilha'
import {
  LegendaDeVariaveis,
  LinhaComVariaveis,
  TextoComVariaveis,
} from './texto-com-variaveis'
import { NOMES } from './nos'
import { contarCaracteres } from '@/core/flow/texto'
import {
  EXEMPLO_DO_FORMATO,
  FORMATOS_DE_SAIDA,
  type FormatoDeSaida,
} from '@/core/flow/formatos'
import {
  EXEMPLO_PADRONIZADO,
  FORMATOS_DE_RESPOSTA,
  NOME_DO_FORMATO,
  PEDIDO_PADRAO,
} from '@/core/flow/resposta'

/** Os quatro tipos, no nome que quem desenha o fluxo usa. */

/**
 * O “?” que abre a explicação daquele campo.
 *
 * Os dois testes com gente leiga bateram no mesmo ponto: a explicação boa
 * existe, está na página de Ajuda, e ninguém sai do desenho no meio de montar
 * um bloco para ir procurá-la. Ajuda que mora longe do campo é ajuda que não
 * existe.
 *
 * Abre em aba nova de propósito — o rascunho fica onde estava, e voltar é
 * fechar a aba.
 */
function Ajuda({ secao, oQue }: { secao: string; oQue: string }) {
  return (
    <a
      href={`/ajuda#${secao}`}
      target="_blank"
      rel="noreferrer"
      title={`Entender ${oQue}`}
      className="ml-1 inline-flex size-[15px] shrink-0 translate-y-[1px] items-center justify-center rounded-full border border-white/15 text-[9px] leading-none font-bold text-dim normal-case transition hover:border-accent/50 hover:text-accent"
    >
      ?
    </a>
  )
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
export type EtapaDoCliente = { quadroId: string; colunaId: string; rotulo: string }

/**
 * Uma automação da conta, como o bloco "Ir para outra automação" a enxerga.
 *
 * `publicado` e `ativo` vêm junto porque o seletor precisa **dizer o que está
 * errado antes de a pessoa escolher**: mandar conversa para um fluxo que nunca
 * foi publicado é um beco sem saída, e para um desligado é um handoff. Escolher
 * primeiro e descobrir na lista de impedimentos depois é o caminho longo.
 */
export type FluxoDaConta = { id: string; nome: string; publicado: boolean; ativo: boolean }

/**
 * O formulário do bloco selecionado. Tudo que é específico de um cliente é
 * digitado aqui e vai parar no JSON do fluxo — nunca no código.
 */
/**
 * Os prazos que a tela oferece.
 *
 * Lista fechada e não campo livre: prazo é decisão de conversa, não de número.
 * Quem digita "7" numa caixa não sabe se são minutos ou horas, e as opções
 * respondem isso sem uma linha de ajuda. O teto de 24h é a janela do WhatsApp —
 * passado dela não há como mandar texto livre, e um prazo que dispara para não
 * conseguir falar só gera handoff.
 */
/**
 * O operador escrito como quem fala.
 *
 * O dropdown mostrava a palavra crua do código — "contem", sem acento, e
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
}

/** O que cada método faz, na língua de quem monta o fluxo. */
const METODO_EM_PORTUGUES: Record<string, string> = {
  GET: 'consultar — trazer informação de lá para a conversa',
  POST: 'mandar — entregar ao sistema o que a conversa coletou',
}

const PRAZOS = [
  { valor: '0', rotulo: 'sem prazo', detalhe: 'espera para sempre' },
  { valor: '5', rotulo: '5 minutos' },
  { valor: '15', rotulo: '15 minutos' },
  { valor: '30', rotulo: '30 minutos' },
  { valor: '60', rotulo: '1 hora' },
  { valor: '180', rotulo: '3 horas' },
  { valor: '720', rotulo: '12 horas' },
  { valor: '1440', rotulo: '24 horas', detalhe: 'o teto da janela do WhatsApp' },
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
   * "criei outra igual" — sem isso o campo do próprio bloco se acusaria de
   * repetir a si mesmo.
   */
  origensDeVariaveis?: Record<string, string[]>
  /**
   * Todos os blocos do desenho. É o que o bloco de Voltar oferece como destino.
   *
   * Vem inteiro e não só os ids porque a lista precisa mostrar o texto de cada
   * um — escolher entre onze uuids não é escolher.
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
  fluxos?: FluxoDaConta[]
  aoMudarDados: (dados: Record<string, unknown>) => void
  aoDefinirInicio: () => void
  aoApagar: () => void
}) {

  if (!no) {
    return (
      <div className="p-4">
        <div className="rounded-[14px] border border-dashed border-white/10 px-[18px] py-[34px] text-center text-[12.5px] leading-6 text-dim">
          Selecione um bloco na área de desenho
          <br />
          ou adicione um novo pelo catálogo.
        </div>

      </div>
    )
  }

  /*
   * As variáveis que **outros** blocos guardam. A do próprio bloco sai da lista
   * porque escolher o nome que já está no campo não é escolha nenhuma — e
   * porque é ela que faria o campo dizer "reaproveita" para si mesmo.
   *
   * Variável sem nenhuma origem neste desenho **fica**: ela vem de outra
   * automação da conta, e é exatamente a que mais precisa ser oferecida. O que
   * um fluxo guarda fica no contato e continua lá na conversa seguinte, então
   * ler `{{plano}}` gravado pelo fluxo de matrícula é uso certo — e antes disto
   * a única forma era digitar de cabeça, onde errar uma letra não estoura:
   * a variável vira vazia e a mensagem sai com um buraco.
   */
  const deOutrosBlocos = variaveis.filter((v) => {
    const origens = origensDeVariaveis[v] ?? []
    return origens.length === 0 || origens.some((id) => id !== no.id)
  })

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-white/[0.05] text-[13px] text-accent">{NOMES[no.type].slice(0, 1)}</span>
          {NOMES[no.type]}
        </h3>
        <div className="flex items-center gap-2">
          {ehInicio ? (
            <span className="rounded-lg border border-accent/30 bg-accent/[0.12] px-2.5 py-1 text-[10px] font-bold text-accent">
              INÍCIO
            </span>
          ) : (
            <button
              onClick={aoDefinirInicio}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
            >
              Tornar início
            </button>
          )}
          <button onClick={aoApagar} className="rounded-lg border border-rose-400/30 px-2.5 py-1 text-[10px] font-semibold text-rose-300 transition hover:bg-rose-400/10">
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
            — e o tipo sai do arquivo. O campo pedindo `https://` era o nosso
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
                  // Limpar em vez de deixar guardada e invisível — o campo some
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
            />
          )}

          {no.data.midia === 'audio' ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11.5px] leading-5 text-muted">
              Áudio não aceita legenda no WhatsApp — a Meta recusa a mensagem
              inteira, não ignora o campo. Para dizer algo junto, use um bloco de
              Mensagem antes ou depois deste.
            </p>
          ) : (
            <Area
              conhecidas={variaveis}
              rotulo="Legenda"
              valor={no.data.legenda ?? ''}
              limite={LIMITE_LEGENDA}
              aoMudar={(legenda) => aoMudarDados({ legenda })}
              formatavel
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
          />
          <CampoDeVariavel
            rotulo="Guardar resposta em"
            ajuda={<Ajuda secao="variaveis" oQue="o que é guardar uma resposta" />}
            valor={no.data.salvarEm ?? ''}
            variaveis={deOutrosBlocos}
            modo="guarda"
            dica="nome sem espaço nem acento, ex: nome, prazo — ou escolha uma que o fluxo já tem em {x}"
            aoMudar={(v) => aoMudarDados({ salvarEm: v.trim() === '' ? undefined : v.trim() })}
            nota={
              no.data.opcoes.length > 0 ? (
                <>
                  É <strong className="text-muted">uma variável só</strong>, e ela guarda o rótulo do
                  botão clicado — {no.data.opcoes.map((o) => `“${o.rotulo}”`).join(', ')}. Ou seja: é
                  o caminho que o lead levou, e cada ramo depois daqui guarda o que for dele em
                  variáveis próprias.
                </>
              ) : (
                'Guarda o que a pessoa escrever, do jeito que ela escrever.'
              )
            }
          />
          <CampoDeVariavel
            rotulo="Opções vêm da variável"
            ajuda={<Ajuda secao="listas" oQue="como virar uma lista em botões" />}
            valor={no.data.opcoesDe ?? ''}
            variaveis={deOutrosBlocos}
            modo="usa"
            dica="deixe vazio para desenhar as opções à mão"
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
                acima — preencher o destino é o que revela os campos de origem,
                e não o contrário.
              */}
              <CampoDeVariavel
                rotulo="Guardar o valor escolhido em"
                valor={no.data.salvarValorEm ?? ''}
                variaveis={deOutrosBlocos}
                modo="guarda"
                dica="deixe vazio se o texto do botão já serve para o resto do fluxo"
                aoMudar={(v) =>
                  aoMudarDados({ salvarValorEm: v.trim() === '' ? undefined : v.trim() })
                }
                nota={
                  <>
                    Com isto preenchido, cada opção ganha um campo de{' '}
                    <strong className="text-muted">valor</strong>: a pessoa lê “Vídeo
                    institucional” e a API recebe{' '}
                    <code className="font-mono text-[#8de2fa]">institucional</code>. Sem isto, o
                    fluxo guarda o próprio texto do botão.
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
                    <span className="mt-1 block text-[10.5px] leading-4 text-dim">
                      Quando não casa, o bot pede de novo sem sair daqui. Na terceira vez a conversa
                      vai para uma pessoa.
                    </span>
                  </label>

                  {no.data.formato && (
                    <>
                      <Area
                        conhecidas={variaveis}
                        rotulo="Mensagem quando não entender"
                        valor={no.data.mensagemDeErro ?? ''}
                        limite={LIMITE_TEXTO}
                        aoMudar={(v) =>
                          aoMudarDados({ mensagemDeErro: v.trim() === '' ? undefined : v })
                        }
                        formatavel
                      />
                      <p className="-mt-2 text-[10.5px] leading-4 text-dim">
                        Vazio usa a nossa:{' '}
                        <span className="text-muted">
                          “{PEDIDO_PADRAO[no.data.formato]}”
                        </span>{' '}
                        Diga o que falta <strong className="text-muted">e dê um exemplo</strong> —
                        “formato inválido” não ensina ninguém a responder certo.
                      </p>

                      <CampoDeVariavel
                        rotulo="Guardar padronizado em (opcional)"
                        valor={no.data.salvarPadraoEm ?? ''}
                        variaveis={deOutrosBlocos}
                        modo="guarda"
                        dica={`ex: ${no.data.formato}_padrao — vira ${EXEMPLO_PADRONIZADO[no.data.formato]}`}
                        aoMudar={(v) =>
                          aoMudarDados({ salvarPadraoEm: v.trim() === '' ? undefined : v.trim() })
                        }
                        nota={
                          <>
                            “Guardar resposta em” fica com o que a pessoa escreveu — é o que ela quer
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
              <p className="text-[11px] leading-4 text-dim">
                As opções saem de{' '}
                <code className="font-mono text-[#8de2fa]">{no.data.opcoesDe}</code>, separadas por{' '}
                <code className="font-mono">;</code> ou quebra de linha — normalmente preenchida por
                um bloco de API antes deste. Como elas só existem durante a conversa, o bloco deixa
                de ramificar por opção: ligue as saídas{' '}
                <strong className="text-soft">escolheu</strong> e{' '}
                <strong className="text-soft">veio vazia</strong>, e use um bloco de Condição depois
                se precisar decidir sobre a escolha.
              </p>

              {/*
                O rótulo é o que a pessoa lê; o valor é o que o sistema entende.

                Os dois campos abaixo existem porque o menu de horários guardava
                "07:00" e o `POST` seguinte precisava do id da sessão — que não
                estava em lugar nenhum da conversa. Duas mapeadas do mesmo `[]`
                resolvem, e é isso que a dica explica.
              */}
              <CampoDeVariavel
                rotulo="Valores das opções (opcional)"
                valor={no.data.valoresDe ?? ''}
                variaveis={deOutrosBlocos}
                modo="usa"
                dica="a variável com os ids, na mesma ordem das opções"
                aoMudar={(v) => aoMudarDados({ valoresDe: v.trim() === '' ? undefined : v.trim() })}
                nota={
                  <>
                    Use quando o que a pessoa lê e o que o sistema entende são coisas diferentes —
                    ela escolhe <strong className="text-muted">“07:00”</strong> e a API precisa do
                    id daquele horário. No bloco de Serviços externos, mapeie duas vezes a mesma
                    lista: <code className="font-mono text-[#8de2fa]">livres[].hora</code> para as
                    opções e <code className="font-mono text-[#8de2fa]">livres[].sessaoId</code>{' '}
                    para os valores. O casamento é <strong className="text-muted">por posição</strong>.
                  </>
                }
              />

              {(no.data.valoresDe ?? '').trim() !== '' && (
                <CampoDeVariavel
                  rotulo="Guardar o valor escolhido em"
                  valor={no.data.salvarValorEm ?? ''}
                  variaveis={deOutrosBlocos}
                  modo="guarda"
                  dica="ex: sessao_id — é o que o bloco seguinte manda para a API"
                  aoMudar={(v) =>
                    aoMudarDados({ salvarValorEm: v.trim() === '' ? undefined : v.trim() })
                  }
                />
              )}
            </>
          )}

          {/*
            A foto como resposta.

            Sem isto, foto, áudio e documento sempre iam para uma pessoa com o
            motivo "o bot só lê texto" — e a farmácia que pede a receita, o
            petshop que quer ver o pet e a imobiliária que recebe a planta não
            tinham como dizer que ali o arquivo **é** a resposta certa.
          */}
          <label className="flex cursor-pointer items-start gap-2 text-[12px] leading-4 text-muted">
            <input
              type="checkbox"
              checked={no.data.aceitaMidia ?? false}
              onChange={(e) =>
                aoMudarDados({
                  aceitaMidia: e.target.checked || undefined,
                  ...(e.target.checked ? {} : { salvarMidiaEm: undefined }),
                })
              }
              className="mt-0.5 size-3.5 accent-[#56d0f5]"
            />
            <span>
              aceitar foto, áudio ou documento aqui
              <span className="mt-0.5 block text-[10.5px] leading-4 text-dim">
                Cria a saída <strong className="text-muted">“mandou arquivo”</strong> no bloco. Sem
                marcar, quem manda foto é passado para uma pessoa.
              </span>
            </span>
          </label>

          {no.data.aceitaMidia && (
            <CampoDeVariavel
              rotulo="Guardar o arquivo em"
              ajuda={<Ajuda secao="perguntas" oQue="o que é guardar o arquivo" />}
              valor={no.data.salvarMidiaEm ?? ''}
              variaveis={deOutrosBlocos}
              modo="guarda"
              dica="ex: receita — dá um nome ao arquivo para usar depois na conversa"
              nota={
                <>
                  Guarda uma etiqueta do arquivo que a pessoa mandou, não o arquivo em si. Serve
                  para mandar a foto ao seu sistema, se você tiver um — e, se não tiver, pode
                  deixar em branco: a foto continua aparecendo na conversa de quem atende.
                </>
              }
              aoMudar={(v) =>
                aoMudarDados({ salvarMidiaEm: v.trim() === '' ? undefined : v.trim() })
              }
            />
          )}

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Prazo para responder
            </span>
            <Dropdown
              valor={String(no.data.timeoutMinutos ?? 0)}
              aoMudar={(v) =>
                aoMudarDados({ timeoutMinutos: Number(v) === 0 ? undefined : Number(v) })
              }
              rotuloAcessivel="Prazo para responder"
              opcoes={PRAZOS}
            />
            <span className="mt-1.5 block text-[11px] leading-4 text-dim">
              {no.data.timeoutMinutos
                ? 'Passado o prazo sem resposta, a conversa sai pela saída “não respondeu”. Sem nada ligado nela, ela vai para uma pessoa — quem parou no meio da triagem é o lead que mais vale resgatar.'
                : 'Sem prazo, a conversa espera para sempre. É como o produto sempre funcionou.'}
            </span>
            {!!no.data.timeoutMinutos && (
              <span className="mt-1.5 block text-[11px] leading-4 text-dim">
                O disparo é por fila, não por despertador: ele acontece{' '}
                <strong className="text-muted">a partir</strong> do prazo, não no minuto exato.
              </span>
            )}
          </label>
        </>
      )}

      {no.type === 'condicao' && (
        <>
          <CampoDeVariavel
            rotulo="Variável"
            valor={no.data.variavel}
            variaveis={deOutrosBlocos}
            modo="usa"
            dica="o nome cru, sem chaves: prazo, e não {{prazo}}"
            aoMudar={(variavel) => aoMudarDados({ variavel })}
          />
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Operador
              <Ajuda secao="blocos" oQue="como a condição separa os caminhos" />
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
            dica="nome sem espaço nem acento — ou escolha uma que o fluxo já tem em {x}"
            aoMudar={(campo) => aoMudarDados({ campo })}
          />
          <Linha
            rotulo="Valor"
            valor={no.data.valor}
            dica="com o que comparar: um texto que você escreve, ou outra informação da conversa"
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
            <Ajuda secao="blocos" oQue="o que é o quadro" />
          </span>
          <p className="mb-1.5 text-[10.5px] leading-4 text-dim">
            O quadro é o painel de acompanhamento do atendimento — colunas como “chegou”,
            “orçamento enviado”, “fechou”. Este bloco move a pessoa de coluna sozinho, conforme a
            conversa anda.
          </p>
          {etapas.length === 0 ? (
            <span className="block rounded-lg border border-dashed border-white/[0.15] px-3 py-3 text-[11.5px] leading-5 text-dim">
              Este cliente ainda não tem quadro nenhum. Crie um em Quadros, na tela do cliente — sem
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
                  { valor: '', rotulo: 'Nenhuma — o bloco não faz nada' },
                  ...etapas.map((etapa) => ({ valor: etapa.colunaId, rotulo: etapa.rotulo })),
                ]}
              />
              <span className="mt-1 block text-[10.5px] leading-4 text-dim">
                Quem passar por aqui entra no quadro nesta etapa — e quem já estava nele é movido
                para cá. O relógio de &quot;parado há quanto tempo&quot; recomeça.
              </span>
            </>
          )}
        </label>
      )}

      {no.type === 'ir-fluxo' && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Continuar em qual automação
          </span>
          {fluxos.length === 0 ? (
            <span className="block rounded-lg border border-dashed border-white/[0.15] px-3 py-3 text-[11.5px] leading-5 text-dim">
              Esta conta ainda não tem automação para escolher. Crie outra em Automações — sem um
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
                  // manda é `fluxoId` — o motor e o `validar()` ignoram o rótulo.
                  aoMudarDados({ fluxoId, rotulo: escolhido?.nome ?? '' })
                }}
                rotuloAcessivel="Automação de destino"
                opcoes={[
                  { valor: '', rotulo: 'Nenhuma — a conversa pararia aqui' },
                  ...fluxos.map((f) => ({
                    valor: f.id,
                    rotulo: f.nome,
                    // O estado entra no próprio item: escolher e só depois
                    // descobrir na lista de impedimentos que o destino não
                    // publica é o caminho longo para a mesma informação.
                    detalhe: !f.publicado
                      ? 'nunca publicada — não há o que executar lá'
                      : !f.ativo
                        ? 'desligada — quem chegar aqui vai para uma pessoa'
                        : undefined,
                  })),
                ]}
              />
              <span className="mt-1 block text-[10.5px] leading-4 text-dim">
                A conversa continua na versão publicada da outra automação, do começo, e{' '}
                <strong className="text-muted">não volta</strong>. O que já foi guardado (nome,
                assunto, tudo) vai junto.
              </span>
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
          </span>
          <Dropdown
            valor={no.data.destino}
            aoMudar={(destino) => {
              const alvo = blocos.find((b) => b.id === destino)
              // `rotulo` viaja junto pelo mesmo motivo do bloco de etapa e do
              // de ir-fluxo: o desenho precisa dizer alguma coisa, e um uuid
              // não diz. Quem manda é `destino`.
              aoMudarDados({ destino, rotulo: alvo ? resumoDoBloco(alvo) : '' })
            }}
            rotuloAcessivel="Bloco de destino"
            opcoes={[
              { valor: '', rotulo: 'O início do fluxo', detalhe: 'o "voltar ao menu" de sempre' },
              ...blocos
                // O próprio bloco fora da lista: voltar para si mesmo é um
                // ciclo sem nada no meio, e ele gira até o motor desistir e
                // chamar uma pessoa.
                .filter((b) => b.id !== no.id)
                .map((b) => ({ valor: b.id, rotulo: resumoDoBloco(b), detalhe: NOMES[b.type] })),
            ]}
          />
          <span className="mt-1 block text-[10.5px] leading-4 text-dim">
            A conversa continua a partir do bloco escolhido, neste mesmo fluxo. O que já foi
            guardado <strong className="text-muted">não é apagado</strong> — quem voltou ao menu
            depois de dizer o nome não quer dizer o nome de novo.
          </span>
        </label>
      )}

      {no.type === 'ia' && (
        <>
          {/*
            O aviso do plano vem **primeiro e só quando é verdade**.
            
            Antes ele era o último parágrafo do card e aparecia sempre, inclusive
            para quem tinha contratado — um aviso que mente metade das vezes é um
            aviso que ninguém lê na vez em que importa. E ele vem no topo porque
            muda se o que está abaixo vale alguma coisa.
          */}
          {!iaHabilitada && (
            <p className="rounded-[10px] border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-amber-200">
              Este cliente ainda não tem IA contratada. Dá para desenhar e salvar, mas na conversa
              real o bloco passa direto para uma pessoa.
            </p>
          )}

          {/*
            Uma linha dizendo o que o bloco é.
            
            Sem ela, quem abre vê uma caixa de texto vazia chamada "instrução" e
            não tem como saber que existe um modelo do outro lado, nem que ele
            pode consultar coisa.
          */}
          <p className="text-[11.5px] leading-5 text-dim">
            A IA responde com o que estiver escrito no contexto do negócio — e, se você marcar
            abaixo, com o que ela consultar no sistema do cliente. Quando não souber, passa para
            uma pessoa.
          </p>

          <Area
            conhecidas={variaveis}
            rotulo="Instrução para a IA"
            valor={no.data.instrucao}
            aoMudar={(instrucao) => aoMudarDados({ instrucao })}
          />

          {/*
            As consultas vêm **antes** de "guardar resposta em", e isso inverte a
            ordem antiga de propósito: o que a IA pode consultar muda o que se
            escreve na instrução, então as duas coisas se decidem juntas. Guardar
            a resposta é opcional e avançado, e estava separando as duas.
          */}
          <ConsultasDaIa
            escolhidas={no.data.ferramentas}
            conexaoId={no.data.conexaoId ?? ''}
            conexoes={conexoes}
            clienteId={clienteId}
            aoMudar={aoMudarDados}
          />

          <CampoDeVariavel
            rotulo="Guardar resposta em"
            ajuda={<Ajuda secao="variaveis" oQue="o que é guardar uma resposta" />}
            valor={no.data.salvarEm ?? ''}
            variaveis={deOutrosBlocos}
            modo="guarda"
            dica="opcional — só se outro bloco precisar usar o que a IA respondeu"
            aoMudar={(v) => aoMudarDados({ salvarEm: v.trim() === '' ? undefined : v.trim() })}
          />
        </>
      )}

      {no.type === 'handoff' && (
        <>
          <MensagensDoHandoff
            mensagens={mensagensDoHandoff(no)}
            conhecidas={variaveis}
            aoMudar={(mensagens) => aoMudarDados({ mensagens })}
          />
          <Linha
            rotulo="Motivo (interno)"
            valor={no.data.motivo}
            dica="aparece no painel; aceita {{variavel}}"
            aoMudar={(motivo) => aoMudarDados({ motivo })}
            aceitaVariavel
            conhecidas={variaveis}
          />
        </>
      )}

      {no.type === 'http' && (
        <>
          {/*
            Preset, e não tipo de nó novo (§3.11).
            
            Ele preenche os campos abaixo **uma vez** e some do caminho: o que
            fica gravado no fluxo é o bloco resolvido, não uma referência viva.
            Se fosse referência, mudar o endereço da RD amanhã mudaria por baixo
            o que uma conversa em andamento vai chamar — e versão publicada é
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
          />

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Método
              <Ajuda secao="outros-sistemas" oQue="a diferença entre consultar e mandar" />
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
                : 'Mandar: entrega ao sistema o que a conversa coletou — um pedido, um agendamento, um cadastro.'}
            </span>
          </label>

          <Linha
            rotulo="Endereço"
            valor={no.data.url}
            dica="o link que quem fez o sistema te passou — começa com https://"
            ajuda={<Ajuda secao="outros-sistemas" oQue="onde conseguir este endereço" />}
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
              dica={
                <>
                  Os dados que a conversa já tem, no formato que o seu sistema espera — quem faz o
                  sistema diz quais campos ele quer. Cada valor entre aspas, e as variáveis também.
                </>
              }
            />
          )}

          <Cabecalhos
            cabecalhos={no.data.cabecalhos}
            conhecidas={variaveis}
            aoMudar={(cabecalhos) => aoMudarDados({ cabecalhos })}
          />

          <Mapeamentos mapear={no.data.mapear} aoMudar={(mapear) => aoMudarDados({ mapear })} />

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Credencial
              <Ajuda secao="outros-sistemas" oQue="o que é uma credencial" />
            </span>
            <Dropdown
              valor={no.data.conexaoId ?? ''}
              aoMudar={(conexaoId) => aoMudarDados({ conexaoId: conexaoId === '' ? undefined : conexaoId })}
              rotuloAcessivel="Credencial"
              opcoes={[
                { valor: '', rotulo: 'Nenhuma — o endereço não pede chave' },
                ...conexoes.map((conexao) => ({ valor: conexao.id, rotulo: conexao.nome })),
              ]}
            />
            <span className="mt-1 block text-[10.5px] leading-4 text-dim">
              {conexoes.length === 0
                ? 'Credencial é a senha que o seu sistema pede para deixar a gente consultar — quem fez o sistema te dá. Nenhuma cadastrada ainda: cadastre em Credenciais, na tela do cliente, e ela fica guardada em cofre, fora do desenho.'
                : 'O valor fica no cofre. O fluxo guarda só a referência, então trocar a chave depois não exige republicar.'}
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Se falhar</span>
            <Dropdown
              valor={no.data.aoFalhar}
              aoMudar={(aoFalhar) => aoMudarDados({ aoFalhar })}
              rotuloAcessivel="Se falhar"
              opcoes={[
                { valor: 'humano', rotulo: 'passa para uma pessoa' },
                { valor: 'seguir', rotulo: 'continua a conversa mesmo assim' },
              ]}
            />
          </label>

          <p className="rounded-[10px] border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-cyan-300">
            A aba Testar chama este endereço <strong>de verdade</strong>. Os disparos vindos dali
            levam o cabeçalho <code className="font-mono">X-AutoFluxos-Teste: 1</code>.
          </p>
        </>
      )}

    </div>
  )
}

/**
 * Os valores que a variável desta condição pode ter — clicáveis.
 *
 * Quando ela vem de uma pergunta com botões, a lista de valores possíveis é
 * fechada e conhecida: são os rótulos dos botões. Cobrar que alguém digite
 * "Agendar aula" de memória é criar um erro que **não estoura em lugar
 * nenhum** — a comparação falha calada, todo mundo desce pelo ramo errado, e o
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
                ? 'border-accent/40 bg-accent/[0.12] text-accent'
                : 'border-white/10 text-muted hover:border-accent/40 hover:text-accent'
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
 * frase só — "vou te passar para um atendente". Quem monta fluxo pediu o que
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
            </span>
            {mensagens.length > 1 && (
              <button
                type="button"
                onClick={() => aoMudar(mensagens.filter((_, j) => j !== i))}
                title="remover esta mensagem"
                className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
              >
                remover
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
          className="w-full rounded-lg border border-dashed border-white/12 px-3 py-2 text-[11.5px] text-muted transition hover:border-accent/40 hover:text-accent"
        >
          + outra mensagem antes de transferir
        </button>
      ) : (
        <p className="text-[10.5px] leading-4 text-dim">
          {LIMITE_MENSAGENS_HANDOFF} é o teto: cada uma vira uma notificação no celular de quem já
          está esperando alguém responder.
        </p>
      )}

      <p className="text-[11px] leading-4 text-dim">
        Saem em ordem, uma atrás da outra, e só depois a conversa passa para uma pessoa. É o lugar
        do “obrigado” e do pedido de avaliação do atendimento do bot.
      </p>
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  dica,
  aoMudar,
  aceitaVariavel = false,
  conhecidas,
  ajuda,
}: {
  rotulo: string
  valor: string
  dica?: string
  /** O “?” ao lado do rótulo, quando há explicação para este campo. */
  ajuda?: ReactNode
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
        {ajuda}
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
      {aceitaVariavel ? (
        <LegendaDeVariaveis valor={valor} conhecidas={conhecidas}>
          {dica}
        </LegendaDeVariaveis>
      ) : (
        dica && <span className="mt-1 block text-[10.5px] text-dim">{dica}</span>
      )}
    </Moldura>
  )
}

/**
 * `limite` não corta o que a pessoa digita — mostra. Cortar no meio de uma frase
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
  exemplo,
}: {
  rotulo: string
  valor: string
  limite?: number
  aoMudar: (valor: string) => void
  /** A frase embaixo do campo. Campo sem ela aparece pelado para quem nunca viu. */
  dica?: ReactNode
  /** O texto cinza dentro do campo vazio: ensina o formato sem precisar ler nada. */
  exemplo?: string
  /** Para o realce distinguir variável conhecida de erro de digitação. */
  conhecidas?: string[]
  /**
   * Este texto vira mensagem no WhatsApp?
   *
   * Só quem responde sim ganha a barra de formatação. `*negrito*` num campo que
   * a Meta não renderiza — a instrução da IA, o motivo interno do handoff — não
   * fica em negrito: fica com asterisco, literal, na frente de quem lê. Oferecer
   * o botão ali seria ensinar a estragar o dado.
   */
  formatavel?: boolean
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  // `useId` e não o rótulo: "Mensagem antes de passar" tem espaço, e espaço em
  // `id` é HTML inválido — o `htmlFor` simplesmente não acha o campo.
  const id = useId()
  const estourou = limite !== undefined && valor.length > limite

  const contador =
    limite !== undefined ? (
      <span
        className={`font-mono text-[10px] normal-case ${estourou ? 'font-bold text-rose-300' : 'text-dim'}`}
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
          {!formatavel && contador && <span className="ml-auto">{contador}</span>}
        </span>
      )}

      {/*
        A barra completa quando o texto vira mensagem; só o botão de variável
        quando não vira. Todo campo que interpola tem por onde inserir uma
        variável — era esse o ponto da lista que saiu do rodapé, e agora ele
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
        <span className="mt-1 block text-[10.5px] text-rose-300">
          O WhatsApp recusa acima de {limite} caracteres — publicar fica barrado até encurtar.
        </span>
      ) : (
        <LegendaDeVariaveis valor={valor} conhecidas={conhecidas}>
          {dica}
        </LegendaDeVariaveis>
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
        <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Opções</span>
        <span className="ml-auto font-mono text-[10px] text-dim">{opcoes.length}/{LIMITE_LISTA}</span>
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
              copia[i] = { ...opcao, valor: valor.trim() === '' ? undefined : valor }
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
        className="mt-2 w-full rounded-lg border border-dashed border-white/[0.12] py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
      >
        + adicionar opção
      </button>

      <p className="mt-2 text-[10.5px] leading-4 text-dim">
        {opcoes.length === 0
          ? 'Sem opções, a pessoa responde escrevendo.'
          : opcoes.length <= LIMITE_BOTOES
            ? `${opcoes.length} de até ${LIMITE_BOTOES} — o WhatsApp mostra como botões.`
            : `${opcoes.length} opções — vira lista suspensa. Fluxo bom cabe em ${LIMITE_BOTOES} botões.`}
        {cheio && ` Limite do WhatsApp é ${LIMITE_LISTA}.`}
      </p>
      <p className="text-[10.5px] leading-4 text-dim">
        Cada opção tem a própria saída no bloco. Ligue todas — o validador cobra.
      </p>
    </div>
  )
}

/**
 * Uma opção: o rótulo, o emoji e o contador.
 *
 * **Aqui morava o `maxLength={20}` que produziu três defeitos de uma vez.**
 * `maxLength` conta unidades UTF-16, e emoji fora do plano básico ocupa duas —
 * então um rótulo de 19 letras recusava qualquer emoji sem dizer por quê, e
 * colar texto longo cortava no meio do par substituto. O pedaço solto que
 * sobrava atravessava o `JSON.stringify` e **derrubava o salvamento no
 * Postgres**, que recusa `\ud83d` dentro de `jsonb`: o rascunho não gravava, e
 * ao recarregar a opção e os emojis tinham sumido.
 *
 * A troca é a mesma que o bloco de Mensagem já fazia: **contar não é cortar.**
 * O campo aceita o que a pessoa escrever, o contador mostra quanto passou, e
 * quem recusa é o validador na hora de publicar — onde a recusa vale e tem
 * explicação junto.
 *
 * O seletor de emoji entra junto porque era a outra metade do relato: sem ele,
 * a única forma de pôr um 📅 numa opção era colar do teclado do sistema.
 * Formatação não entra — rótulo de botão a Meta manda como texto puro, e o
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
          className={`w-9 shrink-0 text-right font-mono text-[10px] ${estourou ? 'font-bold text-rose-300' : 'text-dim'}`}
        >
          {usados}/{LIMITE_ROTULO}
        </span>
        <button
          onClick={aoRemover}
          title="remover opção"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
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
            placeholder="ex: institucional"
            className="app-field min-w-0 flex-1 px-2.5 py-1.5 font-mono text-[11.5px]"
          />
        </div>
      )}
      {estourou && (
        <p className="mt-1 text-[10.5px] leading-4 text-rose-300">
          O WhatsApp corta em {LIMITE_ROTULO} caracteres — publicar fica barrado até encurtar.
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
      </span>
      <p className="mb-1.5 text-[10.5px] leading-4 text-dim">
        Quase sempre vazio. É onde vão informações extras que alguns sistemas exigem junto do
        pedido — quem fez o sistema diz se precisa e o que escrever. Se ninguém te pediu, deixe em
        branco.
      </p>

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
            {/* O valor do cabeçalho interpola — é onde entra `{{token}}` —,
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
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => aoMudar([...cabecalhos, { chave: '', valor: '' }])}
        className="mt-2 w-full rounded-lg border border-dashed border-white/[0.12] py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
      >
        + adicionar cabeçalho
      </button>

      <p className="mt-2 text-[10.5px] leading-4 text-dim">
        Não coloque token aqui: publicar tira uma foto do fluxo que o banco se recusa a alterar, e o
        valor ficaria guardado nela. Chave vai no campo <strong className="text-soft">Credencial</strong>,
        logo abaixo — o valor mora no cofre e o fluxo guarda só a referência.
      </p>
    </div>
  )
}

/**
 * Como um bloco se chama na lista de destinos do Voltar.
 *
 * É o **texto que se lê no desenho**, e não o tipo nem o id: quem escolhe para
 * onde voltar está procurando "Podemos ajudar em algo mais?", que é o que está
 * escrito na tela. Uma lista de onze uuids, ou de onze "Pergunta", não é uma
 * escolha — é um sorteio.
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
    case 'ia':
      return curto(no.data.instrucao) || 'IA sem instrução'
    case 'handoff':
      return curto(mensagensDoHandoff(no)[0] ?? '') || 'Falar com humano'
    case 'http':
      return curto(no.data.url) || 'Serviços externos'
    case 'etapa':
      return 'Move no quadro'
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
        <Ajuda secao="listas" oQue="como guardar o que o sistema respondeu" />
      </span>

      {/*
        Uma linha dizendo o que a seção faz, antes dos campos.

        Quem monta fluxo chegou aqui e disse "essa parte aqui eu não entendi" —
        e tinha razão: o título "Guardar da resposta" nomeia a seção mas não
        explica que o sistema respondeu um monte de campos e que aqui se escolhe
        **quais** entram na conversa. Sem isso, os dois campos parecem pedir a
        mesma coisa duas vezes.
      */}
      <p className="mb-2 text-[10.5px] leading-4 text-dim">
        O sistema respondeu vários campos. Escolha quais a conversa guarda, e com
        que nome — é assim que <code className="font-mono">{'{{cidade}}'}</code>{' '}
        passa a existir nas mensagens seguintes.
      </p>

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
                `localidade` na outra, não dizem qual é qual — e a diferença é
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
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
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
                    tirar `{servico}` — oferecer o campo seria oferecer uma
                    montagem que não roda.
                  */}
                  {m.caminho.trim().endsWith(MARCA_DE_LISTA) && (
                    <div className="mt-1">
                      <input
                        value={m.rotulo ?? ''}
                        placeholder="{hora} · {servico}"
                        onChange={(e) => trocar({ rotulo: e.target.value || undefined })}
                        className="app-field w-full px-3 py-1.5 font-mono text-[11.5px]"
                      />
                      <p className="mt-1 pl-1 text-[10.5px] leading-4 text-dim">
                        Como cada item vira uma linha do menu. Campo entre chaves vem da resposta —{' '}
                        <code className="font-mono">{'{hora} · {servico}'}</code> produz{' '}
                        <code className="font-mono">07:00 · Pilates solo</code>. Sem modelo, o menu
                        só mostra um campo por item.
                      </p>
                    </div>
                  )}

                  <label className="mt-1 flex cursor-pointer items-center gap-2 pl-1 text-[10.5px] leading-4 text-dim">
                    <input
                      type="checkbox"
                      checked={m.unicos ?? false}
                      onChange={(e) => trocar({ unicos: e.target.checked || undefined })}
                      className="size-3.5 accent-[#56d0f5]"
                    />
                    sem repetir — use para menu de dias; não use quando esta lista for o par de outra
                  </label>

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
                      </span>
                      <Dropdown
                        valor={m.formato ?? ''}
                        aoMudar={(v) =>
                          trocar({ formato: v === '' ? undefined : (v as FormatoDeSaida) })
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

                  <label className="mt-1 flex cursor-pointer items-center gap-2 pl-1 text-[10.5px] leading-4 text-dim">
                    <input
                      type="checkbox"
                      checked={m.quantos ?? false}
                      onChange={(e) => trocar({ quantos: e.target.checked || undefined })}
                      className="size-3.5 accent-[#56d0f5]"
                    />
                    contar quantos — guarda o número de itens (
                    <code className="font-mono">3</code>), e não a lista
                  </label>
                </>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={() => aoMudar([...mapear, { variavel: '', caminho: '' }])}
        className="mt-2 w-full rounded-lg border border-dashed border-white/[0.12] py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
      >
        + guardar um campo
      </button>

      <p className="mt-2 text-[10.5px] leading-4 text-dim">
        Caminho com ponto e índice: <code className="font-mono">pedido.status</code>,{' '}
        <code className="font-mono">itens.0.nome</code>. O que você guardar vira coluna na tela de
        leads sozinho.
      </p>
      <p className="mt-1 text-[10.5px] leading-4 text-dim">
        Para percorrer uma lista inteira, use <code className="font-mono text-[#8de2fa]">[]</code>:{' '}
        <code className="font-mono">livres[].hora</code> guarda{' '}
        <code className="font-mono">07:00;10:00;15:00</code>, que é o formato que a Pergunta lê para
        virar menu. Um <code className="font-mono">[]</code> por caminho.
      </p>
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
 * que elas não podem — quem marca dez caixinhas seguidas não pesa a décima.
 *
 * Nada vem marcado. Bloco de IA sem consulta é o que sempre existiu, e continua
 * sendo a escolha certa para tirar dúvida sobre preço e horário de
 * funcionamento — o que já está escrito no contexto do negócio não precisa de
 * chamada nenhuma.
 */
function ConsultasDaIa({
  escolhidas,
  conexaoId,
  conexoes,
  clienteId,
  aoMudar,
}: {
  escolhidas: string[]
  conexaoId: string
  conexoes: ConexaoDoCliente[]
  clienteId: string
  aoMudar: (dados: { ferramentas?: string[]; conexaoId?: string | undefined }) => void
}) {
  const marcadas = new Set(escolhidas)
  const grava = escolhidas.some((nome) => FERRAMENTAS.find((f) => f.nome === nome)?.escreve)

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
      </span>
      <p className="mb-2.5 text-[10.5px] leading-4 text-dim">
        Nada marcado: a IA só responde com o contexto do negócio.
      </p>

      {grupos.map((grupo) => (
        <fieldset key={grupo.titulo} className="mb-2.5 last:mb-0">
          <legend className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.04em] text-muted uppercase">
            {grupo.titulo}
            {grupo.escreve && (
              <span className="rounded-full bg-amber-400/15 px-1.5 py-px text-[9.5px] font-bold tracking-normal text-amber-300 normal-case">
                grava de verdade
              </span>
            )}
          </legend>

          {FERRAMENTAS.filter((f) => f.escreve === grupo.escreve).map((f) => (
            <label
              key={f.nome}
              className="mb-1 flex items-center gap-2.5 rounded-[7px] px-1.5 py-1 last:mb-0 hover:bg-white/[0.03]"
            >
              <input
                type="checkbox"
                checked={marcadas.has(f.nome)}
                onChange={(evento) => alternar(f.nome, evento.currentTarget.checked)}
                className="size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="text-[12.5px] leading-4">{f.rotulo}</span>
            </label>
          ))}
        </fieldset>
      ))}

      {escolhidas.length > 0 && (
        <label className="mt-2.5 block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Credencial das consultas
          </span>

          {/*
            Sem credencial cadastrada, um dropdown vazio é um beco sem saída:
            a pessoa vê que falta alguma coisa e não tem como saber onde
            resolver. O link é a diferença entre um aviso e uma instrução.
          */}
          {conexoes.length === 0 ? (
            <p className="rounded-[10px] border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-amber-200">
              Este cliente ainda não tem credencial cadastrada, e sem ela a consulta volta negada.
              Cadastre em{' '}
              <a
                className="underline underline-offset-2 hover:text-amber-100"
                href={`/clientes/${clienteId}/conexoes`}
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
                  ...conexoes.map((conexao) => ({ valor: conexao.id, rotulo: conexao.nome })),
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
        <p className="mt-2.5 rounded-[10px] border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-amber-200">
          Antes de gravar, a IA pergunta “posso?” e espera a resposta. Ela só age sobre quem está
          conversando, e só em horários que ela mesma acabou de consultar.
        </p>
      )}
    </div>
  )
}
