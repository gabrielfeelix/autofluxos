'use client'

import { useRef, useState, useTransition } from 'react'
import type { ConfigDoSite, Mascote } from '@/core/chat-do-site'
import { TETO_DA_SAUDACAO, TETO_DE_DOMINIOS, TETO_DO_TITULO } from '@/core/chat-do-site'
import {
  acaoLigarChatDoSite,
  acaoPausarChatDoSite,
  acaoSalvarChatDoSite,
  acaoSubirMascote,
  acaoTirarMascote,
} from '@/server/acoes-site'

type Inicial = {
  ligado: boolean
  existe: boolean
  chave: string | null
  config: ConfigDoSite
}

/** Cores prontas: as mais comuns em loja, mais a do produto. Qualquer outra vai no seletor. */
const CORES = ['#6366F1', '#2563EB', '#0F766E', '#16A34A', '#EA580C', '#DC2626', '#DB2777', '#111827']

/**
 * A tela inteira do chat do site, num componente só porque a prévia muda a
 * cada tecla: título, saudação e cor aparecem no balão de exemplo enquanto se
 * digita, antes de salvar. Salvar é otimista: a tela já está com o valor novo,
 * e só volta se o servidor recusar.
 */
export function ConfigurarChatDoSite({
  clienteId,
  inicial,
  fluxoPrincipal,
  urlDoScript,
}: {
  clienteId: string
  inicial: Inicial
  fluxoPrincipal: string | null
  urlDoScript: string
}) {
  const [ligado, setLigado] = useState(inicial.ligado)
  const [chave, setChave] = useState(inicial.chave)
  const [links, setLinks] = useState<string[]>(inicial.config.dominios.length ? inicial.config.dominios : [''])
  const dominios = links.map((l) => l.trim()).filter(Boolean).join('\n')
  const [titulo, setTitulo] = useState(inicial.config.titulo)
  const [saudacao, setSaudacao] = useState(inicial.config.saudacao)
  const [cor, setCor] = useState(inicial.config.cor)
  const [pedirContato, setPedirContato] = useState(inicial.config.pedirContato)
  const [tema, setTema] = useState(inicial.config.tema)
  const [salvo, setSalvo] = useState(inicial.config)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [mascote, setMascote] = useState<Mascote | null>(inicial.config.mascote)
  const [avisoDoMascote, setAvisoDoMascote] = useState<string | null>(null)
  const [enviando, iniciarEnvio] = useTransition()
  const seletor = useRef<HTMLInputElement>(null)
  const [salvando, iniciar] = useTransition()

  const mudou =
    dominios !== salvo.dominios.join('\n') ||
    titulo !== salvo.titulo ||
    saudacao !== salvo.saudacao ||
    cor.toUpperCase() !== salvo.cor ||
    pedirContato !== salvo.pedirContato ||
    tema !== salvo.tema

  const trecho = chave ? `<script src="${urlDoScript}" data-chave="${chave}" async></script>` : ''
  const semDominio = salvo.dominios.length === 0

  function alternar() {
    const antes = ligado
    setLigado(!antes)
    setAviso(null)
    iniciar(async () => {
      if (antes) {
        const r = await acaoPausarChatDoSite(clienteId)
        if (!r.ok) {
          setLigado(antes)
          setAviso({ tom: 'erro', texto: r.erro })
        }
        return
      }
      const r = await acaoLigarChatDoSite(clienteId)
      if (!r.ok) {
        setLigado(antes)
        setAviso({ tom: 'erro', texto: r.erro })
        return
      }
      setChave(r.chave)
    })
  }

  function salvar() {
    setAviso(null)
    iniciar(async () => {
      const r = await acaoSalvarChatDoSite(clienteId, { dominios, cor, titulo, saudacao, pedirContato, tema })
      if (!r.ok) {
        setAviso({ tom: 'erro', texto: r.erro })
        return
      }
      setSalvo(r.config)
      setChave(r.chave)
      setLinks(r.config.dominios.length ? r.config.dominios : [''])
      setTitulo(r.config.titulo)
      setSaudacao(r.config.saudacao)
      setCor(r.config.cor)
      setTema(r.config.tema)
      setAviso(
        r.recusados.length
          ? { tom: 'erro', texto: `Salvo, mas estes endereços não foram aceitos: ${r.recusados.join(', ')}.` }
          : { tom: 'ok', texto: 'Salvo. O balão já usa a versão nova.' },
      )
    })
  }

  function enviarMascote(arquivo: File) {
    setAvisoDoMascote(null)
    // A prévia troca na hora pelo arquivo local; o endereço definitivo chega
    // quando o servidor terminar, e volta ao anterior se ele recusar.
    const antes = mascote
    const local = URL.createObjectURL(arquivo)
    setMascote({ url: local, tipo: arquivo.type.startsWith('video/') ? 'video' : 'imagem' })
    const dados = new FormData()
    dados.set('clienteId', clienteId)
    dados.set('arquivo', arquivo)
    iniciarEnvio(async () => {
      const r = await acaoSubirMascote(dados)
      if (!r.ok) {
        setMascote(antes)
        setAvisoDoMascote(r.erro)
      } else {
        setMascote(r.mascote)
      }
      URL.revokeObjectURL(local)
    })
  }

  function tirarMascote() {
    const antes = mascote
    setMascote(null)
    setAvisoDoMascote(null)
    iniciarEnvio(async () => {
      const r = await acaoTirarMascote(clienteId)
      if (!r.ok) {
        setMascote(antes)
        setAvisoDoMascote(r.erro)
      }
    })
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(trecho)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2200)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className="app-card flex flex-wrap items-center gap-4 px-5 py-4">
          <span
            className={`size-2.5 shrink-0 rounded-full ${ligado ? 'bg-emerald-500' : 'bg-strong'}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">
              {ligado ? 'O balão está ligado' : inicial.existe || chave ? 'O balão está pausado' : 'O chat do site ainda não foi ligado'}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-5 text-dim">
              {ligado
                ? semDominio
                  ? 'Falta dizer em quais endereços ele pode aparecer.'
                  : `Responde em ${salvo.dominios.join(', ')}.`
                : 'Ligado, ele aparece em todas as páginas onde o trecho estiver instalado.'}
            </p>
          </div>
          <button
            type="button"
            onClick={alternar}
            disabled={salvando}
            className={`rounded-[10px] px-4 py-2 text-[13px] font-bold transition disabled:opacity-60 ${
              ligado ? 'border border-line text-ink hover:bg-surface' : 'bg-primary text-white hover:bg-primary-strong'
            }`}
          >
            {ligado ? 'Pausar' : inicial.existe || chave ? 'Religar' : 'Ligar o chat do site'}
          </button>
        </section>

        <section className="app-card px-5 py-5">
          <h2 className="text-[15px] font-bold">Onde o balão aparece</h2>
          <p className="mt-1 max-w-[560px] text-[12.5px] leading-5 text-dim">
            O balão só responde nestes endereços: se alguém copiar o trecho para outro site, ele não abre lá. Com e sem
            www contam como o mesmo.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {links.map((link, i) => (
              <div key={i}>
                <label htmlFor={`link-${i}`} className="text-[12.5px] font-semibold text-muted">
                  Link {i + 1}
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id={`link-${i}`}
                    value={link}
                    onChange={(e) => setLinks(links.map((l, j) => (j === i ? e.target.value : l)))}
                    spellCheck={false}
                    autoComplete="off"
                    inputMode="url"
                    placeholder="Exemplo: pcyes.com.br"
                    className="app-field min-w-0 flex-1 px-[13px] py-[10px] text-[13.5px]"
                  />
                  {links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLinks(links.filter((_, j) => j !== i))}
                      aria-label={`Remover o link ${i + 1}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-[9px] text-dim transition hover:bg-rose-400/[0.08] hover:text-perigo"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {links.length < TETO_DE_DOMINIOS && (
            <button
              type="button"
              onClick={() => {
                setLinks([...links, ''])
                // O campo novo ganha o foco: quem clicou em adicionar vai digitar.
                setTimeout(() => document.getElementById(`link-${links.length}`)?.focus(), 0)
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-[9px] px-2 py-1.5 -ml-2 text-[13px] font-semibold text-primary transition hover:bg-primary-weak"
            >
              <span aria-hidden className="text-[16px] leading-none">+</span> Adicionar outro link
            </button>
          )}
        </section>

        <section className="app-card px-5 py-5">
          <h2 className="text-[15px] font-bold">Aparência</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[12.5px] font-semibold text-muted">Nome no topo da conversa</span>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={TETO_DO_TITULO}
                placeholder="Exemplo: Atendimento PCYES"
                className="app-field mt-1.5 w-full px-[13px] py-[10px] text-[13.5px]"
              />
            </label>
            <div>
              <span className="text-[12.5px] font-semibold text-muted">Cor</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    aria-label={`Usar a cor ${c}`}
                    aria-pressed={cor.toUpperCase() === c}
                    style={{ background: c }}
                    className={`size-7 rounded-full transition ${
                      cor.toUpperCase() === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-panel' : 'hover:scale-110'
                    }`}
                  />
                ))}
                <label className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-strong text-[14px] text-dim" title="Outra cor">
                  +
                  <input
                    type="color"
                    value={cor}
                    onChange={(e) => setCor(e.target.value.toUpperCase())}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Escolher outra cor"
                  />
                </label>
                <code className="ml-1 font-mono text-[12px] text-dim">{cor.toUpperCase()}</code>
              </div>
            </div>
            <div className="md:col-span-2">
              <span className="text-[12.5px] font-semibold text-muted">Fundo do balão</span>
              <div role="radiogroup" aria-label="Fundo do balão" className="mt-1.5 grid max-w-[360px] grid-cols-2 gap-2">
                {(
                  [
                    ['claro', 'Claro', '#FFFFFF', '#F2F3F5'],
                    ['escuro', 'Escuro', '#15161A', '#24262D'],
                  ] as const
                ).map(([valor, rotulo, fundo, bolha]) => (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={tema === valor}
                    onClick={() => setTema(valor)}
                    className={`flex items-center gap-2.5 rounded-[11px] border px-3 py-2.5 text-left text-[13px] font-semibold transition ${
                      tema === valor ? 'border-primary bg-primary-weak text-ink' : 'border-line hover:bg-surface'
                    }`}
                  >
                    <span
                      aria-hidden
                      style={{ background: fundo }}
                      className="flex h-7 w-10 shrink-0 flex-col justify-center gap-[3px] rounded-[6px] border border-line px-1.5"
                    >
                      <span style={{ background: bolha }} className="h-1.5 w-5 rounded-full" />
                      <span style={{ background: cor }} className="h-1.5 w-4 self-end rounded-full" />
                    </span>
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
            <label className="block md:col-span-2">
              <span className="text-[12.5px] font-semibold text-muted">Primeira frase do balão</span>
              <textarea
                value={saudacao}
                onChange={(e) => setSaudacao(e.target.value)}
                maxLength={TETO_DA_SAUDACAO}
                rows={2}
                placeholder="Exemplo: Olá! Procurando um periférico? Fale com a gente."
                className="app-field mt-1.5 w-full resize-y px-[13px] py-[10px] text-[13.5px]"
              />
              <span className="mt-1 block text-[11.5px] text-dim">
                Aparece antes de a pessoa escrever. Depois disso, quem responde é o fluxo
                {fluxoPrincipal ? ` "${fluxoPrincipal}"` : ''}, o mesmo do WhatsApp.
              </span>
            </label>
          </div>
        </section>

        <section className="app-card flex flex-wrap items-center gap-5 px-5 py-5">
          <span
            style={{ background: cor }}
            className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_10px_24px_-10px_rgba(22,24,29,.55)]"
          >
            <IconeDoBotao mascote={mascote} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold">Personagem do botão</h2>
            <p className="mt-1 max-w-[520px] text-[12.5px] leading-5 text-dim">
              {mascote
                ? 'O botão do balão usa a animação da loja.'
                : 'Hoje é o robô que acena. Mande a animação do personagem da marca para ele aparecer no lugar.'}{' '}
              GIF, WebP, PNG ou MP4 em loop, até 3,5 MB. Quadrada fica melhor: o botão é redondo.
            </p>
            {avisoDoMascote && <p className="mt-2 text-[12.5px] font-semibold text-perigo">{avisoDoMascote}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={seletor}
                type="file"
                accept="image/gif,image/webp,image/png,video/mp4"
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0]
                  if (arquivo) enviarMascote(arquivo)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                disabled={enviando}
                onClick={() => seletor.current?.click()}
                className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-bold transition hover:bg-surface disabled:opacity-60"
              >
                {enviando ? 'Enviando' : mascote ? 'Trocar animação' : 'Enviar animação'}
              </button>
              {mascote && (
                <button
                  type="button"
                  disabled={enviando}
                  onClick={tirarMascote}
                  className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-dim transition hover:bg-surface hover:text-ink disabled:opacity-60"
                >
                  Voltar ao robô
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="app-card flex items-start gap-4 px-5 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold">Pedir nome e contato</h2>
            <p className="mt-1 max-w-[560px] text-[12.5px] leading-5 text-dim">
              Depois da primeira resposta, o balão pergunta o nome e um WhatsApp ou e-mail. Sem isso, a conversa fica no
              Inbox como visitante anônimo, e some se a pessoa trocar de navegador.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pedirContato}
            aria-label="Pedir nome e contato"
            onClick={() => setPedirContato(!pedirContato)}
            className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${pedirContato ? 'bg-primary' : 'bg-strong'}`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${pedirContato ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !mudou}
            className="rounded-[10px] bg-primary px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-primary-strong disabled:opacity-45"
          >
            {salvando ? 'Salvando' : 'Salvar alterações'}
          </button>
          {aviso && (
            <p className={`text-[12.5px] font-semibold ${aviso.tom === 'ok' ? 'text-ok' : 'text-perigo'}`} role="status">
              {aviso.texto}
            </p>
          )}
        </div>
      </div>

      <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6">
        <Previa titulo={titulo} saudacao={saudacao} cor={cor} mascote={mascote} tema={tema} />

        <section className="app-card px-5 py-5">
          <h2 className="text-[15px] font-bold">Instalar no site</h2>
          {trecho ? (
            <>
              <p className="mt-1 text-[12.5px] leading-5 text-dim">Uma linha, colada uma vez, vale para todas as páginas.</p>
              <div className="relative mt-3 rounded-[12px] border border-line bg-surface">
                <pre className="overflow-x-auto px-4 py-3.5 pr-24 font-mono text-[12px] leading-5 whitespace-pre-wrap break-all text-soft">
                  {trecho}
                </pre>
                <button
                  type="button"
                  onClick={copiar}
                  className="absolute top-2.5 right-2.5 rounded-[8px] border border-line bg-panel px-2.5 py-1.5 text-[12px] font-bold transition hover:bg-surface"
                >
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-[12.5px] leading-5 text-muted">
                <li className="flex gap-2.5">
                  <Passo n={1} />
                  <span>
                    No painel do Magento, abra <strong className="text-soft">Conteúdo › Design › Configuração</strong> e edite
                    a loja.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <Passo n={2} />
                  <span>
                    Em <strong className="text-soft">Rodapé › HTML diverso</strong> (Miscellaneous HTML), cole a linha no fim
                    e salve.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <Passo n={3} />
                  <span>
                    Limpe o cache em <strong className="text-soft">Sistema › Gerenciamento de cache</strong> e abra o site:
                    o balão aparece no canto de baixo.
                  </span>
                </li>
              </ol>
              {semDominio && (
                <p className="mt-4 rounded-[10px] bg-aviso/10 px-3 py-2 text-[12px] leading-5 font-semibold text-aviso">
                  Antes de colar, cadastre o endereço do site em &quot;Onde o balão aparece&quot;. Sem ele, o balão não abre.
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-[12.5px] leading-5 text-dim">
              Ligue o chat do site para gerar a linha que vai no HTML da loja.
            </p>
          )}
        </section>
      </aside>
    </div>
  )
}

function Passo({ n }: { n: number }) {
  return (
    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[11px] font-bold text-soft">
      {n}
    </span>
  )
}

/**
 * O balão como o visitante vai ver, desenhado com os valores da tela.
 *
 * É uma imitação, e não o script de verdade num iframe: o script precisa de
 * canal ligado e domínio cadastrado para abrir, e a prévia tem que funcionar
 * antes de as duas coisas existirem. As medidas e as cores são as do
 * `public/chat/v1.js`.
 */
function Previa({
  titulo,
  saudacao,
  cor,
  mascote,
  tema,
}: {
  titulo: string
  saudacao: string
  cor: string
  mascote: Mascote | null
  tema: 'claro' | 'escuro'
}) {
  const escuro = tema === 'escuro'
  const t = escuro
    ? { fundo: '#15161A', tinta: '#F3F4F6', bolha: '#24262D', linha: '#2B2E36', dica: '#6B7080', opcao: `color-mix(in srgb, ${cor} 55%, #fff)` }
    : { fundo: '#FFFFFF', tinta: '#16181D', bolha: '#F2F3F5', linha: '#E7E8EC', dica: '#9CA0A8', opcao: `color-mix(in srgb, ${cor} 85%, #000)` }
  return (
    <section
      aria-label="Prévia do balão"
      className="relative overflow-hidden rounded-[18px] border border-line bg-[linear-gradient(180deg,var(--surface)_0%,var(--canvas-deep)_100%)] p-5"
    >
      <div aria-hidden className="mb-4 flex gap-2">
        <span className="h-2 w-16 rounded-full bg-surface-strong" />
        <span className="h-2 w-10 rounded-full bg-surface-strong" />
        <span className="h-2 w-12 rounded-full bg-surface-strong" />
      </div>
      <div style={{ background: t.fundo, color: t.tinta }} className="mx-auto flex w-full max-w-[330px] flex-col overflow-hidden rounded-[18px] shadow-[0_24px_60px_-18px_rgba(22,24,29,.45),0_0_0_1px_rgba(22,24,29,.06)]">
        <div style={{ background: cor }} className="flex items-center gap-3 px-4 py-3.5 text-white">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-bold">{titulo || 'Atendimento'}</p>
            <p className="text-[11.5px] opacity-85">Respondemos por aqui mesmo</p>
          </div>
          <span className="flex size-7 items-center justify-center rounded-[8px] bg-white/15 text-[15px]">×</span>
        </div>
        <div className="flex flex-col gap-1.5 px-3.5 pt-4 pb-3 text-[13.5px] leading-[1.45]">
          <p style={{ background: t.bolha }} className="max-w-[85%] self-start rounded-[16px] rounded-bl-[5px] px-3 py-2 whitespace-pre-wrap">
            {saudacao || 'Olá! Como podemos ajudar?'}
          </p>
          <p style={{ background: cor }} className="max-w-[85%] self-end rounded-[16px] rounded-br-[5px] px-3 py-2 text-white">
            Vocês têm teclado mecânico?
          </p>
          <p style={{ background: t.bolha }} className="max-w-[85%] self-start rounded-[16px] rounded-bl-[5px] px-3 py-2">
            Temos! Você prefere com fio ou sem fio?
          </p>
          <div className="mt-1 flex flex-col gap-1.5">
            {['Com fio', 'Sem fio'].map((o) => (
              <span
                key={o}
                style={{ borderColor: `color-mix(in srgb, ${cor} 40%, ${t.linha})`, color: t.opcao }}
                className="rounded-[11px] border-[1.5px] px-3 py-2 text-[13px] font-semibold"
              >
                {o}
              </span>
            ))}
          </div>
        </div>
        <div style={{ borderColor: t.linha }} className="flex items-center gap-2 border-t px-3.5 py-2.5">
          <span style={{ color: t.dica }} className="flex-1 text-[13px]">Escreva sua mensagem</span>
          <span style={{ background: cor }} className="flex size-8 items-center justify-center rounded-[10px] text-white">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden>
              <path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" />
            </svg>
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <span
          style={{ background: cor }}
          className="flex size-14 items-center justify-center overflow-hidden rounded-full shadow-[0_10px_24px_-8px_rgba(22,24,29,.5)]"
          aria-hidden
        >
          <IconeDoBotao mascote={mascote} />
        </span>
      </div>
    </section>
  )
}

/**
 * O robô do botão, igual ao de `public/chat/v1.js`, acenando em loop. Mantido
 * em espelho à mão: são duas cópias pequenas, e o script do balão não pode
 * importar nada daqui.
 */
function Robo() {
  return (
    <svg viewBox="7 3 52 52" width="44" height="44" className="robo-previa overflow-visible">
      <style>{`
        .robo-previa .braco{transform-origin:47px 41px;animation:robo-acena 3.6s ease-in-out infinite}
        .robo-previa .olhos{transform-origin:32px 31px;animation:robo-pisca 4.2s infinite}
        .robo-previa .antena{animation:robo-respira 1.8s ease-in-out infinite}
        @keyframes robo-acena{0%,52%,100%{transform:rotate(0)}8%{transform:rotate(-24deg)}16%{transform:rotate(10deg)}24%{transform:rotate(-24deg)}32%{transform:rotate(10deg)}42%{transform:rotate(0)}}
        @keyframes robo-pisca{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
        @keyframes robo-respira{0%,100%{opacity:1}50%{opacity:.35}}
        @media (prefers-reduced-motion:reduce){.robo-previa *{animation:none!important}}
      `}</style>
      <g className="braco">
        <path d="M47 41 Q54 39 56 30" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="56.5" cy="27" r="4.6" fill="#fff" />
      </g>
      <line x1="32" y1="19" x2="32" y2="12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle className="antena" cx="32" cy="10" r="3.4" fill="#FFD43B" />
      <rect x="11.5" y="28" width="5" height="10" rx="2.5" fill="#fff" opacity=".85" />
      <rect x="15" y="19" width="34" height="28" rx="10" fill="#fff" />
      <rect x="19.5" y="24.5" width="25" height="15" rx="7.5" fill="#16181D" />
      <g className="olhos">
        <rect x="24.5" y="28.5" width="4.6" height="5.6" rx="2.3" fill="#6EE7F9" />
        <rect x="34.9" y="28.5" width="4.6" height="5.6" rx="2.3" fill="#6EE7F9" />
      </g>
      <path d="M28.5 36.2 Q32 38.4 35.5 36.2" stroke="#6EE7F9" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <rect x="25" y="47" width="14" height="5" rx="2.5" fill="#fff" opacity=".85" />
    </svg>
  )
}

/** O que vai dentro do botão: a animação da loja, ou o robô padrão. */
function IconeDoBotao({ mascote }: { mascote: Mascote | null }) {
  if (!mascote) return <Robo />
  if (mascote.tipo === 'video') {
    return <video src={mascote.url} muted autoPlay loop playsInline className="size-full object-cover" aria-hidden />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mascote.url} alt="" className="size-full object-cover" />
}
