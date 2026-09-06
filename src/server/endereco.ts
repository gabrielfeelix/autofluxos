import 'server-only'

/**
 * O endereço público deste painel, para montar URL que alguém vai **copiar**.
 *
 * Existe porque o webhook de entrada (0044) precisa mostrar a URL completa na
 * tela: o navegador sabe onde está, mas a página é renderizada no servidor, e
 * uma URL relativa não serve para colar na configuração de outro sistema.
 *
 * A ordem das fontes é deliberada. `BETTER_AUTH_URL` é o domínio de verdade,
 * configurado à mão — é ele que a pessoa digita. `VERCEL_URL` é o endereço do
 * *deploy*, que muda a cada publicação e serve só de rede em prévia. O
 * `localhost` fecha a lista para o desenvolvimento não mostrar string vazia.
 *
 * **Nunca sai daqui um endereço vindo de cabeçalho da requisição.** `Host` é
 * escolhido por quem chama, e montar URL com ele é como se ensina alguém a
 * mandar o segredo dele para o servidor errado.
 */
export function enderecoDoPainel(): string {
  const configurado = process.env.BETTER_AUTH_URL?.trim()
  if (configurado) return configurado.replace(/\/+$/, '')

  const daVercel = process.env.VERCEL_URL?.trim()
  if (daVercel) return `https://${daVercel}`

  return 'http://localhost:3000'
}
