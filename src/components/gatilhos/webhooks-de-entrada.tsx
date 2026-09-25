'use client'

import { useState, useTransition } from 'react'
import {
  acaoAlternarWebhookDeEntrada,
  acaoApagarWebhookDeEntrada,
  acaoCriarWebhookDeEntrada,
} from '@/server/acoes'
import type { WebhookDeEntrada } from '@/server/repos/webhooks-de-entrada'
import { dataDaChamada, estadoDoWebhook } from '@/core/webhook-de-entrada'
import { depoisDaTela } from '@/components/inbox/conversa-local'

/**
 * Quem pode avisar este cliente de fora (0044).
 *
 * **A tela existe para resolver um problema de confiança, não de cadastro.** O
 * segredo aparece **uma vez**, no instante em que nasce, e some da tela para
 * sempre, porque não existe em lugar nenhum fora do cofre. Quem fechar sem
 * copiar gera outro, que é um clique. Guardar um jeito de reexibir seria
 * guardar um jeito de vazar.
 *
 * E a tela mostra **como assinar**, com o comando pronto. Sem isso, a
 * integração do outro lado é adivinhação: HMAC-SHA256 do corpo cru, hex, no
 * cabeçalho, cada um desses detalhes errado dá o mesmo 401 sem pista nenhuma.
 */
export function WebhooksDeEntrada({
  clienteId,
  webhooks,
  endereco,
}: {
  clienteId: string
  webhooks: WebhookDeEntrada[]
  /** A URL completa, montada no servidor: o navegador não sabe o domínio real. */
  endereco: string
}) {
  const [nome, setNome] = useState('')
  const [novo, setNovo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  function criar() {
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarWebhookDeEntrada(clienteId, nome)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setNovo(r.segredo)
      setNome('')
    })
  }

  return (
    <div className="px-5 py-4">
      {novo && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3">
          <p className="text-[12px] font-semibold text-aviso">
            Copie o segredo agora, ele não aparece de novo.
          </p>
          <code className="mt-2 block overflow-x-auto rounded bg-black/30 px-2.5 py-2 font-mono text-[11px] break-all text-soft">
            {novo}
          </code>
          <p className="mt-2 text-[10.5px] leading-4 text-dim">
            Ele fica guardado cifrado e nem nós conseguimos lê-lo de volta. Perdeu? Apague este
            webhook e crie outro.
          </p>
          <button
            type="button"
            onClick={() => setNovo(null)}
            className="mt-2 text-[11px] text-muted underline hover:text-soft"
          >
            Já copiei
          </button>
        </div>
      )}

      <EnderecoParaCopiar endereco={endereco} />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Nome de quem vai chamar
          </span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={80}
            placeholder="ex.: Agenda Verandi"
            className="app-field w-full px-[13px] py-[11px] text-[13.5px]"
          />
        </label>
        <button
          type="button"
          disabled={rodando || nome.trim() === ''}
          onClick={criar}
          className="rounded-lg border border-line bg-surface px-3.5 py-[11px] text-[12.5px] transition hover:border-strong disabled:opacity-50"
        >
          Gerar segredo
        </button>
      </div>

      {erro && (
        <p role="alert" className="mb-3 text-[11.5px] text-perigo">
          {erro}
        </p>
      )}

      {webhooks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-strong px-4 py-6 text-center text-[11.5px] leading-5 text-dim">
          Gere um segredo para liberar o endereço.
        </p>
      ) : (
        <ul className="mb-4">
          {webhooks.map((webhook) => (
            <LinhaDoWebhook key={webhook.id} clienteId={clienteId} webhook={webhook} />
          ))}
        </ul>
      )}

      <details className="rounded-lg border border-line bg-panel px-4 py-3">
        <summary className="cursor-pointer text-[12px] font-semibold text-soft">
          Como o outro sistema chama
        </summary>
        <p className="mt-2 text-[11px] leading-5 text-dim">
          <code className="font-mono text-muted">POST</code> no endereço abaixo, com o corpo em JSON
          e a assinatura <strong className="text-muted">HMAC-SHA256 do corpo cru</strong>, em
          hexadecimal, no cabeçalho <code className="font-mono text-muted">x-autofluxos-assinatura</code>{' '}
          prefixado por <code className="font-mono text-muted">sha256=</code>.
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-black/30 px-2.5 py-2 font-mono text-[10.5px] leading-5 text-soft">
{`corpo='{"evento":"vaga.aberta","telefone":"5511999998888"}'
assinatura=$(printf %s "$corpo" | openssl dgst -sha256 -hmac "SEU_SEGREDO" -hex | awk '{print $2}')

curl -X POST ${endereco} \\
  -H "content-type: application/json" \\
  -H "x-autofluxos-assinatura: sha256=$assinatura" \\
  -d "$corpo"`}
        </pre>
        <p className="mt-2 text-[10.5px] leading-4 text-dim">
          O <code className="font-mono">evento</code> precisa ser o mesmo nome cadastrado na lista
          acima, e o <code className="font-mono">telefone</code> tem que ser de alguém que já
          conversou com você, fora da janela de 24h do WhatsApp o aviso fica registrado na ficha,
          mas não é enviado.
        </p>
      </details>
    </div>
  )
}

/**
 * Uma linha da lista. Guarda o "ligado" dela porque o interruptor e o nome
 * riscado mostram o mesmo estado, e desde 25/set os dois mudam no clique: o
 * servidor grava por trás e, se recusar, a linha volta com o motivo.
 */
function LinhaDoWebhook({ clienteId, webhook }: { clienteId: string; webhook: WebhookDeEntrada }) {
  const [ativo, setAtivo] = useState(webhook.ativo)
  const [erro, setErro] = useState<string | null>(null)

  const alternar = () => {
    const antes = ativo
    setAtivo(!antes)
    setErro(null)
    const desfazer = (motivo: string) => {
      setAtivo(antes)
      setErro(motivo)
    }
    depoisDaTela(() => acaoAlternarWebhookDeEntrada(clienteId, webhook.id, !antes)).then(
      (r) => {
        if (!r.ok) desfazer(r.erro ?? 'não deu para mudar o webhook')
      },
      () => desfazer('não deu para mudar agora'),
    )
  }

  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <InterruptorDoWebhook ativo={ativo} aoAlternar={alternar} />
      <span className="min-w-0 flex-1">
        <strong className={`block truncate text-[13px] font-semibold ${ativo ? '' : 'text-dim line-through'}`}>
          {webhook.nome}
        </strong>
        <UltimaChamada webhook={webhook} />
        {erro && (
          <span role="alert" className="block text-[11px] leading-4 text-perigo">
            {erro}
          </span>
        )}
      </span>
      <BotaoApagar clienteId={clienteId} webhookId={webhook.id} nome={webhook.nome} />
    </li>
  )
}

function InterruptorDoWebhook({ ativo, aoAlternar }: { ativo: boolean; aoAlternar: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={ativo ? 'Desligar webhook' : 'Ligar webhook'}
      title={
        ativo
          ? 'Desligar: as chamadas passam a levar 401, e o segredo continua guardado.'
          : 'Ligar: as chamadas com este segredo voltam a valer.'
      }
      onClick={aoAlternar}
      className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:opacity-50 ${
        ativo ? 'border-emerald-400/40 bg-emerald-400/25' : 'border-line bg-surface-strong'
      }`}
    >
      <span
        className={`absolute top-[2px] size-3 rounded-full transition-all ${
          ativo ? 'left-[15px] bg-emerald-300' : 'left-[2px] bg-dim'
        }`}
      />
    </button>
  )
}

function BotaoApagar({
  clienteId,
  webhookId,
  nome,
}: {
  clienteId: string
  webhookId: string
  nome: string
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [rodando, comecar] = useTransition()

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        title="Apaga o webhook e o segredo."
        className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] text-dim transition hover:border-rose-400/40 hover:text-perigo"
      >
        Apagar
      </button>
    )
  }

  return (
    <span role="alertdialog" aria-label={`Apagar ${nome}`} className="flex max-w-[320px] shrink-0 flex-col items-end gap-1.5 text-right">
      <span className="text-[11px] leading-4 text-muted">
        Apagar “{nome}”? O sistema que chama este endereço com este segredo passa a ser recusado, e os
        avisos dele deixam de começar automações. Não dá para desfazer: um segredo novo precisa ser
        trocado lá também.
      </span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={rodando}
          onClick={() => comecar(async () => void (await acaoApagarWebhookDeEntrada(clienteId, webhookId)))}
          className="rounded-lg border border-rose-400/40 px-2.5 py-1 text-[11px] text-perigo disabled:opacity-50"
        >
          Apagar
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-dim"
        >
          Não
        </button>
      </span>
    </span>
  )
}

/**
 * O endereço que o outro sistema chama, com o botão de copiar.
 *
 * Antes ele só existia dentro do `curl` do "Como o outro sistema chama", e
 * copiar dali trazia junto a barra invertida da linha.
 */
function EnderecoParaCopiar({ endereco }: { endereco: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="mb-4">
      <span className="mb-1 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Endereço</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[11.5px] text-soft" title={endereco}>
          {endereco}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(endereco)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 2000)
            } catch {
              setCopiado(false)
            }
          }}
          className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold transition hover:border-strong"
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

/**
 * A última chamada: nunca, aceita ou recusada por assinatura (0095).
 *
 * "Ainda não chamou" e "chamou com a assinatura errada" eram a mesma frase, e
 * são dois problemas diferentes do outro lado: um é integração desligada, o
 * outro é segredo ou jeito de assinar errado.
 */
function UltimaChamada({ webhook }: { webhook: WebhookDeEntrada }) {
  const estado = estadoDoWebhook(webhook)
  if (estado.tipo === 'nunca') {
    return <span className="mt-0.5 block text-[11px] text-dim">Nunca chamado</span>
  }
  if (estado.tipo === 'autenticada') {
    return (
      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-dim">
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
        Autenticada em {dataDaChamada(estado.em)}
      </span>
    )
  }
  return (
    <span className="mt-0.5 block text-[11px] leading-4 text-perigo">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-perigo" />
        Assinatura inválida em {dataDaChamada(estado.em)}
      </span>
      <span className="block text-dim">
        Chegou uma chamada e nenhum segredo desta conta conferiu. Veja o exemplo abaixo.
      </span>
    </span>
  )
}
