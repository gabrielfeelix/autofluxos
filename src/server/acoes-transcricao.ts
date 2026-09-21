'use server'

import { revalidatePath } from 'next/cache'
import { transcreverAudio } from './transcrever-audio'
import { exigirAcessoAoCliente } from './sessao'

/**
 * Transcrever um áudio recebido, sob demanda.
 *
 * **Sob demanda e não automático**, a razão está inteira em
 * `transcrever-audio.ts`: enquanto a chave do Gemini é a da 4YU no free tier, o
 * áudio vai para treino de modelo. O clique é o consentimento de quem atende, e
 * transformar isso em automático tiraria a decisão de quem a estava tomando.
 *
 * Não revalida a página no caminho bom: o texto volta para o componente e
 * aparece na hora. Um `revalidatePath` aqui refaria a conversa inteira no
 * servidor para mostrar algo que já está na mão.
 */
export async function acaoTranscreverAudio(
  clienteId: string,
  contatoId: string,
  mensagemId: string,
): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await transcreverAudio(clienteId, contatoId, mensagemId)
  if (!r.ok) return { ok: false, erro: r.erro }

  /*
   * A revalidação existe só para a **próxima** abertura já vir com o texto
   * pronto, sem botão. Vai depois de a resposta estar montada, e não no lugar
   * dela.
   */
  revalidatePath(`/clientes/${clienteId}/inbox`)
  return { ok: true, texto: r.texto }
}
