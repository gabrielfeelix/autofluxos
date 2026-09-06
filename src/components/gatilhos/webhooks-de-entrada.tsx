'use client'

import { useState, useTransition } from 'react'
import {
  acaoAlternarWebhookDeEntrada,
  acaoApagarWebhookDeEntrada,
  acaoCriarWebhookDeEntrada,
} from '@/server/acoes'
import type { WebhookDeEntrada } from '@/server/repos/webhooks-de-entrada'

/**
 * Quem pode avisar este cliente de fora (0044).
 *
 * **A tela existe para resolver um problema de confiança, não de cadastro.** O
 * segredo aparece **uma vez**, no instante em que nasce, e some da tela para
 * sempre — porque não existe em lugar nenhum fora do cofre. Quem fechar sem
 * copiar gera outro, que é um clique. Guardar um jeito de reexibir seria
 * guardar um jeito de vazar.
 *
 * E a tela mostra **como assinar**, com o comando pronto. Sem isso, a
 * integração do outro lado é adivinhação: HMAC-SHA256 do corpo cru, hex, no
 * cabeçalho — cada um desses detalhes errado dá o mesmo 401 sem pista nenhuma.
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
      <p className="mb-3 text-[11.5px] leading-5 text-dim">
        Um sistema de fora — a agenda, o financeiro — avisa que algo aconteceu, e o evento abre um
        fluxo. É o que faz “te aviso quando abrir vaga” virar uma mensagem de verdade.
      </p>

      {novo && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3">
          <p className="text-[12px] font-semibold text-amber-200">
            Copie o segredo agora — ele não aparece de novo.
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
          className="rounded-lg border border-white/[0.09] bg-white/[0.05] px-3.5 py-[11px] text-[12.5px] transition hover:border-white/20 disabled:opacity-50"
        >
          Gerar segredo
        </button>
      </div>

      {erro && (
        <p role="alert" className="mb-3 text-[11.5px] text-rose-300">
          {erro}
        </p>
      )}

      {webhooks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/[0.12] px-4 py-6 text-center text-[11.5px] leading-5 text-dim">
          Nenhum sistema pode avisar esta conta ainda. Sem um segredo, o endereço recusa toda
          chamada — que é o certo para um endereço público.
        </p>
      ) : (
        <ul className="mb-4">
          {webhooks.map((webhook) => (
            <li
              key={webhook.id}
              className="flex items-center gap-3 border-b border-white/[0.045] py-3 last:border-0"
            >
              <InterruptorDoWebhook
                clienteId={clienteId}
                webhookId={webhook.id}
                ativo={webhook.ativo}
              />
              <span className="min-w-0 flex-1">
                <strong
                  className={`block truncate text-[13px] font-semibold ${webhook.ativo ? '' : 'text-dim line-through'}`}
                >
                  {webhook.nome}
                </strong>
                <span className="mt-0.5 block text-[11px] text-dim">
                  {/* "Ainda não chamou" responde a pergunta que importa: a
                      integração do outro lado está de pé? Sem isto, um webhook
                      cadastrado há meses parece funcionando. */}
                  {webhook.ultimaEm
                    ? `última chamada em ${new Date(webhook.ultimaEm).toLocaleString('pt-BR')}`
                    : 'ainda não recebeu nenhuma chamada'}
                </span>
              </span>
              <BotaoApagar clienteId={clienteId} webhookId={webhook.id} nome={webhook.nome} />
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
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
          conversou com você — fora da janela de 24h do WhatsApp o aviso fica registrado na ficha,
          mas não é enviado.
        </p>
      </details>
    </div>
  )
}

function InterruptorDoWebhook({
  clienteId,
  webhookId,
  ativo,
}: {
  clienteId: string
  webhookId: string
  ativo: boolean
}) {
  const [rodando, comecar] = useTransition()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={ativo ? 'Desligar webhook' : 'Ligar webhook'}
      disabled={rodando}
      title={
        ativo
          ? 'Desligar: as chamadas passam a levar 401, e o segredo continua guardado.'
          : 'Ligar: as chamadas com este segredo voltam a valer.'
      }
      onClick={() => comecar(async () => void (await acaoAlternarWebhookDeEntrada(clienteId, webhookId, !ativo)))}
      className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:opacity-50 ${
        ativo ? 'border-emerald-400/40 bg-emerald-400/25' : 'border-white/10 bg-white/[0.06]'
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
        title="Apaga o webhook e o segredo. Quem chamava passa a levar 401."
        className="shrink-0 rounded-lg border border-white/[0.09] px-2.5 py-1 text-[11px] text-dim transition hover:border-rose-400/40 hover:text-rose-300"
      >
        Apagar
      </button>
    )
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="text-[10.5px] text-dim">Apagar “{nome}”?</span>
      <button
        type="button"
        disabled={rodando}
        onClick={() => comecar(async () => void (await acaoApagarWebhookDeEntrada(clienteId, webhookId)))}
        className="rounded-lg border border-rose-400/40 px-2.5 py-1 text-[11px] text-rose-300 disabled:opacity-50"
      >
        Apagar
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="rounded-lg border border-white/[0.09] px-2.5 py-1 text-[11px] text-dim"
      >
        Não
      </button>
    </span>
  )
}
