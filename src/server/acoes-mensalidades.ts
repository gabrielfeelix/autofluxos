'use server'

import { lerValor } from '@/core/crm'
import {
  ANTECEDENCIA_MAXIMA,
  ANTECEDENCIA_PADRAO,
  competenciaParaCobrar,
  CORPO_DO_MODELO_DE_COBRANCA,
  DIA_MAXIMO,
  EXEMPLOS_DO_MODELO_DE_COBRANCA,
  hojeEmSaoPaulo,
  NOME_DO_MODELO_DE_COBRANCA,
  primeiraCompetencia,
} from '@/core/mensalidade'
import { acaoApagarTemplate, acaoCriarTemplate } from './acoes-transmissoes'
import { reais } from './cobrancas'
import { ENDERECO_DE_PAGAR } from './link-de-pagar'
import { cobrarOMes } from './mensalidades'
import { exigirCapacidade, meuAlcance, recusou } from './permissoes'
import { recusaDoPlano } from './recursos-do-plano'
import { acharAssinatura, inserirAssinatura, mudarStatusDaAssinatura, type Assinatura } from './repos/assinaturas'
import { anotar } from './repos/eventos'
import { acharLead } from './repos/leads'
import { conexaoAtiva } from './repos/pagamentos'
import { produtoPorId } from './repos/produtos'
import { listarTemplates } from './repos/templates'

/**
 * A mensalidade pela ficha do contato (0145, modo Pix do mês).
 *
 * Mesma porta do Cobrar: `registrar_venda`, e o recurso `integracoes` do
 * plano. O valor sai do plano do catálogo quando há um, relido aqui; o
 * navegador nunca define o valor de um plano.
 */

export type ResultadoDaMensalidade = { ok: true; assinatura: Assinatura; cobrouAgora: boolean } | { ok: false; erro: string }

export async function acaoCriarMensalidade(
  clienteId: string,
  contatoId: string,
  entrada: { produtoId?: string; valor?: string; descricao?: string; dia: number; antecedencia?: number },
): Promise<ResultadoDaMensalidade> {
  const acesso = await exigirCapacidade(clienteId, 'registrar_venda', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite criar mensalidade. Peça ao dono da conta.' }
  const recusa = await recusaDoPlano(clienteId, 'integracoes')
  if (recusa) return { ok: false, erro: recusa }
  const lead = await acharLead(clienteId, contatoId, await meuAlcance(clienteId))
  if (!lead) return { ok: false, erro: 'Contato não encontrado.' }
  const conexao = await conexaoAtiva(clienteId)
  if (!conexao) return { ok: false, erro: 'Conecte a conta de recebimento em Ajustes > Pagamentos.' }

  const dia = Math.trunc(entrada.dia)
  if (!(dia >= 1 && dia <= DIA_MAXIMO)) return { ok: false, erro: `O vencimento vai do dia 1 ao dia ${DIA_MAXIMO}.` }
  const antecedencia = Math.trunc(entrada.antecedencia ?? ANTECEDENCIA_PADRAO)
  if (!(antecedencia >= 0 && antecedencia <= ANTECEDENCIA_MAXIMA)) {
    return { ok: false, erro: `A cobrança sai de 0 a ${ANTECEDENCIA_MAXIMA} dias antes do vencimento.` }
  }

  let valorCentavos: number
  let descricao = entrada.descricao?.trim() ?? ''
  let produtoId: string | null = null
  if (entrada.produtoId) {
    const produto = await produtoPorId(clienteId, entrada.produtoId)
    if (!produto || produto.arquivadoEm) return { ok: false, erro: 'Esse plano saiu do catálogo.' }
    if (produto.preco === null || produto.preco <= 0) return { ok: false, erro: `${produto.nome} está sem preço. Cadastre o preço ou use valor livre.` }
    valorCentavos = Math.round(produto.preco * 100)
    descricao = descricao || produto.nome
    produtoId = produto.id
  } else {
    const valor = lerValor(entrada.valor ?? '')
    if (!valor.ok || valor.valor === null || valor.valor <= 0) return { ok: false, erro: 'Digite o valor, por exemplo 280,00.' }
    valorCentavos = Math.round(valor.valor * 100)
  }
  if (valorCentavos > 100_000_000) return { ok: false, erro: 'Valor acima do permitido.' }
  if (descricao === '') return { ok: false, erro: 'Diga o que é a mensalidade.' }
  if (descricao.length > 160) return { ok: false, erro: 'A descrição passa de 160 caracteres.' }

  const hoje = hojeEmSaoPaulo()
  const autor = acesso.sessao.usuario.nome?.trim() || null
  const assinatura = await inserirAssinatura({
    clienteId,
    contatoId,
    produtoId,
    descricao,
    valorCentavos,
    diaDoVencimento: dia,
    antecedenciaDias: antecedencia,
    modo: 'pix_do_mes',
    status: 'ativa',
    gateway: conexao.gateway,
    inicio: primeiraCompetencia(hoje, dia),
    criadaPor: autor,
  })
  await anotar(clienteId, contatoId, 'cobranca', { status: 'mensalidade_criada', valor: reais(valorCentavos), descricao }, autor)

  // Já está no prazo deste mês: a primeira sai agora, sem esperar o relógio de amanhã.
  let cobrouAgora = false
  if (competenciaParaCobrar(assinatura, hoje)) {
    cobrouAgora = (await cobrarOMes(assinatura, hoje).catch(() => 'nada' as const)) === 'cobrada'
  }
  return { ok: true, assinatura, cobrouAgora }
}

const DE_PARA = {
  pausar: { de: ['ativa'], para: 'pausada', nota: 'mensalidade_pausada' },
  retomar: { de: ['pausada'], para: 'ativa', nota: 'mensalidade_retomada' },
  cancelar: { de: ['ativa', 'pausada', 'aguardando'], para: 'cancelada', nota: 'mensalidade_cancelada' },
} as const

export async function acaoMudarMensalidade(
  clienteId: string,
  assinaturaId: string,
  acao: keyof typeof DE_PARA,
): Promise<{ ok: true; status: Assinatura['status'] } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'registrar_venda', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mudar mensalidade.' }
  const assinatura = await acharAssinatura(clienteId, assinaturaId)
  if (!assinatura) return { ok: false, erro: 'Mensalidade não encontrada.' }
  if (!(await acharLead(clienteId, assinatura.contatoId, await meuAlcance(clienteId)))) return { ok: false, erro: 'Mensalidade não encontrada.' }

  const passo = DE_PARA[acao]
  const mudou = await mudarStatusDaAssinatura(clienteId, assinaturaId, [...passo.de], passo.para)
  if (!mudou) return { ok: true, status: (await acharAssinatura(clienteId, assinaturaId))?.status ?? assinatura.status }
  await anotar(
    clienteId,
    assinatura.contatoId,
    'cobranca',
    { status: passo.nota, valor: reais(assinatura.valorCentavos), descricao: assinatura.descricao },
    acesso.sessao.usuario.nome?.trim() || null,
  )
  return { ok: true, status: passo.para }
}

/**
 * Cria o modelo `lembrete_de_cobranca` na Meta, para a mensalidade chegar a
 * quem não conversa há mais de 24 horas. Utilidade (mais barato que
 * marketing), com o botão Pagar para a página da cobrança. A aprovação é da
 * Meta e costuma levar minutos.
 */
export async function acaoCriarModeloDeCobranca(clienteId: string): Promise<{ ok: boolean; erro?: string }> {
  // Recusado ou parado no rascunho: sai antes, porque o nome é único por conta.
  const anterior = (await listarTemplates(clienteId)).find((t) => t.nome === NOME_DO_MODELO_DE_COBRANCA)
  if (anterior && (anterior.status === 'recusado' || anterior.status === 'rascunho')) {
    const apagado = await acaoApagarTemplate(clienteId, anterior.id)
    if (!apagado.ok) return apagado
  } else if (anterior) {
    return { ok: true }
  }
  const r = await acaoCriarTemplate(clienteId, {
    nome: NOME_DO_MODELO_DE_COBRANCA,
    categoria: 'UTILITY',
    componentes: {
      corpo: CORPO_DO_MODELO_DE_COBRANCA,
      botoes: [{ tipo: 'URL', texto: 'Pagar', valor: `${ENDERECO_DE_PAGAR}{{1}}` }],
    },
    exemplos: EXEMPLOS_DO_MODELO_DE_COBRANCA,
  })
  return r.ok ? { ok: true } : { ok: false, erro: r.erro }
}
