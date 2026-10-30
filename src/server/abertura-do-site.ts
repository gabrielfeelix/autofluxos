import { executar } from '@/core/engine/executar'
import { sessaoNova } from '@/core/engine/types'
import { acharFluxo, acharVersao } from '@/server/repos/fluxos'
import type { CanalDoSite } from '@/server/repos/canais-site'

/**
 * O que o balão mostra ao tocar em "Nova conversa", antes de a pessoa escrever
 * qualquer coisa (pedido do Gabriel, 30/out/2026: "a primeira mensagem pode
 * ser nossa").
 *
 * Sai do **próprio motor** rodando o início do fluxo publicado, e não de um
 * texto configurado à parte: mudou o fluxo, a abertura muda junto. Só vale
 * quando o início para numa pergunta com botões; fluxo que abre consultando
 * outro sistema, ou que só cumprimenta, fica sem abertura e o balão mostra a
 * saudação de sempre.
 *
 * O toque num botão vai como opção numa conversa nova, e o motor já trata esse
 * caso (`escolhaNoMenuDoInicio`): tira a saudação e segue pelo caminho
 * escolhido. Por isso nada aqui grava sessão nem mensagem.
 *
 * `comNome` roda com o nome no lugar de `{{nome}}`, para o balão trocar pelo
 * primeiro nome do formulário; `semNome` é o caminho de quem não deu nome.
 */
export type AberturaDoSite = {
  mensagens: string[]
  pergunta: { texto: string; opcoes: { id: string; rotulo: string }[] }
}

export const MARCA_DO_NOME = '{{nome}}'

export async function aberturaDoSite(
  canal: CanalDoSite,
): Promise<{ comNome: AberturaDoSite; semNome: AberturaDoSite } | null> {
  const fluxoId = canal.fluxoBoasVindasId ?? canal.flowId
  if (!fluxoId) return null
  const fluxo = await acharFluxo(fluxoId)
  if (!fluxo?.versaoPublicadaId) return null
  const versao = await acharVersao(fluxo.versaoPublicadaId)
  if (!versao) return null

  const rodar = (vars: Record<string, string>): AberturaDoSite | null => {
    const { acoes, sessao } = executar(versao.grafo, { ...sessaoNova(), vars }, { tipo: 'inicio' })
    if (sessao.status !== 'ativa') return null
    const mensagens: string[] = []
    for (const acao of acoes) {
      if (acao.tipo === 'enviar_texto') mensagens.push(acao.texto)
      else if (acao.tipo === 'enviar_opcoes' && acao === acoes[acoes.length - 1]) {
        return { mensagens, pergunta: { texto: acao.texto, opcoes: acao.opcoes.map((o) => ({ id: o.id, rotulo: o.rotulo })) } }
      } else if (acao.tipo.startsWith('enviar_')) return null
    }
    return null
  }

  const comNome = rodar({ nome: MARCA_DO_NOME })
  const semNome = rodar({})
  return comNome && semNome ? { comNome, semNome } : null
}
