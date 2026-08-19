'use client'

import { useEffect, useRef, useState } from 'react'
import { sessaoNova, type Acao, type Entrada, type Resultado, type Sessao } from '@/core/engine/types'
import { timeoutDaPergunta } from '@/core/flow/schema'
import type { Fluxo, Opcao, TipoDeMidia } from '@/core/flow/schema'

export type ModoDaConversa = 'conversa' | 'bastidores'

/** O anexo de uma fala. `texto` continua sendo a legenda, quando há. */
export type AnexoDaFala = {
  midia: TipoDeMidia
  url: string
  nomeArquivo?: string
}

export type ItemDaConversa =
  | {
      chave: number
      de: 'bot'
      texto: string
      hora?: string
      opcoes?: Opcao[]
      formato?: 'botoes' | 'lista'
      anexo?: AnexoDaFala
    }
  | { chave: number; de: 'pessoa'; texto: string; hora?: string }
  | { chave: number; de: 'sistema'; texto: string; alerta?: boolean }

export function itensDoModo(itens: ItemDaConversa[], modo: ModoDaConversa) {
  return modo === 'conversa' ? itens.filter((item) => item.de !== 'sistema') : itens
}

export function contarEventos(itens: ItemDaConversa[]) {
  return itens.filter((item) => item.de === 'sistema').length
}

type Pendentes = { chave: number; opcoes: Opcao[]; formato: 'botoes' | 'lista' }

/**
 * O anexo dentro da bolha.
 *
 * Imagem e vídeo aparecem de verdade — o ponto do modo `conversa` é ver o que a
 * pessoa vai ver, e um retângulo escrito "imagem" não prova que o arquivo
 * carrega. Documento e áudio viram cartão, que é o que o WhatsApp mostra.
 *
 * `<img>` puro em vez do `next/image`: a URL é digitada por quem desenha o
 * fluxo e aponta para qualquer host, então não há como configurar domínio
 * permitido no `next.config` sem quebrar o caso normal. Aqui é preview de
 * teste, não imagem de página.
 */
function Anexo({ anexo, claro = false }: { anexo: AnexoDaFala; claro?: boolean }) {
  const nome = anexo.nomeArquivo?.trim() || 'arquivo'

  if (anexo.midia === 'imagem') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={anexo.url} alt={nome} className="block max-h-64 w-full object-cover" />
  }

  if (anexo.midia === 'video') {
    return <video src={anexo.url} controls className="block max-h-64 w-full bg-black" />
  }

  if (anexo.midia === 'audio') {
    return <audio src={anexo.url} controls className="block w-full max-w-[260px] p-2" />
  }

  return (
    <span
      className={`flex items-center gap-2.5 px-3 py-2.5 ${
        claro ? 'bg-[#f5f6f6] text-[#111b21]' : 'bg-white/[0.05]'
      }`}
    >
      <span aria-hidden className="text-base">
        📄
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{nome}</span>
    </span>
  )
}

let sequencia = 0
const novaChave = () => ++sequencia
const horaAtual = () =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())

/**
 * O chat de teste. Não imita o motor — chama o motor, pela mesma rota que o
 * webhook do WhatsApp vai chamar.
 *
 * Recebe o fluxo em memória, então dá para testar mudança que ainda nem foi
 * salva. É esse laço de segundos entre mexer e ver que faz o editor valer.
 */
export function Conversa({
  fluxo,
  fluxoId,
  nomeContato,
  contextoNegocio = '',
  iaHabilitada = false,
}: {
  fluxo: Fluxo
  /**
   * Qual automação é esta. O servidor usa para descobrir de quem é o fluxo e
   * quais credenciais ele pode usar — a identidade não viaja pelo corpo.
   */
  fluxoId?: string
  /** Nome que aparece no cabeçalho da simulação, como apareceria no WhatsApp. */
  nomeContato: string
  /** O que o cliente escreveu sobre o negócio: é o que fecha o escopo da IA. */
  contextoNegocio?: string
  /** Espelha o plano da automação. Sem isto, o bloco de IA não chama modelo. */
  iaHabilitada?: boolean
}) {
  const [itens, setItens] = useState<ItemDaConversa[]>([])
  const [pendentes, setPendentes] = useState<Pendentes | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [status, setStatus] = useState<Sessao['status']>('ativa')
  const [desatualizada, setDesatualizada] = useState(false)
  const [modo, setModo] = useState<ModoDaConversa>('conversa')
  const [sessaoExibida, setSessaoExibida] = useState<Sessao>(() => sessaoNova())

  const sessaoRef = useRef<Sessao>(sessaoNova())
  /**
   * O desenho que a conversa está executando **agora**.
   *
   * Quase sempre é o do editor. Muda quando a conversa passa por um bloco "Ir
   * para outra automação": dali em diante quem manda é a versão publicada do
   * destino, e continuar mandando o rascunho de cá faria o servidor procurar o
   * bloco atual num grafo onde ele não existe — o motor trataria como nó sumido
   * e recomeçaria a saudação, no meio do teste.
   */
  const fluxoDaVez = useRef<Fluxo>(fluxo)
  // Espelho dos itens para montar o histórico sem depender do fechamento do
  // render em que `enviar` foi criada.
  const itensRef = useRef<ItemDaConversa[]>([])
  const fimDaLista = useRef<HTMLDivElement>(null)
  const jaComecou = useRef(false)
  const assinaturaDoInicio = useRef('')

  const assinatura = JSON.stringify(fluxo)

  async function enviar(entrada: Entrada, eco?: string) {
    setOcupado(true)
    setPendentes(null)
    if (eco !== undefined) {
      setItens((atual) => [...atual, { chave: novaChave(), de: 'pessoa', texto: eco, hora: horaAtual() }])
    }

    try {
      const resposta = await fetch('/api/simular', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fluxo: fluxoDaVez.current,
          sessao: sessaoRef.current,
          entrada,
          fluxoId,
          contextoNegocio,
          iaHabilitada,
          // O que já foi dito, para a IA não repetir pergunta respondida.
          historico: itensRef.current
            .filter((i) => i.de !== 'sistema')
            .map((i) => ({ de: i.de === 'pessoa' ? 'pessoa' : 'bot', texto: i.texto })),
        }),
      })

      if (!resposta.ok) {
        /**
         * O motivo vem do servidor, e não uma frase fixa.
         *
         * Dizer "o motor recusou este fluxo" em toda falha é mentir na metade
         * dos casos: o 429 do limite de testes e o 404 de automação inexistente
         * não têm nada a ver com o desenho, e quem lia isso ia procurar defeito
         * onde não havia. `catch` porque resposta de erro nem sempre é JSON —
         * um 502 do provedor devolve HTML.
         */
        const motivo = await resposta
          .json()
          .then((corpo: { erro?: string }) => corpo.erro)
          .catch(() => undefined)

        setItens((atual) => [
          ...atual,
          {
            chave: novaChave(),
            de: 'sistema',
            texto: motivo ?? 'o motor recusou este fluxo',
            alerta: true,
          },
        ])
        return
      }

      const { acoes, sessao: nova, destino } = (await resposta.json()) as Resultado & {
        destino?: { grafo: Fluxo }
      }
      if (destino) fluxoDaVez.current = destino.grafo
      sessaoRef.current = nova
      setSessaoExibida(nova)
      setStatus(nova.status)
      await aplicar(acoes, nova)
    } catch {
      // Sem isto a falha some: a requisição pode morrer por rede, ou por a rota
      // estourar o tempo esperando uma API lenta. Ficar girando em silêncio é
      // pior do que dizer o que houve.
      setItens((atual) => [
        ...atual,
        { chave: novaChave(), de: 'sistema', texto: 'a requisição não completou', alerta: true },
      ])
    } finally {
      setOcupado(false)
    }
  }

  async function aplicar(acoes: Acao[], nova: Sessao) {
    let ultimas: Pendentes | null = null
    const adicionar = (item: ItemDaConversa) => setItens((atual) => [...atual, item])

    for (const acao of acoes) {
      const chave = novaChave()
      switch (acao.tipo) {
        case 'enviar_texto':
          if (acao.atrasoMs) {
            await new Promise((resolver) => setTimeout(resolver, acao.atrasoMs))
          }
          adicionar({ chave, de: 'bot', texto: acao.texto, hora: horaAtual() })
          break
        case 'enviar_midia':
          if (acao.atrasoMs) {
            await new Promise((resolver) => setTimeout(resolver, acao.atrasoMs))
          }
          adicionar({
            chave,
            de: 'bot',
            texto: acao.legenda ?? '',
            hora: horaAtual(),
            anexo: {
              midia: acao.midia,
              url: acao.url,
              ...(acao.nomeArquivo ? { nomeArquivo: acao.nomeArquivo } : {}),
            },
          })
          break
        case 'enviar_opcoes':
          adicionar({
            chave,
            de: 'bot',
            texto: acao.texto,
            hora: horaAtual(),
            opcoes: acao.opcoes,
            formato: acao.formato,
          })
          ultimas = { chave, opcoes: acao.opcoes, formato: acao.formato }
          break
        case 'salvar_campo':
          adicionar({ chave, de: 'sistema', texto: `guardou ${acao.campo} = "${acao.valor}"` })
          break
        case 'chamar_ia':
          adicionar({ chave, de: 'sistema', texto: `chamaria a IA — "${acao.instrucao}"` })
          break
        case 'chamar_http':
          // O caminho normal é o resolvedor já ter trocado isto pelos
          // `salvar_campo` que vieram da resposta. Chegar aqui significa que
          // ninguém executou — mostrar é melhor do que sumir com o evento.
          adicionar({
            chave,
            de: 'sistema',
            texto: `a chamada para ${acao.url} não foi executada`,
            alerta: true,
          })
          break
        case 'pausar_automacao':
          // Alerta, e não linha comum: o bot ficar mudo é a coisa mais fácil de
          // confundir com defeito. Dizer que foi escolha do desenho evita meia
          // hora procurando o que não quebrou.
          adicionar({
            chave,
            de: 'sistema',
            texto: 'desligou o bot para este contato — as próximas mensagens ficam sem resposta',
            alerta: true,
          })
          break
        case 'transferir_humano':
          adicionar({ chave, de: 'sistema', texto: `passou para um humano — ${acao.motivo}`, alerta: true })
          break
        case 'encerrar':
          adicionar({ chave, de: 'sistema', texto: 'conversa encerrada' })
          break
      }
    }

    if (nova.status === 'ativa' && ultimas) setPendentes(ultimas)
  }

  function recomecar() {
    sessaoRef.current = sessaoNova()
    // Recomeçar volta para o desenho da tela, e não para onde o último salto
    // parou: quem clica em recomeçar quer testar o que está editando.
    fluxoDaVez.current = fluxo
    assinaturaDoInicio.current = assinatura
    setDesatualizada(false)
    setStatus('ativa')
    setItens([])
    setPendentes(null)
    setRascunho('')
    setSessaoExibida(sessaoRef.current)
    void enviar({ tipo: 'inicio' })
  }

  function submeter(evento: React.FormEvent) {
    evento.preventDefault()
    const texto = rascunho.trim()
    if (texto === '' || ocupado) return
    setRascunho('')

    if (status === 'aguardando_ia') {
      void enviar({ tipo: 'ia_respondeu', texto }, `(resposta da IA) ${texto}`)
      return
    }
    void enviar({ tipo: 'texto', texto }, texto)
  }

  useEffect(() => {
    if (jaComecou.current) return
    jaComecou.current = true
    assinaturaDoInicio.current = assinatura
    void enviar({ tipo: 'inicio' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // O fluxo mudou desde que esta conversa começou. Não reinicia sozinho — seria
  // irritante no meio de um teste —, só avisa que o que está na tela é velho.
  useEffect(() => {
    if (jaComecou.current && assinatura !== assinaturaDoInicio.current) setDesatualizada(true)
  }, [assinatura])

  useEffect(() => {
    itensRef.current = itens
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' })
  }, [itens])

  const viva = status === 'ativa' || status === 'aguardando_ia' || status === 'aguardando_http'
  const temApi = fluxo.nodes.some((n) => n.type === 'http')

  /** A conversa está parada numa pergunta que tem prazo para responder (B1)? */
  const temPrazo =
    status === 'ativa' &&
    fluxo.nodes.some(
      (no) =>
        no.id === sessaoExibida.noAtual &&
        no.type === 'pergunta' &&
        timeoutDaPergunta(no) !== null,
    )
  const eventos = contarEventos(itens)
  const iniciais = nomeContato
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <div className="flex rounded-lg border border-white/[0.08] bg-black/20 p-0.5" role="group" aria-label="Modo do teste">
          {(['conversa', 'bastidores'] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setModo(opcao)}
              aria-pressed={modo === opcao}
              className={`rounded-md px-2.5 py-1.5 text-[10.5px] font-bold transition ${
                modo === opcao ? 'bg-white/[0.11] text-ink shadow-sm' : 'text-dim hover:text-soft'
              }`}
            >
              {opcao === 'conversa' ? 'Conversa' : 'Bastidores'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {modo === 'conversa' && eventos > 0 && (
            <button
              type="button"
              onClick={() => setModo('bastidores')}
              className="rounded-full border border-white/[0.08] px-2 py-1 text-[9.5px] font-semibold text-dim transition hover:border-white/[0.16] hover:text-soft"
              title="Ver eventos nos bastidores"
            >
              {eventos} {eventos === 1 ? 'evento' : 'eventos'}
            </button>
          )}
          <button
            type="button"
            onClick={recomecar}
            className="rounded-lg px-2 py-1.5 text-[10.5px] font-bold text-soft transition hover:bg-white/[0.07] hover:text-ink"
            title="Reiniciar o teste desde o começo"
          >
            ↻ Reiniciar
          </button>
        </div>
      </div>

      {temApi && (
        <p className="mx-3.5 mt-3.5 rounded-[11px] border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-cyan-300">
          Este fluxo chama uma API. O teste dispara <strong>de verdade</strong> — testar cinco vezes
          grava cinco vezes no sistema do cliente.
        </p>
      )}

      {modo === 'conversa' && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-black/10 bg-[#f0f2f5] px-3 py-2 text-[#111b21]">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-[10px] font-extrabold text-white">
            {iniciais || 'AF'}
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-[12px] leading-4">{nomeContato}</strong>
            <span className="block text-[9.5px] text-[#667781]">contato de teste</span>
          </span>
        </div>
      )}

      <div
        className={`min-h-0 flex-1 space-y-2 overflow-y-auto p-3.5 ${
          modo === 'conversa' ? 'whatsapp-wallpaper' : ''
        }`}
      >
        {itensDoModo(itens, modo).map((item) => (
          <Bolha
            key={item.chave}
            item={item}
            modo={modo}
            pendentes={pendentes}
            ocupado={ocupado}
            aoEscolher={enviar}
          />
        ))}
        {ocupado && (
          <div
            className={`flex w-fit gap-1 rounded-[13px_13px_13px_4px] px-3.5 py-3 ${
              modo === 'conversa'
                ? 'bg-white shadow-[0_1px_1px_rgba(11,20,26,0.13)]'
                : 'border border-white/[0.08] bg-white/[0.055]'
            }`}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`typing-dot size-1.5 rounded-full ${modo === 'conversa' ? 'bg-[#8696a0]' : 'bg-muted'}`}
                style={{ animation: `blink 1.1s ${i * 0.18}s infinite` }}
              />
            ))}
          </div>
        )}
        <div ref={fimDaLista} />
      </div>

      {desatualizada && (
        <p className="mx-3.5 mb-2 rounded-[11px] border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2.5 text-[11.5px] text-amber-200">
          O fluxo mudou desde que esta conversa começou.{' '}
          <button onClick={recomecar} className="font-bold underline underline-offset-2">
            recomeçar para testar
          </button>
        </p>
      )}

      <div className={`border-t p-3 ${modo === 'conversa' ? 'border-black/10 bg-[#f0f2f5]' : 'border-white/[0.06]'}`}>
        {viva ? (
          <form onSubmit={submeter} className="flex gap-2">
            <input
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              disabled={ocupado}
              placeholder={
                status === 'aguardando_ia' ? 'o que a IA responderia?' : 'escreva como o cliente…'
              }
              className={
                modo === 'conversa'
                  ? 'min-w-0 flex-1 rounded-full border-0 bg-white px-3.5 py-2 text-[12px] text-[#111b21] outline-none placeholder:text-[#8696a0] disabled:opacity-60'
                  : 'app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]'
              }
            />
            <button
              type="button"
              onClick={() => void enviar({ tipo: 'midia', formato: 'audio' }, '🎤 (áudio)')}
              disabled={ocupado || status === 'aguardando_ia'}
              title="Testar o que acontece quando a pessoa manda áudio"
              className={
                modo === 'conversa'
                  ? 'flex size-9 shrink-0 items-center justify-center rounded-full text-sm text-[#54656f] transition hover:bg-black/[0.05] disabled:opacity-40'
                  : 'app-secondary-button flex size-9 shrink-0 items-center justify-center px-0 text-sm disabled:opacity-40'
              }
            >
              🎤
            </button>
            {/*
              Testar o prazo sem esperar meia hora.
              
              Só aparece quando a conversa está **parada numa pergunta com
              prazo** — um botão que estivesse sempre lá mandaria um timeout
              para um bloco que não tem prazo nenhum, e o motor ignoraria em
              silêncio. Botão que não faz nada ensina a não confiar na tela.
            */}
            {temPrazo && (
              <button
                type="button"
                onClick={() => void enviar({ tipo: 'timeout' }, '⏱ (ninguém respondeu)')}
                disabled={ocupado}
                title="Simular o prazo desta pergunta vencendo sem resposta"
                className={
                  modo === 'conversa'
                    ? 'flex size-9 shrink-0 items-center justify-center rounded-full text-sm text-[#54656f] transition hover:bg-black/[0.05] disabled:opacity-40'
                    : 'app-secondary-button flex size-9 shrink-0 items-center justify-center px-0 text-sm disabled:opacity-40'
                }
              >
                ⏱
              </button>
            )}
            <button
              type="submit"
              disabled={ocupado || rascunho.trim() === ''}
              className={
                modo === 'conversa'
                  ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-[#00a884] px-0 text-base text-white transition hover:bg-[#008f72] disabled:opacity-40'
                  : 'app-primary-button flex size-9 shrink-0 items-center justify-center px-0 text-lg disabled:opacity-40'
              }
            >
              {modo === 'conversa' ? '➤' : '›'}
            </button>
          </form>
        ) : (
          <p className={`px-1 py-2 text-[12.5px] leading-5 ${modo === 'conversa' ? 'text-[#54656f]' : 'text-muted'}`}>
            {status === 'humano'
              ? 'O bot saiu de cena — daqui em diante quem responde é uma pessoa.'
              : 'A conversa terminou.'}{' '}
            <button onClick={recomecar} className="font-bold text-accent underline underline-offset-2">
              recomeçar
            </button>
          </p>
        )}
      </div>

      {modo === 'bastidores' && (
        <div className="shrink-0 border-t border-white/[0.06] p-3 text-[11px]">
          <p className="text-dim">
            bloco atual: <code>{sessaoExibida.noAtual ?? '—'}</code> · {sessaoExibida.status}
          </p>
          {Object.keys(sessaoExibida.vars).length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1">
              {Object.entries(sessaoExibida.vars).map(([chave, valor]) => (
                <span
                  key={chave}
                  className="rounded-md border border-white/[0.08] bg-white/[0.045] px-2 py-1 font-mono text-[10px] text-muted"
                >
                  {chave}: {valor}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Bolha({
  item,
  modo,
  pendentes,
  ocupado,
  aoEscolher,
}: {
  item: ItemDaConversa
  modo: ModoDaConversa
  pendentes: Pendentes | null
  ocupado: boolean
  aoEscolher: (entrada: Entrada, eco?: string) => void
}) {
  if (item.de === 'sistema') {
    return (
      <p
        className={`mx-auto w-fit rounded-full border border-dashed px-3 py-1 text-center font-mono text-[9.5px] ${
          item.alerta ? 'border-amber-300/25 text-amber-200' : 'border-white/[0.14] text-[#6b7689]'
        }`}
      >
        {item.texto}
      </p>
    )
  }

  if (item.de === 'pessoa') {
    return (
      <div className="flex justify-end">
        <p
          className={`max-w-[85%] rounded-[13px_13px_4px_13px] px-3 py-2 text-[12.5px] leading-[1.5] ${
            modo === 'conversa'
              ? 'bg-[#d9fdd3] text-[#111b21] shadow-[0_1px_1px_rgba(11,20,26,0.13)]'
              : 'border border-accent/[0.24] bg-accent/[0.14] text-ink'
          }`}
        >
          <span>{item.texto}</span>
          {modo === 'conversa' && (
            <span className="ml-2 inline-flex translate-y-0.5 gap-0.5 whitespace-nowrap text-[8.5px] text-[#667781]">
              {item.hora} <span className="font-bold text-[#53bdeb]">✓✓</span>
            </span>
          )}
        </p>
      </div>
    )
  }

  const ativo = pendentes?.chave === item.chave && !ocupado

  if (modo === 'conversa') {
    const ehLista = item.formato === 'lista' || (item.opcoes?.length ?? 0) > 3

    return (
      <div className="flex max-w-[92%] flex-col items-start gap-1">
        <div className="max-w-full overflow-hidden rounded-[13px_13px_13px_4px] bg-white shadow-[0_1px_1px_rgba(11,20,26,0.13)]">
          {item.anexo && <Anexo anexo={item.anexo} claro />}
          <p className="px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-wrap text-[#111b21]">
            <span>{item.texto}</span>
            <span className="ml-2 inline-block translate-y-0.5 whitespace-nowrap text-[8.5px] text-[#667781]">
              {item.hora}
            </span>
          </p>
        </div>

        {item.opcoes && item.opcoes.length > 0 && (
          <div className="w-full overflow-hidden rounded-lg bg-white shadow-[0_1px_1px_rgba(11,20,26,0.13)]">
            {ehLista && (
              <p className="border-b border-[#e9edef] px-3 py-2 text-[10px] font-semibold text-[#667781]">
                ☰ Escolha uma opção
              </p>
            )}
            {item.opcoes.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                disabled={!ativo}
                onClick={() => aoEscolher({ tipo: 'opcao', opcaoId: opcao.id }, opcao.rotulo)}
                className="flex w-full items-center gap-2 border-b border-[#e9edef] px-3 py-2.5 text-left text-[11.5px] font-medium text-[#008069] transition last:border-0 enabled:hover:bg-[#f5f6f6] disabled:text-[#8696a0]"
              >
                <span aria-hidden className="text-sm text-[#00a884]">↩</span>
                <span>{opcao.rotulo}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="max-w-[88%] overflow-hidden rounded-[13px_13px_13px_4px] border border-white/[0.08] bg-white/[0.055]">
        {item.anexo && <Anexo anexo={item.anexo} />}
        {item.texto.trim() !== '' && (
          <p className="px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-wrap">{item.texto}</p>
        )}
      </div>

      {item.opcoes && item.opcoes.length > 0 && (
        <div
          className={
            item.formato === 'botoes'
              ? 'flex max-w-[88%] flex-wrap gap-1.5'
              : 'flex w-full max-w-[88%] flex-col overflow-hidden rounded-xl border border-white/[0.1]'
          }
        >
          {item.opcoes.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              disabled={!ativo}
              onClick={() => aoEscolher({ tipo: 'opcao', opcaoId: opcao.id }, opcao.rotulo)}
              className={
                item.formato === 'botoes'
                  ? 'rounded-lg border border-accent/[0.28] bg-accent/[0.07] px-3 py-1.5 text-xs font-semibold text-accent transition enabled:hover:bg-accent/[0.14] disabled:opacity-40'
                  : 'border-b border-white/[0.08] px-3 py-2 text-left text-xs text-soft transition last:border-0 enabled:hover:bg-white/[0.05] disabled:opacity-40'
              }
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      )}

      {item.opcoes && (
        <span className="font-mono text-[9.5px] text-dim">
          no WhatsApp isto vira {item.formato === 'botoes' ? 'botões' : 'uma lista'}
        </span>
      )}
    </div>
  )
}
