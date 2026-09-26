'use server'

import { revalidatePath } from 'next/cache'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import { escreverFicha, listasDoRamo, marcadasDaLista, type Ficha } from '@/core/ficha-do-assistente'
import { pacoteDo } from '@/core/nichos'
import { acharCliente, atualizarContexto } from './repos/clientes'
import { nichoDaConta } from './repos/recursos'
import { escolherModelo } from './ia/modelo'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * A ficha do assistente (`core/ficha-do-assistente.ts`, PLANO-NICHOS 1.7).
 *
 * Salvar grava o **mesmo** `contexto_negocio` que a caixa livre gravava, só
 * que montado em blocos pela ficha. A porta também é a mesma da caixa
 * (`configurar_operacao`): mudar de tela não é mudar quem pode.
 */
export async function acaoSalvarFicha(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const pacote = pacoteDo(await nichoDaConta(clienteId))
  if (!pacote) return { erro: 'esta conta não tem tipo de negócio: use a caixa de texto' }
  const { perguntas, pode } = pacote.ficha

  const texto = (nome: string) => String(formData.get(nome) ?? '')
  const ficha: Ficha = {
    abertura: texto('abertura'),
    respostas: Object.fromEntries(
      perguntas.map((p) => [p.id, { titulo: texto(`titulo:${p.id}`) || p.titulo, texto: texto(`resposta:${p.id}`) }]),
    ),
    listas: { pode: null, nunca: null, passar: null },
    mais: texto('mais'),
  }
  for (const lista of listasDoRamo(pode)) {
    // Só vale opção que a lista oferece, e a travada entra mesmo que o
    // formulário não a mande: a caixa desabilitada não vai no envio.
    const validas = new Set(lista.opcoes.map((o) => o.texto))
    const marcadas = formData.getAll(`lista:${lista.id}`).map(String).filter((t) => validas.has(t))
    ficha.listas[lista.id] = marcadasDaLista(lista, marcadas)
  }

  try {
    await atualizarContexto(clienteId, escreverFicha(ficha, perguntas))
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'não deu para salvar' }
  }

  revalidatePath(`/clientes/${clienteId}/ajustes/contexto`)
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true }
}

export type RespostaDoTeste = { pergunta: string; resposta: string; passou: boolean }

export type EstadoDoTeste = { respostas?: RespostaDoTeste[]; erro?: string }

/**
 * O botão Testar: faz ao assistente as perguntas que o cliente final sempre
 * faz no ramo, com a ficha **salva**, e mostra o que ele respondeu.
 *
 * É a mesma IA e o mesmo prompt da conversa de verdade (`escolherModelo`,
 * `montarPrompt` por dentro do modelo), sem ferramenta nenhuma: o teste é da
 * ficha, não do catálogo. Não grava conversa nem conta no limite por contato,
 * porque não há contato. Resposta "não sei" aparece como tal: é o bot passando
 * para uma pessoa, e é o que a ficha incompleta tem que mostrar.
 */
export async function acaoTestarFicha(clienteId: string, _estado: EstadoDoTeste): Promise<EstadoDoTeste> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { erro: acesso.erro }

  const [cliente, nicho] = await Promise.all([acharCliente(clienteId), nichoDaConta(clienteId)])
  const pacote = pacoteDo(nicho)
  if (!cliente || !pacote) return { erro: 'esta conta não tem tipo de negócio' }
  if (cliente.contextoNegocio.trim() === '') return { erro: 'a ficha está vazia: salve antes de testar' }

  const { modelo, motivo } = await escolherModelo({ iaHabilitada: true, clienteId })
  if (!modelo) return { erro: motivo ?? 'a IA não está disponível para esta conta' }

  const respostas = await Promise.all(
    pacote.ficha.perguntas.map(async (p): Promise<RespostaDoTeste> => {
      try {
        const r = await modelo.responder({
          contextoNegocio: cliente.contextoNegocio,
          instrucao: 'Responda à pergunta do cliente com o que a empresa informou, em uma ou duas frases.',
          pergunta: p.doCliente,
        })
        if (r.tipo === 'texto') return { pergunta: p.doCliente, resposta: r.texto, passou: false }
        if (r.tipo === 'nao_sei' && r.falhou) return { pergunta: p.doCliente, resposta: 'A IA não respondeu agora. Tente de novo.', passou: true }
        return { pergunta: p.doCliente, resposta: 'Não sabe: passaria para uma pessoa.', passou: true }
      } catch {
        return { pergunta: p.doCliente, resposta: 'A IA não respondeu agora. Tente de novo.', passou: true }
      }
    }),
  )
  return { respostas }
}
