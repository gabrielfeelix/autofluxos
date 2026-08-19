'use client'

import { useId, useRef, useState } from 'react'
import {
  LIMITE_BOTOES,
  LIMITE_LEGENDA,
  LIMITE_LISTA,
  LIMITE_ROTULO,
  LIMITE_TEXTO,
  LIMITE_TEXTO_INTERATIVO,
  METODOS,
  OPERADORES,
  type Cabecalho,
  type Mapeamento,
  type No,
  type Opcao,
} from '@/core/flow/schema'
import { Dropdown } from '@/components/design/dropdown'
import { BarraDeFormato } from './barra-de-formato'
import { SeletorDeArquivo } from './seletor-de-arquivo'
import { PresetsDeIntegracao } from './presets-de-integracao'
import { inserirNoCursor } from './inserir-variavel'
import { PilhaDeMensagem } from './pilha'
import { NOMES } from './nos'

/** Os quatro tipos, no nome que quem desenha o fluxo usa. */

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

type CampoDeTexto = {
  elemento: HTMLInputElement | HTMLTextAreaElement
  aoMudar: (valor: string) => void
}

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
  conexoes = [],
  etapas = [],
  aoMudarDados,
  aoDefinirInicio,
  aoApagar,
}: {
  no: No | null
  /** De quem é o fluxo. O upload dos blocos de arquivo precisa saber a pasta. */
  clienteId: string
  ehInicio: boolean
  variaveis: string[]
  conexoes?: ConexaoDoCliente[]
  etapas?: EtapaDoCliente[]
  aoMudarDados: (dados: Record<string, unknown>) => void
  aoDefinirInicio: () => void
  aoApagar: () => void
}) {
  const campoAtivo = useRef<CampoDeTexto | null>(null)
  const [foco, setFoco] = useState(false)

  function registrarCampo(elemento: HTMLInputElement | HTMLTextAreaElement, aoMudar: (valor: string) => void) {
    campoAtivo.current = { elemento, aoMudar }
    setFoco(true)
  }

  function inserirVariavel(variavel: string) {
    const ativo = campoAtivo.current
    if (!ativo || !ativo.elemento.isConnected) {
      campoAtivo.current = null
      setFoco(false)
      return
    }

    const { elemento, aoMudar } = ativo
    const { proximo, cursor } = inserirNoCursor(
      elemento.value,
      elemento.selectionStart ?? elemento.value.length,
      elemento.selectionEnd ?? elemento.value.length,
      `{{${variavel}}}`,
    )
    aoMudar(proximo)

    // O campo é controlado e a mudança acima pede render. Esperar um frame
    // devolve foco e cursor depois do valor novo chegar ao DOM.
    requestAnimationFrame(() => {
      elemento.focus()
      elemento.setSelectionRange(cursor, cursor)
    })
  }

  if (!no) {
    return (
      <div className="m-4 rounded-[14px] border border-dashed border-white/10 px-[18px] py-[34px] text-center text-[12.5px] leading-6 text-dim">
        Selecione um bloco na área de desenho
        <br />
        ou adicione um novo pelo catálogo.
      </div>
    )
  }

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
          no={no}
          clienteId={clienteId}
          aoMudarDados={aoMudarDados}
          registrarCampo={registrarCampo}
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
              registrarCampo={registrarCampo}
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
              aoFocar={registrarCampo}
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
              rotulo="Legenda"
              valor={no.data.legenda ?? ''}
              limite={LIMITE_LEGENDA}
              aoMudar={(legenda) => aoMudarDados({ legenda })}
              aoFocar={registrarCampo}
              formatavel
            />
          )}
        </>
      )}

      {no.type === 'pergunta' && (
        <>
          <Area
            rotulo="Pergunta"
            valor={no.data.texto}
            // Com opção, a mensagem sai interativa e o teto cai para um quarto.
            limite={
              no.data.opcoes.length > 0 || (no.data.opcoesDe ?? '').trim() !== ''
                ? LIMITE_TEXTO_INTERATIVO
                : LIMITE_TEXTO
            }
            aoMudar={(texto) => aoMudarDados({ texto })}
            aoFocar={registrarCampo}
            formatavel
          />
          <Linha
            rotulo="Guardar resposta em"
            valor={no.data.salvarEm ?? ''}
            dica="nome sem espaço nem acento, ex: nome, prazo"
            aoMudar={(v) => aoMudarDados({ salvarEm: v.trim() === '' ? undefined : v.trim() })}
          />
          <Linha
            rotulo="Opções vêm da variável"
            valor={no.data.opcoesDe ?? ''}
            dica="deixe vazio para desenhar as opções à mão"
            aoMudar={(v) => aoMudarDados({ opcoesDe: v.trim() === '' ? undefined : v.trim() })}
          />
          {(no.data.opcoesDe ?? '').trim() === '' ? (
            <Opcoes opcoes={no.data.opcoes} aoMudar={(opcoes) => aoMudarDados({ opcoes })} />
          ) : (
            <p className="text-[11px] leading-4 text-dim">
              As opções saem de{' '}
              <code className="font-mono text-[#8de2fa]">{no.data.opcoesDe}</code>, separadas por{' '}
              <code className="font-mono">;</code> ou quebra de linha — normalmente preenchida por um
              bloco de API antes deste. Como elas só existem durante a conversa, o bloco deixa de
              ramificar por opção: ligue as saídas <strong className="text-soft">escolheu</strong> e{' '}
              <strong className="text-soft">veio vazia</strong>, e use um bloco de Condição depois se
              precisar decidir sobre a escolha.
            </p>
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
          <Linha
            rotulo="Variável"
            valor={no.data.variavel}
            aoMudar={(variavel) => aoMudarDados({ variavel })}
          />
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Operador</span>
            <Dropdown
              valor={no.data.operador}
              aoMudar={(operador) => aoMudarDados({ operador })}
              rotuloAcessivel="Operador"
              opcoes={OPERADORES.map((operador) => ({ valor: operador, rotulo: operador }))}
            />
          </label>
          {no.data.operador !== 'vazio' && no.data.operador !== 'preenchido' && (
            <Linha
              rotulo="Valor"
              valor={no.data.valor}
              aoMudar={(valor) => aoMudarDados({ valor })}
              aceitaVariavel
              aoFocar={registrarCampo}
            />
          )}
        </>
      )}

      {no.type === 'salvar-campo' && (
        <>
          <Linha rotulo="Campo" valor={no.data.campo} aoMudar={(campo) => aoMudarDados({ campo })} />
          <Linha
            rotulo="Valor"
            valor={no.data.valor}
            dica="aceita {{variavel}}"
            aoMudar={(valor) => aoMudarDados({ valor })}
            aceitaVariavel
            aoFocar={registrarCampo}
          />
        </>
      )}

      {no.type === 'etapa' && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Etapa do quadro
          </span>
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

      {no.type === 'ia' && (
        <>
          <Area
            rotulo="Instrução para a IA"
            valor={no.data.instrucao}
            aoMudar={(instrucao) => aoMudarDados({ instrucao })}
            aoFocar={registrarCampo}
          />
          <Linha
            rotulo="Guardar resposta em"
            valor={no.data.salvarEm ?? ''}
            aoMudar={(v) => aoMudarDados({ salvarEm: v.trim() === '' ? undefined : v.trim() })}
          />
          <p className="rounded-[10px] border border-violet-400/20 bg-violet-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-violet-300">
            IA é plano à parte (Etapa 2). Enquanto o cliente não tiver contratado, o simulador
            mostra a chamada mas não chama modelo nenhum.
          </p>
        </>
      )}

      {no.type === 'handoff' && (
        <>
          <Area
            rotulo="Mensagem antes de passar"
            valor={no.data.mensagem}
            limite={LIMITE_TEXTO}
            aoMudar={(mensagem) => aoMudarDados({ mensagem })}
            aoFocar={registrarCampo}
            formatavel
          />
          <Linha
            rotulo="Motivo (interno)"
            valor={no.data.motivo}
            dica="aparece no painel; aceita {{variavel}}"
            aoMudar={(motivo) => aoMudarDados({ motivo })}
            aceitaVariavel
            aoFocar={registrarCampo}
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
          <PresetsDeIntegracao aoAplicar={aoMudarDados} />

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Método</span>
            <Dropdown
              valor={no.data.metodo}
              aoMudar={(metodo) => aoMudarDados({ metodo })}
              rotuloAcessivel="Método HTTP"
              opcoes={METODOS.map((metodo) => ({ valor: metodo, rotulo: metodo }))}
            />
          </label>

          <Linha
            rotulo="Endereço"
            valor={no.data.url}
            dica="precisa começar com https://. aceita {{variavel}} no meio"
            aoMudar={(url) => aoMudarDados({ url })}
            aceitaVariavel
            aoFocar={registrarCampo}
          />

          {no.data.metodo === 'POST' && (
            <Area
              rotulo="Corpo (JSON)"
              valor={no.data.corpo}
              aoMudar={(corpo) => aoMudarDados({ corpo })}
              aoFocar={registrarCampo}
            />
          )}

          <Cabecalhos
            cabecalhos={no.data.cabecalhos}
            aoMudar={(cabecalhos) => aoMudarDados({ cabecalhos })}
            aoFocar={registrarCampo}
          />

          <Mapeamentos mapear={no.data.mapear} aoMudar={(mapear) => aoMudarDados({ mapear })} />

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
              Credencial
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
                ? 'Nenhuma credencial cadastrada neste cliente ainda. Cadastre em Credenciais, na tela do cliente.'
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

      {variaveis.length > 0 && (
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-[10px] font-bold tracking-[0.05em] text-muted uppercase">Variáveis deste fluxo</p>
          <p className="mt-1 text-[11px] text-dim">
            {foco ? 'Clique para inserir no cursor do campo de texto em foco.' : 'Selecione um campo de texto e clique para inserir.'}
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            {variaveis.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => inserirVariavel(v)}
                className="rounded-[7px] border border-accent/[0.22] bg-accent/[0.09] px-2 py-1 font-mono text-[10px] text-[#8de2fa] transition hover:border-accent/50 hover:bg-accent/[0.16]"
                title={`Inserir {{${v}}} no cursor`}
              >{`{{${v}}}`}</button>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  dica,
  aoMudar,
  aceitaVariavel = false,
  aoFocar,
}: {
  rotulo: string
  valor: string
  dica?: string
  aoMudar: (valor: string) => void
  aceitaVariavel?: boolean
  aoFocar?: (elemento: HTMLInputElement, aoMudar: (valor: string) => void) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onFocus={(e) => aceitaVariavel && aoFocar?.(e.currentTarget, aoMudar)}
        onSelect={(e) => aceitaVariavel && aoFocar?.(e.currentTarget, aoMudar)}
        className="app-field px-3 py-2.5 text-[13px]"
      />
      {dica && <span className="mt-1 block text-[10.5px] text-dim">{dica}</span>}
    </label>
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
  aoFocar,
  formatavel = false,
}: {
  rotulo: string
  valor: string
  limite?: number
  aoMudar: (valor: string) => void
  aoFocar?: (elemento: HTMLTextAreaElement, aoMudar: (valor: string) => void) => void
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
      <span className="mb-1.5 flex items-baseline text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
        <label htmlFor={id}>{rotulo}</label>
        {!formatavel && contador && <span className="ml-auto">{contador}</span>}
      </span>

      {formatavel && (
        <BarraDeFormato area={area} aoMudar={aoMudar}>
          {contador}
        </BarraDeFormato>
      )}

      <textarea
        id={id}
        ref={area}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onFocus={(e) => aoFocar?.(e.currentTarget, aoMudar)}
        onSelect={(e) => aoFocar?.(e.currentTarget, aoMudar)}
        rows={4}
        className={`app-field resize-y px-3 py-2.5 text-[13px] leading-5 ${estourou ? 'border-rose-400/40' : ''}`}
      />
      <span className="mt-1 block text-[10.5px] text-dim">
        {estourou
          ? `O WhatsApp recusa acima de ${limite} caracteres — publicar fica barrado até encurtar.`
          : `aceita {{variavel}}`}
      </span>
    </div>
  )
}

function Opcoes({ opcoes, aoMudar }: { opcoes: Opcao[]; aoMudar: (opcoes: Opcao[]) => void }) {
  const cheio = opcoes.length >= LIMITE_LISTA

  return (
    <div>
      <div className="mb-1.5 flex items-baseline">
        <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Opções</span>
        <span className="ml-auto font-mono text-[10px] text-dim">{opcoes.length}/{LIMITE_LISTA}</span>
      </div>

      <div className="space-y-1.5">
        {opcoes.map((opcao, i) => (
          <div key={opcao.id} className="flex gap-1.5">
            <input
              value={opcao.rotulo}
              maxLength={LIMITE_ROTULO}
              onChange={(e) => {
                const copia = [...opcoes]
                copia[i] = { ...opcao, rotulo: e.target.value }
                aoMudar(copia)
              }}
              className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
            />
            <button
              onClick={() => aoMudar(opcoes.filter((o) => o.id !== opcao.id))}
              title="remover opção"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
            >
              ×
            </button>
          </div>
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

function Cabecalhos({
  cabecalhos,
  aoMudar,
  aoFocar,
}: {
  cabecalhos: Cabecalho[]
  aoMudar: (c: Cabecalho[]) => void
  aoFocar: (elemento: HTMLInputElement, aoMudar: (valor: string) => void) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Cabeçalhos</span>

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
            <input
              value={c.valor}
              placeholder="valor"
              onChange={(e) => {
                const copia = [...cabecalhos]
                copia[i] = { ...c, valor: e.target.value }
                aoMudar(copia)
              }}
              onFocus={(e) => aoFocar(e.currentTarget, (valor) => {
                const copia = [...cabecalhos]
                copia[i] = { ...c, valor }
                aoMudar(copia)
              })}
              onSelect={(e) => aoFocar(e.currentTarget, (valor) => {
                const copia = [...cabecalhos]
                copia[i] = { ...c, valor }
                aoMudar(copia)
              })}
              className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
            />
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

function Mapeamentos({
  mapear,
  aoMudar,
}: {
  mapear: Mapeamento[]
  aoMudar: (m: Mapeamento[]) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
        Guardar da resposta
      </span>

      <div className="space-y-1.5">
        {mapear.map((m, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={m.variavel}
              placeholder="variável"
              onChange={(e) => {
                const copia = [...mapear]
                copia[i] = { ...m, variavel: e.target.value }
                aoMudar(copia)
              }}
              className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
            />
            <input
              value={m.caminho}
              placeholder="pedido.status"
              onChange={(e) => {
                const copia = [...mapear]
                copia[i] = { ...m, caminho: e.target.value }
                aoMudar(copia)
              }}
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
        ))}
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
    </div>
  )
}
