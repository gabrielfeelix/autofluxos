/**
 * Corta a rede durante os testes unitários.
 *
 * O guarda de `ambiente-local.ts` protege o caminho do banco; este protege
 * todos os outros. Teste unitário que chame Meta, Gemini, Supabase ou qualquer
 * endereço externo passa a falhar com o destino escrito na mensagem, em vez de
 * sair da máquina de quem roda a suíte.
 *
 * Falhar é de propósito, e é melhor que devolver resposta falsa: um teste que
 * silenciosamente recebesse `{}` de um mock global passaria verde sem provar
 * nada. Quem precisa de resposta de rede declara o mock no próprio teste.
 *
 * **Por que a troca acontece já, e não num `beforeAll`:** vários testes
 * instalam o próprio mock com `vi.stubGlobal('fetch', ...)` no corpo do
 * módulo, que roda *antes* de qualquer hook. Um `beforeAll` substituiria esse
 * mock depois de instalado e quebraria o teste — foi o que aconteceu com
 * `src/server/whatsapp/conexao.test.ts`, que passou a receber a recusa do
 * bloqueio no lugar das respostas que ele mesmo preparou. Trocando aqui, na
 * carga do setup, o mock do teste é o último a falar e continua valendo.
 */

const bloqueado = (async (entrada: RequestInfo | URL) => {
  const destino =
    typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url

  throw new Error(
    `[rede-bloqueada] teste unitário tentou chamar a rede: ${destino}\n` +
      'Declare um mock no próprio teste, ou mova o caso para a suíte de integração local.',
  )
}) as typeof fetch

globalThis.fetch = bloqueado
