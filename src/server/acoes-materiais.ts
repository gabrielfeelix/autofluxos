'use server'

import { revalidatePath } from 'next/cache'
import { conferirMaterial, ehTipoDeMaterial, MIME_DO_MATERIAL } from '@/core/materiais'
import { pedirEnvioAssinado, type EnvioAssinado } from './repos/acervo'
import { removerMaterial, salvarMaterial } from './repos/materiais'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * As ações do cardápio em arquivo (0106).
 *
 * `configurar_operacao`, a mesma de editar produto: o cardápio é o que o bot
 * manda para todo cliente que pedir, e trocá-lo é mexer no que a empresa
 * oferece. Quem só atende não troca.
 *
 * **O arquivo vai para o acervo** (`autofluxos-acervo`, pasta da conta), pelo
 * mesmo envio assinado do bloco de mídia: o navegador manda os bytes direto
 * ao Storage, e o servidor só escolhe o caminho depois de conferir o dono.
 * Nenhum bucket novo e nenhuma política nova de Storage. De quebra, o PDF fica
 * no acervo e o fluxo de botões pode mandar o mesmo arquivo pelo bloco de
 * mídia.
 */

function recarregar(clienteId: string): void {
  revalidatePath(`/clientes/${clienteId}/loja/catalogo`)
  revalidatePath(`/clientes/${clienteId}/ajustes/acervo`)
}

/**
 * Prepara o envio do arquivo do cardápio. Só nome, tipo e tamanho trafegam
 * aqui; o arquivo sobe do navegador (ver `acaoPrepararEnvioDeArquivo`).
 */
export async function acaoPrepararEnvioDoMaterial(
  clienteId: string,
  tipo: string,
  arquivo: { nome: string; tipo: string; bytes: number },
): Promise<{ ok: boolean; erro?: string; envio?: EnvioAssinado }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  if (!ehTipoDeMaterial(tipo)) return { ok: false, erro: 'esse tipo de arquivo não existe' }
  if (
    typeof arquivo?.nome !== 'string' ||
    typeof arquivo?.tipo !== 'string' ||
    typeof arquivo?.bytes !== 'number'
  ) {
    return { ok: false, erro: 'arquivo inválido' }
  }
  // O acervo aceita vídeo e áudio também; aqui só o que o material é.
  if (!MIME_DO_MATERIAL[tipo].includes(arquivo.tipo)) {
    return {
      ok: false,
      erro: tipo === 'cardapio-pdf' ? 'Escolha um arquivo PDF.' : 'Escolha uma imagem PNG, JPG ou WebP.',
    }
  }

  const r = await pedirEnvioAssinado(clienteId, arquivo)
  if (!r.ok) return { ok: false, erro: r.motivo }
  return { ok: true, envio: r.envio }
}

/** O envio terminou: grava o endereço público como o cardápio da conta. */
export async function acaoSalvarMaterial(
  clienteId: string,
  tipo: string,
  url: string,
  nomeArquivo: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  if (!ehTipoDeMaterial(tipo)) return { ok: false, erro: 'esse tipo de arquivo não existe' }
  const conferido = conferirMaterial(tipo, String(url ?? ''), String(nomeArquivo ?? ''))
  if (!conferido.ok) return { ok: false, erro: conferido.motivo }

  const r = await salvarMaterial(clienteId, tipo, conferido.url, conferido.nomeArquivo)
  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId)
  return { ok: true }
}

/** Tira o material do bot. O arquivo continua no acervo. */
export async function acaoRemoverMaterial(clienteId: string, tipo: string): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  if (!ehTipoDeMaterial(tipo)) return { ok: false, erro: 'esse tipo de arquivo não existe' }

  const r = await removerMaterial(clienteId, tipo)
  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId)
  return { ok: true }
}
