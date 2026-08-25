import 'server-only'
import { ENDERECO_DA_AGENDA, NOME_DA_AGENDA, PREFIXO_DA_CHAVE } from '@/core/agenda'

/**
 * Perguntar à agenda se a chave vale — e o que ela sabe.
 *
 * **Existe porque "está ligado?" não tinha resposta em tela nenhuma.** A
 * credencial era colada num campo e guardada num cofre; se estivesse errada,
 * ninguém descobria ali. O erro aparecia depois, no meio de uma conversa de
 * verdade, como um handoff sem explicação — e quem estivesse olhando o painel
 * veria uma credencial cadastrada, com cara de pronta.
 *
 * A conferência é `GET /catalogo` porque ela é a rota mais barata que **prova
 * duas coisas de uma vez**: que a chave é aceita, e de qual conta ela é. O que
 * volta — quantos profissionais, quais serviços — é a resposta para a outra
 * pergunta que ninguém tinha onde responder: *"qual informação o bot vai
 * puxar?"*. Em vez de descrever, mostra.
 *
 * **O endereço é fixo e nosso.** Por isso aqui não há a conferência de
 * SSRF que `efeitos/rede.ts` faz: ela existe para endereço que veio de fora, e
 * este não veio de lugar nenhum — está no código.
 */

/** Quanto se espera pela agenda antes de desistir. */
const TIMEOUT_MS = 8_000

export type EstadoDaAgenda =
  | {
      ok: true
      /** O que a conta tem. É o que a tela mostra como prova. */
      profissionais: string[]
      servicos: string[]
      locais: string[]
      /** Como esta conta chama um serviço: "Aula", "Sessão", "Modalidade". */
      comoChamaServico: string | null
    }
  | { ok: false; motivo: string }

export async function conferirChaveDaAgenda(chave: string): Promise<EstadoDaAgenda> {
  const limpa = chave.trim()
  if (limpa === '') return { ok: false, motivo: 'cole a chave antes de conferir' }

  /*
   * O prefixo é conferido antes da rede, e não é frescura: a chave é colada de
   * outra tela, e o erro mais comum é colar a coisa errada — o id da conta, uma
   * URL, o segredo do webhook. Dizer isso aqui custa zero e evita esperar oito
   * segundos para ouvir "recusada".
   */
  if (!limpa.startsWith(PREFIXO_DA_CHAVE)) {
    return {
      ok: false,
      motivo: `isso não parece uma chave da ${NOME_DA_AGENDA} — elas começam com "${PREFIXO_DA_CHAVE}".`,
    }
  }

  let resposta: Response
  try {
    resposta = await fetch(`${ENDERECO_DA_AGENDA}/catalogo`, {
      headers: { authorization: `Bearer ${limpa}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch {
    // Sem detalhe do erro de rede: ele não ajuda quem está olhando a tela, e a
    // mensagem do undici às vezes carrega o endereço inteiro.
    return { ok: false, motivo: `a ${NOME_DA_AGENDA} não respondeu. Tente de novo em instantes.` }
  }

  if (resposta.status === 401) {
    return { ok: false, motivo: 'a chave foi recusada. Gere outra e cole de novo.' }
  }
  if (!resposta.ok) {
    return { ok: false, motivo: `a ${NOME_DA_AGENDA} respondeu ${resposta.status}.` }
  }

  try {
    const corpo = (await resposta.json()) as {
      profissionais?: { nome?: string }[]
      servicos?: { nome?: string }[]
      locais?: { nome?: string }[]
      vocabulario?: { servico?: { singular?: string } }
    }

    return {
      ok: true,
      profissionais: nomes(corpo.profissionais),
      servicos: nomes(corpo.servicos),
      locais: nomes(corpo.locais),
      comoChamaServico: corpo.vocabulario?.servico?.singular ?? null,
    }
  } catch {
    return { ok: false, motivo: `a ${NOME_DA_AGENDA} respondeu algo que não é JSON.` }
  }
}

const nomes = (lista: { nome?: string }[] | undefined): string[] =>
  (lista ?? []).map((item) => (item.nome ?? '').trim()).filter((nome) => nome !== '')
