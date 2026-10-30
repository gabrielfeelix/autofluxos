/**
 * Publica as cópias dos e-mails do Dialogon como modelos na Brevo.
 *
 *   set -a && . ../.secrets/4yu.env && set +a
 *   npx jiti scripts/modelos-da-brevo.mts            # cria ou atualiza
 *   npx jiti scripts/modelos-da-brevo.mts --previa   # só grava os HTML em /tmp/modelos-da-brevo
 *
 * **A fonte da verdade é `src/core/email/modelos.ts`.** O envio monta o HTML
 * de lá, na hora; a Brevo guarda uma cópia para quem quer ver, testar ou
 * mandar à mão pelo painel. O nome termina em "[cópia, editar no código]",
 * como na Verandi: editar a cópia na Brevo não muda o que o produto envia, e
 * a próxima rodada deste script sobrescreve a edição.
 *
 * Cada texto de exemplo vira `{{params.campo}}`, a sintaxe da Brevo, para a
 * cópia funcionar com parâmetros. Número e sim/não ficam com o valor de
 * exemplo: decidem o desenho (a barra do medidor, o texto de "estourou"), e
 * não dá para trocá-los depois de montado. O mesmo vale para `VARIANTES`.
 *
 * Rodar duas vezes dá o mesmo resultado: o modelo é achado pelo nome.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { CONTATO, montarEmail } from '../src/core/email/layout.ts'
import { MODELOS } from '../src/core/email/modelos.ts'

const API = 'https://api.brevo.com/v3'
const REMETENTE = { name: 'Dialogon', email: 'nao-responda@mail.dialogon.com.br' }
const SUFIXO = '[cópia, editar no código]'
const PAINEL = 'https://dialogon.com.br'
const previa = process.argv.includes('--previa')

const chave = process.env.BREVO_API_KEY
if (!previa && !chave) {
  console.error('BREVO_API_KEY ausente. Carregue o cofre: set -a && . ../.secrets/4yu.env && set +a')
  process.exit(1)
}

async function brevo(caminho: string, init: RequestInit = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    ...init,
    headers: { 'api-key': chave!, 'content-type': 'application/json', accept: 'application/json', ...init.headers },
  })
  const corpo = await resposta.text()
  if (!resposta.ok) throw new Error(`Brevo ${init.method ?? 'GET'} ${caminho}: ${resposta.status} ${corpo}`)
  return corpo ? JSON.parse(corpo) : null
}

/** Campos que escolhem a variante do e-mail: ficam com o exemplo, como número e sim/não. */
const VARIANTES = new Set(['momento', 'situacao', 'alvo'])

function comParametros<P extends Record<string, unknown>>(exemplo: P): P {
  return Object.fromEntries(
    Object.entries(exemplo).map(([campo, valor]) => [campo, typeof valor === 'string' && !VARIANTES.has(campo) ? `{{params.${campo}}}` : valor]),
  ) as P
}

const existentes = new Map<string, number>()
if (!previa) {
  const { templates } = (await brevo('/smtp/templates?limit=1000')) as { templates?: { id: number; name: string }[] }
  for (const modelo of templates ?? []) existentes.set(modelo.name, modelo.id)
}

if (previa) mkdirSync('/tmp/modelos-da-brevo', { recursive: true })

for (const [id, modelo] of Object.entries(MODELOS)) {
  const m = modelo as unknown as { nome: string; grupo: string; montar: (p: unknown) => Parameters<typeof montarEmail>[0]; exemplo: Record<string, unknown> }
  const email = montarEmail(m.montar(comParametros(m.exemplo)), PAINEL)
  const nome = `Dialogon · ${m.grupo} · ${m.nome} ${SUFIXO}`

  if (previa) {
    writeFileSync(`/tmp/modelos-da-brevo/${id}.html`, email.html)
    console.log(`prévia  ${id}`)
    continue
  }

  const corpo = {
    templateName: nome,
    subject: email.assunto,
    htmlContent: email.html,
    sender: REMETENTE,
    replyTo: CONTATO,
    tag: 'autofluxos',
    isActive: true,
  }
  const atual = existentes.get(nome)
  if (atual) {
    await brevo(`/smtp/templates/${atual}`, { method: 'PUT', body: JSON.stringify(corpo) })
    console.log(`atualizado  #${atual}  ${nome}`)
  } else {
    const criado = (await brevo('/smtp/templates', { method: 'POST', body: JSON.stringify(corpo) })) as { id: number }
    console.log(`criado      #${criado.id}  ${nome}`)
  }
}
