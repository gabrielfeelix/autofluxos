'use client'

import { useRef, useState } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { parteNova, partesDaMensagem } from '@/core/flow/mensagem'
import {
  LIMITE_ATRASO_SEGUNDOS,
  LIMITE_LEGENDA,
  LIMITE_PARTES,
  LIMITE_TEXTO,
  TIPOS_DE_MIDIA,
  type NoMensagem,
  type Parte,
  type TipoDeMidia,
  type TipoDeParte,
} from '@/core/flow/schema'
import { alternarMarca, type Marca } from './formatar'

/**
 * O bloco de mensagem, desenhado como o que ele virou: **uma pilha**.
 *
 * Antes era um campo de texto e um número de atraso. A mesma conversa que o
 * produto de referência resolve num bloco exigia cinco dos nossos — um para o
 * texto, outro para a foto, outro para a pausa, outro para gravar o campo — e
 * o desenho ficava ilegível por causa de uma limitação do formulário, não do
 * atendimento.
 *
 * **O que se escreve aqui é sempre `partes`.** O formato antigo é lido (por
 * `partesDaMensagem`) e nunca reescrito no lugar: o grafo publicado é imutável,
 * e a conversa que está rodando nele continua rodando nele. Abrir um bloco
 * antigo no editor mostra a pilha equivalente; salvar grava a pilha.
 */
const ROTULOS_DE_MIDIA: Record<TipoDeMidia, string> = {
  imagem: 'Imagem',
  video: 'Vídeo',
  documento: 'Documento',
  audio: 'Áudio',
}

const NOME_DA_PARTE: Record<TipoDeParte, string> = {
  texto: 'Texto',
  midia: 'Arquivo',
  atraso: 'Atraso',
  salvar: 'Guardar',
  'auto-off': 'Desligar o bot',
}

/**
 * Emojis à mão, sem biblioteca.
 *
 * Um seletor completo são milhares de caracteres, busca, categorias e pele —
 * peso de sobra para o que acontece aqui, que é pôr um 👋 na saudação. A lista
 * é a dos que aparecem em mensagem de atendimento; quem quiser outro cola do
 * teclado do sistema, que continua funcionando.
 */
const EMOJIS = [
  '👋', '😀', '😊', '🙂', '😉', '🤝', '🙏', '👍', '👏', '💪',
  '✅', '❌', '⚠️', '❤️', '🎉', '✨', '🔥', '⭐', '📅', '⏰',
  '📍', '📞', '💬', '📷', '📄', '💰', '🛒', '🚀', '💡', '🔗',
]

export function PilhaDeMensagem({
  no,
  aoMudarDados,
  registrarCampo,
}: {
  no: NoMensagem
  aoMudarDados: (dados: Record<string, unknown>) => void
  registrarCampo: (
    elemento: HTMLInputElement | HTMLTextAreaElement,
    aoMudar: (valor: string) => void,
  ) => void
}) {
  const partes = partesDaMensagem(no)

  const gravar = (proximas: Parte[]) => aoMudarDados({ partes: proximas })

  const trocar = (indice: number, parte: Parte) =>
    gravar(partes.map((atual, i) => (i === indice ? parte : atual)))

  const remover = (indice: number) => gravar(partes.filter((_, i) => i !== indice))

  const mover = (indice: number, direcao: -1 | 1) => {
    const destino = indice + direcao
    if (destino < 0 || destino >= partes.length) return
    const proximas = [...partes]
    ;[proximas[indice], proximas[destino]] = [proximas[destino]!, proximas[indice]!]
    gravar(proximas)
  }

  const acrescentar = (tipo: TipoDeParte) => {
    if (partes.length >= LIMITE_PARTES) return
    gravar([...partes, parteNova(tipo)])
  }

  return (
    <div className="space-y-3">
      {partes.length === 0 && (
        <p className="rounded-[12px] border border-dashed border-white/10 px-3 py-5 text-center text-[12px] leading-5 text-dim">
          Esta mensagem está vazia.
          <br />
          Comece por um texto ou um arquivo.
        </p>
      )}

      {partes.map((parte, indice) => (
        <section
          key={indice}
          className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-2.5"
        >
          <header className="mb-2 flex items-center gap-1.5">
            <span className="text-[10.5px] font-bold tracking-[0.06em] text-muted uppercase">
              {indice + 1}. {NOME_DA_PARTE[parte.tipo]}
            </span>
            <span className="flex-1" />
            <BotaoDeOrdem
              rotulo={`Subir o pedaço ${indice + 1}`}
              sinal="↑"
              desabilitado={indice === 0}
              aoClicar={() => mover(indice, -1)}
            />
            <BotaoDeOrdem
              rotulo={`Descer o pedaço ${indice + 1}`}
              sinal="↓"
              desabilitado={indice === partes.length - 1}
              aoClicar={() => mover(indice, 1)}
            />
            <button
              type="button"
              aria-label={`Remover o pedaço ${indice + 1}`}
              onClick={() => remover(indice)}
              className="rounded-md px-1.5 py-0.5 text-[12px] text-dim transition hover:bg-rose-400/10 hover:text-rose-300"
            >
              ✕
            </button>
          </header>

          <Corpo
            parte={parte}
            aoMudar={(proxima) => trocar(indice, proxima)}
            registrarCampo={registrarCampo}
          />
        </section>
      ))}

      <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
        {(['texto', 'midia', 'atraso', 'salvar', 'auto-off'] as const).map((tipo) => (
          <button
            key={tipo}
            type="button"
            onClick={() => acrescentar(tipo)}
            disabled={partes.length >= LIMITE_PARTES}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            + {NOME_DA_PARTE[tipo]}
          </button>
        ))}
      </div>

      {partes.length >= LIMITE_PARTES && (
        <p className="text-[10.5px] leading-4 text-dim">
          {LIMITE_PARTES} pedaços é o teto. Acima disso são {LIMITE_PARTES} mensagens seguidas no
          WhatsApp de alguém — o que falta continua num bloco seguinte.
        </p>
      )}
    </div>
  )
}

function BotaoDeOrdem({
  rotulo,
  sinal,
  desabilitado,
  aoClicar,
}: {
  rotulo: string
  sinal: string
  desabilitado: boolean
  aoClicar: () => void
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
      className="rounded-md px-1.5 py-0.5 text-[12px] text-dim transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
    >
      {sinal}
    </button>
  )
}

function Corpo({
  parte,
  aoMudar,
  registrarCampo,
}: {
  parte: Parte
  aoMudar: (parte: Parte) => void
  registrarCampo: (
    elemento: HTMLInputElement | HTMLTextAreaElement,
    aoMudar: (valor: string) => void,
  ) => void
}) {
  switch (parte.tipo) {
    case 'texto':
      return (
        <CampoDeTexto
          valor={parte.texto}
          aoMudar={(texto) => aoMudar({ ...parte, texto })}
          registrarCampo={registrarCampo}
        />
      )

    case 'midia':
      return (
        <div className="space-y-2">
          <Dropdown
            rotuloAcessivel="Tipo de arquivo"
            valor={parte.midia}
            opcoes={TIPOS_DE_MIDIA.map((tipo) => ({ valor: tipo, rotulo: ROTULOS_DE_MIDIA[tipo] }))}
            aoMudar={(valor) => aoMudar({ ...parte, midia: valor as TipoDeMidia })}
          />
          <input
            value={parte.url}
            placeholder="https://…"
            onChange={(e) => aoMudar({ ...parte, url: e.target.value })}
            onFocus={(e) => registrarCampo(e.currentTarget, (url) => aoMudar({ ...parte, url }))}
            onSelect={(e) => registrarCampo(e.currentTarget, (url) => aoMudar({ ...parte, url }))}
            className="app-field px-3 py-2.5 font-mono text-[12px]"
          />
          {/*
            Áudio não mostra legenda porque a Meta **recusa a mensagem inteira**
            quando ela vem — não é campo ignorado. Esconder é mais honesto que
            deixar digitar e reprovar na publicação.
          */}
          {parte.midia !== 'audio' && (
            <input
              value={parte.legenda ?? ''}
              placeholder="Legenda (opcional)"
              maxLength={LIMITE_LEGENDA}
              onChange={(e) => aoMudar({ ...parte, legenda: e.target.value || undefined })}
              onFocus={(e) =>
                registrarCampo(e.currentTarget, (legenda) => aoMudar({ ...parte, legenda }))
              }
              onSelect={(e) =>
                registrarCampo(e.currentTarget, (legenda) => aoMudar({ ...parte, legenda }))
              }
              className="app-field px-3 py-2.5 text-[12.5px]"
            />
          )}
          {parte.midia === 'documento' && (
            <input
              value={parte.nomeArquivo ?? ''}
              placeholder="Nome do arquivo (ex.: plano.pdf)"
              onChange={(e) => aoMudar({ ...parte, nomeArquivo: e.target.value || undefined })}
              className="app-field px-3 py-2.5 text-[12.5px]"
            />
          )}
        </div>
      )

    case 'atraso':
      return (
        <div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={LIMITE_ATRASO_SEGUNDOS}
              step={0.5}
              value={parte.segundos}
              onChange={(e) => {
                const valor = e.currentTarget.valueAsNumber
                aoMudar({
                  ...parte,
                  segundos: Number.isFinite(valor)
                    ? Math.min(Math.max(valor, 0), LIMITE_ATRASO_SEGUNDOS)
                    : 0,
                })
              }}
              className="app-field w-20 px-3 py-2 font-mono text-[12.5px]"
            />
            <span className="text-[11.5px] text-muted">segundos</span>
          </div>
          <p className="mt-1 text-[10.5px] leading-4 text-dim">
            Mostra “digitando…” antes do pedaço seguinte. Até {LIMITE_ATRASO_SEGUNDOS}s — pausa
            maior precisa ser agendada.
          </p>
        </div>
      )

    case 'salvar':
      return (
        <div className="space-y-2">
          <input
            value={parte.campo}
            placeholder="nome_da_variavel"
            onChange={(e) => aoMudar({ ...parte, campo: e.target.value })}
            className="app-field px-3 py-2.5 font-mono text-[12.5px]"
          />
          <input
            value={parte.valor}
            placeholder="valor — aceita {{variavel}}"
            onChange={(e) => aoMudar({ ...parte, valor: e.target.value })}
            onFocus={(e) => registrarCampo(e.currentTarget, (valor) => aoMudar({ ...parte, valor }))}
            onSelect={(e) =>
              registrarCampo(e.currentTarget, (valor) => aoMudar({ ...parte, valor }))
            }
            className="app-field px-3 py-2.5 text-[12.5px]"
          />
          <p className="text-[10.5px] leading-4 text-dim">
            Grava no contato e vira coluna na tela de Contatos.
          </p>
        </div>
      )

    case 'auto-off':
      return (
        <p className="text-[11.5px] leading-5 text-muted">
          O bot para de responder <strong className="text-soft">para este contato</strong> e a
          conversa fica onde está. Não é o mesmo que “falar com humano”: ninguém entra na fila e
          ninguém é avisado. Para religar, use o botão na tela do contato.
        </p>
      )
  }
}

/**
 * O campo de texto com a barra de formatação.
 *
 * A barra não muda o formato do que é gravado — o que vai para o banco é o
 * mesmo `*negrito*` que o WhatsApp entende. Ela existe para ninguém precisar
 * decorar que itálico é sublinhado dos dois lados.
 */
function CampoDeTexto({
  valor,
  aoMudar,
  registrarCampo,
}: {
  valor: string
  aoMudar: (valor: string) => void
  registrarCampo: (
    elemento: HTMLInputElement | HTMLTextAreaElement,
    aoMudar: (valor: string) => void,
  ) => void
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  const [emojisAbertos, setEmojisAbertos] = useState(false)
  const estourou = valor.length > LIMITE_TEXTO

  function aplicar(marca: Marca) {
    const elemento = area.current
    if (!elemento) return

    const { proximo, selecaoInicio, selecaoFim } = alternarMarca(
      elemento.value,
      elemento.selectionStart,
      elemento.selectionEnd,
      marca,
    )
    aoMudar(proximo)

    // O campo é controlado: esperar um frame devolve foco e seleção depois de
    // o valor novo chegar ao DOM.
    requestAnimationFrame(() => {
      elemento.focus()
      elemento.setSelectionRange(selecaoInicio, selecaoFim)
    })
  }

  function inserirEmoji(emoji: string) {
    const elemento = area.current
    if (!elemento) return

    const de = elemento.selectionStart
    const ate = elemento.selectionEnd
    const proximo = elemento.value.slice(0, de) + emoji + elemento.value.slice(ate)
    aoMudar(proximo)
    setEmojisAbertos(false)

    requestAnimationFrame(() => {
      elemento.focus()
      const cursor = de + emoji.length
      elemento.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1">
        <BotaoDeMarca rotulo="Negrito" marca="negrito" aoClicar={aplicar}>
          <strong>B</strong>
        </BotaoDeMarca>
        <BotaoDeMarca rotulo="Itálico" marca="italico" aoClicar={aplicar}>
          <em>I</em>
        </BotaoDeMarca>
        <BotaoDeMarca rotulo="Riscado" marca="riscado" aoClicar={aplicar}>
          <s>S</s>
        </BotaoDeMarca>
        <BotaoDeMarca rotulo="Monoespaçado" marca="mono" aoClicar={aplicar}>
          <span className="font-mono">{'{}'}</span>
        </BotaoDeMarca>

        <div className="relative">
          <button
            type="button"
            aria-label="Inserir emoji"
            aria-expanded={emojisAbertos}
            onClick={() => setEmojisAbertos((aberto) => !aberto)}
            className="rounded-md px-1.5 py-0.5 text-[12px] text-dim transition hover:bg-white/[0.06] hover:text-white"
          >
            ☺
          </button>
          {emojisAbertos && (
            <div className="app-dropdown-menu right-auto left-0 grid w-[232px] grid-cols-10 gap-0.5 p-1.5">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => inserirEmoji(emoji)}
                  className="rounded p-0.5 text-[15px] leading-none transition hover:bg-white/[0.08]"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <span
          className={`ml-auto font-mono text-[10px] ${estourou ? 'font-bold text-rose-300' : 'text-dim'}`}
        >
          {valor.length}/{LIMITE_TEXTO}
        </span>
      </div>

      <textarea
        ref={area}
        value={valor}
        rows={4}
        onChange={(e) => aoMudar(e.target.value)}
        onFocus={(e) => registrarCampo(e.currentTarget, aoMudar)}
        onSelect={(e) => registrarCampo(e.currentTarget, aoMudar)}
        className={`app-field resize-y px-3 py-2.5 text-[13px] leading-6 ${estourou ? 'border-rose-400/60' : ''}`}
      />
    </div>
  )
}

function BotaoDeMarca({
  rotulo,
  marca,
  aoClicar,
  children,
}: {
  rotulo: string
  marca: Marca
  aoClicar: (marca: Marca) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      // `onMouseDown` com `preventDefault` em vez de `onClick`: clicar num
      // botão tira o foco do textarea antes do clique acontecer, e com o foco
      // vai a seleção — que é justamente o que a barra precisa saber.
      onMouseDown={(evento) => {
        evento.preventDefault()
        aoClicar(marca)
      }}
      className="w-6 rounded-md py-0.5 text-[12px] text-dim transition hover:bg-white/[0.06] hover:text-white"
    >
      {children}
    </button>
  )
}
