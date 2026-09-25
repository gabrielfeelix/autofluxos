'use client'

import { useState, useTransition } from 'react'
import type { ConfigDoSite } from '@/core/chat-do-site'
import { TETO_DA_SAUDACAO, TETO_DO_TITULO } from '@/core/chat-do-site'
import { acaoLigarChatDoSite, acaoPausarChatDoSite, acaoSalvarChatDoSite } from '@/server/acoes-site'

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
  const [dominios, setDominios] = useState(inicial.config.dominios.join('\n'))
  const [titulo, setTitulo] = useState(inicial.config.titulo)
  const [saudacao, setSaudacao] = useState(inicial.config.saudacao)
  const [cor, setCor] = useState(inicial.config.cor)
  const [pedirContato, setPedirContato] = useState(inicial.config.pedirContato)
  const [salvo, setSalvo] = useState(inicial.config)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [salvando, iniciar] = useTransition()

  const mudou =
    dominios.trim() !== salvo.dominios.join('\n') ||
    titulo !== salvo.titulo ||
    saudacao !== salvo.saudacao ||
    cor.toUpperCase() !== salvo.cor ||
    pedirContato !== salvo.pedirContato

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
      const r = await acaoSalvarChatDoSite(clienteId, { dominios, cor, titulo, saudacao, pedirContato })
      if (!r.ok) {
        setAviso({ tom: 'erro', texto: r.erro })
        return
      }
      setSalvo(r.config)
      setChave(r.chave)
      setDominios(r.config.dominios.join('\n'))
      setTitulo(r.config.titulo)
      setSaudacao(r.config.saudacao)
      setCor(r.config.cor)
      setAviso(
        r.recusados.length
          ? { tom: 'erro', texto: `Salvo, mas estes endereços não foram aceitos: ${r.recusados.join(', ')}.` }
          : { tom: 'ok', texto: 'Salvo. O balão já usa a versão nova.' },
      )
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
            Os endereços do site, um por linha. O balão só responde nestes: se alguém copiar o trecho para outro site,
            ele não abre lá. Com e sem www contam como o mesmo.
          </p>
          <textarea
            value={dominios}
            onChange={(e) => setDominios(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder={'Exemplo: pcyes.com.br'}
            className="app-field mt-3 w-full resize-y px-[13px] py-[11px] font-mono text-[13px]"
          />
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
        <Previa titulo={titulo} saudacao={saudacao} cor={cor} />

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
function Previa({ titulo, saudacao, cor }: { titulo: string; saudacao: string; cor: string }) {
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
      <div className="mx-auto flex w-full max-w-[330px] flex-col overflow-hidden rounded-[18px] bg-white text-[#16181D] shadow-[0_24px_60px_-18px_rgba(22,24,29,.45),0_0_0_1px_rgba(22,24,29,.06)]">
        <div style={{ background: cor }} className="flex items-center gap-3 px-4 py-3.5 text-white">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-bold">{titulo || 'Atendimento'}</p>
            <p className="text-[11.5px] opacity-85">Respondemos por aqui mesmo</p>
          </div>
          <span className="flex size-7 items-center justify-center rounded-[8px] bg-white/15 text-[15px]">×</span>
        </div>
        <div className="flex flex-col gap-1.5 px-3.5 pt-4 pb-3 text-[13.5px] leading-[1.45]">
          <p className="max-w-[85%] self-start rounded-[16px] rounded-bl-[5px] bg-[#F2F3F5] px-3 py-2 whitespace-pre-wrap">
            {saudacao || 'Olá! Como podemos ajudar?'}
          </p>
          <p style={{ background: cor }} className="max-w-[85%] self-end rounded-[16px] rounded-br-[5px] px-3 py-2 text-white">
            Vocês têm teclado mecânico?
          </p>
          <p className="max-w-[85%] self-start rounded-[16px] rounded-bl-[5px] bg-[#F2F3F5] px-3 py-2">
            Temos! Você prefere com fio ou sem fio?
          </p>
          <div className="mt-1 flex flex-col gap-1.5">
            {['Com fio', 'Sem fio'].map((o) => (
              <span
                key={o}
                style={{ borderColor: `color-mix(in srgb, ${cor} 40%, #E7E8EC)`, color: `color-mix(in srgb, ${cor} 85%, #000)` }}
                className="rounded-[11px] border-[1.5px] px-3 py-2 text-[13px] font-semibold"
              >
                {o}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-[#E7E8EC] px-3.5 py-2.5">
          <span className="flex-1 text-[13px] text-[#9CA0A8]">Escreva sua mensagem</span>
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
          className="flex size-12 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-8px_rgba(22,24,29,.5)]"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M12 3C6.9 3 3 6.5 3 10.9c0 2.4 1.2 4.6 3.1 6.1-.1 1.3-.6 2.6-1.5 3.6-.2.3 0 .7.4.7 1.9-.1 3.6-.8 4.9-1.9.7.2 1.4.2 2.1.2 5.1 0 9-3.5 9-7.9S17.1 3 12 3Z" />
          </svg>
        </span>
      </div>
    </section>
  )
}
