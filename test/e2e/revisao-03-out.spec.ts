import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { rest } from './banco-local'
import { cadastrar, identidade } from './cadastro'

/**
 * As sete mudanças da revisão de 03/10/2026 (pedidos do Eduardo), no navegador.
 *
 * O que só aqui dá para provar: o resumo do funil que liga e continua ligado
 * depois de recarregar, o aviso de troca de funil que termina, a trilha do
 * cabeçalho, a sugestão que chega até a administração e a faixa de versão nova
 * quando o servidor passa a responder outro deploy.
 *
 * Com `FOTOS=<pasta>`, cada etapa deixa uma foto da tela, para olhar o visual.
 */

const FOTOS = process.env.FOTOS
const quem = identidade()
let painel = ''
let sessaoSalva: Awaited<ReturnType<BrowserContext['storageState']>> | null = null
const ids = { comercial: '', posVenda: '', parado: '', semAtividade: '', atrasado: '', emDia: '' }

const DIA = 86_400_000
const diasAtras = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()

async function foto(page: Page, nome: string) {
  if (FOTOS) await page.screenshot({ path: `${FOTOS}/${nome}.png` })
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  painel = await cadastrar(page, quem)
  sessaoSalva = await contexto.storageState()
  await contexto.close()

  const clienteId = painel.split('/').pop()!
  const [usuario] = (await rest(`af_usuarios?email=eq.${encodeURIComponent(quem.email)}&select=id`)) as { id: string }[]

  const [comercial] = await rest('quadros', { method: 'POST', body: { client_id: clienteId, nome: 'Comercial', finalidade: 'comercial' } })
  const [posVenda] = await rest('quadros', { method: 'POST', body: { client_id: clienteId, nome: 'Pós-venda', finalidade: 'operacional' } })
  ids.comercial = comercial!.id
  ids.posVenda = posVenda!.id
  const colunas = await rest('quadro_colunas', {
    method: 'POST',
    body: [
      { quadro_id: ids.comercial, nome: 'Novo', ordem: 0 },
      { quadro_id: ids.comercial, nome: 'Em conversa', ordem: 1 },
      { quadro_id: ids.comercial, nome: 'Negociação', ordem: 2 },
    ],
  })
  await rest('quadro_colunas', { method: 'POST', body: [{ quadro_id: ids.posVenda, nome: 'Entregue', ordem: 0 }] })
  const [novo, conversa, negociacao] = colunas.map((c) => c.id)

  const sufixo = Date.now().toString().slice(-5)
  const pessoas = await rest('contacts', {
    method: 'POST',
    body: ['Ana Parada', 'Bruno Sem Agenda', 'Carla Atrasada', 'Davi Em Dia'].map((nome, i) => ({
      client_id: clienteId,
      wa_id: `554499${i}${sufixo}`,
      nome,
    })),
  })
  // PostgREST pede as mesmas chaves em todos os itens de um lote.
  const cartao = (coluna: string, pessoa: number, titulo: string, valor: number | null, dias = 0) => ({
    quadro_id: ids.comercial,
    coluna_id: coluna,
    contact_id: pessoas[pessoa]!.id,
    client_id: clienteId,
    entrou_na_coluna_em: diasAtras(dias),
    titulo,
    valor,
  })
  const cartoes = await rest('quadro_cartoes', {
    method: 'POST',
    body: [
      cartao(novo!, 0, 'Plano anual', null, 10),
      cartao(novo!, 1, 'Pacote de 10 aulas', null),
      cartao(conversa!, 2, 'Consultoria', 3500),
      cartao(negociacao!, 3, 'Site novo', 4800),
    ],
  })
  if (!Array.isArray(cartoes)) throw new Error(`cartões não nasceram: ${JSON.stringify(cartoes)}`)
  ;[ids.parado, ids.semAtividade, ids.atrasado, ids.emDia] = cartoes.map((c) => c.id)

  const atividade = (contato: number, cartao: string, titulo: string, prazo: string, tipo = 'tarefa') => ({
    client_id: clienteId,
    contact_id: pessoas[contato]!.id,
    cartao_id: cartao,
    tipo,
    titulo,
    prazo,
    hora_marcada: tipo !== 'tarefa',
    responsavel: usuario!.id,
  })
  await rest('atividades', {
    method: 'POST',
    body: [
      atividade(0, ids.parado, 'Mandar contrato', new Date(Date.now() + 3 * DIA).toISOString()),
      atividade(2, ids.atrasado, 'Ligar de volta', diasAtras(2), 'ligacao'),
      atividade(2, ids.atrasado, 'Enviar proposta revisada', diasAtras(1)),
      atividade(3, ids.emDia, 'Reunião de fechamento', new Date(Date.now() + 1 * DIA).toISOString(), 'reuniao'),
    ],
  })
})

test.beforeEach(async ({ context }) => {
  if (sessaoSalva) await context.addCookies(sessaoSalva.cookies)
})

function coluna(page: Page, nome: string) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: nome, exact: true }) })
}

test('7. o resumo das etapas liga, filtra e sobrevive a recarregar', async ({ page }) => {
  await page.goto(`${painel}/quadros?q=${ids.comercial}`)
  await expect(page.getByText('Plano anual')).toBeVisible()
  await expect(page.locator('.resumo-da-etapa').first()).toBeHidden()
  await foto(page, '7a-funil-sem-resumo')

  await page.getByRole('button', { name: 'Resumo' }).click()
  const resumoNovo = coluna(page, 'Novo').locator('.resumo-da-etapa')
  await expect(resumoNovo).toBeVisible()
  // Novo: Ana parada há 10 dias, Bruno sem nenhuma atividade.
  await expect(resumoNovo.getByRole('button', { name: /parado/ })).toContainText('1')
  await expect(resumoNovo.getByRole('button', { name: /sem atividade/ })).toContainText('1')
  // O cartão da Carla tem duas atividades atrasadas.
  await expect(coluna(page, 'Em conversa').getByTitle('2 atividades atrasadas')).toBeVisible()
  await foto(page, '7b-funil-com-resumo')

  await coluna(page, 'Em conversa').locator('.resumo-da-etapa').getByRole('button', { name: /atrasada/ }).click()
  await expect(page.getByText('Consultoria')).toBeVisible()
  await expect(page.getByText('Plano anual')).toBeHidden()
  await expect(page.getByRole('button', { name: /Remover filtro: Só os com atividade atrasada/ })).toBeVisible()
  await foto(page, '7c-funil-filtrado-por-atrasadas')

  await page.reload()
  await expect(page.locator('.resumo-da-etapa').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resumo' })).toHaveAttribute('aria-pressed', 'true')
})

test('6, 2, 3 e 1. a página do negócio: trilha, data e hora, status e troca de funil', async ({ page }) => {
  await page.goto(`${painel}/negocios/${ids.atrasado}`)
  const trilha = page.getByRole('navigation', { name: 'Onde você está' })
  await expect(trilha).toContainText('CRM')
  await expect(trilha.getByRole('link', { name: 'Negociações' })).toBeVisible()
  await expect(trilha.getByRole('link', { name: 'Comercial' })).toBeVisible()
  await expect(trilha).toContainText('Consultoria')

  // 3: as duas atividades vencidas aparecem como Atrasada.
  await expect(page.getByText('Atrasada', { exact: true })).toHaveCount(2)

  // 2: anotar e ver a data e a hora, não só "agora".
  await page.getByRole('textbox', { name: 'Nova anotação sobre o negócio' }).fill('Pediu desconto à vista')
  await page.getByRole('button', { name: 'Anotar' }).click()
  await expect(page.locator('time').filter({ hasText: / às \d\d:\d\d · agora/ }).first()).toBeVisible()
  await expect(page.getByText(/Última alteração/).locator('..')).toContainText(/ às \d\d:\d\d/)
  await foto(page, '6-2-3-negocio')

  // 1: a troca de funil termina e o aviso some sozinho.
  await page.getByRole('button', { name: 'Mais ações do negócio' }).click()
  await page.getByRole('button', { name: 'Pós-venda' }).click()
  await expect(page.getByText('Negócio agora está no funil Pós-venda.')).toBeVisible({ timeout: 20_000 })
  await expect(trilha.getByRole('link', { name: 'Pós-venda' })).toBeVisible()
  await foto(page, '1-troca-de-funil-terminou')
  await expect(page.getByText('Negócio agora está no funil Pós-venda.')).toBeHidden({ timeout: 10_000 })
  await expect(page.getByText(/Levando para o funil/)).toHaveCount(0)
})

test('3. a agenda escreve o status em cada linha', async ({ page }) => {
  await page.goto(`${painel}/atividades?situacao=aberta`)
  await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Data e hora' })).toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: 'Ligar de volta' })).toContainText('Atrasada')
  await expect(page.locator('tbody tr').filter({ hasText: 'Mandar contrato' })).toContainText('Pendente')
  await expect(page.getByRole('button', { name: /Atrasadas/ }).first()).toBeVisible()
  await foto(page, '3-agenda')
})

test('4. "Sentiu falta de algo?" chega até a administração', async ({ page }) => {
  await page.goto(`${painel}/quadros?q=${ids.comercial}`)
  await page.getByRole('button', { name: 'Sentiu falta de algo?' }).click()
  await page.getByRole('textbox', { name: 'Sua sugestão' }).fill('Queria anexar o contrato assinado no negócio.')
  await foto(page, '4a-sugestao-escrita')
  await page.getByRole('button', { name: 'Enviar sugestão' }).click()
  await expect(page.getByRole('heading', { name: 'Recebemos, obrigado' })).toBeVisible()
  await foto(page, '4b-sugestao-recebida')

  const linhas = (await rest(
    `af_auditoria?acao=eq.sugeriu_melhoria&autor_email=eq.${encodeURIComponent(quem.email)}&select=detalhes`,
  )) as unknown as { detalhes: { texto: string; tela: string } }[]
  expect(linhas).toHaveLength(1)
  expect(linhas[0]!.detalhes).toMatchObject({ texto: 'Queria anexar o contrato assinado no negócio.', tela: '/quadros' })

  // A administração exige o papel e as duas etapas; no banco local, liga os dois.
  await rest(`af_usuarios?email=eq.${encodeURIComponent(quem.email)}`, {
    method: 'PATCH',
    body: { role: 'admin', twoFactorEnabled: true },
  })
  await page.goto('/admin/sugestoes')
  await expect(page.getByRole('heading', { name: 'Sugestões' })).toBeVisible()
  // A lista é de todas as organizações, e rodadas anteriores deixam a mesma frase: procura a desta.
  await expect(page.getByRole('listitem').filter({ hasText: quem.empresa })).toContainText('Queria anexar o contrato assinado no negócio.')
  await foto(page, '4c-admin-sugestoes')
})

test('5. a faixa de versão nova aparece quando o servidor muda de deploy', async ({ page }) => {
  let versao = 'dpl_antigo'
  let perguntas = 0
  await page.route('**/api/versao', (rota) => {
    perguntas += 1
    return rota.fulfill({ json: { versao } })
  })
  await page.clock.install()
  await page.goto(`${painel}/quadros?q=${ids.comercial}`)
  await expect(page.getByText('Plano anual')).toBeVisible()
  // A aba guarda a primeira resposta como "a sua versão": só troca depois dela.
  await expect.poll(() => perguntas).toBeGreaterThan(0)
  await expect(page.getByText('Saiu uma versão nova do AutoFluxos.')).toHaveCount(0)

  versao = 'dpl_novo'
  await page.clock.runFor(11 * 60_000)
  await expect(page.getByText('Saiu uma versão nova do AutoFluxos.')).toBeVisible()
  await foto(page, '5-versao-nova')

  await page.getByRole('button', { name: 'Fechar aviso' }).click()
  await expect(page.getByText('Saiu uma versão nova do AutoFluxos.')).toHaveCount(0)
})
