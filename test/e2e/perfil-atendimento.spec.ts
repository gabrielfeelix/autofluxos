import { expect, test } from '@playwright/test'
import { rest } from './banco-local'
import { cadastrar, identidade } from './cadastro'

/**
 * Quem tem acesso de atendimento cuida do próprio perfil pelo rodapé, e não
 * enxerga Configurações (plano de UX de 23/09, 7.5 passo 6).
 *
 * O perfil mora em "Você", e não em Configurações, justamente por causa desta
 * pessoa: ela não entra em Configurações (7.2), e mesmo assim precisa trocar o
 * próprio nome e a foto.
 *
 * A pessoa nasce pela tela de Pessoas e acesso, como nasce de verdade. O acesso
 * de atendimento é gravado direto no banco local (as mesmas linhas de
 * `membro_capacidades` que o editor de acesso grava), porque o editor tem
 * teste próprio e aqui o que se prova é o rodapé.
 */

const atendente = {
  nome: 'Rita Atende',
  email: `zz-e2e-atende-${Math.random().toString(36).slice(2, 8)}@exemplo.test`,
  senha: 'senha-comprida-da-atendente',
}

let painelDaConta = ''

/** A diferença entre `member` e o modelo `operador` ("Acesso de atendimento"). */
const ACESSO_DE_ATENDIMENTO = {
  configurar_operacao: 'nenhum',
  atender: 'proprios',
  criar_oportunidade: 'proprios',
  registrar_venda: 'nenhum',
  ler_valores: 'nenhum',
  exportar: 'nenhum',
} as const

/** Um PNG de 1 px: o recorte quadrado acontece no navegador. */
const FOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  painelDaConta = await cadastrar(page, identidade())

  await page.goto(`${painelDaConta}/ajustes/equipe`)
  await page.getByRole('button', { name: '+ Cadastrar pessoa' }).click()
  await page.getByPlaceholder('Nome de quem entra').fill(atendente.nome)
  await page.getByPlaceholder('pessoa@exemplo.com.br').fill(atendente.email)
  await page.locator('input[name="senha"]').fill(atendente.senha)
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByText(atendente.email).first()).toBeVisible()
  await contexto.close()

  const [usuario] = await rest(`af_usuarios?email=eq.${encodeURIComponent(atendente.email)}&select=id`)
  const clienteId = painelDaConta.split('/').pop()!
  await rest('membro_capacidades', {
    method: 'POST',
    body: Object.entries(ACESSO_DE_ATENDIMENTO).map(([capacidade, escopo]) => ({
      client_id: clienteId,
      usuario_id: usuario!.id,
      capacidade,
      escopo,
    })),
  })
})

test('atendimento troca o próprio nome e a foto pelo rodapé, sem ver Configurações', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByRole('textbox', { name: 'E-mail' }).fill(atendente.email)
  await page.getByRole('textbox', { name: 'Senha' }).fill(atendente.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}/, { timeout: 30_000 })
  await page.goto(painelDaConta)

  // O menu não oferece Configurações para esta pessoa.
  const menu = page.getByRole('navigation', { name: 'Seções do cliente' })
  await expect(menu.getByRole('link', { name: 'Inbox' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Configurações' })).toHaveCount(0)

  // O rodapé diz quem está usando, e o diálogo "Você" diz o acesso dela.
  await page.getByRole('button', { name: new RegExp(`^Você: ${atendente.nome}`) }).click()
  const voce = page.getByRole('dialog', { name: 'Você' })
  await expect(voce.getByText(/Acesso de atendimento/)).toBeVisible()
  await expect(voce.getByText('Configurações da conta')).toHaveCount(0)

  await voce.getByText('Editar perfil').click()
  const edicao = page.getByRole('dialog', { name: 'Editar perfil' })
  await edicao.locator('input[type="file"]').setInputFiles({ name: 'eu.png', mimeType: 'image/png', buffer: FOTO })
  await edicao.getByRole('textbox', { name: 'Nome' }).fill('Rita Renomeada')
  await edicao.getByRole('button', { name: 'Salvar' }).click()
  await expect(edicao).toBeHidden()

  // O rodapé muda na hora, e o nome e a foto sobrevivem a uma visita nova.
  await expect(page.getByRole('button', { name: /^Você: Rita Renomeada/ })).toBeVisible()
  await page.reload()
  const rodape = page.getByRole('button', { name: /^Você: Rita Renomeada/ })
  await expect(rodape).toBeVisible()
  await expect(rodape.locator('img')).toHaveAttribute('src', /autofluxos-avatares/)
})
