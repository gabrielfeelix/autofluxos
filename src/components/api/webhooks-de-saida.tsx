'use client'

import { useState, useTransition } from 'react'
import { Botao } from '@/components/design/botao'
import { useConfirmar } from '@/components/design/confirmar'
import { CampoParaCopiar } from '@/components/design/copiar'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { Pilula } from '@/components/design/pilula'
import { EVENTOS_DE_WEBHOOK, FALHAS_ATE_PAUSAR, type EventoDeWebhook } from '@/core/api/webhooks'
import {
  acaoApagarWebhook,
  acaoCriarWebhook,
  acaoEditarWebhook,
  acaoTestarWebhook,
  acaoTrocarSegredoDoWebhook,
} from '@/server/acoes-api'
import type { EntregaDeWebhook, WebhookDeSaida } from '@/server/repos/webhooks-de-saida'

/**
 * A seção Webhooks de Configurações > API: para onde o AutoFluxos avisa o
 * sistema do cliente, e o que aconteceu nas últimas entregas.
 *
 * Otimista como as chaves: ligar e desligar mudam na hora e voltam se o
 * servidor recusar; o webhook novo entra assim que o servidor devolve.
 */

const ROTULO_DO_EVENTO: Record<string, string> = {
  ...Object.fromEntries(EVENTOS_DE_WEBHOOK.map((e) => [e.chave, e.rotulo])),
  'webhook.teste': 'Teste',
}

const DOCS = '/ajuda/desenvolvedores/webhooks-de-saida'

const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function anfitriao(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function WebhooksDeSaida({
  clienteId,
  iniciais,
  entregasIniciais,
}: {
  clienteId: string
  iniciais: WebhookDeSaida[]
  entregasIniciais: EntregaDeWebhook[]
}) {
  const [webhooks, setWebhooks] = useState(iniciais)
  const [entregas, setEntregas] = useState(entregasIniciais)
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<WebhookDeSaida | null>(null)
  const [testando, setTestando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ webhookId: string; tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [segredoNovo, setSegredoNovo] = useState<string | null>(null)
  const { confirmar, dialogo } = useConfirmar()

  const trocar = (webhook: WebhookDeSaida) =>
    setWebhooks((lista) => lista.map((w) => (w.id === webhook.id ? webhook : w)))

  const alternar = async (webhook: WebhookDeSaida) => {
    const antes = webhook
    trocar({ ...webhook, ativo: !webhook.ativo, ...(webhook.ativo ? {} : { pausadoEm: null, falhasSeguidas: 0 }) })
    const r = await acaoEditarWebhook(clienteId, webhook.id, { ativo: !webhook.ativo })
    if (!r.ok) {
      trocar(antes)
      setAviso({ webhookId: webhook.id, tom: 'erro', texto: r.erro })
      return
    }
    trocar(r.webhook)
  }

  const testar = async (webhook: WebhookDeSaida) => {
    setTestando(webhook.id)
    setAviso(null)
    const r = await acaoTestarWebhook(clienteId, webhook.id)
    setTestando(null)
    if (!r.ok) {
      setAviso({ webhookId: webhook.id, tom: 'erro', texto: r.erro })
      return
    }
    setEntregas(r.entregas)
    const entrega = r.entrega
    if (entrega?.status === 'entregue') {
      setAviso({ webhookId: webhook.id, tom: 'ok', texto: `Recebido: o endereço respondeu ${entrega.ultimoStatusHttp}.` })
    } else {
      const motivo = entrega?.ultimoStatusHttp ? `respondeu ${entrega.ultimoStatusHttp}` : (entrega?.resposta ?? 'não respondeu')
      setAviso({ webhookId: webhook.id, tom: 'erro', texto: `Não chegou: ${motivo}` })
    }
  }

  const apagar = (webhook: WebhookDeSaida) =>
    confirmar({
      titulo: 'Apagar este webhook?',
      descricao: `${webhook.url} para de receber eventos na hora, e as entregas pendentes dele são descartadas.`,
      rotulo: 'Apagar webhook',
      tom: 'perigo',
      aoConfirmar: async () => {
        const antes = webhooks
        setWebhooks((lista) => lista.filter((w) => w.id !== webhook.id))
        setEditando(null)
        const r = await acaoApagarWebhook(clienteId, webhook.id)
        if (!r.ok) {
          setWebhooks(antes)
          return { ok: false, erro: r.erro }
        }
        setEntregas((lista) => lista.filter((e) => e.webhookId !== webhook.id))
      },
    })

  const trocarSegredo = (webhook: WebhookDeSaida) =>
    confirmar({
      titulo: 'Gerar um novo segredo?',
      descricao: 'O segredo atual para de valer agora. Atualize o seu sistema com o novo, senão ele vai recusar as assinaturas.',
      rotulo: 'Gerar novo segredo',
      tom: 'perigo',
      aoConfirmar: async () => {
        const r = await acaoTrocarSegredoDoWebhook(clienteId, webhook.id)
        if (!r.ok) return { ok: false, erro: r.erro }
        setEditando(null)
        setSegredoNovo(r.segredo)
      },
    })

  return (
    <section aria-labelledby="titulo-webhooks" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="titulo-webhooks" className="text-[15px] font-bold">
            Webhooks
          </h2>
          <p className="text-[12.5px] text-muted">
            O AutoFluxos avisa o seu sistema quando algo acontece aqui, com um POST assinado.
          </p>
        </div>
        <Botao variante="primario" onClick={() => setCriando(true)}>
          + Adicionar webhook
        </Botao>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line bg-panel px-6 py-10 text-center">
          <p className="text-[14px] font-semibold">Nenhum webhook</p>
          <p className="mx-auto mt-1 max-w-[460px] text-[12.5px] leading-5 text-muted">
            Mande para o seu CRM ou planilha cada contato novo, mudança de etapa e oportunidade ganha ou perdida,
            sem consultar a API.
          </p>
          <Botao variante="secundario" className="mt-4" onClick={() => setCriando(true)}>
            Adicionar o primeiro webhook
          </Botao>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-line bg-panel">
          {webhooks.map((webhook) => (
            <li key={webhook.id} className="border-b border-line px-5 py-4 last:border-0">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <span
                  aria-hidden
                  className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${webhook.ativo ? 'bg-primary-weak text-primary' : 'bg-surface text-dim'}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <code className={`min-w-0 truncate font-mono text-[12.5px] font-semibold ${webhook.ativo ? 'text-ink' : 'text-dim'}`}>
                      {webhook.url}
                    </code>
                    {webhook.pausadoEm ? (
                      <Pilula tom="perigo">pausado</Pilula>
                    ) : webhook.ativo ? (
                      <Pilula tom="ok">ligado</Pilula>
                    ) : (
                      <Pilula>desligado</Pilula>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {webhook.eventos.map((evento) => (
                      <Pilula key={evento} tom={webhook.ativo ? 'destaque' : 'neutro'}>
                        {ROTULO_DO_EVENTO[evento]}
                      </Pilula>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 self-start md:self-center">
                  <Botao variante="secundario" tamanho="sm" onClick={() => testar(webhook)} disabled={testando === webhook.id || !webhook.ativo}>
                    {testando === webhook.id ? 'Enviando…' : 'Testar'}
                  </Botao>
                  <Botao variante="secundario" tamanho="sm" onClick={() => alternar(webhook)}>
                    {webhook.ativo ? 'Desligar' : 'Religar'}
                  </Botao>
                  <Botao variante="fantasma" tamanho="sm" onClick={() => setEditando(webhook)}>
                    Editar
                  </Botao>
                </div>
              </div>
              {webhook.pausadoEm && (
                <p className="mt-3 rounded-[10px] border border-rose-400/25 bg-rose-400/[0.07] px-3.5 py-2.5 text-[12px] leading-5 text-soft">
                  Pausado sozinho em {hora(webhook.pausadoEm)} depois de {FALHAS_ATE_PAUSAR} falhas seguidas. Confira o
                  endereço, use Testar e religue.
                </p>
              )}
              {aviso?.webhookId === webhook.id && (
                <p role="status" className={`mt-2 text-[12px] ${aviso.tom === 'ok' ? 'text-ok' : 'text-perigo'}`}>
                  {aviso.texto}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {webhooks.length > 0 && <UltimasEntregas entregas={entregas} webhooks={webhooks} />}

      <FormularioDoWebhook
        key={editando?.id ?? 'novo'}
        aberto={criando || editando !== null}
        webhook={editando}
        clienteId={clienteId}
        aoFechar={() => {
          setCriando(false)
          setEditando(null)
        }}
        aoSalvar={(salvo, segredo) => {
          if (editando) trocar(salvo)
          else setWebhooks((lista) => [...lista, salvo])
          setCriando(false)
          setEditando(null)
          if (segredo) setSegredoNovo(segredo)
        }}
        aoApagar={editando ? () => apagar(editando) : undefined}
        aoTrocarSegredo={editando ? () => trocarSegredo(editando) : undefined}
      />

      <Modal aberto={segredoNovo !== null} aoFechar={() => setSegredoNovo(null)} largura={520} titulo="Segredo da assinatura">
        <div className="space-y-4">
          <div className="rounded-[10px] border border-amber-400/30 bg-amber-400/[0.08] px-3.5 py-3 text-[12.5px] leading-5 text-aviso">
            <strong>Guarde agora, ele não aparece de novo.</strong> O seu sistema usa este segredo para conferir que
            cada POST veio do AutoFluxos. Se perder, gere outro em Editar.
          </div>
          {segredoNovo && <CampoParaCopiar valor={segredoNovo} rotuloAcessivel="Copiar o segredo" />}
          <p className="text-[12px] leading-5 text-muted">
            Cada envio traz <code className="font-mono text-soft">x-autofluxos-assinatura</code> e{' '}
            <code className="font-mono text-soft">x-autofluxos-timestamp</code>.{' '}
            <a href={DOCS} className="font-semibold text-primary hover:underline">
              Como conferir a assinatura
            </a>
          </p>
          <div className="flex justify-end">
            <Botao variante="primario" onClick={() => setSegredoNovo(null)}>
              Já guardei
            </Botao>
          </div>
        </div>
      </Modal>
      {dialogo}
    </section>
  )
}

function SituacaoDaEntrega({ entrega }: { entrega: EntregaDeWebhook }) {
  if (entrega.status === 'entregue') return <Pilula tom="ok">{entrega.ultimoStatusHttp ?? 'ok'}</Pilula>
  if (entrega.status === 'falhou') return <Pilula tom="perigo">falhou</Pilula>
  if (entrega.tentativas === 0) return <Pilula>na fila</Pilula>
  return <Pilula tom="aviso">nova tentativa {hora(entrega.proximaEm).split(', ').pop()}</Pilula>
}

function UltimasEntregas({ entregas, webhooks }: { entregas: EntregaDeWebhook[]; webhooks: WebhookDeSaida[] }) {
  const urlDe = new Map(webhooks.map((w) => [w.id, w.url]))
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-[12px] font-semibold text-soft">Últimas entregas</h3>
      {entregas.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-panel px-5 py-4 text-[12.5px] text-muted">
          Nenhuma entrega ainda. Use Testar para mandar um evento de exemplo.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-line bg-panel">
          {entregas.slice(0, 15).map((entrega) => (
            <li key={entrega.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-5 py-2.5 text-[12.5px] last:border-0">
              <span className="w-[150px] shrink-0 font-semibold">{ROTULO_DO_EVENTO[entrega.evento] ?? entrega.evento}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-muted">{anfitriao(urlDe.get(entrega.webhookId) ?? '')}</span>
              <span className="text-[11.5px] text-dim tabular-nums">
                {entrega.tentativas > 1 ? `${entrega.tentativas} tentativas · ` : ''}
                {hora(entrega.criadoEm)}
              </span>
              <SituacaoDaEntrega entrega={entrega} />
              {entrega.status !== 'entregue' && entrega.resposta && (
                <span className="w-full truncate pl-0 text-[11.5px] text-muted md:pl-[162px]">{entrega.resposta}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormularioDoWebhook({
  aberto,
  webhook,
  clienteId,
  aoFechar,
  aoSalvar,
  aoApagar,
  aoTrocarSegredo,
}: {
  aberto: boolean
  webhook: WebhookDeSaida | null
  clienteId: string
  aoFechar: () => void
  aoSalvar: (webhook: WebhookDeSaida, segredo?: string) => void
  aoApagar?: () => void
  aoTrocarSegredo?: () => void
}) {
  const [url, setUrl] = useState(webhook?.url ?? '')
  const [eventos, setEventos] = useState<EventoDeWebhook[]>(webhook?.eventos ?? ['contato.criado'])
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const marcar = (evento: EventoDeWebhook) =>
    setEventos((lista) => (lista.includes(evento) ? lista.filter((e) => e !== evento) : [...lista, evento]))

  const salvar = () =>
    comecar(async () => {
      setErro(null)
      if (webhook) {
        const r = await acaoEditarWebhook(clienteId, webhook.id, { url, eventos })
        if (!r.ok) return setErro(r.erro)
        aoSalvar(r.webhook)
      } else {
        const r = await acaoCriarWebhook(clienteId, { url, eventos })
        if (!r.ok) return setErro(r.erro)
        aoSalvar(r.webhook, r.segredo)
        setUrl('')
        setEventos(['contato.criado'])
      }
    })

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      largura={540}
      titulo={webhook ? 'Editar webhook' : 'Adicionar webhook'}
      descricao={webhook ? undefined : 'Um POST com JSON para este endereço a cada evento marcado.'}
    >
      <form
        className="space-y-5"
        onSubmit={(evento) => {
          evento.preventDefault()
          salvar()
        }}
      >
        <label className="block">
          <RotuloCampo>Endereço</RotuloCampo>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            required
            autoFocus
            maxLength={2000}
            placeholder="Exemplo: https://seusistema.com.br/webhooks/autofluxos"
            className="app-field px-3 py-2.5 font-mono text-[12.5px]"
          />
          <span className="mt-1 block text-[11.5px] text-muted">Só https. Redirecionamento não é seguido.</span>
        </label>

        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold text-soft">Eventos</legend>
          <div className="space-y-1.5">
            {EVENTOS_DE_WEBHOOK.map((evento) => {
              const marcado = eventos.includes(evento.chave)
              return (
                <label
                  key={evento.chave}
                  className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2.5 transition ${
                    marcado ? 'border-primary/40 bg-primary-weak' : 'border-line hover:bg-surface'
                  }`}
                >
                  <input type="checkbox" checked={marcado} onChange={() => marcar(evento.chave)} className="mt-0.5 caixa-de-marcar" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{evento.rotulo}</span>
                    <span className="block text-[11.5px] leading-4 text-muted">{evento.explicacao}</span>
                    <code className="mt-0.5 block font-mono text-[10.5px] text-dim">{evento.chave}</code>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {erro && (
          <p role="alert" className="text-[12px] text-perigo">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {aoTrocarSegredo && (
              <Botao variante="fantasma" tamanho="sm" onClick={aoTrocarSegredo}>
                Gerar novo segredo
              </Botao>
            )}
            {aoApagar && (
              <Botao variante="fantasma" tamanho="sm" onClick={aoApagar} className="text-perigo">
                Apagar
              </Botao>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <Botao variante="secundario" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="primario" disabled={rodando || url.trim() === '' || eventos.length === 0}>
              {rodando ? 'Salvando…' : webhook ? 'Salvar' : 'Adicionar'}
            </Botao>
          </div>
        </div>
      </form>
    </Modal>
  )
}
