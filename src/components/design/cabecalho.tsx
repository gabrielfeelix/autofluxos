'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { acaoSair } from '@/server/acoes-conta'
import { LinhaDePresenca } from '@/components/conta/linha-de-presenca'
import { usePresenca } from '@/components/conta/presenca'
import { EditarPerfil, TrocarSenha, useMudarPerfil, usePerfil } from '@/components/conta/voce'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { INDICE } from '@/components/ajuda/indice'
import { Avatar } from './avatar'
import { acesoDoCaminho } from './aba-do-caminho'
import { SECOES } from './secoes-do-cliente'
import { definirPreferencia, usePreferencia } from './tema'

/**
 * O cabeçalho das telas da organização, no computador.
 *
 * Nasceu para tirar do rodapé da barra o que é **da pessoa e da conta**, e não
 * de uma seção: perfil, tema, plano, avisos, ajuda. O modelo é o da Brevo, que
 * o dono trouxe: baixo (56px), a página à esquerda e as portas à direita.
 *
 * O que cada um vê sai do servidor já filtrado (`cabecalho-do-cliente.tsx`):
 * consultor não recebe "Uso e plano", "Meu plano" nem os avisos de plano, e
 * não é esconder na tela, é não mandar. As ações conferem de novo do lado delas.
 */

export type AvisoDoCabecalho = {
  id: string
  /** ISO. Nulo é aviso de estado (atividade atrasada), que não conta como novo. */
  quando: string | null
  tom: 'ok' | 'perigo' | 'info'
  titulo: string
  texto: string
  href?: string
}

const WHATSAPP_DA_4YU = 'https://wa.me/5544998775978'
const EMAIL_DA_4YU = 'contato@4yu.com.br'

export function Cabecalho({
  base,
  email,
  papel,
  suporte,
  presenca,
  planoHref,
  ajustesHref,
  outrasContas,
  sino,
  avisosDoNavegador,
}: {
  base: string
  email: string
  /** "Proprietário", "Consultor"... */
  papel: string
  /** Entrou pela administração, sem ser membro. */
  suporte: boolean
  presenca: string | null
  /** Só para quem administra a conta. */
  planoHref: string | null
  ajustesHref: string | null
  outrasContas: number
  /** O sino chega por Suspense: o cabeçalho não espera os avisos. */
  sino: ReactNode
  /** O interruptor de notificação do navegador, que já existe no Inbox. */
  avisosDoNavegador: ReactNode
}) {
  const [ajudaAberta, setAjudaAberta] = useState(false)

  return (
    <header className="cabecalho-do-cliente hidden h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-6 md:flex lg:px-[42px]">
      <OndeEstou base={base} />

      <div className="ml-auto flex items-center gap-1">
        {planoHref && (
          <Link href={planoHref} className="cabecalho-acao px-2.5">
            <IconeUso />
            <span>Uso e plano</span>
          </Link>
        )}
        <button type="button" onClick={() => setAjudaAberta(true)} aria-label="Ajuda" title="Ajuda" className="cabecalho-acao size-9 justify-center">
          <IconeAjuda />
        </button>
        {ajustesHref && (
          <Link href={ajustesHref} aria-label="Configurações" title="Configurações" className="cabecalho-acao size-9 justify-center">
            <IconeEngrenagem />
          </Link>
        )}
        {sino}
        <span aria-hidden className="mx-1.5 h-5 w-px bg-line" />
        <MenuDoPerfil
          email={email}
          papel={papel}
          suporte={suporte}
          presenca={presenca}
          planoHref={planoHref}
          ajustesHref={ajustesHref}
          outrasContas={outrasContas}
          avisosDoNavegador={avisosDoNavegador}
        />
      </div>

      <GavetaDeAjuda aberta={ajudaAberta} aoFechar={() => setAjudaAberta(false)} />
    </header>
  )
}

/** "CRM › Contatos": o mesmo item que a barra acende, lido do endereço. */
function OndeEstou({ base }: { base: string }) {
  const caminho = usePathname()
  const busca = useSearchParams()
  const aceso = acesoDoCaminho(caminho, base, busca)
  const secao = SECOES.find((s) => s.chave === aceso?.secao)
  if (!secao) return <span className="min-w-0 flex-1" />
  const item = secao.itens.find((i) => i.id === aceso?.item)

  return (
    <nav aria-label="Onde você está" className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px]">
      {secao.solta || !item ? (
        <span className="truncate font-semibold text-ink">{item?.rotulo ?? secao.rotulo}</span>
      ) : (
        <>
          <span className="truncate text-dim">{secao.rotulo}</span>
          <span aria-hidden className="text-dim">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
          </span>
          <span className="truncate font-semibold text-ink">{item.rotulo}</span>
        </>
      )}
    </nav>
  )
}

/* ------------------------------------------------------------------ perfil */

function MenuDoPerfil({
  email,
  papel,
  suporte,
  presenca: presencaDoServidor,
  planoHref,
  ajustesHref,
  outrasContas,
  avisosDoNavegador,
}: {
  email: string
  papel: string
  suporte: boolean
  presenca: string | null
  planoHref: string | null
  ajustesHref: string | null
  outrasContas: number
  avisosDoNavegador: ReactNode
}) {
  const perfil = usePerfil()
  const mudar = useMudarPerfil()
  const escuro = usePreferencia('tema')
  const [aberto, setAberto] = useState<'perfil' | 'senha' | null>(null)
  const nome = perfil?.nome ?? 'Você'
  const primeiroNome = nome.split(' ')[0] || nome
  const presenca = usePresenca(presencaDoServidor)
  const disponivel = presenca === 'disponivel'

  return (
    <>
      <PopoverDoQuadro
        rotulo={`Você: ${nome}${presenca ? `, ${disponivel ? 'disponível' : 'ausente'}` : ''}`}
        largura={296}
        className="cabecalho-perfil"
        gatilho={
          <>
            <span className="relative flex shrink-0">
              <Avatar nome={nome} imagem={perfil?.imagem ?? null} tamanho={28} />
              {presenca && (
                <span aria-hidden className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-panel ${disponivel ? 'bg-emerald-500' : 'bg-dim'}`} />
              )}
            </span>
            <span className="max-w-[140px] truncate text-[13px] font-semibold text-ink">{primeiroNome}</span>
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-dim"><path d="m6 9 6 6 6-6" /></svg>
          </>
        }
      >
        <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
          <Avatar nome={nome} imagem={perfil?.imagem ?? null} tamanho={40} />
          <span className="min-w-0">
            <strong className="block truncate text-[13.5px] font-bold">{nome}</strong>
            <span className="block truncate text-[11.5px] text-dim">{email}</span>
            {suporte ? (
              <span className="mt-1 inline-block rounded-full bg-info/15 px-2 py-0.5 text-[10.5px] font-bold text-info">Suporte 4YU</span>
            ) : (
              <span className="mt-1 inline-block rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-semibold text-muted">{papel}</span>
            )}
          </span>
        </div>

        {/* O que se liga e desliga no dia a dia fica junto e em cima: a pessoa
            abre o menu para isso muito mais do que para trocar senha. */}
        <div className="mx-1 mb-1 rounded-xl border border-line bg-surface/40 p-0.5">
          <LinhaDePresenca doServidor={presencaDoServidor} />
          {avisosDoNavegador}
        </div>

        <Grupo>
          <ItemDoMenu icone={<IconePessoa />} aoClicar={() => setAberto('perfil')}>Meu perfil</ItemDoMenu>
          <ItemDoMenu icone={<IconeChave />} aoClicar={() => setAberto('senha')}>Trocar senha</ItemDoMenu>
          <div className="flex items-center gap-2.5 px-[9px] py-1.5">
            <span aria-hidden className="text-dim">{escuro ? <IconeLua /> : <IconeSol />}</span>
            <span className="flex-1 text-[12.5px] font-medium text-soft">Tema</span>
            <div role="radiogroup" aria-label="Tema" className="flex rounded-lg bg-surface p-0.5 text-[11.5px] font-semibold">
              {([['Claro', false], ['Escuro', true]] as const).map(([rotulo, valor]) => (
                <button
                  key={rotulo}
                  type="button"
                  role="radio"
                  aria-checked={escuro === valor}
                  onClick={() => definirPreferencia('tema', valor)}
                  className={`rounded-md px-2.5 py-1 transition ${escuro === valor ? 'bg-panel text-ink shadow-sm' : 'text-dim hover:text-ink'}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        </Grupo>

        {(planoHref || ajustesHref || outrasContas > 1) && (
          <Grupo>
            {planoHref && <ItemDoMenu icone={<IconeCartao />} href={planoHref}>Meu plano</ItemDoMenu>}
            {ajustesHref && <ItemDoMenu icone={<IconeEngrenagem tamanho={16} />} href={ajustesHref}>Configurações</ItemDoMenu>}
            {outrasContas > 1 && <ItemDoMenu icone={<IconeTrocar />} href="/contas">Trocar de organização</ItemDoMenu>}
          </Grupo>
        )}

        <Grupo>
          <form action={acaoSair}>
            <button type="submit" className="quadro-menu-item text-[12.5px] font-medium text-soft hover:!bg-perigo/10 hover:text-perigo">
              <span aria-hidden className="text-dim"><IconeSair /></span>
              Sair
            </button>
          </form>
        </Grupo>
      </PopoverDoQuadro>

      {aberto === 'perfil' && perfil && mudar && (
        <EditarPerfil perfil={perfil} mudar={mudar} aoFechar={() => setAberto(null)} />
      )}
      {aberto === 'senha' && <TrocarSenha aoFechar={() => setAberto(null)} />}
    </>
  )
}

function Grupo({ children }: { children: ReactNode }) {
  return <div className="mt-1 border-t border-line pt-1">{children}</div>
}

function ItemDoMenu({ icone, href, aoClicar, children }: { icone: ReactNode; href?: string; aoClicar?: () => void; children: ReactNode }) {
  const conteudo = (
    <>
      <span aria-hidden className="text-dim">{icone}</span>
      <span className="flex-1">{children}</span>
    </>
  )
  const classe = 'quadro-menu-item text-[12.5px] font-medium text-soft'
  return href ? (
    <Link href={href} data-fechar-popover className={classe}>{conteudo}</Link>
  ) : (
    <button type="button" data-fechar-popover onClick={aoClicar} className={classe}>{conteudo}</button>
  )
}

/* -------------------------------------------------------------------- sino */

const CHAVE_DO_VISTO = 'autofluxos:avisos-vistos'

/*
 * Até quando a pessoa já viu os avisos, neste navegador. É conveniência: se o
 * armazenamento falhar, o ponto só aparece de novo, nada se perde.
 */
function lerVisto(): string {
  try {
    return localStorage.getItem(CHAVE_DO_VISTO) ?? ''
  } catch {
    return ''
  }
}
const assinantes = new Set<() => void>()
function gravarVisto(valor: string) {
  try {
    localStorage.setItem(CHAVE_DO_VISTO, valor)
  } catch {
    // Sem armazenamento, o ponto só volta a aparecer.
  }
  assinantes.forEach((avisar) => avisar())
}

export function Sino({ avisos }: { avisos: AvisoDoCabecalho[] | null }) {
  const visto = useSyncExternalStore(
    (avisar) => {
      assinantes.add(avisar)
      return () => assinantes.delete(avisar)
    },
    lerVisto,
    () => 'servidor',
  )
  // O destaque de "novo" usa o visto de antes de abrir: abrir grava o visto, e
  // sem guardar o anterior o destaque sumiria no mesmo clique que o mostra.
  const [vistoAntes, setVistoAntes] = useState<string | null>(null)
  const lista = avisos ?? []
  const maisNovo = lista.reduce((maior, aviso) => (aviso.quando && aviso.quando > maior ? aviso.quando : maior), '')
  const temNovo = visto !== 'servidor' && maisNovo !== '' && maisNovo > visto

  return (
    <PopoverDoQuadro
      rotulo={temNovo ? 'Avisos, há novidade' : 'Avisos'}
      largura={340}
      className="cabecalho-acao size-9 justify-center"
      gatilho={
        <span
          className="relative flex"
          onClick={() => {
            setVistoAntes(visto)
            if (maisNovo) gravarVisto(maisNovo)
          }}
        >
          <IconeSino />
          {temNovo && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-perigo ring-2 ring-panel" />}
        </span>
      }
    >
      <p className="quadro-menu-label">Avisos</p>
      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 pt-3 pb-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface text-dim"><IconeSino /></span>
          <p className="text-[12.5px] font-semibold text-soft">Nada novo por aqui</p>
          <p className="text-[11.5px] leading-5 text-dim">Resposta de pedido de plano e atividade atrasada aparecem aqui.</p>
        </div>
      ) : (
        <ul className="flex max-h-[360px] flex-col overflow-y-auto">
          {lista.map((aviso) => {
            const referencia = vistoAntes ?? visto
            const novo = referencia !== 'servidor' && !!aviso.quando && aviso.quando > referencia
            const corpo = (
              <>
                <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${aviso.tom === 'ok' ? 'bg-emerald-500' : aviso.tom === 'perigo' ? 'bg-perigo' : 'bg-primary'}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <strong className="flex-1 text-[12.5px] font-semibold text-ink">{aviso.titulo}</strong>
                    {/*
                      O popover é nativo e já vem no HTML do servidor. Na virada do
                      minuto o servidor escreve "há 11 min" e o navegador calcula
                      "há 12 min": o aviso é esperado, não erro.
                    */}
                    {aviso.quando && (
                      <time dateTime={aviso.quando} suppressHydrationWarning className="shrink-0 text-[10.5px] text-dim">
                        {haQuanto(aviso.quando)}
                      </time>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-5 text-dim">{aviso.texto}</span>
                </span>
              </>
            )
            const classe = `flex gap-2.5 rounded-lg px-2.5 py-2.5 text-left ${novo ? 'bg-primary-weak/60' : ''} ${aviso.href ? 'transition hover:bg-surface' : ''}`
            return (
              <li key={aviso.id}>
                {aviso.href ? <Link href={aviso.href} data-fechar-popover className={classe}>{corpo}</Link> : <div className={classe}>{corpo}</div>}
              </li>
            )
          })}
        </ul>
      )}
    </PopoverDoQuadro>
  )
}

/** O sino enquanto os avisos vêm: mesmo tamanho, sem ponto. */
export function SinoCarregando() {
  return (
    <span aria-hidden className="cabecalho-acao size-9 justify-center opacity-60">
      <IconeSino />
    </span>
  )
}

function haQuanto(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 60) return minutos <= 1 ? 'agora' : `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}

/* ------------------------------------------------------------------- ajuda */

/**
 * A ajuda abre de lado, sem tirar a pessoa da tela (como a Brevo): a dúvida
 * aparece no meio de um trabalho, e mandar para outra página perde o lugar.
 * É `<dialog>` modal para o foco ficar preso nela e o Esc fechar de graça.
 */
function GavetaDeAjuda({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (aberta && !dialogo.open) dialogo.showModal()
    if (!aberta && dialogo.open) dialogo.close()
  }, [aberta])

  const grupos = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return INDICE
    return INDICE.map((grupo) => ({ ...grupo, itens: grupo.itens.filter((item) => normalizar(item.rotulo).includes(termo)) })).filter((grupo) => grupo.itens.length > 0)
  }, [busca])

  return (
    <dialog
      ref={ref}
      aria-labelledby="titulo-da-ajuda"
      onClose={aoFechar}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar()
      }}
      className="gaveta-de-ajuda"
    >
      <div className="flex h-full flex-col">
        <div className="bg-primary-weak px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-da-ajuda" className="text-[21px] font-bold tracking-[-0.02em] text-ink">Precisa de ajuda?</h2>
              <p className="mt-1 text-[13px] text-soft">Aqui você acha o caminho, ou fala direto com a gente.</p>
            </div>
            <button type="button" onClick={aoFechar} aria-label="Fechar a ajuda" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-panel hover:text-ink">
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-panel px-3 focus-within:border-primary">
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-dim"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Pesquisar um assunto"
              aria-label="Pesquisar um assunto da ajuda"
              className="h-10 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-dim"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {!busca && (
            <div className="flex flex-col">
              <PortaDeAjuda icone={<IconeLivro />} titulo="Central de ajuda" texto="Como montar automações, perguntas, datas e integrações, com exemplo." href="/ajuda" />
              <PortaDeAjuda icone={<IconeWhatsapp />} titulo="Falar com o suporte" texto="Chama a 4YU no WhatsApp. Responde gente, em horário comercial." href={WHATSAPP_DA_4YU} externo />
              <PortaDeAjuda icone={<IconeEnvelope />} titulo="Escrever para a 4YU" texto={`Para pedido com calma, print ou planilha: ${EMAIL_DA_4YU}.`} href={`mailto:${EMAIL_DA_4YU}`} externo />
            </div>
          )}

          <div className={busca ? '' : 'mt-3 border-t border-line pt-3'}>
            {grupos.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] text-dim">
                Nada com &ldquo;{busca}&rdquo;. Chama a gente no{' '}
                <a href={WHATSAPP_DA_4YU} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">WhatsApp</a>.
              </p>
            ) : (
              grupos.map((grupo) => (
                <div key={grupo.grupo} className="mb-2">
                  <p className="quadro-menu-label">{grupo.grupo}</p>
                  {grupo.itens.map((item) => (
                    <a key={item.id} href={`/ajuda#${item.id}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-[12.5px] font-medium text-soft transition hover:bg-surface hover:text-ink">
                      {item.rotulo}
                      <span aria-hidden className="text-dim">›</span>
                    </a>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </dialog>
  )
}

function PortaDeAjuda({ icone, titulo, texto, href, externo }: { icone: ReactNode; titulo: string; texto: string; href: string; externo?: boolean }) {
  return (
    <a href={href} {...(externo ? { target: '_blank', rel: 'noreferrer' } : {})} className="flex gap-3.5 rounded-xl px-3 py-3 transition hover:bg-surface">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-weak text-primary">{icone}</span>
      <span className="min-w-0">
        <strong className="block text-[13.5px] font-semibold text-ink">{titulo}</strong>
        <span className="mt-0.5 block text-[12px] leading-5 text-dim">{texto}</span>
      </span>
    </a>
  )
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/* ------------------------------------------------------------------ ícones */

function Traco({ children, tamanho = 18 }: { children: ReactNode; tamanho?: number }) {
  return (
    <svg aria-hidden width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}
const IconeUso = () => <Traco tamanho={17}><path d="M3 12h4l3-8 4 16 3-8h4" /></Traco>
const IconeAjuda = () => <Traco><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 3.8" /><path d="M12 17.2h.01" /></Traco>
const IconeEngrenagem = ({ tamanho = 18 }: { tamanho?: number }) => <Traco tamanho={tamanho}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Traco>
const IconeSino = () => <Traco><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></Traco>
const IconePessoa = () => <Traco tamanho={16}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /></Traco>
const IconeChave = () => <Traco tamanho={16}><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14.5 8.5l2 2" /></Traco>
const IconeCartao = () => <Traco tamanho={16}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></Traco>
const IconeTrocar = () => <Traco tamanho={16}><path d="M4 7h13l-3-3M20 17H7l3 3" /></Traco>
const IconeSair = () => <Traco tamanho={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Traco>
const IconeSol = () => <Traco tamanho={16}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Traco>
const IconeLua = () => <Traco tamanho={16}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></Traco>
const IconeLivro = () => <Traco><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 21h14" /><path d="M9 7h7M9 11h5" /></Traco>
const IconeEnvelope = () => <Traco><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Traco>
const IconeWhatsapp = () => <Traco><path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1Z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-.9.8a4 4 0 0 1-2.2-2.2l.8-.9-1-2Z" /></Traco>
