import { expect, test, type Page } from '@playwright/test'
import { rest } from './banco-local'
import { cadastrar, identidade } from './cadastro'

/**
 * "Esqueci a senha" e a confirmação de e-mail, pela tela.
 *
 * O que se prova: o pedido responde igual para e-mail que existe e que não
 * existe; o link troca a senha uma vez só e derruba a sessão antiga; conta
 * nova sem e-mail confirmado entra durante a carência.
 *
 * Sem `BREVO_API_KEY` no local, o e-mail não sai: o token é lido do banco.
 */

const PRINTS = process.env.PRINTS_DIR

async function sair(page: Page) {
  await page.context().clearCookies()
}

async function tokenDeRedefinicao(email: string): Promise<string> {
  const [usuario] = (await rest(`af_usuarios?email=eq.${encodeURIComponent(email)}&select=id`)) as { id: string }[]
  const linhas = (await rest(
    `af_verificacoes?value=eq.${usuario!.id}&identifier=like.reset-password:*&select=identifier&order=createdAt.desc`,
  )) as unknown as { identifier: string }[]
  return linhas[0]!.identifier.replace('reset-password:', '')
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/entrar')
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email)
  await page.getByRole('textbox', { name: 'Senha' }).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('pedir o link, trocar a senha uma vez só, e entrar com a nova', async ({ page, browser }) => {
  const quem = identidade()
  await cadastrar(page, quem)
  const sessaoAntiga = await page.context().storageState()
  await sair(page)

  // O link na tela de entrar.
  await page.goto('/entrar')
  await page.getByRole('link', { name: 'Esqueci a senha' }).click()
  await expect(page).toHaveURL(/\/esqueci-senha/)
  if (PRINTS) {
    for (const [largura, altura] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width: largura, height: altura })
      await page.screenshot({ path: `${PRINTS}/esqueci-${largura}.png` })
    }
    await page.setViewportSize({ width: 1280, height: 720 })
  }

  // E-mail que não existe: a mesma resposta.
  await page.getByRole('textbox', { name: 'E-mail' }).fill('ninguem-zz-e2e@exemplo.test')
  await page.getByRole('button', { name: 'Mandar o link' }).click()
  const naoExiste = await page.getByRole('status').innerText()

  await page.goto('/esqueci-senha')
  await page.getByRole('textbox', { name: 'E-mail' }).fill(quem.email)
  await page.getByRole('button', { name: 'Mandar o link' }).click()
  const existe = await page.getByRole('status').innerText()
  expect(existe.replace(quem.email, 'X')).toBe(naoExiste.replace('ninguem-zz-e2e@exemplo.test', 'X'))
  if (PRINTS) await page.screenshot({ path: `${PRINTS}/esqueci-enviado-1280.png` })

  const token = await tokenDeRedefinicao(quem.email)
  const novaSenha = 'outra-senha-comprida-e2e-9'

  await page.goto(`/redefinir-senha?token=${token}`)
  if (PRINTS) {
    for (const [largura, altura] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width: largura, height: altura })
      await page.screenshot({ path: `${PRINTS}/redefinir-${largura}.png` })
    }
    await page.setViewportSize({ width: 1280, height: 720 })
  }
  await page.getByRole('textbox', { name: 'Senha nova', exact: true }).fill(novaSenha)
  await page.getByRole('textbox', { name: 'Repita a senha nova' }).fill(novaSenha)
  await page.getByRole('button', { name: 'Salvar a senha nova' }).click()
  await expect(page).toHaveURL(/\/entrar\?senha=nova/)
  await expect(page.getByText('Senha nova salva. Entre com ela.')).toBeVisible()

  // O mesmo link de novo: recusado.
  await page.goto(`/redefinir-senha?token=${token}`)
  await page.getByRole('textbox', { name: 'Senha nova', exact: true }).fill('mais-uma-senha-e2e-comprida')
  await page.getByRole('textbox', { name: 'Repita a senha nova' }).fill('mais-uma-senha-e2e-comprida')
  await page.getByRole('button', { name: 'Salvar a senha nova' }).click()
  await expect(page.getByText('venceu ou já foi usado')).toBeVisible()

  // A sessão de antes da troca caiu.
  const antiga = await browser.newContext({ storageState: sessaoAntiga })
  const paginaAntiga = await antiga.newPage()
  await paginaAntiga.goto('/painel')
  await expect(paginaAntiga).toHaveURL(/\/entrar/)
  await antiga.close()

  // A senha velha não entra; a nova entra.
  await entrar(page, quem.email, quem.senha)
  await expect(page.getByText('Credenciais não conferem')).toBeVisible()
  await entrar(page, quem.email, novaSenha)
  await expect(page).not.toHaveURL(/\/entrar/, { timeout: 30_000 })
})

/*
 * A trava da conta sem e-mail confirmado depende do relógio (carência contada
 * a partir de `CONFIRMACAO_VALE_DESDE`) e é provada em `sessao.test.ts`, na
 * função pura. Aqui fica a carência: conta nova entra.
 */
test('conta nova sem e-mail confirmado entra durante a carência', async ({ page }) => {
  const quem = identidade()
  await cadastrar(page, quem)
  await sair(page)
  await entrar(page, quem.email, quem.senha)
  await expect(page).not.toHaveURL(/\/entrar/, { timeout: 30_000 })
})

test('link de confirmação inválido diz que venceu', async ({ page }) => {
  await page.goto('/confirmar-email?token=nao-e-um-token')
  await expect(page.getByRole('heading', { name: 'Link vencido' })).toBeVisible()
})
