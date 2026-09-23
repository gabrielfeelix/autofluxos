'use server'

import { revalidatePath } from 'next/cache'
import { strFromU8, unzipSync } from 'fflate'
import {
  lerProdutosDaPlanilha,
  planejarImportacao,
  type ErroDaLinha,
  type PlanoDeImportacao,
} from '@/core/importar-produtos'
import { lerCsv, lerXlsx, type Linha } from '@/core/planilha'
import { estaAtivo } from '@/core/produtos'
import { gravarImportacao, listarProdutos } from './repos/produtos'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * Importar o catálogo de uma planilha: prévia e gravação.
 *
 * As duas recebem **o mesmo arquivo**. A confirmação manda o arquivo de novo
 * em vez de mandar a prévia de volta, porque a prévia veio da tela e o
 * servidor não grava o que a tela diz que leu. Ler duas vezes custa milésimos;
 * confiar no navegador custaria o catálogo.
 *
 * `configurar_operacao`, como criar e renomear item (ver `acoes-produtos.ts`).
 */

/** Teto do arquivo. O limite do Next para ação é 4 MB (`next.config.ts`). */
const TAMANHO_MAXIMO = 3 * 1024 * 1024

export type Previa = {
  criar: number
  atualizar: number
  erros: ErroDaLinha[]
  /** Até 5 nomes de cada lado, para a pessoa reconhecer a planilha certa. */
  exemplosCriar: string[]
  exemplosAtualizar: string[]
}

export type RespostaDaPrevia = { ok: true; previa: Previa } | { ok: false; erro: string }

export type RespostaDaImportacao =
  { ok: true; criados: number; atualizados: number; erros: ErroDaLinha[] } | { ok: false; erro: string }

async function lerArquivo(
  formData: FormData,
): Promise<{ ok: true; linhas: Linha[] } | { ok: false; erro: string }> {
  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { ok: false, erro: 'escolha um arquivo .csv ou .xlsx' }
  if (arquivo.size > TAMANHO_MAXIMO) return { ok: false, erro: 'o arquivo passa de 3 MB; divida em partes' }

  const nome = arquivo.name.toLowerCase()
  const bytes = new Uint8Array(await arquivo.arrayBuffer())

  try {
    if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
      return {
        ok: true,
        linhas: lerCsv(new TextDecoder('utf-8').decode(bytes)),
      }
    }
    if (nome.endsWith('.xlsx')) {
      // Só os XML que a leitura usa. Descompactar o resto (imagens, estilos)
      // gastaria memória com o que ninguém lê.
      const zip = unzipSync(bytes, {
        filter: (f) => f.name.startsWith('xl/') && (f.name.endsWith('.xml') || f.name.endsWith('.rels')),
      })
      const arquivos: Record<string, string> = {}
      for (const [caminho, conteudo] of Object.entries(zip)) arquivos[caminho] = strFromU8(conteudo)
      return { ok: true, linhas: lerXlsx(arquivos) }
    }
  } catch (e) {
    return {
      ok: false,
      erro:
        e instanceof Error && !/invalid zip/i.test(e.message) ? e.message : 'não deu para abrir esse arquivo',
    }
  }
  return {
    ok: false,
    erro: 'o arquivo precisa ser .csv ou .xlsx (se for .xls antigo, salve como .xlsx)',
  }
}

async function planejar(
  clienteId: string,
  formData: FormData,
): Promise<{ ok: true; plano: PlanoDeImportacao } | { ok: false; erro: string }> {
  const lido = await lerArquivo(formData)
  if (!lido.ok) return lido

  const leitura = lerProdutosDaPlanilha(lido.linhas)
  if (!leitura.ok) return { ok: false, erro: leitura.motivo }

  const ativos = (await listarProdutos(clienteId)).filter(estaAtivo)
  const plano = planejarImportacao(leitura.itens, ativos)
  plano.erros = [...leitura.erros, ...plano.erros].sort((a, b) => a.linha - b.linha)
  return { ok: true, plano }
}

export async function acaoPreverImportacao(clienteId: string, formData: FormData): Promise<RespostaDaPrevia> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem acesso' }

  const r = await planejar(clienteId, formData)
  if (!r.ok) return r

  return {
    ok: true,
    previa: {
      criar: r.plano.criar.length,
      atualizar: r.plano.atualizar.length,
      erros: r.plano.erros,
      exemplosCriar: r.plano.criar.slice(0, 5).map((i) => i.nome),
      exemplosAtualizar: r.plano.atualizar.slice(0, 5).map((a) => a.item.nome),
    },
  }
}

export async function acaoImportarProdutos(
  clienteId: string,
  formData: FormData,
): Promise<RespostaDaImportacao> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem acesso' }

  const r = await planejar(clienteId, formData)
  if (!r.ok) return r

  const gravado = await gravarImportacao(clienteId, r.plano)
  revalidatePath(`/clientes/${clienteId}/ajustes/produtos`)
  revalidatePath(`/clientes/${clienteId}/quadros`)
  return { ok: true, ...gravado }
}
