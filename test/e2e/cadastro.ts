import { expect, type Page } from '@playwright/test'

/*
 * Cadastro de conta nova para os testes pelo navegador, compartilhado entre os
 * arquivos. Cada arquivo cadastra **uma** vez no `beforeAll` (ver o limite de
 * tentativas no README desta pasta).
 */

/** Uma identidade nova por execução: o banco é o mesmo entre as rodadas. */
export function identidade() {
  const seed = Math.random().toString(36).slice(2, 8)
  return {
    nome: 'Eduardo Teste',
    email: `zz-e2e-${seed}@exemplo.test`,
    senha: 'senha-comprida-de-teste-e2e',
    empresa: `zz-e2e ${seed}`,
  }
}

/**
 * Cadastra e chega ao painel da empresa nova.
 *
 * Devolve a URL da conta, porque o id só existe depois que o servidor cria.
 */
export async function cadastrar(page: Page, quem: ReturnType<typeof identidade>) {
  await page.goto('/cadastrar')

  await page.getByRole('textbox', { name: 'Nome' }).fill(quem.nome)
  await page.getByRole('textbox', { name: 'E-mail' }).fill(quem.email)
  // `getByRole('textbox')` e não `getByLabel('Senha')`: o botão "Mostrar a
  // senha" do `CampoDeSenha` também casa com esse texto, e o locator recusa em
  // modo estrito com "resolved to 2 elements".
  await page.getByRole('textbox', { name: 'Senha' }).fill(quem.senha)
  await page.getByRole('button', { name: /criar acesso|cadastrar/i }).click()

  // Passo dois: a empresa. O cadastro tem dois passos de propósito, e a
  // segunda tela só aparece para quem ainda não tem empresa nenhuma.
  await expect(page).toHaveURL(/\/primeiro-acesso/)
  await page.getByRole('textbox', { name: 'Nome da empresa' }).fill(quem.empresa)
  await page.getByRole('button', { name: /criar empresa/i }).click()

  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}/, { timeout: 30_000 })

  /*
   * Recorta a **raiz da conta**, e não devolve `page.url()` cru.
   *
   * O cadastro não termina no painel: ele termina em `/ajustes/whatsapp`, que é
   * o que o rodapé da tela promete ("você vai direto para a tela de conectar o
   * seu WhatsApp"). Devolver a URL inteira e concatenar produzia
   * `/ajustes/whatsapp/ajustes/etiquetas`, e o 404 resultante parecia falta de
   * permissão em vez de erro de montagem de URL.
   */
  const raiz = page.url().match(/^.*\/clientes\/[0-9a-f-]{36}/)
  if (!raiz) throw new Error(`não achei a raiz da conta em ${page.url()}`)
  return raiz[0]
}
