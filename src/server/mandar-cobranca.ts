import 'server-only'
import type { AutorDaSaida } from '@/core/autor-da-mensagem'
import { CORPO_DO_MODELO_DE_COBRANCA, NOME_DO_MODELO_DE_COBRANCA } from '@/core/mensalidade'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { reais, tentarPedidoNativo, textoDaCobranca } from './cobrancas'
import { codigoDePagar } from './link-de-pagar'
import type { CobrancaRegistrada } from './repos/cobrancas'
import { confirmarEntrega, registrarSaida, type ContextoDeResposta } from './repos/conversas'
import { listarTemplatesAprovados } from './repos/templates'

/**
 * Mandar uma cobrança já criada para a conversa. Um caminho só para o botão
 * Cobrar do Inbox e para o relógio da mensalidade: o cliente recebe a mesma
 * coisa, venha de quem vier.
 *
 * Dentro da janela de 24h: o pedido nativo do WhatsApp quando dá, senão o
 * resumo com o botão do link e o Pix copia e cola sozinho. Fora dela só um
 * modelo aprovado chega, e é `mandarLembretePorModelo`.
 */

export type ResultadoDoEnvio = { ok: true } | { ok: false; erro: string }

export async function mandarCobrancaNaConversa(
  contatoId: string,
  contexto: ContextoDeResposta,
  cobranca: CobrancaRegistrada,
  autor: AutorDaSaida | null,
): Promise<ResultadoDoEnvio> {
  let canal
  try {
    canal = await adaptadorDoCanal(contexto.canal)
  } catch {
    return { ok: false, erro: 'A cobrança foi criada, mas o canal não respondeu. Copie o Pix pela tela Cobranças.' }
  }

  // 0. O pedido nativo do WhatsApp: valor, Pix e link numa bolha só (etapa E).
  const nativo = await tentarPedidoNativo(canal, contexto.waId, cobranca)
  if (nativo) {
    const pedido = await registrarSaida({
      contatoId,
      sessaoId: contexto.sessaoId,
      texto: nativo.texto,
      payload: { cobranca: cobranca.id, pedido: true },
      autor,
    })
    await confirmarEntrega(pedido, nativo.id)
    return { ok: true }
  }

  // 1. O resumo, com o botão do link quando o canal tem botão.
  const texto = textoDaCobranca(cobranca)
  const comBotao = cobranca.link ? canal.enviarBotaoDeLink?.bind(canal) : undefined
  const textoSemBotao = cobranca.link && !comBotao ? `${texto}\n${cobranca.link}` : texto
  const resumo = await registrarSaida({
    contatoId,
    sessaoId: contexto.sessaoId,
    texto: textoSemBotao,
    payload: {
      cobranca: cobranca.id,
      ...(comBotao ? { botao: { rotulo: 'Pagar', url: cobranca.link! } } : {}),
    },
    autor,
  })
  try {
    const id = comBotao
      ? await comBotao(contexto.waId, texto, 'Pagar', cobranca.link!)
      : await canal.enviarTexto(contexto.waId, textoSemBotao)
    await confirmarEntrega(resumo, id)
  } catch {
    return { ok: false, erro: 'A cobrança foi criada, mas a mensagem não saiu. Copie o Pix pela tela Cobranças.' }
  }

  // 2. O Pix copia e cola sozinho: no celular, tocar e segurar copia a mensagem inteira.
  if (cobranca.pixCopiaCola) {
    const pix = await registrarSaida({
      contatoId,
      sessaoId: contexto.sessaoId,
      texto: cobranca.pixCopiaCola,
      payload: { cobranca: cobranca.id, pix: true },
      autor,
    })
    try {
      await confirmarEntrega(pix, await canal.enviarTexto(contexto.waId, cobranca.pixCopiaCola))
    } catch {
      return { ok: false, erro: 'O resumo saiu, mas o código Pix não. Copie o Pix pela tela Cobranças.' }
    }
  }
  return { ok: true }
}

const DIA_E_MES = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })

/**
 * A cobrança fora das 24 horas, pelo modelo `lembrete_de_cobranca` aprovado
 * da conta. O botão Pagar abre a página da cobrança (`/pagar/<código>`).
 *
 * `sem_modelo` quando a conta não criou o modelo, ele não foi aprovado, ou o
 * canal não manda modelo (Instagram, Telegram, Site): quem chama anota para a
 * equipe mandar quando a pessoa voltar a falar.
 */
export async function mandarLembretePorModelo(
  clienteId: string,
  contatoId: string,
  contexto: ContextoDeResposta,
  cobranca: CobrancaRegistrada,
  nome: string | null,
): Promise<'ok' | 'sem_modelo' | 'erro'> {
  const modelo = (await listarTemplatesAprovados(clienteId)).find((t) => t.nome === NOME_DO_MODELO_DE_COBRANCA)
  const codigo = codigoDePagar(cobranca.id)
  if (!modelo || !codigo) return 'sem_modelo'
  const canal = await adaptadorDoCanal(contexto.canal)
  if (!canal.enviarTemplate) return 'sem_modelo'

  const primeiroNome = nome?.trim().split(/\s+/)[0] || 'tudo bem'
  const corpo = [primeiroNome, cobranca.descricao, reais(cobranca.valorCentavos), DIA_E_MES.format(new Date(cobranca.venceEm))]
  const texto = corpo.reduce((t, v, i) => t.replace(`{{${i + 1}}}`, v), CORPO_DO_MODELO_DE_COBRANCA)
  const saida = await registrarSaida({
    contatoId,
    sessaoId: contexto.sessaoId,
    texto,
    payload: { cobranca: cobranca.id, modelo: modelo.nome },
    autor: null,
  })
  try {
    const envio = await canal.enviarTemplate(contexto.waId, {
      nome: modelo.nome,
      idioma: modelo.idioma,
      valores: { corpo, botoes: [{ indice: 0, texto: codigo }] },
    })
    if (envio.situacao === 'falhou') return 'erro'
    await confirmarEntrega(saida, envio.wamid)
    return 'ok'
  } catch (erro) {
    console.error('[mensalidade] o lembrete por modelo não saiu', erro)
    return 'erro'
  }
}
