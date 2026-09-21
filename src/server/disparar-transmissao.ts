import 'server-only'
import type { Canal, ValoresDoTemplate } from '@/channels/types'
import {
  decidir,
  intervaloMs,
  RITMO_INICIAL,
  type Decisao,
} from '@/core/disparo'
import { condutaPara, explicarErro, podeEnviar, variaveisDe } from '@/core/templates'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { alertar } from './alertar'
import { db } from './db'
import { revalidarNoEnvio } from './servicos/elegibilidade'
import { listarCanais } from './repos/conversas'
import { lerTemplate, type Template as TemplateLido } from './repos/templates'
import {
  lerTransmissao,
  marcarDestinatario,
  mudarEstadoDaTransmissao,
  progressoDa,
  proximosDaFila,
  type Destinatario,
  type Transmissao,
} from './repos/transmissoes'

/**
 * O motor de disparo.
 *
 * ---------------------------------------------------------------------------
 * O que ele faz de diferente de um laço com `forEach`
 * ---------------------------------------------------------------------------
 *
 * Três coisas, e cada uma existe porque a ausência dela já custou caro em
 * algum lugar do mercado:
 *
 * 1. **Ritmo.** O throughput da Meta é por `phone_number_id` e conta entrada e
 *    saída na mesma cota. Disparar no teto deixa o atendimento sem banda e as
 *    respostas de quem está conversando AGORA começam a falhar, o pior jeito
 *    de uma campanha dar errado. Ver `RITMO_INICIAL`.
 * 2. **Retry por classe de erro.** As cinco classes são incompatíveis: repetir
 *    o que é terminal queima o número, desistir do que é transitório perde
 *    entrega, e repetir um `131049` antes das 24h **suspende o destinatário por
 *    mais 24h**. Ver `decidir()`.
 * 3. **Parar tudo quando o template morre.** 132015 não é erro de um contato: é
 *    o modelo pausado. Seguir tentando produz o mesmo erro 5.000 vezes, e cada
 *    um conta contra a nota de qualidade do número do cliente.
 *
 * ---------------------------------------------------------------------------
 * O que sai daqui como `retida` NÃO é entrega
 * ---------------------------------------------------------------------------
 *
 * A Meta responde 200 e pode dizer `held_for_quality_assessment`. A mensagem
 * ficou segurada; se o veredito for ruim ela é descartada e chega depois como
 * `failed` 132015. Gravar "enviado" ali é o que faz uma tela dizer "campanha
 * enviada" quando nada saiu.
 */

/** Quantos destinatários por passada. */
export const POR_PASSADA = 200

export type ResumoDoDisparo = {
  transmissaoId: string
  tentados: number
  aceitos: number
  retidos: number
  falhas: number
  /** A transmissão acabou (fila vazia) ou parou (template morto). */
  terminou: boolean
  parou: string | null
}

/**
 * Os valores das variáveis para este contato.
 *
 * **Os parâmetros fixos vêm da transmissão; o que muda por pessoa vem do
 * contato.** `{{1}}` costuma ser o nome, e é por isso que existe o `nome` do
 * destinatário aqui: resolver na hora do envio é a única forma de uma
 * transmissão dizer "Oi, Ana" e "Oi, João" com o mesmo template.
 *
 * O contrato dos parâmetros é `{ "1": "...", "2": "..." }`, e a chave especial
 * `nome` diz "aqui vai o nome do contato". Sem isso, a pessoa teria que montar
 * 400 transmissões, uma por nome.
 */
export function valoresPara(
  parametros: Record<string, string>,
  destinatario: { nome: string | null },
  corpoDoTemplate: string,
): ValoresDoTemplate {
  const quantas = variaveisDe(corpoDoTemplate).length
  if (quantas === 0) return {}

  const corpo: string[] = []
  for (let i = 1; i <= quantas; i += 1) {
    const bruto = parametros[String(i)] ?? ''
    /*
     * `{nome}` é o único marcador dinâmico. Mais que isso viraria uma
     * linguagem de template dentro do template, e a Meta já tem uma.
     *
     * Vazio nunca: a Meta recusa parâmetro em branco com 132000, e "Oi, " sem
     * nome é pior que "Oi, tudo bem?".
     */
    const valor = bruto.replace(/\{nome\}/g, destinatario.nome ?? '').trim()
    corpo.push(valor || destinatario.nome || 'tudo bem')
  }

  return { corpo }
}

/**
 * Manda uma transmissão até a fila acabar ou o orçamento de tempo estourar.
 *
 * **Não roda a transmissão inteira numa chamada**, e isso é de propósito: ela
 * roda dentro de uma função da Vercel, que morre no `maxDuration`. Uma passada
 * pega `POR_PASSADA` e devolve; quem chama volta depois. Uma campanha de 5.000
 * são muitas passadas, e é isso que permite que ela sobreviva a um deploy no
 * meio.
 */
export async function dispararTransmissao(
  transmissaoId: string,
  opcoes: { porPassada?: number; canal?: Canal; esperar?: (ms: number) => Promise<void> } = {},
): Promise<ResumoDoDisparo> {
  const resumo: ResumoDoDisparo = {
    transmissaoId,
    tentados: 0,
    aceitos: 0,
    retidos: 0,
    falhas: 0,
    terminou: false,
    parou: null,
  }

  const transmissao = await lerTransmissao(transmissaoId)
  if (!transmissao) return { ...resumo, terminou: true, parou: 'a transmissão não existe mais' }

  if (transmissao.estado === 'cancelada' || transmissao.estado === 'concluida') {
    return { ...resumo, terminou: true, parou: `a transmissão está ${transmissao.estado}` }
  }

  const template = await lerTemplate(transmissao.templateId)
  if (!template) {
    await pararTransmissao(transmissao, 'o modelo usado não existe mais')
    return { ...resumo, terminou: true, parou: 'o modelo usado não existe mais' }
  }

  /*
   * O status é conferido **agora**, e não na hora de agendar. Um template
   * aprovado ontem pode estar pausado hoje, a Meta pausa por qualidade sem
   * avisar antes, e uma campanha agendada para amanhã encontraria o modelo
   * morto.
   */
  if (!podeEnviar(template.status)) {
    const motivo = `o modelo está ${template.status} na Meta, e só modelo aprovado entrega`
    await pararTransmissao(transmissao, motivo)
    return { ...resumo, terminou: true, parou: motivo }
  }

  const canal = opcoes.canal ?? (await canalDoCliente(transmissao.clienteId))
  if (!canal) {
    const motivo = 'este cliente não tem um número de WhatsApp conectado'
    await pararTransmissao(transmissao, motivo)
    return { ...resumo, terminou: true, parou: motivo }
  }

  if (!canal.enviarTemplate) {
    const motivo = 'o canal conectado não sabe enviar modelo aprovado'
    await pararTransmissao(transmissao, motivo)
    return { ...resumo, terminou: true, parou: motivo }
  }

  if (transmissao.estado !== 'enviando') {
    await mudarEstadoDaTransmissao(transmissao.id, 'enviando')
  }

  const fila = await proximosDaFila(transmissao.id, opcoes.porPassada ?? POR_PASSADA)
  if (fila.length === 0) {
    await concluirSeAcabou(transmissao)
    return { ...resumo, terminou: true }
  }

  const espera = opcoes.esperar ?? dormir
  const intervalo = intervaloMs(RITMO_INICIAL)

  for (const destinatario of fila) {
    resumo.tentados += 1

    const decisao = await tentarUm(canal, transmissao, template, destinatario)

    if (decisao.tipo === 'aceita') resumo.aceitos += 1
    if (decisao.tipo === 'retida') resumo.retidos += 1
    if (decisao.tipo === 'falhou') resumo.falhas += 1

    if (decisao.tipo === 'parar_tudo') {
      resumo.falhas += 1
      /*
       * O template morreu, ou o payload está errado. Nos dois casos, seguir
       * tentando produz o mesmo erro contra os 5.000 que sobraram, e cada um
       * conta contra a nota de qualidade do número do cliente.
       */
      await pararTransmissao(transmissao, decisao.motivo)
      await alertar('uma transmissão parou no meio', new Error(decisao.motivo), {
        transmissao: transmissao.id,
      }).catch(() => {})
      return { ...resumo, terminou: true, parou: decisao.motivo }
    }

    // O ritmo. Sem isto, a transmissão come a cota do atendimento.
    await espera(intervalo)
  }

  await concluirSeAcabou(transmissao)
  return resumo
}

type ResultadoDeUm =
  | { tipo: 'aceita' | 'retida' | 'falhou' }
  | { tipo: 'parar_tudo'; motivo: string }

/**
 * Um destinatário: manda, lê a resposta de verdade e grava o que aconteceu.
 *
 * Nunca estoura. Um contato que falha não pode derrubar a transmissão, é o
 * mesmo desenho de `enviarAgendadas`, onde o `try` é por linha e não em volta
 * do laço.
 */
async function tentarUm(
  canal: Canal,
  transmissao: Transmissao,
  /*
   * O template vem pronto de quem chama, lido **uma vez** por passada. Relê-lo
   * aqui custaria uma ida ao banco por destinatário, 5.000 leituras de uma
   * linha que não muda no meio do disparo.
   */
  template: TemplateLido,
  destinatario: Destinatario,
): Promise<ResultadoDeUm> {
  /*
   * **A revalidação do instante do envio** (RB-39, T6.2).
   *
   * Entre confirmar o lote e a mensagem sair cabem horas, e a elegibilidade
   * não é estável nesse intervalo: um contato pode ter sido apagado, ou ficar
   * sem número. Estar na lista **não** é autorização; a lista diz para quem
   * alguém quis mandar, e isto diz para quem ainda dá.
   *
   * O que esta conferência **não** faz é acrescentar ninguém: a lista foi
   * congelada na confirmação, e a RB-38 é explícita que editar o segmento
   * depois não aumenta o lote. Ela só recusa.
   *
   * A transmissão sempre usa modelo aprovado, é o que `podeEnviar` já
   * garantiu acima, então `comModelo: true`, e a janela de 24h não exclui
   * ninguém aqui. Passar `false` faria toda campanha para quem não escreveu
   * nas últimas 24h ser recusada, que é o oposto da razão de existir do
   * modelo.
   */
  const recusa = await revalidarNoEnvio(transmissao.clienteId, destinatario.contatoId, {
    comModelo: true,
  })
  if (recusa) {
    await marcarDestinatario(destinatario.id, { estado: 'falhou', erro: recusa })
    // O motivo fica escrito: sem ele, a transmissão termina com 40 enviados e
    // 12 sumidos, e ninguém sabe se foi bloqueio, janela ou defeito.
    await db()
      .from('transmissao_destinatarios')
      .update({ motivo_da_exclusao: recusa })
      .eq('id', destinatario.id)
    return { tipo: 'falhou' }
  }

  try {
    const envio = await canal.enviarTemplate!(destinatario.waId, {
      nome: template.nome,
      idioma: template.idioma,
      valores: valoresPara(transmissao.parametros, destinatario, template.componentes.corpo),
    })

    /*
     * `retida` gravado como `retida`, e nunca como `aceita`. A diferença é
     * invisível no HTTP e é a única coisa que separa "campanha enviada" de
     * "campanha que a Meta ainda está decidindo se entrega".
     */
    if (envio.situacao === 'falhou') {
      await marcarDestinatario(destinatario.id, {
        estado: 'falhou',
        wamid: envio.wamid || null,
        erro: 'a Meta recusou o envio na hora',
      })
      return { tipo: 'falhou' }
    }

    await marcarDestinatario(destinatario.id, {
      estado: envio.situacao,
      wamid: envio.wamid || null,
    })
    return { tipo: envio.situacao }
  } catch (erro) {
    const codigo = codigoDoErro(erro)
    const decisao: Decisao =
      codigo === null
        // Rede, prazo, coisa nossa: vale uma repetida, que é o que `decidir`
        // faz com um erro transitório.
        ? { acao: 'esperar', ms: 0 }
        : decidir(condutaPara(codigo), { tentativas: 1, codigo })

    if (decisao.acao === 'parar_tudo') {
      await marcarDestinatario(destinatario.id, {
        estado: 'falhou',
        codigoErro: codigo,
        erro: codigo !== null ? explicarErro(codigo) : null,
      })
      return { tipo: 'parar_tudo', motivo: decisao.motivo }
    }

    await marcarDestinatario(destinatario.id, {
      estado: 'falhou',
      codigoErro: codigo,
      erro:
        codigo !== null
          ? explicarErro(codigo)
          : erro instanceof Error
            ? erro.message
            : String(erro),
    })
    return { tipo: 'falhou' }
  }
}

/**
 * O código da Meta dentro da mensagem de erro do adaptador.
 *
 * O `canalCloudApi` estoura com o corpo cru da Meta dentro do texto, é o que
 * permite ler o código sem mudar a forma de todos os outros envios. Feio e
 * honesto: a alternativa seria um tipo de erro novo em todo o canal, e o
 * retorno não paga.
 */
function codigoDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro)
  const achado = texto.match(/"code"\s*:\s*(\d+)/)
  return achado ? Number(achado[1]) : null
}

async function canalDoCliente(clienteId: string): Promise<Canal | null> {
  const canais = await listarCanais(clienteId)
  const doWhats = canais.find((c) => c.provider !== 'instagram' && c.status === 'ativo')
  if (!doWhats) return null
  return adaptadorDoCanal(doWhats)
}

async function pararTransmissao(transmissao: Transmissao, motivo: string): Promise<void> {
  await mudarEstadoDaTransmissao(transmissao.id, 'falhou', { erro: motivo })
}

/** Só conclui quando a fila esvaziou de verdade. */
async function concluirSeAcabou(transmissao: Transmissao): Promise<void> {
  const progresso = await progressoDa(transmissao.id)
  if (progresso.na_fila > 0) return
  await mudarEstadoDaTransmissao(transmissao.id, 'concluida')
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}
