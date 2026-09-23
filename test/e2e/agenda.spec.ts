import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { rest } from './banco-local'
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

/*
 * O contato nasce direto no banco **local** (`rest`), e só ele. As atividades,
 * que são o assunto aqui, continuam nascendo pela ficha.
 */
const clienteDaConta = () => painelDaConta.split('/').pop()!

async function criarContato(page: Page, nome = CONTATO) {
  const [contato] = await rest('contacts', {
    method: 'POST',
    body: { client_id: clienteDaConta(), wa_id: `55449912${Date.now().toString().slice(-5)}`, nome },
  })
  await page.goto(`${painelDaConta}/leads/${contato!.id}`)
  return contato!.id
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

test('criar pela agenda, ver na lista e na ficha do contato', async ({ page }) => {
  const contatoId = await criarContato(page, 'Márcia Nova')

  // Com um recorte que a atividade nova não cumpre, o aviso diz isso.
  await page.goto(`${painelDaConta}/atividades?recorte=vencidas`)
  await page.getByRole('button', { name: '+ Nova atividade' }).click()
  await page.getByRole('searchbox', { name: 'Buscar contato' }).fill('Márcia nov')
  await page.getByRole('list', { name: 'Contatos encontrados' }).getByRole('button', { name: /Márcia Nova/ }).click()
  await page.getByRole('radio', { name: /liga/i }).click()
  await page.getByRole('textbox', { name: 'sobre o que é a ligação' }).fill('Retornar sobre plano anual')
  await page.getByRole('button', { name: 'Criar atividade' }).click()
  await expect(page.getByText('Ela não aparece com os filtros atuais.')).toBeVisible()
  await expect(page).toHaveURL(/recorte=vencidas/)

  // "Ver" leva a uma agenda onde ela aparece.
  await page.getByRole('link', { name: 'Ver', exact: true }).click()
  await expect(linha(page, 'Retornar sobre plano anual')).toContainText('Márcia Nova')

  await page.goto(`${painelDaConta}/leads/${contatoId}`)
  await page.getByRole('tab', { name: /Atividades/ }).click()
  await expect(page.getByText('Retornar sobre plano anual', { exact: true }).filter({ visible: true }).first()).toBeVisible()
})

test('vista de agenda: alternar, abrir a atividade e concluir pelo diálogo', async ({ page }) => {
  await criarContato(page, 'Paula Calendário')
  await criarAtividadeNaFicha(page, 'Revisar ficha de saúde')

  await page.goto(`${painelDaConta}/atividades`)
  await page.getByRole('button', { name: 'Agenda', exact: true }).click()
  await expect(page).toHaveURL(/vista=agenda/)

  // Sem prazo não cabe em dia nenhum: fica na faixa à parte.
  const faixa = page.getByRole('region', { name: 'Sem prazo' })
  await faixa.getByRole('button', { name: /Revisar ficha de saúde/ }).click()
  const dialogo = page.getByRole('dialog', { name: 'Atividade' })
  await expect(dialogo).toContainText('Paula Calendário')
  await dialogo.getByRole('button', { name: /Concluir/ }).click()
  await expect(dialogo).toHaveCount(0)
  await expect(faixa.getByRole('button', { name: /Revisar ficha de saúde/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeVisible()

  // A escolha fica na URL: mês e volta para a lista.
  await page.getByRole('link', { name: 'Mês', exact: true }).click()
  await expect(page).toHaveURL(/escala=mes/)
  await page.getByRole('button', { name: 'Lista', exact: true }).click()
  await expect(page).not.toHaveURL(/vista=agenda/)
})

test('atribuir tarefa pelo modal com busca, e filtrar responsável pelo mesmo seletor', async ({ page }) => {
  await criarContato(page, 'Rita Atribuir')
  await criarAtividadeNaFicha(page, 'Conferir pagamento')

  await page.goto(`${painelDaConta}/atividades?alcance=equipe`)
  await linha(page, 'Conferir pagamento').getByRole('button', { name: 'Mais ações para Conferir pagamento' }).click()
  await page.getByRole('button', { name: 'Atribuir tarefa…' }).click()
  const seletor = page.getByRole('dialog', { name: 'Atribuir tarefa' })
  await seletor.getByRole('searchbox', { name: 'Buscar pessoa pelo nome' }).fill('nome-que-nao-existe')
  await expect(seletor.getByText('Ninguém com esse nome.')).toBeVisible()
  await seletor.getByRole('button', { name: 'Ninguém', exact: true }).click()
  await expect(seletor).toHaveCount(0)
  await expect(page.getByText('Responsável atualizado.')).toBeVisible()

  await page.getByRole('button', { name: /Filtros/ }).click()
  await page.getByRole('button', { name: /Escolher…/ }).click()
  await page.getByRole('dialog', { name: 'Filtrar por responsável' }).getByRole('button', { name: 'Sem responsável' }).click()
  await expect(page).toHaveURL(/responsavel=ninguem/)
  await expect(linha(page, 'Conferir pagamento')).toBeVisible()
})
