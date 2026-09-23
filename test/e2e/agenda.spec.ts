import { readFileSync } from 'node:fs'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { cadastrar, identidade } from './cadastro'

/**
 * A agenda como tela de trabalho (plano de UX de 23/09, fase 1).
 *
 * O que os testes de integração não alcançam: a linha que some depois do
 * "Concluir" e volta com "Desfazer", o popover de reagendar e a busca digitada
 * na barra, com a URL mudando por baixo.
 */

let painelDaConta = ''
let sessaoSalva: Awaited<ReturnType<BrowserContext['storageState']>> | null = null

const CONTATO = 'João Agenda'

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  painelDaConta = await cadastrar(page, identidade())
  sessaoSalva = await contexto.storageState()
  await contexto.close()
})

test.beforeEach(async ({ context }) => {
  if (sessaoSalva) await context.addCookies(sessaoSalva.cookies)
})

/**
 * O contato nasce direto no banco **local**, e só ele.
 *
 * Conta nova, sem canal, não mostra o "+ Criar contato" (a tela de Contatos
 * vazia manda conectar um número). As atividades, que são o assunto aqui,
 * continuam nascendo pela ficha.
 */
function envLocal(): Record<string, string> {
  const env = Object.fromEntries(
    readFileSync(new URL('../../.env.teste-local', import.meta.url), 'utf8')
      .split('\n')
      .filter((linha) => linha.includes('=') && !linha.startsWith('#'))
      .map((linha) => [linha.slice(0, linha.indexOf('=')), linha.slice(linha.indexOf('=') + 1).trim()]),
  )
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.SUPABASE_URL ?? '')) throw new Error('SUPABASE_URL não é local')
  return env
}

/** PostgREST do banco local, com a chave de serviço local. */
async function rest(caminho: string, init: { method?: string; body?: unknown } = {}) {
  const env = envLocal()
  const resposta = await fetch(`${env.SUPABASE_URL}/rest/v1/${caminho}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: env.SUPABASE_SECRET_KEY!,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  return (await resposta.json()) as { id: string }[]
}

const clienteDaConta = () => painelDaConta.split('/').pop()!

async function criarContato(page: Page) {
  const [contato] = await rest('contacts', {
    method: 'POST',
    body: { client_id: clienteDaConta(), wa_id: `55449912${Date.now().toString().slice(-5)}`, nome: CONTATO },
  })
  await page.goto(`${painelDaConta}/leads/${contato!.id}`)
}

async function criarAtividadeNaFicha(page: Page, titulo: string) {
  await page.getByRole('tab', { name: /Atividades/ }).click()
  await page.getByRole('textbox', { name: 'O que precisa ser feito' }).fill(titulo)
  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  await expect(page.getByText(titulo, { exact: true }).filter({ visible: true }).first()).toBeVisible()
}

function linha(page: Page, titulo: string) {
  return page.locator('tbody tr').filter({ hasText: titulo })
}

test('concluir, desfazer, reagendar e buscar sem acento, tudo pela agenda', async ({ page }) => {
  await criarContato(page)
  await criarAtividadeNaFicha(page, 'Ligar para confirmar')
  await criarAtividadeNaFicha(page, 'Mandar proposta')

  await page.goto(`${painelDaConta}/atividades`)
  await expect(linha(page, 'Ligar para confirmar')).toContainText(CONTATO)
  await expect(linha(page, 'Mandar proposta')).toBeVisible()

  // Concluir tira a linha; "Desfazer" traz de volta.
  await linha(page, 'Ligar para confirmar').getByRole('button', { name: /Concluir/ }).click()
  await expect(linha(page, 'Ligar para confirmar')).toHaveCount(0)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(linha(page, 'Ligar para confirmar')).toBeVisible()

  // Reagendar para amanhã muda o texto do prazo.
  await linha(page, 'Mandar proposta').getByRole('button', { name: 'Reagendar Mandar proposta' }).click()
  await page.getByRole('button', { name: 'Amanhã', exact: true }).click()
  await page.getByRole('button', { name: 'Salvar prazo' }).click()
  await expect(linha(page, 'Mandar proposta')).toContainText('Amanhã')

  // Ação que falha não some com a linha: alguém concluiu noutra aba.
  const [proposta] = await rest(
    `atividades?client_id=eq.${clienteDaConta()}&titulo=eq.${encodeURIComponent('Mandar proposta')}&select=id`,
  )
  await rest(`atividades?id=eq.${proposta!.id}`, {
    method: 'PATCH',
    body: { situacao: 'concluida', concluida_em: new Date().toISOString() },
  })
  await linha(page, 'Mandar proposta').getByRole('button', { name: /Concluir/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'já foi resolvida' })).toBeVisible()
  await expect(linha(page, 'Mandar proposta').first()).toBeVisible()

  // Buscar pelo nome sem acento acha o contato com acento.
  await page.getByRole('searchbox', { name: /Buscar atividade/ }).fill('joao agenda')
  await expect(page).toHaveURL(/q=joao/)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(linha(page, 'Ligar para confirmar')).toContainText(CONTATO)
  await page.getByRole('searchbox', { name: /Buscar atividade/ }).fill('ninguem-com-esse-nome')
  await expect(page.getByText('Nada com estes filtros.')).toBeVisible()
})
